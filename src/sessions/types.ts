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

export interface SessionUsage {
  /** Latest model call context size (input + cache_read + cache_creation tokens) */
  contextTokens?: number;
  /** Cumulative output tokens in this session */
  outputTokens?: number;
  /** Latest turn output tokens */
  lastOutputTokens?: number;
  /** Cumulative cost in USD (when reported by engine, e.g. Claude) */
  totalCostUsd?: number;
  /** Number of context compactions / rotations in this session */
  compactions?: number;
  /** Timestamp (ms) of the last compaction */
  lastCompactionAt?: number;
  /** Context tokens before the last compaction */
  lastCompactionPreTokens?: number;
  /** Trigger of the last compaction (e.g. "auto" | "manual" | "auto-rotate") */
  lastCompactionTrigger?: string;
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

  // Track last message ID injected into session context for group chats
  lastContextMessageId?: string;
  // Last turn the background memory review has read (see memory/auto.ts)
  memoryCursor?: string;

  // Per engine, the shared memory (src/memory) its conversation last saw, so a change can be passed on
  memorySeen?: Partial<Record<EngineType, string>>;

  // Token usage & context compaction tracking
  usage?: SessionUsage;
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
