import { closeSync, existsSync, fstatSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";

/**
 * `codex exec --json` reports only the summed usage of a whole turn, which overstates the conversation size once a
 * turn makes several model calls. Codex writes each call's usage to the thread's rollout file
 * (~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<thread id>.jsonl) as a `token_count` event, and that is read here.
 */

export interface CodexContextSize {
  /** Size of the conversation after the latest model call */
  tokens: number;
  /** The model's context window, as Codex reports it */
  window?: number;
}

const TAIL_BYTES = 512 * 1024;

export function codexHome(): string {
  return process.env.CODEX_HOME || join(process.env.HOME || "", ".codex");
}

/** When a thread was created, from its UUIDv7 id (the first 48 bits are milliseconds since the epoch). */
export function codexThreadCreatedAt(threadId: string): Date | undefined {
  const hex = threadId.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex) || hex[12] !== "7") return undefined;
  const ms = parseInt(hex.slice(0, 12), 16);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : undefined;
}

/**
 * The rollout file of a thread. A resumed thread keeps appending to the file it was created in, which lives under
 * the local date of its creation; the neighbouring days are checked too in case the clock or time zone moved.
 */
export function findCodexRollout(threadId: string, home: string = codexHome()): string | undefined {
  const created = codexThreadCreatedAt(threadId);
  if (!created) return undefined;
  const suffix = `-${threadId}.jsonl`;
  for (const offsetDays of [0, -1, 1]) {
    const d = new Date(created.getTime() + offsetDays * 86_400_000);
    const dir = join(
      home,
      "sessions",
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    );
    if (!existsSync(dir)) continue;
    try {
      const name = readdirSync(dir).find((f) => f.startsWith("rollout-") && f.endsWith(suffix));
      if (name) return join(dir, name);
    } catch {}
  }
  return undefined;
}

/** The conversation size at the latest `token_count` event of a rollout file, or undefined when it has none. */
export function readCodexContextSize(rolloutPath: string): CodexContextSize | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(rolloutPath, "r");
    const size = fstatSync(fd).size;
    // The latest event is near the end; the whole file is read only when the tail holds none
    for (const length of size > TAIL_BYTES ? [TAIL_BYTES, size] : [size]) {
      const buf = Buffer.alloc(length);
      readSync(fd, buf, 0, length, size - length);
      const found = lastTokenCount(buf.toString("utf-8"));
      if (found) return found;
    }
  } catch {
    // Missing or unreadable: no size
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return undefined;
}

function lastTokenCount(text: string): CodexContextSize | undefined {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"token_count"') || !line.includes('"last_token_usage"')) continue;
    try {
      const info = JSON.parse(line)?.payload?.info;
      const last = info?.last_token_usage;
      if (!last) continue;
      const tokens = typeof last.total_tokens === "number"
        ? last.total_tokens
        : (Number(last.input_tokens) || 0) + (Number(last.output_tokens) || 0);
      if (!(tokens > 0)) continue;
      const window = typeof info.model_context_window === "number" ? info.model_context_window : undefined;
      return { tokens, window };
    } catch {
      // A line cut by the tail read, or not JSON
    }
  }
  return undefined;
}
