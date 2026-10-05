import type { EngineType } from "../config/schema.js";

export type { EngineType };

export interface SessionHistoryItem {
  id: string;
  ts: number;
  role: "user" | "assistant" | "system";
  engine?: EngineType;
  author?: string;
  text: string;
}

export interface Session {
  sessionId: string;
  chatId: string;
  channelType: "telegram" | "discord" | string;
  activeEngine: EngineType;
  model?: string;
  effort?: string;

  // Native session IDs for each engine
  claudeSessionId?: string;
  codexSessionId?: string;
  agySessionId?: string;
  grokSessionId?: string;

  // Track switching
  lastEngine?: EngineType;

  createdAt: number;
  lastActiveAt: number;
  title?: string;
  isActive: boolean;
  sessionNum: number;
  isGroup?: boolean;

  // Per-engine model and effort tracking
  engineModels?: Partial<Record<EngineType, string>>;
  engineEfforts?: Partial<Record<EngineType, string>>;

  // In-session turns history
  turns: SessionHistoryItem[];

  // Workspace folder key, defaults to sessionId; side sessions (/btw) set it to share their parent session's files
  workspaceId?: string;
}

export interface ChatSessionState {
  chatId: string;
  activeSessionId: string;
  sessions: Session[];
  preferredEngine?: EngineType;
  preferredModels?: Partial<Record<EngineType, string>>;
  preferredEfforts?: Partial<Record<EngineType, string>>;
  preferredModel?: string;
  preferredEffort?: string;
}
