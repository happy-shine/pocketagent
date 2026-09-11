import type { Logger } from "pino";
import type { Session, EngineType } from "../sessions/types.js";
import { ClaudeEngineAdapter } from "./claude/adapter.js";
import { AgyEngineAdapter } from "./agy/adapter.js";
import { CodexEngineAdapter } from "./codex/adapter.js";
import type {
  BotIdentity,
  EngineAdapter,
  EngineCapabilities,
  EngineEvent,
  EngineProcess,
  EngineRuntimeConfig,
} from "./types.js";
import type { GatewayConfig } from "../config/types.js";

export class EngineManager {
  private adapters = new Map<EngineType, EngineAdapter>();
  private log: Logger;

  constructor(config: GatewayConfig, log: Logger, apiPort: number, dataDir: string) {
    this.log = log.child({ module: "engine-manager" });

    const maxProcesses = config.engines.maxProcesses;
    const idleTimeoutMs = config.engines.idleTimeoutMs;
    const workspaceDir = `${dataDir}/workspaces`;
    const agentsDir = `${dataDir}/agents`;

    // Initialize Claude adapter
    const claudeConfig: EngineRuntimeConfig = {
      type: "claude",
      binary: config.engines.claude.binary,
      model: config.engines.claude.model,
      effort: config.engines.claude.effort,
      extraArgs: config.engines.claude.extraArgs,
      maxProcesses,
      idleTimeoutMs,
      workspaceDir,
      apiPort,
      agentsDir,
      customModels: config.engines.claude.customModels,
    };
    this.adapters.set("claude", new ClaudeEngineAdapter(claudeConfig, this.log));

    // Initialize Agy adapter
    const agyConfig: EngineRuntimeConfig = {
      type: "agy",
      binary: config.engines.agy.binary,
      model: config.engines.agy.model,
      effort: config.engines.agy.effort,
      extraArgs: config.engines.agy.extraArgs,
      maxProcesses,
      idleTimeoutMs,
      workspaceDir,
      apiPort,
      agentsDir,
      customModels: config.engines.agy.customModels,
    };
    this.adapters.set("agy", new AgyEngineAdapter(agyConfig, this.log));

    // Initialize Codex adapter
    const codexConfig: EngineRuntimeConfig = {
      type: "codex",
      binary: config.engines.codex.binary,
      model: config.engines.codex.model,
      effort: config.engines.codex.effort,
      extraArgs: config.engines.codex.extraArgs,
      maxProcesses,
      idleTimeoutMs,
      workspaceDir,
      apiPort,
      agentsDir,
      customModels: config.engines.codex.customModels,
      codex: {
        sandbox: config.engines.codex.sandbox,
        approvalPolicy: config.engines.codex.approvalPolicy,
      },
    };
    this.adapters.set("codex", new CodexEngineAdapter(codexConfig, this.log));
  }

  getAdapter(type: EngineType): EngineAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Unsupported engine type: ${type}`);
    }
    return adapter;
  }

  async getCapabilities(type: EngineType, forceRefresh?: boolean): Promise<EngineCapabilities> {
    return this.getAdapter(type).getCapabilities(forceRefresh);
  }

  acquire(session: Session, botId: string, botExtraArgs?: string[], identity?: BotIdentity): EngineProcess {
    const adapter = this.getAdapter(session.activeEngine);
    return adapter.acquire(session, botId, botExtraArgs, identity);
  }

  async *sendMessage(
    session: Session,
    text: string,
    botId: string,
    botExtraArgs?: string[],
    identity?: BotIdentity,
  ): AsyncGenerator<EngineEvent> {
    const adapter = this.getAdapter(session.activeEngine);
    yield* adapter.sendMessage(session, text, botId, botExtraArgs, identity);
  }

  sendControl(sessionId: string, activeEngine: EngineType, request: Record<string, unknown>): boolean {
    const adapter = this.adapters.get(activeEngine);
    return adapter ? adapter.sendControl(sessionId, request) : false;
  }

  hasProcess(sessionId: string, activeEngine: EngineType): boolean {
    const adapter = this.adapters.get(activeEngine);
    return Boolean(adapter && adapter.hasProcess(sessionId));
  }

  isBusy(sessionId: string, activeEngine: EngineType): boolean {
    const adapter = this.adapters.get(activeEngine);
    return Boolean(adapter && adapter.isBusy(sessionId));
  }

  getWorkspaceDir(sessionId: string, activeEngine: EngineType): string | undefined {
    const adapter = this.adapters.get(activeEngine);
    return adapter?.getWorkspaceDir(sessionId);
  }

  async shutdown(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.shutdown();
    }
  }
}
