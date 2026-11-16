import { describe, it, expect, vi } from "vitest";
import { configSchema } from "../config/schema.js";
import { claudeContextLimitEnv, CLAUDE_MIN_AUTO_COMPACT_WINDOW } from "../engines/claude/adapter.js";
import { buildCodexSpawnArgs } from "../engines/codex/parser.js";
import { prepareDiscordText } from "../channels/discord/formatter.js";
import { ProgressTracker } from "../progress/progress.js";
import { formatContextUsage, sessionContextUsage } from "../sessions/context-usage.js";
import type { Session } from "../sessions/types.js";

describe("context limit", () => {
  it("defaults to 150k tokens and can be turned off", () => {
    expect(configSchema.parse({}).engines.contextLimitTokens).toBe(150_000);
    expect(configSchema.parse({ engines: { contextLimitTokens: 0 } }).engines.contextLimitTokens).toBe(0);
  });

  it("sets Claude Code's auto-compact window, no lower than Claude Code accepts", () => {
    expect(claudeContextLimitEnv(150_000)).toEqual({ CLAUDE_CODE_AUTO_COMPACT_WINDOW: "150000" });
    expect(claudeContextLimitEnv(40_000)).toEqual({ CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(CLAUDE_MIN_AUTO_COMPACT_WINDOW) });
    expect(claudeContextLimitEnv(0)).toEqual({});
    expect(claudeContextLimitEnv(undefined)).toEqual({});
  });

  it("sets Codex's auto-compact limit ahead of the exec subcommand", () => {
    const base = { binary: "codex", prompt: "", extraArgs: [], sandbox: "danger-full-access", approvalPolicy: "never" } as const;
    const { args } = buildCodexSpawnArgs({ ...base, extraArgs: [], autoCompactTokens: 150_000 });
    const at = args.indexOf("model_auto_compact_token_limit=150000");
    expect(args[at - 1]).toBe("-c");
    expect(at).toBeLessThan(args.indexOf("exec"));
    expect(buildCodexSpawnArgs({ ...base, extraArgs: [], autoCompactTokens: 0 }).args.join(" ")).not.toContain("auto_compact");
    expect(buildCodexSpawnArgs({ ...base, extraArgs: [] }).args.join(" ")).not.toContain("auto_compact");
  });

  const makeSession = (usage: Session["usage"]): Session => ({
    sessionId: "s-1",
    chatId: "42",
    channelType: "telegram",
    activeEngine: "claude",
    createdAt: 0,
    lastActiveAt: 0,
    isActive: true,
    sessionNum: 1,
    turns: [],
    usage,
  });

  it("reports the context size against the limit for the engine that measured it", () => {
    const session = makeSession({ contextTokens: 25_600, contextEngine: "claude" });
    const usage = sessionContextUsage(session, 150_000);
    expect(usage).toEqual({ tokens: 25_600, limit: 150_000, percent: 17 });
    expect(formatContextUsage(usage!)).toBe("Context 25.6k / 150k · 17%");
    expect(formatContextUsage(sessionContextUsage(session, undefined)!)).toBe("Context 25.6k");
    expect(formatContextUsage({ tokens: 1_250_000, limit: 2_000_000, percent: 63 })).toBe("Context 1.3M / 2M · 63%");

    // A size left by another engine, or none at all, is not shown
    session.activeEngine = "codex";
    expect(sessionContextUsage(session, 150_000)).toBeNull();
    expect(sessionContextUsage(makeSession(undefined), 150_000)).toBeNull();
    expect(sessionContextUsage(makeSession({ contextTokens: 25_600 }), 150_000)).toBeNull();
  });

  const makeTracker = (type: "telegram" | "discord") => {
    const channel = { type, send: vi.fn(async (_msg: any) => "m1"), editMessage: vi.fn(async () => {}), deleteMessage: vi.fn(async () => {}) };
    return { channel, tracker: new ProgressTracker(channel as any, "42", "101") };
  };

  it("sets the footer as subtext on Discord, also after a mention and through message splitting", async () => {
    const { channel, tracker } = makeTracker("discord");
    await tracker.finish("Done.\n- item", undefined, { footer: "Context 25.6k / 150k · 17%", mention: { id: "7", name: "Al" } });
    const text = channel.send.mock.calls[0][0].text;
    expect(text).toBe("<@7>\nDone.\n- item\n-# Context 25.6k / 150k · 17%");
    expect(prepareDiscordText(text).at(-1)!.endsWith("\n-# Context 25.6k / 150k · 17%")).toBe(true);
  });

  it("sets the footer in italics on Telegram, and leaves replies without one as they were", async () => {
    const { channel, tracker } = makeTracker("telegram");
    await tracker.finish("**Done** <ok>", undefined, { footer: "Context 25.6k / 150k · 17%" });
    expect(channel.send.mock.calls[0][0]).toMatchObject({
      text: "<b>Done</b> &lt;ok&gt;\n\n<i>Context 25.6k / 150k · 17%</i>",
      parseMode: "HTML",
      plainFallback: "Done <ok>\n\nContext 25.6k / 150k · 17%",
    });

    const plain = makeTracker("telegram");
    await plain.tracker.finish("Done");
    expect(plain.channel.send.mock.calls[0][0].text).toBe("Done");
  });
});
