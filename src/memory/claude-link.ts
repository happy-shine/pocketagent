import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { INDEX_FILE } from "./store.js";

/** Claude Code keeps a project's memory under ~/.claude/projects/<cwd with every non-alphanumeric char as "-">/memory. */
export function claudeMemoryDir(cwd: string, home = homedir()): string {
  return join(home, ".claude", "projects", resolve(cwd).replace(/[^a-zA-Z0-9]/g, "-"), "memory");
}

export type LinkResult = "linked" | "already-linked" | "merged-and-linked";

/**
 * Points Claude Code's memory directory for a workspace at a PocketAgent chat-scope directory, so what Claude
 * remembers lands in the shared store. Memories Claude already wrote there are copied over first (never
 * overwriting), and the old directory is kept as memory.bak-<time>.
 */
export function linkClaudeMemory(cwd: string, chatDir: string, home = homedir()): LinkResult {
  const native = claudeMemoryDir(cwd, home);
  const target = resolve(chatDir);
  mkdirSync(target, { recursive: true });

  let stat;
  try {
    stat = lstatSync(native);
  } catch {
    stat = undefined;
  }

  if (stat?.isSymbolicLink()) {
    if (resolve(dirname(native), readlinkSync(native)) === target) return "already-linked";
    unlinkSync(native);
  }

  let result: LinkResult = "linked";
  if (stat?.isDirectory()) {
    for (const f of readdirSync(native)) {
      if (!f.endsWith(".md") || f === INDEX_FILE) continue;
      const from = join(native, f);
      let to = join(target, f);
      if (existsSync(to)) {
        if (readFileSync(to, "utf-8") === readFileSync(from, "utf-8")) continue;
        to = join(target, f.replace(/\.md$/, `-${Date.now().toString(36)}.md`));
      }
      copyFileSync(from, to);
    }
    renameSync(native, `${native}.bak-${Date.now()}`);
    result = "merged-and-linked";
  }

  mkdirSync(dirname(native), { recursive: true });
  symlinkSync(target, native, "dir");
  return result;
}
