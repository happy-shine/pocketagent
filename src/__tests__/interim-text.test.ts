import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { BotInstance } from "../bot/bot-instance.js";
import type { InboundMessage } from "../channels/types.js";
import type { ResolvedBotConfig } from "../config/types.js";
import { ClaudeEngineAdapter } from "../engines/claude/adapter.js";
import { GrokEventMapper } from "../engines/grok/parser.js";
import { appendText, TextBlocks } from "../engines/text-blocks.js";
import type { EngineEvent } from "../engines/types.js";
import { ProgressTracker } from "../progress/progress.js";
import type { Session } from "../sessions/types.js";

const log = pino({ level: "silent" });

describe("text blocks", () => {
  it("joins separate blocks with a blank line and keeps the pieces of one block as they are", () => {
    let text = "";
    text = appendText(text, "Hel");
    text = appendText(text, "lo ");
    text = appendText(text, "world.");
    text = appendText(text, "Second block.", true);
    text = appendText(text, " More of it.");
    expect(text).toBe("Hello world.\n\nSecond block. More of it.");
  });

  it("does not stack blank lines when a block already ends with a newline", () => {
    expect(appendText("First.\n", "\nSecond.", true)).toBe("First.\n\nSecond.");
    expect(appendText("", "Only.", true)).toBe("Only.");
  });

  it("marks only text that starts a block after earlier text", () => {
    const blocks = new TextBlocks();
    expect(blocks.text("a", true)).toEqual({ type: "text", text: "a" });
    expect(blocks.text("b")).toEqual({ type: "text", text: "b" });
    expect(blocks.text("c", true)).toEqual({ type: "text", text: "c", newBlock: true });
    blocks.close();
    expect(blocks.text("d")).toEqual({ type: "text", text: "d", newBlock: true });
  });

  it("starts a new Grok block after reasoning or a tool call, not between streamed pieces", () => {
    const mapper = new GrokEventMapper();
    const events = [
      { type: "text", data: "Let me " },
      { type: "text", data: "check." },
      { type: "tool_call", toolName: "read_file", rawInput: { path: "a.txt" } },
      { type: "text", data: "Found " },
      { type: "text", data: "it." },
      { type: "thought", data: "hmm" },
      { type: "text", data: "Also this." },
    ].flatMap((e) => mapper.map(e));
    expect(events.filter((e) => e.type === "text")).toEqual([
      { type: "text", text: "Let me " },
      { type: "text", text: "check." },
      { type: "text", text: "Found ", newBlock: true },
      { type: "text", text: "it." },
      { type: "text", text: "Also this.", newBlock: true },
    ]);
  });
});

describe("Claude adapter text blocks", () => {
  let dir: string;
  let adapter: ClaudeEngineAdapter;

  // Two whole blocks in one message, a tool call, then a streamed block
  const FAKE_CLAUDE = String.raw`#!/usr/bin/env node
import { createInterface } from "node:readline";
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
for await (const _line of createInterface({ input: process.stdin })) {
  out({ type: "system", subtype: "init", session_id: "fake-session" });
  out({ type: "assistant", message: { content: [{ type: "text", text: "Worktree is ready." }, { type: "text", text: "Starting now." }] } });
  out({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] } });
  out({ type: "content_block_start", content_block: { type: "text" } });
  out({ type: "content_block_delta", delta: { type: "text_delta", text: "All " } });
  out({ type: "content_block_delta", delta: { type: "text_delta", text: "done." } });
  out({ type: "result", result: "All done.", is_error: false });
}
`;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-claude-blocks-"));
    const fake = join(dir, "claude");
    writeFileSync(fake, FAKE_CLAUDE);
    chmodSync(fake, 0o755);
    adapter = new ClaudeEngineAdapter(
      {
        type: "claude",
        binary: fake,
        extraArgs: [],
        maxProcesses: 2,
        idleTimeoutMs: 60_000,
        workspaceDir: join(dir, "workspaces"),
        apiPort: 0,
        agentsDir: join(dir, "agents"),
      },
      log,
    );
  });

  afterEach(async () => {
    await adapter.shutdown();
    rmSync(dir, { recursive: true, force: true });
  });

  it("flags each block after the first, and none of the streamed deltas inside a block", async () => {
    const session: Session = {
      sessionId: "s1",
      chatId: "42",
      channelType: "telegram",
      activeEngine: "claude",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: 1,
      turns: [],
    };
    const events: EngineEvent[] = [];
    for await (const ev of adapter.sendMessage(session, "go", "bot1")) events.push(ev);
    expect(events.filter((e) => e.type === "text")).toEqual([
      { type: "text", text: "Worktree is ready." },
      { type: "text", text: "Starting now.", newBlock: true },
      { type: "text", text: "All ", newBlock: true },
      { type: "text", text: "done." },
    ]);
  });
});

