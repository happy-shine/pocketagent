import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "pino";
import { checkAccess } from "../auth/access.js";
import { PairingManager } from "../auth/pairing.js";
import { TelegramAdapter } from "../channels/telegram/adapter.js";
import { DiscordAdapter } from "../channels/discord/adapter.js";
import type { ChannelAdapter, InboundMessage, InlineButton } from "../channels/types.js";
import type { GatewayConfig, ResolvedBotConfig } from "../config/types.js";
import { EngineManager } from "../engines/manager.js";
import type { EngineType, ModelInfo, EffortInfo } from "../engines/types.js";
import { ProgressTracker } from "../progress/progress.js";
import { SessionManager } from "../sessions/manager.js";
import { SessionStore } from "../sessions/store.js";
import type { MessageStore } from "../sessions/message-store.js";
import type { Session } from "../sessions/types.js";

const SESSIONS_PER_PAGE = 10;

export class BotInstance {
  readonly botId: string;
  readonly name: string;
  readonly config: ResolvedBotConfig;
  readonly telegram?: TelegramAdapter;
  readonly discord?: DiscordAdapter;
  private sessionManager: SessionManager;
  private pairingManager: PairingManager;
  private engineManager: EngineManager;
  private messageStore: MessageStore;
  private log: Logger;
  private dataDir: string;
  private allowFrom: Set<string>;
  private runtimeGroups: Record<string, { enabled: boolean; allowFrom?: string[] }>;
  private lastButtonMsg = new Map<string, string>();
  private chatQueues = new Map<string, Promise<void>>();
  private peerBots: Array<{ name: string; username: string }> = [];

  constructor(opts: {
    botConfig: ResolvedBotConfig;
    gatewayConfig: GatewayConfig;
    engineManager: EngineManager;
    messageStore: MessageStore;
    dataDir: string;
    log: Logger;
  }) {
    this.config = opts.botConfig;
    this.engineManager = opts.engineManager;
    this.messageStore = opts.messageStore;
    this.dataDir = opts.dataDir;
    this.log = opts.log.child({ bot: opts.botConfig.name, botId: opts.botConfig.botId });
    this.botId = opts.botConfig.botId;
    this.name = opts.botConfig.name;

    const sessionStore = new SessionStore(join(opts.dataDir, "sessions", this.botId));
    this.sessionManager = new SessionManager(sessionStore);
    this.sessionManager.loadAll();

    const pairingPath = join(opts.dataDir, "credentials", this.botId, "telegram-pairing.json");
    this.pairingManager = new PairingManager(pairingPath);

    if (opts.botConfig.token) {
      this.telegram = new TelegramAdapter(opts.botConfig.token, this.log);
      this.telegram.setMessageStore(this.messageStore, this.name);
    }

    if (opts.botConfig.discordToken) {
      this.discord = new DiscordAdapter(opts.botConfig.discordToken, this.log);
    }

    this.allowFrom = this.loadAllowFrom();
    this.runtimeGroups = this.loadRuntimeGroups();
  }

  setPeerBots(peers: Array<{ name: string; username: string }>): void {
    this.peerBots = peers.filter((b) => b.name !== this.name);
  }

  private loadAllowFrom(): Set<string> {
    const configAllow = this.config.allowFrom ?? [];
    const filePath = join(this.dataDir, "credentials", this.botId, "telegram-allowFrom.json");
    let fileAllow: string[] = [];
    if (existsSync(filePath)) {
      try {
        fileAllow = JSON.parse(readFileSync(filePath, "utf-8")).allowFrom ?? [];
      } catch {}
    }
    return new Set([...configAllow, ...fileAllow]);
  }

  private saveAllowFrom(): void {
    const filePath = join(this.dataDir, "credentials", this.botId, "telegram-allowFrom.json");
    mkdirSync(join(this.dataDir, "credentials", this.botId), { recursive: true });
    const tmp = filePath + ".tmp";
    writeFileSync(tmp, JSON.stringify({ allowFrom: [...this.allowFrom] }, null, 2));
    renameSync(tmp, filePath);
  }

