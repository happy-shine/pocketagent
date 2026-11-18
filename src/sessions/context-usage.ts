import type { Session } from "./types.js";

export interface ContextUsage {
  /** Size of the engine's conversation at its latest model call */
  tokens: number;
  /** Size at which the conversation is compacted or started over, when there is one */
  limit?: number;
  /** tokens as a whole percentage of limit */
  percent?: number;
}

/**
 * How full the active engine's conversation is, or null when that engine has not reported a size: Grok never
 * does, and a size left by another engine says nothing about this one.
 */
export function sessionContextUsage(session: Session, limit?: number): ContextUsage | null {
  const usage = session.usage;
  if (!usage?.contextTokens || usage.contextTokens <= 0 || usage.contextEngine !== session.activeEngine) return null;
  const tokens = usage.contextTokens;
  if (!limit || limit <= 0) return { tokens };
  return { tokens, limit, percent: Math.round((tokens / limit) * 100) };
}

/** "Context 25.6k / 150k · 17%", or "Context 25.6k" without a limit. */
export function formatContextUsage(usage: ContextUsage): string {
  if (usage.limit === undefined || usage.percent === undefined) return `Context ${formatTokens(usage.tokens)}`;
  return `Context ${formatTokens(usage.tokens)} / ${formatTokens(usage.limit)} · ${usage.percent}%`;
}

function formatTokens(n: number): string {
  const [value, unit] = n >= 1_000_000 ? [n / 1_000_000, "M"] : [n / 1000, "k"];
  return `${value.toFixed(1).replace(/\.0$/, "")}${unit}`;
}
