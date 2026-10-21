import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * PocketAgent memory: plain Markdown files shared by every engine.
 *
 * Three scopes, each its own directory with a generated MEMORY.md index:
 *   owner            the owner's preferences, shared by every bot and chat
 *   bot  (botId)     what one bot learned about its tools and environment
 *   chat (chatId)    facts from one chat: jargon, people, projects
 *
 * One memory per file, with `name`, `description` and `metadata.type` in its frontmatter (the layout Claude Code
 * uses, so its memory directory can point here). The commands mirror the file commands of Anthropic's memory tool.
 */

export type MemoryScope = "owner" | "bot" | "chat";

export interface ScopeRef {
  botId: string;
  chatId?: string;
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

export const INDEX_FILE = "MEMORY.md";
const TOMBSTONES_FILE = ".tombstones.jsonl";
const MAX_FILE_BYTES = 32 * 1024;
const DEFAULT_MAX_INDEX_LINES = 150;

// Credentials that must never end up in a memory file
const SECRET_PATTERNS: RegExp[] = [
  /\b[MNO][A-Za-z\d]{23,27}\.[\w-]{6}\.[\w-]{27,}\b/, // Discord bot token
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, // Telegram bot token
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic keys
  /\bgh[pousr]_[A-Za-z0-9]{30,}/, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key
  /\bAIza[0-9A-Za-z_-]{35}\b/, // Google API key
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:cookie|set-cookie)\s*[:=]\s*\S{20,}/i,
  /\bbearer\s+[A-Za-z0-9._~+/-]{20,}=*/i,
];

