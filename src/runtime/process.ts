import { spawnSync as nativeSpawnSync, type ChildProcess, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import crossSpawn from "cross-spawn";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

function cliCommand(command: string, args: string[], cwd?: string | URL): { command: string; args: string[] } {
  if (/\.[cm]?js$/i.test(command)) return { command: process.execPath, args: [command, ...args] };
  if (process.platform === "win32") {
    const base = cwd instanceof URL ? fileURLToPath(cwd) : cwd || process.cwd();
    const paths = isAbsolute(command) || /[\\/]/.test(command) ? [resolve(base, command)]
      : [base, ...(process.env.PATH || "").split(";")].map((dir) => join(dir.replace(/^"|"$/g, ""), command));
    const extensions = extname(command) ? [""] : (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";");
    let found: string | undefined;
    outer: for (const path of paths) for (const extension of extensions) {
      const candidate = path + extension;
      try { if (statSync(candidate).isFile()) { found = candidate; break outer; } } catch {}
    }
    if (found && /\.cmd$/i.test(found)) {
      const shim = readFileSync(found, "utf8");
      // Standard npm shims only dispatch to a Node entrypoint. Bypass cmd's 8191-char
      // limit: Grok's rules, for example, can be much longer than a shell command.
      if (/CALL :find_dp0/i.test(shim) && /node\.exe/i.test(shim)) {
        const relativeScript = shim.match(/%dp0%[\\/]([^"\r\n]+\.[cm]?js)"/i)?.[1];
        if (relativeScript) {
          const script = resolve(dirname(found), relativeScript);
          if (existsSync(script)) return { command: process.execPath, args: [script, ...args] };
        }
      }
    }
  }
  return { command, args };
}

/** Windows npm shims, PATHEXT and shebangs need more than Node's bare spawn. */
export function spawnCli(command: string, args: string[], options: SpawnOptions = {}): ChildProcess {
  const opts = { detached: process.platform !== "win32", ...options, windowsHide: true };
  const cli = cliCommand(command, args, options.cwd);
  return crossSpawn(cli.command, cli.args, opts);
}

export function spawnCliSync(command: string, args: string[], options: SpawnSyncOptions = {}) {
  const opts = { ...options, windowsHide: true };
  const cli = cliCommand(command, args, options.cwd);
  return crossSpawn.sync(cli.command, cli.args, opts);
}

/** Stop descendants too: killing cmd.exe alone leaves its CLI/tools running. */
export function stopProcessTree(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    nativeSpawnSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"),
      ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore", timeout: 5000 });
    return;
  }
  try { process.kill(-pid, signal); }
  catch { try { process.kill(pid, signal); } catch {} }
}

export function stopCli(child: ChildProcess, signal: NodeJS.Signals = "SIGTERM"): boolean {
  if (child.pid) stopProcessTree(child.pid, signal);
  // Also set ChildProcess.killed, and support mocked/non-detached processes.
  return child.kill(signal);
}

export async function execCli(command: string, args: string[], options: { timeout: number }): Promise<{ stdout: string }> {
  // Keep this independent of spawnCli so adapter mocks do not affect discovery.
  const cli = cliCommand(command, args);
  const child = crossSpawn(cli.command, cli.args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
  child.stderr?.resume();
  return new Promise((resolve, reject) => {
    let stdout = "";
    const timer = setTimeout(() => { stopCli(child); reject(new Error(`CLI timed out: ${command}`)); }, options.timeout);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 1024 * 1024) { stopCli(child); reject(new Error("CLI output exceeded 1 MiB")); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout });
      else reject(new Error(`CLI exited with code ${code}: ${command}`));
    });
  });
}
