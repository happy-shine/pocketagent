import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import pino from "pino";
import { ApiServer } from "../api/server.js";
import {
  agyHooks,
  answerSteerHook,
  canDeliver,
  claudeStyleHooks,
  decideFollowUp,
  hookResponse,
  steerHookCommand,
  steerHookUrl,
  STEER_URL_ENV,
  SteerMailbox,
  type SteerItem,
} from "../steer/steer.js";

const run = promisify(execFile);

const item = (sessionId: string, text: string, extra: Partial<SteerItem> = {}): SteerItem => ({
  sessionId,
  messageId: `m-${text}`,
  senderName: "Alice",
  text,
  ...extra,
});

describe("SteerMailbox", () => {
  it("hands each waiting message out once, per session", () => {
    const box = new SteerMailbox();
    box.push(item("s1", "a"));
    box.push(item("s1", "b"));
    box.push(item("s2", "c"));
    expect(box.pending("s1")).toBe(2);
    expect(box.drain("s1").map((i) => i.text)).toEqual(["a", "b"]);
    expect(box.drain("s1")).toEqual([]);
    expect(box.drain("s2").map((i) => i.text)).toEqual(["c"]);
  });
});

describe("decideFollowUp", () => {
  const turn = { turnSenderId: "u1", turnMessageIds: new Set(["trigger", "progress"]) };

  it("adds the turn starter's own messages to the turn", () => {
    expect(decideFollowUp({ ...turn, senderId: "u1" })).toBe("steer");
  });

  it("queues a different person's message", () => {
    expect(decideFollowUp({ ...turn, senderId: "u2" })).toBe("queue");
  });

  it("follows the reply target over the sender", () => {
    expect(decideFollowUp({ ...turn, senderId: "u2", replyToMessageId: "progress" })).toBe("steer");
    expect(decideFollowUp({ ...turn, senderId: "u1", replyToMessageId: "old-message" })).toBe("queue");
  });
});

describe("canDeliver", () => {
  it("delivers on Grok's turn end only, not its session-end stop", () => {
    expect(canDeliver("grok", "Stop", { reason: "end_turn" })).toBe(true);
    expect(canDeliver("grok", "Stop", { reason: "shutdown" })).toBe(false);
    expect(canDeliver("grok", "PostToolUse", {})).toBe(true);
  });

  it("does not deliver when Antigravity stops on an error", () => {
    expect(canDeliver("agy", "Stop", { terminationReason: "ERROR" })).toBe(false);
    expect(canDeliver("agy", "Stop", { terminationReason: "MAX_STEPS_EXCEEDED" })).toBe(false);
    expect(canDeliver("agy", "Stop", { terminationReason: "NO_TOOL_CALL" })).toBe(true);
    expect(canDeliver("agy", "PreInvocation", {})).toBe(true);
  });

  it("keeps messages away from Claude subagents", () => {
    expect(canDeliver("claude", "PostToolUse", { agent_id: "a1" })).toBe(false);
    expect(canDeliver("claude", "PostToolUse", {})).toBe(true);
  });

  it("does not deliver to engines without steer hooks", () => {
    expect(canDeliver("codex", "PostToolUse", {})).toBe(false);
  });
});

describe("hookResponse", () => {
  it("speaks each engine's hook output format", () => {
    expect(hookResponse("claude", "PostToolUse", "hi")).toEqual({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "hi" },
    });
    expect(hookResponse("grok", "Stop", "hi")).toEqual({ decision: "block", reason: "hi" });
    expect(hookResponse("agy", "PreInvocation", "hi")).toEqual({ injectSteps: [{ userMessage: "hi" }] });
    expect(hookResponse("agy", "Stop", "hi")).toEqual({ decision: "continue", reason: "hi" });
  });
});

describe("hook configs", () => {
  it("registers the delivery points of each engine", () => {
    expect(Object.keys((claudeStyleHooks("claude") as any).hooks)).toEqual(["PostToolUse", "Stop"]);
    expect(Object.keys((agyHooks() as any)["pocketagent-steer"])).toEqual(["PreInvocation", "Stop"]);
  });
});