describe("chat turns with interim text", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "pa-interim-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dataDir, { recursive: true, force: true });
  });

  function makeBot(events: () => AsyncGenerator<EngineEvent>, config: Partial<ResolvedBotConfig> = {}, channelType = "telegram") {
    const engineManager = { sendMessage: vi.fn(() => events()), release: vi.fn() };
    const bot = new BotInstance({
      botConfig: {
        name: "test-bot",
        channel: "telegram",
        botId: "bot1",
        engine: "claude",
        extraArgs: [],
        dmPolicy: "open",
        groupPolicy: "open",
        guildPolicy: "open",
        allowFrom: [],
        groups: {},
        guilds: {},
        followUp: "queue",
        interimText: "message",
        ...config,
      },
      gatewayConfig: {} as any,
      engineManager: engineManager as any,
      messageStore: {} as any,
      dataDir,
      log,
    });
    let nextId = 500;
    const channel = {
      type: channelType,
      send: vi.fn(async (_msg: any) => String(nextId++)),
      editMessage: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
    };
    return { bot, channel };
  }

  const message: InboundMessage = {
    channelType: "telegram",
    chatId: "42",
    senderId: "u1",
    senderName: "Alice",
    messageId: "101",
    text: "set it up",
    isGroup: false,
    timestamp: 1_760_000_000,
    raw: {},
  };
  const run = (bot: BotInstance, channel: unknown) => (bot as any).handleMessage(message, channel) as Promise<void>;
  const sends = (channel: { send: ReturnType<typeof vi.fn> }) => channel.send.mock.calls.map((c: any[]) => c[0]);

  it("posts text written before a tool call right away, replying to the message, and keeps it out of the final reply", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Creating the worktree first." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "The worktree is ready." };
      yield { type: "result" };
    }, {}, "discord");
    await run(bot, channel);
    expect(sends(channel)).toEqual([
      { chatId: "42", text: "Creating the worktree first.", replyToMessageId: "101" },
      { chatId: "42", text: "The worktree is ready.", replyToMessageId: "101", parseMode: undefined, plainFallback: undefined },
    ]);
  });

  it("formats interim text for Telegram like the final reply", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Checking **logs**." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Fine." };
      yield { type: "result" };
    });
    await run(bot, channel);
    expect(sends(channel)[0]).toMatchObject({ text: "Checking <b>logs</b>.", parseMode: "HTML", replyToMessageId: "101" });
  });

  it("coalesces interim blocks that arrive close together into one message", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Step one." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Step two." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Finished." };
      yield { type: "result" };
    }, {}, "discord");
    await run(bot, channel);
    expect(sends(channel).map((m) => m.text)).toEqual(["Step one.\n\nStep two.", "Finished."]);
  });

  it("keeps the old buffering in final mode, with blocks separated by blank lines", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Creating the worktree first." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "The worktree " };
      yield { type: "text", text: "is ready." };
      yield { type: "text", text: "Next: tests.", newBlock: true };
      yield { type: "result" };
    }, { interimText: "final" }, "discord");
    await run(bot, channel);
    expect(sends(channel).map((m) => m.text)).toEqual([
      "Creating the worktree first.\n\nThe worktree is ready.\n\nNext: tests.",
    ]);
  });

  it("leaves turns without tool calls as they were, joining their blocks", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "First " };
      yield { type: "text", text: "paragraph." };
      yield { type: "text", text: "Second paragraph.", newBlock: true };
      yield { type: "result" };
    }, {}, "discord");
    await run(bot, channel);
    expect(sends(channel)).toHaveLength(1);
    expect(sends(channel)[0]).toMatchObject({ text: "First paragraph.\n\nSecond paragraph.", replyToMessageId: "101" });
  });

  it("does not post an interim [SILENT], and drops a closing [SILENT] line from interim text", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "[SILENT]" };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Sent the report.\n[SILENT]" };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Done." };
      yield { type: "result" };
    }, {}, "discord");
    await run(bot, channel);
    expect(sends(channel).map((m) => m.text)).toEqual(["Sent the report.", "Done."]);
  });

  it("posts the interim text but no final reply when the turn ends with [SILENT]", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Sending both answers." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "[SILENT]" };
      yield { type: "result" };
    }, {}, "discord");
    await run(bot, channel);
    expect(sends(channel).map((m) => m.text)).toEqual(["Sending both answers."]);
  });

  it("posts nothing more when the turn ends on a tool call after its interim text", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Uploading the file now." };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "result" };
    }, {}, "discord");
    await run(bot, channel);
    expect(sends(channel).map((m) => m.text)).toEqual(["Uploading the file now."]);
  });

  it("joins blocks in scheduled runs too", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Headline A." };
      yield { type: "text", text: "Headline B.", newBlock: true };
      yield { type: "result" };
    });
    (bot as any).telegram = channel;
    const result = await bot.runScheduledTask(
      {
        id: "c1",
        name: "Digest",
        botId: "bot1",
        chatId: "42",
        channelType: "telegram",
        isGroup: false,
        prompt: "news",
        schedule: { kind: "cron", expr: "0 8 * * *", tz: "UTC" },
        enabled: true,
        createdBy: { senderId: "u1", senderName: "Alice", via: "agent" },
        createdAt: 0,
        updatedAt: 0,
        state: { runCount: 1, consecutiveFailures: 0 },
      },
      { runNum: 1, trigger: "schedule", scheduledAt: 0, startedAt: 0, timeoutMs: 60_000 },
    );
    expect(result.output).toBe("Headline A.\n\nHeadline B.");
  });
});

