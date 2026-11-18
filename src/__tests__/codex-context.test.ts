import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexThreadCreatedAt, findCodexRollout, readCodexContextSize } from "../engines/codex/rollout.js";
import { listedCodexModels } from "../engines/codex/discovery.js";

const THREAD = "01a1ee10-361b-7531-9541-fd92eb13732f";

function tokenCount(lastTotal: number, turnTotal: number, window = 475000): string {
  return JSON.stringify({
    timestamp: "2026-11-18T09:50:07.221Z",
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { input_tokens: turnTotal, output_tokens: 10, total_tokens: turnTotal + 10 },
        last_token_usage: { input_tokens: lastTotal - 10, output_tokens: 10, total_tokens: lastTotal },
        model_context_window: window,
      },
    },
  });
}

describe("Codex rollout context size", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "codex-home-"));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("reads the creation time from a UUIDv7 thread id", () => {
    expect(codexThreadCreatedAt(THREAD)?.toISOString()).toBe("2026-11-18T09:50:02.267Z");
    expect(codexThreadCreatedAt("not-a-uuid")).toBeUndefined();
    // UUIDv4 carries no time
    expect(codexThreadCreatedAt("3f1c2b9e-1d2a-4c3b-8e4f-5a6b7c8d9e0f")).toBeUndefined();
  });

  it("finds the rollout file under the thread's local creation date", () => {
    const d = codexThreadCreatedAt(THREAD)!;
    const dir = join(
      home,
      "sessions",
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "rollout-2026-11-18T04-49-00-other.jsonl"), "");
    const file = join(dir, `rollout-2026-11-18T04-50-02-${THREAD}.jsonl`);
    writeFileSync(file, "");
    expect(findCodexRollout(THREAD, home)).toBe(file);
    expect(findCodexRollout("01a1ee10-361b-7531-9541-000000000000", home)).toBeUndefined();
  });

  it("takes the latest model call's size, not the turn's summed usage", () => {
    const file = join(home, "rollout.jsonl");
    writeFileSync(
      file,
      [
        JSON.stringify({ type: "session_meta", payload: { id: THREAD } }),
        tokenCount(46_029, 46_029),
        JSON.stringify({ type: "response_item", payload: { type: "message" } }),
        tokenCount(48_520, 94_549),
        JSON.stringify({ type: "event_msg", payload: { type: "agent_message", message: "done" } }),
        "",
      ].join("\n"),
    );
    expect(readCodexContextSize(file)).toEqual({ tokens: 48_520, window: 475000 });
  });

  it("finds a size before the tail of a large file", () => {
    const file = join(home, "big.jsonl");
    const filler = JSON.stringify({ type: "response_item", payload: { text: "x".repeat(1000) } });
    writeFileSync(file, [tokenCount(12_345, 12_345), ...Array(800).fill(filler), ""].join("\n"));
    expect(readCodexContextSize(file)?.tokens).toBe(12_345);
  });

  it("gives no size for a missing file or one without token counts", () => {
    expect(readCodexContextSize(join(home, "missing.jsonl"))).toBeUndefined();
    const file = join(home, "empty.jsonl");
    writeFileSync(file, JSON.stringify({ type: "session_meta" }) + "\n");
    expect(readCodexContextSize(file)).toBeUndefined();
  });
});

describe("Codex model list", () => {
  it("keeps the CLI's listed models in its priority order and drops hidden ones", () => {
    const listed = listedCodexModels([
      { slug: "gpt-6-astra", visibility: "list", priority: 6 },
      { slug: "codex-auto-review", visibility: "hide", priority: 12 },
      { slug: "gpt-6.2-sol", visibility: "list", priority: 1 },
      { slug: "gpt-reserve", visibility: "hide", priority: 4 },
      { slug: "custom-no-priority" },
      { slug: "gpt-6.2-astra", visibility: "list", priority: 2 },
    ]);
    expect(listed.map((m) => m.slug)).toEqual(["gpt-6.2-sol", "gpt-6.2-astra", "gpt-6-astra", "custom-no-priority"]);
  });
});