  private loadRuntimeGroups(): Record<string, { enabled: boolean; allowFrom?: string[] }> {
    const configGroups = this.config.groups ?? {};
    const filePath = join(this.dataDir, "credentials", this.botId, "telegram-groups.json");
    let fileGroups: Record<string, { enabled: boolean; allowFrom?: string[] }> = {};
    if (existsSync(filePath)) {
      try {
        fileGroups = JSON.parse(readFileSync(filePath, "utf-8")).groups ?? {};
      } catch {}
    }
    return { ...configGroups, ...fileGroups };
  }

  private saveRuntimeGroups(): void {
    const filePath = join(this.dataDir, "credentials", this.botId, "telegram-groups.json");
    mkdirSync(join(this.dataDir, "credentials", this.botId), { recursive: true });
    const tmp = filePath + ".tmp";
    writeFileSync(tmp, JSON.stringify({ groups: this.runtimeGroups }, null, 2));
    renameSync(tmp, filePath);
  }

  async start(): Promise<void> {
    if (this.telegram) {
      this.registerCommands(this.telegram);
      this.registerCallbacks(this.telegram);
      this.telegram.onMessage((msg) => this.handleMessage(msg, this.telegram!));
      await this.telegram.start();
    }

    if (this.discord) {
      this.registerCommands(this.discord);
      this.discord.onMessage((msg) => this.handleMessage(msg, this.discord!));
      await this.discord.start();
    }
  }

  async stop(): Promise<void> {
    if (this.telegram) await this.telegram.stop();
    if (this.discord) await this.discord.stop();
    await this.sessionManager.flushAll();
  }

  private registerCommands(channel: ChannelAdapter): void {
    channel.onCommand("engine", (msg) => this.handleEngine(msg, channel));
    channel.onCommand("cli", (msg) => this.handleEngine(msg, channel));
    channel.onCommand("model", (msg) => this.handleModel(msg, channel));
    channel.onCommand("effort", (msg) => this.handleEffort(msg, channel));
    channel.onCommand("thinking", (msg) => this.handleEffort(msg, channel));
    channel.onCommand("status", (msg) => this.handleStatus(msg, channel));
    channel.onCommand("new", (msg) => this.handleNew(msg, channel));
    channel.onCommand("sessions", (msg) => this.handleSessions(msg, channel));
    channel.onCommand("title", (msg) => this.handleTitle(msg, channel));
    channel.onCommand("btw", (msg) => this.handleBtw(msg, channel));
    channel.onCommand("stop", (msg) => this.handleStop(msg, channel));
    channel.onCommand("help", (msg) => this.handleHelp(msg, channel));
  }

