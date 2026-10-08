import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { BotInstance } from "../bot/bot-instance.js";
import type { InboundMessage } from "../channels/types.js";
import type { EngineEvent } from "../engines/types.js";
import { ProgressTracker } from "../progress/progress.js";
import { answerSteerHook, formatSteerText, SteerMailbox } from "../steer/steer.js";

/** Chat turns driven by the agent: ids it can reply to, the turn it is bound to, and turns that end silently. */
describe("agent-driven chat turns", () => {
  let dataDir: string;
  const log = pino({ level: "silent" });

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "pa-agent-turn-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  function makeBot(events: (prompt: string) => AsyncGenerator<EngineEvent>) {
    const steerMailbox = new SteerMailbox();
    const engineManager = {
      sendMessage: vi.fn((_session: unknown, prompt: string) => events(prompt)),
      release: vi.fn(),
      supportsSteer: () => true,
      isBusy: () => true,
    };
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
        followUp: "steer",
      },
      gatewayConfig: {} as any,
      engineManager: engineManager as any,
      messageStore: {} as any,
      dataDir,
      log,
      steerMailbox,
    });
    const channel = {
      type: "telegram",
      send: vi.fn(async () => "900"),
      editMessage: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
      setReaction: vi.fn(async () => {}),
    };
    (bot as any).telegram = channel;
    return { bot, engineManager, channel, steerMailbox };
  }

  const message = (messageId: string, text: string, extra: Partial<InboundMessage> = {}): InboundMessage => ({
    channelType: "telegram",
    chatId: "42",
    senderId: "u1",
    senderName: "Alice",
    messageId,
    text,
    isGroup: false,
    timestamp: 1_760_000_000,
    raw: {},
    ...extra,
  });

  it("shows the agent the ids of the message that started the turn and of messages relayed into it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const prompts: string[] = [];
    const { bot, steerMailbox } = makeBot(async function* (prompt) {
      prompts.push(prompt);
      await gate;
      yield { type: "text", text: "done" };
      yield { type: "result" };
    });

    const turn = (bot as any).handleMessage(message("101", "build it"), (bot as any).telegram) as Promise<void>;
    await vi.waitFor(() => expect(prompts).toHaveLength(1));
    expect(prompts[0]).toContain("[message_id: 101, sender_id: u1]");

    // While the turn runs, its session resolves to the chat and to this very turn
    const sessionId = bot.getTurnSender("42")!.sessionId;
    const bound = bot.resolveApiSession(sessionId);
    expect(bound).toMatchObject({ chatId: "42", channelType: "telegram" });
    expect(bound?.turn).toBe(bot.getTurnSender("42"));

    await (bot as any).handleMessage(message("102", "use python"), (bot as any).telegram);
    expect(steerMailbox.pending(sessionId)).toBe(1);
    const { output } = answerSteerHook(steerMailbox, "claude", "PostToolUse", sessionId, {});
    const relayed = (output as any).hookSpecificOutput.additionalContext as string;
    expect(relayed).toContain("[PocketAgent: new chat message");
    expect(relayed).toContain("[message_id: 102, sender_id: u1]");
    expect(relayed).toContain("use python");

    release();
    await turn;
    // Between turns the session still belongs to the chat, but no turn is running
    expect(bot.resolveApiSession(sessionId)).toEqual({ chatId: "42", channelType: "telegram", turn: undefined });
    expect(bot.resolveApiSession("unknown")).toBeUndefined();
  });

  it("labels each relayed message with its own ids", () => {
    const text = formatSteerText([
      { messageId: "7", senderId: "u1", text: "first" },
      { messageId: "8", text: "second" },
    ]);
    expect(text).toContain("[message_id: 7, sender_id: u1]\nfirst");
    expect(text).toContain("[message_id: 8]\nsecond");
  });

  it.each([
    ["exactly [SILENT]", ["[SILENT]"]],
    ["[SILENT] as the last line", ["Sent both answers above.\n[SILENT]"]],
    ["[SILENT] after a tool call", ["@tool", "[SILENT]"]],
  ])("posts nothing for a chat turn ending with %s", async (_label, parts) => {
    const { bot, channel } = makeBot(async function* () {
      for (const part of parts) {
        if (part === "@tool") yield { type: "tool_started", name: "Bash" };
        else yield { type: "text", text: part };
      }
      yield { type: "result" };
    });
    await (bot as any).handleMessage(message("101", "answer both"), channel);
    expect(channel.send).not.toHaveBeenCalled();
    expect(channel.editMessage).not.toHaveBeenCalled();
  });

  it("still posts a reply that merely mentions [SILENT]", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "Cron prompts can reply [SILENT] to stay quiet." };
      yield { type: "result" };
    });
    await (bot as any).handleMessage(message("101", "how do cron prompts stay quiet?"), channel);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect((channel.send.mock.calls[0] as any[])[0].text).toContain("stay quiet");
  });

  it("lets a background job follow-up end silently too", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "[SILENT]" };
      yield { type: "result" };
    });
    (bot as any).jobManager = { readLog: () => "", logPath: () => "/tmp/log" };
    await (bot as any).runJobCallback(
      {
        id: "j1",
        seq: 1,
        title: "Download",
        botId: "bot1",
        chatId: "42",
        channelType: "telegram",
        isGroup: false,
        command: "true",
        status: "succeeded",
        exitCode: 0,
        requester: { senderId: "u1", senderName: "Alice" },
        originMessageId: "101",
      },
      channel,
    );
    expect(channel.send).not.toHaveBeenCalled();
  });
});

describe("ProgressTracker.discard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes the progress message instead of posting an answer", async () => {
    vi.useFakeTimers();
    const channel = {
      type: "telegram",
      send: vi.fn(async () => "p1"),
      editMessage: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
    };
    const tracker = new ProgressTracker(channel as any, "42", "101");
    tracker.start();
    await vi.advanceTimersByTimeAsync(3100);
    expect(channel.send).toHaveBeenCalledTimes(1);

    await tracker.discard();
    expect(channel.deleteMessage).toHaveBeenCalledWith("42", "p1");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.editMessage).not.toHaveBeenCalled();
  });
});
