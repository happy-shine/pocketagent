import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
import { discoverGrokCapabilities } from "./discovery.js";
import { buildGrokSpawnArgs, GrokEventMapper, parseGrokJsonLine } from "./parser.js";

const GROK_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const MAX_STDERR_LENGTH = 4000;

type TurnOutcome = "ok" | "resume_failed";

export class GrokEngineAdapter implements EngineAdapter {
  readonly type = "grok" as const;

  private processes = new Map<string, EngineProcess>();
  private interrupted = new Set<string>();
  private config: EngineRuntimeConfig;
  private log: Logger;

  constructor(config: EngineRuntimeConfig, log: Logger) {
    this.config = config;
    this.log = log.child({ module: "grok-engine-adapter" });
  }

  async getCapabilities(forceRefresh?: boolean): Promise<EngineCapabilities> {
    return discoverGrokCapabilities(this.config.binary, this.config.customModels, forceRefresh);
  }

  acquire(session: Session, botId: string, _botExtraArgs?: string[], _identity?: BotIdentity): EngineProcess {
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
      engineType: "grok",
      engineSessionId: session.grokSessionId,
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
    const ep = this.acquire(session, botId, botExtraArgs, identity);
    ep.busy = true;
    ep.lastActiveAt = Date.now();
    this.clearIdleTimer(session.sessionId);
    this.interrupted.delete(session.sessionId);

    try {
      const outcome = yield* this.runTurn(session, ep, text, botId, botExtraArgs, identity);
      if (outcome === "resume_failed") {
        // Grok session vanished (e.g. ~/.grok/sessions was cleared): start fresh with a context handover
        this.log.warn({ sessionId: session.sessionId, grokSessionId: session.grokSessionId }, "Grok session not found, starting a new one");
        session.grokSessionId = undefined;
        ep.engineSessionId = undefined;
        yield* this.runTurn(session, ep, text, botId, botExtraArgs, identity);
      }
    } finally {
      this.interrupted.delete(session.sessionId);
      ep.process = undefined;
      ep.busy = false;
      ep.lastActiveAt = Date.now();
      this.scheduleIdle(session.sessionId);
    }
  }

