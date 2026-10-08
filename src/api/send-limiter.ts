export interface SendLimits {
  // Messages the agent may send through the API in one turn
  maxPerTurn: number;
  // Minimum gap between two of them; a faster call waits instead of failing
  minIntervalMs: number;
}

export const DEFAULT_SEND_LIMITS: SendLimits = { maxPerTurn: 12, minIntervalMs: 800 };

export type SendLimitResult<T> = { ok: true; value: T } | { ok: false; sent: number; max: number };

interface SessionState {
  // Turn the counts belong to; a different one starts them over
  turn: unknown;
  sent: number;
  lastSentAt: number;
  // Sends of a session run one after another, so the interval holds for concurrent calls too
  queue: Promise<void>;
}

/**
 * Keeps an agent from flooding its chat: per session and turn, at most `maxPerTurn` messages, spaced at least
 * `minIntervalMs` apart. A send reports how many chat messages it produced (long texts are split), and all count.
 */
export class SendLimiter {
  private sessions = new Map<string, SessionState>();
  private getLimits: () => SendLimits;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;

  constructor(opts: { getLimits?: () => SendLimits; now?: () => number; sleep?: (ms: number) => Promise<void> } = {}) {
    this.getLimits = opts.getLimits ?? (() => DEFAULT_SEND_LIMITS);
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** Runs `send` once the session may send again, or refuses it when the turn has used up its messages. */
  run<T>(sessionId: string, turn: unknown, send: () => Promise<{ value: T; count: number }>): Promise<SendLimitResult<T>> {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = { turn, sent: 0, lastSentAt: 0, queue: Promise.resolve() };
      this.sessions.set(sessionId, state);
    }
    const current = state;
    const result = current.queue.then(async (): Promise<SendLimitResult<T>> => {
      if (current.turn !== turn) {
        current.turn = turn;
        current.sent = 0;
      }
      const { maxPerTurn, minIntervalMs } = this.getLimits();
      if (current.sent >= maxPerTurn) return { ok: false, sent: current.sent, max: maxPerTurn };
      const wait = current.lastSentAt + minIntervalMs - this.now();
      if (current.lastSentAt > 0 && wait > 0) await this.sleep(wait);
      try {
        const { value, count } = await send();
        current.sent += Math.max(1, count);
        return { ok: true, value };
      } finally {
        current.lastSentAt = this.now();
      }
    });
    current.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
