import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { ApiServer } from "../api/server.js";
import { MemoryError, MemoryStore, findSecret, parseFrontmatter } from "../memory/store.js";
import { getMemorySkill } from "../memory/prompt.js";
import { claudeMemoryDir, linkClaudeMemory } from "../memory/claude-link.js";
import { buildSystemPromptParts } from "../engines/prompt.js";

const memo = (name: string, description: string, extra = "") =>
  `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  type: reference\n${extra}---\n\nBody of ${name}.\n`;

describe("MemoryStore", () => {
  let root: string;
  let store: MemoryStore;
  const chat = { botId: "bot1", chatId: "chatA" };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pa-mem-"));
    store = new MemoryStore(root);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("creates a memory and rebuilds the scope index from its frontmatter", () => {
    expect(store.create("chat", chat, "koru-alias.md", memo("koru-alias", "扣肉 = KORU"))).toBe("koru-alias.md");
    const index = readFileSync(join(root, "chats", "chatA", "MEMORY.md"), "utf-8");
    expect(index).toBe("- [koru-alias](koru-alias.md) — 扣肉 = KORU\n");
    expect(store.view("chat", chat)).toContain("koru-alias.md\tkoru-alias — 扣肉 = KORU");
    expect(store.view("chat", chat, "/memories/koru-alias.md")).toContain("   8\tBody of koru-alias.");
  });

  it("keeps scopes and chats apart", () => {
    store.create("chat", chat, "a.md", memo("a", "in chat A"));
    store.create("owner", { botId: "bot1" }, "b.md", memo("b", "owner pref"));
    store.create("bot", { botId: "bot1" }, "c.md", memo("c", "bot lesson"));
    expect(store.list("chat", { botId: "bot1", chatId: "chatB" })).toEqual([]);
    expect(store.list("owner", { botId: "other-bot" }).map((e) => e.file)).toEqual(["b.md"]);
    expect(store.list("bot", { botId: "other-bot" })).toEqual([]);
  });

  it("edits with str_replace, insert and rename", () => {
    store.create("chat", chat, "x.md", memo("x", "first"));
    store.strReplace("chat", chat, "x.md", "description: first", "description: second");
    expect(store.list("chat", chat)[0].description).toBe("second");
    expect(() => store.strReplace("chat", chat, "x.md", "missing", "y")).toThrow(MemoryError);
    store.insert("chat", chat, "x.md", 0, "<!-- top -->");
    expect(readFileSync(join(root, "chats", "chatA", "x.md"), "utf-8").startsWith("<!-- top -->\n---")).toBe(true);
    store.rename("chat", chat, "x.md", "y.md");
    expect(store.list("chat", chat).map((e) => e.file)).toEqual(["y.md"]);
    expect(readFileSync(join(root, "chats", "chatA", "MEMORY.md"), "utf-8")).toContain("(y.md)");
  });

  it("deletes with a tombstone and drops the index line", () => {
    store.create("chat", chat, "gone.md", memo("gone", "obsolete fact"));
    store.delete("chat", chat, "gone.md", "obsolete");
    expect(store.list("chat", chat)).toEqual([]);
    const tomb = JSON.parse(readFileSync(join(root, ".tombstones.jsonl"), "utf-8").trim());
    expect(tomb).toMatchObject({ scope: "chat", chatId: "chatA", file: "gone.md", name: "gone", reason: "obsolete" });
  });

  it("refuses paths outside the scope, nested paths and the generated index", () => {
    expect(() => store.create("chat", chat, "../owner/evil.md", "x")).toThrow(MemoryError);
    expect(() => store.create("chat", chat, "sub/dir.md", "x")).toThrow(MemoryError);
    expect(() => store.create("chat", chat, "MEMORY.md", "x")).toThrow(/generated/);
    expect(() => store.scopeDir("chat", { botId: "bot1", chatId: "../x" })).toThrow(MemoryError);
    expect(() => store.scopeDir("chat", { botId: "bot1" })).toThrow(/chat_id/);
  });

  it("refuses credentials", () => {
    const fakeDiscord = `MT${"a".repeat(22)}.abcdef.${"b".repeat(30)}`;
    expect(findSecret(`token ${fakeDiscord}`)).toBe(true);
    expect(findSecret("Cookie: " + "x".repeat(40))).toBe(true);
    expect(findSecret("扣肉 = KORU，三倍做多韩国")).toBe(false);
    expect(() => store.create("chat", chat, "leak.md", `bot token ${fakeDiscord}`)).toThrow(/credential/);
    expect(existsSync(join(root, "chats", "chatA", "leak.md"))).toBe(false);
  });

  it("matches aliases for keyword recall", () => {
    store.create("chat", chat, "koru-alias.md", memo("koru-alias", "扣肉 = KORU", "  aliases: [扣肉, koru]\n"));
    store.create("chat", chat, "other.md", memo("other", "unrelated"));
    const hits = store.matchAliases("别急等我一手扣肉买崩韩国", [["chat", chat]]);
    expect(hits.map((h) => h.entry.file)).toEqual(["koru-alias.md"]);
    expect(store.matchAliases("nothing here", [["chat", chat]])).toEqual([]);
  });

  it("caps the index", () => {
    const small = new MemoryStore(root, { maxIndexLines: 2 });
    for (const n of ["a", "b", "c"]) small.create("chat", chat, `${n}.md`, memo(n, n));
    const index = readFileSync(join(root, "chats", "chatA", "MEMORY.md"), "utf-8").trim().split("\n");
    expect(index).toHaveLength(3);
    expect(index[2]).toContain("1 older");
  });

  it("parses Claude Code style frontmatter", () => {
    expect(parseFrontmatter(memo("n", "d", "  aliases: [\"扣肉\", 'koru']\n"))).toEqual({
      name: "n",
      description: "d",
      type: "reference",
      aliases: ["扣肉", "koru"],
    });
  });
});

