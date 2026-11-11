import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { AGY_MAX_RULE_FILE_BYTES, AGY_ROTATE_CONTEXT_TOKENS, AgyEngineAdapter, splitAgyRuleChunks } from "../engines/agy/adapter.js";
import type { EngineEvent } from "../engines/types.js";
import type { Session } from "../sessions/types.js";

// Stands in for `agy` in stream-json mode: logs its argv and each prompt, answers every prompt with one turn
// (except one containing HANG, which never ends).
// The context size it reports is read from the file FAKE_AGY_CONTEXT_FILE names, so a test can change it between turns.
const FAKE_AGY = `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const readline = require("node:readline");
const args = process.argv.slice(2);
const i = args.indexOf("--conversation");
const conversation = i >= 0 ? args[i + 1] : "conv-" + process.pid;
const out = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  appendFileSync(process.env.FAKE_AGY_LOG, JSON.stringify({ args, cwd: process.cwd(), prompt: msg.message.content }) + "\\n");
  out({ event: "init", conversation_id: conversation });
  // A turn that runs until it is stopped
  if (msg.message.content.includes("HANG")) {
    out({ event: "step_update", step_update: { step_index: 1, step_type: "tool", state: "ACTIVE", tool_name: "run_command" } });
    return;
  }
  const file = process.env.FAKE_AGY_CONTEXT_FILE;
  const context = Number(file && existsSync(file) ? readFileSync(file, "utf8") : "1000");
  out({ event: "step_update", step_update: { step_index: 1, step_type: "agent_response", state: "ACTIVE" } });
  out({ event: "step_update", step_update: { step_index: 1, step_type: "agent_response", state: "DONE", text_delta: "ok",
    usage: { input_tokens: 2000, cache_read_tokens: context - 2000, output_tokens: 150 } } });
  if (process.env.FAKE_AGY_RESULT_ERROR) {
    out({ event: "result", result: { conversation_id: conversation, status: "ERROR", error: process.env.FAKE_AGY_RESULT_ERROR, response: "ok" } });
  } else {
    out({ event: "result", result: { conversation_id: conversation, status: "SUCCESS", response: "ok" } });
  }
});
`;

