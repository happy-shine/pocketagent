import { randomBytes } from "node:crypto";
import type { Logger } from "pino";
import { EngineTypeSchema } from "../config/schema.js";
import { computeNextRun, systemTimezone, validateSchedule } from "./schedule.js";
import type { CronStore } from "./store.js";
import type {
  CronExecutionResult,
  CronJob,
  CronJobInput,
  CronJobPatch,
  CronRunContext,
  CronRunRecord,
  CronTrigger,
  SchedulerSettings,
} from "./types.js";

const MAX_SLEEP_MS = 60_000;
const BUSY_RETRY_MS = 5_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const OUTPUT_PREVIEW_CHARS = 500;
const MAX_PROMPT_CHARS = 8000;
const MAX_NAME_CHARS = 60;

export type CronExecutor = (job: CronJob, run: CronRunContext) => Promise<CronExecutionResult>;
export type CronNotifier = (job: CronJob, text: string) => Promise<void>;

export interface SchedulerOptions {
  store: CronStore;
  log: Logger;
  getSettings: () => SchedulerSettings;
  executor: CronExecutor;
  notify?: CronNotifier;
}

export class Scheduler {
  private jobs = new Map<string, CronJob>();
  private running = new Map<string, Promise<void>>();
  private timer?: ReturnType<typeof setTimeout>;
  private started = false;
  private log: Logger;

  constructor(private opts: SchedulerOptions) {
    this.log = opts.log.child({ module: "scheduler" });
    const now = Date.now();
    for (const job of opts.store.loadJobs()) {
      if (job.enabled && job.state.nextRunAt === undefined) {
        if (job.schedule.kind === "at") {
          // A one-shot job that already started once (e.g. the gateway died mid-run) is done
          if (job.state.runCount > 0) continue;
          job.state.nextRunAt = job.schedule.at;
        } else {
          job.state.nextRunAt = computeNextRun(job.schedule, now);
        }
      }
      this.jobs.set(job.id, job);
    }
  }

  start(): void {
    this.started = true;
    this.log.info({ jobs: this.jobs.size }, "Scheduler started");
    this.kick();
  }