  private registerCallbacks(telegram: TelegramAdapter): void {
    // Engine picker callback
    telegram.onCallback("engine", async (ctx) => {
      const data = ctx.callbackQuery?.data ?? "";
      const engine = data.split(":")[1] as EngineType;
      const chatId = String(ctx.callbackQuery?.message?.chat.id);
      if (!engine || !chatId) return;

      const session = this.sessionManager.resolve({
        chatId,
        channelType: "telegram",
        defaultEngine: this.config.engine,
      });

      this.sessionManager.setEngine(session.sessionId, engine);
      await this.sessionManager.flush(chatId);

      try {
        await ctx.editMessageText(`✅ Active engine switched to *${engine.toUpperCase()}*\nContext from previous turns is preserved.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    });

    // Model picker callback
    telegram.onCallback("model", async (ctx) => {
      const data = ctx.callbackQuery?.data ?? "";
      const model = data.slice("model:".length);
      const chatId = String(ctx.callbackQuery?.message?.chat.id);
      if (!model || !chatId) return;

      const session = this.sessionManager.resolve({
        chatId,
        channelType: "telegram",
        defaultEngine: this.config.engine,
      });

      this.sessionManager.setModel(session.sessionId, model);
      await this.sessionManager.flush(chatId);

      try {
        await ctx.editMessageText(`✅ Model set to: \`${model}\` (${session.activeEngine.toUpperCase()})`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    });

    // Effort picker callback
    telegram.onCallback("effort", async (ctx) => {
      const data = ctx.callbackQuery?.data ?? "";
      const effort = data.slice("effort:".length);
      const chatId = String(ctx.callbackQuery?.message?.chat.id);
      if (!effort || !chatId) return;

      const session = this.sessionManager.resolve({
        chatId,
        channelType: "telegram",
        defaultEngine: this.config.engine,
      });

      this.sessionManager.setEffort(session.sessionId, effort);
      await this.sessionManager.flush(chatId);

      try {
        await ctx.editMessageText(`✅ Reasoning effort set to: *${effort}* (${session.activeEngine.toUpperCase()})`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    });

    // Sessions switcher callback
    telegram.onCallback("sw", async (ctx) => {
      const data = ctx.callbackQuery?.data ?? "";
      const idx = Number(data.split(":")[1]);
      const chatId = String(ctx.callbackQuery?.message?.chat.id);
      if (isNaN(idx) || !chatId) return;

      const target = this.sessionManager.switchTo(chatId, idx);
      if (target) {
        await this.sessionManager.flush(chatId);
        try {
          await ctx.editMessageText(
            `Switched to Session #${target.sessionNum} [${target.activeEngine.toUpperCase()}] (${target.title || "Untitled"})`,
            { reply_markup: { inline_keyboard: [] } },
          );
        } catch {}
      }
    });
  }

  private async handleEngine(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const input = msg.text.trim().toLowerCase();
    if (["claude", "codex", "agy"].includes(input)) {
      const session = this.sessionManager.resolve({
        chatId: msg.chatId,
        channelType: msg.channelType,
        defaultEngine: this.config.engine,
      });
      this.sessionManager.setEngine(session.sessionId, input as EngineType);
      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `✅ Engine switched to *${input.toUpperCase()}*. Historical context is retained for handover.`,
      });
      return;
    }

    if (channel.sendWithButtons) {
      const buttons: InlineButton[][] = [
        [
          { text: "🟣 Claude Code", data: "engine:claude" },
          { text: "🟢 OpenAI Codex", data: "engine:codex" },
        ],
        [
          { text: "🔵 Google Antigravity (agy)", data: "engine:agy" },
        ],
      ];
      await channel.sendWithButtons(msg.chatId, "Select CLI Engine to run for this session:", buttons);
    } else {
      await channel.send({
        chatId: msg.chatId,
        text: "Switch engine using: `/engine claude`, `/engine codex`, or `/engine agy`",
      });
    }
  }

  private async handleModel(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const input = msg.text.trim();
    if (input) {
      this.sessionManager.setModel(session.sessionId, input);
      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `✅ Model for ${session.activeEngine.toUpperCase()} set to: \`${input}\``,
      });
      return;
    }

    // Dynamic discovery for active engine
    try {
      const caps = await this.engineManager.getCapabilities(session.activeEngine);
      const rows: InlineButton[][] = [];
      let currentRow: InlineButton[] = [];

      for (const m of caps.models) {
        currentRow.push({ text: m.label, data: `model:${m.id}` });
        if (currentRow.length === 2) {
          rows.push(currentRow);
          currentRow = [];
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      if (channel.sendWithButtons && rows.length > 0) {
        await channel.sendWithButtons(
          msg.chatId,
          `Available models for *${session.activeEngine.toUpperCase()}*:\n(Or type \`/model <name>\` for any custom model)`,
          rows,
        );
      } else {
        const listStr = caps.models.map((m) => `• \`${m.id}\` — ${m.label}`).join("\n");
        await channel.send({
          chatId: msg.chatId,
          text: `Available models for *${session.activeEngine.toUpperCase()}*:\n${listStr}\n\nType \`/model <id>\` to select.`,
        });
      }
    } catch (err) {
      await channel.send({
        chatId: msg.chatId,
        text: `Failed to fetch models for ${session.activeEngine}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private async handleEffort(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const caps = await this.engineManager.getCapabilities(session.activeEngine);
    if (!caps.supportsEffort) {
      await channel.send({
        chatId: msg.chatId,
        text: `Active engine (${session.activeEngine.toUpperCase()}) does not support effort level configuration.`,
      });
      return;
    }

    const input = msg.text.trim().toLowerCase();
    if (input) {
      this.sessionManager.setEffort(session.sessionId, input);
      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `✅ Effort for ${session.activeEngine.toUpperCase()} set to: \`${input}\``,
      });
      return;
    }

    const rows: InlineButton[][] = [
      caps.efforts.map((e) => ({ text: e.label, data: `effort:${e.id}` })),
    ];

    if (channel.sendWithButtons) {
      await channel.sendWithButtons(
        msg.chatId,
        `Select reasoning effort for *${session.activeEngine.toUpperCase()}*:`,
        rows,
      );
    } else {
      const options = caps.efforts.map((e) => `\`/effort ${e.id}\``).join(", ");
      await channel.send({
        chatId: msg.chatId,
        text: `Select reasoning effort for ${session.activeEngine.toUpperCase()}: ${options}`,
      });
    }
  }

  private async handleStatus(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const statusText = [
      `🤖 *PocketAgent Status*`,
      `• Bot: *${this.name}*`,
      `• Active Engine: *${session.activeEngine.toUpperCase()}*`,
      `• Model: \`${session.model || "(default)"}\``,
      `• Effort: \`${session.effort || "(default)"}\``,
      `• Session: #${session.sessionNum} (${session.title || "Untitled"})`,
      `• Context Turns: ${session.turns?.length ?? 0}`,
      `• Workspace: \`${this.engineManager.getWorkspaceDir(session.sessionId, session.activeEngine) || "Shared"}\``,
    ].join("\n");

    await channel.send({ chatId: msg.chatId, text: statusText });
  }

  private async handleNew(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const arg = msg.text.trim();
    let explicitEngine: EngineType | undefined;
    let title: string | undefined;

    if (arg) {
      const lower = arg.toLowerCase();
      if (["claude", "codex", "agy"].includes(lower)) {
        explicitEngine = lower as EngineType;
      } else {
        title = arg;
      }
    }

    // Resolve current session to inspect user's current engine, model, and effort preferences
    const currentSession = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
      defaultModel: this.config.model,
      defaultEffort: this.config.effort,
    });

    const targetEngine = explicitEngine ?? currentSession.activeEngine ?? this.config.engine;
    const sameEngine = targetEngine === currentSession.activeEngine;
    const targetModel = sameEngine ? currentSession.model : (targetEngine === this.config.engine ? this.config.model : undefined);
    const targetEffort = sameEngine ? currentSession.effort : (targetEngine === this.config.engine ? this.config.effort : undefined);

    const session = this.sessionManager.createNew(
      msg.chatId,
      targetEngine,
      targetModel,
      targetEffort,
      title,
    );
    this.messageStore.advanceCursorToLatest(msg.chatId, session.sessionId);
    await this.sessionManager.flush(msg.chatId);

    const titleSuffix = session.title ? ` (${session.title})` : "";
    await channel.send({
      chatId: msg.chatId,
      text: `✨ New session started: Session #${session.sessionNum} [${session.activeEngine.toUpperCase()}]${titleSuffix}`,
    });
  }

