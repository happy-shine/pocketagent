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

  // Track switching
  lastEngine?: EngineType;

  createdAt: number;
  lastActiveAt: number;
  title?: string;
  isActive: boolean;
  sessionNum: number;
  isGroup?: boolean;

  // In-session turns history
  turns: SessionHistoryItem[];
}

export interface ChatSessionState {
  chatId: string;
  activeSessionId: string;
  sessions: Session[];
  preferredEngine?: EngineType;
  preferredModel?: string;
  preferredEffort?: string;
}