describe("Antigravity adapter", () => {
  let testDir: string;
  let fakeAgy: string;
  let log: string;
  let contextFile: string;
  const setContext = (tokens: number) => writeFileSync(contextFile, String(tokens));

  const makeAdapter = () =>
    new AgyEngineAdapter(
      {
        type: "agy",
        binary: fakeAgy,
        extraArgs: [],
        maxProcesses: 5,
        idleTimeoutMs: 60000,
        workspaceDir: join(testDir, "workspaces"),
        apiPort: 18790,
        agentsDir: join(testDir, "agents"),
      },
      pino({ level: "silent" }),
    );

  const makeSession = (): Session => ({
    sessionId: "s-agy",
    chatId: "chat-1",
    channelType: "discord",
    activeEngine: "agy",
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    isActive: true,
    sessionNum: 1,
    turns: [],
  });

  const collect = async (gen: AsyncGenerator<EngineEvent>) => {
    const events: EngineEvent[] = [];
    for await (const ev of gen) events.push(ev);
    return events;
  };
  const calls = () => readFileSync(log, "utf-8").trim().split("\n").map((l) => JSON.parse(l));

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "pa-agy-adapter-"));
    fakeAgy = join(testDir, "agy");
    log = join(testDir, "calls.log");
    contextFile = join(testDir, "context");
    writeFileSync(fakeAgy, FAKE_AGY);
    chmodSync(fakeAgy, 0o755);
    process.env.FAKE_AGY_LOG = log;
    process.env.FAKE_AGY_CONTEXT_FILE = contextFile;
  });

  afterEach(() => {
    delete process.env.FAKE_AGY_LOG;
    delete process.env.FAKE_AGY_CONTEXT_FILE;
    rmSync(testDir, { recursive: true, force: true });
  });

  it("gives the system prompt as AGENTS.md rules only, not in the first message or a GEMINI.md copy", async () => {
    const adapter = makeAdapter();
    const session = makeSession();
    const workspace = join(testDir, "workspaces", "bot-1", "chat-1_s-agy");
    mkdirSync(workspace, { recursive: true });
    // A copy left by an earlier version is removed
    writeFileSync(join(workspace, "AGENTS.md"), "old rules");
    writeFileSync(join(workspace, "GEMINI.md"), "old rules");

    await collect(adapter.sendMessage(session, "hi", "bot-1", undefined, { name: "Atri", username: "atri" }));
    await adapter.shutdown();

    const rules = readFileSync(join(workspace, "AGENTS.md"), "utf-8");
    expect(rules).toContain("Atri（@atri）");
    expect(rules).toContain("## Working style");
    expect(existsSync(join(workspace, "GEMINI.md"))).toBe(false);
    expect(calls()[0].prompt).toBe("hi");
  });

  it("stops a running turn by ending the process, and resumes the conversation on the next turn", async () => {
    const adapter = makeAdapter();
    const session = makeSession();
    await collect(adapter.sendMessage(session, "one", "bot-1"));
    const conversation = session.agySessionId;
    // Between turns there is nothing to stop
    expect(adapter.sendControl(session.sessionId, { subtype: "interrupt" })).toBe(false);

    const events: EngineEvent[] = [];
    for await (const ev of adapter.sendMessage(session, "HANG", "bot-1")) {
      events.push(ev);
      if (ev.type === "tool_started") expect(adapter.sendControl(session.sessionId, { subtype: "interrupt" })).toBe(true);
    }
    expect(events.at(-1)).toEqual({ type: "result", result: "(Interrupted)", isError: false });
    expect(adapter.isBusy(session.sessionId)).toBe(false);

    await collect(adapter.sendMessage(session, "two", "bot-1"));
    await adapter.shutdown();
    const last = calls().at(-1);
    expect(last.prompt).toBe("two");
    expect(last.args).toContain("--conversation");
    expect(last.args[last.args.indexOf("--conversation") + 1]).toBe(conversation);
  });

  it("keeps a GEMINI.md it did not write", async () => {
    const adapter = makeAdapter();
    const workspace = join(testDir, "workspaces", "bot-1", "chat-1_s-agy");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "GEMINI.md"), "someone's own notes");
    await collect(adapter.sendMessage(makeSession(), "hi", "bot-1"));
    await adapter.shutdown();
    expect(readFileSync(join(workspace, "GEMINI.md"), "utf-8")).toBe("someone's own notes");
  });

  it("continues the conversation while it is small", async () => {
    const adapter = makeAdapter();
    const session = makeSession();
    await collect(adapter.sendMessage(session, "one", "bot-1"));
    const conversation = session.agySessionId;
    session.lastContextMessageId = "m1";
    await collect(adapter.sendMessage(session, "two", "bot-1"));
    await adapter.shutdown();

    expect(session.agySessionId).toBe(conversation);
    expect(session.lastContextMessageId).toBe("m1");
    // One process served both turns
    expect(new Set(calls().map((c) => JSON.stringify(c.args))).size).toBe(1);
  });

  it("starts a new conversation with a handover once the context grows large", async () => {
    const adapter = makeAdapter();
    const session = makeSession();
    await collect(adapter.sendMessage(session, "small", "bot-1"));
    session.lastContextMessageId = "m1";
    session.turns.push(
      { id: "t1", ts: Date.now(), role: "user", text: "big task" },
      { id: "t2", ts: Date.now(), role: "assistant", engine: "agy", text: "did the big task" },
    );

    // The turn that crosses the limit is not cut short; the switch happens when it ends
    setContext(AGY_ROTATE_CONTEXT_TOKENS + 1);
    const ended = await collect(adapter.sendMessage(session, "big task", "bot-1"));
    expect(ended.at(-1)).toEqual({ type: "result", result: "ok", isError: false });
    expect(session.agySessionId).toBeUndefined();
    expect(session.lastContextMessageId).toBeUndefined();
    expect(adapter.hasProcess(session.sessionId)).toBe(false);

    setContext(1000);
    await collect(adapter.sendMessage(session, "after", "bot-1"));
    await adapter.shutdown();
    const last = calls().at(-1);
    expect(last.args).not.toContain("--conversation");
    expect(last.prompt).toContain("[Context Handover Notice]");
    expect(last.prompt).toContain("did the big task");
    expect(last.prompt.endsWith("after")).toBe(true);
    expect(session.usage?.compactions).toBe(1);
    expect(session.usage?.lastCompactionPreTokens).toBe(AGY_ROTATE_CONTEXT_TOKENS + 1);
  });

  it("omits conflicting --effort when model ID already encodes tier (-low/-medium/-high)", async () => {
    const adapter = makeAdapter();
    const session = makeSession();
    session.model = "gemini-4-argon-medium";
    session.effort = "high";
    await collect(adapter.sendMessage(session, "hi", "bot-1"));
    await adapter.shutdown();
    const args = calls()[0].args;
    expect(args).toContain("--model");
    expect(args[args.indexOf("--model") + 1]).toBe("gemini-4-argon-medium");
    expect(args).not.toContain("--effort");
  });

  it("ignores historical result.error when the turn produced output and records usage", async () => {
    process.env.FAKE_AGY_RESULT_ERROR = "API error (attempt 1): request failed: stream idle timeout (5m0s): context deadline exceeded";
    try {
      const adapter = makeAdapter();
      const session = makeSession();
      const events = await collect(adapter.sendMessage(session, "upload video", "bot-1"));
      await adapter.shutdown();
      expect(events.some((e) => e.type === "error")).toBe(false);
      expect(events.at(-1)).toEqual({ type: "result", result: "ok", isError: false });
      expect(session.usage?.contextTokens).toBe(1000);
      expect(session.usage?.outputTokens).toBe(150);
    } finally {
      delete process.env.FAKE_AGY_RESULT_ERROR;
    }
  });

  it("prioritizes Long-term memory in AGENTS.md and spills excess rules into .agents/rules/pa-overflow-*.md under 23KB", () => {
    const identity = "你是 Atri（@atri）。";
    const soul = "# Soul\nBe concise.";
    const bigSkills = "## Available Custom Skills\n" + "x".repeat(18_000);
    const memoryPart = "## Long-term memory\n### Current memory\n- [no-decay](no-decay.md) — Never mention decay\n" + "m".repeat(8_000);
    const notes = "## Antigravity notes\n- Stay focused.";

    const chunks = splitAgyRuleChunks([identity, soul, bigSkills, memoryPart, notes]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf-8")).toBeLessThanOrEqual(AGY_MAX_RULE_FILE_BYTES);
    }
    expect(chunks[0]).toContain("## Long-term memory");
    expect(chunks[0]).toContain("Never mention decay");
    expect(chunks.slice(1).join("\n")).toContain("## Available Custom Skills");
  });
});