  private async handleSessions(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const targetIdx = Number(msg.text.trim());
    if (!isNaN(targetIdx) && targetIdx > 0) {
      const switched = this.sessionManager.switchTo(msg.chatId, targetIdx);
      if (switched) {
        await this.sessionManager.flush(msg.chatId);
        await channel.send({
          chatId: msg.chatId,
          text: `Switched to Session #${switched.sessionNum} [${switched.activeEngine.toUpperCase()}] (${switched.title || "Untitled"})`,
        });
        return;
      }
    }

    const sessions = this.sessionManager.list(msg.chatId);
    if (sessions.length === 0) {
      await channel.send({ chatId: msg.chatId, text: "No sessions found. Send a message to start one." });
      return;
    }

    const lines = sessions.map((s) => {
      const activeMark = s.isActive ? "👉 " : "   ";
      return `${activeMark}#${s.sessionNum} [${s.activeEngine.toUpperCase()}] ${s.title || "Untitled"}`;
    });

    const buttons: InlineButton[][] = [];
    let row: InlineButton[] = [];
    for (const s of sessions) {
      row.push({ text: `#${s.sessionNum} ${s.activeEngine.toUpperCase()}`, data: `sw:${s.sessionNum}` });
      if (row.length === 3) {
        buttons.push(row);
        row = [];
      }
    }
    if (row.length > 0) buttons.push(row);

    if (channel.sendWithButtons) {
      await channel.sendWithButtons(msg.chatId, `Sessions:\n${lines.join("\n")}`, buttons);
    } else {
      await channel.send({ chatId: msg.chatId, text: `Sessions:\n${lines.join("\n")}\n\nUse \`/sessions <num>\` to switch.` });
    }
  }

