import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { BotInstance } from "../bot/bot-instance.js";
import type { ResolvedBotConfig } from "../config/types.js";
import type { EngineEvent } from "../engines/types.js";
import type { CronJob, CronRunContext } from "../scheduler/types.js";

const NOW = Date.UTC(2026, 9, 3, 0, 0, 0);

describe("BotInstance scheduled task runs", () => {
  let dataDir: string;
  const log = pino({ level: "silent" });

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "pa-cron-run-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  function makeBot(events: (session: any) => AsyncGenerator<EngineEvent>, config: Partial<ResolvedBotConfig> = {}) {
    const engineManager = {
      sendMessage: vi.fn((session: any) => events(session)),
      release: vi.fn(),
    };
    const bot = new BotInstance({
      botConfig: {
        name: "test-bot",
        channel: "telegram",
        botId: "bot1",
        engine: "claude",
        model: "sonnet",
        extraArgs: [],
        dmPolicy: "open",
        groupPolicy: "open",
        guildPolicy: "open",
        allowFrom: [],
        groups: {},
        guilds: {},
        ...config,
      },
      gatewayConfig: {} as any,
      engineManager: engineManager as any,
      messageStore: {} as any,
      dataDir,
      log,
    });
    const channel = { type: "telegram", send: vi.fn(async () => "1"), editMessage: vi.fn() };
    (bot as any).telegram = channel;
    return { bot, engineManager, channel };
  }

  const job: CronJob = {
    id: "abc123",
    name: "AI digest",
    botId: "bot1",
    chatId: "42",
    channelType: "telegram",
    isGroup: false,
    prompt: "Summarize AI news",
    schedule: { kind: "cron", expr: "0 8 * * *", tz: "UTC" },
    enabled: true,
    createdBy: { senderId: "42", senderName: "User", via: "agent" },
    createdAt: NOW,
    updatedAt: NOW,
    state: { runCount: 1, consecutiveFailures: 0 },
  };
  const run: CronRunContext = { runNum: 1, trigger: "schedule", scheduledAt: NOW, startedAt: NOW, timeoutMs: 60_000 };

  it("runs in a fresh dedicated session and posts the result to the chat", async () => {
    const { bot, engineManager, channel } = makeBot(async function* () {
      yield { type: "text", text: "Today's digest" };
      yield { type: "result" };
    });

    const result = await bot.runScheduledTask(job, run);

    expect(result).toEqual({ status: "ok", output: "Today's digest" });
    const [session, prompt] = engineManager.sendMessage.mock.calls[0] as unknown as [any, string];
    expect(session).toMatchObject({ sessionId: "cron-abc123", chatId: "42", activeEngine: "claude", model: "sonnet", turns: [] });
    expect(session.claudeSessionId).toBeUndefined();
    expect(prompt).toContain('[Scheduled task "AI digest"');
    expect(prompt.endsWith("Summarize AI news")).toBe(true);
    expect(engineManager.release).toHaveBeenCalledWith("cron-abc123", "claude");
    expect(channel.send).toHaveBeenCalledTimes(1);
    const sent = (channel.send.mock.calls[0] as unknown as [any])[0];
    expect(sent).toMatchObject({ chatId: "42", parseMode: "HTML" });
    expect(sent.text).toContain("<b>AI digest</b>");
    expect(sent.text).toContain("Today's digest");
  });

  it("posts only the final answer, not narration between tool calls", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "I have launched the query and am waiting.\n" };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Still waiting for the download.\n" };
      yield { type: "tool_started", name: "Bash" };
      yield { type: "text", text: "Final report" };
      yield { type: "result" };
    });
    const result = await bot.runScheduledTask(job, run);
    expect(result.output).toBe("Final report");
    const sent = (channel.send.mock.calls[0] as unknown as [any])[0].text;
    expect(sent).toContain("Final report");
    expect(sent).not.toContain("waiting");
  });

  it("does not use the bot's model when the task picks another engine", async () => {
    const { bot, engineManager } = makeBot(async function* () {
      yield { type: "text", text: "ok" };
    });
    await bot.runScheduledTask({ ...job, engine: "codex" }, run);
    const [session] = engineManager.sendMessage.mock.calls[0] as unknown as [any];
    expect(session).toMatchObject({ activeEngine: "codex", model: undefined });
  });

  it("starts Discord messages with a heading so consecutive reports stay distinct", async () => {
    const { bot } = makeBot(async function* () {
      yield { type: "text", text: "### 核心观点\n- point" };
    });
    const discord = { type: "discord", send: vi.fn(async () => "1"), editMessage: vi.fn() };
    (bot as any).discord = discord;
    await bot.runScheduledTask({ ...job, channelType: "discord" }, run);
    expect((discord.send.mock.calls[0] as unknown as [any])[0].text).toBe("## AI digest\n\n### 核心观点\n- point");
  });

  it("posts nothing when the run replies [SILENT]", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "text", text: "No changes. [SILENT]" };
    });
    const result = await bot.runScheduledTask(job, run);
    expect(result.status).toBe("silent");
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("reports engine errors", async () => {
    const { bot, channel } = makeBot(async function* () {
      yield { type: "error", message: "Failed to spawn Claude process" };
    });
    const result = await bot.runScheduledTask(job, run);
    expect(result).toMatchObject({ status: "error", error: "Failed to spawn Claude process" });
    expect((channel.send.mock.calls[0] as unknown as [any])[0].text).toContain("Run failed");
  });

  it("terminates the engine when a run exceeds its timeout", async () => {
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => (unblock = resolve));
    const { bot, engineManager, channel } = makeBot(async function* () {
      yield { type: "text", text: "partial" };
      await blocked;
    });
    engineManager.release.mockImplementation(() => unblock());

    const result = await bot.runScheduledTask(job, { ...run, timeoutMs: 20 });

    expect(result).toMatchObject({ status: "timeout", output: "partial" });
    expect((channel.send.mock.calls[0] as unknown as [any])[0].text).toContain("Timed out");
  });

  it("pauses the task when its creator is no longer authorized", async () => {
    const { bot, engineManager } = makeBot(async function* () {}, { dmPolicy: "allowlist", allowFrom: [] });
    const result = await bot.runScheduledTask(job, run);
    expect(result.pauseReason).toMatch(/no longer authorized/);
    expect(engineManager.sendMessage).not.toHaveBeenCalled();
  });

  it("only lets explicitly trusted users manage tasks in groups", () => {
    const { bot } = makeBot(async function* () {}, {
      dmPolicy: "pairing",
      groupPolicy: "pairing",
      allowFrom: ["owner"],
      groups: { g1: { enabled: true } },
    });
    expect(bot.canManageCron("owner", "g1", true)).toBe(true);
    expect(bot.canManageCron("member", "g1", true)).toBe(false);
    expect(bot.canManageCron("owner", "g2", true)).toBe(false);
    expect(bot.canManageCron("owner", "owner", false)).toBe(true);
    expect(bot.canManageCron("stranger", "stranger", false)).toBe(false);
    expect(bot.canManageCron(undefined, "g1", true)).toBe(false);
  });
});
