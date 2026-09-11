import { Bot, type Context, InputFile } from "grammy";
import type { Logger } from "pino";
import type { ChannelAdapter, OutboundMessage, MessageHandler, CommandHandler, InlineButton } from "../types.js";
import type { MessageStore } from "../../sessions/message-store.js";
import { createBot } from "./bot.js";
import { registerHandlers } from "./handlers.js";
import { splitMessage, stripHtml } from "./formatter.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class TelegramAdapter implements ChannelAdapter {
  readonly type = "telegram";
  private bot: Bot;
  private log: Logger;
  private token: string;
  private messageHandler?: MessageHandler;
  private commandHandlers = new Map<string, CommandHandler>();
  private callbackHandlers = new Map<string, (ctx: Context) => Promise<void>>();
  private stopped = false;
  private messageStore?: MessageStore;
  private botName: string;
  private outboundCallback?: (chatId: string, text: string, messageId: string) => void;
  username?: string;

  constructor(token: string, log: Logger) {
    this.token = token;
    this.log = log.child({ module: "telegram" });
    this.bot = createBot(token, this.log);
    this.botName = "PocketAgent";
  }

  setMessageStore(store: MessageStore, botName?: string): void {
    this.messageStore = store;
    if (botName) this.botName = botName;
  }

  private recordOutbound(chatId: string, messageId: string, text: string): void {
    if (!this.messageStore) return;
    if (!chatId.startsWith("-")) return;
    this.messageStore.append(chatId, {
      id: messageId,
      ts: Math.floor(Date.now() / 1000),
      sender: this.botName,
      senderId: this.token.split(":")[0],
      text,
    });
  }

  advanceCursorForSession(sessionId: string, messageId: string): void {
    this.messageStore?.advanceCursor(sessionId, messageId);
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onOutbound(cb: (chatId: string, text: string, messageId: string) => void): void {
    this.outboundCallback = cb;
  }

  notifyOutbound(chatId: string, text: string, messageId: string): void {
    this.outboundCallback?.(chatId, text, messageId);
  }

  onCommand(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command, handler);
  }

  onCallback(prefix: string, handler: (ctx: Context) => Promise<void>): void {
    this.callbackHandlers.set(prefix, handler);
  }

  getCallbackHandler(prefix: string): ((ctx: Context) => Promise<void>) | undefined {
    return this.callbackHandlers.get(prefix);
  }

  async start(): Promise<void> {
    registerHandlers(this.bot, this.messageHandler, this.commandHandlers, this.log, this.callbackHandlers);

    const commands = [
      { command: "engine", description: "Switch CLI engine (Claude / Codex / Antigravity)" },
      { command: "model", description: "Switch model for active engine" },
      { command: "effort", description: "Set reasoning depth for active engine" },
      { command: "status", description: "Show session & engine status" },
      { command: "new", description: "Start a new session" },
      { command: "sessions", description: "List or switch sessions" },
      { command: "title", description: "Set session title" },
      { command: "btw", description: "Quick side question without interrupting" },
      { command: "stop", description: "Interrupt current task" },
      { command: "help", description: "Show help" },
    ];

    const scopes = [
      undefined,
      { type: "all_group_chats" as const },
      { type: "all_private_chats" as const },
      { type: "all_chat_administrators" as const },
    ];

    for (const scope of scopes) {
      try {
        if (scope) {
          await this.bot.api.setMyCommands(commands, { scope });
        } else {
          await this.bot.api.setMyCommands(commands);
        }
      } catch (err) {
        this.log.warn({ error: err, scope }, "Failed to set Telegram bot commands for scope");
      }
    }

    let me;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        me = await this.bot.api.getMe();
        break;
      } catch (err) {
        this.log.warn(
          { attempt, error: err instanceof Error ? err.message : String(err) },
          `Connecting to Telegram API attempt ${attempt}/5 failed, retrying in 1.5s...`
        );
        if (attempt === 5) throw err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    this.username = me!.username;
    this.log.info({ username: this.username }, "Telegram bot started");

    this.bot.start({
      onStart: () => {
        this.log.info("Telegram polling started");
      },
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    await this.bot.stop();
    this.log.info("Telegram bot stopped");
  }

  async send(msg: OutboundMessage): Promise<string> {
    const chunks = splitMessage(msg.text);
    let lastMessageId = "";

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirst = i === 0;
      const replyId = isFirst && msg.replyToMessageId ? Number(msg.replyToMessageId) : undefined;
      const replyOpts = replyId ? { reply_parameters: { message_id: replyId } } : {};
      const parseOpts = msg.parseMode ? { parse_mode: msg.parseMode as "MarkdownV2" | "HTML" } : {};

      let sent;
      try {
        sent = await this.bot.api.sendMessage(msg.chatId, chunk, {
          ...parseOpts,
          ...replyOpts,
        });
      } catch (err) {
        if (msg.parseMode && err instanceof Error && err.message?.includes("can't parse entities")) {
          this.log.warn({ parseMode: msg.parseMode }, "parse failed in send, falling back to plain text");
          const fallback = msg.plainFallback ?? stripHtml(chunk);
          const fallbackChunks = splitMessage(fallback);
          sent = await this.bot.api.sendMessage(msg.chatId, (fallbackChunks[0] ?? fallback).slice(0, 4096), replyOpts);
        } else {
          this.log.error({ error: err, chunk }, "Failed to send message chunk");
          throw err;
        }
      }
      lastMessageId = String(sent.message_id);
      this.recordOutbound(msg.chatId, lastMessageId, chunk);
      this.outboundCallback?.(msg.chatId, chunk, lastMessageId);
    }

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (existsSync(att.path)) {
          const file = new InputFile(att.path);
          if (att.type === "photo") {
            const sent = await this.bot.api.sendPhoto(msg.chatId, file, { caption: att.caption });
            lastMessageId = String(sent.message_id);
          } else {
            const sent = await this.bot.api.sendDocument(msg.chatId, file, { caption: att.caption });
            lastMessageId = String(sent.message_id);
          }
        }
      }
    }

    return lastMessageId;
  }

  async sendWithButtons(
    chatId: string,
    text: string,
    buttonGrid: InlineButton[][],
    replyToMessageId?: string,
    parseMode?: "MarkdownV2" | "HTML",
    plainFallback?: string,
  ): Promise<string> {
    const keyboard = buttonGrid.map((row) =>
      row.map((btn) => ({ text: btn.text, callback_data: btn.data })),
    );
    const replyOpts = replyToMessageId ? { reply_parameters: { message_id: Number(replyToMessageId) } } : {};
    const parseOpts = parseMode ? { parse_mode: parseMode } : {};

    try {
      const sent = await this.bot.api.sendMessage(chatId, text, {
        ...parseOpts,
        ...replyOpts,
        reply_markup: { inline_keyboard: keyboard },
      });
      const id = String(sent.message_id);
      this.recordOutbound(chatId, id, text);
      return id;
    } catch (err) {
      if (parseMode && err instanceof Error && err.message?.includes("can't parse entities")) {
        this.log.warn({ parseMode }, "parse failed in sendWithButtons, falling back to plain text");
        const fallback = plainFallback ?? stripHtml(text);
        const sent = await this.bot.api.sendMessage(chatId, fallback.slice(0, 4096), {
          ...replyOpts,
          reply_markup: { inline_keyboard: keyboard },
        });
        const id = String(sent.message_id);
        this.recordOutbound(chatId, id, fallback);
        return id;
      }
      throw err;
    }
  }

  async editMessage(
    chatId: string,
    messageId: string,
    text: string,
    buttons?: string[],
    parseMode?: "MarkdownV2" | "HTML",
    plainFallback?: string,
  ): Promise<void> {
    const chunks = splitMessage(text);
    const firstChunk = chunks[0] || text;
    const replyMarkup = buttons && buttons.length > 0
      ? {
          inline_keyboard: [
            buttons.map((b) => ({ text: b, callback_data: b })),
          ],
        }
      : undefined;
    const parseOpts = parseMode ? { parse_mode: parseMode } : {};

    try {
      await this.bot.api.editMessageText(chatId, Number(messageId), firstChunk, {
        ...parseOpts,
        reply_markup: replyMarkup,
      });
      this.recordOutbound(chatId, messageId, firstChunk);
    } catch (err) {
      if (err instanceof Error && err.message?.includes("message is not modified")) return;
      if (parseMode && err instanceof Error && err.message?.includes("can't parse entities")) {
        this.log.warn({ parseMode }, "parse failed in editMessage, falling back to plain text");
        const fallbackText = (plainFallback ?? stripHtml(firstChunk)).slice(0, 4096);
        try {
          await this.bot.api.editMessageText(chatId, Number(messageId), fallbackText, {
            reply_markup: replyMarkup,
          });
          this.recordOutbound(chatId, messageId, fallbackText);
        } catch (e2: unknown) {
          if (e2 instanceof Error && !e2.message?.includes("message is not modified")) throw e2;
        }
      } else if (plainFallback) {
        try {
          const fallbackChunks = splitMessage(plainFallback);
          await this.bot.api.editMessageText(chatId, Number(messageId), fallbackChunks[0] || plainFallback, {
            reply_markup: replyMarkup,
          });
          this.recordOutbound(chatId, messageId, fallbackChunks[0] || plainFallback);
        } catch {
          // Ignore
        }
      }
    }

    if (chunks.length > 1) {
      for (let i = 1; i < chunks.length; i++) {
        try {
          const sent = await this.bot.api.sendMessage(chatId, chunks[i], parseOpts);
          this.recordOutbound(chatId, String(sent.message_id), chunks[i]);
        } catch (err) {
          if (parseMode && err instanceof Error && err.message?.includes("can't parse entities")) {
            const fallback = stripHtml(chunks[i]);
            const sent = await this.bot.api.sendMessage(chatId, fallback.slice(0, 4096));
            this.recordOutbound(chatId, String(sent.message_id), fallback);
          } else {
            // Ignore
          }
        }
      }
    }
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    try {
      await this.bot.api.deleteMessage(chatId, Number(messageId));
    } catch {
      // Ignore delete errors
    }
  }

  async sendPhoto(chatId: string, filePath: string, caption?: string): Promise<string> {
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const file = new InputFile(filePath);
    const sent = await this.bot.api.sendPhoto(chatId, file, { caption });
    const msgId = String(sent.message_id);
    this.recordOutbound(chatId, msgId, `[Photo] ${caption ?? ""}`);
    return msgId;
  }

  async sendDocument(chatId: string, filePath: string, caption?: string): Promise<string> {
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const file = new InputFile(filePath);
    const sent = await this.bot.api.sendDocument(chatId, file, { caption });
    const msgId = String(sent.message_id);
    this.recordOutbound(chatId, msgId, `[Document] ${caption ?? ""}`);
    return msgId;
  }

  async downloadFile(fileId: string, destDir: string, fileName?: string): Promise<string> {
    const file = await this.bot.api.getFile(fileId);
    const filePath = file.file_path;
    if (!filePath) throw new Error("Telegram returned no file_path");

    const url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to download: ${resp.status}`);

    const buffer = Buffer.from(await resp.arrayBuffer());
    const ext = filePath.includes(".") ? filePath.slice(filePath.lastIndexOf(".")) : "";
    const ts = Date.now();
    const idSuffix = fileId.slice(-8);
    const baseName = fileName
      ? fileName.replace(/(\.[^.]+)$/, `_${ts}_${idSuffix}$1`).replace(/^([^.]+)$/, `$1_${ts}_${idSuffix}`)
      : `${ts}_${idSuffix}${ext}`;
    const localPath = join(destDir, baseName);

    mkdirSync(destDir, { recursive: true });
    writeFileSync(localPath, buffer);
    return localPath;
  }

  async sendFile(chatId: string, filePath: string, caption?: string): Promise<void> {
    await this.sendDocument(chatId, filePath, caption);
  }

  async sendTyping(chatId: string): Promise<void> {
    try {
      await this.bot.api.sendChatAction(chatId, "typing");
    } catch {
      // Ignore
    }
  }
}
