import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { Logger } from "pino";
import type { TelegramAdapter } from "../channels/telegram/adapter.js";
import type { ChannelAdapter } from "../channels/types.js";
import type { MessageStore } from "../sessions/message-store.js";
import type { GatewayConfig } from "../config/types.js";
import type { EngineManager } from "../engines/manager.js";
import { SkillRegistry } from "../skills/index.js";
import { getDashboardHtml } from "./dashboard-html.js";

export interface ApiServerConfig {
  port: number;
  getBotTelegram: (botId: string) => TelegramAdapter | undefined;
  getBotChannel?: (botId: string) => ChannelAdapter | undefined;
  dataDir: string;
  log: Logger;
  messageStore?: MessageStore;
  allowedChatIds?: Set<string>;
  configPath?: string;
  getConfig?: () => GatewayConfig;
  onSaveConfig?: (newConfigOrYaml: GatewayConfig | string) => Promise<{ ok: boolean; changes: string[]; error?: string }>;
  onReloadConfig?: () => Promise<{ ok: boolean; changes: string[] }>;
  getBotsInfo?: () => Array<{
    name: string;
    channel: "telegram" | "discord";
    botId: string;
    username?: string;
    status: "online" | "stopped" | "error";
    engine: string;
    model?: string;
    effort?: string;
    dmPolicy: string;
    groupPolicy: string;
    guildPolicy?: string;
    allowFrom: string[];
    groups: Record<string, any>;
  }>;
  getEngineManager?: () => EngineManager;
  getPendingPairings?: () => Array<{ botName: string; botId: string; req: any }>;
  approvePairing?: (code: string) => Promise<{ ok: boolean; senderId?: string; botName?: string; error?: string }>;
  getAllSessions?: () => any[];
  getSessionTurns?: (botId: string, chatId: string, sessionId: string) => any;
  switchSession?: (botId: string, chatId: string, sessionId: string) => { ok: boolean; session?: any; error?: string };
  createSession?: (botId: string, chatId: string, engine?: any, model?: string, effort?: string, title?: string) => { ok: boolean; session?: any; error?: string };
  deleteSession?: (botId: string, chatId: string, sessionId: string, deleteWorkspace?: boolean) => { ok: boolean; error?: string };
  getAllWorkspaces?: () => any[];
  getWorkspaceFiles?: (workspacePath: string, subDir?: string) => any[];
  readWorkspaceFile?: (workspacePath: string, filePath: string) => { content: string; size: number; mtime: number };
  deleteWorkspace?: (workspacePath: string) => boolean;
}

export class ApiServer {
  private server: Server;
  private config: ApiServerConfig;
  private log: Logger;

