import { Cron } from "croner";
import type { CronJob, CronRunContext, CronSchedule } from "./types.js";

export const SILENT_TOKEN = "[SILENT]";

const INTERVAL_SAMPLE_RUNS = 6;

export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function computeNextRun(schedule: CronSchedule, after: number): number | undefined {
  if (schedule.kind === "at") {
    return schedule.at > after ? schedule.at : undefined;
  }
  const next = new Cron(schedule.expr, { timezone: schedule.tz }).nextRun(new Date(after));
  return next?.getTime();
}

/** Returns an error message, or null when the schedule is acceptable. */
export function validateSchedule(schedule: CronSchedule, opts: { now: number; minIntervalMs: number }): string | null {
  if (schedule.kind === "at") {
    if (!Number.isFinite(schedule.at)) return "Invalid `at` time";
    if (schedule.at <= opts.now) return "`at` time must be in the future";
    return null;
  }

  if (!isValidTimezone(schedule.tz)) return `Invalid timezone: ${schedule.tz}`;

  const fields = schedule.expr.trim().split(/\s+/);
  if (!schedule.expr.trim().startsWith("@") && fields.length !== 5) {
    return "Cron expression must have 5 fields: minute hour day-of-month month day-of-week";
  }

  let runs: Date[];
  try {
    runs = new Cron(schedule.expr, { timezone: schedule.tz }).nextRuns(INTERVAL_SAMPLE_RUNS, new Date(opts.now));
  } catch (err) {
    return `Invalid cron expression: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (runs.length === 0) return "Cron expression never fires";

  for (let i = 1; i < runs.length; i++) {
    if (runs[i].getTime() - runs[i - 1].getTime() < opts.minIntervalMs) {
      return `Schedule fires too often (minimum interval is ${Math.round(opts.minIntervalMs / 60000)} minutes)`;
    }
  }
  return null;
}

/**
 * Parses the flat schedule fields used by the HTTP API and chat command:
 * `cron` (+ optional `tz`) for recurring jobs, or `at` (ISO string or epoch ms) for one-shot jobs.
 */
export function parseScheduleInput(
  input: { cron?: unknown; tz?: unknown; at?: unknown },
  defaultTz: string,
): { schedule?: CronSchedule; error?: string } {
  const hasCron = typeof input.cron === "string" && input.cron.trim() !== "";
  const hasAt = input.at !== undefined && input.at !== null && input.at !== "";
  if (hasCron && hasAt) return { error: "Specify either `cron` or `at`, not both" };

  if (hasCron) {
    const tz = typeof input.tz === "string" && input.tz.trim() ? input.tz.trim() : defaultTz;
    return { schedule: { kind: "cron", expr: (input.cron as string).trim(), tz } };
  }
  if (hasAt) {
    const at = typeof input.at === "number" ? input.at : parseDateTime(String(input.at), defaultTz);
    if (!Number.isFinite(at)) return { error: `Invalid \`at\` time: ${String(input.at)}` };
    return { schedule: { kind: "at", at } };
  }
  return { error: "Missing schedule: provide `cron` (e.g. \"0 8 * * *\") or `at` (ISO 8601 time)" };
}

const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Parses an ISO 8601 time; a wall-clock time without offset ("2026-10-04 09:00") is read in `tz`. */
export function parseDateTime(text: string, tz: string): number {
  const m = NAIVE_DATETIME_RE.exec(text.trim());
  if (!m) return Date.parse(text);
  const [y, mo, d, h, mi, sec] = m.slice(1).map((v) => Number(v ?? 0));
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, sec);
  // Second pass corrects the offset when the first guess lands on the other side of a DST change
  const guess = asUtc - tzOffsetMs(asUtc, tz);
  return asUtc - tzOffsetMs(guess, tz);
}

function wallClockParts(ts: number, tz: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const out: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

function tzOffsetMs(ts: number, tz: string): number {
  const p = wallClockParts(ts, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (ts - (((ts % 1000) + 1000) % 1000));
}

export function formatTime(ts: number, tz: string): string {
  const p = wallClockParts(ts, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function describeSchedule(schedule: CronSchedule, displayTz: string): string {
  if (schedule.kind === "at") return `once at ${formatTime(schedule.at, displayTz)} (${displayTz})`;
  return `\`${schedule.expr}\` (${schedule.tz})`;
}

export function scheduleTimezone(schedule: CronSchedule, fallback: string): string {
  return schedule.kind === "cron" ? schedule.tz : fallback;
}

export function buildCronPrompt(job: CronJob, run: CronRunContext, displayTz: string): string {
  const tz = scheduleTimezone(job.schedule, displayTz);
  let header = `[Scheduled task "${job.name}" (id: ${job.id}) · run #${run.runNum} · ${formatTime(run.scheduledAt, tz)} ${tz}`;
  if (run.trigger === "manual") {
    header += " · triggered manually";
  } else if (run.startedAt - run.scheduledAt > 2 * 60 * 1000) {
    header += ` · delayed, started at ${formatTime(run.startedAt, tz)}`;
  }
  header += "]";

  return [
    header,
    "This run was started automatically by the scheduler and nobody is waiting at the keyboard. " +
      "Do not ask questions or wait for confirmation: complete the task and reply with the final result, which will be posted to the chat.",
    `If there is nothing worth reporting this time, reply with exactly ${SILENT_TOKEN} and nothing will be sent.`,
    "Files in the current working directory persist between runs of this task, so you can keep state there.",
    "---",
    job.prompt,
  ].join("\n");
}

export function isSilentOutput(output: string): boolean {
  return output.includes(SILENT_TOKEN);
}

/** Scheduled runs use a stable session id so each task keeps its own workspace directory. */
export function cronSessionId(jobId: string): string {
  return `cron-${jobId}`;
}
