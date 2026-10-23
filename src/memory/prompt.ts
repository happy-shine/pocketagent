import type { EngineType, Session } from "../sessions/types.js";
import { loadMemorySnapshot, MEMORY_INDEX, type MemorySnapshot, type MemoryStoreSnapshot } from "./store.js";

function indexBlock(store: MemoryStoreSnapshot, title: string): string {
  const body = store.index.text.trim() || "(empty)";
  return `#### ${title} — \`${store.dir}/${MEMORY_INDEX}\`\n${body}`;
}

/** Both stores' indexes as the agent sees them. */
export function formatMemoryIndexes(snapshot: MemorySnapshot): string {
  return [indexBlock(snapshot.chat, "Chat memory"), indexBlock(snapshot.bot, "Bot memory")].join("\n\n");
}

/** How to use the shared memory, with both stores' current indexes; part of every engine's system prompt. */
export function buildMemoryPrompt(snapshot: MemorySnapshot): string {
  const botScope = snapshot.isGroup
    ? "This is a group chat, so bot memory is read-only here: only update it in a direct chat."
    : "Everything in it is visible in all of this bot's chats, groups included: save there only what anyone in them may see.";
  return [
    "## Long-term memory",
    "You have a persistent, file-based memory that PocketAgent keeps across sessions and engines: whichever CLI (Claude Code, Codex, " +
      "Antigravity, Grok) answers this chat, now or later, reads and writes the same files. It is your only long-term memory. " +
      "Do not use a CLI's own memory feature, and do not save memories anywhere else (such as ~/.claude, ~/.codex, ~/.gemini or ~/.grok).",
    "",
    "Two stores. Both directories already exist: write to them directly with your file tools (do not run mkdir or check for their existence).",
    `- **Chat memory** \`${snapshot.chat.dir}\`: about this chat and the people in it. The default.` +
      (snapshot.isGroup ? " In a group, name the person a memory is about." : ""),
    `- **Bot memory** \`${snapshot.bot.dir}\`: what holds in every chat this bot is in. ${botScope}`,
    "",
    "Each memory is one Markdown file holding one fact, with frontmatter:",
    "```markdown",
    "---",
    "name: <short-kebab-case-slug>",
    "description: <one-line summary, used to decide relevance later>",
    "type: user | feedback | project | reference",
    "---",
    "",
    "<the fact; for feedback and project, follow with **Why:** and **How to apply:** lines>",
    "```",
    `After writing the file, add a one-line pointer to that store's \`${MEMORY_INDEX}\`: \`- [Title](file.md) — hook\`, under ~150 characters. ` +
      `\`${MEMORY_INDEX}\` is the index loaded into every conversation: one line per memory, no frontmatter, never memory content; keep it under 200 lines.`,
    "",
    "Types:",
    "- `user`: who someone is: role, expertise, preferences.",
    "- `feedback`: guidance on how you should work, both corrections and approaches the user confirmed; include why.",
    "- `project`: ongoing work, goals, deadlines, decisions that the files and history do not show. Convert relative dates to absolute ones.",
    "- `reference`: pointers to external resources: URLs, dashboards, channels, accounts (never their credentials).",
    "",
    "Save a memory when the user asks you to remember something, corrects you or confirms a non-obvious approach, or mentions a lasting fact " +
      "(preference, deadline, decision, where something lives) that a later session would need. Do not save what files, git or the chat history " +
      "already record, the state of the current task, anything that only matters to this conversation, or tokens, passwords and other secrets.",
    "Before saving, look for an existing file that covers it and update that instead of adding a duplicate. When a memory turns out wrong, or " +
      "the user asks you to forget something, delete the file and its index line. Do not mention routine memory updates in your reply unless asked.",
    "A memory is a snapshot from when it was written. If one names a file, command, flag or URL, check that it still exists before relying on it; " +
      "if it conflicts with what you see now, trust what you see and fix the memory. Open a memory file when its index line looks relevant.",
    "",
    "### Current memory",
    formatMemoryIndexes(snapshot),
  ].join("\n");
}

/** A note for a running conversation whose memory changed since it last saw the indexes. */
export function buildMemoryUpdateNote(snapshot: MemorySnapshot): string {
  return [
    "[PocketAgent: memory update]",
    "Your long-term memory changed since you last saw it (another session or engine updated it). Current indexes:",
    "",
    formatMemoryIndexes(snapshot),
    "[End of memory update]",
  ].join("\n");
}

/** Records that `engine`'s conversation in this session now has the memory as of `snapshot`. */
export function markMemorySeen(session: Session, engine: EngineType, snapshot: MemorySnapshot | undefined): void {
  if (!snapshot) return;
  session.memorySeen = { ...(session.memorySeen ?? {}), [engine]: snapshot.fingerprint };
}

export function sessionMemorySnapshot(memoryDir: string | undefined, botId: string, session: Session): MemorySnapshot | undefined {
  if (!memoryDir) return undefined;
  return loadMemorySnapshot(memoryDir, {
    botId,
    chatId: session.chatId,
    channelType: session.channelType,
    isGroup: session.isGroup,
  });
}

/**
 * What to put in front of this turn's prompt about memory, and records the memory as seen: the current indexes
 * if they changed since `engine`'s conversation last saw them, the whole memory section if it never got one (a
 * conversation resumed from before the shared memory existed). Null when there is nothing new, or no memory.
 */
export function takeMemoryUpdate(
  memoryDir: string | undefined,
  botId: string,
  session: Session,
  engine: EngineType,
): string | null {
  const snapshot = sessionMemorySnapshot(memoryDir, botId, session);
  if (!snapshot) return null;
  const seen = session.memorySeen?.[engine];
  markMemorySeen(session, engine, snapshot);
  if (seen === snapshot.fingerprint) return null;
  if (seen === undefined) return `[PocketAgent: long-term memory]\n${buildMemoryPrompt(snapshot)}\n[End of long-term memory]`;
  return buildMemoryUpdateNote(snapshot);
}
