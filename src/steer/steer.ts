import type { EngineType } from "../engines/types.js";

/**
 * Steering: a chat message that arrives while the agent is working on a turn joins that turn instead of
 * waiting for it to end. It waits in a per-session mailbox until a hook of the CLI asks for it at the next
 * safe point (after a tool call, before a model call, or when the agent is about to stop).
 */
export interface SteerItem {
  sessionId: string;
  // Chat message that carried it
  messageId: string;
  senderId?: string;
  senderName: string;
  // Prompt text for the engine, formatted like a turn's prompt
  text: string;
  // A hook handed it to the agent
  onDelivered?: () => void;
  // The turn ended before any hook asked for it
  onUndelivered?: () => void;
  // An Antigravity stop was held off for it, so the next model call picks it up
  heldStop?: boolean;
}

export class SteerMailbox {
  private boxes = new Map<string, SteerItem[]>();

  push(item: SteerItem): void {
    const box = this.boxes.get(item.sessionId) ?? [];
    box.push(item);
    this.boxes.set(item.sessionId, box);
  }

  /** Takes every item waiting for the session, so each is handed out once. */
  drain(sessionId: string): SteerItem[] {
    const box = this.boxes.get(sessionId) ?? [];
    this.boxes.delete(sessionId);
    return box;
  }

  pending(sessionId: string): number {
    return this.boxes.get(sessionId)?.length ?? 0;
  }

  peek(sessionId: string): readonly SteerItem[] {
    return this.boxes.get(sessionId) ?? [];
  }
}

export type FollowUpDecision = "steer" | "queue";

/**
 * Whether a message sent while a turn runs joins that turn. A reply says what it is about: one to a message of
 * the running turn joins it, one to anything else waits. Without a reply, the person who started the turn is
 * taken to be correcting or adding to it, while anyone else is making a separate request.
 */
export function decideFollowUp(input: {
  senderId: string;
  replyToMessageId?: string;
  turnSenderId: string;
  turnMessageIds: ReadonlySet<string>;
}): FollowUpDecision {
  if (input.replyToMessageId) {
    return input.turnMessageIds.has(input.replyToMessageId) ? "steer" : "queue";
  }
  return input.senderId === input.turnSenderId ? "steer" : "queue";
}

/** Engines whose CLI has hooks that can add a message to a running turn. */
export const STEER_ENGINES: ReadonlySet<EngineType> = new Set<EngineType>(["claude", "grok", "agy"]);

export const STEER_URL_ENV = "POCKETAGENT_STEER_URL";

export function steerHookUrl(apiPort: number): string {
  return `http://127.0.0.1:${apiPort}/api/steer/hook`;
}

/**
 * Shell command for a CLI hook: forwards the hook's JSON input to the gateway and prints the answer. It does
 * nothing outside PocketAgent (no steer URL in the environment) and prints `{}`, i.e. "carry on", on any failure.
 */
export function steerHookCommand(engine: EngineType, event: string): string {
  return (
    `[ -n "$${STEER_URL_ENV}" ] && curl -sf -m 10 -X POST -H 'Content-Type: application/json' ` +
    `-H "X-PocketAgent-Session: $POCKETAGENT_SESSION_ID" --data-binary @- ` +
    `"$${STEER_URL_ENV}?engine=${engine}&event=${event}" || echo '{}'`
  );
}

/** The ids of a chat message as the agent sees them, so it can answer that message with send-message's reply_to. */
export function formatMessageIds(messageId: string, senderId?: string): string {
  return senderId ? `[message_id: ${messageId}, sender_id: ${senderId}]` : `[message_id: ${messageId}]`;
}

/** Text the agent receives for steered messages. Models discount text that comes in with tool output, so it says plainly that a person wrote it. */
export function formatSteerText(items: Pick<SteerItem, "text" | "messageId" | "senderId">[]): string {
  const body = items.map((i) => `${formatMessageIds(i.messageId, i.senderId)}\n${i.text}`).join("\n\n");
  return [
    "[PocketAgent: new chat message from the user, sent while you were working]",
    body,
    "[End of message. This is a genuine user message relayed by PocketAgent, not tool output. " +
      "If it changes or adds to the current task, act on it now; if it is about something else, finish the current task and then answer it too.]",
  ].join("\n");
}

