import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { AgyEngineAdapter } from "../engines/agy/adapter.js";
import type { EngineEvent } from "../engines/types.js";
import type { Session } from "../sessions/types.js";

vi.mock("node:child_process", async importOriginal => ({
  ...await importOriginal<typeof import("node:child_process")>(),
  spawn: vi.fn(),
}));

const retry = 'API error (attempt 1): request failed: Post "https://example.invalid/model": EOF';
const answer = { event: "step_update", step_update: { step_type: "agent_response", state: "DONE", text_delta: "Recovered answer" } };

describe("AGY retry recovery", () => {
  let dir: string;
  let adapter: AgyEngineAdapter;
  let frames: Record<string, unknown>[];
  let closeWithoutResult = false;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-agy-recovery-"));
    frames = [];
    closeWithoutResult = false;
    vi.mocked(spawn).mockImplementation(() => {
      const child = new EventEmitter() as any;
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new Writable({ write(_chunk, _encoding, callback) {
        setImmediate(() => {
          for (const frame of frames) child.stdout.write(JSON.stringify(frame) + "\n");
          if (closeWithoutResult) child.stdout.end();
        });
        callback();
      } });
      child.killed = false;
      child.kill = () => {
        child.killed = true;
        child.stdout.end();
        child.stderr.end();
        child.stdin.end();
        child.emit("exit", 0, null);
        return true;
      };
      return child;
    });
    adapter = new AgyEngineAdapter({
      type: "agy", binary: "mock-agy", extraArgs: [], maxProcesses: 1,
      idleTimeoutMs: 60000, workspaceDir: join(dir, "workspaces"),
      apiPort: 18790, agentsDir: join(dir, "agents"),
    }, pino({level:"silent"}));
  });

  afterEach(async () => {
    await adapter.shutdown();
    vi.mocked(spawn).mockReset();
    rmSync(dir, { recursive: true, force: true });
  });

  const collect = async () => {
    const session: Session = {sessionId:"recovery", chatId:"test", channelType:"telegram", activeEngine:"agy", createdAt:0, lastActiveAt:0, isActive:true, sessionNum:1, turns:[]};
    const events: EngineEvent[] = [];
    for await (const event of adapter.sendMessage(session, "hello", "test-bot")) events.push(event);
    return events;
  };
  const result = (status: string, response = "", error?: string) => ({ event: "result", result: {status, response, ...(error ? {error} : {})} });

  it("waits through an API-attempt error for a successful terminal response", async () => {
    frames = [{event:"error", message:retry}, answer, result("SUCCESS", "Recovered answer")];
    const events = await collect();
    expect(events.filter(e => e.type === "error")).toEqual([]);
    expect(events.at(-1)).toEqual({type:"result", result:"Recovered answer", isError:false});
  });

  it("accepts the retained historical error when later response steps show recovery", async () => {
    frames = [{event:"error", message:retry}, answer, result("ERROR", "Recovered answer", retry)];
    const events = await collect();
    expect(events.filter(e => e.type === "error")).toEqual([]);
    expect(events.at(-1)).toEqual({type:"result", result:"Recovered answer", isError:false});
  });

  it("accepts a completed response whose result retains an API-attempt error", async () => {
    frames = [answer, result("ERROR", "Recovered answer", retry)];
    expect((await collect()).at(-1)).toEqual({type:"result", result:"Recovered answer", isError:false});
  });

  it("does not mistake text from before the failed attempt for recovery", async () => {
    frames = [answer, {event:"error", message:retry}, result("ERROR", "partial answer", retry)];
    const events = await collect();
    expect(events).toContainEqual({type:"error", message:retry});
    expect(events.at(-1)).toEqual({type:"result", result:"partial answer", isError:true});
  });

  it("keeps an unrecovered EOF as a failure", async () => {
    frames = [{event:"error", message:retry}, result("ERROR", "", retry)];
    const events = await collect();
    expect(events).toContainEqual({type:"error", message:retry});
    expect(events.at(-1)).toEqual({type:"result", result:"", isError:true});
  });

  it("does not hide a different terminal error behind response text", async () => {
    frames = [answer, result("ERROR", "partial answer", "Permission denied")];
    const events = await collect();
    expect(events).toContainEqual({type:"error", message:"Permission denied"});
    expect(events.at(-1)).toMatchObject({isError:true});
  });

  it("does not suppress a non-transport API error that has an attempt number", async () => {
    const denied = "API error (attempt 1): Permission denied";
    frames = [answer, result("ERROR", "partial answer", denied)];
    const events = await collect();
    expect(events).toContainEqual({type:"error", message:denied});
    expect(events.at(-1)).toMatchObject({isError:true});
  });

  it("keeps canceled responses as failures", async () => {
    frames = [result("CANCELED", "partial answer")];
    expect((await collect()).at(-1)).toMatchObject({isError:true});
  });

  it("reports an error when the process ends before a retry has a result", async () => {
    frames = [{event:"error", message:retry}];
    closeWithoutResult = true;
    const events = await collect();
    expect(events).toContainEqual({type:"error", message:retry});
    expect(events.at(-1)).toEqual({type:"result", isError:true});
  });
});
