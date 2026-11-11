import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { encryptAesEcb, decryptAesEcb, parseAesKey } from "../channels/wechat/crypto.js";
import { formatWechatText, splitWechatMessage, formatButtonsAsText } from "../channels/wechat/formatter.js";
import { parseWeixinApiJson, buildHeaders } from "../channels/wechat/api.js";
import { silkToWav } from "../channels/wechat/media.js";

describe("WeChat Crypto", () => {
  it("encrypts and decrypts buffer with AES-128-ECB", () => {
    const key = crypto.randomBytes(16);
    const plaintext = Buffer.from("Hello PocketAgent WeChat Multimodal!");
    const ciphertext = encryptAesEcb(plaintext, key);
    expect(ciphertext).not.toEqual(plaintext);
    const decrypted = decryptAesEcb(ciphertext, key);
    expect(decrypted.toString("utf-8")).toBe("Hello PocketAgent WeChat Multimodal!");
  });

  it("parses raw 16-byte base64 AES key", () => {
    const rawKey = crypto.randomBytes(16);
    const b64 = rawKey.toString("base64");
    const parsed = parseAesKey(b64);
    expect(parsed).toEqual(rawKey);
  });

  it("parses 32-hex-char base64 AES key", () => {
    const rawKey = crypto.randomBytes(16);
    const hex = rawKey.toString("hex");
    const b64OfHex = Buffer.from(hex, "ascii").toString("base64");
    const parsed = parseAesKey(b64OfHex);
    expect(parsed).toEqual(rawKey);
  });
});

describe("WeChat Formatter", () => {
  it("formats HTML tags and code blocks to clean plain text", () => {
    const html = "<b>加粗</b> <i>斜体</i> <code>const x = 1;</code>\n<pre><code class=\"language-python\">print('hello')</code></pre>\n<a href=\"https://google.com\">Google</a>";
    const plain = formatWechatText(html);
    expect(plain).toContain("加粗 斜体 `const x = 1;`");
    expect(plain).toContain("print('hello')");
    expect(plain).toContain("Google (https://google.com)");
    expect(plain).not.toContain("<b>");
    expect(plain).not.toContain("</b>");
  });

  it("splits long messages cleanly", () => {
    const longText = "line 1\nline 2\n" + "a".repeat(1500) + "\n" + "b".repeat(1000);
    const chunks = splitWechatMessage(longText, 1200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200);
    }
  });

  it("formats buttons as text list", () => {
    const buttons = [
      [{ text: "选项 A", data: "a" }, { text: "选项 B", data: "b" }],
    ];
    const res = formatButtonsAsText("请选择:", buttons);
    expect(res).toContain("【请选择回复编号或内容】");
    expect(res).toContain("1. 选项 A");
    expect(res).toContain("2. 选项 B");
  });
});

describe("WeChat API Helpers", () => {
  it("generates correct headers with authorization and UIN", () => {
    const headers = buildHeaders("test-token-123");
    expect(headers["AuthorizationType"]).toBe("ilink_bot_token");
    expect(headers["Authorization"]).toBe("Bearer test-token-123");
    expect(headers["iLink-App-Id"]).toBe("bot");
    expect(headers["X-WECHAT-UIN"]).toBeDefined();
  });

  it("losslessly parses uint64 IDs in JSON responses", () => {
    const rawJson = '{"ret":0,"msg_id":18446744073709551615,"message_id":9223372036854775807}';
    const parsed = parseWeixinApiJson<{ ret: number; msg_id: string; message_id: string }>(rawJson);
    expect(parsed.ret).toBe(0);
    expect(parsed.msg_id).toBe("18446744073709551615");
    expect(parsed.message_id).toBe("9223372036854775807");
  });
});

describe("WeChat Audio / SILK Transcoding", () => {
  it("handles silkToWav gracefully", async () => {
    // If given an empty or invalid buffer, silkToWav catches and returns null without crashing
    const dummy = Buffer.from([0x02, 0x23, 0x21, 0x53, 0x49, 0x4c, 0x4b]);
    const res = await silkToWav(dummy);
    // Even if decode fails on mock bytes, it should not throw
    expect(res === null || Buffer.isBuffer(res)).toBe(true);
  });
});
