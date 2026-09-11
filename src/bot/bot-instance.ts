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
      this.registerCallbacks(this.telegram, "telegram");
      this.telegram.onMessage((msg) => this.handleMessage(msg, this.telegram!));
      await this.telegram.start();
    }

    if (this.discord) {
      this.registerCommands(this.discord);
      this.registerCallbacks(this.discord, "discord");
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

  private registerCallbacks(channel: ChannelAdapter, channelType: string): void {
    if (!channel.onCallback) return;

    // Engine picker callback
    channel.onCallback("engine", async (ctx) => {
      const data: string = ctx.data ?? ctx.callbackQuery?.data ?? "";
      const engine = data.split(":")[1] as EngineType;
      const chatId = String(ctx.chatId ?? ctx.callbackQuery?.message?.chat?.id ?? "");
      if (!engine || !chatId) return;

      const session = this.sessionManager.resolve({
        chatId,
        channelType,
        defaultEngine: this.config.engine,
      });

      this.sessionManager.setEngine(session.sessionId, engine);
      await this.sessionManager.flush(chatId);

      try {
        await ctx.editMessageText(`Active engine switched to *${engine.toUpperCase()}*\nContext from previous turns is preserved.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    });

    // Model picker callback
    channel.onCallback("model", async (ctx) => {
      const data: string = ctx.data ?? ctx.callbackQuery?.data ?? "";
      const model = data.slice("model:".length);
      const chatId = String(ctx.chatId ?? ctx.callbackQuery?.message?.chat?.id ?? "");
      if (!model || !chatId) return;

      const session = this.sessionManager.resolve({
        chatId,
        channelType,
        defaultEngine: this.config.engine,
      });

      this.sessionManager.setModel(session.sessionId, model);

      let effortAdjustNote = "";
      try {
        const caps = await this.engineManager.getCapabilities(session.activeEngine);
        const m = caps.models.find((mod) => mod.id.toLowerCase() === model.toLowerCase());
        if (m && m.supportedEfforts && m.supportedEfforts.length > 0) {
          const currentEffort = session.engineEfforts?.[session.activeEngine] || session.effort;
          const isSupported = currentEffort && m.supportedEfforts.some((e) => e.id.toLowerCase() === currentEffort.toLowerCase());
          if (!isSupported) {
            const fallbackEffort = m.defaultEffort || m.supportedEfforts.find((e) => e.isDefault)?.id || m.supportedEfforts[0].id;
            this.sessionManager.setEffort(session.sessionId, fallbackEffort);
            effortAdjustNote = ` (Reasoning effort: \`${fallbackEffort}\`)`;
          }
        }
      } catch {}

      await this.sessionManager.flush(chatId);

      try {
        await ctx.editMessageText(`Model set to: \`${model}\` (${session.activeEngine.toUpperCase()})${effortAdjustNote}`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    });

    // Effort picker callback
    channel.onCallback("effort", async (ctx) => {
      const data: string = ctx.data ?? ctx.callbackQuery?.data ?? "";
      const effort = data.slice("effort:".length);
      const chatId = String(ctx.chatId ?? ctx.callbackQuery?.message?.chat?.id ?? "");
      if (!effort || !chatId) return;

      const session = this.sessionManager.resolve({
        chatId,
        channelType,
        defaultEngine: this.config.engine,
      });

      this.sessionManager.setEffort(session.sessionId, effort);
      await this.sessionManager.flush(chatId);

      const activeModel = session.engineModels?.[session.activeEngine] || session.model || "default";
      try {
        await ctx.editMessageText(`Reasoning effort set to: *${effort}* for *${session.activeEngine.toUpperCase()}* (\`${activeModel}\`)`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    });

    // Sessions switcher callback
    channel.onCallback("sw", async (ctx) => {
      const data: string = ctx.data ?? ctx.callbackQuery?.data ?? "";
      const idx = Number(data.split(":")[1]);
      const chatId = String(ctx.chatId ?? ctx.callbackQuery?.message?.chat?.id ?? "");
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

    const session = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });

    const input = msg.text.trim().toLowerCase();
    if (["claude", "codex", "agy"].includes(input)) {
      this.sessionManager.setEngine(session.sessionId, input as EngineType);
      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `Engine switched to *${input.toUpperCase()}*. Historical context is retained for handover.`,
      });
      return;
    }

    if (channel.sendWithButtons) {
      const cur = session.activeEngine;
      const mark = (engine: EngineType, label: string) => (cur === engine ? `${label} [Active]` : label);
      const buttons: InlineButton[][] = [
        [{ text: mark("claude", "Claude Code"), data: "engine:claude" }],
        [{ text: mark("codex", "OpenAI Codex"), data: "engine:codex" }],
        [{ text: mark("agy", "Google Antigravity"), data: "engine:agy" }],
      ];
      await channel.sendWithButtons(
        msg.chatId,
        `Current engine: *${session.activeEngine.toUpperCase()}*\nSelect CLI Engine to run for this session:`,
        buttons,
      );
    } else {
      await channel.send({
        chatId: msg.chatId,
        text: `Current engine: *${session.activeEngine.toUpperCase()}*\nSwitch engine using: \`/engine claude\`, \`/engine codex\`, or \`/engine agy\``,
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
      let resolvedModel = input;
      let matchedModel: ModelInfo | undefined;
      try {
        const caps = await this.engineManager.getCapabilities(session.activeEngine);
        const lowerInput = input.toLowerCase();
        matchedModel = caps.models.find(
          (m) =>
            m.id.toLowerCase() === lowerInput ||
            m.id.toLowerCase().includes(lowerInput) ||
            m.label.toLowerCase().includes(lowerInput),
        );
        if (matchedModel) {
          resolvedModel = matchedModel.id;
        }
      } catch {}

      this.sessionManager.setModel(session.sessionId, resolvedModel);

      let effortAdjustNote = "";
      if (matchedModel?.supportedEfforts && matchedModel.supportedEfforts.length > 0) {
        const currentEffort = session.engineEfforts?.[session.activeEngine] || session.effort;
        const isSupported =
          currentEffort &&
          matchedModel.supportedEfforts.some(
            (e) => e.id.toLowerCase() === currentEffort.toLowerCase(),
          );
        if (!isSupported) {
          const fallbackEffort =
            matchedModel.defaultEffort ||
            matchedModel.supportedEfforts.find((e) => e.isDefault)?.id ||
            matchedModel.supportedEfforts[0].id;
          this.sessionManager.setEffort(session.sessionId, fallbackEffort);
          effortAdjustNote = `\nReasoning effort: \`${fallbackEffort}\``;
        }
      }

      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `Model for ${session.activeEngine.toUpperCase()} set to: \`${resolvedModel}\`${effortAdjustNote}`,
      });
      return;
    }

    // Dynamic discovery for active engine
    try {
      const caps = await this.engineManager.getCapabilities(session.activeEngine);
      const activeModelId = session.engineModels?.[session.activeEngine] || session.model;
      const rows: InlineButton[][] = [];
      let currentRow: InlineButton[] = [];

      for (const m of caps.models) {
        const isCurrent =
          (activeModelId && m.id.toLowerCase() === activeModelId.toLowerCase()) ||
          (!activeModelId && m.isDefault);
        const label = isCurrent ? `${m.label} [Active]` : m.label;
        currentRow.push({ text: label, data: `model:${m.id}` });
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

    // Resolve active model for current engine
    const activeModelId = session.engineModels?.[session.activeEngine] || session.model;
    const activeModel =
      caps.models.find(
        (m) =>
          (activeModelId && m.id.toLowerCase() === activeModelId.toLowerCase()) ||
          (activeModelId && m.label.toLowerCase() === activeModelId.toLowerCase()),
      ) ||
      caps.models.find((m) => m.isDefault) ||
      caps.models[0];

    const modelEfforts =
      activeModel?.supportedEfforts && activeModel.supportedEfforts.length > 0
        ? activeModel.supportedEfforts
        : caps.efforts;

    if (activeModel?.supportedEfforts && activeModel.supportedEfforts.length === 0) {
      await channel.send({
        chatId: msg.chatId,
        text: `Model *${activeModel.label}* (${session.activeEngine.toUpperCase()}) does not support reasoning effort configuration.`,
      });
      return;
    }

    const currentEffort =
      session.engineEfforts?.[session.activeEngine] || session.effort || activeModel?.defaultEffort || "";

    const input = msg.text.trim().toLowerCase();
    if (input) {
      const matched = modelEfforts.find(
        (e) => e.id.toLowerCase() === input || e.label.toLowerCase() === input,
      );
      if (modelEfforts.length > 0 && !matched) {
        const validList = modelEfforts.map((e) => `\`${e.id}\``).join(", ");
        await channel.send({
          chatId: msg.chatId,
          text: `Effort level \`${input}\` is not supported by *${activeModel?.label || session.activeEngine.toUpperCase()}*.\nValid options: ${validList}`,
        });
        return;
      }
      const targetEffort = matched ? matched.id : input;
      this.sessionManager.setEffort(session.sessionId, targetEffort);
      await this.sessionManager.flush(msg.chatId);
      await channel.send({
        chatId: msg.chatId,
        text: `Effort for *${session.activeEngine.toUpperCase()}* (${activeModel?.label || "active model"}) set to: \`${targetEffort}\``,
      });
      return;
    }

    // Layout buttons: up to 3 per row for clean presentation
    const rows: InlineButton[][] = [];
    let currentRow: InlineButton[] = [];

    for (const e of modelEfforts) {
      const isSelected = currentEffort.toLowerCase() === e.id.toLowerCase();
      const label = isSelected ? `${e.label} [Current]` : e.label;
      currentRow.push({ text: label, data: `effort:${e.id}` });
      if (currentRow.length === 3) {
        rows.push(currentRow);
        currentRow = [];
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    const modelDisplay = activeModel ? ` (\`${activeModel.label}\`)` : "";
    const promptText = `Select reasoning effort for *${session.activeEngine.toUpperCase()}*${modelDisplay}:`;

    if (channel.sendWithButtons) {
      await channel.sendWithButtons(msg.chatId, promptText, rows);
    } else {
      const options = modelEfforts.map((e) => `\`/effort ${e.id}\``).join(", ");
      await channel.send({
        chatId: msg.chatId,
        text: `${promptText}\n${options}`,
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
      `*PocketAgent Status*`,
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

    const session = this.sessionManager.createNew(
      msg.chatId,
      targetEngine,
      undefined,
      undefined,
      title,
    );
    this.messageStore.advanceCursorToLatest(msg.chatId, session.sessionId);
    await this.sessionManager.flush(msg.chatId);

    const titleSuffix = session.title ? ` (${session.title})` : "";
    await channel.send({
      chatId: msg.chatId,
      text: `New session started: Session #${session.sessionNum} [${session.activeEngine.toUpperCase()}]${titleSuffix}`,
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
      if (access.reason === "needs_pairing" || access.reason === "needs_group_pairing") {
        const req = this.pairingManager.challenge(msg.senderId, msg.senderName, msg.channelType, msg.chatId);
        await channel.send({
          chatId: msg.chatId,
          text: `🔒 Access restricted. Your pairing code is:\n\n*${req.code}*\n\nApprove via terminal:\n\`pa pairing approve ${req.code}\``,
        });
      }
      return;
    }

    if (!msg.text.trim()) {
      await channel.send({
        chatId: msg.chatId,
        text: `👋 Hi! I received your mention, but I cannot read the message content.\n\n⚠️ **Please enable \`MESSAGE CONTENT INTENT\`** in [Discord Developer Portal](https://discord.com/developers/applications) under **Bot -> Privileged Gateway Intents**, then run \`pa restart\`.`,
      });
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
    const adapter = msg.channelType === "discord" ? this.discord : this.telegram;
    if (adapter?.downloadFile && allAttachments.length > 0) {
      const downloadsDir = join(this.dataDir, "downloads", this.botId, msg.chatId);
      for (const att of allAttachments) {
        try {
          const localPath = await adapter.downloadFile(att.fileId, downloadsDir, att.fileName);
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
      allowFrom: [...this.loadAllowFrom()],
      groups: this.loadRuntimeGroups(),
    });
  }

  private botIdentity() {
    return {
      name: this.name,
      username: this.telegram?.username ?? this.discord?.username ?? this.name,
      peerBots: this.peerBots,
    };
  }
}
