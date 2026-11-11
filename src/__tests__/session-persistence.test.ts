import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pino from "pino";
import { SessionStore } from "../sessions/store.js";
import { SessionManager } from "../sessions/manager.js";
import { sessionCounts } from "../sessions/counts.js";
import { Gateway } from "../gateway/gateway.js";
import { ApiServer } from "../api/server.js";

describe("WeChat session identity and honest counters", () => {
  let root: string;
  const chatId = "owner@im.wechat";
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "pa-wechat-sessions-")); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  async function makeConversation() {
    const store = new SessionStore(root);
    const manager = new SessionManager(store);
    const session = manager.resolve({ chatId, channelType: "wechat", defaultEngine: "codex" });
    manager.setEngineSessionId(session.sessionId, "codex", "native-thread");
    manager.addTurn(session.sessionId, { role: "user", text: "hello" });
    manager.addTurn(session.sessionId, { role: "assistant", text: "answer" });
    await manager.flushAll();
    return { store, manager, session };
  }

  it("keeps the original chat, session and native thread across repeated restarts", async () => {
    const { store, session } = await makeConversation();
    for (let i = 0; i < 3; i++) {
      const restored = new SessionManager(store); restored.loadAll();
      const active = restored.resolve({ chatId, channelType: "wechat" });
      expect(active.sessionId).toBe(session.sessionId);
      expect(active.codexSessionId).toBe("native-thread");
      expect(active.turns.map(t => t.text)).toEqual(["hello", "answer"]);
      expect(restored.getAllChats()).toHaveLength(1);
      expect(restored.list(chatId)).toHaveLength(1);
      expect(sessionCounts(active)).toMatchObject({ turnCount: 1, messageCount: 2, countsComplete: true });
      await restored.flushAll();
    }
  });

  it("serves every listed WeChat session via the actual detail API after reload", async () => {
    const { store, manager } = await makeConversation();
    manager.createNew(chatId, "codex"); await manager.flushAll();
    const restored = new SessionManager(store); restored.loadAll();
    const gateway = Object.create(Gateway.prototype) as Gateway;
    Object.assign(gateway, { dataDir: root, bots: new Map([["wechat-test", { name: "WeChat", botId: "wechat-test", getSessionManager: () => restored }]]) });
    const server = new ApiServer({ port: 0, dataDir: root, log: pino({ level: "silent" }), getBotTelegram: () => undefined,
      getAllSessions: () => gateway.getAllSessions(), getSessionTurns: (bot, chat, session) => gateway.getSessionTurns(bot, chat, session) });
    await server.start();
    try {
      const list = await fetch(`http://127.0.0.1:${server.port}/api/sessions`).then(r => r.json());
      expect(list.sessions).toHaveLength(2);
      for (const item of list.sessions) {
        const params = new URLSearchParams({ botId: item.botId, chatId: item.chatId, sessionId: item.sessionId });
        const response = await fetch(`http://127.0.0.1:${server.port}/api/sessions/turns?${params}`);
        expect(response.status).toBe(200);
        const detail = await response.json();
        expect(detail.session.sessionId).toBe(item.sessionId);
        expect(detail.session.turnCount).toBe(detail.turns.filter((t: any) => t.role === "user").length);
      }
      expect(gateway.getSessionTurns("wechat-test", "wrong-chat", list.sessions[0].sessionId)).toBeNull();
    } finally { await server.stop(); }
  });

  it("repairs duplicate session labels and active flags without dropping either history", async () => {
    const { store, manager, session } = await makeConversation();
    session.createdAt = 1000;
    const second = manager.createNew(chatId, "codex"); second.createdAt = 2000; second.sessionNum = 1; session.isActive = true;
    manager.addTurn(second.sessionId, { role: "user", text: "new question" }); await manager.flushAll();
    const restored = new SessionManager(store); restored.loadAll();
    expect(restored.list(chatId).map(s => s.sessionNum)).toEqual([1, 2]);
    expect(restored.list(chatId).map(s => s.isActive)).toEqual([false, true]);
    expect(restored.findSession(session.sessionId)?.turns).toHaveLength(2);
    expect(restored.getActiveSession(chatId)?.sessionId).toBe(second.sessionId);
  });

  it("counts one request per user record and retains lifetime totals beyond the 50-record cap", async () => {
    const { store, manager, session } = await makeConversation();
    for (let i = 0; i < 29; i++) {
      manager.addTurn(session.sessionId, { role: "user", text: `question ${i}` });
      manager.addTurn(session.sessionId, { role: "assistant", text: `answer ${i}` });
    }
    expect(session.turns).toHaveLength(50);
    expect(sessionCounts(session)).toEqual({ turnCount: 30, messageCount: 60, retainedMessageCount: 50, countsComplete: true, historyTruncated: true });
    await manager.flushAll(); const restored = new SessionManager(store); restored.loadAll();
    expect(sessionCounts(restored.getActiveSession(chatId)!)).toMatchObject({ turnCount: 30, messageCount: 60, countsComplete: true });
  });

  it("marks truncated legacy totals as lower bounds instead of fabricating older counts", async () => {
    const { store, manager, session } = await makeConversation();
    for (let i = 0; i < 60; i++) manager.addTurn(session.sessionId, { role: i % 2 ? "assistant" : "user", text: "old" });
    delete session.historyStats; await manager.flushAll();
    const restored = new SessionManager(store); restored.loadAll();
    const active = restored.getActiveSession(chatId)!;
    expect(sessionCounts(active)).toMatchObject({ turnCount: 25, messageCount: 50, countsComplete: false, historyTruncated: true });
    restored.addTurn(active.sessionId, { role: "user", text: "new" });
    expect(sessionCounts(active)).toMatchObject({ turnCount: 26, messageCount: 51, countsComplete: false });
  });
});
