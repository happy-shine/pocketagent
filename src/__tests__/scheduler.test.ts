import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { Scheduler, type CronExecutor } from "../scheduler/scheduler.js";
import { CronStore } from "../scheduler/store.js";
import {
  buildCronPrompt,
  computeNextRun,
  formatTime,
  isSilentOutput,
  parseDateTime,
  parseScheduleInput,
  validateSchedule,
} from "../scheduler/schedule.js";
import type { CronExecutionResult, CronJob, CronJobInput, SchedulerSettings } from "../scheduler/types.js";

const MIN = 60_000;
const START = Date.UTC(2026, 9, 3, 0, 0, 0); // Sat 2026-10-03 08:00 Asia/Shanghai

describe("schedule helpers", () => {
  it("computes the next cron run in the schedule's timezone", () => {
    const next = computeNextRun({ kind: "cron", expr: "0 8 * * 1-5", tz: "Asia/Shanghai" }, START);
    expect(next).toBe(Date.UTC(2026, 9, 5, 0, 0, 0)); // Monday 08:00 +08:00
  });

  it("returns a one-shot time only while it is in the future", () => {
    expect(computeNextRun({ kind: "at", at: START + MIN }, START)).toBe(START + MIN);
    expect(computeNextRun({ kind: "at", at: START - MIN }, START)).toBeUndefined();
  });

  it("validates schedules", () => {
    const opts = { now: START, minIntervalMs: 5 * MIN };
    expect(validateSchedule({ kind: "cron", expr: "0 8 * * *", tz: "Asia/Shanghai" }, opts)).toBeNull();
    expect(validateSchedule({ kind: "cron", expr: "*/5 * * * *", tz: "UTC" }, opts)).toBeNull();
    expect(validateSchedule({ kind: "cron", expr: "* * * * *", tz: "UTC" }, opts)).toMatch(/too often/);
    expect(validateSchedule({ kind: "cron", expr: "0,1 8 * * *", tz: "UTC" }, opts)).toMatch(/too often/);
    expect(validateSchedule({ kind: "cron", expr: "*/30 * * * * *", tz: "UTC" }, opts)).toMatch(/5 fields/);
    expect(validateSchedule({ kind: "cron", expr: "61 8 * * *", tz: "UTC" }, opts)).toMatch(/Invalid cron/);
    expect(validateSchedule({ kind: "cron", expr: "0 8 * * *", tz: "Mars/Olympus" }, opts)).toMatch(/Invalid timezone/);
    expect(validateSchedule({ kind: "at", at: START - 1 }, opts)).toMatch(/future/);
  });

  it("parses wall-clock times in the given timezone, including across DST changes", () => {
    expect(parseDateTime("2026-10-04 09:00", "Asia/Shanghai")).toBe(Date.UTC(2026, 9, 4, 1, 0));
    expect(parseDateTime("2026-10-04T09:00:30", "UTC")).toBe(Date.UTC(2026, 9, 4, 9, 0, 30));
    expect(parseDateTime("2026-11-02 09:00", "America/New_York")).toBe(Date.UTC(2026, 10, 2, 14, 0)); // EST
    expect(parseDateTime("2026-10-30 09:00", "America/New_York")).toBe(Date.UTC(2026, 9, 30, 13, 0)); // EDT
    expect(parseDateTime("2026-10-04T09:00:00+02:00", "Asia/Shanghai")).toBe(Date.UTC(2026, 9, 4, 7, 0));
    expect(Number.isNaN(parseDateTime("tomorrow", "UTC"))).toBe(true);
  });

  it("parses API schedule fields", () => {
    expect(parseScheduleInput({ cron: "0 8 * * *" }, "Asia/Shanghai").schedule).toEqual({
      kind: "cron",
      expr: "0 8 * * *",
      tz: "Asia/Shanghai",
    });
    expect(parseScheduleInput({ cron: "0 8 * * *", tz: "UTC" }, "Asia/Shanghai").schedule).toMatchObject({ tz: "UTC" });
    expect(parseScheduleInput({ at: "2026-10-04 09:00" }, "Asia/Shanghai").schedule).toEqual({
      kind: "at",
      at: Date.UTC(2026, 9, 4, 1, 0),
    });
    expect(parseScheduleInput({ cron: "0 8 * * *", at: "2026-10-04 09:00" }, "UTC").error).toMatch(/not both/);
    expect(parseScheduleInput({}, "UTC").error).toMatch(/Missing schedule/);
    expect(parseScheduleInput({ at: "soon" }, "UTC").error).toMatch(/Invalid/);
  });

  it("formats times in a timezone", () => {
    expect(formatTime(Date.UTC(2026, 9, 3, 16, 5), "Asia/Shanghai")).toBe("2026-10-04 00:05");
  });

  it("wraps the prompt for unattended runs", () => {
    const job = makeJob({ name: "AI digest", prompt: "Summarize AI news" });
    const prompt = buildCronPrompt(job, { runNum: 3, trigger: "schedule", scheduledAt: START, startedAt: START, timeoutMs: MIN }, "UTC");
    expect(prompt).toContain('[Scheduled task "AI digest"');
    expect(prompt).toContain("run #3");
    expect(prompt).toContain("2026-10-03 08:00 Asia/Shanghai");
    expect(prompt).toContain("[SILENT]");
    expect(prompt.endsWith("Summarize AI news")).toBe(true);
    expect(isSilentOutput("Nothing new today. [SILENT]")).toBe(true);
    expect(isSilentOutput("Here is the digest")).toBe(false);
  });
});