describe("memory prompt", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pa-mem-prompt-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("puts the rules, the API and every scope's index in the prompt", () => {
    const store = new MemoryStore(root);
    store.create("owner", { botId: "b" }, "lang.md", memo("reply-in-chinese", "Always reply in Chinese"));
    store.create("chat", { botId: "b", chatId: "c1" }, "koru.md", memo("koru-alias", "扣肉 = KORU"));
    const text = getMemorySkill(store, 18790, "b", "c1");
    expect(text).toContain("## Memory");
    expect(text).toContain("http://127.0.0.1:18790/api/memory");
    expect(text).toContain("- [reply-in-chinese](lang.md) — Always reply in Chinese");
    expect(text).toContain("- [koru-alias](koru.md) — 扣肉 = KORU");
    expect(text).toContain(join(root, "chats", "c1"));
  });

  it("leaves out the chat scope without a chat", () => {
    const text = getMemorySkill(new MemoryStore(root), 18790, "b");
    expect(text).not.toContain("### chat:");
    expect(text).toContain("### owner:");
  });

  it("is part of every engine's system prompt only when memory is on", () => {
    const agentsDir = join(root, "agents");
    mkdirSync(agentsDir);
    const input = { agentsDir, botId: "b", apiPort: 1, chatId: "c1", isGroup: true };
    expect(buildSystemPromptParts({ ...input, memory: true }).some((p) => p.startsWith("## Memory"))).toBe(true);
    expect(buildSystemPromptParts({ ...input, memory: false }).some((p) => p.startsWith("## Memory"))).toBe(false);
  });
});

describe("Claude memory link", () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "pa-mem-home-"));
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it("merges what Claude already remembered, keeps a backup and links the directory", () => {
    const cwd = join(home, "workspaces", "bot", "chat_1");
    const chatDir = join(home, "memory", "chats", "chat");
    const native = claudeMemoryDir(cwd, home);
    expect(native).toContain("-workspaces-bot-chat-1");
    mkdirSync(native, { recursive: true });
    writeFileSync(join(native, "old.md"), memo("old", "remembered before"));
    writeFileSync(join(native, "MEMORY.md"), "- [old](old.md)\n");

    expect(linkClaudeMemory(cwd, chatDir, home)).toBe("merged-and-linked");
    expect(lstatSync(native).isSymbolicLink()).toBe(true);
    expect(realpathSync(native)).toBe(realpathSync(chatDir));
    expect(readFileSync(join(chatDir, "old.md"), "utf-8")).toContain("remembered before");
    expect(readdirSync(join(native, "..")).some((f) => f.startsWith("memory.bak-"))).toBe(true);

    expect(linkClaudeMemory(cwd, chatDir, home)).toBe("already-linked");
  });

  it("links a workspace Claude has not used yet", () => {
    const cwd = join(home, "ws2");
    const chatDir = join(home, "memory", "chats", "c2");
    expect(linkClaudeMemory(cwd, chatDir, home)).toBe("linked");
    writeFileSync(join(claudeMemoryDir(cwd, home), "new.md"), "x");
    expect(existsSync(join(chatDir, "new.md"))).toBe(true);
  });
});

describe("Memory API", () => {
  let dir: string;
  let server: ApiServer;
  let base: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "pa-mem-api-"));
    const port = 20000 + Math.floor(Math.random() * 20000);
    base = `http://127.0.0.1:${port}/api/memory`;
    server = new ApiServer({
      port,
      getBotTelegram: () => undefined,
      dataDir: dir,
      log: pino({ level: "silent" }),
    });
    await server.start();
  });
  afterEach(async () => {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  const post = (body: unknown) =>
    fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("runs the memory tool commands end to end", async () => {
    const ids = { bot_id: "b", chat_id: "c" };
    let res = await post({ ...ids, scope: "chat", command: "create", path: "koru-alias.md", file_text: memo("koru-alias", "扣肉 = KORU") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scope: "chat", path: "koru-alias.md" });

    res = await fetch(`${base}?bot_id=b&chat_id=c&scope=chat`);
    expect((await res.json()).content).toContain("koru-alias.md");

    res = await post({ ...ids, scope: "chat", command: "str_replace", path: "koru-alias.md", old_str: "Body", new_str: "Text" });
    expect(res.status).toBe(200);
    res = await fetch(`${base}?bot_id=b&chat_id=c&scope=chat&path=koru-alias.md`);
    expect((await res.json()).content).toContain("Text of koru-alias.");

    res = await fetch(`${base}?bot_id=b&chat_id=c&scope=chat&path=koru-alias.md&reason=obsolete`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(readFileSync(join(dir, "memory", "chats", "c", "MEMORY.md"), "utf-8")).toBe("");
  });

  it("answers 400 with a reason for bad requests", async () => {
    let res = await post({ bot_id: "b", chat_id: "c", scope: "chat", command: "create", path: "../x.md", file_text: "x" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("flat files");
    res = await post({ chat_id: "c", command: "create", path: "a.md" });
    expect(res.status).toBe(400);
    res = await post({ bot_id: "b", scope: "chat", command: "create", path: "a.md", file_text: "x" });
    expect((await res.json()).error).toContain("chat_id");
    res = await post({ bot_id: "b", chat_id: "c", command: "explode" });
    expect(res.status).toBe(400);
  });
});
