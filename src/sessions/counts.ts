import type { Session } from "./types.js";

export const MAX_TURNS_HISTORY = 50;

/** Old sessions may already have lost records; never invent their lifetime totals. */
export function ensureHistoryStats(session: Session): NonNullable<Session["historyStats"]> {
  if (!session.historyStats) {
    const records = session.turns ?? [];
    session.historyStats = {
      userTurns: records.filter(t => t.role === "user").length,
      messages: records.length,
      complete: records.length < MAX_TURNS_HISTORY,
    };
  }
  return session.historyStats;
}

export function sessionCounts(session: Session) {
  const stats = ensureHistoryStats(session);
  const retainedMessageCount = session.turns?.length ?? 0;
  return {
    turnCount: stats.userTurns,
    messageCount: stats.messages,
    retainedMessageCount,
    countsComplete: stats.complete,
    historyTruncated: !stats.complete || stats.messages > retainedMessageCount,
  };
}
