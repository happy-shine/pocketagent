import type { HistoryMessage } from "../channels/types.js";

// The bot's own messages are already in the agent's conversation (or, for scheduled posts, only need their gist),
// so the context carries just their opening. Repeating them in full doubled what long group sessions fed the
// engine and pushed Antigravity into compacting its context mid-task.
const OWN_MESSAGE_CLIP = 160;
const MAX_CONTEXT_MESSAGES = 100;

export interface GroupContextInput {
  // Chat history, oldest first, possibly including the trigger message and later ones
  history: HistoryMessage[];
  // Message that started the turn; only messages before it are context
  triggerId: string;
  // Last trigger the session was given context up to
  lastCursor?: string;
  isOwn: (m: HistoryMessage) => boolean;
}

/**
 * Chat messages to put before a turn's prompt: the recent ones on a session's first turn (or after a gap larger
 * than the history window), otherwise those since the previous turn. Empty when nobody but the bot spoke.
 */
export function buildGroupContext(input: GroupContextInput): string {
  const { history, triggerId, lastCursor, isOwn } = input;
  // Messages after the trigger (e.g. someone speaking while the bot works) belong to the next turn
  const triggerIdx = history.findIndex((m) => m.id === triggerId);
  const prior = triggerIdx !== -1 ? history.slice(0, triggerIdx) : history.filter((m) => m.id !== triggerId);

  let messages: HistoryMessage[];
  let header = "### Recent Group Chat Context (prior messages leading up to this turn):";
  const cursorIdx = lastCursor ? prior.findIndex((m) => m.id === lastCursor) : -1;
  if (cursorIdx !== -1) {
    messages = prior.slice(cursorIdx + 1);
    header = "### New Group Chat Messages (since last turn):";
    if (!messages.some((m) => !isOwn(m))) messages = [];
  } else {
    messages = prior.slice(-MAX_CONTEXT_MESSAGES);
  }
  if (messages.length === 0) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const lines = messages.map((m) => {
    const dt = new Date(m.ts * 1000);
    const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const own = isOwn(m);
    let line = `[${time}] ${m.sender}${own ? " (you)" : ""}`;
    if (m.replyToSender || m.replyToText) {
      const target = m.replyToSender || "someone";
      const snippet = m.replyToText
        ? ` "${m.replyToText.slice(0, 80).replace(/\n/g, " ")}${m.replyToText.length > 80 ? "..." : ""}"`
        : "";
      line += ` (replying to ${target}${snippet})`;
    }
    let body = m.text || (m.media ? `[${m.media.join(", ")}]` : "");
    if (own && body.length > OWN_MESSAGE_CLIP) {
      body = `${body.slice(0, OWN_MESSAGE_CLIP).replace(/\n/g, " ")}… [your earlier message, shortened]`;
    }
    return `${line}: ${body}`;
  });
  return `${header}\n${lines.join("\n")}\n\n`;
}
