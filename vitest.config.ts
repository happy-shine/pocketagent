import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Cold PowerShell startup and antivirus scans are slower on hosted Windows runners.
    testTimeout: process.platform === "win32" ? 20000 : 5000,
    hookTimeout: process.platform === "win32" ? 20000 : 10000,
    maxWorkers: process.platform === "win32" ? 1 : undefined,
    include: ["src/**/*.test.ts"],
    // The Grok adapter installs hooks under GROK_HOME; keep tests out of the real ~/.grok
    env: { GROK_HOME: join(tmpdir(), "pocketagent-test-grok-home") },
  },
});
