import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CronJob, CronRunRecord } from "./types.js";

const MAX_RUNS_PER_JOB = 100;

interface JobsFile {
  version: 1;
  jobs: CronJob[];
}

export class CronStore {
  private jobsPath: string;
  private runsDir: string;

  constructor(private baseDir: string) {
    this.jobsPath = join(baseDir, "jobs.json");
    this.runsDir = join(baseDir, "runs");
  }

  loadJobs(): CronJob[] {
    if (!existsSync(this.jobsPath)) return [];
    try {
      const data = JSON.parse(readFileSync(this.jobsPath, "utf-8")) as Partial<JobsFile>;
      return Array.isArray(data.jobs) ? data.jobs : [];
    } catch {
      return [];
    }
  }

  saveJobs(jobs: CronJob[]): void {
    mkdirSync(this.baseDir, { recursive: true });
    const file: JobsFile = { version: 1, jobs };
    writeAtomic(this.jobsPath, JSON.stringify(file, null, 2));
  }

  appendRun(record: CronRunRecord): void {
    const runs = this.listRuns(record.jobId, MAX_RUNS_PER_JOB - 1);
    runs.push(record);
    mkdirSync(this.runsDir, { recursive: true });
    writeAtomic(this.runsPath(record.jobId), runs.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }

  /** Returns the most recent runs, oldest first. */
  listRuns(jobId: string, limit = MAX_RUNS_PER_JOB): CronRunRecord[] {
    const path = this.runsPath(jobId);
    if (!existsSync(path)) return [];
    const runs: CronRunRecord[] = [];
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        runs.push(JSON.parse(line) as CronRunRecord);
      } catch {}
    }
    return runs.slice(-limit);
  }

  deleteRuns(jobId: string): void {
    rmSync(this.runsPath(jobId), { force: true });
  }

  private runsPath(jobId: string): string {
    return join(this.runsDir, `${jobId}.jsonl`);
  }
}

function writeAtomic(path: string, content: string): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}
