import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pino from "pino";
import { parseConfig } from "../config/loader.js";
import { GrokEngineAdapter } from "../engines/grok/adapter.js";
import { discoverGrokCapabilities, parseGrokModelsOutput } from "../engines/grok/discovery.js";
import { buildGrokSpawnArgs, GrokEventMapper } from "../engines/grok/parser.js";
import type { EngineEvent } from "../engines/types.js";
import type { Session } from "../sessions/types.js";

describe("Grok stream parser", () => {
  it("builds spawn args for a new session with rules, model, and effort", () => {
    const { cmd, args } = buildGrokSpawnArgs({
      binary: "grok",
      promptFile: "/tmp/p.md",
      newSessionId: "11111111-1111-1111-1111-111111111111",
      rules: "SYSTEM",
      model: "grok-4.7",
      effort: "high",
      extraArgs: ["--disable-web-search"],
    });
    expect(cmd).toBe("grok");
    expect(args).toEqual([
      "--prompt-file", "/tmp/p.md",
      "--output-format", "streaming-json",
      "--always-approve",
      "--session-id", "11111111-1111-1111-1111-111111111111",
      "--rules", "SYSTEM",
      "--model", "grok-4.7",
      "--reasoning-effort", "high",
      "--disable-web-search",
    ]);
  });

  it("resumes without re-sending session id or rules", () => {
    const { args } = buildGrokSpawnArgs({
      binary: "grok",
      promptFile: "/tmp/p.md",
      resumeSessionId: "abc",
      newSessionId: "ignored",
      rules: "SYSTEM",
      extraArgs: [],
    });
    expect(args).toContain("--resume");
    expect(args).toContain("abc");
    expect(args).not.toContain("--session-id");
    expect(args).not.toContain("--rules");
  });

  it("maps streaming-json events to engine events", () => {
    const mapper = new GrokEventMapper();
    const events = [
      { type: "available_commands", tools: [] },
      { type: "thought", data: "The" },
      { type: "thought", data: " user" },
      { type: "text", data: "Hi" },
      {
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "run_terminal_command",
        rawInput: { command: "ls", description: "List files" },
      },
      { type: "tool_call_update", toolCallId: "call-1", status: "completed" },
      { type: "thought", data: "Done" },
      { type: "usage", usage: {} },
      { type: "end", stopReason: "end_turn", sessionId: "sess-1" },
    ].flatMap((e) => mapper.map(e));

    expect(events).toEqual([
      { type: "thinking_started" },
      { type: "text", text: "Hi" },
      { type: "tool_started", name: "Bash", detail: "ls" },
      { type: "thinking_started" },
      { type: "session_started", sessionId: "sess-1" },
      { type: "result", isError: false },
    ]);
  });

  it("maps error events to an error result", () => {
    const events = new GrokEventMapper().map({ type: "error", message: "unknown model id" });
    expect(events).toEqual([
      { type: "error", message: "unknown model id" },
      { type: "result", result: "unknown model id", isError: true },
    ]);
  });
});