  private async *runTurn(
    session: Session,
    ep: EngineProcess,
    text: string,
    botId: string,
    botExtraArgs?: string[],
    identity?: BotIdentity,
  ): AsyncGenerator<EngineEvent, TurnOutcome> {
    const resumeSessionId = session.grokSessionId;
    const newSessionId = resumeSessionId ? undefined : randomUUID();

    // Context Handover check
    let fullPrompt = text;
    let rules: string | undefined;
    if (!resumeSessionId) {
      // Grok only auto-loads AGENTS.md in trusted folders, so the system prompt goes in via --rules
      const systemParts = buildSystemPromptParts({
        agentsDir: this.config.agentsDir,
        botId,
        apiPort: this.config.apiPort,
        chatId: session.chatId,
        channelType: session.channelType,
        isGroup: Boolean(session.isGroup),
        identity,
      });
      if (systemParts.length > 0) rules = systemParts.join("\n\n---\n\n");

      if (session.turns && session.turns.length > 0) {
        const primer = buildContextHandoverPrimer(session, "grok", ep.workspaceDir);
        if (primer) {
          fullPrompt = `${primer}\n\n${text}`;
        }
      }
    } else if (session.lastEngine && session.lastEngine !== "grok") {
      const deltaTurns = getDeltaTurnsForEngine(session, "grok");
      if (deltaTurns.length > 0) {
        const deltaLines = deltaTurns.map(
          (t) => `[${t.role === "assistant" ? `Assistant (${t.engine})` : "User"}]: ${t.text}`,
        );
        fullPrompt = `[Context Update while you were away]\n${deltaLines.join("\n")}\n\n${text}`;
      }
    }

    const isForeignModel = (m?: string) => {
      if (!m) return false;
      const lower = m.toLowerCase();
      return lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("gemini")
        || lower.startsWith("claude") || ["sonnet", "opus", "haiku", "fable"].some((n) => lower.includes(n));
    };

    const rawModel = session.engineModels?.grok ?? (!isForeignModel(session.model) ? session.model : undefined);
    const activeModel = rawModel ?? (!isForeignModel(this.config.model) ? this.config.model : undefined);

    // An explicit Grok effort passes through (allows model-specific ids); inherited ones must be valid for Grok
    const inheritedEffort = (session.effort ?? this.config.effort)?.toLowerCase();
    const activeEffort = session.engineEfforts?.grok
      ?? (inheritedEffort && GROK_EFFORTS.includes(inheritedEffort) ? inheritedEffort : undefined);

    // Pass the prompt through a file to stay clear of per-argument length limits
    const promptFile = join(tmpdir(), `pocketagent-grok-${randomUUID()}.md`);
    writeFileSync(promptFile, fullPrompt);

    const spawnCmd = buildGrokSpawnArgs({
      binary: this.config.binary,
      promptFile,
      resumeSessionId,
      newSessionId,
      rules,
      model: activeModel,
      effort: activeEffort,
      extraArgs: [...this.config.extraArgs, ...(botExtraArgs ?? [])],
    });

    this.log.info(
      { sessionId: session.sessionId, resume: resumeSessionId, newSessionId, model: activeModel, effort: activeEffort },
      "Spawning Grok turn process",
    );
    const proc = spawn(spawnCmd.cmd, spawnCmd.args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ep.workspaceDir,
      env: { ...process.env },
    });
    ep.process = proc;

    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-MAX_STDERR_LENGTH);
    });
    const exited = new Promise<{ code: number | null; spawnError?: Error }>((resolve) => {
      proc.once("error", (err) => resolve({ code: null, spawnError: err }));
      proc.once("close", (code) => resolve({ code }));
    });

    const mapper = new GrokEventMapper();
    let sawEvent = false;
    let sawResult = false;
    const rl = createInterface({ input: proc.stdout!, crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        const jsonEvent = parseGrokJsonLine(line);
        if (!jsonEvent) continue;
        sawEvent = true;

        // The pre-assigned session exists (and is resumable) once Grok starts streaming
        if (newSessionId && !session.grokSessionId && jsonEvent.type !== "error") {
          session.grokSessionId = newSessionId;
          ep.engineSessionId = newSessionId;
          yield { type: "session_started", sessionId: newSessionId };
        }

        for (const ev of mapper.map(jsonEvent)) {
          if (ev.type === "session_started") {
            if (ev.sessionId === session.grokSessionId) continue;
            session.grokSessionId = ev.sessionId;
            ep.engineSessionId = ev.sessionId;
          }
          if (ev.type === "result") sawResult = true;
          yield ev;
        }
      }

      const { code, spawnError } = await exited;
      if (sawResult) return "ok";

      if (this.interrupted.has(session.sessionId)) {
        yield { type: "result", result: "(Interrupted)", isError: false };
        return "ok";
      }

      const errText = stderr.trim();
      if (resumeSessionId && !sawEvent && code !== 0 && /not found|404/i.test(errText)) {
        return "resume_failed";
      }

      if (spawnError || code !== 0) {
        const detail = spawnError ? spawnError.message : errText.split("\n").slice(-3).join("\n");
        const message = `Grok exited${code !== null ? ` with code ${code}` : ""}${detail ? `: ${detail}` : ""}`;
        yield { type: "error", message };
        yield { type: "result", result: message, isError: true };
      } else {
        yield { type: "result", isError: false };
      }
      return "ok";
    } finally {
      rl.close();
      if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGTERM");
      rmSync(promptFile, { force: true });
    }
  }

  sendControl(sessionId: string, request: Record<string, unknown>): boolean {
    if (request.subtype !== "interrupt") return false;
    const ep = this.processes.get(sessionId);
    if (!ep?.busy || !ep.process || ep.process.exitCode !== null || ep.process.signalCode !== null) {
      return false;
    }
    this.interrupted.add(sessionId);
    return ep.process.kill("SIGINT");
  }

  hasProcess(sessionId: string): boolean {
    const ep = this.processes.get(sessionId);
    return Boolean(ep?.process && ep.process.exitCode === null && ep.process.signalCode === null);
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
      if (ep.process && ep.process.exitCode === null) {
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
      this.clearIdleTimer(oldestId);
      this.processes.delete(oldestId);
    }
  }
}
