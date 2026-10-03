import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { ApiServer } from "../api/server.js";
import { getTelegramFileSkill } from "../skills/index.js";

describe("File transfer API", () => {
  let dir: string;
  let server: ApiServer;
  let base: string;
  let photo: string;
  const channels = {
    tg: { type: "telegram", send: vi.fn(async () => "1"), downloadFile: vi.fn(async () => "/tmp/dl/photo.jpg") },
    dc: { type: "discord", send: vi.fn(async () => "1"), downloadFile: vi.fn(async () => "/tmp/dl/file.pdf") },
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "pa-file-api-"));
    photo = join(dir, "chart.png");
    writeFileSync(photo, "png");
    for (const c of Object.values(channels)) {
      c.send.mockClear();
      c.downloadFile.mockClear();
    }
    const port = 20000 + Math.floor(Math.random() * 20000);
    base = `http://127.0.0.1:${port}`;
    server = new ApiServer({
      port,
      getBotTelegram: () => undefined,
      getBotChannel: (botId) => channels[botId as keyof typeof channels] as any,
      dataDir: dir,
      log: pino({ level: "silent" }),
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  const postJson = (path: string, body: unknown) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("sends a file from a JSON body, with the caption only on the attachment for Telegram", async () => {
    const res = await postJson("/api/send-file", { bot_id: "tg", chat_id: "42", file_path: photo, caption: "Weekly chart" });
    expect(res.status).toBe(200);
    expect(channels.tg.send).toHaveBeenCalledWith({
      chatId: "42",
      text: "",
      attachments: [{ type: "photo", path: photo, caption: "Weekly chart" }],
    });
  });

  it("keeps the caption as message text for Discord", async () => {
    await postJson("/api/send-file", { bot_id: "dc", chat_id: "7", file_path: photo, caption: "Weekly chart" });
    expect(channels.dc.send).toHaveBeenCalledWith(expect.objectContaining({ text: "Weekly chart" }));
  });

  it("still accepts query parameters", async () => {
    const qs = new URLSearchParams({ bot_id: "tg", chat_id: "42", file_path: photo });
    expect((await fetch(`${base}/api/send-file?${qs}`, { method: "POST" })).status).toBe(200);
    expect(channels.tg.send).toHaveBeenCalledTimes(1);
  });

  it("rejects missing files and unknown bots", async () => {
    const missing = await postJson("/api/send-file", { bot_id: "tg", chat_id: "42", file_path: join(dir, "nope.txt") });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toMatch(/File not found/);
    expect((await postJson("/api/send-file", { bot_id: "x", chat_id: "42", file_path: photo })).status).toBe(400);
    expect(channels.tg.send).not.toHaveBeenCalled();
  });

  it("downloads through the bot's own channel, including Discord", async () => {
    const res = await postJson("/api/download-file", { bot_id: "dc", file_id: "abc", dest_dir: join(dir, "dl") });
    expect(await res.json()).toEqual({ ok: true, local_path: "/tmp/dl/file.pdf" });
    expect(channels.dc.downloadFile).toHaveBeenCalledWith("abc", join(dir, "dl"));
  });

  it("documents only endpoints the gateway serves", () => {
    const skill = getTelegramFileSkill(18790, "42", "tg");
    expect(skill).toContain("/api/send-file");
    expect(skill).toContain("/api/download-file");
    expect(skill).toContain('"bot_id":"tg"');
    expect(skill).not.toContain("/api/file/");
  });
});
