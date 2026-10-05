import type { BackgroundJob } from "./types.js";

// Jobs shorter than this should have been run inline; the follow-up says so, to discourage it next time
const SHORT_JOB_MS = 60_000;

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function jobDuration(job: BackgroundJob, now = Date.now()): number | undefined {
  return job.startedAt !== undefined ? (job.finishedAt ?? now) - job.startedAt : undefined;
}

/** "succeeded", "failed (exit 2)", ... as shown to users. */
export function describeJobOutcome(job: BackgroundJob): string {
  switch (job.status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return job.exitCode !== undefined ? `failed (exit ${job.exitCode})` : "failed";
    case "timeout":
      return "timed out";
    case "lost":
      return "ended unexpectedly";
    default:
      return job.status;
  }
}

/**
 * The message the gateway sends the conversation when a job it started has exited, so the agent picks up
 * where it left off.
 */
export function buildJobCallbackPrompt(job: BackgroundJob, logTail: string, logPath: string): string {
  const duration = jobDuration(job);
  const took = duration !== undefined ? ` after ${formatDuration(duration)}` : "";
  let headline: string;
  switch (job.status) {
    case "succeeded":
      headline = `finished successfully (exit code 0)${took}`;
      break;
    case "failed":
      headline = `failed with exit code ${job.exitCode ?? "unknown"}${took}`;
      break;
    case "timeout":
      headline = `was stopped${took}: ${job.error ?? "it reached its time limit"}`;
      break;
    default:
      headline = `ended${took} without reporting an exit code; it may have been killed outside the gateway`;
  }
  const who = job.requester.senderName ?? "the user";

  const lines = [
    `[Background job #${job.seq} "${job.title}" ${headline}]`,
    `This message comes from the PocketAgent gateway, not from a person: it reports the background job you started for ${who}.`,
    `Command: ${job.command}`,
    `Working directory: ${job.cwd}`,
    `Full log: ${logPath}`,
    "Last lines of output:",
    "```",
    logTail || "(no output)",
    "```",
  ];
  if (job.then) lines.push(`What you planned to do next: ${job.then}`);
  lines.push(
    `Continue the work now. Your reply is posted to the chat as the answer to ${who}'s request; if the job failed, say what went wrong and what you did about it.`,
  );
  if (duration !== undefined && duration < SHORT_JOB_MS && job.status === "succeeded") {
    lines.push(
      `Note: this job took only ${formatDuration(duration)}. Commands that finish within a few minutes should be run directly, not as background jobs.`,
    );
  }
  return lines.join("\n");
}
