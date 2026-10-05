import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import type { InboundMessage } from "../channels/types.js";
import { parseConfig } from "../config/loader.js";
import { Gateway } from "../gateway/gateway.js";

/**
 * A stand-in for the `claude` CLI that speaks its stream-json protocol and acts like an agent following the
 * background job skill: it reads the API endpoint from the CLAUDE.md the gateway wrote and calls it with the
 * session header, exactly as the skill's curl example does. It remembers what it was told, to show that the
 * follow-up arrives in the same conversation.
 */
const FAKE_CLAUDE = String.raw`#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const skill = existsSync("CLAUDE.md") ? readFileSync("CLAUDE.md", "utf-8") : "";
const api = skill.match(/curl -s -X POST "(http:\/\/127\.0\.0\.1:\d+\/api\/jobs)"[^\n]*X-PocketAgent-Session: \$POCKETAGENT_SESSION_ID[^\n]*\n\s*-d '\{"bot_id":"([^"]+)","chat_id":"([^"]+)"/);
const memory = [];

async function startJob(command, then) {
  if (!api) return { status: 0, body: {} };
  const res = await fetch(api[1], {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PocketAgent-Session": process.env.POCKETAGENT_SESSION_ID ?? "" },
    body: JSON.stringify({ bot_id: api[2], chat_id: api[3], title: "Test job", command, then }),
  });
  return { status: res.status, body: await res.json() };
}

const rl = createInterface({ input: process.stdin });
for await (const line of rl) {
  const content = JSON.parse(line).message.content;
  // React to the message itself, not to earlier messages quoted in a context handover
  const own = content.split("[End of Context Handover]").pop();
  out({ type: "system", subtype: "init", session_id: "fake-" + process.pid });
  let text;
  if (own.includes("[Background job #")) {
    text = "CALLBACK remembered=" + memory.some((m) => m.includes("LONG DOWNLOAD")) + " tail=" + own.includes("downloaded-ok") + " then=" + own.includes("Report the size");
  } else if (own.includes("LONG DOWNLOAD")) {
    const res = await startJob("sleep 0.8; head -c 2048 /dev/zero > data.bin; echo downloaded-ok", "Report the size of data.bin");
    text = "Started job #" + res.body.job?.number + " (HTTP " + res.status + ")";
  } else if (own.includes("LONG SLEEP")) {
    const res = await startJob("sleep 30", "Report");
    text = "Started job #" + res.body.job?.number;
  } else if (own.includes("THREE JOBS")) {
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await startJob("sleep 30", "x")).status);
    text = "statuses=" + statuses.join(",");
  } else if (own.includes("TRY JOB")) {
    text = "side-job=" + (await startJob("sleep 30", "x")).status;
  } else if (own.includes("SLOW FOREGROUND")) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    text = "FOREGROUND DONE";
  } else {
    text = "ECHO " + content;
  }
  memory.push(own);
  out({ type: "assistant", message: { content: [{ type: "text", text }] } });
  out({ type: "result", result: text, is_error: false });
}
`;

