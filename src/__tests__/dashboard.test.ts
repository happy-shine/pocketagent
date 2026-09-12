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
    expect(html).toContain("Sessions");
    expect(html).toContain("Workspaces");
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

  it("supports session and workspace management REST API endpoints", async () => {
    const testPort = 19889;
    const log = pino({ level: "silent" });

    let activeSessionId = "sess-1";
    const mockSessions = [
      {
        botId: "bot-1",
        botName: "TestBot",
        chatId: "chat-100",
        channelType: "telegram",
        sessionId: "sess-1",
        sessionNum: 1,
        activeEngine: "claude",
        model: "sonnet",
        effort: "high",
        isActive: true,
        turnCount: 2,
        createdAt: 1000,
        lastActiveAt: 2000,
        workspacePath: join(tempDir, "workspaces", "bot-1", "chat-100_sess-1"),
        workspaceExists: true,
      },
      {
        botId: "bot-1",
        botName: "TestBot",
        chatId: "chat-100",
        channelType: "telegram",
        sessionId: "sess-2",
        sessionNum: 2,
        activeEngine: "codex",
        isActive: false,
        turnCount: 0,
        createdAt: 2001,
        lastActiveAt: 2001,
        workspacePath: join(tempDir, "workspaces", "bot-1", "chat-100_sess-2"),
        workspaceExists: false,
      },
    ];

    const mockWorkspaces = [
      {
        id: "bot-1/chat-100_sess-1",
        path: join(tempDir, "workspaces", "bot-1", "chat-100_sess-1"),
        folderName: "chat-100_sess-1",
        botId: "bot-1",
        botName: "TestBot",
        chatId: "chat-100",
        sessionId: "sess-1",
        fileCount: 2,
        sizeBytes: 1024,
        mtime: Date.now(),
        isActiveSession: true,
        isKnownSession: true,
      },
    ];

    let deletedWsPath = "";
    let deletedSessionId = "";

    const server = new ApiServer({
      port: testPort,
      getBotTelegram: () => undefined,
      dataDir: tempDir,
      log,
      getAllSessions: () => mockSessions.map(s => ({ ...s, isActive: s.sessionId === activeSessionId })),
      getSessionTurns: (botId, chatId, sessionId) => {
        if (sessionId === "sess-1") {
          return {
            session: mockSessions[0],
            turns: [
              { id: "t1", ts: 1500, role: "user", text: "Hello agent" },
              { id: "t2", ts: 1600, role: "assistant", text: "Hello! How can I help?" },
            ],
          };
        }
        return null;
      },
      switchSession: (botId, chatId, sessionId) => {
        activeSessionId = sessionId;
        return { ok: true, session: { sessionId, active: true } };
      },
      createSession: (botId, chatId, engine) => {
        return { ok: true, session: { sessionId: "sess-3", chatId, engine } };
      },
      deleteSession: (botId, chatId, sessionId, deleteWs) => {
        deletedSessionId = sessionId;
        return { ok: true };
      },
      getAllWorkspaces: () => mockWorkspaces,
      getWorkspaceFiles: (wsPath) => [
        { name: "CLAUDE.md", relPath: "CLAUDE.md", isDir: false, size: 512, mtime: 1000 },
        { name: "AGENTS.md", relPath: "AGENTS.md", isDir: false, size: 512, mtime: 1000 },
      ],
      readWorkspaceFile: (wsPath, filePath) => ({
        content: "# Test File Content",
        size: 19,
        mtime: 1000,
      }),
      deleteWorkspace: (wsPath) => {
        deletedWsPath = wsPath;
        return true;
      },
    });

    await server.start();

    try {
      // 1. GET /api/sessions
      const resSessions = await fetch(`http://127.0.0.1:${testPort}/api/sessions`);
      expect(resSessions.status).toBe(200);
      const dataSessions = await resSessions.json();
      expect(dataSessions.ok).toBe(true);
      expect(dataSessions.sessions.length).toBe(2);
      expect(dataSessions.sessions[0].isActive).toBe(true);

      // 2. GET /api/sessions/turns
      const resTurns = await fetch(`http://127.0.0.1:${testPort}/api/sessions/turns?botId=bot-1&chatId=chat-100&sessionId=sess-1`);
      expect(resTurns.status).toBe(200);
      const dataTurns = await resTurns.json();
      expect(dataTurns.ok).toBe(true);
      expect(dataTurns.turns.length).toBe(2);
      expect(dataTurns.turns[0].text).toBe("Hello agent");

      // 3. POST /api/sessions/switch
      const resSwitch = await fetch(`http://127.0.0.1:${testPort}/api/sessions/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: "bot-1", chatId: "chat-100", sessionId: "sess-2" }),
      });
      expect(resSwitch.status).toBe(200);
      const dataSwitch = await resSwitch.json();
      expect(dataSwitch.ok).toBe(true);
      expect(activeSessionId).toBe("sess-2");

      // 4. POST /api/sessions/new
      const resNew = await fetch(`http://127.0.0.1:${testPort}/api/sessions/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: "bot-1", chatId: "chat-100", engine: "agy" }),
      });
      expect(resNew.status).toBe(200);
      const dataNew = await resNew.json();
      expect(dataNew.ok).toBe(true);
      expect(dataNew.session.engine).toBe("agy");

      // 5. DELETE /api/sessions
      const resDelSession = await fetch(`http://127.0.0.1:${testPort}/api/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: "bot-1", chatId: "chat-100", sessionId: "sess-2" }),
      });
      expect(resDelSession.status).toBe(200);
      expect(deletedSessionId).toBe("sess-2");

      // 6. GET /api/workspaces
      const resWs = await fetch(`http://127.0.0.1:${testPort}/api/workspaces`);
      expect(resWs.status).toBe(200);
      const dataWs = await resWs.json();
      expect(dataWs.ok).toBe(true);
      expect(dataWs.workspaces.length).toBe(1);
      expect(dataWs.workspaces[0].folderName).toBe("chat-100_sess-1");

      // 7. GET /api/workspaces/files
      const resWsFiles = await fetch(`http://127.0.0.1:${testPort}/api/workspaces/files?path=${encodeURIComponent(mockWorkspaces[0].path)}`);
      expect(resWsFiles.status).toBe(200);
      const dataWsFiles = await resWsFiles.json();
      expect(dataWsFiles.ok).toBe(true);
      expect(dataWsFiles.files.length).toBe(2);

      // 8. GET /api/workspaces/file-content
      const resFileContent = await fetch(`http://127.0.0.1:${testPort}/api/workspaces/file-content?path=${encodeURIComponent(mockWorkspaces[0].path)}&file=CLAUDE.md`);
      expect(resFileContent.status).toBe(200);
      const dataFileContent = await resFileContent.json();
      expect(dataFileContent.ok).toBe(true);
      expect(dataFileContent.content).toContain("Test File Content");

      // 9. DELETE /api/workspaces
      const resDelWs = await fetch(`http://127.0.0.1:${testPort}/api/workspaces`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: mockWorkspaces[0].path }),
      });
      expect(resDelWs.status).toBe(200);
      expect(deletedWsPath).toBe(mockWorkspaces[0].path);
    } finally {
      await server.stop();
    }
  });
});
