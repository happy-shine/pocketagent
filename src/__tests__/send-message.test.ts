import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { ApiServer, type ApiSessionBinding } from "../api/server.js";
import { SendLimiter, type SendLimits } from "../api/send-limiter.js";
import { DiscordAdapter } from "../channels/discord/adapter.js";
import { TelegramAdapter } from "../channels/telegram/adapter.js";
import { isSilentReply } from "../scheduler/schedule.js";
import { getTelegramFileSkill } from "../skills/index.js";

describe("send-message API", () => {
  let dir: string;
  let server: ApiServer;
  let base: string;
  let logs: string[];
  let limits: SendLimits;
  let sessions: Record<string, ApiSessionBinding>;
  let channels: Record<string, { type: string; send: ReturnType<typeof vi.fn>; sendMessages?: ReturnType<typeof vi.fn> }>;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "pa-send-message-"));
    logs = [];
    limits = { maxPerTurn: 12, minIntervalMs: 0 };
    sessions = {
      "sess-tg": { botId: "tg", chatId: "42", channelType: "telegram", turn: {} },
      "sess-dc": { botId: "dc", chatId: "7", channelType: "discord", turn: {} },
    };
    channels = {
      tg: { type: "telegram", send: vi.fn(async () => "100") },
      dc: { type: "discord", send: vi.fn(async () => "200"), sendMessages: vi.fn(async () => ["201", "202"]) },
    };
    server = new ApiServer({
      port: 0,
      getBotTelegram: () => undefined,
      getBotChannel: (botId) => channels[botId] as any,
      resolveSession: (id) => sessions[id],
      getSendLimits: () => limits,
      dataDir: dir,
      log: pino({ level: "warn" }, { write: (line: string) => void logs.push(line) }),
    });
    await server.start();
    base = `http://127.0.0.1:${server.port}`;
  });

  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  const post = (path: string, body: unknown, session?: string) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { "X-PocketAgent-Session": session } : {}) },
      body: JSON.stringify(body),
    });

  describe("session binding", () => {
    it("sends to the session's chat when the header names a known session", async () => {
      const res = await post("/api/send-message", { text: "hello" }, "sess-tg");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, message_ids: ["100"] });
      expect(channels.tg.send).toHaveBeenCalledWith(expect.objectContaining({ chatId: "42", parseMode: "HTML" }));
    });

    it("accepts the session's own bot_id and chat_id", async () => {
      const res = await post("/api/send-message", { bot_id: "tg", chat_id: "42", text: "hello" }, "sess-tg");
      expect(res.status).toBe(200);
    });

    it("refuses another chat or bot with 403 instead of sending there", async () => {
      const otherChat = await post("/api/send-message", { bot_id: "tg", chat_id: "999", text: "hi" }, "sess-tg");
      expect(otherChat.status).toBe(403);
      const otherBot = await post("/api/send-message", { bot_id: "dc", chat_id: "7", text: "hi" }, "sess-tg");
      expect(otherBot.status).toBe(403);
      const query = await fetch(`${base}/api/send-message?chat_id=999`, {
        method: "POST",
        headers: { "X-PocketAgent-Session": "sess-tg" },
        body: JSON.stringify({ text: "hi" }),
      });
      expect(query.status).toBe(403);
      expect(channels.tg.send).not.toHaveBeenCalled();
      expect(channels.dc.send).not.toHaveBeenCalled();
    });

    it("keeps the legacy behaviour without the header, with a warning", async () => {
      const res = await post("/api/send-message", { bot_id: "tg", chat_id: "555", text: "from cron" });
      expect(res.status).toBe(200);
      expect(channels.tg.send).toHaveBeenCalledWith({ chatId: "555", text: "from cron" });
      expect(logs.join("")).toContain("without X-PocketAgent-Session");
    });

    it("falls back to the request's target for an unknown session", async () => {
      const res = await post("/api/send-message", { bot_id: "tg", chat_id: "555", text: "hi" }, "gone");
      expect(res.status).toBe(200);
      expect(channels.tg.send).toHaveBeenCalledWith({ chatId: "555", text: "hi" });
      expect(logs.join("")).toContain("Unknown X-PocketAgent-Session");
    });

    it("binds send-file the same way", async () => {
      const file = join(dir, "report.txt");
      writeFileSync(file, "x");
      expect((await post("/api/send-file", { file_path: file }, "sess-dc")).status).toBe(200);
      expect(channels.dc.send).toHaveBeenCalledWith(expect.objectContaining({ chatId: "7" }));
      expect((await post("/api/send-file", { chat_id: "8", file_path: file }, "sess-dc")).status).toBe(403);
      expect(channels.dc.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("reply_to", () => {
    it("reaches channel.send from the JSON body", async () => {
      await post("/api/send-message", { text: "answer", reply_to: "123" }, "sess-tg");
      expect(channels.tg.send).toHaveBeenCalledWith(expect.objectContaining({ chatId: "42", replyToMessageId: "123" }));
    });

    it("reaches channel.send from the query string, numeric JSON ids too", async () => {
      await fetch(`${base}/api/send-message?bot_id=tg&chat_id=42&reply_to=77`, {
        method: "POST",
        body: JSON.stringify({ text: "legacy reply" }),
      });
      expect(channels.tg.send).toHaveBeenCalledWith({ chatId: "42", text: "legacy reply", replyToMessageId: "77" });
      await post("/api/send-message", { text: "n", reply_to: 88 }, "sess-tg");
      expect(channels.tg.send).toHaveBeenLastCalledWith(expect.objectContaining({ replyToMessageId: "88" }));
    });

    it("rejects an id that is not a message id", async () => {
      const res = await post("/api/send-message", { text: "x", reply_to: "abc" }, "sess-tg");
      expect(res.status).toBe(400);
      expect(channels.tg.send).not.toHaveBeenCalled();
    });

    it("returns the ids of every posted message when the adapter reports them", async () => {
      const res = await post("/api/send-message", { text: "long", reply_to: "5" }, "sess-dc");
      expect(await res.json()).toEqual({ ok: true, message_ids: ["201", "202"] });
      expect(channels.dc.sendMessages).toHaveBeenCalledWith({ chatId: "7", text: "long", replyToMessageId: "5" });
      expect(channels.dc.send).not.toHaveBeenCalled();
    });
  });

  describe("limits", () => {
    it("answers 429 once a turn used up its messages, counting split messages", async () => {
      limits = { maxPerTurn: 3, minIntervalMs: 0 };
      expect((await post("/api/send-message", { text: "1" }, "sess-tg")).status).toBe(200);
      // Two chat messages from one long text
      expect((await post("/api/send-message", { text: "2" }, "sess-dc")).status).toBe(200);
      expect((await post("/api/send-message", { text: "3" }, "sess-tg")).status).toBe(200);
      expect((await post("/api/send-message", { text: "4" }, "sess-tg")).status).toBe(200);
      const over = await post("/api/send-message", { text: "5" }, "sess-tg");
      expect(over.status).toBe(429);
      expect((await over.json()).error).toMatch(/at most 3 messages per turn/);
      expect(channels.tg.send).toHaveBeenCalledTimes(3);
      // Discord's session has its own count; it used 2 of 3
      expect((await post("/api/send-message", { text: "6" }, "sess-dc")).status).toBe(200);
      expect((await post("/api/send-message", { text: "7" }, "sess-dc")).status).toBe(429);
    });

    it("starts over in the session's next turn", async () => {
      limits = { maxPerTurn: 1, minIntervalMs: 0 };
      expect((await post("/api/send-message", { text: "1" }, "sess-tg")).status).toBe(200);
      expect((await post("/api/send-message", { text: "2" }, "sess-tg")).status).toBe(429);
      sessions["sess-tg"] = { ...sessions["sess-tg"], turn: {} };
      expect((await post("/api/send-message", { text: "3" }, "sess-tg")).status).toBe(200);
    });

    it("does not limit callers without a session", async () => {
      limits = { maxPerTurn: 1, minIntervalMs: 0 };
      for (let i = 0; i < 3; i++) {
        expect((await post("/api/send-message", { bot_id: "tg", chat_id: "42", text: `${i}` })).status).toBe(200);
      }
    });

    it("spaces messages out by waiting, not failing", async () => {
      limits = { maxPerTurn: 12, minIntervalMs: 150 };
      const started = Date.now();
      const results = await Promise.all([1, 2, 3].map((i) => post("/api/send-message", { text: `${i}` }, "sess-tg")));
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(Date.now() - started).toBeGreaterThanOrEqual(290);
      expect(channels.tg.send.mock.calls.map((c: any[]) => c[0].plainFallback)).toEqual(["1", "2", "3"]);
    });
  });
});

describe("SendLimiter", () => {
  it("waits out the interval since the last send and counts per turn", async () => {
    let now = 1000;
    const sleeps: number[] = [];
    const limiter = new SendLimiter({
      getLimits: () => ({ maxPerTurn: 2, minIntervalMs: 800 }),
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });
    const send = async () => ({ value: "ok", count: 1 });
    const turn = {};
    expect(await limiter.run("s", turn, send)).toEqual({ ok: true, value: "ok" });
    now += 300;
    expect(await limiter.run("s", turn, send)).toEqual({ ok: true, value: "ok" });
    expect(sleeps).toEqual([500]);
    expect(await limiter.run("s", turn, send)).toEqual({ ok: false, sent: 2, max: 2 });
    // Another session is independent
    expect((await limiter.run("t", turn, send)).ok).toBe(true);
  });

  it("keeps going after a failed send", async () => {
    const limiter = new SendLimiter({ getLimits: () => ({ maxPerTurn: 5, minIntervalMs: 0 }) });
    await expect(limiter.run("s", 1, async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect((await limiter.run("s", 1, async () => ({ value: 1, count: 1 }))).ok).toBe(true);
  });
});

describe("adapters honour replyToMessageId", () => {
  const log = pino({ level: "silent" });

  it("Discord references the message without failing if it is gone, and reports every id", async () => {
    const adapter = new DiscordAdapter("token", log);
    let n = 0;
    const channel = { isTextBased: () => true, send: vi.fn(async () => ({ id: `d${++n}` })) };
    (adapter as any).client = { channels: { fetch: async () => channel } };
    const ids = await adapter.sendMessages({ chatId: "7", text: `${"a".repeat(1500)}\n${"b".repeat(1500)}`, replyToMessageId: "55" });
    expect(ids).toEqual(["d1", "d2"]);
    expect((channel.send.mock.calls[0] as any[])[0].reply).toEqual({ messageReference: "55", failIfNotExists: false });
    expect((channel.send.mock.calls[1] as any[])[0].reply).toBeUndefined();
    expect(await adapter.send({ chatId: "7", text: "short" })).toBe("d3");
  });

  it("Telegram replies but still sends when the target is gone, and reports every id", async () => {
    const adapter = new TelegramAdapter("123:abc", log);
    let n = 0;
    const sendMessage = vi.fn(async () => ({ message_id: ++n }));
    (adapter as any).bot = { api: { sendMessage } };
    const ids = await adapter.sendMessages({ chatId: "42", text: `${"a".repeat(4000)}\n${"b".repeat(1000)}`, replyToMessageId: "9" });
    expect(ids).toEqual(["1", "2"]);
    expect((sendMessage.mock.calls[0] as any[])[2]).toMatchObject({
      reply_parameters: { message_id: 9, allow_sending_without_reply: true },
    });
    expect((sendMessage.mock.calls[1] as any[])[2].reply_parameters).toBeUndefined();
    expect(await adapter.send({ chatId: "42", text: "short" })).toBe("3");
  });
});

describe("isSilentReply", () => {
  it("is exactly the token, or the token on the last line", () => {
    expect(isSilentReply("[SILENT]")).toBe(true);
    expect(isSilentReply("  [SILENT]\n")).toBe(true);
    expect(isSilentReply("Sent the summary above.\n[SILENT]")).toBe(true);
    expect(isSilentReply("Reply [SILENT] when there is nothing new.")).toBe(false);
    expect(isSilentReply("[SILENT]\nActually, one more thing")).toBe(false);
    expect(isSilentReply("")).toBe(false);
  });
});

describe("agent instructions", () => {
  it("document send-message with the session header, reply_to, [SILENT] and the limits", () => {
    const skill = getTelegramFileSkill(18790, "42", "tg");
    expect(skill).toContain("/api/send-message");
    expect(skill).toContain('-H "X-PocketAgent-Session: $POCKETAGENT_SESSION_ID"');
    expect(skill).toContain("reply_to");
    expect(skill).toContain("[SILENT]");
    expect(skill).toContain("HTTP 429");
  });
});
