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
import { discoverAgyCapabilities } from "./discovery.js";

export class AgyEngineAdapter implements EngineAdapter {
  readonly type = "agy" as const;

  private processes = new Map<string, EngineProcess>();
  private config: EngineRuntimeConfig;
  private log: Logger;

  constructor(config: EngineRuntimeConfig, log: Logger) {
    this.config = config;
    this.log = log.child({ module: "agy-engine-adapter" });
  }

  async getCapabilities(forceRefresh?: boolean): Promise<EngineCapabilities> {
    return discoverAgyCapabilities(this.config.binary, this.config.customModels, forceRefresh);
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

    // Inject system prompt & skills into AGENTS.md & GEMINI.md
    const systemParts = buildSystemPromptParts({
      agentsDir: this.config.agentsDir,
      botId,
      apiPort: this.config.apiPort,
      chatId: session.chatId,
      isGroup: Boolean(session.isGroup),
      identity,
    });
    if (systemParts.length > 0) {
      const content = systemParts.join("\n\n---\n\n");
      writeFileSync(join(sessionDir, "AGENTS.md"), content);
      writeFileSync(join(sessionDir, "GEMINI.md"), content);
    }

    const args = [
      "--dangerously-skip-permissions",
      "--output-format", "stream-json",
      "--input-format", "stream-json",
    ];

    if (session.agySessionId) {
      args.push("--conversation", session.agySessionId);
    }

    const isForeignModel = (m?: string) => {
      if (!m) return false;
      const lower = m.toLowerCase();
      return lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3");
    };

    const rawModel = session.engineModels?.agy ?? (!isForeignModel(session.model) ? session.model : undefined);
    const activeModel = rawModel ?? (!isForeignModel(this.config.model) ? this.config.model : undefined);
    if (activeModel) {
      args.push("--model", activeModel);
    }

    const rawEffort = session.engineEfforts?.agy ?? session.effort;
    const activeEffort = rawEffort ?? this.config.effort;
    if (activeEffort && ["low", "medium", "high"].includes(activeEffort.toLowerCase())) {
      args.push("--effort", activeEffort.toLowerCase());
    }

    args.push(...this.config.extraArgs);
    if (botExtraArgs) {
      args.push(...botExtraArgs);
    }

    this.log.info({ sessionId: session.sessionId, args }, "Spawning Agy process");
    const proc = spawn(this.config.binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: sessionDir,
      env: { ...process.env },
    });

    const ep: EngineProcess = {
      sessionId: session.sessionId,
      engineType: "agy",
      engineSessionId: session.agySessionId,
      process: proc,
      busy: false,
      lastActiveAt: Date.now(),
      workspaceDir: sessionDir,
    };

    proc.on("exit", (code, signal) => {
      this.log.info({ sessionId: session.sessionId, code, signal }, "Agy process exited");
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
      yield { type: "error", message: "Failed to spawn Agy process" };
      return;
    }

    ep.busy = true;
    ep.lastActiveAt = Date.now();
    this.clearIdleTimer(session.sessionId);

    // Check for Context Handover
    let fullPrompt = text;
    if (!session.agySessionId) {
      let agentsMdContent = "";
      try {
        agentsMdContent = readFileSync(join(ep.workspaceDir, "AGENTS.md"), "utf-8");
      } catch {}

      if (session.turns && session.turns.length > 0) {
        const primer = buildContextHandoverPrimer(session, "agy", ep.workspaceDir);
        if (primer) {
          fullPrompt = `${primer}\n\n${text}`;
        }
      }

      if (agentsMdContent) {
        fullPrompt = `<SYSTEM_INSTRUCTIONS>\n${agentsMdContent}\n</SYSTEM_INSTRUCTIONS>\n\n${fullPrompt}`;
      }
    } else if (session.agySessionId && session.lastEngine && session.lastEngine !== "agy") {
      const deltaTurns = getDeltaTurnsForEngine(session, "agy");
      if (deltaTurns.length > 0) {
        const deltaLines = deltaTurns.map(
          (t) => `[${t.role === "assistant" ? `Assistant (${t.engine})` : "User"}]: ${t.text}`,
        );
        fullPrompt = `[Context Update while you were away]\n${deltaLines.join("\n")}\n\n${text}`;
      }
    }

    const payload = JSON.stringify({
      event: "user",
      message: { content: fullPrompt },
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

        const eventType = (event.event as string) || (event.type as string);

        // Session init
        if (eventType === "init" && typeof event.conversation_id === "string") {
          session.agySessionId = event.conversation_id;
          ep.engineSessionId = event.conversation_id;
          yield { type: "session_started", sessionId: event.conversation_id };
        } else if (typeof event.session_id === "string" && !session.agySessionId) {
          session.agySessionId = event.session_id;
          ep.engineSessionId = event.session_id;
          yield { type: "session_started", sessionId: event.session_id };
        }

        // Step update
        if (eventType === "step_update" && event.step_update && typeof event.step_update === "object") {
          const step = event.step_update as Record<string, unknown>;
          if (step.step_type === "agent_response") {
            if (typeof step.text_delta === "string" && step.text_delta) {
              yield { type: "text", text: step.text_delta };
            }
            if (step.state === "ACTIVE" && !step.text_delta) {
              yield { type: "thinking_started" };
            }
          } else if (step.step_type === "tool" && step.state === "ACTIVE") {
            const toolName = typeof step.tool_name === "string" ? step.tool_name : "tool";
            const toolInfo = (step.tool_info as Record<string, unknown>) ?? {};
            yield {
              type: "tool_started",
              name: toolName,
              detail: JSON.stringify(toolInfo.parameters ?? {}),
            };
          }
        }

        // Result finalize
        if (eventType === "result") {
          const resObj = (event.result ?? {}) as Record<string, unknown>;
          const responseText = typeof resObj.response === "string" ? resObj.response : undefined;
          yield {
            type: "result",
            result: responseText,
            isError: resObj.status === "ERROR",
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
      event: "control",
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
      this.log.info({ sessionId }, "Agy process idle timeout, terminating");
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
