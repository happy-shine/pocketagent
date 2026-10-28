import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import {
  botMemoryDir,
  chatMemoryDir,
  deleteMemoryFile,
  isMemoryFileName,
  listMemoryFiles,
  loadMemorySnapshot,
  MAX_INDEX_BYTES,
  MAX_INDEX_LINES,
  parseFrontmatter,
  readIndex,
  readMemoryFile,
  redactSecrets,
  truncateIndex,
} from "../memory/store.js";
import { buildMemoryPrompt, markMemorySeen, takeMemoryUpdate } from "../memory/prompt.js";
import { buildSystemPromptParts } from "../engines/prompt.js";
import { buildCodexSpawnArgs } from "../engines/codex/parser.js";
import { ClaudeEngineAdapter } from "../engines/claude/adapter.js";
import { CodexEngineAdapter } from "../engines/codex/adapter.js";
import { AgyEngineAdapter } from "../engines/agy/adapter.js";
import { ApiServer } from "../api/server.js";
import type { EngineEvent, EngineRuntimeConfig } from "../engines/types.js";
import type { Session } from "../sessions/types.js";

const log = pino({ level: "silent" });

const makeSession = (over: Partial<Session> = {}): Session => ({
  sessionId: "s1",
  chatId: "-1001234",
  channelType: "telegram",
  activeEngine: "claude",
  createdAt: Date.now(),
  lastActiveAt: Date.now(),
  isActive: true,
  sessionNum: 1,
  turns: [],
  ...over,
});

const memoryFile = (name: string, type: string, body: string) =>
  `---\nname: ${name}\ndescription: about ${name}\ntype: ${type}\n---\n\n${body}\n`;

const drain = async (gen: AsyncGenerator<EngineEvent>) => {
  const events: EngineEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
};

