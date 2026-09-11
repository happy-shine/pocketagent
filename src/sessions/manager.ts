import { randomUUID } from "node:crypto";
import type { Session, ChatSessionState, EngineType, SessionHistoryItem } from "./types.js";
import { SessionStore } from "./store.js";

const MAX_TURNS_HISTORY = 50;

export interface SessionResolveOptions {
  chatId: string;
  channelType: string;
  isGroup?: boolean;
  defaultEngine?: EngineType;
  defaultModel?: string;
  defaultEffort?: string;
}

export class SessionManager {
  private chats = new Map<string, ChatSessionState>();
  private store?: SessionStore;

  constructor(store?: SessionStore) {
    this.store = store;
  }

  loadAll(): void {
    if (!this.store) return;
    for (const chatId of this.store.listChatIds()) {
      const state = this.store.load(chatId);
      if (state) {
        // Ensure turns array exists on loaded sessions
        for (const s of state.sessions) {
          if (!s.turns) s.turns = [];
          if (!s.activeEngine) s.activeEngine = "claude";
        }
        this.chats.set(chatId, state);
      }
    }
  }

  resolve(opts: SessionResolveOptions): Session {
    const state = this.chats.get(opts.chatId);
    if (state) {
      const active = state.sessions.find((s) => s.sessionId === state.activeSessionId);
      if (active) {
        if (active.isGroup === undefined && opts.isGroup !== undefined) {
          active.isGroup = opts.isGroup;
        }
        if (!active.turns) active.turns = [];
        if (!active.activeEngine) active.activeEngine = opts.defaultEngine ?? "claude";
        return active;
      }
    }
    return this.createFirst(opts);
  }

  private createFirst(opts: SessionResolveOptions): Session {
    const session: Session = {
      sessionId: randomUUID(),
      chatId: opts.chatId,
      channelType: opts.channelType,
      activeEngine: opts.defaultEngine ?? "claude",
      model: opts.defaultModel,
      effort: opts.defaultEffort,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: 1,
      isGroup: opts.isGroup,
      turns: [],
    };
    const state: ChatSessionState = {
      chatId: opts.chatId,
      activeSessionId: session.sessionId,
      sessions: [session],
    };
    this.chats.set(opts.chatId, state);
    return session;
  }

  createNew(
    chatId: string,
    defaultEngine: EngineType = "claude",
    defaultModel?: string,
    defaultEffort?: string,
  ): Session {
    const state = this.chats.get(chatId);
    if (!state) throw new Error(`No sessions for chat ${chatId}`);

    for (const s of state.sessions) {
      s.isActive = false;
    }

    const maxNum = Math.max(...state.sessions.map((s) => s.sessionNum ?? 0));
    const prev = state.sessions[0];

    const session: Session = {
      sessionId: randomUUID(),
      chatId,
      channelType: prev ? prev.channelType : "telegram",
      activeEngine: defaultEngine,
      model: defaultModel,
      effort: defaultEffort,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: maxNum + 1,
      isGroup: prev ? prev.isGroup : false,
      turns: [],
    };

    state.sessions.push(session);
    state.activeSessionId = session.sessionId;
    return session;
  }

  switchTo(chatId: string, index: number): Session | null {
    const state = this.chats.get(chatId);
    if (!state) return null;

    const target = state.sessions[index - 1];
    if (!target) return null;

    for (const s of state.sessions) {
      s.isActive = false;
    }
    target.isActive = true;
    state.activeSessionId = target.sessionId;
    return target;
  }

  list(chatId: string): Session[] {
    const state = this.chats.get(chatId);
    return state ? [...state.sessions] : [];
  }

  addTurn(
    sessionId: string,
    turn: {
      role: "user" | "assistant" | "system";
      text: string;
      engine?: EngineType;
      author?: string;
    },
  ): void {
    const session = this.findSession(sessionId);
    if (!session) return;

    if (!session.turns) session.turns = [];
    session.turns.push({
      id: randomUUID(),
      ts: Date.now(),
      role: turn.role,
      text: turn.text,
      engine: turn.engine ?? session.activeEngine,
      author: turn.author,
    });

    if (session.turns.length > MAX_TURNS_HISTORY) {
      session.turns = session.turns.slice(-MAX_TURNS_HISTORY);
    }
    session.lastActiveAt = Date.now();
  }

  setEngine(sessionId: string, engine: EngineType): boolean {
    const session = this.findSession(sessionId);
    if (!session) return false;

    if (session.activeEngine !== engine) {
      session.lastEngine = session.activeEngine;
      session.activeEngine = engine;
      session.lastActiveAt = Date.now();
    }
    return true;
  }

  setModel(sessionId: string, model: string): boolean {
    const session = this.findSession(sessionId);
    if (!session) return false;
    session.model = model;
    session.lastActiveAt = Date.now();
    return true;
  }

  setEffort(sessionId: string, effort: string): boolean {
    const session = this.findSession(sessionId);
    if (!session) return false;
    session.effort = effort;
    session.lastActiveAt = Date.now();
    return true;
  }

  setEngineSessionId(sessionId: string, engine: EngineType, engineSessionId: string): void {
    const session = this.findSession(sessionId);
    if (!session) return;
    if (engine === "claude") session.claudeSessionId = engineSessionId;
    else if (engine === "codex") session.codexSessionId = engineSessionId;
    else if (engine === "agy") session.agySessionId = engineSessionId;
    session.lastActiveAt = Date.now();
  }

  getEngineSessionId(sessionId: string, engine: EngineType): string | undefined {
    const session = this.findSession(sessionId);
    if (!session) return undefined;
    if (engine === "claude") return session.claudeSessionId;
    if (engine === "codex") return session.codexSessionId;
    if (engine === "agy") return session.agySessionId;
    return undefined;
  }

  update(sessionId: string, patch: Partial<Session>): void {
    const session = this.findSession(sessionId);
    if (session) {
      Object.assign(session, patch);
    }
  }

  findSession(sessionId: string): Session | undefined {
    for (const state of this.chats.values()) {
      const session = state.sessions.find((s) => s.sessionId === sessionId);
      if (session) return session;
    }
    return undefined;
  }

  async flush(chatId: string): Promise<void> {
    if (!this.store) return;
    const state = this.chats.get(chatId);
    if (state) this.store.save(state);
  }

  async flushAll(): Promise<void> {
    if (!this.store) return;
    for (const [chatId] of this.chats) {
      await this.flush(chatId);
    }
  }
}
