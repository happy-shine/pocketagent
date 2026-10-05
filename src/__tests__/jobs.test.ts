import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { buildJobCallbackPrompt } from "../jobs/format.js";
import { cleanTerminalOutput, readLastLogLine, readLogTail } from "../jobs/log.js";
import { JobManager } from "../jobs/manager.js";
import { JobStore } from "../jobs/store.js";
import type { BackgroundJob, JobInput, JobSettings } from "../jobs/types.js";

describe("JobManager", () => {
  let dir: string;
  let cwd: string;
  let settings: JobSettings;
  let finished: BackgroundJob[];
  const managers: JobManager[] = [];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-jobs-"));
    cwd = mkdtempSync(join(tmpdir(), "pa-jobs-cwd-"));
    settings = {
      enabled: true,
      maxConcurrent: 3,
      maxPerChat: 1,
      maxQueuedPerChat: 2,
      maxPerTurn: 2,
      defaultTimeoutMs: 60_000,
      maxTimeoutMs: 120_000,
      historyLimit: 50,
      pollIntervalMs: 30,
    };
    finished = [];
  });

  afterEach(() => {
    for (const m of managers.splice(0)) {
      for (const job of m.list({ activeOnly: true })) m.cancel(job.id);
      m.stop();
    }
    rmSync(dir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  function makeManager() {
    const manager = new JobManager({
      store: new JobStore(dir),
      log: pino({ level: "silent" }),
      getSettings: () => settings,
      onFinish: vi.fn(async (job: BackgroundJob) => {
        finished.push({ ...job });
        return "done" as const;
      }),
    });
    managers.push(manager);
    return manager;
  }

  const input = (command: string, over: Partial<JobInput> = {}): JobInput => ({
    botId: "bot1",
    chatId: "chat1",
    channelType: "discord",
    isGroup: true,
    title: "",
    command,
    cwd,
    requester: { senderId: "u1", senderName: "Alice" },
    ...over,
  });

  const waitFor = (fn: () => void) => vi.waitFor(fn, { timeout: 5000, interval: 20 });

  it("runs a command in its directory, logs its output and reports success", async () => {
    const manager = makeManager();
    manager.start();
    const { job } = manager.create(input("echo hello; pwd; echo $POCKETAGENT_JOB_ID; echo done > out.txt", { title: "Say hello", then: "Report" }));
    expect(job).toMatchObject({ seq: 1, status: "running", title: "Say hello", then: "Report" });
    expect(job!.pid).toBeGreaterThan(0);

    await waitFor(() => expect(manager.get(job!.id)!.status).toBe("succeeded"));
    expect(manager.get(job!.id)).toMatchObject({ exitCode: 0, callback: "done" });
    const log = manager.readLog(job!.id);
    expect(log).toContain("hello");
    expect(log).toContain(cwd.split("/").pop());
    expect(log).toContain(job!.id);
    expect(readFileSync(join(cwd, "out.txt"), "utf-8")).toBe("done\n");
    expect(finished).toHaveLength(1);
    expect(finished[0].status).toBe("succeeded");
  });

  it("reports a failing command with its exit code", async () => {
    const manager = makeManager();
    manager.start();
    const { job } = manager.create(input("echo oops >&2; exit 3"));
    await waitFor(() => expect(manager.get(job!.id)!.status).toBe("failed"));
    expect(manager.get(job!.id)).toMatchObject({ exitCode: 3, error: "Exited with code 3" });
    expect(manager.readLog(job!.id)).toContain("oops");
  });

  it("titles a job by its command when no title is given", () => {
    const manager = makeManager();
    expect(manager.create(input("  wget -c https://example.com/big.tar\n  && tar xf big.tar")).job!.title).toBe("wget -c https://example.com/big.tar");
  });

  it("validates the request", () => {
    const manager = makeManager();
    expect(manager.create(input("  ")).error).toBe("Missing command");
    expect(manager.create(input("ls", { cwd: "relative/dir" })).error).toMatch(/absolute/);
    expect(manager.create(input("ls", { cwd: join(cwd, "missing") })).error).toMatch(/does not exist/);
    expect(manager.create(input("ls", { timeoutMs: 999_999_999 })).error).toMatch(/longer than the limit/);
    settings.enabled = false;
    expect(manager.create(input("ls")).error).toBe("Background jobs are disabled");
  });

  it("queues jobs beyond a chat's limit and refuses more than it may hold", async () => {
    const manager = makeManager();
    manager.start();
    const a = manager.create(input("sleep 0.3")).job!;
    const b = manager.create(input("echo second")).job!;
    const other = manager.create(input("sleep 0.3", { chatId: "chat2" })).job!;
    expect([a.status, b.status, other.status]).toEqual(["running", "queued", "running"]);
    manager.create(input("echo third"));
    expect(manager.create(input("echo fourth")).error).toMatch(/already has 3 background jobs/);
    expect(manager.counts("bot1", "chat1")).toEqual({ running: 1, queued: 2 });

    await waitFor(() => expect(manager.get(b.id)!.status).toBe("succeeded"));
  });

  it("stops a running job together with the processes it started", async () => {
    const manager = makeManager();
    manager.start();
    const { job } = manager.create(input("sleep 30 & echo $! > child.pid; wait"));
    await waitFor(() => expect(existsSync(join(cwd, "child.pid"))).toBe(true));
    const childPid = Number(readFileSync(join(cwd, "child.pid"), "utf-8"));

    expect(manager.cancel(job!.id, "Bob")).toMatchObject({ ok: true });
    await waitFor(() => expect(manager.get(job!.id)!.status).toBe("cancelled"));
    expect(manager.get(job!.id)!.cancelledBy).toBe("Bob");
    expect(() => process.kill(childPid, 0)).toThrow();
    expect(manager.cancel(job!.id).error).toMatch(/already finished/);
  });

  it("drops a queued job without running it", () => {
    const manager = makeManager();
    manager.start();
    manager.create(input("sleep 0.5"));
    const queued = manager.create(input("touch should-not-exist")).job!;
    expect(manager.cancel(queued.id).ok).toBe(true);
    expect(manager.get(queued.id)).toMatchObject({ status: "cancelled", callback: "skipped" });
  });

  it("stops jobs that exceed their time limit", async () => {
    const manager = makeManager();
    manager.start();
    const { job } = manager.create(input("echo started; sleep 30", { timeoutMs: 200 }));
    await waitFor(() => expect(manager.get(job!.id)!.status).toBe("timeout"));
    expect(manager.get(job!.id)!.error).toMatch(/time limit/);
    expect(finished[0].status).toBe("timeout");
  });

  it("keeps jobs running across a gateway restart and reports them afterwards", async () => {
    const first = makeManager();
    first.start();
    const { job } = first.create(input("sleep 0.4; echo finished-after-restart"));
    first.stop();
    await new Promise((resolve) => setTimeout(resolve, 600));
    // Nothing was reported while no gateway was watching
    expect(finished).toHaveLength(0);

    const second = makeManager();
    expect(second.get(job!.id)!.status).toBe("running");
    second.start();
    await waitFor(() => expect(second.get(job!.id)!.status).toBe("succeeded"));
    expect(finished).toHaveLength(1);
    expect(second.readLog(job!.id)).toContain("finished-after-restart");
    // Numbers keep counting
    expect(second.create(input("true")).job!.seq).toBe(2);
  });

  it("retries a follow-up that a restart cut off", async () => {
    const first = new JobManager({
      store: new JobStore(dir),
      log: pino({ level: "silent" }),
      getSettings: () => settings,
      onFinish: () => new Promise(() => {}),
    });
    managers.push(first);
    first.start();
    const { job } = first.create(input("true"));
    await waitFor(() => expect(first.get(job!.id)).toMatchObject({ status: "succeeded", callback: "pending" }));
    first.stop();

    const second = makeManager();
    second.start();
    await waitFor(() => expect(second.get(job!.id)!.callback).toBe("done"));
    expect(finished.map((j) => j.id)).toEqual([job!.id]);
  });

  it("deletes finished jobs with their logs", async () => {
    const manager = makeManager();
    manager.start();
    const { job } = manager.create(input("echo hi"));
    expect(manager.remove(job!.id).error).toMatch(/still running/);
    await waitFor(() => expect(manager.get(job!.id)!.status).toBe("succeeded"));
    expect(existsSync(manager.logPath(job!.id))).toBe(true);
    expect(manager.remove(job!.id).ok).toBe(true);
    expect(manager.get(job!.id)).toBeUndefined();
    expect(existsSync(manager.logPath(job!.id))).toBe(false);
  });
});

describe("job logs", () => {
  it("shows progress bars the way a terminal would", () => {
    expect(cleanTerminalOutput("start\n 10%\r 50%\r 99%\rdone 100%\n\x1b[32mgreen\x1b[0m")).toEqual(["start", "done 100%", "green"]);
  });

  it("reads the tail and the latest line of a log", () => {
    const dir = mkdtempSync(join(tmpdir(), "pa-joblog-"));
    const path = join(dir, "a.log");
    writeFileSync(path, Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n") + "\n 12% eta 3m\r 47% eta 1m\r");
    expect(readLogTail(path, 3)).toBe("line 98\nline 99\n47% eta 1m".replace("47%", " 47%"));
    expect(readLastLogLine(path)).toBe("47% eta 1m");
    expect(readLogTail(join(dir, "missing.log"))).toBe("");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("job callback prompt", () => {
  const job: BackgroundJob = {
    id: "j1",
    seq: 4,
    botId: "b",
    chatId: "c",
    channelType: "discord",
    isGroup: true,
    title: "Download dataset",
    command: "wget -c https://x/data.tar",
    cwd: "/data",
    then: "Extract it and count the files",
    requester: { senderId: "u1", senderName: "Alice" },
    status: "succeeded",
    exitCode: 0,
    createdAt: 0,
    startedAt: 0,
    finishedAt: 750_000,
  };

  it("tells the agent how the job ended and what it planned next", () => {
    const prompt = buildJobCallbackPrompt(job, "saved data.tar", "/logs/j1.log");
    expect(prompt.split("\n")[0]).toBe('[Background job #4 "Download dataset" finished successfully (exit code 0) after 12m 30s]');
    expect(prompt).toContain("not from a person");
    expect(prompt).toContain("Command: wget -c https://x/data.tar");
    expect(prompt).toContain("saved data.tar");
    expect(prompt).toContain("What you planned to do next: Extract it and count the files");
    expect(prompt).not.toContain("took only");
  });

  it("points out jobs that were too short to need the background", () => {
    const prompt = buildJobCallbackPrompt({ ...job, finishedAt: 8000 }, "", "/logs/j1.log");
    expect(prompt).toContain("this job took only 8s");
    expect(prompt).toContain("(no output)");
  });

  it("describes failures", () => {
    expect(buildJobCallbackPrompt({ ...job, status: "failed", exitCode: 2 }, "", "/l")).toContain("failed with exit code 2");
    expect(buildJobCallbackPrompt({ ...job, status: "lost", exitCode: undefined }, "", "/l")).toContain("without reporting an exit code");
  });
});
