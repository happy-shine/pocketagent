import type { EngineType } from "../config/schema.js";

export type CronSchedule =
  | { kind: "cron"; expr: string; tz: string }
  | { kind: "at"; at: number };

export type CronRunStatus = "ok" | "silent" | "error" | "timeout" | "skipped";

export interface CronJobState {
  nextRunAt?: number;
  lastRunAt?: number;
  lastStatus?: CronRunStatus;
  lastError?: string;
  lastDurationMs?: number;
  runCount: number;
  consecutiveFailures: number;
  pausedReason?: string;
}

export interface CronCreator {
  senderId?: string;
  senderName?: string;
  via: "agent" | "command" | "api";
}

export interface CronJob {
  id: string;
  name: string;
  botId: string;
  chatId: string;
  channelType: string;
  isGroup: boolean;
  prompt: string;
  schedule: CronSchedule;
  engine?: EngineType;
  model?: string;
  effort?: string;
  timeoutMs?: number;
  enabled: boolean;
  createdBy: CronCreator;
  createdAt: number;
  updatedAt: number;
  state: CronJobState;
}

export type CronJobInput = Pick<CronJob, "botId" | "chatId" | "channelType" | "isGroup" | "prompt" | "schedule" | "createdBy"> &
  Partial<Pick<CronJob, "name" | "engine" | "model" | "effort" | "timeoutMs">>;

export type CronJobPatch = Partial<Pick<CronJob, "name" | "prompt" | "schedule" | "engine" | "model" | "effort" | "timeoutMs" | "enabled">>;

export type CronTrigger = "schedule" | "manual";

export interface CronRunContext {
  runNum: number;
  trigger: CronTrigger;
  scheduledAt: number;
  startedAt: number;
  timeoutMs: number;
}

export interface CronExecutionResult {
  status: Exclude<CronRunStatus, "skipped">;
  output?: string;
  error?: string;
  // Set when the job can no longer run at all (bot removed, chat de-authorized) and should be paused
  pauseReason?: string;
}

export interface CronRunRecord {
  jobId: string;
  runNum: number;
  trigger: CronTrigger;
  scheduledAt: number;
  startedAt: number;
  finishedAt: number;
  status: CronRunStatus;
  outputPreview?: string;
  error?: string;
}

export interface SchedulerSettings {
  enabled: boolean;
  maxConcurrent: number;
  defaultTimeoutMs: number;
  catchUpGraceMs: number;
  minIntervalMs: number;
  maxJobsPerChat: number;
  timezone?: string;
}
