import type { ChildProcess } from "node:child_process";
import type { Session, EngineType } from "../sessions/types.js";

export type { EngineType };

export interface BotIdentity {
  name: string;
  username: string;
  peerBots?: Array<{ name: string; username: string }>;
}

export interface ModelInfo {
  id: string;
  label: string;
  description?: string;
  isDefault?: boolean;
  supportedEfforts?: EffortInfo[];
  defaultEffort?: string;
}

export interface EffortInfo {
  id: string;
  label: string;
  isDefault?: boolean;
}

export interface EngineCapabilities {
  models: ModelInfo[];
  efforts: EffortInfo[];
  supportsEffort: boolean;
  supportsCustomModel: boolean;
}

export interface EngineRuntimeConfig {
  type: EngineType;
  binary: string;
  model?: string;
  effort?: string;
  extraArgs: string[];
  maxProcesses: number;
  idleTimeoutMs: number;
  workspaceDir: string;
  apiPort: number;
  agentsDir: string;
  customModels?: ModelInfo[];
  codex?: {
    sandbox: "read-only" | "workspace-write" | "danger-full-access";
    approvalPolicy: "untrusted" | "on-request" | "never";
  };
}

export type EngineEvent =
  | { type: "session_started"; sessionId: string }
  | { type: "thinking_started" }
  | { type: "tool_started"; name: string; detail?: string }
  | { type: "text"; text: string }
  | { type: "result"; result?: string; isError?: boolean }
  | { type: "error"; message: string };

export interface EngineProcess {
  sessionId: string;
  engineType: EngineType;
  engineSessionId?: string;
  process?: ChildProcess;
  busy: boolean;
  lastActiveAt: number;
  idleTimer?: ReturnType<typeof setTimeout>;
  workspaceDir: string;
}

export interface EngineAdapter {
  readonly type: EngineType;
  getCapabilities(forceRefresh?: boolean): Promise<EngineCapabilities>;
  acquire(session: Session, botId: string, botExtraArgs?: string[], identity?: BotIdentity): EngineProcess;
  sendMessage(
    session: Session,
    text: string,
    botId: string,
    botExtraArgs?: string[],
    identity?: BotIdentity,
  ): AsyncGenerator<EngineEvent>;
  forkAndAsk?(
    session: Session,
    question: string,
    botId: string,
    botExtraArgs?: string[],
  ): AsyncGenerator<EngineEvent>;
  sendControl(sessionId: string, request: Record<string, unknown>): boolean;
  sendControlAndWait?(
    sessionId: string,
    request: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<Record<string, unknown> | null>;
  shutdown(): Promise<void>;
  updateConfig(config: Partial<EngineRuntimeConfig>): void;
  getRunningCount(): number;
  getWorkspaceDir(sessionId: string): string | undefined;
  hasProcess(sessionId: string): boolean;
  isBusy(sessionId: string): boolean;
}