  stop(): void {
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Re-evaluates due jobs, e.g. after a config reload changed scheduler settings. */
  refresh(): void {
    this.kick();
  }

  /** Default timezone for cron expressions without `tz` and wall-clock `at` times. */
  timezone(): string {
    return this.opts.getSettings().timezone || systemTimezone();
  }

  list(filter: { botId?: string; chatId?: string } = {}): CronJob[] {
    return [...this.jobs.values()]
      .filter((j) => (!filter.botId || j.botId === filter.botId) && (!filter.chatId || j.chatId === filter.chatId))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  get(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  isRunning(id: string): boolean {
    return this.running.has(id);
  }

  listRuns(id: string, limit?: number): CronRunRecord[] {
    return this.opts.store.listRuns(id, limit);
  }

  create(input: CronJobInput): { job?: CronJob; error?: string } {
    const settings = this.opts.getSettings();
    const now = Date.now();

    const prompt = input.prompt?.trim() ?? "";
    if (!prompt) return { error: "Missing prompt" };
    if (prompt.length > MAX_PROMPT_CHARS) return { error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters)` };

    const fieldError = validateJobFields(input);
    if (fieldError) return { error: fieldError };

    const scheduleError = validateSchedule(input.schedule, { now, minIntervalMs: settings.minIntervalMs });
    if (scheduleError) return { error: scheduleError };

    const existing = this.list({ botId: input.botId, chatId: input.chatId }).length;
    if (existing >= settings.maxJobsPerChat) {
      return { error: `This chat already has ${existing} scheduled tasks (limit is ${settings.maxJobsPerChat})` };
    }

    const job: CronJob = {
      id: this.newId(),
      name: normalizeName(input.name, prompt),
      botId: input.botId,
      chatId: input.chatId,
      channelType: input.channelType,
      isGroup: input.isGroup,
      prompt,
      schedule: input.schedule,
      engine: input.engine,
      model: input.model,
      effort: input.effort,
      timeoutMs: input.timeoutMs,
      enabled: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      state: {
        nextRunAt: computeNextRun(input.schedule, now),
        runCount: 0,
        consecutiveFailures: 0,
      },
    };

    this.jobs.set(job.id, job);
    this.persist();
    this.log.info({ jobId: job.id, name: job.name, schedule: job.schedule, chatId: job.chatId }, "Scheduled task created");
    this.kick();
    return { job };
  }

  update(id: string, patch: CronJobPatch): { job?: CronJob; error?: string } {
    const job = this.jobs.get(id);
    if (!job) return { error: "Task not found" };
    const now = Date.now();

    if (patch.prompt !== undefined) {
      const prompt = patch.prompt.trim();
      if (!prompt) return { error: "Prompt cannot be empty" };
      if (prompt.length > MAX_PROMPT_CHARS) return { error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters)` };
      patch = { ...patch, prompt };
    }
    const fieldError = validateJobFields(patch);
    if (fieldError) return { error: fieldError };
    if (patch.schedule) {
      const scheduleError = validateSchedule(patch.schedule, { now, minIntervalMs: this.opts.getSettings().minIntervalMs });
      if (scheduleError) return { error: scheduleError };
    }

    if (patch.name !== undefined) job.name = normalizeName(patch.name, patch.prompt ?? job.prompt);
    if (patch.prompt !== undefined) job.prompt = patch.prompt;
    if ("engine" in patch) job.engine = patch.engine;
    if (patch.model !== undefined) job.model = patch.model || undefined;
    if (patch.effort !== undefined) job.effort = patch.effort || undefined;
    if ("timeoutMs" in patch) job.timeoutMs = patch.timeoutMs;
    if (patch.schedule) {
      job.schedule = patch.schedule;
      job.state.nextRunAt = computeNextRun(job.schedule, now);
    }
    if (patch.enabled !== undefined && patch.enabled !== job.enabled) {
      job.enabled = patch.enabled;
      if (job.enabled) {
        job.state.pausedReason = undefined;
        job.state.consecutiveFailures = 0;
        job.state.nextRunAt = computeNextRun(job.schedule, now);
      }
    }
    job.updatedAt = now;

    this.persist();
    this.kick();
    return { job };
  }

  remove(id: string): boolean {
    if (!this.jobs.delete(id)) return false;
    this.opts.store.deleteRuns(id);
    this.persist();
    this.log.info({ jobId: id }, "Scheduled task removed");
    this.kick();
    return true;
  }

  runNow(id: string): { ok: boolean; error?: string } {
    const job = this.jobs.get(id);
    if (!job) return { ok: false, error: "Task not found" };
    if (this.running.has(id)) return { ok: false, error: "Task is already running" };
    this.fire(job, "manual", Date.now());
    return { ok: true };
  }

  private kick(): void {
    if (!this.started) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), 0);
  }

  private tick(): void {
    this.timer = undefined;
    if (!this.started) return;

    const settings = this.opts.getSettings();
    const now = Date.now();
    let waiting = false;

    if (settings.enabled) {
      const due = [...this.jobs.values()]
        .filter((j) => j.enabled && j.state.nextRunAt !== undefined && j.state.nextRunAt <= now)
        .sort((a, b) => a.state.nextRunAt! - b.state.nextRunAt!);

      for (const job of due) {
        const scheduledAt = job.state.nextRunAt!;
        if (this.running.has(job.id)) {
          this.skip(job, scheduledAt, now, "Previous run was still in progress");
        } else if (job.schedule.kind === "cron" && now - scheduledAt > settings.catchUpGraceMs) {
          // Never replay a backlog: run late only within the grace window, otherwise wait for the next slot
          this.skip(job, scheduledAt, now, "Missed while the gateway was offline or asleep");
        } else if (this.running.size >= settings.maxConcurrent) {
          waiting = true;
        } else {
          this.fire(job, "schedule", scheduledAt);
        }
      }
    }

    this.arm(waiting);
  }

  private arm(waiting: boolean): void {
    const now = Date.now();
    let delay = waiting ? BUSY_RETRY_MS : MAX_SLEEP_MS;
    for (const job of this.jobs.values()) {
      const next = job.state.nextRunAt;
      if (job.enabled && next !== undefined && next > now) {
        delay = Math.min(delay, next - now);
      }
    }
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private skip(job: CronJob, scheduledAt: number, now: number, reason: string): void {
    this.log.info({ jobId: job.id, scheduledAt, reason }, "Skipping scheduled task run");
    job.state.nextRunAt = computeNextRun(job.schedule, now);
    this.opts.store.appendRun({
      jobId: job.id,
      runNum: job.state.runCount,
      trigger: "schedule",
      scheduledAt,
      startedAt: now,
      finishedAt: now,
      status: "skipped",
      error: reason,
    });
    this.persist();
  }

  private fire(job: CronJob, trigger: CronTrigger, scheduledAt: number): void {
    const startedAt = Date.now();
    job.state.runCount += 1;
    if (trigger === "schedule") {
      job.state.nextRunAt = computeNextRun(job.schedule, Math.max(startedAt, scheduledAt));
    }
    this.persist();

    const run: CronRunContext = {
      runNum: job.state.runCount,
      trigger,
      scheduledAt,
      startedAt,
      timeoutMs: job.timeoutMs ?? this.opts.getSettings().defaultTimeoutMs,
    };
    this.log.info({ jobId: job.id, name: job.name, runNum: run.runNum, trigger }, "Running scheduled task");

    const execution = this.execute(job, run).finally(() => {
      this.running.delete(job.id);
      this.kick();
    });
    this.running.set(job.id, execution);
  }

  private async execute(job: CronJob, run: CronRunContext): Promise<void> {
    let result: CronExecutionResult;
    try {
      result = await this.opts.executor(job, run);
    } catch (err) {
      result = { status: "error", error: err instanceof Error ? err.message : String(err) };
    }

    const finishedAt = Date.now();
    this.log.info({ jobId: job.id, runNum: run.runNum, status: result.status, error: result.error }, "Scheduled task finished");

    // The job may have been deleted while it was running
    if (this.jobs.get(job.id) !== job) return;

    // One-shot jobs are done after their run, whatever the outcome (the result was already posted to the chat)
    if (job.schedule.kind === "at") {
      this.remove(job.id);
      return;
    }

    this.opts.store.appendRun({
      jobId: job.id,
      runNum: run.runNum,
      trigger: run.trigger,
      scheduledAt: run.scheduledAt,
      startedAt: run.startedAt,
      finishedAt,
      status: result.status,
      outputPreview: result.output?.slice(0, OUTPUT_PREVIEW_CHARS),
      error: result.error,
    });

    const failed = result.status === "error" || result.status === "timeout";
    job.state.lastRunAt = run.startedAt;
    job.state.lastStatus = result.status;
    job.state.lastError = failed ? result.error : undefined;
    job.state.lastDurationMs = finishedAt - run.startedAt;
    job.state.consecutiveFailures = failed ? job.state.consecutiveFailures + 1 : 0;

    if (result.pauseReason) {
      this.pause(job, result.pauseReason);
    } else if (job.state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.pause(job, `${MAX_CONSECUTIVE_FAILURES} consecutive failures (last: ${result.error ?? result.status})`);
      this.opts
        .notify?.(job, `⏸ Scheduled task "${job.name}" was paused after ${MAX_CONSECUTIVE_FAILURES} consecutive failures.\nLast error: ${result.error ?? result.status}\nUse /cron to resume it.`)
        .catch((err) => this.log.warn({ error: err, jobId: job.id }, "Failed to send scheduler notification"));
    }
    this.persist();
  }

  private pause(job: CronJob, reason: string): void {
    this.log.warn({ jobId: job.id, reason }, "Pausing scheduled task");
    job.enabled = false;
    job.state.pausedReason = reason;
    job.updatedAt = Date.now();
  }

  private persist(): void {
    this.opts.store.saveJobs([...this.jobs.values()]);
  }

  private newId(): string {
    let id: string;
    do {
      id = randomBytes(4).toString("hex");
    } while (this.jobs.has(id));
    return id;
  }
}

function normalizeName(name: string | undefined, prompt: string): string {
  const base = name?.trim() || prompt.split("\n")[0].trim();
  return base.length > MAX_NAME_CHARS ? `${base.slice(0, MAX_NAME_CHARS - 1)}…` : base;
}

function validateJobFields(fields: { engine?: string; timeoutMs?: number }): string | null {
  if (fields.engine !== undefined && !EngineTypeSchema.safeParse(fields.engine).success) {
    return `Unknown engine: ${fields.engine} (expected one of ${EngineTypeSchema.options.join(", ")})`;
  }
  if (fields.timeoutMs !== undefined && (!Number.isFinite(fields.timeoutMs) || fields.timeoutMs <= 0)) {
    return "timeoutMs must be a positive number";
  }
  return null;
}
