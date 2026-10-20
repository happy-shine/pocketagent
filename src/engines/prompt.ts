import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { findPocketAgentRoot, readSnapshotInfo, snapshotDir } from "../source/snapshot.js";
import {
  getTelegramFileSkill,
  getSoulEditorSkill,
  getTelegramButtonsSkill,
  getTelegramFormatSkill,
  getDiscordFormatSkill,
  getChatHistorySkill,
  getSchedulerSkill,
  getBackgroundJobSkill,
  SkillRegistry,
} from "../skills/index.js";
import { STEER_SYSTEM_NOTE } from "../steer/steer.js";
import { MemoryStore } from "../memory/store.js";
import { getMemorySkill } from "../memory/prompt.js";
import type { BotIdentity } from "./types.js";

// Agents have pasted bot tokens they found in config files straight into curl commands, which leaves them in transcripts
const CREDENTIALS_NOTE =
  "## Credentials\n" +
  "Never copy bot tokens, API keys or other credentials out of config files into commands, code, files or chat messages. " +
  "Use the PocketAgent APIs described here, or scripts that read the credentials themselves.";

// Agents understand requests about PocketAgent better when they read how it actually works, so point them at the
// code: the read-only copy in <dataDir>/source, or the checkout itself before the first copy exists
export function getSourceCodeNote(dataDir: string, checkoutRoot = findPocketAgentRoot()): string | undefined {
  const info = readSnapshotInfo(dataDir);
  const copy = snapshotDir(dataDir);
  let where: string;
  let codeDir: string;
  let checkout: string | undefined;
  if (info && existsSync(join(copy, "src"))) {
    codeDir = join(copy, "src");
    checkout = info.checkout;
    const commit = info.commit ? `, commit ${info.commit.slice(0, 7)}` : "";
    where =
      `Its source code is at \`${copy}\`: a read-only copy of the code this gateway is running ` +
      `(TypeScript in \`src/\`, copied ${info.takenAt.slice(0, 10)} from \`${info.checkout}\`${commit}).`;
  } else if (checkoutRoot && existsSync(join(checkoutRoot, "src"))) {
    codeDir = join(checkoutRoot, "src");
    checkout = checkoutRoot;
    where = `Its source code is at \`${checkoutRoot}\` (TypeScript in \`src/\`; the gateway runs the compiled copy in \`dist/\`).`;
  } else {
    return undefined;
  }

  let folders = "";
  try {
    folders = readdirSync(codeDir)
      .filter((f) => !f.startsWith(".") && !f.startsWith("__") && statSync(join(codeDir, f)).isDirectory())
      .join(", ");
  } catch {
    // Listing is only a convenience
  }

  return (
    "## PocketAgent source code\n" +
    `You run inside PocketAgent (PA), the gateway between this chat and you. ${where}` +
    (folders ? ` Folders in \`src/\`: ${folders}.` : "") +
    "\n\n" +
    "The API and feature descriptions in this prompt are summaries; the code is the truth. When a request touches how " +
    "PA itself behaves (sessions and /new, engine switching, what context and chat history you receive, triggers, " +
    "scheduled tasks, background jobs, buttons, sending files and messages, memory, config, or any API above), read " +
    "the code that implements it before you answer or act, instead of guessing from the summaries: grep for the " +
    "endpoint, command or setting involved and follow the calls.\n\n" +
    "Read freely. Change PA only when asked, and then in a git worktree of " +
    (checkout ? `\`${checkout}\`` : "the PA checkout") +
    ", never in this copy: a change does nothing until it is rebuilt and the gateway restarted, and a restart cuts " +
    "every chat for a moment, so let the user decide when to deploy."
  );
}

export interface SystemPromptPartsInput {
  agentsDir: string;
  botId: string;
  apiPort: number;
  chatId: string;
  channelType?: string;
  isGroup: boolean;
  identity?: BotIdentity;
  backgroundJobs?: boolean;
  // The engine relays messages sent during a turn into it
  steer?: boolean;
  // Shared memory: rules, API and a snapshot of the indexes
  memory?: boolean;
  memoryMaxIndexLines?: number;
}

// Memory lives next to the agents directory: <dataDir>/memory
export function memoryRootFor(agentsDir: string): string {
  return join(dirname(agentsDir), "memory");
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
  parts.push(getSchedulerSkill(input.apiPort, input.botId, input.chatId));
  if (input.backgroundJobs) {
    parts.push(getBackgroundJobSkill(input.apiPort, input.botId, input.chatId));
  }
  if (input.memory) {
    try {
      const store = new MemoryStore(memoryRootFor(input.agentsDir), { maxIndexLines: input.memoryMaxIndexLines });
      parts.push(getMemorySkill(store, input.apiPort, input.botId, input.chatId || undefined));
    } catch {
      // A broken memory directory must not keep the session from starting
    }
  }
  parts.push(CREDENTIALS_NOTE);
  const sourceNote = getSourceCodeNote(dirname(input.agentsDir));
  if (sourceNote) parts.push(sourceNote);
  if (input.steer) {
    parts.push(STEER_SYSTEM_NOTE);
  }
  parts.push(getTelegramButtonsSkill());
  if (input.channelType === "discord") {
    parts.push(getDiscordFormatSkill());
  } else {
    parts.push(getTelegramFormatSkill());
  }
  if (input.isGroup) {
    parts.push(getChatHistorySkill(input.apiPort, input.chatId, input.botId));
  }

  try {
    const customSkillsPrompt = SkillRegistry.getInstance().generateSkillsPrompt();
    if (customSkillsPrompt) {
      parts.push(customSkillsPrompt);
    }
  } catch {
    // Ignore skills error
  }

  return parts;
}
