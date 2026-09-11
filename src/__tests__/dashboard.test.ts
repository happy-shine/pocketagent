import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { saveConfig, parseConfig } from "../config/loader.js";
import { getDashboardHtml } from "../api/dashboard-html.js";
import { ApiServer } from "../api/server.js";

describe("PocketAgent Dashboard & Hot-Update System", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pa-dash-test-"));
    configPath = join(tempDir, "config.yaml");
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("exports a rich and complete dashboard HTML template", () => {
    const html = getDashboardHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("PocketAgent Dashboard");
    expect(html).toContain("Save & Hot Reload");
    expect(html).toContain("Overview");
    expect(html).toContain("Bots");
    expect(html).toContain("Engines");
    expect(html).toContain("Gateway");
    expect(html).toContain("Security & Auth");
    expect(html).toContain("Skills (3-CLI)");
    expect(html).toContain("Raw YAML");
  });

  it("saveConfig saves valid YAML and returns parsed config", () => {
    const validYaml = `
defaultEngine: agy
gateway:
  port: 18999
bots:
  - name: test-bot
    channel: telegram
    token: "999:TEST"
`;
    const res = saveConfig(configPath, validYaml);
    expect(res.ok).toBe(true);
    expect(res.config.defaultEngine).toBe("agy");
    expect(res.config.gateway.port).toBe(18999);
    expect(res.config.bots?.[0].name).toBe("test-bot");

    const savedContent = readFileSync(configPath, "utf-8");
    expect(savedContent).toBe(validYaml);
  });

  it("saveConfig rejects invalid YAML/schema cleanly", () => {
    const invalidYaml = `
gateway:
  port: "not-a-number"
`;
    const res = saveConfig(configPath, invalidYaml);
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("ApiServer serves dashboard HTML and config endpoints", async () => {
    const testPort = 19888;
    const initialYaml = `
defaultEngine: codex
gateway:
  port: ${testPort}
bots:
  - name: mock-bot
    channel: telegram
    token: "123:MOCK"
`;
    writeFileSync(configPath, initialYaml);
    let inMemoryConfig = parseConfig(initialYaml);

    const log = pino({ level: "silent" });
    const server = new ApiServer({
      port: testPort,
      getBotTelegram: () => undefined,
      dataDir: tempDir,
      log,
      configPath,
      getConfig: () => inMemoryConfig,
      onSaveConfig: async (newConfigOrYaml) => {
        const saved = saveConfig(configPath, newConfigOrYaml);
        if (!saved.ok) {
          return { ok: false, changes: [], error: saved.error };
        }
        inMemoryConfig = saved.config;
        return { ok: true, changes: ["Updated default engine and mock bot"] };
      },
      getBotsInfo: () => [
        {
          name: "mock-bot",
          channel: "telegram",
          botId: "123",
          username: "mock_test_bot",
          status: "online",
          engine: "codex",
          dmPolicy: "pairing",
          groupPolicy: "pairing",
          allowFrom: ["user1"],
          groups: {},
        },
      ],
      getPendingPairings: () => [
        {
          botName: "mock-bot",
          botId: "123",
          req: {
            senderId: "444555",
            senderName: "Alice",
            channelType: "telegram",
            chatId: "444555",
            code: "PAIR1234",
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
        },
      ],
      approvePairing: async (code) => {
        if (code === "PAIR1234") {
          return { ok: true, senderId: "444555", botName: "mock-bot" };
        }
        return { ok: false, error: "Invalid code" };
      },
    });

    await server.start();

    try {
      // 1. GET /
      const resHtml = await fetch(`http://127.0.0.1:${testPort}/`);
      expect(resHtml.status).toBe(200);
      const textHtml = await resHtml.text();
      expect(textHtml).toContain("PocketAgent Dashboard");

      // 2. GET /api/config
      const resCfg = await fetch(`http://127.0.0.1:${testPort}/api/config`);
      expect(resCfg.status).toBe(200);
      const dataCfg = await resCfg.json();
      expect(dataCfg.ok).toBe(true);
      expect(dataCfg.config.defaultEngine).toBe("codex");

      // 3. GET /api/status
      const resStatus = await fetch(`http://127.0.0.1:${testPort}/api/status`);
      expect(resStatus.status).toBe(200);
      const dataStatus = await resStatus.json();
      expect(dataStatus.gateway.status).toBe("online");
      expect(dataStatus.bots.length).toBe(1);
      expect(dataStatus.bots[0].name).toBe("mock-bot");

      // 4. POST /api/config (hot update)
      const updateRes = await fetch(`http://127.0.0.1:${testPort}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yaml: `
defaultEngine: agy
gateway:
  port: ${testPort}
bots:
  - name: updated-bot
    channel: telegram
    token: "777:NEW"
`,
        }),
      });
      expect(updateRes.status).toBe(200);
      const updateData = await updateRes.json();
      expect(updateData.ok).toBe(true);
      expect(updateData.changes).toContain("Updated default engine and mock bot");
      expect(updateData.config.defaultEngine).toBe("agy");

      // 5. GET /api/pairings
      const pairingsRes = await fetch(`http://127.0.0.1:${testPort}/api/pairings`);
      const pairingsData = await pairingsRes.json();
      expect(pairingsData.ok).toBe(true);
      expect(pairingsData.pending.length).toBe(1);
      expect(pairingsData.pending[0].req.code).toBe("PAIR1234");

      // 6. POST /api/pairings/approve
      const approveRes = await fetch(`http://127.0.0.1:${testPort}/api/pairings/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "PAIR1234" }),
      });
      const approveData = await approveRes.json();
      expect(approveData.ok).toBe(true);
      expect(approveData.senderId).toBe("444555");
    } finally {
      await server.stop();
    }
  });
});
