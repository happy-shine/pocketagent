import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pino from "pino";
import { WechatAdapter } from "../channels/wechat/adapter.js";
import { DEFAULT_CDN_BASE_URL, uploadBufferToCdn } from "../channels/wechat/api.js";
import { encryptAesEcb, decryptAesEcb, parseAesKey } from "../channels/wechat/crypto.js";
import { downloadInboundMedia, uploadAndSendWechatMedia } from "../channels/wechat/media.js";
import { buildSystemPromptParts } from "../engines/prompt.js";
import { BotInstance } from "../bot/bot-instance.js";

const log = pino({ level: "silent" });
const dirs: string[] = [];
function temp() { const dir = mkdtempSync(join(tmpdir(), "wechat-capabilities-")); dirs.push(dir); return dir; }
function adapter(dataDir = temp()) {
  const result = new WechatAdapter({ botId: "test", dataDir, log });
  Object.assign(result as any, { sessionData: { bot_token: "fixture", ilink_bot_id: "test-account", baseurl: "https://ilinkai.weixin.qq.com" } });
  return result;
}
async function incoming(target: WechatAdapter, text: string, from = "owner", extra = {}) {
  await (target as any).handleIncomingWechatMessage({ from_user_id: from, message_id: "1", message_type: 1,
    context_token: "fixture-context", item_list: [{ type: 1, text_item: { text } }], ...extra });
}
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllGlobals();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("WeChat media transport", () => {
  it("uses the official CDN and query name, decrypts PNG without labelling it JPEG", async () => {
    const plaintext = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const key = Buffer.alloc(16, 7);
    const request = vi.fn(async () => new Response(new Uint8Array(encryptAesEcb(plaintext, key))));
    vi.stubGlobal("fetch", request);
    const result = await downloadInboundMedia({ type: 2, image_item: { aeskey: key.toString("hex"),
      media: { encrypt_query_param: "a+b=&" } } }, temp(), DEFAULT_CDN_BASE_URL);
    expect(request.mock.calls[0][0]).toBe("https://novac2c.cdn.weixin.qq.com/c2c/download?encrypted_query_param=a%2Bb%3D%26");
    expect(result?.mimeType).toBe("image/png"); expect(result?.localPath).toMatch(/\.png$/);
    expect(readFileSync(result!.localPath)).toEqual(plaintext);
  });

  it("uses full CDN URLs when supplied and refuses oversized downloads", async () => {
    const request = vi.fn(async () => new Response("huge", { headers: { "content-length": String(101 * 1024 * 1024) } }));
    vi.stubGlobal("fetch", request);
    expect(await downloadInboundMedia({ type: 2, image_item: { media: { full_url: "https://cdn.example/file" } } }, temp(), DEFAULT_CDN_BASE_URL)).toBeNull();
    expect(request.mock.calls[0][0]).toBe("https://cdn.example/file");
  });

  it("uploads a decryptable payload and constructs a compatible media reference", async () => {
    const file = join(temp(), "photo.png"); const plaintext = Buffer.from("fixture image"); writeFileSync(file, plaintext);
    let uploadRequest: any; let payload: any; let ciphertext: Buffer | undefined;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("getuploadurl")) { uploadRequest = JSON.parse(String(init.body)); return new Response('{"upload_param":"up+param"}'); }
      if (url.includes("/upload?")) {
        expect(url).toBe(DEFAULT_CDN_BASE_URL + "/upload?encrypted_query_param=up%2Bparam&filekey=" + uploadRequest.filekey);
        ciphertext = Buffer.from(init.body as Uint8Array);
        return new Response("", { headers: { "x-encrypted-param": "download-param" } });
      }
      payload = JSON.parse(String(init.body)); return new Response('{"message_id":"real-media-id"}');
    }));
    expect(await uploadAndSendWechatMedia({ filePath: file, toUserId: "owner", baseUrl: "https://ilinkai.weixin.qq.com",
      token: "fixture", cdnBaseUrl: DEFAULT_CDN_BASE_URL, contextToken: "context" })).toBe("real-media-id");
    const media = payload.msg.item_list[0].image_item.media;
    expect(media.encrypt_type).toBe(1); expect(payload.msg.context_token).toBe("context");
    expect(Buffer.from(media.aes_key, "base64").toString()).toBe(uploadRequest.aeskey);
    expect(decryptAesEcb(ciphertext!, parseAesKey(media.aes_key))).toEqual(plaintext);
  });

  it("reports upload failures and never claims a missing attachment was sent", async () => {
    const target = adapter();
    await expect(target.send({ chatId: "owner", text: "", attachments: [{ type: "file", path: join(temp(), "missing.pdf") }] })).rejects.toThrow("does not exist");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 503 })));
    await expect(uploadBufferToCdn({ buf: Buffer.from("file"), filekey: "fixture", cdnBaseUrl: DEFAULT_CDN_BASE_URL,
      uploadParam: "up", aeskey: Buffer.alloc(16) })).rejects.toThrow("503");
  });
});

