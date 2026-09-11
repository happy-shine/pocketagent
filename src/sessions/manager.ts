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
        if (!state.preferredEngine && state.sessions.length > 0) {
          const active = state.sessions.find((s) => s.sessionId === state.activeSessionId);
          state.preferredEngine = active?.activeEngine ?? state.sessions[state.sessions.length - 1]?.activeEngine;
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
        if (!active.activeEngine) active.activeEngine = state.preferredEngine ?? opts.defaultEngine ?? "claude";
        return active;
      }
    }
    return this.createFirst(opts);
  }

  getActiveSession(chatId: string): Session | undefined {
    const state = this.chats.get(chatId);
    if (!state) return undefined;
    return state.sessions.find((s) => s.sessionId === state.activeSessionId) ?? state.sessions[state.sessions.length - 1];
  }

  private createFirst(opts: SessionResolveOptions): Session {
    const state = this.chats.get(opts.chatId);
    const engine = state?.preferredEngine ?? opts.defaultEngine ?? "claude";
    const engineModels: Partial<Record<EngineType, string>> = { ...(state?.preferredModels ?? {}) };
    const engineEfforts: Partial<Record<EngineType, string>> = { ...(state?.preferredEfforts ?? {}) };
    if (opts.defaultModel) engineModels[engine] = opts.defaultModel;
    if (opts.defaultEffort) engineEfforts[engine] = opts.defaultEffort;

    const session: Session = {
      sessionId: randomUUID(),
      chatId: opts.chatId,
      channelType: opts.channelType,
      activeEngine: engine,
      model: engineModels[engine],
      effort: engineEfforts[engine],
      engineModels,
      engineEfforts,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: 1,
      isGroup: opts.isGroup,
      turns: [],
    };
    const newState: ChatSessionState = {
      chatId: opts.chatId,
      activeSessionId: session.sessionId,
      sessions: [session],
      preferredEngine: engine,
      preferredModels: engineModels,
      preferredEfforts: engineEfforts,
    };
    this.chats.set(opts.chatId, newState);
    return session;
  }

  createNew(
    chatId: string,
    defaultEngine?: EngineType,
    defaultModel?: string,
    defaultEffort?: string,
    title?: string,
  ): Session {
    let state = this.chats.get(chatId);
    if (!state) {
      return this.createFirst({
        chatId,
        channelType: "telegram",
        defaultEngine: defaultEngine ?? "claude",
        defaultModel,
        defaultEffort,
      });
    }

    const prevActive = state.sessions.find((s) => s.sessionId === state.activeSessionId)
      ?? state.sessions[state.sessions.length - 1];

    for (const s of state.sessions) {
      s.isActive = false;
    }

    const maxNum = Math.max(...state.sessions.map((s) => s.sessionNum ?? 0));
    const prev = state.sessions[0];

    const activeEngine = defaultEngine ?? prevActive?.activeEngine ?? state.preferredEngine ?? "claude";

    // Inherit engine-specific model and effort maps
    const engineModels: Partial<Record<EngineType, string>> = {
      ...(state.preferredModels ?? {}),
      ...(prevActive?.engineModels ?? {}),
    };
    if (prevActive?.activeEngine && prevActive.model) {
      engineModels[prevActive.activeEngine] = prevActive.model;
    }

    const engineEfforts: Partial<Record<EngineType, string>> = {
      ...(state.preferredEfforts ?? {}),
      ...(prevActive?.engineEfforts ?? {}),
    };
    if (prevActive?.activeEngine && prevActive.effort) {
      engineEfforts[prevActive.activeEngine] = prevActive.effort;
    }

    const model = defaultModel !== undefined
      ? defaultModel
      : engineModels[activeEngine];

    const effort = defaultEffort !== undefined
      ? defaultEffort
      : engineEfforts[activeEngine];

    if (model) engineModels[activeEngine] = model;
    if (effort) engineEfforts[activeEngine] = effort;

    const session: Session = {
      sessionId: randomUUID(),
      chatId,
      channelType: prev ? prev.channelType : "telegram",
      activeEngine,
      model,
      effort,
      engineModels,
      engineEfforts,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: maxNum + 1,
      isGroup: prev ? prev.isGroup : false,
      title,
      turns: [],
    };

    state.sessions.push(session);
    state.activeSessionId = session.sessionId;
    state.preferredEngine = activeEngine;
    if (model) {
      if (!state.preferredModels) state.preferredModels = {};
      state.preferredModels[activeEngine] = model;
    }
    if (effort) {
      if (!state.preferredEfforts) state.preferredEfforts = {};
      state.preferredEfforts[activeEngine] = effort;
    }

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
    state.preferredEngine = target.activeEngine;
    if (target.model) state.preferredModel = target.model;
    if (target.effort) state.preferredEffort = target.effort;
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
      if (!session.engineModels) session.engineModels = {};
      if (!session.engineEfforts) session.engineEfforts = {};
      if (session.model) {
        session.engineModels[session.activeEngine] = session.model;
      }
      if (session.effort) {
        session.engineEfforts[session.activeEngine] = session.effort;
      }

      session.lastEngine = session.activeEngine;
      session.activeEngine = engine;
      session.lastActiveAt = Date.now();

      const state = this.chats.get(session.chatId);
      session.model = session.engineModels[engine] ?? state?.preferredModels?.[engine];
      session.effort = session.engineEfforts[engine] ?? state?.preferredEfforts?.[engine];
    }
    const state = this.chats.get(session.chatId);
    if (state) {
      state.preferredEngine = engine;
    }
    return true;
  }

  setModel(sessionId: string, model: string): boolean {
    const session = this.findSession(sessionId);
    if (!session) return false;
    if (!session.engineModels) session.engineModels = {};
    session.engineModels[session.activeEngine] = model;
    session.model = model;
    session.lastActiveAt = Date.now();
    const state = this.chats.get(session.chatId);
    if (state) {
      if (!state.preferredModels) state.preferredModels = {};
      state.preferredModels[session.activeEngine] = model;
    }
    return true;
  }

  setEffort(sessionId: string, effort: string): boolean {
    const session = this.findSession(sessionId);
    if (!session) return false;
    if (!session.engineEfforts) session.engineEfforts = {};
    session.engineEfforts[session.activeEngine] = effort;
    session.effort = effort;
    session.lastActiveAt = Date.now();
    const state = this.chats.get(session.chatId);
    if (state) {
      if (!state.preferredEfforts) state.preferredEfforts = {};
      state.preferredEfforts[session.activeEngine] = effort;
    }
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
