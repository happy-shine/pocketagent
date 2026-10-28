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
import { buildMemoryPrompt } from "../memory/prompt.js";
import type { MemorySnapshot } from "../memory/store.js";
import type { BotIdentity } from "./types.js";
import { platformApiExamples } from "../skills/platform-examples.js";

// Agents have pasted bot tokens they found in config files straight into curl commands, which leaves them in transcripts
const CREDENTIALS_NOTE =
  "## Credentials\n" +
  "Never copy bot tokens, API keys or other credentials out of config files into commands, code, files or chat messages. " +
  "Use the PocketAgent APIs described here, or scripts that read the credentials themselves.";

export const WORKING_STYLE_NOTE =
  "## Working style\n" +
  "- **Always acknowledge before tools**: Whenever handling a user request that involves calling tools (running commands, reading/editing files, searching, querying APIs, or research), ALWAYS output a brief, natural one-sentence response/heads-up to the chat *first* before calling your first tool (e.g. confirming what you are looking into or checking, in your persona). That text reaches the user immediately, eliminating wait anxiety.\n" +
  "- Keep this heads-up concise, conversational and natural (1 sentence). Speak like a human teammate; never dump raw tool or command names.\n" +
  "- Each step costs several seconds, so do more per step: put related checks and edits into one script or command instead of tiny single-line commands, and do not re-check a file you just inspected.\n" +
  "- Report only what actually happened. Never claim an action was done before it actually was.";

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
  // The shared long-term memory as of now; absent when it is turned off
  memory?: MemorySnapshot;
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

  parts.push(platformApiExamples(getTelegramFileSkill(input.apiPort, input.chatId, input.botId, input.isGroup)));
  parts.push(platformApiExamples(getSoulEditorSkill(input.apiPort, input.botId)));
  parts.push(platformApiExamples(getSchedulerSkill(input.apiPort, input.botId, input.chatId)));
  if (input.backgroundJobs) {
    parts.push(platformApiExamples(getBackgroundJobSkill(input.apiPort, input.botId, input.chatId)));
  }
  parts.push(CREDENTIALS_NOTE);
  parts.push(WORKING_STYLE_NOTE);
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
    parts.push(platformApiExamples(getChatHistorySkill(input.apiPort, input.chatId, input.botId)));
  }

  try {
    const customSkillsPrompt = SkillRegistry.getInstance().generateSkillsPrompt();
    if (customSkillsPrompt) {
      parts.push(customSkillsPrompt);
    }
  } catch {
    // Ignore skills error
  }

  // Last, after the parts that never change, as it is the one that does
  if (input.memory) {
    parts.push(buildMemoryPrompt(input.memory));
  }

  return parts;
}
