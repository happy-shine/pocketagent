import { mkdirSync, appendFileSync, readFileSync, existsSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

export interface StoredMessage {
  id: string;
  ts: number;
  sender: string;
  senderId: string;
  text: string;
  media?: string[];
}

export interface MessageQueryOptions {
  chatId: string;
  since?: number;
  until?: number;
  limit?: number;
  sender?: string;
  search?: string;
}

const DEDUP_WINDOW = 500;

export class MessageStore {
  private dir: string;
  private cursors = new Map<string, string>();
  private recentIds = new Map<string, Set<string>>();

  constructor(dataDir: string) {
    this.dir = join(dataDir, "messages");
    mkdirSync(this.dir, { recursive: true });
  }

  advanceCursor(sessionId: string, messageId: string): void {
    this.cursors.set(sessionId, messageId);
  }

  advanceCursorToLatest(chatId: string, sessionId: string): void {
    const latest = this.getRecent(chatId, 1);
    if (latest.length > 0) {
      this.cursors.set(sessionId, latest[0].id);
    }
  }

  append(chatId: string, msg: StoredMessage): boolean {
    let seen = this.recentIds.get(chatId);
    if (!seen) {
      seen = new Set();
      this.recentIds.set(chatId, seen);
    }
    if (seen.has(msg.id)) return false;
    seen.add(msg.id);
    if (seen.size > DEDUP_WINDOW) {
      const first = seen.values().next().value;
      if (first !== undefined) seen.delete(first);
    }

    const filePath = join(this.dir, `${chatId}.jsonl`);
    appendFileSync(filePath, JSON.stringify(msg) + "\n");
    return true;
  }

  getRecent(chatId: string, limit = 50): StoredMessage[] {
    const filePath = join(this.dir, `${chatId}.jsonl`);
    if (!existsSync(filePath)) return [];
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    const slice = lines.slice(-limit);
    return slice.map((line) => {
      try {
        return JSON.parse(line) as StoredMessage;
      } catch {
        return null;
      }
    }).filter((m): m is StoredMessage => m !== null);
  }

  getSinceCursor(chatId: string, sessionId: string, limit = 20): StoredMessage[] {
    const cursor = this.cursors.get(sessionId);
    const messages = this.getRecent(chatId, 100);
    if (!cursor) {
      return messages.slice(-limit);
    }
    const idx = messages.findIndex((m) => m.id === cursor);
    if (idx === -1) {
      return messages.slice(-limit);
    }
    return messages.slice(idx + 1, idx + 1 + limit);
  }

  query(opts: MessageQueryOptions): StoredMessage[] {
    const all = this.getRecent(opts.chatId, 1000);
    return all.filter((m) => {
      if (opts.since && m.ts * 1000 < opts.since) return false;
      if (opts.until && m.ts * 1000 > opts.until) return false;
      if (opts.sender && !m.sender.toLowerCase().includes(opts.sender.toLowerCase())) return false;
      if (opts.search && !m.text.toLowerCase().includes(opts.search.toLowerCase())) return false;
      return true;
    }).slice(-(opts.limit ?? 50));
  }
}
