import type { Session, EngineType, SessionHistoryItem } from "./types.js";

/**
 * Generate context handover primer when switching from one engine to another,
 * or when an engine is newly invoked mid-session.
 */
export function buildContextHandoverPrimer(
  session: Session,
  targetEngine: EngineType,
  workspaceDir: string,
  maxRecentTurns: number = 8,
): string | null {
  if (!session.turns || session.turns.length === 0) {
    return null;
  }

  const prevEngine = session.lastEngine || (session.activeEngine !== targetEngine ? session.activeEngine : null);
  const recentTurns = session.turns.slice(-maxRecentTurns);

  const lines: string[] = [];
  lines.push(`[Context Handover Notice]`);
  if (prevEngine && prevEngine !== targetEngine) {
    lines.push(`This session previously ran on ${prevEngine}. The user has now switched the active engine to ${targetEngine}.`);
  } else {
    lines.push(`This is an existing session continuing with ${targetEngine}.`);
  }
  lines.push(`Workspace: ${workspaceDir}`);
  lines.push(`Below is the recent conversation history in this session:`);
  lines.push("");

  for (const turn of recentTurns) {
    const roleTag = turn.role === "assistant" 
      ? `Assistant (${turn.engine ?? "agent"})` 
      : turn.author ? `User (${turn.author})` : "User";
    const textSnippet = turn.text.length > 800 ? `${turn.text.slice(0, 800)}... [truncated]` : turn.text;
    lines.push(`--- ${roleTag} ---`);
    lines.push(textSnippet);
    lines.push("");
  }

  lines.push(`[End of Context Handover] Please continue assisting the user seamlessly based on the above context.`);
  return lines.join("\n");
}

/**
 * Calculate delta turns that occurred on other engines since targetEngine last spoke.
 */
export function getDeltaTurnsForEngine(
  session: Session,
  targetEngine: EngineType,
): SessionHistoryItem[] {
  if (!session.turns || session.turns.length === 0) return [];

  // Find the index of the last assistant turn made by targetEngine
  let lastTargetIndex = -1;
  for (let i = session.turns.length - 1; i >= 0; i--) {
    const t = session.turns[i];
    if (t.role === "assistant" && t.engine === targetEngine) {
      lastTargetIndex = i;
      break;
    }
  }

  // If targetEngine never spoke in this session, return all turns
  if (lastTargetIndex === -1) {
    return session.turns;
  }

  // Return turns that happened strictly after targetEngine's last response
  return session.turns.slice(lastTargetIndex + 1);
}
