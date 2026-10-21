import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, closeSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Long-term memory shared by every engine: plain Markdown files the agent reads and writes with its own file tools.
 * Each store has an index, MEMORY.md, which goes into the system prompt, and one file per memory with YAML
 * frontmatter (name, description, type) that the agent opens when its index line looks relevant.
 *
 * Two stores per bot: chat memory, private to one chat, and bot memory, shared by all of the bot's chats.
 */

export const MEMORY_INDEX = "MEMORY.md";
// The index is part of every system prompt; past these limits only its beginning is loaded
export const MAX_INDEX_LINES = 200;
export const MAX_INDEX_BYTES = 25_000;
// Frontmatter is read from the top of a file only
const FRONTMATTER_SCAN_BYTES = 4096;

export const MEMORY_TYPES = ["user", "feedback", "project", "reference"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
export type MemoryScope = "chat" | "bot";

export interface MemoryFileInfo {
  file: string;
  name?: string;
  description?: string;
  type?: string;
  size: number;
  mtime: number;
}

export interface MemoryIndex {
  // As loaded into the prompt: truncated past the limits, credentials redacted
  text: string;
  truncated: boolean;
  lines: number;
  bytes: number;
}

export interface MemoryStoreSnapshot {
  scope: MemoryScope;
  dir: string;
  index: MemoryIndex;
}

/** The memory a session sees: both stores' indexes as they are now. */
export interface MemorySnapshot {
  chat: MemoryStoreSnapshot;
  bot: MemoryStoreSnapshot;
  isGroup: boolean;
  // Changes when either index changes, so a running conversation can be told
  fingerprint: string;
}

export interface MemoryOwner {
  botId: string;
  chatId: string;
  channelType: string;
  isGroup?: boolean;
}

const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export function botMemoryDir(rootDir: string, botId: string): string {
  return join(rootDir, safeSegment(botId), "bot");
}

export function chatMemoryDir(rootDir: string, botId: string, channelType: string, chatId: string): string {
  return join(rootDir, safeSegment(botId), "chats", `${safeSegment(channelType || "chat")}-${safeSegment(chatId)}`);
}

export function memoryDirFor(rootDir: string, owner: MemoryOwner, scope: MemoryScope): string {
  return scope === "bot" ? botMemoryDir(rootDir, owner.botId) : chatMemoryDir(rootDir, owner.botId, owner.channelType, owner.chatId);
}

/** A memory file name the gateway will touch: a plain `.md` name in the store's own directory. */
export function isMemoryFileName(file: string): boolean {
  // NFKC folds look-alikes such as fullwidth dots and slashes into the characters they imitate
  const normalized = file.normalize("NFKC");
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.md$/.test(file) && normalized === file && !file.includes("..");
}

// High-confidence credential shapes. The prompt already forbids saving secrets; this keeps one that slipped into an
// index out of every later prompt.
const SECRET_PATTERNS: RegExp[] = [
  /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g, // Telegram bot token
  /\b[MNO][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38}\b/g, // Discord bot token
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g, // Anthropic
  /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/g, // OpenAI
  /\bxai-[A-Za-z0-9]{40,}/g, // xAI
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{60,}/g,
  /\b(?:AKIA|ASIA)[A-Z2-7]{16}\b/g, // AWS access key id
  /\bAIza[A-Za-z0-9_-]{35}\b/g, // Google API key
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

/** Replaces credentials in memory text; `found` counts them. */
export function redactSecrets(text: string): { text: string; found: number } {
  let found = 0;
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, () => {
      found++;
      return "[REDACTED]";
    });
  }
  return { text: out, found };
}

/** Cuts an index to the prompt limits: whole lines first, then bytes at the last line break, with a warning. */
export function truncateIndex(raw: string): MemoryIndex {
  const trimmed = raw.trim();
  const allLines = trimmed ? trimmed.split("\n") : [];
  const bytes = Buffer.byteLength(trimmed, "utf-8");
  let text = allLines.slice(0, MAX_INDEX_LINES).join("\n");
  let truncated = allLines.length > MAX_INDEX_LINES;
  if (Buffer.byteLength(text, "utf-8") > MAX_INDEX_BYTES) {
    const cut = Buffer.from(text, "utf-8").subarray(0, MAX_INDEX_BYTES).toString("utf-8");
    const lastBreak = cut.lastIndexOf("\n");
    text = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
    truncated = true;
  }
  if (truncated) {
    text +=
      `\n\n> WARNING: ${MEMORY_INDEX} is ${allLines.length} lines / ${bytes} bytes (limit: ${MAX_INDEX_LINES} lines, ` +
      `${MAX_INDEX_BYTES} bytes). Only part of it was loaded. Keep index entries to one short line each and move detail into topic files.`;
  }
  return { text, truncated, lines: allLines.length, bytes };
}