describe("Grok capabilities discovery", () => {
  let grokHome: string;
  const prevGrokHome = process.env.GROK_HOME;

  beforeEach(() => {
    grokHome = mkdtempSync(join(tmpdir(), "pa-grok-home-"));
    process.env.GROK_HOME = grokHome;
  });

  afterEach(() => {
    if (prevGrokHome === undefined) delete process.env.GROK_HOME;
    else process.env.GROK_HOME = prevGrokHome;
    rmSync(grokHome, { recursive: true, force: true });
  });

  it("parses `grok models` text output", () => {
    const parsed = parseGrokModelsOutput(
      "You are logged in with grok.com.\n\nDefault model: grok-4.7\n\nAvailable models:\n  * grok-4.7 (default)\n    grok-build\n",
    );
    expect(parsed.defaultModel).toBe("grok-4.7");
    expect(parsed.ids).toEqual(["grok-4.7", "grok-build"]);
  });

  it("reads models and efforts from models_cache.json when the CLI is unavailable", async () => {
    writeFileSync(join(grokHome, "models_cache.json"), JSON.stringify({
      models: {
        "grok-4.7": {
          info: {
            name: "Grok 4.7",
            description: "Frontier model",
            reasoning_effort: "high",
            supports_reasoning_effort: true,
            reasoning_efforts: [
              { id: "xhigh", value: "xhigh", label: "Extra High", default: false },
              { id: "high", value: "high", label: "High", default: true },
              { id: "low", value: "low", label: "Low", default: false },
            ],
          },
        },
        "grok-internal": { info: { name: "Hidden", hidden: true } },
      },
    }));

    const caps = await discoverGrokCapabilities("/nonexistent/grok-binary", [
      { id: "my-grok", label: "My Grok" },
    ], true);

    expect(caps.models.map((m) => m.id)).toEqual(["my-grok", "grok-4.7"]);
    const grok = caps.models.find((m) => m.id === "grok-4.7");
    expect(grok?.label).toBe("Grok 4.7");
    expect(grok?.isDefault).toBe(true);
    expect(grok?.defaultEffort).toBe("high");
    expect(grok?.supportedEfforts?.map((e) => e.id)).toEqual(["xhigh", "high", "low"]);
    expect(caps.efforts.map((e) => e.id)).toContain("xhigh");
    expect(caps.supportsEffort).toBe(true);
  });

  it("falls back to built-in models when nothing is discoverable", async () => {
    const caps = await discoverGrokCapabilities("/nonexistent/grok-binary", [], true);
    expect(caps.models.some((m) => m.id === "grok-4.7")).toBe(true);
    expect(caps.efforts.map((e) => e.id)).toEqual(["low", "medium", "high", "xhigh"]);
  });
});

