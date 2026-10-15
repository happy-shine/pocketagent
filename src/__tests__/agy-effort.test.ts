import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { spawnCli as spawn } from "../runtime/process.js";
import { AgyEngineAdapter } from "../engines/agy/adapter.js";
import { discoverAgyCapabilities } from "../engines/agy/discovery.js";
import type { Session } from "../sessions/types.js";

vi.mock("../runtime/process.js", async (original) => ({
  ...await original<typeof import("../runtime/process.js")>(),
  spawnCli: vi.fn(),
}));

describe("Antigravity model and effort compatibility", () => {
  let dir: string;
  let adapter: AgyEngineAdapter;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-agy-effort-"));
    vi.mocked(spawn).mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
        killed: false, kill: vi.fn(() => true),
      });
      return child as unknown as ReturnType<typeof spawn>;
    });
    adapter = new AgyEngineAdapter({
      type: "agy", binary: "agy", extraArgs: [], maxProcesses: 1,
      idleTimeoutMs: 60000, workspaceDir: join(dir, "workspaces"),
      agentsDir: join(dir, "agents"), apiPort: 0,
    }, pino({ level: "silent" }));
  });
  afterEach(async () => {
    await adapter.shutdown();
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it.each(["low", "medium", "high"])("keeps a %s model consistent with stale session effort", (effort) => {
    const model = `gemini-3.8-flash-${effort}`;
    const session: Session = {
      sessionId: "test", chatId: "test", channelType: "telegram", activeEngine: "agy",
      engineModels: { agy: model }, engineEfforts: { agy: effort === "medium" ? "high" : "medium" },
      createdAt: 0, lastActiveAt: 0, isActive: true, sessionNum: 1, turns: [],
    };
    adapter.acquire(session, "bot");
    const args = vi.mocked(spawn).mock.calls[0][1] as string[];
    expect(args[args.indexOf("--model") + 1]).toBe(model);
    expect(args[args.indexOf("--effort") + 1]).toBe(effort);
    expect(session.effort).toBe(effort);
    expect(session.engineEfforts?.agy).toBe(effort);
  });

  it("offers only the effort encoded in a model instead of resetting high to medium", async () => {
    const caps = await discoverAgyCapabilities("missing-agy-test-executable", [], true);
    const high = caps.models.find((model) => model.id === "gemini-3.8-flash-high")!;
    expect(high.defaultEffort).toBe("high");
    expect(high.supportedEfforts?.map((effort) => effort.id)).toEqual(["high"]);
    expect(caps.models.find((model) => model.id === "claude-sonnet-4-6")?.supportedEfforts).toHaveLength(3);
  });
});