/** Reads a file unless it is a symlink, which could point the gateway at files outside the store. */
function readRegularFile(path: string, maxBytes?: number): string | null {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile()) return null;
    if (maxBytes === undefined || stat.size <= maxBytes) return readFileSync(path, "utf-8");
    const buf = Buffer.alloc(maxBytes);
    const fd = openSync(path, "r");
    try {
      const n = readSync(fd, buf, 0, maxBytes, 0);
      return buf.subarray(0, n).toString("utf-8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

export function readIndex(dir: string): MemoryIndex {
  const raw = readRegularFile(join(dir, MEMORY_INDEX)) ?? "";
  const index = truncateIndex(raw);
  return { ...index, text: redactSecrets(index.text).text };
}

/** `name`, `description` and `type` from a file's frontmatter, if it starts with one. */
export function parseFrontmatter(content: string): { name?: string; description?: string; type?: string } {
  const match = content.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.*?)\s*$/);
    if (kv && kv[2]) fields[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { name: fields.name, description: fields.description, type: fields.type };
}

/** The store's memory files (not the index), newest first. */
export function listMemoryFiles(dir: string): MemoryFileInfo[] {
  if (!existsSync(dir)) return [];
  const files: MemoryFileInfo[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === MEMORY_INDEX || !isMemoryFileName(entry.name)) continue;
    const path = join(dir, entry.name);
    try {
      const stat = lstatSync(path);
      const head = readRegularFile(path, FRONTMATTER_SCAN_BYTES) ?? "";
      files.push({ file: entry.name, ...parseFrontmatter(head), size: stat.size, mtime: stat.mtimeMs });
    } catch {
      // Removed while listing
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

export function readMemoryFile(dir: string, file: string): string | null {
  if (file !== MEMORY_INDEX && !isMemoryFileName(file)) return null;
  const content = readRegularFile(join(dir, file));
  return content === null ? null : redactSecrets(content).text;
}

/** Deletes a memory file and the index lines that link to it. False if there was no such file. */
export function deleteMemoryFile(dir: string, file: string): boolean {
  if (!isMemoryFileName(file)) return false;
  const path = join(dir, file);
  try {
    if (!lstatSync(path).isFile()) return false;
  } catch {
    return false;
  }
  rmSync(path, { force: true });
  const indexPath = join(dir, MEMORY_INDEX);
  const index = readRegularFile(indexPath);
  if (index !== null) {
    const link = `](${file})`;
    const kept = index.split("\n").filter((line) => !line.includes(link) && !line.includes(`](./${file})`));
    writeFileSync(indexPath, kept.join("\n"));
  }
  return true;
}

/** Creates both stores' directories, so the prompt can tell the agent to write there without checking. */
export function ensureMemoryDirs(rootDir: string, owner: MemoryOwner): { chatDir: string; botDir: string } {
  const chatDir = memoryDirFor(rootDir, owner, "chat");
  const botDir = memoryDirFor(rootDir, owner, "bot");
  mkdirSync(chatDir, { recursive: true });
  mkdirSync(botDir, { recursive: true });
  return { chatDir, botDir };
}

export function loadMemorySnapshot(rootDir: string, owner: MemoryOwner): MemorySnapshot {
  const { chatDir, botDir } = ensureMemoryDirs(rootDir, owner);
  const chat: MemoryStoreSnapshot = { scope: "chat", dir: chatDir, index: readIndex(chatDir) };
  const bot: MemoryStoreSnapshot = { scope: "bot", dir: botDir, index: readIndex(botDir) };
  const fingerprint = createHash("sha1").update(chat.index.text).update("\0").update(bot.index.text).digest("hex").slice(0, 16);
  return { chat, bot, isGroup: Boolean(owner.isGroup), fingerprint };
}