describe("Background jobs end to end", () => {
  let dataDir: string;
  let gateway: Gateway;
  let bot: any;
  let channel: ReturnType<typeof makeChannel>;

  function makeChannel() {
    let nextId = 100;
    return {
      type: "discord",
      send: vi.fn(async (_msg: any) => String(nextId++)),
      sendWithButtons: vi.fn(async (..._args: any[]) => String(nextId++)),
      editMessage: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
  }
  const sentTexts = () => channel.send.mock.calls.map((c) => c[0].text as string);

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "pa-jobs-e2e-"));
    const fake = join(dataDir, "fake-claude.mjs");
    writeFileSync(fake, FAKE_CLAUDE);
    chmodSync(fake, 0o755);
    const port = 20000 + Math.floor(Math.random() * 20000);
    const config = parseConfig(
      [
        "gateway:",
        `  port: ${port}`,
        `  dataDir: "${dataDir}"`,
        "engines:",
        "  claude:",
        `    binary: "${fake}"`,
        "jobs:",
        "  pollIntervalMs: 50",
        "bots:",
        "  - name: e2e",
        "    channel: discord",
        "    engine: claude",
        "    dmPolicy: open",
        "    groupPolicy: open",
        "",
      ].join("\n"),
    );
    gateway = new Gateway(config, pino({ level: "silent" }), join(dataDir, "config.yaml"));
    await gateway.start();
    bot = (gateway as any).bots.get("e2e");
    channel = makeChannel();
    bot.discord = channel;
  });

  afterEach(async () => {
    const manager = (gateway as any).jobManager;
    for (const job of manager.list({ activeOnly: true })) manager.cancel(job.id);
    await gateway.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("hands a long command off, keeps the chat free, and continues the conversation when it exits", async () => {
    const manager = (gateway as any).jobManager;

    await bot.handleMessage(message("Please run the LONG DOWNLOAD", "11"), channel);
    expect(sentTexts()[0]).toContain("Started job #1 (HTTP 200)");
    const [job] = manager.list({ chatId: "g1" });
    expect(job).toMatchObject({ status: "running", requester: { senderName: "Alice" }, originMessageId: "11" });

    // Someone else is answered while the job runs
    await bot.handleMessage(message("Quick question", "12", "u2", "Bob"), channel);
    expect(sentTexts().at(-1)).toContain("ECHO");
    expect(manager.get(job.id).status).toBe("running");

    // The follow-up goes to the same CLI process, replies to the original message and mentions the requester
    await vi.waitFor(() => expect(sentTexts().some((t) => t.includes("CALLBACK"))).toBe(true), { timeout: 10_000 });
    const callback = channel.send.mock.calls.find((c) => c[0].text.includes("CALLBACK"))![0];
    expect(callback.replyToMessageId).toBe("11");
    expect(callback.text).toBe("<@u1>\nCALLBACK remembered=true tail=true then=true");
    await vi.waitFor(() => expect(manager.get(job.id).callback).toBe("done"));

    // The command ran in the chat session's workspace
    const wsRoot = join(dataDir, "workspaces", "e2e");
    const [workspace] = readdirSync(wsRoot);
    expect(statSync(join(wsRoot, workspace, "data.bin")).size).toBe(2048);

    const session = bot.getSessionManager().getActiveSession("g1");
    expect(session.turns.map((t: any) => t.role)).toEqual(["user", "assistant", "user", "assistant", "system", "assistant"]);
    expect(session.turns[4].text).toBe('[Background job #1 "Test job" succeeded]');
  }, 20_000);

  it("caps jobs per message and refuses them from side questions", async () => {
    await bot.handleMessage(message("Start THREE JOBS", "21"), channel);
    expect(sentTexts().at(-1)).toContain("statuses=200,200,429");

    const foreground = bot.handleMessage(message("Run the SLOW FOREGROUND job", "22"), channel);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await bot.handleBtw(message("TRY JOB from the side", "23"), channel);
    expect(sentTexts().at(-1)).toContain("side-job=409");
    await foreground;
  }, 20_000);

  it("answers /btw from a side process instead of the busy session's process", async () => {
    await bot.handleMessage(message("Remember the codeword is pineapple", "30"), channel);
    const foreground = bot.handleMessage(message("Run the SLOW FOREGROUND job", "31"), channel);
    await new Promise((resolve) => setTimeout(resolve, 300));

    await bot.handleBtw(message("What is the codeword?", "32", "u2", "Bob"), channel);
    const btwReply = sentTexts().at(-1)!;
    expect(btwReply).toContain("ECHO [Context Handover Notice]");
    expect(btwReply).toContain("pineapple");
    expect(btwReply).not.toContain("FOREGROUND DONE");

    await foreground;
    expect(sentTexts().at(-1)).toContain("FOREGROUND DONE");
  }, 20_000);

  it("lists jobs with their progress and lets the requester stop one, without a follow-up", async () => {
    const manager = (gateway as any).jobManager;
    await bot.handleMessage(message("Do a LONG SLEEP", "41"), channel);
    const [job] = manager.list({ chatId: "g1" });

    await bot.handleJobs(message("", "42"), channel);
    const [, listText, buttons] = channel.sendWithButtons.mock.calls.at(-1)!;
    expect(listText).toMatch(/\*#1 Test job\* \[running \d+s\] · Alice/);
    expect(listText).toContain("`sleep 30`");
    expect(buttons[0][0]).toEqual({ text: "Stop #1", data: `job:stop:${job.id}` });
    expect(buttons[1][0]).toEqual({ text: "Log #1", data: `job:log:${job.id}` });

    await bot.handleJobs(message("stop 1", "43", "u2", "Bob"), channel);
    expect(sentTexts().at(-1)).toBe("Only Alice or an authorized user can stop job #1.");
    await bot.handleJobs(message("stop #1", "44"), channel);
    expect(sentTexts().at(-1)).toBe("Stopping job #1: Test job");

    await vi.waitFor(() => expect(manager.get(job.id)).toMatchObject({ status: "cancelled", callback: "skipped" }), { timeout: 10_000 });
    expect(manager.get(job.id).cancelledBy).toBe("Alice");
    expect(sentTexts().some((t) => t.includes("CALLBACK"))).toBe(false);

    await bot.handleJobs(message("log 1", "45"), channel);
    expect(sentTexts().at(-1)).toMatch(/^\*\*Job #1 Test job\*\* \(cancelled\)\n```\n/);
    expect(existsSync(manager.logPath(job.id))).toBe(true);
  }, 20_000);
});

function message(text: string, messageId: string, senderId = "u1", senderName = "Alice"): InboundMessage {
  return {
    channelType: "discord",
    chatId: "g1",
    senderId,
    senderName,
    messageId,
    text,
    isGroup: true,
    timestamp: Math.floor(Date.now() / 1000),
    raw: {},
  };
}
