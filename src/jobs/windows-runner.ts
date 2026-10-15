/** Standalone Node bootstrap: works in compiled builds and source-based tests. */
export const WINDOWS_JOB_BOOTSTRAP = String.raw`
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const [scriptPath, exitPath] = process.argv.slice(1);
const shell = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const child = spawn(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
  windowsHide: true, stdio: ["ignore", "inherit", "inherit"],
});
child.once("error", (error) => { console.error(error.message); writeFileSync(exitPath, "1"); process.exitCode = 1; });
child.once("close", (code) => { writeFileSync(exitPath, String(code ?? 1)); process.exitCode = code ?? 1; });
`;
