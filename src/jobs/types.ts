export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "timeout" | "cancelled" | "lost";

/** Whether the conversation that started a finished job has been told about it. */
export type JobCallbackState = "pending" | "done" | "skipped" | "failed";

export interface JobRequester {
  senderId?: string;
  senderName?: string;
}

/**
 * A long-running shell command the agent handed to the gateway. The gateway runs it outside the agent's
 * turn and, when it exits, messages the conversation that started it so the agent can continue.
 */
export interface BackgroundJob {
  id: string;
  // Per-chat number shown to users (#3)
  seq: number;
  botId: string;
  chatId: string;
  channelType: string;
  isGroup: boolean;
  title: string;
  command: string;
  cwd: string;
  // What the agent plans to do once the command exits; handed back to it with the result
  then?: string;
  requester: JobRequester;
  // Message the follow-up reply answers
  originMessageId?: string;
  // Chat session the result is sent back to
  sessionId?: string;
  timeoutMs?: number;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  pid?: number;
  exitCode?: number;
  error?: string;
  // Set when the gateway is stopping the process, so its exit is not mistaken for a crash
  stopReason?: "cancelled" | "timeout";
  cancelledBy?: string;
  callback?: JobCallbackState;
}

export type JobInput = Pick<
  BackgroundJob,
  "botId" | "chatId" | "channelType" | "isGroup" | "title" | "command" | "cwd" | "requester"
> &
  Partial<Pick<BackgroundJob, "then" | "originMessageId" | "sessionId" | "timeoutMs">>;

export interface JobSettings {
  enabled: boolean;
  maxConcurrent: number;
  maxPerChat: number;
  maxQueuedPerChat: number;
  maxPerTurn: number;
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  historyLimit: number;
  pollIntervalMs: number;
}

export function isJobActive(job: BackgroundJob): boolean {
  return job.status === "queued" || job.status === "running";
}

/**
 * Scheduled runs and side questions (/btw) run in throwaway sessions that cannot take a follow-up message,
 * so they may not start background jobs.
 */
export function isEphemeralSessionId(sessionId: string): boolean {
  return sessionId.startsWith("cron-") || sessionId.startsWith("btw-");
}
