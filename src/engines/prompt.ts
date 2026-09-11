import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getTelegramFileSkill,
  getSoulEditorSkill,
  getTelegramButtonsSkill,
  getTelegramFormatSkill,
  getChatHistorySkill,
} from "../skills/index.js";
import type { BotIdentity } from "./types.js";

export interface SystemPromptPartsInput {
  agentsDir: string;
  botId: string;
  apiPort: number;
  chatId: string;
  isGroup: boolean;
  identity?: BotIdentity;
}

export function buildSystemPromptParts(input: SystemPromptPartsInput): string[] {
  const parts: string[] = [];
  const soulPath = join(input.agentsDir, input.botId, "SOUL.md");

  if (input.identity) {
    const lines = [`你是 ${input.identity.name}（@${input.identity.username}）。`];
    if (input.isGroup && input.identity.peerBots && input.identity.peerBots.length > 0) {
      const botList = input.identity.peerBots.map((bot) => `@${bot.username}（${bot.name}）`).join("、");
      lines.push(
        `本群可@的bot: ${botList}。只有以上列出的bot可以被@到，@其他任何bot都无效。除非用户明确要求bot间交流，否则不要主动@其他bot。`,
      );
    }
    parts.push(lines.join("\n"));
  }

  try {
    if (existsSync(soulPath)) {
      const soul = readFileSync(soulPath, "utf-8").trim();
      if (soul) parts.push(soul);
    }
  } catch {
    // Ignore missing or unreadable SOUL.md
  }

  parts.push(getTelegramFileSkill(input.apiPort, input.chatId, input.botId, input.isGroup));
  parts.push(getSoulEditorSkill(input.apiPort, input.botId));
  parts.push(getTelegramButtonsSkill());
  parts.push(getTelegramFormatSkill());
  if (input.isGroup) {
    parts.push(getChatHistorySkill(input.apiPort, input.chatId));
  }

  return parts;
}
