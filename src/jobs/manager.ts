import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import type { Logger } from "pino";
import { readLastLogLine, readLogTail } from "./log.js";
import type { JobStore } from "./store.js";
import { isJobActive, type BackgroundJob, type JobCallbackState, type JobInput, type JobSettings, type JobStatus } from "./types.js";

const MAX_COMMAND_CHARS = 20_000;
const MAX_TITLE_CHARS = 80;
const KILL_GRACE_MS = 5000;
const SHELL = existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh";

/** Called when a job reaches a final state; resolves to whether its conversation was told. */
export type JobFinishHandler = (job: BackgroundJob) => Promise<JobCallbackState>;

export interface JobManagerOptions {
  store: JobStore;
  log: Logger;
  getSettings: () => JobSettings;
  onFinish: JobFinishHandler;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Signals the job's whole process group, so commands it started go down with it. */
function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {}
  }
}

/**
 * Runs long shell commands for the agent, outside its turn. Each job is a detached process group that writes
 * its output to a log file and its exit code to a file of its own, so a job keeps running across gateway
 * restarts and is picked up again afterwards. When a job ends, `onFinish` hands the result back to the
 * conversation that started it.
 */
export class JobManager {
  private jobs = new Map<string, BackgroundJob>();
  private seqs: Record<string, number>;
  private timer?: ReturnType<typeof setInterval>;
  private started = false;
  private log: Logger;

  constructor(private opts: JobManagerOptions) {
    this.log = opts.log.child({ module: "jobs" });
    const data = opts.store.load();
    this.seqs = data.seqs;
    for (const job of data.jobs) this.jobs.set(job.id, job);
  }

  start(): void {
    this.started = true;
    for (const job of this.jobs.values()) {
      // Jobs that kept running while the gateway was down, or ended meanwhile
      if (job.status === "running") this.check(job);
      // Results whose follow-up was cut off by a restart
      else if (job.callback === "pending") this.notify(job);
    }
    this.pump();
    this.timer = setInterval(() => this.tick(), this.opts.getSettings().pollIntervalMs);
    this.timer.unref();
  }