describe("memory store", () => {
  let root: string;
  const owner = { botId: "bot1", chatId: "-1001234", channelType: "telegram" };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pa-memory-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("keeps one store per bot and one per chat, named after the platform and chat id", () => {
    expect(botMemoryDir(root, "bot1")).toBe(join(root, "bot1", "bot"));
    expect(chatMemoryDir(root, "bot1", "telegram", "-1001234")).toBe(join(root, "bot1", "chats", "telegram--1001234"));
    expect(chatMemoryDir(root, "bot1", "discord", "../../etc")).toBe(join(root, "bot1", "chats", "discord-______etc"));
  });

  it("creates both directories and fingerprints the indexes", () => {
    const first = loadMemorySnapshot(root, owner);
    expect(existsSync(first.chat.dir)).toBe(true);
    expect(existsSync(first.bot.dir)).toBe(true);
    expect(first.chat.index.text).toBe("");
    expect(loadMemorySnapshot(root, owner).fingerprint).toBe(first.fingerprint);

    writeFileSync(join(first.bot.dir, "MEMORY.md"), "- [Owner](owner.md) — prefers terse answers\n");
    const second = loadMemorySnapshot(root, owner);
    expect(second.bot.index.text).toContain("prefers terse answers");
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it("cuts the index at the line limit, then at the byte limit on a line break, and says so", () => {
    const many = Array.from({ length: MAX_INDEX_LINES + 50 }, (_, i) => `- [m${i}](m${i}.md) — hook`).join("\n");
    const byLines = truncateIndex(many);
    expect(byLines.truncated).toBe(true);
    expect(byLines.text).toContain(`m${MAX_INDEX_LINES - 1}.md`);
    expect(byLines.text).not.toContain(`m${MAX_INDEX_LINES}.md`);
    expect(byLines.text).toContain("WARNING: MEMORY.md is 250 lines");

    const wide = Array.from({ length: 100 }, (_, i) => `- line ${i} ${"x".repeat(400)}`).join("\n");
    const byBytes = truncateIndex(wide);
    expect(byBytes.truncated).toBe(true);
    const kept = byBytes.text.split("\n\n> WARNING")[0];
    expect(Buffer.byteLength(kept)).toBeLessThanOrEqual(MAX_INDEX_BYTES);
    expect(kept.endsWith("x")).toBe(true);

    expect(truncateIndex("- [a](a.md) — hook\n").truncated).toBe(false);
  });

  it("redacts credentials that slipped into memory", () => {
    const token = "123456789:AAH" + "a".repeat(32);
    const { text, found } = redactSecrets(`bot token ${token} and key sk-ant-api03-${"b".repeat(40)}`);
    expect(found).toBe(2);
    expect(text).not.toContain(token);
    expect(text).toContain("[REDACTED]");
    expect(redactSecrets("nothing secret, ticket 12345:abc").found).toBe(0);
  });

  it("reads frontmatter and lists memories, newest first, without the index or other files", () => {
    const dir = botMemoryDir(root, "bot1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "MEMORY.md"), "- [A](a.md) — a\n");
    writeFileSync(join(dir, "a.md"), memoryFile("a", "user", "Alice is a quant."));
    writeFileSync(join(dir, "notes.txt"), "not a memory");
    writeFileSync(join(dir, "plain.md"), "no frontmatter");

    expect(parseFrontmatter(memoryFile("x", "feedback", "body"))).toEqual({ name: "x", description: "about x", type: "feedback" });
    const files = listMemoryFiles(dir);
    expect(files.map((f) => f.file).sort()).toEqual(["a.md", "plain.md"]);
    expect(files.find((f) => f.file === "a.md")).toMatchObject({ name: "a", type: "user" });
  });

  it("refuses names that leave the store and files that are symlinks", () => {
    for (const bad of ["../x.md", "a/b.md", "．．／x.md", ".hidden.md", "x.txt", "MEMORY.md/.."]) {
      expect(isMemoryFileName(bad)).toBe(false);
    }
    expect(isMemoryFileName("user_role.md")).toBe(true);

    const dir = chatMemoryDir(root, "bot1", "telegram", "1");
    mkdirSync(dir, { recursive: true });
    const outside = join(root, "secret.txt");
    writeFileSync(outside, "outside content");
    symlinkSync(outside, join(dir, "MEMORY.md"));
    symlinkSync(outside, join(dir, "link.md"));
    expect(readIndex(dir).text).toBe("");
    expect(readMemoryFile(dir, "link.md")).toBeNull();
    expect(readMemoryFile(dir, "../secret.txt")).toBeNull();
    expect(listMemoryFiles(dir)).toEqual([]);
    expect(deleteMemoryFile(dir, "link.md")).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });

  it("deletes a memory together with its index line", () => {
    const dir = botMemoryDir(root, "bot1");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "MEMORY.md"), "- [A](a.md) — a\n- [B](b.md) — b\n");
    writeFileSync(join(dir, "a.md"), memoryFile("a", "user", "A"));
    writeFileSync(join(dir, "b.md"), memoryFile("b", "user", "B"));
    expect(deleteMemoryFile(dir, "a.md")).toBe(true);
    expect(existsSync(join(dir, "a.md"))).toBe(false);
    expect(readFileSync(join(dir, "MEMORY.md"), "utf-8")).toBe("- [B](b.md) — b\n");
    expect(deleteMemoryFile(dir, "a.md")).toBe(false);
  });
});

describe("memory prompt", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pa-memory-prompt-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("explains both stores and shows their indexes; bot memory is read-only in groups", () => {
    const owner = { botId: "bot1", chatId: "42", channelType: "telegram" };
    writeFileSync(join(loadMemorySnapshot(root, owner).chat.dir, "MEMORY.md"), "- [Deadline](deadline.md) — ship on 2026-11-01\n");
    const direct = buildMemoryPrompt(loadMemorySnapshot(root, owner));
    expect(direct).toContain(chatMemoryDir(root, "bot1", "telegram", "42"));
    expect(direct).toContain(botMemoryDir(root, "bot1"));
    expect(direct).toContain("ship on 2026-11-01");
    expect(direct).toContain("type: user | feedback | project | reference");
    expect(direct).not.toContain("read-only");

    const group = buildMemoryPrompt(loadMemorySnapshot(root, { ...owner, chatId: "-100", isGroup: true }));
    expect(group).toContain("bot memory is read-only here");
  });

  it("goes last in the system prompt, and only when memory is on", () => {
    const base = { agentsDir: join(root, "agents"), botId: "bot1", apiPort: 1, chatId: "42", isGroup: false };
    const memory = loadMemorySnapshot(root, { botId: "bot1", chatId: "42", channelType: "telegram" });
    const parts = buildSystemPromptParts({ ...base, memory });
    expect(parts[parts.length - 1]).toMatch(/^## Long-term memory/);
    expect(buildSystemPromptParts(base).some((p) => p.includes("Long-term memory"))).toBe(false);
  });

  it("passes a change on once per engine, and the whole section to a conversation that never had it", () => {
    const session = makeSession({ chatId: "42" });
    const chatDir = chatMemoryDir(root, "bot1", "telegram", "42");

    const first = takeMemoryUpdate(root, "bot1", session, "codex");
    expect(first).toContain("[PocketAgent: long-term memory]");
    expect(first).toContain("## Long-term memory");
    expect(takeMemoryUpdate(root, "bot1", session, "codex")).toBeNull();

    writeFileSync(join(chatDir, "MEMORY.md"), "- [Pref](pref.md) — answers in Chinese\n");
    const update = takeMemoryUpdate(root, "bot1", session, "codex");
    expect(update).toContain("[PocketAgent: memory update]");
    expect(update).toContain("answers in Chinese");
    expect(update).not.toContain("## Long-term memory");
    expect(takeMemoryUpdate(root, "bot1", session, "codex")).toBeNull();

    // Each engine keeps its own conversation, so each is told
    markMemorySeen(session, "grok", loadMemorySnapshot(root, { botId: "bot1", chatId: "42", channelType: "telegram" }));
    expect(takeMemoryUpdate(root, "bot1", session, "grok")).toBeNull();
    expect(takeMemoryUpdate(undefined, "bot1", session, "grok")).toBeNull();
  });
});

describe("engines with the shared memory", () => {
  let dir: string;
  let memoryDir: string;
  let callLog: string;

  const runtime = (type: EngineRuntimeConfig["type"], binary: string, over: Partial<EngineRuntimeConfig> = {}): EngineRuntimeConfig => ({
    type,
    binary,
    extraArgs: [],
    maxProcesses: 4,
    idleTimeoutMs: 60_000,
    workspaceDir: join(dir, "workspaces"),
    apiPort: 0,
    agentsDir: join(dir, "agents"),
    memoryDir,
    ...over,
  });
  const fake = (name: string, source: string) => {
    const path = join(dir, name);
    writeFileSync(path, source);
    chmodSync(path, 0o755);
    return path;
  };
  const calls = () => readFileSync(callLog, "utf-8").trim().split("\n").map((l) => JSON.parse(l));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-memory-engines-"));
    memoryDir = join(dir, "memory");
    callLog = join(dir, "calls.log");
    process.env.FAKE_CLI_LOG = callLog;
  });
  afterEach(() => {
    delete process.env.FAKE_CLI_LOG;
    rmSync(dir, { recursive: true, force: true });
  });

  // Stream-json CLI (Claude Code): logs argv, the memory switch and each prompt
  const FAKE_CLAUDE = String.raw`#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const readline = require("node:readline");
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const msg = JSON.parse(line);
  appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify({
    args: process.argv.slice(2), autoMemoryOff: process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY ?? null, prompt: msg.message.content,
  }) + "\n");
  out({ type: "system", subtype: "init", session_id: "claude-1" });
  out({ type: "result", result: "ok", is_error: false });
});
`;

  it("Claude: memory in CLAUDE.md, its own auto memory off, a later change passed on", async () => {
    const adapter = new ClaudeEngineAdapter(runtime("claude", fake("claude", FAKE_CLAUDE)), log);
    const session = makeSession({ chatId: "42" });
    try {
      await drain(adapter.sendMessage(session, "hello", "bot1"));
      const chatDir = chatMemoryDir(memoryDir, "bot1", "telegram", "42");
      const claudeMd = readFileSync(join(adapter.getWorkspaceDir("s1")!, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toContain("## Long-term memory");
      expect(claudeMd).toContain(chatDir);

      const [first] = calls();
      expect(first.autoMemoryOff).toBe("1");
      const settings = JSON.parse(first.args[first.args.indexOf("--settings") + 1]);
      expect(settings).toMatchObject({ autoMemoryEnabled: false, autoDreamEnabled: false });
      expect(settings.hooks).toBeDefined();
      expect(first.args).toEqual(expect.arrayContaining(["--add-dir", chatDir, botMemoryDir(memoryDir, "bot1")]));
      expect(first.prompt).toBe("hello");

      // Another engine or session saves a memory while this process keeps running
      writeFileSync(join(chatDir, "MEMORY.md"), "- [Role](role.md) — the user trades futures\n");
      await drain(adapter.sendMessage(session, "next", "bot1"));
      const second = calls()[1].prompt as string;
      expect(second).toMatch(/^\[PocketAgent: memory update\]/);
      expect(second).toContain("the user trades futures");
      expect(second.endsWith("next")).toBe(true);

      await drain(adapter.sendMessage(session, "third", "bot1"));
      expect(calls()[2].prompt).toBe("third");
    } finally {
      await adapter.shutdown();
    }
  });

  it("Claude: memory off leaves the prompt alone; nativeEngineMemory leaves Claude's own memory on", async () => {
    const adapter = new ClaudeEngineAdapter(
      runtime("claude", fake("claude", FAKE_CLAUDE), { memoryDir: undefined, nativeMemory: true }),
      log,
    );
    try {
      await drain(adapter.sendMessage(makeSession(), "hello", "bot1"));
      const [call] = calls();
      expect(call.autoMemoryOff).toBeNull();
      expect(call.args).not.toContain("--add-dir");
      expect(JSON.parse(call.args[call.args.indexOf("--settings") + 1]).autoMemoryEnabled).toBeUndefined();
      expect(readFileSync(join(adapter.getWorkspaceDir("s1")!, "CLAUDE.md"), "utf-8")).not.toContain("Long-term memory");
      expect(existsSync(memoryDir)).toBe(false);
    } finally {
      await adapter.shutdown();
    }
  });

  // `codex exec [resume <id>] ... -`: one process per turn, prompt on stdin
  const FAKE_CODEX = String.raw`#!/usr/bin/env node
const { appendFileSync, readFileSync } = require("node:fs");
const prompt = readFileSync(0, "utf-8");
appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify({ args: process.argv.slice(2), prompt }) + "\n");
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
out({ type: "thread.started", thread_id: "thread-1" });
out({ type: "item.completed", item: { type: "agent_message", text: "ok" } });
out({ type: "turn.completed" });
`;

  it("Codex: memories feature off, memory in the first prompt, a change passed to the resumed thread", async () => {
    const adapter = new CodexEngineAdapter(runtime("codex", fake("codex", FAKE_CODEX)), log);
    const session = makeSession({ chatId: "42", activeEngine: "codex" });
    try {
      await drain(adapter.sendMessage(session, "hello", "bot1"));
      const [first] = calls();
      expect(first.args.slice(0, first.args.indexOf("exec"))).toEqual(expect.arrayContaining(["--disable", "memories"]));
      expect(first.prompt).toContain("<pocketagent-system>");
      expect(first.prompt).toContain("## Long-term memory");
      expect(first.prompt).not.toContain("[PocketAgent: memory update]");

      await drain(adapter.sendMessage(session, "again", "bot1"));
      expect(calls()[1].args).toEqual(expect.arrayContaining(["resume", "thread-1"]));
      expect(calls()[1].prompt).toBe("again");

      writeFileSync(join(botMemoryDir(memoryDir, "bot1"), "MEMORY.md"), "- [Grafana](grafana.md) — dashboards live at grafana.internal\n");
      await drain(adapter.sendMessage(session, "third", "bot1"));
      expect(calls()[2].prompt).toContain("dashboards live at grafana.internal");
    } finally {
      await adapter.shutdown();
    }
  });

  it("Codex: a workspace-write sandbox can still write the memory", () => {
    const { args } = buildCodexSpawnArgs({
      binary: "codex",
      prompt: "",
      extraArgs: [],
      sandbox: "workspace-write",
      approvalPolicy: "never",
      writableDirs: ["/m/chat", "/m/bot"],
    });
    expect(args).toContain('sandbox_workspace_write.writable_roots=["/m/chat","/m/bot"]');
    const full = buildCodexSpawnArgs({ binary: "codex", prompt: "", extraArgs: [], sandbox: "danger-full-access", approvalPolicy: "never", nativeMemory: true });
    expect(full.args).not.toContain("--disable");
    expect(full.args.join(" ")).not.toContain("writable_roots");
  });

  const FAKE_AGY = String.raw`#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const readline = require("node:readline");
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const msg = JSON.parse(line);
  appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify({ args: process.argv.slice(2), prompt: msg.message.content }) + "\n");
  out({ event: "init", conversation_id: "conv-1" });
  out({ event: "result", result: { conversation_id: "conv-1", status: "SUCCESS", response: "ok" } });
});
`;

  it("Antigravity: memory in the AGENTS.md rules and its directories in the workspace", async () => {
    const adapter = new AgyEngineAdapter(runtime("agy", fake("agy", FAKE_AGY)), log);
    const session = makeSession({ chatId: "42", activeEngine: "agy", channelType: "discord" });
    try {
      await drain(adapter.sendMessage(session, "hello", "bot1"));
      const chatDir = chatMemoryDir(memoryDir, "bot1", "discord", "42");
      const rules = readFileSync(join(adapter.getWorkspaceDir("s1")!, "AGENTS.md"), "utf-8");
      expect(rules).toContain(chatDir);
      expect(calls()[0].args).toEqual(expect.arrayContaining(["--add-dir", chatDir]));
      expect(calls()[0].prompt).toBe("hello");
    } finally {
      await adapter.shutdown();
    }
  });
});

describe("memory API", () => {
  let root: string;
  let server: ApiServer;
  let base: string;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "pa-memory-api-"));
    server = new ApiServer({ port: 0, getBotTelegram: () => undefined, dataDir: root, log, getMemoryDir: () => join(root, "memory") });
    await server.start();
    base = `http://127.0.0.1:${server.port}`;
    const snapshot = loadMemorySnapshot(join(root, "memory"), { botId: "bot1", chatId: "42", channelType: "telegram" });
    writeFileSync(join(snapshot.chat.dir, "MEMORY.md"), "- [Role](role.md) — quant\n");
    writeFileSync(join(snapshot.chat.dir, "role.md"), memoryFile("role", "user", "The user is a quant."));
  });
  afterEach(async () => {
    await server.stop();
    rmSync(root, { recursive: true, force: true });
  });

  it("lists, reads and deletes memories", async () => {
    const list = await (await fetch(`${base}/api/memory?bot_id=bot1&chat_id=42&channel=telegram`)).json();
    expect(list.chat.index).toContain("quant");
    expect(list.chat.files).toEqual([expect.objectContaining({ file: "role.md", type: "user" })]);
    expect(list.bot.files).toEqual([]);

    const query = "bot_id=bot1&chat_id=42&channel=telegram&scope=chat&file=role.md";
    const file = await (await fetch(`${base}/api/memory/file?${query}`)).json();
    expect(file.content).toContain("The user is a quant.");
    expect((await fetch(`${base}/api/memory/file?bot_id=bot1&chat_id=42&file=../../x.md`)).status).toBe(404);

    expect((await fetch(`${base}/api/memory/file?${query}`, { method: "DELETE" })).status).toBe(200);
    const after = await (await fetch(`${base}/api/memory?bot_id=bot1&chat_id=42&channel=telegram`)).json();
    expect(after.chat.files).toEqual([]);
    expect(after.chat.index).toBe("");
  });

  it("reports when memory is off", async () => {
    await server.stop();
    server = new ApiServer({ port: 0, getBotTelegram: () => undefined, dataDir: root, log, getMemoryDir: () => undefined });
    await server.start();
    expect((await fetch(`http://127.0.0.1:${server.port}/api/memory?bot_id=bot1`)).status).toBe(404);
  });
});