describe("WeChat conversation capabilities", () => {
  function sends() {
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ msg_id: String(requests.length) }));
    })); return requests;
  }

  it("keeps server voice transcripts when no media can be downloaded", async () => {
    const target = adapter(); const handler = vi.fn(); target.onMessage(handler);
    await incoming(target, "", "owner", { item_list: [{ type: 3, voice_item: { text: "请帮我查一下" } }] });
    expect(handler.mock.calls[0][0].text).toContain("请帮我查一下");
    expect(handler.mock.calls[0][0].attachments).toBeUndefined();
  });

  it("marks unreadable attachments instead of asking the engine to invent their contents", async () => {
    const target = adapter(); const handler = vi.fn(); target.onMessage(handler);
    await incoming(target, "", "owner", { item_list: [{ type: 2, image_item: {} }] });
    expect(handler.mock.calls[0][0].text).toContain("附件下载失败");
  });

  it("restores account-bound reply contexts after restart", async () => {
    const requests = sends(); const dataDir = temp(); const first = adapter(dataDir);
    await incoming(first, "hello");
    const reloaded = new WechatAdapter({ botId: "test", dataDir, log });
    expect((reloaded as any).loadSession()).toBe(true);
    await reloaded.send({ chatId: "owner", text: "after restart" });
    expect(requests.at(-1).msg.context_token).toBe("fixture-context");
    const otherAccount = new WechatAdapter({ botId: "other-account", dataDir, log });
    expect((otherAccount as any).loadSession()).toBe(false);
  });

  it("returns every real message ID when splitting long text", async () => {
    const requests = sends(); const target = adapter();
    const ids = await target.sendMessages({ chatId: "owner", text: "a".repeat(4200) });
    expect(ids).toEqual(["1", "2", "3"]);
    expect(requests.map(r => r.msg.item_list[0].text_item.text).join("")).toHaveLength(4200);
  });

  it("routes a numbered engine choice through the actual bot callback and sends confirmation", async () => {
    const requests = sends(); const target = adapter(); const handler = vi.fn(); target.onMessage(handler);
    const setEngine = vi.fn(), flush = vi.fn();
    (BotInstance.prototype as any).registerCallbacks.call({
      config: { engine: "codex" },
      sessionManager: { resolve: () => ({ sessionId: "current" }), setEngine, flush },
      triggerBioSync: vi.fn(),
    }, target, "wechat");
    await target.sendWithButtons("owner", "Choose engine", [[{ text: "Claude", data: "engine:claude" }],
      [{ text: "Codex", data: "engine:codex" }], [{ text: "Gemini", data: "engine:agy" }]]);
    await incoming(target, "3");
    expect(setEngine).toHaveBeenCalledWith("current", "agy"); expect(flush).toHaveBeenCalledWith("owner");
    expect(requests.at(-1).msg.item_list[0].text_item.text).toContain("AGY");
    expect(handler).not.toHaveBeenCalled();
    await incoming(target, "3"); expect(handler).toHaveBeenCalledOnce();
  });

  it("isolates menus by recipient, supports labels and generic choices, and expires old menus", async () => {
    sends(); const target = adapter(); const handler = vi.fn(); const callback = vi.fn();
    target.onMessage(handler); target.onCallback("model", callback);
    const buttons = [[{ text: "Fast model", data: "model:fast" }]];
    await target.sendWithButtons("owner", "Choose", buttons);
    await incoming(target, "1", "other"); expect(callback).not.toHaveBeenCalled();
    await incoming(target, "Fast model"); expect(callback).toHaveBeenCalledOnce();
    await target.sendWithButtons("owner", "Question", [[{ text: "Continue", data: "continue task" }]]);
    await incoming(target, "1"); expect(handler.mock.calls.at(-1)![0].text).toBe("continue task");
    await target.sendWithButtons("owner", "Choose", buttons);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 6 * 60_000);
    await incoming(target, "1"); expect(callback).toHaveBeenCalledOnce();
  });

  it("does not treat bot echoes as fresh user input", async () => {
    const target = adapter(); const handler = vi.fn(); target.onMessage(handler);
    await incoming(target, "echo", "owner", { message_type: 2 }); expect(handler).not.toHaveBeenCalled();
  });

  it("gives WeChat plain-text guidance without Telegram HTML and button instructions", () => {
    const prompt = buildSystemPromptParts({ agentsDir: temp(), botId: "test", apiPort: 1, chatId: "owner", isGroup: false, channelType: "wechat" }).join("\n");
    expect(prompt).toContain("WeChat output and capabilities");
    expect(prompt).not.toContain("Output Formatting (Telegram HTML)");
    expect(prompt).not.toContain("## Interactive Buttons");
    expect(prompt).toContain("Actual audio/video understanding depends on the active engine");
  });
});