describe("Scheduler", () => {
  let dir: string;
  let scheduler: Scheduler | undefined;
  const log = pino({ level: "silent" });
  const baseSettings: SchedulerSettings = {
    enabled: true,
    maxConcurrent: 2,
    defaultTimeoutMs: 30 * MIN,
    catchUpGraceMs: 10 * MIN,
    minIntervalMs: 5 * MIN,
    maxJobsPerChat: 20,
    timezone: "UTC",
  };

  function makeScheduler(executor: CronExecutor, settings: Partial<SchedulerSettings> = {}, notify = vi.fn(async () => {})) {
    scheduler = new Scheduler({
      store: new CronStore(dir),
      log,
      getSettings: () => ({ ...baseSettings, ...settings }),
      executor,
      notify,
    });
    return { scheduler, notify };
  }

  function input(overrides: Partial<CronJobInput> = {}): CronJobInput {
    return {
      botId: "bot1",
      chatId: "chat1",
      channelType: "telegram",
      isGroup: false,
      prompt: "Do the thing",
      schedule: { kind: "cron", expr: "*/10 * * * *", tz: "UTC" },
      createdBy: { senderId: "u1", senderName: "User", via: "command" },
      ...overrides,
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-cron-test-"));
    vi.useFakeTimers({ now: START });
  });

  afterEach(() => {
    scheduler?.stop();
    scheduler = undefined;
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs a job when it is due, records the run and persists state", async () => {
    const executor = vi.fn<CronExecutor>(async () => ({ status: "ok", output: "done" }));
    const { scheduler } = makeScheduler(executor);
    scheduler.start();
    const { job } = scheduler.create(input());
    expect(job?.state.nextRunAt).toBe(START + 10 * MIN);

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0][1]).toMatchObject({ runNum: 1, trigger: "schedule", scheduledAt: START + 10 * MIN, timeoutMs: 30 * MIN });

    const saved = new CronStore(dir).loadJobs()[0];
    expect(saved.state).toMatchObject({ lastStatus: "ok", runCount: 1, nextRunAt: START + 20 * MIN });
    expect(scheduler.listRuns(job!.id)).toEqual([expect.objectContaining({ status: "ok", output: "done" })]);

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("skips a run while the previous one is still in progress", async () => {
    let finish!: (r: CronExecutionResult) => void;
    const executor = vi.fn<CronExecutor>(() => new Promise((resolve) => (finish = resolve)));
    const { scheduler } = makeScheduler(executor);
    scheduler.start();
    const { job } = scheduler.create(input());

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(scheduler.isRunning(job!.id)).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(scheduler.listRuns(job!.id).map((r) => r.status)).toEqual(["skipped"]);

    finish({ status: "ok" });
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("pauses a job after three consecutive failures and notifies the chat", async () => {
    const executor = vi.fn<CronExecutor>(async () => ({ status: "error", error: "boom" }));
    const { scheduler, notify } = makeScheduler(executor);
    scheduler.start();
    const { job } = scheduler.create(input());

    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(executor).toHaveBeenCalledTimes(3);
    expect(scheduler.get(job!.id)).toMatchObject({ enabled: false, state: { consecutiveFailures: 3 } });
    expect(scheduler.get(job!.id)?.state.pausedReason).toMatch(/3 consecutive failures/);
    expect(notify).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(executor).toHaveBeenCalledTimes(3);

    scheduler.update(job!.id, { enabled: true });
    expect(scheduler.get(job!.id)?.state).toMatchObject({ consecutiveFailures: 0, pausedReason: undefined });
  });

  it("pauses a job when the executor reports it can no longer run", async () => {
    const executor = vi.fn<CronExecutor>(async () => ({ status: "error", error: "gone", pauseReason: "Bot removed" }));
    const { scheduler } = makeScheduler(executor);
    scheduler.start();
    const { job } = scheduler.create(input());
    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(scheduler.get(job!.id)).toMatchObject({ enabled: false, state: { pausedReason: "Bot removed" } });
  });

  it("removes a one-shot job after it runs", async () => {
    const executor = vi.fn<CronExecutor>(async () => ({ status: "ok" }));
    const { scheduler } = makeScheduler(executor);
    scheduler.start();
    const { job } = scheduler.create(input({ schedule: { kind: "at", at: START + 3 * MIN } }));
    await vi.advanceTimersByTimeAsync(3 * MIN);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(scheduler.get(job!.id)).toBeUndefined();
    expect(new CronStore(dir).loadJobs()).toEqual([]);
  });

  it("runs a missed job once within the grace window and skips it beyond", async () => {
    const store = new CronStore(dir);
    store.saveJobs([
      makeJob({ id: "late", state: { nextRunAt: START - 5 * MIN, runCount: 0, consecutiveFailures: 0 } }),
      makeJob({ id: "stale", state: { nextRunAt: START - 3 * 60 * MIN, runCount: 0, consecutiveFailures: 0 } }),
    ]);
    const executor = vi.fn<CronExecutor>(async () => ({ status: "ok" }));
    const { scheduler } = makeScheduler(executor);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(executor.mock.calls.map(([job]) => job.id)).toEqual(["late"]);
    expect(scheduler.listRuns("stale")).toEqual([expect.objectContaining({ status: "skipped" })]);
    expect(scheduler.get("stale")?.state.nextRunAt).toBeGreaterThan(START);
  });

  it("respects the global concurrency limit", async () => {
    const finishers: Array<() => void> = [];
    const executor = vi.fn<CronExecutor>(() => new Promise((resolve) => finishers.push(() => resolve({ status: "ok" }))));
    const { scheduler } = makeScheduler(executor, { maxConcurrent: 1 });
    scheduler.start();
    scheduler.create(input({ prompt: "A" }));
    scheduler.create(input({ prompt: "B" }));

    await vi.advanceTimersByTimeAsync(10 * MIN);
    expect(executor).toHaveBeenCalledTimes(1);
    finishers[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("does not fire anything while disabled in settings", async () => {
    const executor = vi.fn<CronExecutor>(async () => ({ status: "ok" }));
    const { scheduler } = makeScheduler(executor, { enabled: false });
    scheduler.start();
    scheduler.create(input());
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(executor).not.toHaveBeenCalled();
  });

  it("runs on demand without moving the schedule", async () => {
    const executor = vi.fn<CronExecutor>(async () => ({ status: "ok" }));
    const { scheduler } = makeScheduler(executor);
    scheduler.start();
    const { job } = scheduler.create(input());
    expect(scheduler.runNow(job!.id)).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(executor.mock.calls[0][1].trigger).toBe("manual");
    expect(scheduler.get(job!.id)?.state.nextRunAt).toBe(START + 10 * MIN);
    expect(scheduler.runNow("missing")).toMatchObject({ ok: false });
  });

  it("validates new jobs", () => {
    const { scheduler } = makeScheduler(vi.fn(), { maxJobsPerChat: 1 });
    expect(scheduler.create(input({ prompt: "  " })).error).toMatch(/Missing prompt/);
    expect(scheduler.create(input({ engine: "gpt" as CronJob["engine"] })).error).toMatch(/Unknown engine/);
    expect(scheduler.create(input({ schedule: { kind: "cron", expr: "* * * * *", tz: "UTC" } })).error).toMatch(/too often/);
    expect(scheduler.create(input()).job?.name).toBe("Do the thing");
    expect(scheduler.create(input()).error).toMatch(/limit is 1/);
    expect(scheduler.create(input({ chatId: "chat2" })).job).toBeDefined();
  });
});

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job1",
    name: "Job",
    botId: "bot1",
    chatId: "chat1",
    channelType: "telegram",
    isGroup: false,
    prompt: "Do the thing",
    schedule: { kind: "cron", expr: "0 * * * *", tz: "Asia/Shanghai" },
    enabled: true,
    createdBy: { via: "command" },
    createdAt: START,
    updatedAt: START,
    state: { runCount: 0, consecutiveFailures: 0 },
    ...overrides,
  };
}
