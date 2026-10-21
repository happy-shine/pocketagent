import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import type { MemoryConfig } from "../config/schema.js";
import type { Session, SessionHistoryItem } from "../sessions/types.js";
import { MemoryStore } from "../memory/store.js";
import {
  MemoryAutopilot,
  applyMemoryOps,
  buildReviewPrompt,
  dropExpired,
  parseMemoryOps,
  transcriptSince,
  type SideRunner,
} from "../memory/auto.js";

const memo = (name: string, description: string, extra = "", type = "reference") =>
  `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  type: ${type}\n${extra}---\n\nBody of ${name}.\n`;

const settings = (over: Partial<MemoryConfig["auto"]> = {}, recall: Partial<MemoryConfig["recall"]> = {}): MemoryConfig => ({
  enabled: true,
  maxIndexLines: 150,
  auto: {
    enabled: true,
    idleSeconds: 120,
    maxPendingTurns: 12,
    timeoutMinutes: 5,
    consolidateHours: 24,
    consolidateMinMemories: 6,
    ...over,
  },
  recall: { enabled: true, maxPerTurn: 3, maxChars: 1500, ...recall },
});

let turnSeq = 0;
const turn = (role: SessionHistoryItem["role"], text: string, author?: string): SessionHistoryItem => ({
  id: `t${++turnSeq}`,
  ts: Date.UTC(2026, 9, 20, 20, turnSeq),
  role,
  text,
  author,
});

const session = (turns: SessionHistoryItem[], extra: Partial<Session> = {}): Session => ({
  sessionId: "s1",
  chatId: "chatA",
  channelType: "discord",
  activeEngine: "claude",
  createdAt: 0,
  lastActiveAt: 0,
  isActive: true,
  sessionNum: 1,
  isGroup: true,
  turns,
  ...extra,
});

const reply = (memories: unknown[]) => JSON.stringify({ memories });

describe("parseMemoryOps", () => {
  it("reads a fenced or bare JSON object, and an empty list", () => {
    const fenced = 'Sure:\n```json\n{"memories":[{"action":"write","file":"koru-alias","content":"x"}]}\n```';
    expect(parseMemoryOps(fenced)).toEqual([{ action: "write", file: "koru-alias.md", content: "x" }]);
    expect(parseMemoryOps('Done. {"memories":[{"action":"delete","file":"old.md"}]} bye')).toEqual([
      { action: "delete", file: "old.md", reason: "obsolete" },
    ]);
    expect(parseMemoryOps('{"memories": []}')).toEqual([]);
  });

  it("returns null when there is no usable JSON", () => {
    expect(parseMemoryOps("I saved nothing.")).toBeNull();
    expect(parseMemoryOps("{not json}")).toBeNull();
    expect(parseMemoryOps('{"other": 1}')).toBeNull();
  });

  it("drops malformed items and caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ action: "write", file: `m${i}.md`, content: "x" }));
    expect(parseMemoryOps(reply([...many, { action: "write", file: "a.md" }, "junk"]))).toHaveLength(12);
  });
});

describe("applyMemoryOps", () => {
  let root: string;
  let store: MemoryStore;
  const ref = { botId: "bot1", chatId: "chatA" };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pa-auto-"));
    store = new MemoryStore(root);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("writes valid memories and skips bad names and frontmatter", () => {
    const result = applyMemoryOps(store, ref, [
      { action: "write", file: "koru-alias.md", content: memo("koru-alias", "扣肉 = KORU") },
      { action: "write", file: "Bad Name.md", content: memo("x", "y") },
      { action: "write", file: "no-type.md", content: "---\nname: a\ndescription: b\n---\nbody" },
      { action: "write", file: "odd-type.md", content: memo("odd", "d", "", "secret") },
    ]);
    expect(result.written).toEqual(["koru-alias.md"]);
    expect(result.skipped.map((s) => s.file)).toEqual(["Bad Name.md", "no-type.md", "odd-type.md"]);
    expect(store.list("chat", ref).map((e) => e.file)).toEqual(["koru-alias.md"]);
  });

  it("only writes the chat scope", () => {
    applyMemoryOps(store, ref, [{ action: "write", file: "a.md", content: memo("a", "fact") }]);
    expect(store.list("owner", ref)).toEqual([]);
    expect(store.list("bot", ref)).toEqual([]);
  });

  it("does not bring back a memory deleted for good, but may rewrite after other deletions", () => {
    store.create("chat", ref, "gone.md", memo("gone", "wrong fact"));
    store.delete("chat", ref, "gone.md", "user_request");
    store.create("chat", ref, "merged.md", memo("merged", "dup"));
    store.delete("chat", ref, "merged.md", "merged");
    const result = applyMemoryOps(store, ref, [
      { action: "write", file: "gone.md", content: memo("gone", "wrong fact again") },
      { action: "write", file: "merged.md", content: memo("merged", "back") },
    ]);
    expect(result.written).toEqual(["merged.md"]);
    expect(result.skipped).toEqual([{ file: "gone.md", why: "deleted earlier for good" }]);
  });

  it("deletes existing memories with a tombstone and skips missing ones", () => {
    store.create("chat", ref, "old.md", memo("old", "stale"));
    const result = applyMemoryOps(store, ref, [
      { action: "delete", file: "old.md", reason: "incorrect" },
      { action: "delete", file: "never.md", reason: "obsolete" },
    ]);
    expect(result.deleted).toEqual(["old.md"]);
    expect(result.skipped).toEqual([{ file: "never.md", why: "no such memory" }]);
    expect(store.tombstones("chat", ref)).toMatchObject([{ file: "old.md", reason: "incorrect" }]);
    expect(store.tombstones("chat", { botId: "bot1", chatId: "chatB" })).toEqual([]);
  });

  it("drops memories whose expires date has passed", () => {
    store.create("chat", ref, "position.md", memo("position", "NFLX spread", "  expires: 2026-10-23\n", "project"));
    store.create("chat", ref, "keep.md", memo("keep", "no date"));
    expect(dropExpired(store, ref, "2026-10-23")).toEqual([]);
    expect(dropExpired(store, ref, "2026-10-24")).toEqual(["position.md"]);
    expect(store.list("chat", ref).map((e) => e.file)).toEqual(["keep.md"]);
  });
});