describe("ProgressTracker interim posts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeTracker() {
    let nextId = 1;
    const channel = {
      type: "discord",
      send: vi.fn(async (_msg: any) => `m${nextId++}`),
      editMessage: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
    };
    return { channel, tracker: new ProgressTracker(channel as any, "42", "101") };
  }

  it("coalesces blocks within 3 s and posts later ones separately", async () => {
    vi.useFakeTimers();
    const { channel, tracker } = makeTracker();
    tracker.postInterim("one");
    await vi.advanceTimersByTimeAsync(1000);
    tracker.postInterim("two");
    await vi.advanceTimersByTimeAsync(2100);
    expect(channel.send.mock.calls.map((c) => c[0].text)).toEqual(["one\n\ntwo"]);
    tracker.postInterim("three");
    await vi.advanceTimersByTimeAsync(3100);
    expect(channel.send.mock.calls.map((c) => c[0].text)).toEqual(["one\n\ntwo", "three"]);
    expect(tracker.getInterimMessageIds()).toEqual(["m1", "m2"]);
  });

  it("moves the progress message below interim text instead of duplicating it", async () => {
    vi.useFakeTimers();
    const { channel, tracker } = makeTracker();
    tracker.start();
    tracker.toolStart("Bash", "ls");
    await vi.advanceTimersByTimeAsync(3100);
    // m1: progress message
    expect(channel.send).toHaveBeenCalledTimes(1);

    tracker.postInterim("Working on it.");
    await vi.advanceTimersByTimeAsync(3000);
    // m2: interim text, then the old progress message goes
    expect(channel.send.mock.calls[1][0]).toMatchObject({ text: "Working on it.", replyToMessageId: "101" });
    expect(channel.deleteMessage).toHaveBeenCalledWith("42", "m1");

    await vi.advanceTimersByTimeAsync(3000);
    // m3: progress message again, below the interim text, still listing the tool
    expect(channel.send).toHaveBeenCalledTimes(3);
    expect(channel.send.mock.calls[2][0].text).toContain("Bash: ls");

    await tracker.finish("Final answer.");
    expect(channel.editMessage).toHaveBeenLastCalledWith("42", "m3", "Final answer.", undefined, undefined, undefined);
    expect(channel.send).toHaveBeenCalledTimes(3);
  });

  it("posts waiting interim text before the final answer", async () => {
    vi.useFakeTimers();
    const { channel, tracker } = makeTracker();
    tracker.postInterim("Interim.");
    await tracker.finish("Final.");
    expect(channel.send.mock.calls.map((c) => c[0].text)).toEqual(["Interim.", "Final."]);
  });
});
