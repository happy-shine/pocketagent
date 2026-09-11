import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ChatSessionState } from "./types.js";

export class SessionStore {
  constructor(private baseDir: string) {}

  private pathFor(chatId: string): string {
    const safeChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.baseDir, safeChatId, "state.json");
  }

  load(chatId: string): ChatSessionState | null {
    const path = this.pathFor(chatId);
    if (!existsSync(path)) return null;
    try {
      const data = readFileSync(path, "utf-8");
      return JSON.parse(data) as ChatSessionState;
    } catch {
      return null;
    }
  }

  save(state: ChatSessionState): void {
    const path = this.pathFor(state.chatId);
    mkdirSync(dirname(path), { recursive: true });
    const tmp = path + ".tmp";
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, path);
  }

  listChatIds(): string[] {
    if (!existsSync(this.baseDir)) return [];
    return readdirSync(this.baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }
}