  constructor(config: ApiServerConfig) {
    this.config = config;
    this.log = config.log.child({ module: "api" });
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, "127.0.0.1", () => {
        this.log.info({ port: this.config.port }, "API server listening");
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.config.port}`);

    // Enable local CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        if (req.method === "HEAD") {
          res.end();
        } else {
          res.end(getDashboardHtml());
        }
      } else if (req.method === "GET" && url.pathname === "/api/config") {
        await this.handleGetConfig(res);
      } else if ((req.method === "POST" || req.method === "PUT") && url.pathname === "/api/config") {
        await this.handleSaveConfig(req, res);
      } else if (req.method === "GET" && url.pathname === "/api/status") {
        await this.handleGetStatus(res);
      } else if (req.method === "GET" && url.pathname === "/api/models") {
        await this.handleGetModels(res, url);
      } else if (req.method === "GET" && url.pathname === "/api/skills") {
        await this.handleGetSkills(res);
      } else if (req.method === "GET" && url.pathname === "/api/skills/detail") {
        await this.handleGetSkillDetail(res, url);
      } else if (req.method === "POST" && url.pathname === "/api/skills/sync") {
        await this.handleSyncSkills(res);
      } else if (req.method === "POST" && url.pathname === "/api/skills/new") {
        await this.handleNewSkill(req, res);
      } else if (req.method === "POST" && url.pathname === "/api/skills/update") {
        await this.handleUpdateSkill(req, res);
      } else if (req.method === "DELETE" && url.pathname === "/api/skills") {
        await this.handleDeleteSkill(req, res, url);
      } else if (req.method === "GET" && url.pathname === "/api/pairings") {
        await this.handleGetPairings(res);
      } else if (req.method === "POST" && url.pathname === "/api/pairings/approve") {
        await this.handleApprovePairing(req, res);
      } else if (req.method === "POST" && url.pathname === "/api/send-file") {
        await this.handleSendFile(req, res, url);
      } else if (req.method === "POST" && url.pathname === "/api/send-message") {
        await this.handleSendMessage(req, res, url);
      } else if (url.pathname === "/api/soul") {
        await this.handleSoul(req, res, url);
      } else if (req.method === "GET" && url.pathname === "/api/chat-history") {
        await this.handleChatHistory(res, url);
      } else if (req.method === "POST" && url.pathname === "/api/download-file") {
        await this.handleDownloadFile(res, url);
      } else if (req.method === "POST" && url.pathname === "/api/reload-config") {
        await this.handleReloadConfig(res);
      } else if (req.method === "GET" && url.pathname === "/api/sessions") {
        await this.handleGetSessions(res, url);
      } else if (req.method === "GET" && url.pathname === "/api/sessions/turns") {
        await this.handleGetSessionTurns(res, url);
      } else if (req.method === "POST" && url.pathname === "/api/sessions/switch") {
        await this.handleSwitchSession(req, res);
      } else if (req.method === "POST" && url.pathname === "/api/sessions/new") {
        await this.handleNewSession(req, res);
      } else if (req.method === "DELETE" && url.pathname === "/api/sessions") {
        await this.handleDeleteSession(req, res, url);
      } else if (req.method === "GET" && url.pathname === "/api/workspaces") {
        await this.handleGetWorkspaces(res, url);
      } else if (req.method === "GET" && url.pathname === "/api/workspaces/files") {
        await this.handleGetWorkspaceFiles(res, url);
      } else if (req.method === "GET" && url.pathname === "/api/workspaces/file-content") {
        await this.handleGetWorkspaceFileContent(res, url);
      } else if ((req.method === "DELETE" || req.method === "POST") && url.pathname === "/api/workspaces/delete") {
        await this.handleDeleteWorkspace(req, res, url);
      } else if (req.method === "DELETE" && url.pathname === "/api/workspaces") {
        await this.handleDeleteWorkspace(req, res, url);
      } else if (req.method === "GET" && url.pathname === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    } catch (err) {
      this.log.error({ error: err instanceof Error ? err.message : String(err) }, "API error");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  private async handleGetConfig(res: ServerResponse): Promise<void> {
    const cfg = this.config.getConfig?.();
    const cfgPath = this.config.configPath ?? join(this.config.dataDir, "config.yaml");
    let yamlStr = "";
    if (existsSync(cfgPath)) {
      yamlStr = readFileSync(cfgPath, "utf-8");
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      config: cfg,
      yaml: yamlStr,
      configPath: cfgPath,
    }));
  }

  private async handleSaveConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.config.onSaveConfig) {
      res.writeHead(501, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Save config not configured" }));
      return;
    }

    const body = await readBody(req);
    let payload: GatewayConfig | string;
    try {
      const parsed = JSON.parse(body);
      payload = parsed.yaml !== undefined ? parsed.yaml : (parsed.config !== undefined ? parsed.config : parsed);
    } catch {
      payload = body;
    }

    const result = await this.config.onSaveConfig(payload);
    if (!result.ok) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: result.error, changes: result.changes }));
      return;
    }

    const cfgPath = this.config.configPath ?? join(this.config.dataDir, "config.yaml");
    const yamlStr = existsSync(cfgPath) ? readFileSync(cfgPath, "utf-8") : "";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      changes: result.changes,
      config: this.config.getConfig?.(),
      yaml: yamlStr,
    }));
  }

  private async handleGetStatus(res: ServerResponse): Promise<void> {
    const cfg = this.config.getConfig?.();
    const defaultEngine = cfg?.defaultEngine ?? cfg?.engine ?? cfg?.engines?.default ?? "claude";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      gateway: {
        status: "online",
        port: this.config.port,
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        configPath: this.config.configPath ?? join(this.config.dataDir, "config.yaml"),
      },
      bots: this.config.getBotsInfo?.() ?? [],
      defaultEngine,
    }));
  }

  private async handleGetModels(res: ServerResponse, url: URL): Promise<void> {
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const em = this.config.getEngineManager?.();
    const capabilities = em ? await em.getAllCapabilities(forceRefresh) : {};
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, capabilities }));
  }

  private async handleGetSkills(res: ServerResponse): Promise<void> {
    try {
      const reg = SkillRegistry.getInstance();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, hubDir: reg.hubDir, skills: reg.list() }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleSyncSkills(res: ServerResponse): Promise<void> {
    try {
      const reg = SkillRegistry.getInstance();
      const skills = reg.sync();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, skills }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleNewSkill(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = JSON.parse(await readBody(req));
      if (!body.name) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Skill name is required" }));
        return;
      }
      const reg = SkillRegistry.getInstance();
      const skill = reg.createSkill(body.name, body.description ?? "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, skill }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleGetSkillDetail(res: ServerResponse, url: URL): Promise<void> {
    const name = url.searchParams.get("name") ?? "";
    if (!name) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing skill name" }));
      return;
    }
    try {
      const reg = SkillRegistry.getInstance();
      const detail = reg.getSkill(name);
      if (!detail) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: `Skill "${name}" not found` }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...detail }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleUpdateSkill(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = JSON.parse(await readBody(req));
      const { name, skillMd } = body;
      if (!name || typeof skillMd !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Missing skill name or skillMd content" }));
        return;
      }
      const reg = SkillRegistry.getInstance();
      const updated = reg.updateSkill(name, skillMd);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, skill: updated }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleDeleteSkill(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      let name = url.searchParams.get("name") ?? "";
      if (!name) {
        const body = await readBody(req);
        if (body) {
          try {
            const parsed = JSON.parse(body);
            name = parsed.name ?? "";
          } catch {}
        }
      }
      if (!name) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Missing skill name" }));
        return;
      }
      const reg = SkillRegistry.getInstance();
      const ok = reg.deleteSkill(name);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok, deleted: name }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleGetPairings(res: ServerResponse): Promise<void> {
    const pending = this.config.getPendingPairings?.() ?? [];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, pending }));
  }

  private async handleApprovePairing(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = JSON.parse(await readBody(req));
      if (!body.code) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Pairing code is required" }));
        return;
      }
      const result = await (this.config.approvePairing?.(body.code) ?? Promise.resolve({ ok: false, error: "Pairing not supported" }));
      res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }

  private async handleSendFile(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const chatId = url.searchParams.get("chat_id");
    const filePath = url.searchParams.get("file_path");
    const botId = url.searchParams.get("bot_id");
    const caption = url.searchParams.get("caption") ?? undefined;

    if (!chatId || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing chat_id or file_path" }));
      return;
    }

    const channel = botId ? (this.config.getBotChannel?.(botId) ?? this.config.getBotTelegram(botId)) : undefined;
    if (!channel) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or unknown bot_id" }));
      return;
    }

    const fileName = basename(filePath);
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    const photoExts = ["jpg", "jpeg", "png", "gif", "webp"];

    await channel.send({
      chatId,
      text: caption ?? "",
      attachments: [{
        type: photoExts.includes(ext) ? "photo" : "file",
        path: filePath,
        caption,
      }],
    });

    this.log.info({ chatId, filePath }, "Sent file to channel");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, file: fileName }));
  }

  private async handleSendMessage(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const chatId = url.searchParams.get("chat_id");
    const botId = url.searchParams.get("bot_id");
    let text = url.searchParams.get("text");

    if (!text) {
      const body = await readBody(req);
      try {
        const json = JSON.parse(body);
        text = json.text;
      } catch {}
    }

    if (!chatId || !text) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing chat_id or text" }));
      return;
    }

    const channel = botId ? (this.config.getBotChannel?.(botId) ?? this.config.getBotTelegram(botId)) : undefined;
    if (!channel) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or unknown bot_id" }));
      return;
    }

    await channel.send({ chatId, text });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  }

  private async handleSoul(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const botId = url.searchParams.get("bot_id");
    if (!botId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing bot_id" }));
      return;
    }

    const agentsDir = join(this.config.dataDir, "agents");
    const soulPath = join(agentsDir, botId, "SOUL.md");

    if (req.method === "GET") {
      let content: string | null = null;
      if (existsSync(soulPath)) {
        content = readFileSync(soulPath, "utf-8");
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, content }));
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await readBody(req);
      let content: string;
      try {
        content = JSON.parse(body).content;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body, expected {content: string}" }));
        return;
      }
      mkdirSync(join(agentsDir, botId), { recursive: true });
      writeFileSync(soulPath, content, "utf-8");
      this.log.info({ botId, soulPath }, "SOUL.md updated");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "DELETE") {
      if (existsSync(soulPath)) {
        unlinkSync(soulPath);
        this.log.info({ botId }, "SOUL.md deleted");
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  private async handleChatHistory(res: ServerResponse, url: URL): Promise<void> {
    const chatId = url.searchParams.get("chat_id");
    if (!chatId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing chat_id" }));
      return;
    }

    if (!this.config.messageStore) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, count: 0, messages: [] }));
      return;
    }

    const limit = Number(url.searchParams.get("limit") ?? "50");
    const sender = url.searchParams.get("sender") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;

    const messages = this.config.messageStore.query({
      chatId,
      limit,
      sender,
      search,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, count: messages.length, messages }));
  }

  private async handleReloadConfig(res: ServerResponse): Promise<void> {
    if (!this.config.onReloadConfig) {
      res.writeHead(501, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Reload not configured" }));
      return;
    }
    const result = await this.config.onReloadConfig();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  }

  private async handleDownloadFile(res: ServerResponse, url: URL): Promise<void> {
    const botId = url.searchParams.get("bot_id");
    const fileId = url.searchParams.get("file_id");
    const destDir = url.searchParams.get("dest_dir");

    if (!botId || !fileId || !destDir) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing bot_id, file_id, or dest_dir" }));
      return;
    }

    const telegram = this.config.getBotTelegram(botId);
    if (!telegram) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Bot ${botId} not found` }));
      return;
    }

    try {
      mkdirSync(destDir, { recursive: true });
      const localPath = await telegram.downloadFile(fileId, destDir);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, local_path: localPath }));
    } catch (err) {
      this.log.error({ error: err }, "Download file failed");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to download file" }));
    }
  }

  private async handleGetSessions(res: ServerResponse, url: URL): Promise<void> {
    const botIdFilter = url.searchParams.get("botId");
    const chatIdFilter = url.searchParams.get("chatId");
    let sessions = this.config.getAllSessions?.() ?? [];
    if (botIdFilter) {
      sessions = sessions.filter((s: any) => s.botId === botIdFilter);
    }
    if (chatIdFilter) {
      sessions = sessions.filter((s: any) => s.chatId === chatIdFilter);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, sessions }));
  }

  private async handleGetSessionTurns(res: ServerResponse, url: URL): Promise<void> {
    const botId = url.searchParams.get("botId") ?? "";
    const chatId = url.searchParams.get("chatId") ?? "";
    const sessionId = url.searchParams.get("sessionId") ?? "";
    if (!botId || !chatId || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing botId, chatId, or sessionId" }));
      return;
    }
    const result = this.config.getSessionTurns?.(botId, chatId, sessionId);
    if (!result) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Session or turns not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...result }));
  }

  private async handleSwitchSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req);
    let botId = "";
    let chatId = "";
    let sessionId = "";
    try {
      const parsed = JSON.parse(body);
      botId = parsed.botId;
      chatId = parsed.chatId;
      sessionId = parsed.sessionId;
    } catch {}
    if (!botId || !chatId || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing botId, chatId, or sessionId" }));
      return;
    }
    const result = this.config.switchSession?.(botId, chatId, sessionId) ?? { ok: false, error: "Not supported" };
    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  }

  private async handleNewSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readBody(req);
    let botId = "";
    let chatId = "";
    let engine: any;
    let model: string | undefined;
    let effort: string | undefined;
    let title: string | undefined;
    try {
      const parsed = JSON.parse(body);
      botId = parsed.botId;
      chatId = parsed.chatId;
      engine = parsed.engine;
      model = parsed.model;
      effort = parsed.effort;
      title = parsed.title;
    } catch {}
    if (!botId || !chatId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing botId or chatId" }));
      return;
    }
    const result = this.config.createSession?.(botId, chatId, engine, model, effort, title) ?? { ok: false, error: "Not supported" };
    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  }

  private async handleDeleteSession(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    let botId = url.searchParams.get("botId") ?? "";
    let chatId = url.searchParams.get("chatId") ?? "";
    let sessionId = url.searchParams.get("sessionId") ?? "";
    let deleteWorkspace = url.searchParams.get("deleteWorkspace") === "true";

    if (!botId || !chatId || !sessionId) {
      try {
        const body = await readBody(req);
        if (body) {
          const parsed = JSON.parse(body);
          if (parsed.botId) botId = parsed.botId;
          if (parsed.chatId) chatId = parsed.chatId;
          if (parsed.sessionId) sessionId = parsed.sessionId;
          if (parsed.deleteWorkspace !== undefined) deleteWorkspace = Boolean(parsed.deleteWorkspace);
        }
      } catch {}
    }

    if (!botId || !chatId || !sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing botId, chatId, or sessionId" }));
      return;
    }

    const result = this.config.deleteSession?.(botId, chatId, sessionId, deleteWorkspace) ?? { ok: false, error: "Not supported" };
    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  }

  private async handleGetWorkspaces(res: ServerResponse, url: URL): Promise<void> {
    const botIdFilter = url.searchParams.get("botId");
    let workspaces = this.config.getAllWorkspaces?.() ?? [];
    if (botIdFilter) {
      workspaces = workspaces.filter((w: any) => w.botId === botIdFilter);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, workspaces }));
  }

  private async handleGetWorkspaceFiles(res: ServerResponse, url: URL): Promise<void> {
    const wsPath = url.searchParams.get("path") ?? "";
    const subDir = url.searchParams.get("subDir") ?? "";
    if (!wsPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing path parameter" }));
      return;
    }
    try {
      const files = this.config.getWorkspaceFiles?.(wsPath, subDir) ?? [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: wsPath, subDir, files }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  private async handleGetWorkspaceFileContent(res: ServerResponse, url: URL): Promise<void> {
    const wsPath = url.searchParams.get("path") ?? "";
    const filePath = url.searchParams.get("file") ?? "";
    if (!wsPath || !filePath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing path or file parameter" }));
      return;
    }
    try {
      const data = this.config.readWorkspaceFile?.(wsPath, filePath);
      if (!data) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "File not found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...data, filePath }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  private async handleDeleteWorkspace(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    let wsPath = url.searchParams.get("path") ?? "";
    if (!wsPath) {
      try {
        const body = await readBody(req);
        if (body) {
          const parsed = JSON.parse(body);
          if (parsed.path) wsPath = parsed.path;
        }
      } catch {}
    }
    if (!wsPath) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Missing path parameter" }));
      return;
    }
    try {
      const ok = this.config.deleteWorkspace?.(wsPath);
      res.writeHead(ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok, message: ok ? "Workspace deleted" : "Failed to delete workspace" }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