describe("transcriptSince", () => {
  it("starts after the cursor and counts user turns", () => {
    const turns = [turn("user", "old", "shine"), turn("assistant", "old reply"), turn("user", "new", "shine"), turn("assistant", "new reply")];
    const all = transcriptSince(turns, undefined, "UTC");
    expect(all.userTurns).toBe(2);
    const since = transcriptSince(turns, turns[1].id, "UTC");
    expect(since.userTurns).toBe(1);
    expect(since.lastId).toBe(turns[3].id);
    expect(since.text).toContain("shine (user):\nnew");
    expect(since.text).not.toContain("old reply");
    expect(transcriptSince(turns, turns[3].id, "UTC")).toMatchObject({ userTurns: 0, text: "" });
  });

  it("clips long turns and keeps the newest when over budget", () => {
    const turns = [turn("user", "a".repeat(5000), "u"), turn("assistant", "b".repeat(5000)), turn("user", "last", "u")];
    const t = transcriptSince(turns, undefined, "UTC", { maxChars: 2500 });
    expect(t.text).toContain("last");
    expect(t.text.length).toBeLessThan(2600);
    expect(transcriptSince(turns, undefined, "UTC").text).toContain("[…]");
  });
});

describe("buildReviewPrompt", () => {
  it("quotes existing memories, final deletions and the conversation", () => {
    const root = mkdtempSync(join(tmpdir(), "pa-auto-"));
    try {
      const store = new MemoryStore(root);
      const ref = { botId: "bot1", chatId: "chatA" };
      store.create("chat", ref, "koru-alias.md", memo("koru-alias", "扣肉 = KORU"));
      store.create("chat", ref, "gone.md", memo("gone", "x"));
      store.delete("chat", ref, "gone.md", "user_request");
      const prompt = buildReviewPrompt({ store, ref, today: "2026-10-20", tz: "America/New_York", transcript: "[t] shine (user):\n别再提磨损" });
      expect(prompt).toContain('<file name="koru-alias.md">');
      expect(prompt).toContain("gone.md");
      expect(prompt).toContain("别再提磨损");
      expect(prompt).toContain("Today is 2026-10-20");
      expect(prompt).toContain('{"memories": []}');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("MemoryAutopilot", () => {
  let root: string;
  let store: MemoryStore;
  const ref = { botId: "bot1", chatId: "chatA" };
  const log = pino({ level: "silent" });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pa-auto-"));
    store = new MemoryStore(root);
  });
  afterEach(() => {
    vi.useRealTimers();
    rmSync(root, { recursive: true, force: true });
  });

  const pilot = (s: Session, runSide: SideRunner, config = settings(), now?: () => number) =>
    new MemoryAutopilot({
      store,
      botId: "bot1",
      log,
      settings: () => config,
      timezone: () => "UTC",
      runSide,
      findSession: (id) => (id === s.sessionId ? s : undefined),
      saveCursor: async (sess, id) => {
        sess.memoryCursor = id;
      },
      now,
    });

  it("recalls memories by alias once per session, again after they change", () => {
    store.create("chat", ref, "koru-alias.md", memo("koru-alias", "扣肉 = KORU", "  aliases: [扣肉]\n"));
    const s = session([]);
    const p = pilot(s, async () => "");
    const first = p.recall("s1", "chatA", "atri帮我买点扣肉");
    expect(first).toContain('<memory scope="chat" file="koru-alias.md">');
    expect(first).toContain("Body of koru-alias.");
    expect(p.recall("s1", "chatA", "扣肉还要吗")).toBe("");
    expect(p.recall("s2", "chatA", "扣肉")).toContain("koru-alias.md");
    expect(p.recall("s1", "chatA", "nothing relevant")).toBe("");
  });

  it("does not recall when recall is off", () => {
    store.create("chat", ref, "koru-alias.md", memo("koru-alias", "扣肉 = KORU", "  aliases: [扣肉]\n"));
    const p = pilot(session([]), async () => "", settings({}, { enabled: false }));
    expect(p.recall("s1", "chatA", "扣肉")).toBe("");
  });

  it("reviews new turns, saves what they taught and moves the cursor", async () => {
    const s = session([turn("user", "说磨损我直接紫砂", "shine"), turn("assistant", "好的")]);
    const prompts: string[] = [];
    const runSide: SideRunner = async (run) => {
      prompts.push(run.prompt);
      return reply([{ action: "write", file: "no-decay-lecture.md", content: memo("no-decay-lecture", "Do not mention decay", "", "feedback") }]);
    };
    const p = pilot(s, runSide);
    await p.review("s1");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("说磨损我直接紫砂");
    expect(store.list("chat", ref).map((e) => e.file)).toEqual(["no-decay-lecture.md"]);
    expect(s.memoryCursor).toBe(s.turns[1].id);

    // Nothing new: no side run
    await p.review("s1");
    expect(prompts).toHaveLength(1);
  });

  it("leaves the cursor in place when the side run fails", async () => {
    const s = session([turn("user", "remember this", "shine")]);
    const p = pilot(s, async () => {
      throw new Error("engine down");
    });
    await p.review("s1");
    expect(s.memoryCursor).toBeUndefined();
  });

  it("moves on from output it cannot parse", async () => {
    const s = session([turn("user", "hello", "shine")]);
    const p = pilot(s, async () => "I could not decide.");
    await p.review("s1");
    expect(s.memoryCursor).toBe(s.turns[0].id);
    expect(store.list("chat", ref)).toEqual([]);
  });

  it("consolidates once enough memories exist, then waits for the interval", async () => {
    for (let i = 0; i < 6; i++) store.create("chat", ref, `m${i}.md`, memo(`m${i}`, `fact ${i}`));
    let now = Date.UTC(2026, 9, 20);
    const purposes: string[] = [];
    const s = session([turn("user", "one", "shine")]);
    const runSide: SideRunner = async (run) => {
      purposes.push(run.purpose);
      if (run.purpose === "consolidate") {
        return reply([
          { action: "write", file: "m0.md", content: memo("m0", "facts 0 and 1") },
          { action: "delete", file: "m1.md", reason: "merged" },
        ]);
      }
      return reply([]);
    };
    const p = pilot(s, runSide, settings(), () => now);
    await p.review("s1");
    expect(purposes).toEqual(["review", "consolidate"]);
    expect(store.list("chat", ref).map((e) => e.file).sort()).toEqual(["m0.md", "m2.md", "m3.md", "m4.md", "m5.md"]);
    expect(existsSync(join(store.scopeDir("chat", ref), ".auto.json"))).toBe(true);
    // The state file is not a memory
    expect(readFileSync(join(store.scopeDir("chat", ref), "MEMORY.md"), "utf-8")).not.toContain(".auto");

    s.turns.push(turn("user", "two", "shine"));
    now += 3_600_000;
    await p.review("s1");
    expect(purposes).toEqual(["review", "consolidate", "review"]);

    // Merging left five, below the minimum of six
    store.create("chat", ref, "m6.md", memo("m6", "fact 6"));
    s.turns.push(turn("user", "three", "shine"));
    now += 24 * 3_600_000;
    await p.review("s1");
    expect(purposes).toEqual(["review", "consolidate", "review", "review", "consolidate"]);
  });

  it("skips consolidation for a chat with few memories", async () => {
    store.create("chat", ref, "a.md", memo("a", "fact"));
    const purposes: string[] = [];
    const s = session([turn("user", "hi", "shine")]);
    const p = pilot(s, async (run) => {
      purposes.push(run.purpose);
      return reply([]);
    });
    await p.review("s1");
    expect(purposes).toEqual(["review"]);
  });

  it("waits for the chat to go quiet, or reviews at once when many turns wait", async () => {
    vi.useFakeTimers();
    const s = session([turn("user", "a", "shine")]);
    const runs: string[] = [];
    const p = pilot(s, async (run) => {
      runs.push(run.purpose);
      return reply([]);
    }, settings({ idleSeconds: 60, maxPendingTurns: 3, consolidateMinMemories: 99 }));

    p.noteTurn(s);
    await vi.advanceTimersByTimeAsync(30_000);
    s.turns.push(turn("user", "b", "shine"));
    p.noteTurn(s); // restarts the quiet period
    await vi.advanceTimersByTimeAsync(45_000);
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(runs).toEqual(["review"]);

    s.turns.push(turn("user", "c", "shine"), turn("user", "d", "shine"), turn("user", "e", "shine"));
    p.noteTurn(s);
    await vi.advanceTimersByTimeAsync(0);
    expect(runs).toEqual(["review", "review"]);
  });

  it("does nothing when automatic upkeep is off", async () => {
    vi.useFakeTimers();
    const s = session([turn("user", "a", "shine")]);
    const runSide = vi.fn(async () => reply([]));
    const p = pilot(s, runSide, settings({ enabled: false }));
    p.noteTurn(s);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(runSide).not.toHaveBeenCalled();
  });
});
