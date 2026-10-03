import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { parseConfig } from "../config/loader.js";
import { Gateway } from "../gateway/gateway.js";

describe("Scheduled tasks HTTP API", () => {
  let dataDir: string;
  let gateway: Gateway;
  let base: string;
  let turnSender: { senderId: string; senderName: string } | undefined;
  const runScheduledTask = vi.fn(async () => ({ status: "ok" as const, output: "done" }));

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "pa-cron-api-"));
    const port = 20000 + Math.floor(Math.random() * 20000);
    base = `http://127.0.0.1:${port}/api/cron`;
    const config = parseConfig(`gateway:\n  port: ${port}\n  dataDir: "${dataDir}"\nscheduler:\n  timezone: "Asia/Shanghai"\n`);
    gateway = new Gateway(config, pino({ level: "silent" }), join(dataDir, "config.yaml"));

    turnSender = undefined;
    runScheduledTask.mockClear();
    const fakeBot = {
      botId: "bot1",
      name: "fake",
      getChatInfo: (chatId: string) => (chatId === "group1" ? { channelType: "telegram", isGroup: true } : undefined),
      getTurnSender: () => turnSender,
      canManageCron: (senderId: string) => senderId === "owner",
      runScheduledTask,
      notifyChat: vi.fn(),
      setPeerBots: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    (gateway as any).bots.set("bot1", fakeBot);
    await gateway.start();
  });

  afterEach(async () => {
    await gateway.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("creates, lists, updates, runs and deletes a task", async () => {
    turnSender = { senderId: "owner", senderName: "Owner" };
    const created = await post("", { bot_id: "bot1", chat_id: "group1", name: "Digest", cron: "0 8 * * *", prompt: "Summarize AI news" });
    expect(created.status).toBe(200);
    const { job } = await created.json();
    expect(job).toMatchObject({
      name: "Digest",
      isGroup: true,
      schedule: { kind: "cron", expr: "0 8 * * *", tz: "Asia/Shanghai" },
      createdBy: { senderId: "owner", via: "agent" },
    });
    expect(job.next_run).toMatch(/^\d{4}-\d{2}-\d{2} 08:00 Asia\/Shanghai$/);

    const list = await (await fetch(`${base}?bot_id=bot1&chat_id=group1`)).json();
    expect(list.jobs.map((j: any) => j.id)).toEqual([job.id]);

    const updated = await (await post("/update", { id: job.id, enabled: false, tz: "UTC" })).json();
    expect(updated.job).toMatchObject({ enabled: false, schedule: { expr: "0 8 * * *", tz: "UTC" }, next_run: null });

    expect((await post(`/run?id=${job.id}`, {})).status).toBe(200);
    await vi.waitFor(() => expect(runScheduledTask).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => {
      const runs = await (await fetch(`${base}/runs?id=${job.id}`)).json();
      expect(runs.runs).toEqual([expect.objectContaining({ trigger: "manual", status: "ok" })]);
    });

    expect((await fetch(`${base}?id=${job.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await (await fetch(base)).json()).jobs).toEqual([]);
  });

  it("rejects tasks from users who may not manage them, and unknown chats", async () => {
    turnSender = { senderId: "member", senderName: "Member" };
    const denied = await post("", { bot_id: "bot1", chat_id: "group1", cron: "0 8 * * *", prompt: "x" });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toMatch(/Member is not allowed/);

    turnSender = undefined;
    expect((await post("", { bot_id: "bot1", chat_id: "nope", cron: "0 8 * * *", prompt: "x" })).status).toBe(404);
    expect((await post("", { bot_id: "bot1", chat_id: "group1", cron: "* * * * *", prompt: "x" })).status).toBe(400);

    const viaApi = await (await post("", { bot_id: "bot1", chat_id: "group1", at: "2099-01-01 09:00", prompt: "x" })).json();
    expect(viaApi.job).toMatchObject({ createdBy: { via: "api" }, schedule: { kind: "at", at: Date.UTC(2099, 0, 1, 1, 0) } });
  });
});
