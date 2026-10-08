import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The Grok adapter installs hooks under GROK_HOME; keep tests out of the real ~/.grok
    env: { GROK_HOME: join(tmpdir(), "pocketagent-test-grok-home") },
  },
});
