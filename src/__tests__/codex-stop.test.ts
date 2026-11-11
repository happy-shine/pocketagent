import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { CodexEngineAdapter } from "../engines/codex/adapter.js";
import type { EngineEvent } from "../engines/types.js";
import type { Session } from "../sessions/types.js";

// Stands in for `codex exec --json`: starts a thread and a command, then runs until Ctrl+C (SIGINT)
const FAKE_CODEX = `#!/usr/bin/env node
const out = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
process.stdin.resume();
process.stdin.on("end", () => {
  out({ type: "thread.started", thread_id: "thread-1" });
  out({ type: "item.started", item: { id: "i1", type: "command_execution", command: "sleep 600" } });
});
process.on("SIGINT", () => process.exit(130));
setInterval(() => {}, 1000);
`;

describe("Codex adapter /stop", () => {
  let testDir: string;
  let fakeCodex: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "pa-codex-stop-"));
    fakeCodex = join(testDir, "codex");
    writeFileSync(fakeCodex, FAKE_CODEX);
    chmodSync(fakeCodex, 0o755);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("interrupts the running turn and says so, but reports nothing to stop between turns", async () => {
    const adapter = new CodexEngineAdapter(
      {
        type: "codex",
        binary: fakeCodex,
        extraArgs: [],
        maxProcesses: 5,
        idleTimeoutMs: 60000,
        workspaceDir: join(testDir, "workspaces"),
        apiPort: 18790,
        agentsDir: join(testDir, "agents"),
      },
      pino({ level: "silent" }),
    );
    const session: Session = {
      sessionId: "s-codex",
      chatId: "chat-1",
      channelType: "telegram",
      activeEngine: "codex",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: 1,
      turns: [],
    };

    expect(adapter.sendControl(session.sessionId, { subtype: "interrupt" })).toBe(false);

    const events: EngineEvent[] = [];
    for await (const ev of adapter.sendMessage(session, "run it", "bot-1")) {
      events.push(ev);
      if (ev.type === "tool_started") expect(adapter.sendControl(session.sessionId, { subtype: "interrupt" })).toBe(true);
    }
    expect(events.some((e) => e.type === "tool_started")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "result", result: "(Interrupted)", isError: false });
    expect(adapter.sendControl(session.sessionId, { subtype: "interrupt" })).toBe(false);
    await adapter.shutdown();
  });
});
