import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { MessageStore } from "../sessions/message-store.js";
import { SessionManager } from "../sessions/manager.js";
import { TelegramAdapter } from "../channels/telegram/adapter.js";
import { buildGroupContext } from "../bot/group-context.js";
import { buildSystemPromptParts } from "../engines/prompt.js";
import type { PeerBot } from "../engines/types.js";

describe("MessageStore edits and deletions", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-msgstore-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("shows an edited message with its new text in its old place, and drops a deleted one", () => {
    const store = new MessageStore(dir);
    const msg = (id: string, text: string) => ({ id, ts: Number(id), sender: "A", senderId: "1", text });
    store.append("-1", msg("1", "first"));
    store.append("-1", msg("2", "draft"));
    store.append("-1", msg("3", "third"));
    store.edit("-1", "2", "final");
    store.remove("-1", "3");
    expect(store.getRecent("-1", 10).map((m) => [m.id, m.text])).toEqual([["1", "first"], ["2", "final"]]);
    expect(store.find("-1", "2")?.text).toBe("final");
    expect(store.query({ chatId: "-1", search: "draft" })).toEqual([]);
  });
});

describe("Telegram chat history of the bot's own messages", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-tg-history-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const makeAdapter = (store: MessageStore) => {
    const adapter = new TelegramAdapter("12345:secret", pino({ level: "silent" }));
    adapter.setMessageStore(store, "Atri");
    let next = 100;
    (adapter as any).bot.api = {
      sendMessage: vi.fn(async () => ({ message_id: next++ })),
      editMessageText: vi.fn(async () => ({})),
      deleteMessage: vi.fn(async () => true),
    };
    return adapter;
  };

  it("keeps the reply a progress card was edited into, not the card's spinner text", async () => {
    const store = new MessageStore(dir);
    store.append("-1", {
      id: "7", ts: 1, sender: "Bob", senderId: "2", text: "看下 NVDA", threadId: "55",
    });
    const adapter = makeAdapter(store);

    const card = await adapter.send({ chatId: "-1", text: "✶ Thinking…", replyToMessageId: "7", transient: true });
    await adapter.editMessage("-1", card, "⚙ run_command", undefined, undefined, undefined, { transient: true });
    await adapter.editMessage("-1", card, "NVDA 现在 180");

    const own = store.getRecent("-1", 10).filter((m) => m.id === card);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({
      text: "NVDA 现在 180",
      senderId: "12345",
      replyToId: "7",
      replyToSender: "Bob",
      threadId: "55",
    });
  });

  it("leaves no trace of a card that was deleted, and removes a deleted reply", async () => {
    const store = new MessageStore(dir);
    const adapter = makeAdapter(store);
    const card = await adapter.send({ chatId: "-1", text: "✶ Thinking…", transient: true });
    await adapter.deleteMessage("-1", card);
    const reply = await adapter.send({ chatId: "-1", text: "answer" });
    expect(store.getRecent("-1", 10).map((m) => m.text)).toEqual(["answer"]);
    await adapter.deleteMessage("-1", reply);
    expect(store.getRecent("-1", 10)).toEqual([]);
  });

  it("knows its own user id", () => {
    expect(makeAdapter(new MessageStore(dir)).botUserId).toBe("12345");
  });
});

describe("Group chat context", () => {
  it("leaves out messages the session already got mid-turn", () => {
    const history = ["t1", "s1", "x", "t2"].map((id, i) => ({ id, ts: i, sender: id === "x" ? "Carol" : "Bob", senderId: "2", text: id }));
    const ctx = buildGroupContext({ history, triggerId: "t2", lastCursor: "t1", isOwn: () => false, skip: new Set(["s1"]) });
    expect(ctx).toContain(": x");
    expect(ctx).not.toContain(": s1");
  });
});

describe("Peer bots in the system prompt", () => {
  const peers: PeerBot[] = [
    { name: "Diana", channel: "telegram", username: "diana_bot" },
    { name: "atri-discord", channel: "discord", username: "Atri#7731", userId: "999" },
  ];
  const base = { agentsDir: "/nonexistent", botId: "b", apiPort: 1, chatId: "c", isGroup: true };

  it("lists only Telegram bots, by @username, in a Telegram group", () => {
    const prompt = buildSystemPromptParts({
      ...base, channelType: "telegram", identity: { name: "Atri", username: "atri_bot", peerBots: peers },
    })[0];
    expect(prompt).toContain("@diana_bot（Diana）");
    expect(prompt).not.toContain("Atri#7731");
  });

  it("lists only Discord bots, as <@id> mentions, in a Discord channel", () => {
    const prompt = buildSystemPromptParts({
      ...base, channelType: "discord", identity: { name: "Atri", username: "Atri#1", peerBots: peers },
    })[0];
    expect(prompt).toContain("<@999>（atri-discord）");
    expect(prompt).not.toContain("diana_bot");
  });
});

describe("Session platform", () => {
  it("creates a chat's first session on the platform it is given", () => {
    const sm = new SessionManager();
    const s = sm.createNew("c1", "agy", undefined, undefined, undefined, { channelType: "discord", isGroup: true });
    expect(s.channelType).toBe("discord");
    expect(s.isGroup).toBe(true);
  });

  it("corrects a session taken for Telegram once a message shows its platform", () => {
    const sm = new SessionManager();
    sm.createNew("c2");
    expect(sm.resolve({ chatId: "c2", channelType: "discord" }).channelType).toBe("discord");
  });

  it("keeps the platform when the last session is deleted", () => {
    const sm = new SessionManager();
    const s = sm.resolve({ chatId: "c3", channelType: "discord", isGroup: true });
    sm.deleteSession("c3", s.sessionId);
    const replacement = sm.getActiveSession("c3");
    expect(replacement?.channelType).toBe("discord");
    expect(replacement?.isGroup).toBe(true);
  });
});