  /** Stops watching. Running jobs keep going and are picked up again on the next start. */
  stop(): void {
    this.started = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  refresh(): void {
    this.pump();
  }

  settings(): JobSettings {
    return this.opts.getSettings();
  }

  list(filter: { botId?: string; chatId?: string; activeOnly?: boolean } = {}): BackgroundJob[] {
    return [...this.jobs.values()]
      .filter(
        (j) =>
          (!filter.botId || j.botId === filter.botId) &&
          (!filter.chatId || j.chatId === filter.chatId) &&
          (!filter.activeOnly || isJobActive(j)),
      )
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  get(id: string): BackgroundJob | undefined {
    return this.jobs.get(id);
  }

  findBySeq(botId: string, chatId: string, seq: number): BackgroundJob | undefined {
    return this.list({ botId, chatId }).find((j) => j.seq === seq);
  }

  counts(botId: string, chatId: string): { running: number; queued: number } {
    const active = this.list({ botId, chatId, activeOnly: true });
    const running = active.filter((j) => j.status === "running").length;
    return { running, queued: active.length - running };
  }

  logPath(id: string): string {
    return this.opts.store.logPath(id);
  }

  readLog(id: string, lines = 40, maxChars = 4000): string {
    return readLogTail(this.opts.store.logPath(id), lines, maxChars);
  }

  lastLine(id: string): string | undefined {
    return readLastLogLine(this.opts.store.logPath(id));
  }

  create(input: JobInput): { job?: BackgroundJob; error?: string } {
    const settings = this.opts.getSettings();
    if (!settings.enabled) return { error: "Background jobs are disabled" };

    const command = input.command?.trim() ?? "";
    if (!command) return { error: "Missing command" };
    if (command.length > MAX_COMMAND_CHARS) return { error: `Command is too long (max ${MAX_COMMAND_CHARS} characters)` };
    if (!input.cwd || !isAbsolute(input.cwd)) return { error: "cwd must be an absolute path" };
    if (!existsSync(input.cwd) || !statSync(input.cwd).isDirectory()) return { error: `cwd does not exist: ${input.cwd}` };
    if (input.timeoutMs !== undefined) {
      if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) return { error: "timeout must be a positive number" };
      if (input.timeoutMs > settings.maxTimeoutMs) {
        return { error: `timeout is longer than the limit of ${Math.round(settings.maxTimeoutMs / 60_000)} minutes` };
      }
    }

    const active = this.list({ botId: input.botId, chatId: input.chatId, activeOnly: true }).length;
    const limit = settings.maxPerChat + settings.maxQueuedPerChat;
    if (active >= limit) {
      return { error: `This chat already has ${active} background jobs running or waiting (limit is ${limit})` };
    }

    const seqKey = `${input.botId}:${input.chatId}`;
    const seq = (this.seqs[seqKey] ?? 0) + 1;
    this.seqs[seqKey] = seq;
    const title = (input.title?.trim() || command.split("\n")[0]).replace(/\s+/g, " ");

    const job: BackgroundJob = {
      id: this.newId(),
      seq,
      botId: input.botId,
      chatId: input.chatId,
      channelType: input.channelType,
      isGroup: input.isGroup,
      title: title.length > MAX_TITLE_CHARS ? `${title.slice(0, MAX_TITLE_CHARS - 1)}…` : title,
      command,
      cwd: input.cwd,
      then: input.then?.trim() || undefined,
      requester: input.requester,
      originMessageId: input.originMessageId,
      sessionId: input.sessionId,
      timeoutMs: input.timeoutMs,
      status: "queued",
      createdAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    this.log.info({ jobId: job.id, seq, chatId: job.chatId, command: job.command, cwd: job.cwd }, "Background job created");
    this.prune();
    this.persist();
    this.pump();
    return { job };
  }

  /** Stops a job. A queued one is dropped; a running one is terminated and reaches "cancelled" once it exits. */
  cancel(id: string, by?: string): { ok: boolean; error?: string; job?: BackgroundJob } {
    const job = this.jobs.get(id);
    if (!job) return { ok: false, error: "Job not found" };
    if (!isJobActive(job)) return { ok: false, error: `Job #${job.seq} already finished (${job.status})`, job };

    job.cancelledBy = by;
    if (job.status === "queued") {
      job.status = "cancelled";
      job.finishedAt = Date.now();
      job.callback = "skipped";
      this.persist();
      return { ok: true, job };
    }
    this.terminate(job, "cancelled");
    return { ok: true, job };
  }

  /** Deletes a finished job's record and log. */
  remove(id: string): { ok: boolean; error?: string } {
    const job = this.jobs.get(id);
    if (!job) return { ok: false, error: "Job not found" };
    if (isJobActive(job)) return { ok: false, error: `Job #${job.seq} is still ${job.status}; stop it first` };
    this.jobs.delete(id);
    this.deleteFiles(id);
    this.persist();
    return { ok: true };
  }

  private tick(): void {
    if (!this.started) return;
    const now = Date.now();
    const defaultTimeout = this.opts.getSettings().defaultTimeoutMs;
    for (const job of this.list({ activeOnly: true })) {
      if (job.status !== "running") continue;
      if (!job.stopReason && job.startedAt && now - job.startedAt > (job.timeoutMs ?? defaultTimeout)) {
        this.terminate(job, "timeout");
      }
      this.check(job);
    }
    this.pump();
  }

  private pump(): void {
    if (!this.started) return;
    const settings = this.opts.getSettings();
    if (!settings.enabled) return;
    let running = this.list().filter((j) => j.status === "running");
    for (const job of this.list().filter((j) => j.status === "queued")) {
      if (running.length >= settings.maxConcurrent) break;
      if (running.filter((j) => j.botId === job.botId && j.chatId === job.chatId).length >= settings.maxPerChat) continue;
      this.launch(job);
      running = [...running, job];
    }
  }

  private launch(job: BackgroundJob): void {
    const logPath = this.opts.store.logPath(job.id);
    const exitPath = this.opts.store.exitCodePath(job.id);
    mkdirSync(this.opts.store.logsDir, { recursive: true });
    rmSync(exitPath, { force: true });

    job.status = "running";
    job.startedAt = Date.now();
    const out = openSync(logPath, "a");
    try {
      // The wrapper records the exit code in a file, so it can be read even after a gateway restart
      const child = spawn(SHELL, ["-c", `"${SHELL}" -c "$1"; echo $? > "$2"`, "pocketagent-job", job.command, exitPath], {
        cwd: job.cwd,
        detached: true,
        stdio: ["ignore", out, out],
        env: { ...process.env, POCKETAGENT_JOB_ID: job.id },
      });
      job.pid = child.pid;
      child.on("exit", () => this.check(job));
      child.on("error", (err) => {
        if (job.status !== "running") return;
        job.error = err.message;
        this.finish(job, "failed");
      });
      child.unref();
    } catch (err) {
      job.error = err instanceof Error ? err.message : String(err);
    } finally {
      closeSync(out);
    }
    this.log.info({ jobId: job.id, pid: job.pid }, "Background job started");
    this.persist();
    if (!job.pid) {
      job.error ??= "Could not start the process";
      this.finish(job, "failed");
    }
  }

  private terminate(job: BackgroundJob, reason: "cancelled" | "timeout"): void {
    job.stopReason = reason;
    this.persist();
    const pid = job.pid;
    if (!pid) return;
    this.log.info({ jobId: job.id, pid, reason }, "Stopping background job");
    signalGroup(pid, "SIGTERM");
    setTimeout(() => {
      if (pidAlive(pid)) signalGroup(pid, "SIGKILL");
      this.check(job);
    }, KILL_GRACE_MS).unref();
  }

  /** Finishes a running job whose process has exited. */
  private check(job: BackgroundJob): void {
    if (!this.started || job.status !== "running") return;
    const exitPath = this.opts.store.exitCodePath(job.id);
    if (existsSync(exitPath)) {
      const code = Number.parseInt(readFileSync(exitPath, "utf-8").trim(), 10);
      if (Number.isInteger(code)) {
        // An exit forced by the gateway still counts as stopped, whatever code the shell reported
        this.finish(job, job.stopReason ?? (code === 0 ? "succeeded" : "failed"), code);
        return;
      }
    }
    if (job.pid && pidAlive(job.pid)) return;
    this.finish(job, job.stopReason ?? "lost");
  }

  private finish(job: BackgroundJob, status: JobStatus, exitCode?: number): void {
    if (!isJobActive(job)) return;
    job.status = status;
    job.exitCode = exitCode;
    job.finishedAt = Date.now();
    if (status === "failed" && exitCode !== undefined) job.error = `Exited with code ${exitCode}`;
    if (status === "timeout") {
      job.error = `Stopped after reaching its time limit of ${Math.round((job.timeoutMs ?? this.opts.getSettings().defaultTimeoutMs) / 60_000)} min`;
    }
    if (status === "lost") job.error = "The process ended without reporting an exit code (killed outside the gateway?)";
    job.callback = "pending";
    this.log.info(
      { jobId: job.id, seq: job.seq, status, exitCode, durationMs: job.finishedAt - (job.startedAt ?? job.finishedAt) },
      "Background job finished",
    );
    this.persist();
    this.pump();
    this.notify(job);
  }

  private notify(job: BackgroundJob): void {
    this.opts
      .onFinish(job)
      .then((state) => {
        job.callback = state;
      })
      .catch((err) => {
        job.callback = "failed";
        this.log.warn({ error: err, jobId: job.id }, "Failed to report background job result");
      })
      .finally(() => this.persist());
  }

  /** Keeps every active job plus the most recent finished ones. */
  private prune(): void {
    const limit = this.opts.getSettings().historyLimit;
    const finished = this.list().filter((j) => !isJobActive(j) && j.callback !== "pending");
    for (const job of finished.slice(0, Math.max(0, finished.length - limit))) {
      this.jobs.delete(job.id);
      this.deleteFiles(job.id);
    }
  }

  private deleteFiles(id: string): void {
    rmSync(this.opts.store.logPath(id), { force: true });
    rmSync(this.opts.store.exitCodePath(id), { force: true });
  }

  private persist(): void {
    this.opts.store.save({ seqs: this.seqs, jobs: [...this.jobs.values()] });
  }

  private newId(): string {
    let id: string;
    do {
      id = randomBytes(4).toString("hex");
    } while (this.jobs.has(id));
    return id;
  }
}
