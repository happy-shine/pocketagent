import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { AGY_ROTATE_CONTEXT_TOKENS, AgyEngineAdapter } from "../engines/agy/adapter.js";
import type { EngineEvent } from "../engines/types.js";
import type { Session } from "../sessions/types.js";

// Stands in for `agy` in stream-json mode: logs its argv and each prompt, answers every prompt with one turn.
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
  const file = process.env.FAKE_AGY_CONTEXT_FILE;
  const context = Number(file && existsSync(file) ? readFileSync(file, "utf8") : "1000");
  out({ event: "step_update", step_update: { step_index: 1, step_type: "agent_response", state: "ACTIVE" } });
  out({ event: "step_update", step_update: { step_index: 1, step_type: "agent_response", state: "DONE", text_delta: "ok",
    usage: { input_tokens: 2000, cache_read_tokens: context - 2000 } } });
  out({ event: "result", result: { conversation_id: conversation, status: "SUCCESS", response: "ok" } });
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
  });
});
