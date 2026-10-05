import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import type { TurnInfo } from "../bot/bot-instance.js";
import { parseConfig } from "../config/loader.js";
import { buildSystemPromptParts } from "../engines/prompt.js";
import { getDashboardHtml } from "../api/dashboard-html.js";
import { Gateway } from "../gateway/gateway.js";

describe("Background jobs HTTP API", () => {
  let dataDir: string;
  let workspace: string;
  let gateway: Gateway;
  let base: string;
  let turn: TurnInfo | undefined;
  const handleJobFinished = vi.fn(async () => "done" as const);

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "pa-jobs-api-"));
    workspace = mkdtempSync(join(tmpdir(), "pa-jobs-ws-"));
    const port = 20000 + Math.floor(Math.random() * 20000);
    base = `http://127.0.0.1:${port}/api/jobs`;
    const config = parseConfig(`gateway:\n  port: ${port}\n  dataDir: "${dataDir}"\njobs:\n  pollIntervalMs: 30\n  maxPerChat: 1\n`);
    gateway = new Gateway(config, pino({ level: "silent" }), join(dataDir, "config.yaml"));

    turn = undefined;
    handleJobFinished.mockClear();
    const fakeBot = {
      botId: "bot1",
      name: "fake",
      getChatInfo: (chatId: string) => (chatId === "group1" ? { channelType: "discord", isGroup: true } : undefined),
      getTurnSender: () => turn,
      getSessionWorkspace: () => workspace,
      canManageCron: (senderId: string) => senderId === "owner",
      handleJobFinished,
      setPeerBots: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    (gateway as any).bots.set("bot1", fakeBot);
    await gateway.start();
  });

  afterEach(async () => {
    const manager = (gateway as any).jobManager;
    for (const job of manager.list({ activeOnly: true })) manager.cancel(job.id);
    await gateway.stop();
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(workspace, { recursive: true, force: true });
  });

  const post = (path: string, body: unknown, session?: string) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { "X-PocketAgent-Session": session } : {}) },
      body: JSON.stringify(body),
    });
  const aliceTurn = (): TurnInfo => ({ senderId: "u1", senderName: "Alice", messageId: "77", sessionId: "sess-1", jobsStarted: 0 });

  it("runs a job for the sender of the chat turn in progress and reports it back", async () => {
    turn = aliceTurn();
    const res = await post(
      "",
      { bot_id: "bot1", chat_id: "group1", title: "Fetch data", command: "echo progress 50%; echo done", then: "Summarize", timeout_minutes: 90 },
      "sess-1",
    );
    expect(res.status).toBe(200);
    const { job } = await res.json();
    expect(job).toMatchObject({
      number: 1,
      title: "Fetch data",
      status: "running",
      cwd: workspace,
      then: "Summarize",
      requester: { senderId: "u1", senderName: "Alice" },
      originMessageId: "77",
      sessionId: "sess-1",
      timeoutMs: 90 * 60_000,
      bot_name: "fake",
    });
    expect(turn.jobsStarted).toBe(1);

    await vi.waitFor(() => expect(handleJobFinished).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const detail = await (await fetch(`${base}?id=${job.id}`)).json();
    expect(detail.job).toMatchObject({ status: "succeeded", exitCode: 0, callback: "done" });
    expect(detail.job.log_tail).toBe("progress 50%\ndone");

    const log = await (await fetch(`${base}/log?id=${job.id}&lines=1`)).json();
    expect(log).toEqual({ ok: true, log: "done", status: "succeeded" });

    const list = await (await fetch(`${base}?bot_id=bot1&chat_id=group1`)).json();
    expect(list.jobs.map((j: any) => j.number)).toEqual([1]);
    expect(list.jobs[0].log_tail).toBeUndefined();
  });

  it("only accepts jobs from a chat turn, and a limited number per turn", async () => {
    const outside = await post("", { bot_id: "bot1", chat_id: "group1", command: "true" });
    expect(outside.status).toBe(409);
    expect((await outside.json()).error).toMatch(/only be started while handling a chat message/);

    turn = aliceTurn();
    for (const session of ["cron-abcd1234", "btw-1234abcd"]) {
      const res = await post("", { bot_id: "bot1", chat_id: "group1", command: "true" }, session);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/run the command directly/);
    }

    expect((await post("", { bot_id: "bot1", chat_id: "group1", command: "sleep 5" }, "sess-1")).status).toBe(200);
    expect((await post("", { bot_id: "bot1", chat_id: "group1", command: "sleep 5" }, "sess-1")).status).toBe(200);
    const third = await post("", { bot_id: "bot1", chat_id: "group1", command: "sleep 5" }, "sess-1");
    expect(third.status).toBe(429);
    expect((await third.json()).error).toMatch(/At most 2 background jobs per message/);
  });

  it("validates the request", async () => {
    turn = aliceTurn();
    expect((await post("", { chat_id: "group1", command: "x" })).status).toBe(400);
    expect((await post("", { bot_id: "nope", chat_id: "group1", command: "x" })).status).toBe(404);
    expect((await post("", { bot_id: "bot1", chat_id: "other", command: "x" })).status).toBe(404);
    expect((await (await post("", { bot_id: "bot1", chat_id: "group1", command: "" })).json()).error).toBe("Missing command");
    expect((await (await post("", { bot_id: "bot1", chat_id: "group1", command: "ls", cwd: "/no/such/dir" })).json()).error).toMatch(
      /does not exist/,
    );
    // Rejected jobs do not count against the turn
    expect(turn.jobsStarted).toBe(0);
  });

  it("lets the requester, a trusted user or the dashboard stop a job", async () => {
    turn = aliceTurn();
    const { job } = await (await post("", { bot_id: "bot1", chat_id: "group1", command: "sleep 30" }, "sess-1")).json();

    turn = { ...aliceTurn(), senderId: "u2", senderName: "Bob" };
    expect((await post(`/cancel?id=${job.id}`, {}, "sess-1")).status).toBe(403);
    expect((await post(`/cancel?id=${job.id}`, {}, "btw-1234abcd")).status).toBe(403);

    // The dashboard sends no session header
    expect((await post(`/cancel?id=${job.id}`, {})).status).toBe(200);
    await vi.waitFor(async () => {
      const detail = await (await fetch(`${base}?id=${job.id}`)).json();
      expect(detail.job).toMatchObject({ status: "cancelled", cancelledBy: "dashboard", callback: "done" });
    }, { timeout: 8000 });
    expect((await post(`/cancel?id=${job.id}`, {})).status).toBe(400);

    expect((await fetch(`${base}?id=${job.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await fetch(`${base}?id=${job.id}`)).status).toBe(404);
  });
});

describe("Background job skill", () => {
  const base = { agentsDir: "/nonexistent", botId: "b1", apiPort: 18790, chatId: "c1", isGroup: true };

  it("is in the system prompt when enabled, restricted to genuinely long commands", () => {
    const prompt = buildSystemPromptParts({ ...base, backgroundJobs: true }).join("\n");
    expect(prompt).toContain("## Background Jobs (for genuinely long commands only)");
    expect(prompt).toContain("MORE THAN 5 MINUTES");
    expect(prompt).toContain("If you are not sure it will take more than 5 minutes, it does not qualify");
    expect(prompt).toContain('-H "X-PocketAgent-Session: $POCKETAGENT_SESSION_ID"');
    expect(prompt).toContain("END YOUR TURN");
    expect(buildSystemPromptParts({ ...base, backgroundJobs: false }).join("\n")).not.toContain("Background Jobs");
  });
});

describe("Dashboard background jobs page", () => {
  it("has a jobs page whose script parses", () => {
    const html = getDashboardHtml();
    const script = html.match(/<script>([\s\S]*)<\/script>/)![1];
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain("function pageJobs(");
    expect(script).toContain('L("后台作业", "Background jobs")');
    for (const endpoint of ["/api/jobs", "/api/jobs/log", "/api/jobs/cancel"]) expect(script).toContain(endpoint);
  });
});