describe("Grok engine adapter", () => {
  let testDir: string;
  let fakeGrok: string;
  let argvLog: string;

  // Fake `grok` CLI: logs argv + prompt, then emits streaming-json like the real one
  const FAKE_GROK = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const val = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const prompt = fs.readFileSync(val("--prompt-file"), "utf-8");
fs.appendFileSync(process.env.FAKE_GROK_LOG, JSON.stringify({ args, prompt }) + "\\n");
const resume = val("--resume");
if (resume === "missing-session") {
  process.stderr.write('Error: Failed to restore session from remote: 404 Not Found\\n');
  process.exit(1);
}
const sid = resume || val("--session-id");
const out = (e) => process.stdout.write(JSON.stringify(e) + "\\n");
out({ type: "available_commands", tools: [] });
out({ type: "thought", data: "hmm" });
out({ type: "tool_call", toolName: "read_file", rawInput: { path: "a.txt" } });
out({ type: "text", data: "Hello " });
out({ type: "text", data: "there" });
out({ type: "end", stopReason: "end_turn", sessionId: sid });
`;

  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    sessionId: "s1",
    chatId: "chat-1",
    channelType: "telegram",
    activeEngine: "grok",
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    isActive: true,
    sessionNum: 1,
    turns: [],
    ...overrides,
  });

  const makeAdapter = () => new GrokEngineAdapter({
    type: "grok",
    binary: fakeGrok,
    extraArgs: [],
    maxProcesses: 5,
    idleTimeoutMs: 60000,
    workspaceDir: join(testDir, "workspaces"),
    apiPort: 18790,
    agentsDir: join(testDir, "agents"),
  }, pino({ level: "silent" }));

  const collect = async (gen: AsyncGenerator<EngineEvent>) => {
    const events: EngineEvent[] = [];
    for await (const ev of gen) events.push(ev);
    return events;
  };

  const loggedCalls = () => readFileSync(argvLog, "utf-8").trim().split("\n").map((l) => JSON.parse(l));

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "pa-grok-adapter-"));
    fakeGrok = join(testDir, "grok");
    argvLog = join(testDir, "argv.log");
    writeFileSync(fakeGrok, FAKE_GROK);
    chmodSync(fakeGrok, 0o755);
    process.env.FAKE_GROK_LOG = argvLog;
  });

  afterEach(() => {
    delete process.env.FAKE_GROK_LOG;
    rmSync(testDir, { recursive: true, force: true });
  });

  it("starts a new session with system rules, then resumes it", async () => {
    const adapter = makeAdapter();
    const session = makeSession();

    const first = await collect(adapter.sendMessage(session, "hi", "bot-1", undefined, { name: "Pocket", username: "pocket_bot" }));
    expect(session.grokSessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.filter((e) => e.type === "session_started")).toEqual([
      { type: "session_started", sessionId: session.grokSessionId },
    ]);
    expect(first).toContainEqual({ type: "thinking_started" });
    expect(first).toContainEqual({ type: "tool_started", name: "Read", detail: "a.txt" });
    expect(first.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("")).toBe("Hello there");
    expect(first.at(-1)).toEqual({ type: "result", isError: false });

    const sid = session.grokSessionId;
    session.turns.push({ id: "t1", ts: Date.now(), role: "assistant", engine: "grok", text: "Hello there" });
    await collect(adapter.sendMessage(session, "again", "bot-1"));
    expect(session.grokSessionId).toBe(sid);

    const [call1, call2] = loggedCalls();
    expect(call1.args).toContain("--session-id");
    expect(call1.args[call1.args.indexOf("--rules") + 1]).toContain("Pocket（@pocket_bot）");
    expect(call1.prompt).toBe("hi");
    expect(call2.args[call2.args.indexOf("--resume") + 1]).toBe(sid);
    expect(call2.args).not.toContain("--rules");
    expect(call2.prompt).toBe("again");
    expect(adapter.isBusy(session.sessionId)).toBe(false);

    // Prompt files are cleaned up after each turn
    for (const call of [call1, call2]) {
      expect(existsSync(call.args[call.args.indexOf("--prompt-file") + 1])).toBe(false);
    }
  });

  it("hands over context from other engines and ignores foreign models", async () => {
    const adapter = makeAdapter();
    const session = makeSession({
      model: "opus",
      lastEngine: "claude",
      turns: [
        { id: "t1", ts: 1, role: "user", text: "remember 42" },
        { id: "t2", ts: 2, role: "assistant", engine: "claude", text: "OK, 42" },
      ],
    });

    await collect(adapter.sendMessage(session, "what number?", "bot-1"));
    const [call] = loggedCalls();
    expect(call.prompt).toContain("[Context Handover Notice]");
    expect(call.prompt).toContain("OK, 42");
    expect(call.prompt.endsWith("what number?")).toBe(true);
    expect(call.args).not.toContain("--model");
  });

  it("starts fresh when the stored Grok session no longer exists", async () => {
    const adapter = makeAdapter();
    const session = makeSession({ grokSessionId: "missing-session" });

    const events = await collect(adapter.sendMessage(session, "hi", "bot-1"));
    expect(session.grokSessionId).not.toBe("missing-session");
    expect(session.grokSessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(events.at(-1)).toEqual({ type: "result", isError: false });

    const calls = loggedCalls();
    expect(calls).toHaveLength(2);
    expect(calls[1].args).toContain("--session-id");
  });

  it("reports a failed spawn as an error result", async () => {
    const adapter = makeAdapter();
    adapter.updateConfig({ binary: join(testDir, "does-not-exist") });
    const session = makeSession();

    const events = await collect(adapter.sendMessage(session, "hi", "bot-1"));
    const result = events.find((e) => e.type === "result");
    expect(result).toMatchObject({ type: "result", isError: true });
    expect(session.grokSessionId).toBeUndefined();
  });
});

describe("Grok config schema", () => {
  it("accepts grok as default engine with engine settings", () => {
    const config = parseConfig(`
defaultEngine: grok
engines:
  grok:
    binary: "/opt/grok"
    model: "grok-4.7"
    effort: "xhigh"
    extraArgs: ["--disable-web-search"]
bots:
  - name: "grok-bot"
    token: "333:CCC"
    engine: "grok"
`);
    expect(config.defaultEngine).toBe("grok");
    expect(config.engines.grok.binary).toBe("/opt/grok");
    expect(config.engines.grok.model).toBe("grok-4.7");
    expect(config.engines.grok.effort).toBe("xhigh");
    expect(config.engines.grok.extraArgs).toEqual(["--disable-web-search"]);
    expect(config.bots?.[0].engine).toBe("grok");
  });

  it("defaults the grok engine block when omitted", () => {
    const config = parseConfig(`defaultEngine: claude\n`);
    expect(config.engines.grok.binary).toBe("grok");
    expect(config.engines.grok.extraArgs).toEqual([]);
  });
});