describe("answerSteerHook", () => {
  it("delivers the session's messages once and reports them delivered", () => {
    const box = new SteerMailbox();
    const onDelivered = vi.fn();
    box.push(item("s1", "use python instead", { onDelivered }));
    const first = answerSteerHook(box, "claude", "PostToolUse", "s1", {});
    const context = (first.output as any).hookSpecificOutput.additionalContext as string;
    expect(context).toContain("use python instead");
    expect(context).toContain("[PocketAgent: new chat message");
    expect(onDelivered).toHaveBeenCalledOnce();
    expect(answerSteerHook(box, "claude", "PostToolUse", "s1", {}).output).toEqual({});
  });

  it("holds an Antigravity stop off so the next model call delivers the message as the user's", () => {
    const box = new SteerMailbox();
    box.push(item("s1", "one more thing"));
    expect(answerSteerHook(box, "agy", "Stop", "s1", { terminationReason: "NO_TOOL_CALL" }).output).toEqual({ decision: "continue" });
    expect(box.pending("s1")).toBe(1);
    const next = answerSteerHook(box, "agy", "PreInvocation", "s1", {});
    expect((next.output as any).injectSteps[0].userMessage).toContain("one more thing");
  });

  it("falls back to the stop reason when no model call follows a held-off Antigravity stop", () => {
    const box = new SteerMailbox();
    box.push(item("s1", "one more thing"));
    answerSteerHook(box, "agy", "Stop", "s1", { terminationReason: "NO_TOOL_CALL" });
    const second = answerSteerHook(box, "agy", "Stop", "s1", { terminationReason: "NO_TOOL_CALL" });
    expect((second.output as any).decision).toBe("continue");
    expect((second.output as any).reason).toContain("one more thing");
    expect(box.pending("s1")).toBe(0);
  });

  it("keeps a message away from an Antigravity subagent's conversation", () => {
    const box = new SteerMailbox();
    box.push(item("s1", "use the avatar"));
    expect(answerSteerHook(box, "agy", "PreInvocation", "s1", { conversationId: "sub" }, "main").output).toEqual({});
    expect(box.pending("s1")).toBe(1);
    const main = answerSteerHook(box, "agy", "PreInvocation", "s1", { conversationId: "main" }, "main");
    expect((main.output as any).injectSteps[0].userMessage).toContain("use the avatar");
  });

  it("asks the agent to answer a question in the message right away", () => {
    const box = new SteerMailbox();
    box.push(item("s1", "how far along are you?"));
    const text = (answerSteerHook(box, "claude", "PostToolUse", "s1", {}).output as any).hookSpecificOutput.additionalContext;
    expect(text).toContain("answer it now");
    expect(text).toContain("before your next tool call");
  });

  it("keeps messages for a stop where they cannot be delivered", () => {
    const box = new SteerMailbox();
    box.push(item("s1", "later"));
    expect(answerSteerHook(box, "grok", "Stop", "s1", { reason: "shutdown" }).output).toEqual({});
    expect(box.pending("s1")).toBe(1);
  });
});

describe("steer hook command", () => {
  let dir: string;
  let server: ApiServer;
  let port: number;
  const box = new SteerMailbox();

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "pa-steer-"));
    port = 20000 + Math.floor(Math.random() * 20000);
    server = new ApiServer({
      port,
      getBotTelegram: () => undefined,
      dataDir: dir,
      log: pino({ level: "silent" }),
      steerHook: (engine, event, sessionId, payload) => answerSteerHook(box, engine, event, sessionId, payload).output,
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  // Runs the hook command the way the CLIs do: through sh, with the hook input on stdin
  const runHook = async (engine: "claude" | "grok" | "agy", event: string, env: Record<string, string>, input = "{}") => {
    const pending = run("sh", ["-c", steerHookCommand(engine, event)], { env: { PATH: process.env.PATH ?? "", ...env } });
    pending.child.stdin?.end(input);
    const { stdout } = await pending;
    return JSON.parse(stdout);
  };

  it("relays the waiting message through the gateway", async () => {
    box.push(item("sess-1", "also run the tests"));
    const out = await runHook("agy", "PreInvocation", {
      [STEER_URL_ENV]: steerHookUrl(port),
      POCKETAGENT_SESSION_ID: "sess-1",
    });
    expect(out.injectSteps[0].userMessage).toContain("also run the tests");
  });

  it("passes the hook input on, so session-end stops are told apart", async () => {
    box.push(item("sess-2", "wait"));
    const env = { [STEER_URL_ENV]: steerHookUrl(port), POCKETAGENT_SESSION_ID: "sess-2" };
    expect(await runHook("grok", "Stop", env, '{"reason":"shutdown"}')).toEqual({});
    expect((await runHook("grok", "Stop", env, '{"reason":"end_turn"}')).decision).toBe("block");
  });

  it("does nothing outside PocketAgent or when the gateway is down", async () => {
    expect(await runHook("claude", "PostToolUse", {})).toEqual({});
    expect(await runHook("claude", "PostToolUse", { [STEER_URL_ENV]: "http://127.0.0.1:1/api/steer/hook" })).toEqual({});
  });
});
