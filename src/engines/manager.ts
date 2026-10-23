import type { Logger } from "pino";
import type { Session, EngineType } from "../sessions/types.js";
import { ClaudeEngineAdapter } from "./claude/adapter.js";
import { AgyEngineAdapter } from "./agy/adapter.js";
import { CodexEngineAdapter } from "./codex/adapter.js";
import { GrokEngineAdapter } from "./grok/adapter.js";
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
  private memoryRoot: string;
  private memoryEnabled = false;

  constructor(config: GatewayConfig, log: Logger, apiPort: number, dataDir: string) {
    this.log = log.child({ module: "engine-manager" });

    const maxProcesses = config.engines.maxProcesses;
    const idleTimeoutMs = config.engines.idleTimeoutMs;
    const backgroundJobs = config.jobs.enabled;
    const workspaceDir = `${dataDir}/workspaces`;
    const agentsDir = `${dataDir}/agents`;
    this.memoryRoot = `${dataDir}/memory`;
    const { memoryDir, nativeMemory } = this.memorySettings(config);

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
      backgroundJobs,
      customModels: config.engines.claude.customModels,
      memoryDir,
      nativeMemory,
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
      backgroundJobs,
      customModels: config.engines.agy.customModels,
      memoryDir,
      nativeMemory,
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
      backgroundJobs,
      customModels: config.engines.codex.customModels,
      memoryDir,
      nativeMemory,
      codex: {
        sandbox: config.engines.codex.sandbox,
        approvalPolicy: config.engines.codex.approvalPolicy,
      },
    };
    this.adapters.set("codex", new CodexEngineAdapter(codexConfig, this.log));

    // Initialize Grok adapter
    const grokConfig: EngineRuntimeConfig = {
      type: "grok",
      binary: config.engines.grok.binary,
      model: config.engines.grok.model,
      effort: config.engines.grok.effort,
      extraArgs: config.engines.grok.extraArgs,
      maxProcesses,
      idleTimeoutMs,
      workspaceDir,
      apiPort,
      agentsDir,
      backgroundJobs,
      customModels: config.engines.grok.customModels,
      memoryDir,
      nativeMemory,
    };
    this.adapters.set("grok", new GrokEngineAdapter(grokConfig, this.log));
  }

  /** Where the shared memory lives, or undefined when it is turned off. */
  getMemoryDir(): string | undefined {
    return this.memoryEnabled ? this.memoryRoot : undefined;
  }

  private memorySettings(config: GatewayConfig): { memoryDir?: string; nativeMemory: boolean } {
    this.memoryEnabled = config.memory?.enabled ?? true;
    return {
      memoryDir: this.memoryEnabled ? this.memoryRoot : undefined,
      nativeMemory: config.memory?.nativeEngineMemory ?? false,
    };
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

  release(sessionId: string, activeEngine: EngineType): void {
    this.adapters.get(activeEngine)?.release(sessionId);
  }

  hasProcess(sessionId: string, activeEngine: EngineType): boolean {
    const adapter = this.adapters.get(activeEngine);
    return Boolean(adapter && adapter.hasProcess(sessionId));
  }

  isBusy(sessionId: string, activeEngine: EngineType): boolean {
    const adapter = this.adapters.get(activeEngine);
    return Boolean(adapter && adapter.isBusy(sessionId));
  }

  supportsSteer(activeEngine: EngineType): boolean {
    return Boolean(this.adapters.get(activeEngine)?.supportsSteer);
  }

  getWorkspaceDir(sessionId: string, activeEngine: EngineType): string | undefined {
    const adapter = this.adapters.get(activeEngine);
    return adapter?.getWorkspaceDir(sessionId);
  }

  updateConfig(config: GatewayConfig): void {
    const maxProcesses = config.engines.maxProcesses;
    const idleTimeoutMs = config.engines.idleTimeoutMs;
    const backgroundJobs = config.jobs.enabled;
    const { memoryDir, nativeMemory } = this.memorySettings(config);

    const claude = this.adapters.get("claude");
    claude?.updateConfig({
      binary: config.engines.claude.binary,
      model: config.engines.claude.model,
      effort: config.engines.claude.effort,
      extraArgs: config.engines.claude.extraArgs,
      customModels: config.engines.claude.customModels,
      maxProcesses,
      idleTimeoutMs,
      backgroundJobs,
      memoryDir,
      nativeMemory,
    });

    const agy = this.adapters.get("agy");
    agy?.updateConfig({
      binary: config.engines.agy.binary,
      model: config.engines.agy.model,
      effort: config.engines.agy.effort,
      extraArgs: config.engines.agy.extraArgs,
      customModels: config.engines.agy.customModels,
      maxProcesses,
      idleTimeoutMs,
      backgroundJobs,
      memoryDir,
      nativeMemory,
    });

    const codex = this.adapters.get("codex");
    codex?.updateConfig({
      binary: config.engines.codex.binary,
      model: config.engines.codex.model,
      effort: config.engines.codex.effort,
      extraArgs: config.engines.codex.extraArgs,
      customModels: config.engines.codex.customModels,
      maxProcesses,
      idleTimeoutMs,
      backgroundJobs,
      memoryDir,
      nativeMemory,
      codex: {
        sandbox: config.engines.codex.sandbox,
        approvalPolicy: config.engines.codex.approvalPolicy,
      },
    });

    const grok = this.adapters.get("grok");
    grok?.updateConfig({
      binary: config.engines.grok.binary,
      model: config.engines.grok.model,
      effort: config.engines.grok.effort,
      extraArgs: config.engines.grok.extraArgs,
      customModels: config.engines.grok.customModels,
      maxProcesses,
      idleTimeoutMs,
      backgroundJobs,
      memoryDir,
      nativeMemory,
    });
  }

  async getAllCapabilities(forceRefresh?: boolean): Promise<Record<string, EngineCapabilities>> {
    const result: Record<string, EngineCapabilities> = {};
    for (const [type, adapter] of this.adapters.entries()) {
      try {
        result[type] = await adapter.getCapabilities(forceRefresh);
      } catch {
        result[type] = { models: [], efforts: [], supportsEffort: false, supportsCustomModel: false };
      }
    }
    return result;
  }

  async shutdown(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.shutdown();
    }
  }
}
