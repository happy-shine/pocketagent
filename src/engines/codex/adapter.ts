import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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
import { discoverCodexCapabilities } from "./discovery.js";
import { buildCodexSpawnArgs, mapCodexEvent, parseCodexJsonLine } from "./parser.js";

export class CodexEngineAdapter implements EngineAdapter {
  readonly type = "codex" as const;

  private processes = new Map<string, EngineProcess>();
  private config: EngineRuntimeConfig;
  private log: Logger;

  constructor(config: EngineRuntimeConfig, log: Logger) {
    this.config = config;
    this.log = log.child({ module: "codex-engine-adapter" });
  }

  async getCapabilities(forceRefresh?: boolean): Promise<EngineCapabilities> {
    return discoverCodexCapabilities(this.config.binary, this.config.customModels, forceRefresh);
  }

  acquire(session: Session, botId: string): EngineProcess {
    const existing = this.processes.get(session.sessionId);
    if (existing) {
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

    const ep: EngineProcess = {
      sessionId: session.sessionId,
      engineType: "codex",
      engineSessionId: session.codexSessionId,
      busy: false,
      lastActiveAt: Date.now(),
      workspaceDir: sessionDir,
    };

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
    const ep = this.acquire(session, botId);
    ep.busy = true;
    ep.lastActiveAt = Date.now();
    this.clearIdleTimer(session.sessionId);

    // Context Handover check
    let fullPrompt = text;
    if (!session.codexSessionId && session.turns && session.turns.length > 0) {
      const primer = buildContextHandoverPrimer(session, "codex", ep.workspaceDir);
      if (primer) {
        fullPrompt = `${primer}\n\n${text}`;
      }
    } else if (session.codexSessionId && session.lastEngine && session.lastEngine !== "codex") {
      const deltaTurns = getDeltaTurnsForEngine(session, "codex");
      if (deltaTurns.length > 0) {
        const deltaLines = deltaTurns.map(
          (t) => `[${t.role === "assistant" ? `Assistant (${t.engine})` : "User"}]: ${t.text}`,
        );
        fullPrompt = `[Context Update while you were away]\n${deltaLines.join("\n")}\n\n${text}`;
      }
    }

    // Compose system prompt
    const systemParts = buildSystemPromptParts({
      agentsDir: this.config.agentsDir,
      botId,
      apiPort: this.config.apiPort,
      chatId: session.chatId,
      channelType: session.channelType,
      isGroup: Boolean(session.isGroup),
      identity,
    });

    const finalPrompt = systemParts.length > 0
      ? `<pocketagent-system>\n${systemParts.join("\n\n---\n\n")}\n</pocketagent-system>\n\n${fullPrompt}`
      : fullPrompt;

    const extraArgs = [...this.config.extraArgs];
    if (botExtraArgs) extraArgs.push(...botExtraArgs);

    const isForeignModel = (m?: string) => {
      if (!m) return false;
      const lower = m.toLowerCase();
      return lower.startsWith("gemini") || lower.startsWith("claude") || lower.includes("sonnet") || lower.includes("opus") || lower.includes("haiku");
    };

    const rawModel = session.engineModels?.codex ?? (!isForeignModel(session.model) ? session.model : undefined);
    const activeModel = rawModel ?? (!isForeignModel(this.config.model) ? this.config.model : undefined);
    if (activeModel) extraArgs.push("--model", activeModel);

    const activeEffort = session.engineEfforts?.codex ?? session.effort ?? this.config.effort;
    if (activeEffort && ["low", "medium", "high", "xhigh"].includes(activeEffort.toLowerCase())) {
      extraArgs.push("-c", `model_reasoning_effort=${activeEffort.toLowerCase()}`);
    }

    const spawnCmd = buildCodexSpawnArgs({
      binary: this.config.binary,
      prompt: finalPrompt,
      engineSessionId: session.codexSessionId,
      extraArgs,
      sandbox: this.config.codex?.sandbox ?? "danger-full-access",
      approvalPolicy: this.config.codex?.approvalPolicy ?? "never",
    });

    this.log.info({ sessionId: session.sessionId, args: spawnCmd.args }, "Spawning Codex turn process");
    const proc = spawn(spawnCmd.cmd, spawnCmd.args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: ep.workspaceDir,
      env: { ...process.env },
    });
    ep.process = proc;

    proc.stdin?.write(spawnCmd.stdin);
    proc.stdin?.end();

    const rl = createInterface({ input: proc.stdout!, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        const jsonEvent = parseCodexJsonLine(line);
        if (!jsonEvent) continue;

        const events = mapCodexEvent(jsonEvent);
        for (const ev of events) {
          if (ev.type === "session_started") {
            session.codexSessionId = ev.sessionId;
            ep.engineSessionId = ev.sessionId;
          }
          yield ev;
        }
      }
    } finally {
      rl.close();
      ep.busy = false;
      ep.lastActiveAt = Date.now();
      this.scheduleIdle(session.sessionId);
    }
  }

  sendControl(_sessionId: string, _request: Record<string, unknown>): boolean {
    return false;
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
      this.processes.delete(oldestId);
    }
  }
}
