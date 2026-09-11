import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Logger } from "pino";
import type { Session } from "../../sessions/types.js";
import { buildContextHandoverPrimer, getDeltaTurnsForEngine } from "../../sessions/handover.js";
import { buildSystemPromptParts } from "../prompt.js";
import type {
  BotIdentity,
  EngineAdapter,
  EngineCapabilities,
  EngineEvent,
  EngineProcess,
  EngineRuntimeConfig,
} from "../types.js";
import { discoverClaudeCapabilities } from "./discovery.js";

export class ClaudeEngineAdapter implements EngineAdapter {
  readonly type = "claude" as const;

  private processes = new Map<string, EngineProcess>();
  private config: EngineRuntimeConfig;
  private log: Logger;

  constructor(config: EngineRuntimeConfig, log: Logger) {
    this.config = config;
    this.log = log.child({ module: "claude-engine-adapter" });
  }

  async getCapabilities(forceRefresh?: boolean): Promise<EngineCapabilities> {
    return discoverClaudeCapabilities(this.config.binary, this.config.customModels, forceRefresh);
  }

  acquire(session: Session, botId: string, botExtraArgs?: string[], identity?: BotIdentity): EngineProcess {
    const existing = this.processes.get(session.sessionId);
    if (existing && existing.process && !existing.process.killed) {
      this.resetIdleTimer(session.sessionId);
      return existing;
    }

    if (this.processes.size >= this.config.maxProcesses) {
      this.evictOldest();
    }

    const safeChatId = session.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const sessionDir = join(
      this.config.workspaceDir,
      botId,
      `${safeChatId}_${session.sessionId}`,
    );
    mkdirSync(sessionDir, { recursive: true });

    // Inject system prompt & skills into CLAUDE.md in workspace and via --append-system-prompt
    const systemParts = buildSystemPromptParts({
      agentsDir: this.config.agentsDir,
      botId,
      apiPort: this.config.apiPort,
      chatId: session.chatId,
      channelType: session.channelType,
      isGroup: Boolean(session.isGroup),
      identity,
    });
    const promptContent = systemParts.length > 0 ? systemParts.join("\n\n---\n\n") : "";
    if (promptContent) {
      writeFileSync(join(sessionDir, "CLAUDE.md"), promptContent);
    }

    const args = [
      "-p",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--verbose",
      "--permission-mode", "bypassPermissions",
    ];

    if (session.claudeSessionId) {
      args.push("--resume", session.claudeSessionId);
    }

    const isForeignModel = (m?: string) => {
      if (!m) return false;
      const lower = m.toLowerCase();
      return lower.startsWith("gemini") || lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3");
    };

    const rawModel = session.engineModels?.claude ?? (!isForeignModel(session.model) ? session.model : undefined);
    const activeModel = rawModel ?? (!isForeignModel(this.config.model) ? this.config.model : undefined);
    if (activeModel) {
      args.push("--model", activeModel);
    }

    const rawEffort = session.engineEfforts?.claude ?? session.effort;
    const activeEffort = rawEffort ?? this.config.effort;
    if (activeEffort) {
      args.push("--effort", activeEffort.toLowerCase());
    }

    args.push(...this.config.extraArgs);
    if (botExtraArgs) {
      args.push(...botExtraArgs);
    }

    this.log.info({ sessionId: session.sessionId, args }, "Spawning Claude process");
    const proc = spawn(this.config.binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: sessionDir,
      env: { ...process.env },
    });

    const ep: EngineProcess = {
      sessionId: session.sessionId,
      engineType: "claude",
      engineSessionId: session.claudeSessionId,
      process: proc,
      busy: false,
      lastActiveAt: Date.now(),
      workspaceDir: sessionDir,
    };

    proc.on("exit", (code, signal) => {
      this.log.info({ sessionId: session.sessionId, code, signal }, "Claude process exited");
      this.processes.delete(session.sessionId);
    });

