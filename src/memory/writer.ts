import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  deleteMemoryFile,
  isMemoryFileName,
  MEMORY_INDEX,
  memoryDirFor,
  readIndex,
  redactSecrets,
  type MemoryScope,
} from "./store.js";

/**
 * Writes for PocketAgent's own memory upkeep (memory/auto.ts) into the stores of store.ts. Agents write their
 * memories with their file tools; this is for the background review and consolidation, which run without tools.
 * It keeps MEMORY.md in the format the agents use, one `- [Title](file.md) — hook` line per memory, and records
 * deletions so a later review does not write a deleted memory back.
 */

export interface ScopeRef {
  botId: string;
  chatId?: string;
  channelType?: string;
}

export interface MemoryEntry {
  file: string;
  name: string;
  description: string;
  type?: string;
  aliases: string[];
  // metadata.expires (YYYY-MM-DD): positions and theses that go stale
  expires?: string;
  updatedAt: number;
}

export interface Tombstone {
  scope: MemoryScope;
  botId: string;
  chatId?: string;
  file: string;
  name?: string;
  reason: string;
  at: string;
}

export class MemoryError extends Error {}

const TOMBSTONES_FILE = ".tombstones.jsonl";
const MAX_FILE_BYTES = 32 * 1024;

/** Frontmatter fields the upkeep needs, metadata.aliases and metadata.expires included. */
export function parseMemoryMeta(text: string): { name?: string; description?: string; type?: string; aliases: string[]; expires?: string } {
  const out: { name?: string; description?: string; type?: string; aliases: string[]; expires?: string } = { aliases: [] };
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^﻿/, ""));
  if (!m) return out;
  const unquote = (v: string) => v.trim().replace(/^(["'])(.*)\1$/, "$2");
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\s*)([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, indent, key, value] = kv;
    if (!indent && key === "name") out.name = unquote(value);
    else if (!indent && key === "description") out.description = unquote(value);
    else if (key === "type") out.type = unquote(value);
    else if (key === "expires") out.expires = unquote(value) || undefined;
    else if (key === "aliases") {
      const list = /^\[(.*)\]$/.exec(value.trim());
      if (list) out.aliases = list[1].split(",").map(unquote).filter(Boolean);
    }
  }
  return out;
}

export class MemoryWriter {
  constructor(readonly root: string) {}

  scopeDir(scope: MemoryScope, ref: ScopeRef): string {
    if (scope === "chat" && (!ref.chatId || !ref.channelType)) throw new MemoryError("chat scope needs chat_id and channel");
    return memoryDirFor(this.root, { botId: ref.botId, chatId: ref.chatId ?? "", channelType: ref.channelType ?? "" }, scope);
  }

  /** Creates or overwrites a memory file and its index line. */
  create(scope: MemoryScope, ref: ScopeRef, file: string, text: string): string {
    const dir = this.scopeDir(scope, ref);
    this.checkName(file);
    if (Buffer.byteLength(text, "utf-8") > MAX_FILE_BYTES) {
      throw new MemoryError(`memory files are limited to ${MAX_FILE_BYTES / 1024} KB; keep one fact per file`);
    }
    if (redactSecrets(text).found > 0) {
      throw new MemoryError("refused: the text looks like it contains a credential (token or key)");
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, file), text.endsWith("\n") ? text : `${text}\n`, "utf-8");
    const meta = parseMemoryMeta(text);
    this.upsertIndexLine(dir, file, `- [${meta.name || file.replace(/\.md$/, "")}](${file}) — ${meta.description ?? ""}`.trimEnd());
    return file;
  }

  /** Deletes a memory with its index line and records a tombstone. */
  delete(scope: MemoryScope, ref: ScopeRef, file: string, reason = "user_request"): string {
    const dir = this.scopeDir(scope, ref);
    this.checkName(file);
    const text = this.read(dir, file);
    if (!deleteMemoryFile(dir, file)) throw new MemoryError(`no such memory: ${file}`);
    mkdirSync(this.root, { recursive: true });
    appendFileSync(
      join(this.root, TOMBSTONES_FILE),
      JSON.stringify({ scope, botId: ref.botId, chatId: ref.chatId, file, name: parseMemoryMeta(text).name, reason, at: new Date().toISOString() }) + "\n",
    );
    return file;
  }

  /** Memories in a store, most recently updated first. */
  list(scope: MemoryScope, ref: ScopeRef): MemoryEntry[] {
    const dir = this.scopeDir(scope, ref);
    if (!existsSync(dir)) return [];
    const entries: MemoryEntry[] = [];
    for (const f of readdirSync(dir)) {
      if (f === MEMORY_INDEX || !isMemoryFileName(f)) continue;
      const full = join(dir, f);
      let st;
      try {
        st = lstatSync(full);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const fm = parseMemoryMeta(readFileSync(full, "utf-8"));
      entries.push({
        file: f,
        name: fm.name || f.replace(/\.md$/, ""),
        description: fm.description || "",
        type: fm.type,
        aliases: fm.aliases,
        expires: fm.expires,
        updatedAt: st.mtimeMs,
      });
    }
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** The raw text of a memory file. */
  readText(scope: MemoryScope, ref: ScopeRef, file: string): string {
    this.checkName(file);
    return this.read(this.scopeDir(scope, ref), file);
  }

  /** Deletions recorded for a store (newest last), so automatic writers do not bring a deleted memory back. */
  tombstones(scope: MemoryScope, ref: ScopeRef): Tombstone[] {
    const path = join(this.root, TOMBSTONES_FILE);
    if (!existsSync(path)) return [];
    const out: Tombstone[] = [];
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const t = JSON.parse(line) as Tombstone;
        if (t.scope !== scope || t.botId !== ref.botId) continue;
        if (scope === "chat" && t.chatId !== ref.chatId) continue;
        out.push(t);
      } catch {
        // A damaged line must not hide the others
      }
    }
    return out;
  }

  /** The store's index as the agents see it in their prompt. */
  indexText(scope: MemoryScope, ref: ScopeRef): string {
    return readIndex(this.scopeDir(scope, ref)).text.trim();
  }

  /** Memories in the given stores whose aliases appear in text (for keyword recall). */
  matchAliases(text: string, scopes: Array<[MemoryScope, ScopeRef]>, max = 5): Array<{ scope: MemoryScope; entry: MemoryEntry; path: string }> {
    const hay = text.toLowerCase();
    const hits: Array<{ scope: MemoryScope; entry: MemoryEntry; path: string }> = [];
    for (const [scope, ref] of scopes) {
      let entries: MemoryEntry[];
      try {
        entries = this.list(scope, ref);
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.aliases.some((a) => a.length >= 2 && hay.includes(a.toLowerCase()))) {
          hits.push({ scope, entry: e, path: join(this.scopeDir(scope, ref), e.file) });
          if (hits.length >= max) return hits;
        }
      }
    }
    return hits;
  }

  private upsertIndexLine(dir: string, file: string, line: string): void {
    const indexPath = join(dir, MEMORY_INDEX);
    const lines = existsSync(indexPath) ? readFileSync(indexPath, "utf-8").split("\n") : [];
    const at = lines.findIndex((l) => l.includes(`](${file})`) || l.includes(`](./${file})`));
    if (at >= 0) lines[at] = line;
    else {
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
      lines.push(line);
    }
    writeFileSync(indexPath, `${lines.join("\n").replace(/\n+$/, "")}\n`, "utf-8");
  }

  private checkName(file: string): void {
    if (!isMemoryFileName(file)) throw new MemoryError(`invalid memory file name: ${file}`);
  }

  private read(dir: string, file: string): string {
    const path = join(dir, file);
    if (!existsSync(path)) throw new MemoryError(`no such memory: ${file}`);
    return readFileSync(path, "utf-8");
  }
}