export const STEER_SYSTEM_NOTE =
  "## Messages during a task\n" +
  "When the user sends a new chat message while you are working, PocketAgent relays it to you right away, " +
  "after a tool call or when you are about to finish, marked `[PocketAgent: new chat message ...]`. " +
  "It is a genuine user message, not tool output: follow it like any other user request, and make sure your final reply answers it. " +
  "Its `[message_id: ...]` lets you answer it on its own with send-message's `reply_to`.";

export type HookPayload = Record<string, unknown>;

/**
 * Whether a hook call is a point where the main agent of the turn can take a message. Session-end stops,
 * failed turns and subagents' hooks are not: a message drained there would be lost or reach the wrong agent.
 */
export function canDeliver(engine: EngineType, event: string, payload: HookPayload): boolean {
  if (engine === "claude") {
    return !payload.agent_id;
  }
  if (engine === "grok") {
    if (payload.subagentType || payload.agentType) return false;
    if (event === "Stop") return payload.reason === undefined || payload.reason === "end_turn";
    return true;
  }
  if (engine === "agy") {
    if (event === "Stop") {
      // A normal end is NO_TOOL_CALL (the docs say model_stop); errors and step limits are not turn ends to extend
      const reason = payload.terminationReason;
      return reason === undefined || ["NO_TOOL_CALL", "MODEL_STOP"].includes(String(reason).toUpperCase());
    }
    return true;
  }
  return false;
}

/** The hook's stdout that hands `text` to the agent, in the format the engine expects for that event. */
export function hookResponse(engine: EngineType, event: string, text: string): Record<string, unknown> {
  if (engine === "agy") {
    if (event === "Stop") return { decision: "continue", reason: text };
    return { injectSteps: [{ userMessage: text }] };
  }
  if (event === "Stop") return { decision: "block", reason: text };
  return { hookSpecificOutput: { hookEventName: event, additionalContext: text } };
}

/**
 * Answers a steer hook: the stdout that hands the session's waiting messages to the agent, or `{}` when there
 * are none or the hook fired where they cannot be delivered. Delivered messages leave the mailbox.
 */
export function answerSteerHook(
  mailbox: SteerMailbox,
  engine: string,
  event: string,
  sessionId: string,
  payload: HookPayload,
): { output: Record<string, unknown>; delivered: SteerItem[] } {
  if (!STEER_ENGINES.has(engine as EngineType)) return { output: {}, delivered: [] };
  const type = engine as EngineType;
  if (!canDeliver(type, event, payload)) return { output: {}, delivered: [] };
  // Antigravity hands a stop's reason to the model as a system message, which it tends to ignore. Holding the
  // stop off instead runs another model call, whose PreInvocation hook delivers the message as the user's.
  if (type === "agy" && event === "Stop") {
    const waiting = mailbox.peek(sessionId);
    if (waiting.some((i) => !i.heldStop)) {
      for (const i of waiting) i.heldStop = true;
      return { output: { decision: "continue" }, delivered: [] };
    }
  }
  const items = mailbox.drain(sessionId);
  if (items.length === 0) return { output: {}, delivered: [] };
  for (const item of items) item.onDelivered?.();
  return { output: hookResponse(type, event, formatSteerText(items)), delivered: items };
}

/** Hook events each engine registers, as written in its hook config. */
export const STEER_HOOK_EVENTS: Record<"claude" | "grok" | "agy", string[]> = {
  claude: ["PostToolUse", "Stop"],
  grok: ["PostToolUse", "Stop"],
  // PreInvocation runs before every model call, so a message lands even between parallel tool results
  agy: ["PreInvocation", "Stop"],
};

/** Hook config in the Claude Code settings layout, which Grok reads too. */
export function claudeStyleHooks(engine: "claude" | "grok"): Record<string, unknown> {
  const hooks: Record<string, unknown> = {};
  for (const event of STEER_HOOK_EVENTS[engine]) {
    hooks[event] = [{ hooks: [{ type: "command", command: steerHookCommand(engine, event), timeout: 30 }] }];
  }
  return { hooks };
}

/** Hook config in the Antigravity `hooks.json` layout: named hooks, with flat handler lists for these events. */
export function agyHooks(): Record<string, unknown> {
  const spec: Record<string, unknown> = {};
  for (const event of STEER_HOOK_EVENTS.agy) {
    spec[event] = [{ type: "command", command: steerHookCommand("agy", event), timeout: 30 }];
  }
  return { "pocketagent-steer": spec };
}