    this.processes.set(session.sessionId, ep);
    this.scheduleIdle(session.sessionId);
    return ep;
  }

  async *sendMessage(
    session: Session,
    text: string,
    botId: string,
    botExtraArgs?: string[],
    identity?: BotIdentity,
  ): AsyncGenerator<EngineEvent> {
    const ep = this.acquire(session, botId, botExtraArgs, identity);
    if (!ep.process || !ep.process.stdin) {
      yield { type: "error", message: "Failed to spawn Claude process" };
      return;
    }

    ep.busy = true;
    ep.lastActiveAt = Date.now();
    this.clearIdleTimer(session.sessionId);

    // Check for Context Handover
    let fullPrompt = text;
    if (!session.claudeSessionId && session.turns && session.turns.length > 0) {
      const primer = buildContextHandoverPrimer(session, "claude", ep.workspaceDir);
      if (primer) {
        fullPrompt = `${primer}\n\n${text}`;
      }
    } else if (session.claudeSessionId && session.lastEngine && session.lastEngine !== "claude") {
      // Switched back to Claude: inject delta turns
      const deltaTurns = getDeltaTurnsForEngine(session, "claude");
      if (deltaTurns.length > 0) {
        const deltaLines = deltaTurns.map(
          (t) => `[${t.role === "assistant" ? `Assistant (${t.engine})` : "User"}]: ${t.text}`,
        );
        fullPrompt = `[Context Update while you were away]\n${deltaLines.join("\n")}\n\n${text}`;
      }
    }

    const payload = JSON.stringify({
      type: "user",
      message: { role: "user", content: fullPrompt },
    });
    ep.process.stdin.write(payload + "\n");

    const rl = createInterface({ input: ep.process.stdout!, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (typeof event.session_id === "string" && !session.claudeSessionId) {
          session.claudeSessionId = event.session_id;
          ep.engineSessionId = event.session_id;
          yield { type: "session_started", sessionId: event.session_id };
        }

        // Map events
        if (event.type === "thinking_start" || event.subtype === "thinking") {
          yield { type: "thinking_started" };
        } else if (event.type === "stream_event" && (event.event as any)?.type === "content_block_start" && (event.event as any)?.content_block?.type === "thinking") {
          yield { type: "thinking_started" };
        } else if (event.type === "tool_use" || (event.type === "content_block_start" && (event.content_block as any)?.type === "tool_use")) {
          const tool = (event.content_block as any) ?? event;
          yield { type: "tool_started", name: tool.name ?? "tool", detail: JSON.stringify(tool.input ?? {}) };
        } else if (event.type === "text" && typeof event.text === "string") {
          yield { type: "text", text: event.text };
        } else if (event.type === "content_block_delta" && (event.delta as any)?.type === "text_delta") {
          yield { type: "text", text: (event.delta as any).text };
        } else if (event.type === "assistant" && event.message) {
          const content = (event.message as any).content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block && typeof block === "object") {
                if (block.type === "tool_use" && typeof block.name === "string") {
                  yield { type: "tool_started", name: block.name, detail: JSON.stringify(block.input ?? {}) };
                }
                if (block.type === "text" && typeof block.text === "string") {
                  yield { type: "text", text: block.text };
                }
              }
            }
          } else if (typeof content === "string") {
            yield { type: "text", text: content };
          }
        } else if (event.type === "result") {
          yield {
            type: "result",
            result: typeof event.result === "string" ? event.result : undefined,
            isError: Boolean(event.is_error),
          };
          return;
        }
      }
    } finally {
      rl.close();
      ep.busy = false;
      ep.lastActiveAt = Date.now();
      this.scheduleIdle(session.sessionId);
    }
  }

  sendControl(sessionId: string, request: Record<string, unknown>): boolean {
    const ep = this.processes.get(sessionId);
    if (!ep || !ep.process || !ep.process.stdin || ep.process.killed) {
      return false;
    }
    const msg = JSON.stringify({
      type: "control_request",
      request_id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      request,
    });
    try {
      ep.process.stdin.write(msg + "\n");
      return true;
    } catch {
      return false;
    }
  }

  hasProcess(sessionId: string): boolean {
    const ep = this.processes.get(sessionId);
    return Boolean(ep && ep.process && !ep.process.killed);
  }

  isBusy(sessionId: string): boolean {
    const ep = this.processes.get(sessionId);
    return Boolean(ep && ep.busy);
  }

  getWorkspaceDir(sessionId: string): string | undefined {
    return this.processes.get(sessionId)?.workspaceDir;
  }

  getRunningCount(): number {
    return this.processes.size;
  }

  updateConfig(config: Partial<EngineRuntimeConfig>): void {
    Object.assign(this.config, config);
  }

  async shutdown(): Promise<void> {
    for (const [id, ep] of this.processes) {
      this.clearIdleTimer(id);
      if (ep.process && !ep.process.killed) {
        ep.process.kill("SIGTERM");
      }
    }
    this.processes.clear();
  }

  private scheduleIdle(sessionId: string): void {
    this.clearIdleTimer(sessionId);
    const ep = this.processes.get(sessionId);
    if (!ep) return;
    ep.idleTimer = setTimeout(() => {
      this.log.info({ sessionId }, "Claude process idle timeout, terminating");
      if (ep.process && !ep.process.killed) {
        ep.process.kill("SIGTERM");
      }
      this.processes.delete(sessionId);
    }, this.config.idleTimeoutMs);
  }

  private clearIdleTimer(sessionId: string): void {
    const ep = this.processes.get(sessionId);
    if (ep?.idleTimer) {
      clearTimeout(ep.idleTimer);
      ep.idleTimer = undefined;
    }
  }

  private resetIdleTimer(sessionId: string): void {
    this.clearIdleTimer(sessionId);
    this.scheduleIdle(sessionId);
  }

  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, ep] of this.processes) {
      if (!ep.busy && ep.lastActiveAt < oldestTime) {
        oldestTime = ep.lastActiveAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      const ep = this.processes.get(oldestId);
      if (ep?.process && !ep.process.killed) {
        ep.process.kill("SIGTERM");
      }
      this.processes.delete(oldestId);
    }
  }
}