  private async handleTitle(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const title = msg.text.trim();
    if (title) {
      this.sessionManager.update(session.sessionId, { title: title.slice(0, 80) });
      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `Session #${session.sessionNum} title set to: "${title.slice(0, 80)}"`,
      });
    } else {
      await channel.send({
        chatId: msg.chatId,
        text: session.title
          ? `Current session #${session.sessionNum} title: "${session.title}"\nUse \`/title <name>\` to rename.`
          : `Session #${session.sessionNum} has no title set. Use \`/title <name>\` to set one.`,
      });
    }
  }

  private async handleStop(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const sent = this.engineManager.sendControl(session.sessionId, session.activeEngine, { subtype: "interrupt" });
    await channel.send({
      chatId: msg.chatId,
      text: sent ? "Task interrupted." : "No active running task to stop.",
    });
  }

  private async handleBtw(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const question = msg.text.trim();
    if (!question) {
      await channel.send({ chatId: msg.chatId, text: "Usage: `/btw <question>`" });
      return;
    }

    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const tracker = new ProgressTracker(channel, msg.chatId, msg.messageId);
    tracker.start();

    try {
      let replyText = "";
      for await (const event of this.engineManager.sendMessage(
        session,
        `[Quick Side Question - Do not modify workspace files]\n${question}`,
        this.botId,
        this.config.extraArgs,
        this.botIdentity(),
      )) {
        if (event.type === "thinking_started") tracker.thinking();
        else if (event.type === "tool_started") tracker.toolStart(event.name, event.detail);
        else if (event.type === "text") replyText += event.text;
      }
      await tracker.finish(replyText || "(No response)");
    } catch (err) {
      tracker.stop();
      await channel.send({ chatId: msg.chatId, text: `Error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  private async handleHelp(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const helpText = [
      `🎒 *PocketAgent — 3-in-1 AI Gateway*`,
      ``,
      `*Commands:*`,
      `• \`/engine [claude|codex|agy]\` — Switch CLI engine with seamless context handover`,
      `• \`/model [name]\` — Dynamically choose or view models supported by current engine`,
      `• \`/effort [low|med|high]\` — Configure reasoning effort depth`,
      `• \`/status\` — View current session, engine, model & status`,
      `• \`/new\` — Start a fresh session`,
      `• \`/sessions [num]\` — List and switch sessions`,
      `• \`/btw <question>\` — Ask side question in parallel`,
      `• \`/stop\` — Interrupt current task`,
      `• \`/help\` — Show this help message`,
      ``,
      `_Tip: Simply send any message, photo, or file to start coding!_`,
    ].join("\n");

    await channel.send({ chatId: msg.chatId, text: helpText });
  }

  private async handleMessage(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) {
      if (access.reason === "needs_pairing") {
        const req = this.pairingManager.challenge(msg.senderId, msg.senderName, msg.channelType, msg.chatId);
        await channel.send({
          chatId: msg.chatId,
          text: `🔒 Access restricted. Your pairing code is:\n\n*${req.code}*\n\nApprove via admin to begin.`,
        });
      }
      return;
    }

    const prevQueue = this.chatQueues.get(msg.chatId) ?? Promise.resolve();
    const nextQueue = prevQueue.then(async () => {
      await this.processTurn(msg, channel);
    }).catch((err) => {
      this.log.error({ error: err }, "Chat queue error");
    });
    this.chatQueues.set(msg.chatId, nextQueue);
    await nextQueue;
  }

  private async processTurn(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      isGroup: msg.isGroup,
      defaultEngine: this.config.engine,
      defaultModel: this.config.model,
      defaultEffort: this.config.effort,
    });

    // Format prompt text with metadata, timestamp, and reply context
    const dt = new Date(msg.timestamp * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;

    let promptText = `[${ts}] ${msg.senderName}:\n`;
    if (msg.replyText) {
      const quoteName = msg.replySenderName ?? "Unknown";
      promptText += `> ${quoteName}: ${msg.replyText}\n`;
    }
    promptText += msg.text;

    // Handle attachments if present
    const allAttachments = [...(msg.attachments ?? []), ...(msg.replyAttachments ?? [])];
    if (this.telegram && allAttachments.length > 0) {
      const downloadsDir = join(this.dataDir, "downloads", this.botId, msg.chatId);
      for (const att of allAttachments) {
        try {
          const localPath = await this.telegram.downloadFile(att.fileId, downloadsDir, att.fileName);
          promptText += `\n[Attached ${att.type}: ${localPath}]`;
        } catch (err) {
          this.log.error({ error: err }, "Failed to download attachment");
        }
      }
    }

    // Record turn in session history
    this.sessionManager.addTurn(session.sessionId, {
      role: "user",
      text: msg.text,
      author: msg.senderName,
    });

    const tracker = new ProgressTracker(channel, msg.chatId, msg.messageId);
    tracker.start();

    let fullResponse = "";
    let buttons: string[] | undefined;

    try {
      for await (const event of this.engineManager.sendMessage(
        session,
        promptText,
        this.botId,
        this.config.extraArgs,
        this.botIdentity(),
      )) {
        if (event.type === "thinking_started") {
          tracker.thinking();
        } else if (event.type === "tool_started") {
          tracker.toolStart(event.name, event.detail);
        } else if (event.type === "text") {
          tracker.appendText(event.text);
          fullResponse += event.text;
        } else if (event.type === "result") {
          if (event.result && !fullResponse) {
            fullResponse = event.result;
          }
        }
      }

      if (!fullResponse && tracker.getBuffer()) {
        fullResponse = tracker.getBuffer();
      }

      // Check for inline buttons markup: [button: Opt1 | Opt2] or <<Opt1>>
      const btnList: string[] = [];
      const buttonMatch = fullResponse.match(/\[button:\s*([^\]]+)\]/i);
      if (buttonMatch) {
        btnList.push(...buttonMatch[1].split("|").map((b) => b.trim()).filter(Boolean));
        fullResponse = fullResponse.replace(buttonMatch[0], "").trim();
      }
      const angleButtons = [...fullResponse.matchAll(/<<([^>]+)>>/g)].map((m) => m[1]);
      if (angleButtons.length > 0) {
        btnList.push(...angleButtons);
        fullResponse = fullResponse.replace(/<<[^>]+>>/g, "").trim();
      }
      if (btnList.length > 0) buttons = btnList;

      // Record assistant turn in session history
      this.sessionManager.addTurn(session.sessionId, {
        role: "assistant",
        text: fullResponse,
        engine: session.activeEngine,
      });

      session.lastEngine = session.activeEngine;
      await this.sessionManager.flush(msg.chatId);
      await tracker.finish(fullResponse || "(Task completed)", buttons);
    } catch (err) {
      tracker.stop();
      this.log.error({ error: err }, "Error processing turn");
      await channel.send({
        chatId: msg.chatId,
        text: `Error processing turn: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private checkAccess(msg: InboundMessage) {
    return checkAccess({
      senderId: msg.senderId,
      chatId: msg.chatId,
      isGroup: msg.isGroup,
      dmPolicy: this.config.dmPolicy,
      groupPolicy: this.config.groupPolicy,
      allowFrom: [...this.allowFrom],
      groups: this.runtimeGroups,
    });
  }

  private botIdentity() {
    return {
      name: this.name,
      username: this.telegram?.username ?? this.name,
      peerBots: this.peerBots,
    };
  }
}
