import { afterEach, describe, expect, it, vi } from "vitest";
import pino from "pino";
import { WechatAdapter } from "../channels/wechat/adapter.js";
import { ProgressTracker } from "../progress/progress.js";

describe("WeChat answer delivery", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  function setup(rejectSends = false) {
    const requests: Array<{ endpoint: string; body: any }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const endpoint = new URL(url).pathname;
      requests.push({ endpoint, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify(endpoint.endsWith("getconfig") ? { typing_ticket: "test-ticket" }
        : endpoint.endsWith("sendmessage") && rejectSends ? { errcode: -14, errmsg: "expired" } : {}));
    }));
    const adapter = new WechatAdapter({ botId: "test", dataDir: "unused", log: pino({ level: "silent" }) });
    Object.assign(adapter as any, { sessionData: { bot_token: "fixture", baseurl: "https://ilinkai.weixin.qq.com" } });
    return { adapter, requests };
  }

  it("sends the final answer through the real adapter after a long thinking phase", async () => {
    vi.useFakeTimers();
    const { adapter, requests } = setup();
    adapter.onMessage(async msg => {
      const tracker = new ProgressTracker(adapter, msg.chatId, msg.messageId);
      tracker.start(); tracker.thinking();
      await vi.advanceTimersByTimeAsync(10000);
      await tracker.finish("这是最终答案。");
    });
    await (adapter as any).handleIncomingWechatMessage({ from_user_id: "owner", message_id: "1", message_type: 1,
      context_token: "reply-context", item_list: [{ type: 1, text_item: { text: "你好" } }] });
    const sends = requests.filter(r => r.endpoint.endsWith("sendmessage"));
    expect(sends).toHaveLength(1);
    expect(sends[0].body.msg).toMatchObject({ to_user_id: "owner", context_token: "reply-context", message_state: 2,
      item_list: [{ type: 1, text_item: { text: "这是最终答案。" } }] });
    expect(requests.filter(r => r.endpoint.endsWith("getconfig"))).toHaveLength(1);
    expect(requests.find(r => r.endpoint.endsWith("sendtyping"))?.body.typing_ticket).toBe("test-ticket");
  });

  it("delivers interim text and long final text as distinct messages without editing", async () => {
    vi.useFakeTimers();
    const { adapter, requests } = setup();
    const tracker = new ProgressTracker(adapter, "owner");
    tracker.start(); await vi.advanceTimersByTimeAsync(4000);
    tracker.postInterim("正在查资料。");
    const final = "答案".repeat(1400);
    await tracker.finish(final);
    const texts = requests.filter(r => r.endpoint.endsWith("sendmessage")).map(r => r.body.msg.item_list[0].text_item.text);
    expect(texts[0]).toBe("正在查资料。");
    expect(texts.slice(1).join("")).toBe(final);
    expect(texts.every(t => !t.includes("Thinking"))).toBe(true);
    expect(texts.length).toBeGreaterThan(2);
  });

  it("does not silently accept unsupported edits or rejected final messages", async () => {
    const { adapter } = setup(true);
    await expect(adapter.editMessage()).rejects.toThrow("does not support editing");
    const tracker = new ProgressTracker(adapter, "owner");
    await expect(tracker.finish("Final answer")).rejects.toThrow("errcode=-14");
  });

  it("propagates HTTP errors instead of claiming delivery succeeded", async () => {
    const { adapter } = setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    await expect(adapter.send({ chatId: "owner", text: "Final" })).rejects.toThrow("HTTP 503");
  });
});
