import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface StoredMessage {
  id: string;
  ts: number;
  sender: string;
  senderId: string;
  text: string;
  media?: string[];
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  // Forum topic of a Telegram group the message was posted in
  threadId?: string;
}

/** A later line about a message already in the file: its edited text, or that it was deleted. */
interface MessageChange {
  id: string;
  op: "edit" | "delete";
  text?: string;
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
  private recentIds = new Map<string, Set<string>>();

  constructor(dataDir: string) {
    this.dir = join(dataDir, "messages");
    mkdirSync(this.dir, { recursive: true });
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

    this.write(chatId, msg);
    return true;
  }

  /** Records the new text of a message that was edited; readers see the message with it, in its old place. */
  edit(chatId: string, id: string, text: string): void {
    this.write(chatId, { id, op: "edit", text } satisfies MessageChange);
  }

  /** Records that a message was deleted; readers no longer see it. */
  remove(chatId: string, id: string): void {
    this.write(chatId, { id, op: "delete" } satisfies MessageChange);
  }

  getRecent(chatId: string, limit = 50): StoredMessage[] {
    const filePath = join(this.dir, `${chatId}.jsonl`);
    if (!existsSync(filePath)) return [];
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    // Edits and deletions take lines too; read past them so `limit` messages remain
    const messages = new Map<string, StoredMessage>();
    for (const line of lines.slice(-limit * 2)) {
      let entry: StoredMessage | MessageChange;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if ("op" in entry) {
        const msg = messages.get(entry.id);
        if (entry.op === "delete") messages.delete(entry.id);
        else if (msg && typeof entry.text === "string") messages.set(entry.id, { ...msg, text: entry.text });
      } else if (!messages.has(entry.id)) {
        messages.set(entry.id, entry);
      }
    }
    return [...messages.values()].slice(-limit);
  }

  /** A recent message by id, if it is still in the store. */
  find(chatId: string, id: string): StoredMessage | undefined {
    return this.getRecent(chatId, 200).find((m) => m.id === id);
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

  private write(chatId: string, entry: StoredMessage | MessageChange): void {
    appendFileSync(join(this.dir, `${chatId}.jsonl`), JSON.stringify(entry) + "\n");
  }
}