export function findSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export function parseFrontmatter(text: string): { name?: string; description?: string; type?: string; aliases: string[]; expires?: string } {
  const out: { name?: string; description?: string; type?: string; aliases: string[]; expires?: string } = { aliases: [] };
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
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

export class MemoryStore {
  readonly root: string;
  private maxIndexLines: number;

  constructor(root: string, opts: { maxIndexLines?: number } = {}) {
    this.root = resolve(root);
    this.maxIndexLines = opts.maxIndexLines ?? DEFAULT_MAX_INDEX_LINES;
  }

  scopeDir(scope: MemoryScope, ref: ScopeRef): string {
    switch (scope) {
      case "owner":
        return join(this.root, "owner");
      case "bot":
        return join(this.root, "bots", safeId(ref.botId, "bot_id"));
      case "chat":
        if (!ref.chatId) throw new MemoryError("chat scope needs chat_id");
        return join(this.root, "chats", safeId(ref.chatId, "chat_id"));
      default:
        throw new MemoryError(`unknown scope: ${String(scope)}`);
    }
  }

  /** Lists a scope (path empty or "/") or shows a file with line numbers, optionally a [start, end] line range. */
  view(scope: MemoryScope, ref: ScopeRef, path?: string, range?: [number, number]): string {
    const dir = this.scopeDir(scope, ref);
    if (!path || path === "/" || path === "/memories" || path === "/memories/") {
      const entries = this.list(scope, ref);
      if (entries.length === 0) return `(${scope} memory is empty)`;
      return entries.map((e) => `${e.file}\t${e.name} — ${e.description}`).join("\n");
    }
    const file = this.resolveFile(dir, path, { allowIndex: true });
    if (!existsSync(file)) throw new MemoryError(`no such memory: ${path}`);
    const lines = readFileSync(file, "utf-8").split("\n");
    const [start, end] = range ?? [1, lines.length];
    return lines
      .slice(Math.max(0, start - 1), end === -1 ? lines.length : end)
      .map((l, i) => `${String(i + Math.max(1, start)).padStart(4)}\t${l}`)
      .join("\n");
  }

  /** Creates or overwrites a memory file. */
  create(scope: MemoryScope, ref: ScopeRef, path: string, text: string): string {
    const dir = this.scopeDir(scope, ref);
    const file = this.resolveFile(dir, path);
    this.checkContent(text);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, "utf-8");
    this.rebuildIndex(scope, ref);
    return this.rel(dir, file);
  }

  /** Replaces the single occurrence of oldStr in a memory file. */
  strReplace(scope: MemoryScope, ref: ScopeRef, path: string, oldStr: string, newStr: string): string {
    const dir = this.scopeDir(scope, ref);
    const file = this.resolveFile(dir, path);
    const text = this.read(file, path);
    const count = oldStr ? text.split(oldStr).length - 1 : 0;
    if (count === 0) throw new MemoryError(`old_str not found in ${path}`);
    if (count > 1) throw new MemoryError(`old_str appears ${count} times in ${path}; make it unique`);
    const next = text.replace(oldStr, () => newStr);
    this.checkContent(next);
    writeFileSync(file, next, "utf-8");
    this.rebuildIndex(scope, ref);
    return this.rel(dir, file);
  }

  /** Inserts text after line `line` (0 = top of the file). */
  insert(scope: MemoryScope, ref: ScopeRef, path: string, line: number, text: string): string {
    const dir = this.scopeDir(scope, ref);
    const file = this.resolveFile(dir, path);
    const lines = this.read(file, path).split("\n");
    if (!Number.isInteger(line) || line < 0 || line > lines.length) {
      throw new MemoryError(`insert_line must be between 0 and ${lines.length}`);
    }
    lines.splice(line, 0, ...text.replace(/\n$/, "").split("\n"));
    const next = lines.join("\n");
    this.checkContent(next);
    writeFileSync(file, next, "utf-8");
    this.rebuildIndex(scope, ref);
    return this.rel(dir, file);
  }

  /** Deletes a memory and records a tombstone, so later consolidation does not write it back. */
  delete(scope: MemoryScope, ref: ScopeRef, path: string, reason = "user_request"): string {
    const dir = this.scopeDir(scope, ref);
    const file = this.resolveFile(dir, path);
    const text = this.read(file, path);
    unlinkSync(file);
    const fm = parseFrontmatter(text);
    mkdirSync(this.root, { recursive: true });
    appendFileSync(
      join(this.root, TOMBSTONES_FILE),
      JSON.stringify({ scope, botId: ref.botId, chatId: ref.chatId, file: this.rel(dir, file), name: fm.name, reason, at: new Date().toISOString() }) + "\n",
    );
    this.rebuildIndex(scope, ref);
    return this.rel(dir, file);
  }

  rename(scope: MemoryScope, ref: ScopeRef, oldPath: string, newPath: string): string {
    const dir = this.scopeDir(scope, ref);
    const from = this.resolveFile(dir, oldPath);
    const to = this.resolveFile(dir, newPath);
    this.read(from, oldPath);
    if (existsSync(to)) throw new MemoryError(`${newPath} already exists`);
    renameSync(from, to);
    this.rebuildIndex(scope, ref);
    return this.rel(dir, to);
  }

  /** Memories in a scope, most recently updated first. */
  list(scope: MemoryScope, ref: ScopeRef): MemoryEntry[] {
    const dir = this.scopeDir(scope, ref);
    if (!existsSync(dir)) return [];
    const entries: MemoryEntry[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md") || f === INDEX_FILE || f.startsWith(".")) continue;
      const full = join(dir, f);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const fm = parseFrontmatter(readFileSync(full, "utf-8"));
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
  readText(scope: MemoryScope, ref: ScopeRef, path: string): string {
    return this.read(this.resolveFile(this.scopeDir(scope, ref), path), path);
  }

  /** Deletions recorded for a scope (newest last), so automatic writers do not bring a deleted memory back. */
  tombstones(scope: MemoryScope, ref: ScopeRef): Tombstone[] {
    const file = join(this.root, TOMBSTONES_FILE);
    if (!existsSync(file)) return [];
    const out: Tombstone[] = [];
    for (const line of readFileSync(file, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const t = JSON.parse(line) as Tombstone;
        if (t.scope !== scope) continue;
        if (scope !== "owner" && t.botId !== ref.botId) continue;
        if (scope === "chat" && t.chatId !== ref.chatId) continue;
        out.push(t);
      } catch {
        // A damaged line must not hide the others
      }
    }
    return out;
  }

  /** The scope's index text: one line per memory, capped. */
  indexText(scope: MemoryScope, ref: ScopeRef): string {
    const entries = this.list(scope, ref);
    const shown = entries.slice(0, this.maxIndexLines);
    const lines = shown.map((e) => `- [${e.name}](${e.file}) — ${e.description}`);
    if (entries.length > shown.length) {
      lines.push(`- …and ${entries.length - shown.length} older memories; list the scope to see them`);
    }
    return lines.join("\n");
  }

  rebuildIndex(scope: MemoryScope, ref: ScopeRef): void {
    const dir = this.scopeDir(scope, ref);
    if (!existsSync(dir)) return;
    const body = this.indexText(scope, ref);
    writeFileSync(join(dir, INDEX_FILE), body ? `${body}\n` : "", "utf-8");
  }

  /** Memories in the given scopes whose name or aliases appear in text (for keyword recall). */
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

  private resolveFile(dir: string, path: string, opts: { allowIndex?: boolean } = {}): string {
    let p = String(path ?? "").trim().replace(/\\/g, "/");
    p = p.replace(/^\/?memories\//, "").replace(/^\/+/, "");
    if (!p) throw new MemoryError("path is required");
    if (p.includes("/")) throw new MemoryError("memories are flat files; use a file name like topic-name.md");
    if (p.startsWith(".")) throw new MemoryError("file names may not start with a dot");
    if (!p.endsWith(".md")) p = `${p}.md`;
    if (p === INDEX_FILE && !opts.allowIndex) {
      throw new MemoryError("MEMORY.md is generated from the memory files; edit those instead");
    }
    const full = resolve(dir, p);
    if (!full.startsWith(dir + sep)) throw new MemoryError("path escapes the memory directory");
    return full;
  }

  private read(file: string, path: string): string {
    if (!existsSync(file)) throw new MemoryError(`no such memory: ${path}`);
    return readFileSync(file, "utf-8");
  }

  private checkContent(text: string): void {
    if (Buffer.byteLength(text, "utf-8") > MAX_FILE_BYTES) {
      throw new MemoryError(`memory files are limited to ${MAX_FILE_BYTES / 1024} KB; keep one fact per file`);
    }
    if (findSecret(text)) {
      throw new MemoryError("refused: the text looks like it contains a credential (token, key or cookie)");
    }
  }

  private rel(dir: string, file: string): string {
    return relative(dir, file);
  }
}

function safeId(id: string, what: string): string {
  const s = String(id ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(s)) throw new MemoryError(`invalid ${what}`);
  return s;
}
