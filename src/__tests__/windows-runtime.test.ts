import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import pino from "pino";
import { execCli, spawnCli, spawnCliSync } from "../runtime/process.js";
import { requestWindowsStop, startWindowsControl } from "../runtime/control.js";
import { platformApiExamples } from "../skills/platform-examples.js";
import { parseConfig } from "../config/loader.js";
import { Gateway } from "../gateway/gateway.js";
import { safeFileName } from "../runtime/filenames.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "pa Windows 空格-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("workspace access across platforms", () => {
  it("keeps attachment names valid and prevents separators from escaping the destination", () => {
    expect(safeFileName('../folder\\报告:Q4?.txt')).toBe('.._folder_报告_Q4_.txt');
    expect(safeFileName('CON.txt')).toBe('_CON.txt');
    expect(safeFileName('report.txt. ')).toBe('report.txt');
    expect(safeFileName('...')).toBe('attachment');
  });
  it("lists, reads and deletes contained workspaces while rejecting sibling and junction escapes", () => {
    const root = join(dir, "workspaces");
    const ws = join(root, "bot", "session");
    mkdirSync(join(ws, "nested"), { recursive: true });
    mkdirSync(`${ws}-other`, { recursive: true });
    writeFileSync(join(ws, "nested", "中文.txt"), "hello");
    writeFileSync(join(`${ws}-other`, "private.txt"), "secret");
    const gateway = new Gateway(parseConfig(`gateway:\n  dataDir: ${JSON.stringify(dir)}\nbots: []`), pino({ level: "silent" }));
    expect(gateway.getWorkspaceFiles(ws, "nested")[0].relPath).toBe("nested/中文.txt");
    expect(gateway.readWorkspaceFile(ws, "nested/中文.txt").content).toBe("hello");
    expect(() => gateway.getWorkspaceFiles(ws, "../session-other")).toThrow(/Access denied/);
    expect(() => gateway.readWorkspaceFile(ws, "../session-other/private.txt")).toThrow(/Access denied/);
    symlinkSync(dir, join(ws, "escape"), process.platform === "win32" ? "junction" : "dir");
    expect(() => gateway.getWorkspaceFiles(ws, "escape")).toThrow(/Access denied/);
    expect(() => gateway.deleteWorkspace(join(ws, "escape"))).toThrow(/Access denied/);
    expect(() => gateway.deleteWorkspace(root)).toThrow(/Access denied/);
    expect(() => gateway.deleteWorkspace(`${root}-other`)).toThrow(/Access denied/);
    expect(gateway.deleteWorkspace(ws)).toBe(true);
    expect(readFileSync(join(`${ws}-other`, "private.txt"), "utf8")).toBe("secret");
  });
});

describe.skipIf(process.platform !== "win32")("Windows runtime integration", () => {
  it("runs npm-style .cmd shims without losing quotes, Unicode or metacharacters", async () => {
    const cli = join(dir, "echo args.cjs");
    const shim = join(dir, "sample.cmd");
    writeFileSync(cli, "process.stdout.write(JSON.stringify(process.argv.slice(2)))");
    writeFileSync(shim, `@"${process.execPath}" "%~dp0echo args.cjs" %*\r\n`);
    const args = ["空格 and spaces", 'JSON {"key":"value"}', "a&b|c>d<e^f(g)", "", "trailing\\"];
    const sync = spawnCliSync(shim, args);
    expect(sync.status, String(sync.stderr)).toBe(0);
    expect(JSON.parse(String(sync.stdout))).toEqual(args);
    const result = await execCli(shim, args, { timeout: 5000 });
    expect(JSON.parse(result.stdout)).toEqual(args);
    // A standard global npm shim is dispatched directly through Node, beyond cmd's limit.
    writeFileSync(shim, '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nCALL :find_dp0\r\nIF EXIST "%dp0%\\node.exe" (SET "_prog=%dp0%\\node.exe") ELSE (SET "_prog=node")\r\n"%_prog%" "%dp0%\\echo args.cjs" %*\r\n');
    const long = [...args, "x".repeat(12000)];
    expect(JSON.parse((await execCli(shim, long, { timeout: 5000 })).stdout)).toEqual(long);
  });

  it("drains a named-pipe stop request only when its token matches", async () => {
    const stopped = vi.fn();
    const server = await startWindowsControl(dir, "test-only-token", stopped);
    try {
      expect(await requestWindowsStop(dir, process.pid, "wrong-token")).toBe(false);
      expect(stopped).not.toHaveBeenCalled();
      expect(await requestWindowsStop(dir, process.pid, "test-only-token")).toBe(true);
      await vi.waitFor(() => expect(stopped).toHaveBeenCalledTimes(1));
    } finally { await new Promise<void>((done) => server.close(() => done())); }
  });

  it("executes generated PowerShell HTTP examples with UTF-8 JSON and the session header", async () => {
    let received: { body: string; session?: string | string[] } | undefined;
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk.toString("utf8");
      received = { body, session: req.headers["x-pocketagent-session"] };
      res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    try {
      const port = (server.address() as { port: number }).port;
      const data = { text: "中文 O'Brien & quotes", path: "D:/测试/space dir" };
      const example = '```bash\ncurl -s -X POST "http://127.0.0.1:' + port + '/test" -H "X-PocketAgent-Session: $POCKETAGENT_SESSION_ID" \\\n  -d \'' + JSON.stringify(data) + "'\n```";
      const script = platformApiExamples(example).split("\n").slice(1, -1).join("\n");
      const file = join(dir, "request.ps1");
      writeFileSync(file, "\ufeff$ErrorActionPreference='Stop'\n" + script);
      const child = spawnCli("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file], { env: { ...process.env, POCKETAGENT_SESSION_ID: "session-test-only" } });
      let stderr = "";
      child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
      const code = await new Promise((done, reject) => { child.once("error", reject); child.once("close", done); });
      expect(code, stderr + "\n" + script).toBe(0);
      expect(JSON.parse(received!.body)).toEqual(data);
      expect(received!.session).toBe("session-test-only");
    } finally { await new Promise<void>((done) => server.close(() => done())); }
  });
});
