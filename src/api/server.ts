import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { Logger } from "pino";
import type { TelegramAdapter } from "../channels/telegram/adapter.js";
import type { MessageStore } from "../sessions/message-store.js";

export interface ApiServerConfig {
  port: number;
  getBotTelegram: (botId: string) => TelegramAdapter | undefined;
  dataDir: string;
  log: Logger;
  messageStore?: MessageStore;
  allowedChatIds?: Set<string>;
  onReloadConfig?: () => Promise<{ ok: boolean; changes: string[] }>;
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

    try {
      if (req.method === "POST" && url.pathname === "/api/send-file") {
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

    const telegram = botId ? this.config.getBotTelegram(botId) : undefined;
    if (!telegram) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or unknown bot_id" }));
      return;
    }

    const fileName = basename(filePath);
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    const photoExts = ["jpg", "jpeg", "png", "gif", "webp"];

    if (photoExts.includes(ext)) {
      await telegram.sendPhoto(chatId, filePath, caption);
    } else {
      await telegram.sendDocument(chatId, filePath, caption);
    }

    this.log.info({ chatId, filePath }, "Sent file to Telegram");
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

    const telegram = botId ? this.config.getBotTelegram(botId) : undefined;
    if (!telegram) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or unknown bot_id" }));
      return;
    }

    await telegram.send({ chatId, text });
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
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
