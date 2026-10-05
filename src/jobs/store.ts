import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BackgroundJob } from "./types.js";

export interface JobStoreData {
  // Last job number handed out per "<botId>:<chatId>", so numbers are never reused after old jobs are pruned
  seqs: Record<string, number>;
  jobs: BackgroundJob[];
}

/** Job records in jobs.json, plus each job's output log and exit-code file under logs/. */
export class JobStore {
  readonly logsDir: string;
  private path: string;

  constructor(private baseDir: string) {
    this.path = join(baseDir, "jobs.json");
    this.logsDir = join(baseDir, "logs");
  }

  load(): JobStoreData {
    if (!existsSync(this.path)) return { seqs: {}, jobs: [] };
    try {
      const data = JSON.parse(readFileSync(this.path, "utf-8")) as Partial<JobStoreData>;
      return {
        seqs: data.seqs && typeof data.seqs === "object" ? data.seqs : {},
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
      };
    } catch {
      return { seqs: {}, jobs: [] };
    }
  }

  save(data: JobStoreData): void {
    mkdirSync(this.baseDir, { recursive: true });
    const tmp = this.path + ".tmp";
    writeFileSync(tmp, JSON.stringify({ version: 1, ...data }, null, 2));
    renameSync(tmp, this.path);
  }

  logPath(jobId: string): string {
    return join(this.logsDir, `${jobId}.log`);
  }

  exitCodePath(jobId: string): string {
    return join(this.logsDir, `${jobId}.exit`);
  }
}
