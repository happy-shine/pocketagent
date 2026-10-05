import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

/** Reads at most the last `maxBytes` of a file. */
function readTailBytes(path: string, maxBytes: number): string {
  if (!existsSync(path)) return "";
  const size = statSync(path).size;
  const length = Math.min(size, maxBytes);
  if (length === 0) return "";
  const buf = Buffer.alloc(length);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buf, 0, length, size - length);
  } finally {
    closeSync(fd);
  }
  return buf.toString("utf-8");
}

/**
 * The output as a terminal would show it: progress bars redraw a line with carriage returns, so only the
 * text after the last `\r` of each line is kept, and color codes are dropped.
 */
export function cleanTerminalOutput(raw: string): string[] {
  return raw
    .replace(ANSI_RE, "")
    .split("\n")
    .map((line) => {
      const parts = line.split("\r").filter((p) => p.length > 0);
      return (parts[parts.length - 1] ?? "").trimEnd();
    });
}

/** The last `lines` lines of a log, capped at `maxChars`. */
export function readLogTail(path: string, lines = 40, maxChars = 4000): string {
  const raw = readTailBytes(path, 256 * 1024);
  const all = cleanTerminalOutput(raw);
  while (all.length > 0 && !all[all.length - 1]) all.pop();
  let tail = all.slice(-lines).join("\n");
  if (tail.length > maxChars) tail = "…" + tail.slice(tail.length - maxChars);
  return tail;
}

/** The latest non-empty output line, e.g. a download's progress. */
export function readLastLogLine(path: string, maxChars = 200): string | undefined {
  const all = cleanTerminalOutput(readTailBytes(path, 16 * 1024));
  for (let i = all.length - 1; i >= 0; i--) {
    const line = all[i].trim();
    if (line) return line.length > maxChars ? line.slice(0, maxChars - 1) + "…" : line;
  }
  return undefined;
}
