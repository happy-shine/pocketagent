import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "pino";
import { checkAccess } from "../auth/access.js";
import { PairingManager } from "../auth/pairing.js";
import { TelegramAdapter } from "../channels/telegram/adapter.js";
import { DiscordAdapter } from "../channels/discord/adapter.js";
import type { ChannelAdapter, InboundMessage, InlineButton, HistoryMessage } from "../channels/types.js";
import type { GatewayConfig, ResolvedBotConfig } from "../config/types.js";
import { EngineManager } from "../engines/manager.js";
import type { EngineType, ModelInfo, EffortInfo } from "../engines/types.js";
import { ProgressTracker } from "../progress/progress.js";
import { markdownToTelegramHtml, stripHtml } from "../channels/telegram/formatter.js";
import { SessionManager } from "../sessions/manager.js";
import { SessionStore } from "../sessions/store.js";
import type { MessageStore } from "../sessions/message-store.js";
import type { Session } from "../sessions/types.js";
import type { Scheduler } from "../scheduler/scheduler.js";
import {
  buildCronPrompt,
  cronSessionId,
  describeSchedule,
  formatTime,
  isSilentOutput,
  parseScheduleInput,
  scheduleTimezone,
} from "../scheduler/schedule.js";
import type { CronExecutionResult, CronJob, CronRunContext } from "../scheduler/types.js";
import type { JobManager } from "../jobs/manager.js";
import { buildJobCallbackPrompt, describeJobOutcome, formatDuration, jobDuration } from "../jobs/format.js";
import { isJobActive, type BackgroundJob, type JobCallbackState } from "../jobs/types.js";
import { decideFollowUp, type SteerMailbox } from "../steer/steer.js";

const SESSIONS_PER_PAGE = 10;

// Reactions on a message sent while a turn runs; all are in Telegram's fixed reaction set
const REACTION_STEER_PENDING = "👀";
const REACTION_STEER_DELIVERED = "👌";
const REACTION_QUEUED = "🫡";

interface TurnResponse {
  text: string;
  // Text written after the last tool call, i.e. the final answer without progress narration
  finalText: string;
  isError: boolean;
  errorMessage?: string;
}

/** The chat turn in progress, which API calls made by the CLI during it are attributed to. */
export interface TurnInfo {
  senderId: string;
  senderName: string;
  messageId: string;
  sessionId: string;
  // Background jobs started during this turn, to cap how many one message can start
  jobsStarted: number;
  // Chat messages that belong to the turn (what started it and what joined it); a reply to one joins it too
  messageIds: Set<string>;
  tracker?: ProgressTracker;
}

const CRON_STATUS_LABELS: Record<string, string> = {
  ok: "succeeded",
  silent: "nothing to report",
  error: "failed",
  timeout: "timed out",
  skipped: "skipped",
};

/** A chat message as recorded in session history, which other engines get on a handover. */
function historyTextOf(msg: InboundMessage): string {
  return msg.replyText ? `[In reply to ${msg.replySenderName ?? "Unknown"}: ${msg.replyText}]\n${msg.text}` : msg.text;
}

/** Strips `[button: A | B]` and `<<A>>` markup from a reply and returns the button labels. */
function extractButtons(response: string): { text: string; buttons?: string[] } {
  let text = response;
  const btnList: string[] = [];
  const buttonMatch = text.match(/\[button:\s*([^\]]+)\]/i);
  if (buttonMatch) {
    btnList.push(...buttonMatch[1].split("|").map((b) => b.trim()).filter(Boolean));
    text = text.replace(buttonMatch[0], "").trim();
  }
  const angleButtons = [...text.matchAll(/<<([^>]+)>>/g)].map((m) => m[1]);
  if (angleButtons.length > 0) {
    btnList.push(...angleButtons);
    text = text.replace(/<<[^>]+>>/g, "").trim();
  }
  return { text, buttons: btnList.length > 0 ? btnList : undefined };
}

export class BotInstance {
  readonly botId: string;
  name: string;
  config: ResolvedBotConfig;
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
  private scheduler?: Scheduler;
  private jobManager?: JobManager;
  // Chats with a turn running right now
  private busyChats = new Set<string>();
  // Turn currently running per chat, used to attribute API calls the CLI makes during that turn
  private turnSenders = new Map<string, TurnInfo>();
  private steerMailbox?: SteerMailbox;

  constructor(opts: {
    botConfig: ResolvedBotConfig;
    gatewayConfig: GatewayConfig;
    engineManager: EngineManager;
    messageStore: MessageStore;
    dataDir: string;
    log: Logger;
    scheduler?: Scheduler;
    jobs?: JobManager;
    steerMailbox?: SteerMailbox;
  }) {
    this.config = opts.botConfig;
    this.engineManager = opts.engineManager;
    this.scheduler = opts.scheduler;
    this.jobManager = opts.jobs;
    this.steerMailbox = opts.steerMailbox;
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
      this.discord.setMessageStore(this.messageStore, this.name);
    }

    this.allowFrom = this.loadAllowFrom();
    this.runtimeGroups = this.loadRuntimeGroups();
  }

  setPeerBots(peers: Array<{ name: string; username: string }>): void {
    this.peerBots = peers.filter((b) => b.name !== this.name);
  }

  getUsername(): string | undefined {
    return this.telegram?.username ?? this.discord?.username;
  }

  getAllowFrom(): string[] {
    return [...this.allowFrom];
  }

  getRuntimeGroups(): Record<string, { enabled: boolean; allowFrom?: string[] }> {
    return { ...this.runtimeGroups };
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getPendingPairings() {
    return this.pairingManager.listPending();
  }

  getTurnSender(chatId: string): TurnInfo | undefined {
    return this.turnSenders.get(chatId);
  }

  /** Working directory of a chat session, where background jobs run unless told otherwise. */
  getSessionWorkspace(sessionId: string): string | undefined {
    const session = this.sessionManager.findSession(sessionId);
    if (!session) return undefined;
    const live = this.engineManager.getWorkspaceDir(session.sessionId, session.activeEngine);
    if (live) return live;
    const safeChatId = session.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.dataDir, "workspaces", this.botId, `${safeChatId}_${session.workspaceId ?? session.sessionId}`);
  }

  /** Chat details as recorded on its sessions; undefined if the bot has never talked in that chat. */
  getChatInfo(chatId: string): { channelType: string; isGroup: boolean } | undefined {
    const session = this.sessionManager.getActiveSession(chatId);
    if (!session) return undefined;
    return { channelType: session.channelType, isGroup: Boolean(session.isGroup) };
  }

  /**
   * Scheduled tasks run unattended with full permissions, so in groups only users the bot explicitly
   * trusts (paired / allowlisted, or listed on the group) may manage them. In DMs, chat access suffices.
   */
  canManageCron(senderId: string | undefined, chatId: string, isGroup: boolean): boolean {
    if (!senderId) return false;
    const allowFrom = this.loadAllowFrom();
    const groups = this.loadRuntimeGroups();
    const access = checkAccess({
      senderId,
      chatId,
      isGroup,
      dmPolicy: this.config.dmPolicy,
      groupPolicy: this.config.groupPolicy,
      allowFrom: [...allowFrom],
      groups,
    });
    if (!access.allowed) return false;
    if (!isGroup) return true;
    return allowFrom.has(senderId) || Boolean(groups[chatId]?.allowFrom?.includes(senderId));
  }

  approvePairing(code: string): { senderId: string; chatId?: string } | null {
    const res = this.pairingManager.approve(code);
    if (res) {
      this.allowFrom.add(res.senderId);
      this.saveAllowFrom();
      if (res.chatId && res.chatId !== res.senderId) {
        this.runtimeGroups[res.chatId] = { enabled: true };
        this.saveRuntimeGroups();
      }
    }
    return res;
  }

  updateConfig(newConfig: ResolvedBotConfig): void {
    this.config = newConfig;
    this.name = newConfig.name;
    this.allowFrom = this.loadAllowFrom();
    this.runtimeGroups = this.loadRuntimeGroups();
    this.log.info({ bot: this.name }, "Bot configuration hot-reloaded");
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
    channel.onCommand("queue", (msg) => this.handleMessage(msg, channel, { queue: true }));
    channel.onCommand("cron", (msg) => this.handleCron(msg, channel));
    channel.onCommand("jobs", (msg) => this.handleJobs(msg, channel));
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

    // Scheduled task buttons: cron:<run|pause|resume>:<jobId>
    channel.onCallback("cron", async (ctx) => {
      const data: string = ctx.data ?? ctx.callbackQuery?.data ?? "";
      const [, action, jobId] = data.split(":");
      const chatId = String(ctx.chatId ?? ctx.callbackQuery?.message?.chat?.id ?? "");
      const senderId = String(ctx.from?.id ?? ctx.senderId ?? "");
      const job = jobId ? this.scheduler?.get(jobId) : undefined;
      if (!job || job.botId !== this.botId || job.chatId !== chatId) return;

      const reply = !this.canManageCron(senderId, chatId, job.isGroup)
        ? "Only authorized users can manage scheduled tasks in this chat."
        : this.applyCronAction(job, action);
      try {
        await ctx.editMessageText(reply, { reply_markup: { inline_keyboard: [] } });
      } catch {}
    });

    // Background job buttons: job:<stop|log>:<jobId>
    channel.onCallback("job", async (ctx) => {
      const data: string = ctx.data ?? ctx.callbackQuery?.data ?? "";
      const [, action, jobId] = data.split(":");
      const chatId = String(ctx.chatId ?? ctx.callbackQuery?.message?.chat?.id ?? "");
      const senderId = String(ctx.from?.id ?? ctx.senderId ?? "");
      const senderName = String(ctx.from?.first_name ?? ctx.from?.username ?? ctx.senderName ?? senderId);
      const job = jobId ? this.jobManager?.get(jobId) : undefined;
      if (!job || job.botId !== this.botId || job.chatId !== chatId) return;

      if (action === "log") {
        await this.postJobLog(job, channel);
      } else if (action === "stop") {
        const reply = this.stopJob(job, senderId, senderName);
        try {
          await ctx.editMessageText(reply, { reply_markup: { inline_keyboard: [] } });
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
    if (["claude", "codex", "agy", "grok"].includes(input)) {
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
        [{ text: mark("grok", "xAI Grok"), data: "engine:grok" }],
      ];
      await channel.sendWithButtons(
        msg.chatId,
        `Current engine: *${session.activeEngine.toUpperCase()}*\nSelect CLI Engine to run for this session:`,
        buttons,
      );
    } else {
      await channel.send({
        chatId: msg.chatId,
        text: `Current engine: *${session.activeEngine.toUpperCase()}*\nSwitch engine using: \`/engine claude\`, \`/engine codex\`, \`/engine agy\`, or \`/engine grok\``,
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

    const statusText: string[] = [
      `*PocketAgent Status*`,
      `• Bot: *${this.name}*`,
      `• Active Engine: *${session.activeEngine.toUpperCase()}*`,
      `• Model: \`${session.model || "(default)"}\``,
      `• Effort: \`${session.effort || "(default)"}\``,
      `• Session: #${session.sessionNum} (${session.title || "Untitled"})`,
      `• Context Turns: ${session.turns?.length ?? 0}`,
      `• Workspace: \`${this.engineManager.getWorkspaceDir(session.sessionId, session.activeEngine) || "Shared"}\``,
    ];
    const jobs = this.jobManager?.counts(this.botId, msg.chatId);
    if (jobs && jobs.running + jobs.queued > 0) statusText.push(`• Background jobs: ${jobs.running} running, ${jobs.queued} queued (see /jobs)`);

    await channel.send({ chatId: msg.chatId, text: statusText.join("\n") });
  }

  private async handleNew(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;

    const arg = msg.text.trim();
    let explicitEngine: EngineType | undefined;
    let title: string | undefined;

    if (arg) {
      const lower = arg.toLowerCase();
      if (["claude", "codex", "agy", "grok"].includes(lower)) {
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
    const jobs = this.jobManager?.counts(this.botId, msg.chatId);
    const hint = jobs && jobs.running + jobs.queued > 0 ? "\nBackground jobs keep running; stop them from /jobs." : "";
    await channel.send({
      chatId: msg.chatId,
      text: (sent ? "Task interrupted." : "No active running task to stop.") + hint,
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

    const chatSession = this.sessionManager.resolve({
      chatId: msg.chatId,
      channelType: msg.channelType,
      defaultEngine: this.config.engine,
    });
    // A session's engine process handles one turn at a time; while a turn runs, answer from a side process
    // that gets the recent conversation as context instead of interleaving with the running turn
    const busy = this.busyChats.has(msg.chatId) || this.engineManager.isBusy(chatSession.sessionId, chatSession.activeEngine);
    const session = busy ? this.forkSession(chatSession, `btw-${randomBytes(4).toString("hex")}`) : chatSession;

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
    } finally {
      if (session !== chatSession) this.engineManager.release(session.sessionId, session.activeEngine);
    }
  }

  /** A one-off copy of a chat session to work beside it: same engine settings and workspace, recent turns as context. */
  private forkSession(parent: Session, sessionId: string): Session {
    const engine = parent.activeEngine;
    const model = parent.engineModels?.[engine] ?? parent.model;
    const effort = parent.engineEfforts?.[engine] ?? parent.effort;
    return {
      sessionId,
      chatId: parent.chatId,
      channelType: parent.channelType,
      activeEngine: engine,
      model,
      effort,
      engineModels: model ? { [engine]: model } : {},
      engineEfforts: effort ? { [engine]: effort } : {},
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      title: parent.title,
      isActive: false,
      sessionNum: 0,
      isGroup: parent.isGroup,
      turns: parent.turns.map((t) => ({ ...t })),
      workspaceId: parent.workspaceId ?? parent.sessionId,
    };
  }

  private async handleCron(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;
    if (!this.scheduler) {
      await channel.send({ chatId: msg.chatId, text: "Scheduled tasks are not available." });
      return;
    }

    const input = msg.text.trim();
    const sub = input.split(/\s+/)[0]?.toLowerCase() ?? "";
    const arg = input.slice(sub.length).trim();

    if (sub === "" || sub === "list") {
      await this.sendCronList(msg.chatId, channel);
      return;
    }

    const usage = [
      "Usage:",
      "• `/cron` — list scheduled tasks in this chat",
      "• `/cron add <cron expr | YYYY-MM-DD HH:MM> | <prompt>`",
      "• `/cron run|pause|resume|rm <number>`",
      "",
      "_Tip: you can also just ask in plain words, e.g. \"every day at 8am send me an AI news digest\"._",
    ].join("\n");

    const actions: Record<string, string> = { run: "run", pause: "pause", resume: "resume", rm: "delete", del: "delete", delete: "delete" };
    if (sub !== "add" && !actions[sub]) {
      await channel.send({ chatId: msg.chatId, text: usage });
      return;
    }

    if (!this.canManageCron(msg.senderId, msg.chatId, msg.isGroup)) {
      await channel.send({ chatId: msg.chatId, text: "Only authorized users can manage scheduled tasks in this chat." });
      return;
    }

    if (sub === "add") {
      await this.handleCronAdd(msg, channel, arg, usage);
      return;
    }

    const jobs = this.scheduler.list({ botId: this.botId, chatId: msg.chatId });
    const idx = Number(arg);
    const job = Number.isInteger(idx) && idx >= 1 ? jobs[idx - 1] : jobs.find((j) => j.id === arg);
    if (!job) {
      await channel.send({ chatId: msg.chatId, text: arg ? `No scheduled task "${arg}" in this chat. Use \`/cron\` to list them.` : usage });
      return;
    }
    await channel.send({ chatId: msg.chatId, text: this.applyCronAction(job, actions[sub]) });
  }

  private async handleCronAdd(msg: InboundMessage, channel: ChannelAdapter, arg: string, usage: string): Promise<void> {
    const sep = arg.indexOf("|");
    const spec = sep >= 0 ? arg.slice(0, sep).trim() : "";
    const prompt = sep >= 0 ? arg.slice(sep + 1).trim() : "";
    if (!spec || !prompt) {
      await channel.send({ chatId: msg.chatId, text: usage });
      return;
    }

    const tz = this.scheduler!.timezone();
    const parsed = parseScheduleInput(/^\d{4}-\d{2}-\d{2}/.test(spec) ? { at: spec } : { cron: spec }, tz);
    if (!parsed.schedule) {
      await channel.send({ chatId: msg.chatId, text: `Could not create task: ${parsed.error}` });
      return;
    }

    const res = this.scheduler!.create({
      botId: this.botId,
      chatId: msg.chatId,
      channelType: msg.channelType,
      isGroup: msg.isGroup,
      prompt,
      schedule: parsed.schedule,
      createdBy: { senderId: msg.senderId, senderName: msg.senderName, via: "command" },
    });
    if (!res.job) {
      await channel.send({ chatId: msg.chatId, text: `Could not create task: ${res.error}` });
      return;
    }
    const next = res.job.state.nextRunAt;
    const jobTz = scheduleTimezone(res.job.schedule, tz);
    await channel.send({
      chatId: msg.chatId,
      text: `Scheduled task created: *${res.job.name}*\n${describeSchedule(res.job.schedule, tz)}${next ? `\nNext run: ${formatTime(next, jobTz)}` : ""}`,
    });
  }

  private applyCronAction(job: CronJob, action: string): string {
    const scheduler = this.scheduler!;
    switch (action) {
      case "run": {
        const res = scheduler.runNow(job.id);
        return res.ok ? `Running "${job.name}" now, the result will be posted here.` : `Could not run "${job.name}": ${res.error}`;
      }
      case "pause":
        scheduler.update(job.id, { enabled: false });
        return `Paused "${job.name}".`;
      case "resume": {
        const res = scheduler.update(job.id, { enabled: true });
        const next = res.job?.state.nextRunAt;
        const tz = scheduleTimezone(job.schedule, scheduler.timezone());
        return res.job ? `Resumed "${job.name}".${next ? ` Next run: ${formatTime(next, tz)}` : ""}` : `Could not resume: ${res.error}`;
      }
      case "delete":
        scheduler.remove(job.id);
        return `Deleted "${job.name}".`;
      default:
        return "Unknown action.";
    }
  }

  private async sendCronList(chatId: string, channel: ChannelAdapter): Promise<void> {
    const scheduler = this.scheduler!;
    const jobs = scheduler.list({ botId: this.botId, chatId });
    if (jobs.length === 0) {
      await channel.send({
        chatId,
        text: "No scheduled tasks in this chat.\nAsk in plain words (e.g. \"every weekday at 9am send me an AI news digest\") or use `/cron add`.",
      });
      return;
    }

    const defaultTz = scheduler.timezone();
    const lines: string[] = [`*Scheduled tasks* (${jobs.length})`, ""];
    const buttons: InlineButton[][] = [];
    jobs.forEach((job, i) => {
      const n = i + 1;
      const tz = scheduleTimezone(job.schedule, defaultTz);
      const flag = scheduler.isRunning(job.id) ? " [running]" : job.enabled ? "" : " [paused]";
      lines.push(`*${n}. ${job.name}*${flag}`);
      lines.push(describeSchedule(job.schedule, defaultTz));
      const details: string[] = [];
      if (job.enabled && job.state.nextRunAt) details.push(`Next: ${formatTime(job.state.nextRunAt, tz)}`);
      if (job.state.lastRunAt) {
        details.push(`Last: ${CRON_STATUS_LABELS[job.state.lastStatus ?? ""] ?? job.state.lastStatus} ${formatTime(job.state.lastRunAt, tz)}`);
      }
      if (details.length > 0) lines.push(details.join(" · "));
      if (!job.enabled && job.state.pausedReason) lines.push(`Paused: ${job.state.pausedReason}`);
      lines.push("");

      buttons.push([
        { text: `Run #${n}`, data: `cron:run:${job.id}` },
        job.enabled
          ? { text: `Pause #${n}`, data: `cron:pause:${job.id}` }
          : { text: `Resume #${n}`, data: `cron:resume:${job.id}` },
      ]);
    });
    lines.push("Delete with `/cron rm <number>`.");

    const text = lines.join("\n");
    if (channel.sendWithButtons) {
      await channel.sendWithButtons(chatId, text, buttons);
    } else {
      await channel.send({ chatId, text: `${text}\nRun or pause with \`/cron run|pause|resume <number>\`.` });
    }
  }

  /** Executes one run of a scheduled task in its own session and posts the result to the task's chat. */
  async runScheduledTask(job: CronJob, run: CronRunContext): Promise<CronExecutionResult> {
    const channel = job.channelType === "discord" ? this.discord : this.telegram;
    if (!channel) {
      const reason = `Bot "${this.name}" has no ${job.channelType} connection`;
      return { status: "error", error: reason, pauseReason: reason };
    }
    if (job.createdBy.senderId && !this.canManageCron(job.createdBy.senderId, job.chatId, job.isGroup)) {
      const reason = "The task's creator is no longer authorized in this chat";
      return { status: "error", error: reason, pauseReason: reason };
    }

    const session = this.buildCronSession(job);
    const prompt = buildCronPrompt(job, run, this.scheduler?.timezone() ?? "UTC");

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      this.log.warn({ jobId: job.id, timeoutMs: run.timeoutMs }, "Scheduled task timed out, terminating engine");
      this.engineManager.release(session.sessionId, session.activeEngine);
    }, run.timeoutMs);

    let response: TurnResponse;
    try {
      response = await this.collectResponse(session, prompt);
    } catch (err) {
      response = { text: "", finalText: "", isError: true, errorMessage: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
      // Every run starts from a clean context; only the workspace directory carries over
      this.engineManager.release(session.sessionId, session.activeEngine);
    }

    // A heading one level above the report's ### sections, so consecutive task messages are easy to tell apart
    // on Discord, which groups messages from the same bot; Telegram renders it as a bold line.
    const header = `## ${job.name}`;
    const deliver = (text: string) => new ProgressTracker(channel, job.chatId).finish(`${header}\n\n${text}`);
    // Only the final answer is posted; narration between tool calls ("Running the query...") is dropped
    const output = extractButtons(response.finalText.trim() ? response.finalText : response.text).text.trim();

    if (timedOut) {
      const error = `Timed out after ${Math.round(run.timeoutMs / 60000)} min`;
      await deliver(output ? `${output}\n\n_(${error}, output may be incomplete)_` : error);
      return { status: "timeout", error, output };
    }
    if (response.isError) {
      // If valid output was generated and no fatal error was reported, treat as successful
      // despite any intermediate engine warnings or retried steps
      if (output && !response.errorMessage) {
        if (isSilentOutput(output)) {
          return { status: "silent", output };
        }
        await deliver(output);
        return { status: "ok", output };
      }

      const error = response.errorMessage || "Engine reported an error";
      await deliver(output ? `${output}\n\n_(Run failed: ${error})_` : `Run failed: ${error}`);
      return { status: "error", error, output };
    }
    if (isSilentOutput(output)) {
      return { status: "silent", output };
    }
    await deliver(output || "(Task completed with no output)");
    return { status: "ok", output };
  }

  async notifyChat(chatId: string, channelType: string, text: string): Promise<void> {
    const channel = channelType === "discord" ? this.discord : this.telegram;
    await channel?.send({ chatId, text });
  }

  private async handleJobs(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const access = this.checkAccess(msg);
    if (!access.allowed) return;
    const manager = this.jobManager;
    if (!manager) {
      await channel.send({ chatId: msg.chatId, text: "Background jobs are not available." });
      return;
    }

    const input = msg.text.trim();
    const sub = input.split(/\s+/)[0]?.toLowerCase() ?? "";
    const arg = input.slice(sub.length).trim().replace(/^#/, "");
    if (sub === "" || sub === "list") {
      await this.sendJobList(msg.chatId, channel);
      return;
    }

    const actions: Record<string, "stop" | "log"> = { stop: "stop", cancel: "stop", kill: "stop", log: "log", logs: "log" };
    const action = actions[sub];
    if (!action || !arg) {
      await channel.send({
        chatId: msg.chatId,
        text: [
          "Usage:",
          "• `/jobs` — background jobs in this chat",
          "• `/jobs log <number>` — latest output of a job",
          "• `/jobs stop <number>` — stop a running or queued job",
          "",
          "_Background jobs are long commands (big downloads, training runs, ...) the agent hands off so the chat stays free; it continues when they finish._",
        ].join("\n"),
      });
      return;
    }
    const seq = Number(arg);
    const job = Number.isInteger(seq) ? manager.findBySeq(this.botId, msg.chatId, seq) : undefined;
    if (!job) {
      await channel.send({ chatId: msg.chatId, text: `No background job #${arg} in this chat. Use /jobs to list them.` });
      return;
    }
    if (action === "log") await this.postJobLog(job, channel);
    else await channel.send({ chatId: msg.chatId, text: this.stopJob(job, msg.senderId, msg.senderName) });
  }

  private async sendJobList(chatId: string, channel: ChannelAdapter): Promise<void> {
    const manager = this.jobManager!;
    const jobs = manager.list({ botId: this.botId, chatId });
    if (jobs.length === 0) {
      await channel.send({
        chatId,
        text: "No background jobs in this chat.\nWhen a command will run for a long time (a big download, a training run), the agent hands it off as a background job so the chat stays free, and continues once it finishes.",
      });
      return;
    }

    const active = jobs.filter(isJobActive);
    const recent = jobs.filter((j) => !isJobActive(j)).slice(-5).reverse();
    const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
    const lines: string[] = ["*Background jobs*", ""];
    for (const job of active) {
      const who = job.requester.senderName ? ` · ${job.requester.senderName}` : "";
      const state = job.status === "running" ? `running ${formatDuration(jobDuration(job) ?? 0)}` : "queued";
      lines.push(`*#${job.seq} ${job.title}* [${state}]${who}`);
      lines.push(`\`${clip(job.command.replace(/\s+/g, " "), 80)}\``);
      const last = job.status === "running" ? manager.lastLine(job.id) : undefined;
      if (last) lines.push(`Now: ${clip(last, 120)}`);
    }
    if (active.length === 0) lines.push("Nothing running right now.");
    if (recent.length > 0) {
      lines.push("", "*Recent*");
      for (const job of recent) {
        const took = jobDuration(job);
        lines.push(`#${job.seq} ${job.title} — ${describeJobOutcome(job)}${took !== undefined ? ` in ${formatDuration(took)}` : ""}`);
      }
    }

    // At most five rows, which is all Discord allows
    const buttons: InlineButton[][] = [];
    const stops = active.map((j) => ({ text: `Stop #${j.seq}`, data: `job:stop:${j.id}` }));
    const logs = [...active, ...recent].slice(0, 9).map((j) => ({ text: `Log #${j.seq}`, data: `job:log:${j.id}` }));
    for (const row of [stops, logs]) {
      for (let i = 0; i < row.length; i += 3) buttons.push(row.slice(i, i + 3));
    }

    const text = lines.join("\n");
    if (channel.sendWithButtons) {
      await channel.sendWithButtons(chatId, text, buttons.slice(0, 5));
    } else {
      await channel.send({ chatId, text: `${text}\n\nUse \`/jobs log|stop <number>\`.` });
    }
  }

  /** The requester may stop their own job; in groups, trusted users may stop anyone's. */
  private stopJob(job: BackgroundJob, senderId: string, senderName: string): string {
    const isRequester = Boolean(job.requester.senderId) && senderId === job.requester.senderId;
    if (!isRequester && !this.canManageCron(senderId, job.chatId, job.isGroup)) {
      return `Only ${job.requester.senderName ?? "the requester"} or an authorized user can stop job #${job.seq}.`;
    }
    const res = this.jobManager!.cancel(job.id, senderName);
    if (!res.ok) return `Could not stop job #${job.seq}: ${res.error}`;
    return job.status === "running" ? `Stopping job #${job.seq}: ${job.title}` : `Stopped job #${job.seq}: ${job.title}`;
  }

  private async postJobLog(job: BackgroundJob, channel: ChannelAdapter): Promise<void> {
    const tail = this.jobManager!.readLog(job.id, 30, 3000).replace(/```/g, "'''") || "(no output yet)";
    const state = isJobActive(job) ? job.status : describeJobOutcome(job);
    const md = `**Job #${job.seq} ${job.title}** (${state})\n\`\`\`\n${tail}\n\`\`\``;
    if (channel.type === "telegram") {
      const html = markdownToTelegramHtml(md);
      await channel.send({ chatId: job.chatId, text: html, parseMode: "HTML", plainFallback: stripHtml(html) });
    } else {
      await channel.send({ chatId: job.chatId, text: md });
    }
  }

  /**
   * The callback for a finished job: queues a turn in the conversation that started it, telling the agent how
   * the command ended so it can continue. The reply answers the original message and mentions the requester.
   */
  async handleJobFinished(job: BackgroundJob): Promise<JobCallbackState> {
    // Whoever stopped it already saw the confirmation
    if (job.status === "cancelled") return "skipped";
    const channel = job.channelType === "discord" ? this.discord : this.telegram;
    if (!channel) return "failed";

    let state: JobCallbackState = "done";
    await this.enqueueTurn(job.chatId, async () => {
      try {
        await this.runJobCallback(job, channel);
      } catch (err) {
        state = "failed";
        this.log.error({ error: err, jobId: job.id }, "Background job follow-up failed");
      }
    });
    return state;
  }

  private async runJobCallback(job: BackgroundJob, channel: ChannelAdapter): Promise<void> {
    const manager = this.jobManager!;
    // Continue the session that started the job, even if the chat has switched to another one since
    const session =
      (job.sessionId ? this.sessionManager.findSession(job.sessionId) : undefined) ??
      this.sessionManager.resolve({
        chatId: job.chatId,
        channelType: job.channelType,
        isGroup: job.isGroup,
        defaultEngine: this.config.engine,
        defaultModel: this.config.model,
        defaultEffort: this.config.effort,
      });
    const prompt = buildJobCallbackPrompt(job, manager.readLog(job.id, 40, 4000), manager.logPath(job.id));
    const outcome = `Background job #${job.seq} "${job.title}" ${describeJobOutcome(job)}`;
    this.sessionManager.addTurn(session.sessionId, { role: "system", text: `[${outcome}]` });

    // The follow-up acts for the requester, e.g. if it starts the next job of a pipeline
    const tracker = new ProgressTracker(channel, job.chatId, job.originMessageId);
    this.turnSenders.set(job.chatId, {
      senderId: job.requester.senderId ?? "",
      senderName: job.requester.senderName ?? "",
      messageId: job.originMessageId ?? "",
      sessionId: session.sessionId,
      jobsStarted: 0,
      messageIds: new Set(job.originMessageId ? [job.originMessageId] : []),
      tracker,
    });
    tracker.start();
    try {
      const response = await this.collectResponse(session, prompt, tracker);
      const { text, buttons } = extractButtons(response.text);
      const reply = text || `${outcome}.${response.errorMessage ? `\n(Follow-up failed: ${response.errorMessage})` : ""}`;
      this.sessionManager.addTurn(session.sessionId, { role: "assistant", text: reply, engine: session.activeEngine });
      session.lastEngine = session.activeEngine;
      await this.sessionManager.flush(job.chatId);
      const mention =
        job.isGroup && job.requester.senderId ? { id: job.requester.senderId, name: job.requester.senderName || "requester" } : undefined;
      await tracker.finish(reply, buttons, { mention });
    } catch (err) {
      tracker.stop();
      throw err;
    } finally {
      this.turnSenders.delete(job.chatId);
      this.releaseSteered(session.sessionId);
    }
  }

  private buildCronSession(job: CronJob): Session {
    const engine = job.engine ?? this.config.engine;
    // The bot's model/effort defaults belong to its default engine
    const useBotDefaults = engine === this.config.engine;
    const model = job.model ?? (useBotDefaults ? this.config.model : undefined);
    const effort = job.effort ?? (useBotDefaults ? this.config.effort : undefined);
    return {
      sessionId: cronSessionId(job.id),
      chatId: job.chatId,
      channelType: job.channelType,
      activeEngine: engine,
      model,
      effort,
      engineModels: model ? { [engine]: model } : {},
      engineEfforts: effort ? { [engine]: effort } : {},
      createdAt: job.createdAt,
      lastActiveAt: Date.now(),
      title: job.name,
      isActive: false,
      sessionNum: 0,
      isGroup: job.isGroup,
      turns: [],
    };
  }

  private async collectResponse(session: Session, promptText: string, tracker?: ProgressTracker): Promise<TurnResponse> {
    let text = "";
    let finalText = "";
    let isError = false;
    let errorMessage: string | undefined;
    for await (const event of this.engineManager.sendMessage(
      session,
      promptText,
      this.botId,
      this.config.extraArgs,
      this.botIdentity(),
    )) {
      if (event.type === "thinking_started") {
        tracker?.thinking();
      } else if (event.type === "tool_started") {
        tracker?.toolStart(event.name, event.detail);
        finalText = "";
      } else if (event.type === "text") {
        tracker?.appendText(event.text);
        text += event.text;
        finalText += event.text;
      } else if (event.type === "result") {
        const hadPriorText = Boolean(text);
        if (event.result && !text) {
          text = event.result;
          finalText = event.result;
        }
        if (event.isError) {
          isError = true;
          if (!errorMessage && !hadPriorText && event.result) {
            errorMessage = event.result;
          }
        }
      } else if (event.type === "error") {
        isError = true;
        errorMessage = event.message;
      }
    }
    if (!text && tracker?.getBuffer()) {
      text = tracker.getBuffer();
    }
    return { text, finalText, isError, errorMessage };
  }

  private async handleHelp(msg: InboundMessage, channel: ChannelAdapter): Promise<void> {
    const helpText = [
      `🎒 *PocketAgent — 4-in-1 AI Gateway*`,
      ``,
      `*Commands:*`,
      `• \`/engine [claude|codex|agy|grok]\` — Switch CLI engine with seamless context handover`,
      `• \`/model [name]\` — Dynamically choose or view models supported by current engine`,
      `• \`/effort [low|med|high]\` — Configure reasoning effort depth`,
      `• \`/status\` — View current session, engine, model & status`,
      `• \`/new\` — Start a fresh session`,
      `• \`/sessions [num]\` — List and switch sessions`,
      `• \`/btw <question>\` — Ask side question in parallel`,
      `• \`/queue <message>\` — Run a message after the current task instead of adding it to the task`,
      `• \`/stop\` — Interrupt current task`,
      `• \`/cron\` — List and manage scheduled tasks (or just ask: "every day at 8am ...")`,
      `• \`/jobs\` — Background jobs (long commands running outside the chat): progress, logs, stop`,
      `• \`/help\` — Show this help message`,
      ``,
      `_Tip: Simply send any message, photo, or file to start coding!_`,
    ].join("\n");

    await channel.send({ chatId: msg.chatId, text: helpText });
  }

  private async handleMessage(msg: InboundMessage, channel: ChannelAdapter, opts: { queue?: boolean } = {}): Promise<void> {
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

    const hasAttachments = (msg.attachments && msg.attachments.length > 0) || (msg.replyAttachments && msg.replyAttachments.length > 0);
    if (!msg.text.trim()) {
      if (hasAttachments) {
        const firstType = msg.attachments?.[0]?.type ?? msg.replyAttachments?.[0]?.type;
        if (firstType === "photo") {
          msg.text = "Please inspect the attached image.";
        } else if (firstType === "voice") {
          msg.text = "Please listen to the attached voice message and respond.";
        } else if (firstType === "audio") {
          msg.text = "Please listen to the attached audio file and respond.";
        } else {
          msg.text = "Please inspect the attached file.";
        }
      } else {
        if (msg.channelType === "discord") {
          await channel.send({
            chatId: msg.chatId,
            text: `👋 Hi! I received your message, but I cannot read the message content.\n\n⚠️ **Please enable \`MESSAGE CONTENT INTENT\`** in [Discord Developer Portal](https://discord.com/developers/applications) under **Bot -> Privileged Gateway Intents**, then run \`pa restart\`.`,
          });
        }
        return;
      }
    }

    if (!opts.queue && (await this.trySteer(msg, channel))) return;
    if (this.busyChats.has(msg.chatId)) {
      void channel.setReaction?.(msg.chatId, msg.messageId, REACTION_QUEUED);
    }
    await this.enqueueTurn(msg.chatId, () => this.processTurn(msg, channel));
  }

  /**
   * Adds a message to the turn running in its chat, when the engine can take it mid-turn and the message is
   * about that turn (see decideFollowUp). It waits in the steer mailbox until a hook of the CLI picks it up.
   */
  private async trySteer(msg: InboundMessage, channel: ChannelAdapter): Promise<boolean> {
    if (!this.steerMailbox || this.config.followUp === "queue") return false;
    const turn = this.turnSenders.get(msg.chatId);
    if (!turn || !this.busyChats.has(msg.chatId)) return false;
    const session = this.sessionManager.findSession(turn.sessionId);
    if (!session || !this.engineManager.supportsSteer(session.activeEngine)) return false;

    const turnMessageIds = new Set(turn.messageIds);
    const progressId = turn.tracker?.getMessageId();
    if (progressId) turnMessageIds.add(progressId);
    const decision = decideFollowUp({
      senderId: msg.senderId,
      replyToMessageId: msg.replyToMessageId,
      turnSenderId: turn.senderId,
      turnMessageIds,
    });
    if (decision !== "steer") return false;

    const text = await this.formatMessage(msg);
    // The turn may have ended while attachments downloaded; then the message gets a turn of its own
    if (this.turnSenders.get(msg.chatId) !== turn || !this.engineManager.isBusy(turn.sessionId, session.activeEngine)) {
      return false;
    }

    turn.messageIds.add(msg.messageId);
    void channel.setReaction?.(msg.chatId, msg.messageId, REACTION_STEER_PENDING);
    this.steerMailbox.push({
      sessionId: turn.sessionId,
      messageId: msg.messageId,
      senderName: msg.senderName,
      text,
      onDelivered: () => {
        this.sessionManager.addTurn(turn.sessionId, { role: "user", text: historyTextOf(msg), author: msg.senderName });
        void channel.setReaction?.(msg.chatId, msg.messageId, REACTION_STEER_DELIVERED);
      },
      onUndelivered: () => {
        void channel.setReaction?.(msg.chatId, msg.messageId, REACTION_QUEUED);
        void this.enqueueTurn(msg.chatId, () => this.processTurn(msg, channel));
      },
    });
    this.log.info({ chatId: msg.chatId, sessionId: turn.sessionId, messageId: msg.messageId }, "Message will join the running turn");
    return true;
  }

  /** Messages that were to join a turn which ended before any hook took them get turns of their own. */
  private releaseSteered(sessionId: string): void {
    for (const item of this.steerMailbox?.drain(sessionId) ?? []) {
      item.onUndelivered?.();
    }
  }

  /** A chat message as the agent reads it: time, sender, quoted reply, text and downloaded attachments. */
  private async formatMessage(msg: InboundMessage): Promise<string> {
    const dt = new Date(msg.timestamp * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;

    let text = `[${ts}] ${msg.senderName}:\n`;
    if (msg.replyText) {
      const quoteName = msg.replySenderName ?? "Unknown";
      const quoted = msg.replyText.split("\n").map((l) => `> ${l}`).join("\n");
      text += `[In reply to ${quoteName}]:\n${quoted}\n\n`;
    }
    text += msg.text;

    const allAttachments = [...(msg.attachments ?? []), ...(msg.replyAttachments ?? [])];
    const adapter = msg.channelType === "discord" ? this.discord : this.telegram;
    if (adapter?.downloadFile && allAttachments.length > 0) {
      const downloadsDir = join(this.dataDir, "downloads", this.botId, msg.chatId);
      for (const att of allAttachments) {
        try {
          const localPath = await adapter.downloadFile(att.fileId, downloadsDir, att.fileName);
          text += `\n[Attached ${att.type}: ${localPath}]`;
        } catch (err) {
          this.log.error({ error: err }, "Failed to download attachment");
        }
      }
    }
    return text;
  }

  /** Runs turns of a chat one at a time: its session has a single engine process. */
  private enqueueTurn(chatId: string, run: () => Promise<void>): Promise<void> {
    const prevQueue = this.chatQueues.get(chatId) ?? Promise.resolve();
    const nextQueue = prevQueue.then(async () => {
      this.busyChats.add(chatId);
      try {
        await run();
      } finally {
        this.busyChats.delete(chatId);
      }
    }).catch((err) => {
      this.log.error({ error: err }, "Chat queue error");
    });
    this.chatQueues.set(chatId, nextQueue);
    return nextQueue;
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

    const pad = (n: number) => String(n).padStart(2, "0");

    // Optimize context: provide up to 100 recent group messages with reply context,
    // and if there is an overlap with previously sent messages in this session, only send the new delta.
    let contextBlock = "";
    const shouldFetchContext = Boolean(msg.isGroup || msg.channelType === "discord");

    if (shouldFetchContext) {
      let history: HistoryMessage[] = [];
      if (channel.fetchHistory) {
        try {
          history = await channel.fetchHistory(msg.chatId, 100);
        } catch (err) {
          this.log.error({ error: err, chatId: msg.chatId }, "Failed to fetch channel history");
        }
      } else if (this.messageStore) {
        const stored = this.messageStore.getRecent(msg.chatId, 100);
        history = stored.map((s) => ({
          id: s.id,
          ts: s.ts,
          sender: s.sender,
          senderId: s.senderId,
          text: s.text,
          media: s.media,
        }));
      }

      // Prior messages must be strictly BEFORE the trigger message!
      // If messages arrived after msg.messageId (e.g. concurrent User 2 message), do NOT include them as prior history for this turn.
      const triggerIdx = history.findIndex((m) => m.id === msg.messageId);
      const priorMessages = triggerIdx !== -1 ? history.slice(0, triggerIdx) : history.filter((m) => m.id !== msg.messageId);

      const lastCursor = session.lastContextMessageId;
      let newMessages: HistoryMessage[] = [];
      let header = "### Recent Group Chat Context (prior messages leading up to this turn):";

      if (!lastCursor) {
        // Initial turn for this session: provide up to 100 recent messages
        newMessages = priorMessages.slice(-100);
      } else {
        const cursorIdx = priorMessages.findIndex((m) => m.id === lastCursor);
        if (cursorIdx !== -1) {
          // Found intersection with previously sent messages: ONLY send newly added messages!
          newMessages = priorMessages.slice(cursorIdx + 1);
          header = "### New Group Chat Messages (since last turn):";

          // If the delta consists purely of the bot's own outbound messages (no third-party user messages),
          // suppress it so we don't send redundant messages to the engine.
          const botChannelId = (channel as any).client?.user?.id;
          const hasOtherUserMessages = newMessages.some((m) => (botChannelId ? m.senderId !== botChannelId : true) && m.sender !== this.name);
          if (!hasOtherUserMessages) {
            newMessages = [];
          }
        } else {
          // Gap exceeded recent window, provide up to 100 messages
          newMessages = priorMessages.slice(-100);
        }
      }

      if (newMessages.length > 0) {
        const lines = newMessages.map((m) => {
          const mDt = new Date(m.ts * 1000);
          const time = `${pad(mDt.getHours())}:${pad(mDt.getMinutes())}:${pad(mDt.getSeconds())}`;
          let line = `[${time}] ${m.sender}`;
          if (m.replyToSender || m.replyToText) {
            const target = m.replyToSender || "someone";
            const snippet = m.replyToText
              ? ` "${m.replyToText.slice(0, 80).replace(/\n/g, " ")}${m.replyToText.length > 80 ? "..." : ""}"`
              : "";
            line += ` (replying to ${target}${snippet})`;
          }
          const body = m.text || (m.media ? `[${m.media.join(", ")}]` : "");
          return `${line}: ${body}`;
        });
        contextBlock = `${header}\n${lines.join("\n")}\n\n`;
      }

      // Advance cursor to current message
      session.lastContextMessageId = msg.messageId;
    }

    const promptText = contextBlock + (await this.formatMessage(msg));

    // Record turn in session history
    this.sessionManager.addTurn(session.sessionId, {
      role: "user",
      text: historyTextOf(msg),
      author: msg.senderName,
    });

    const tracker = new ProgressTracker(channel, msg.chatId, msg.messageId);
    this.turnSenders.set(msg.chatId, {
      senderId: msg.senderId,
      senderName: msg.senderName,
      messageId: msg.messageId,
      sessionId: session.sessionId,
      jobsStarted: 0,
      messageIds: new Set([msg.messageId]),
      tracker,
    });
    tracker.start();

    try {
      const response = await this.collectResponse(session, promptText, tracker);

      // Check for inline buttons markup: [button: Opt1 | Opt2] or <<Opt1>>
      const { text: fullResponse, buttons } = extractButtons(response.text);

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
    } finally {
      this.turnSenders.delete(msg.chatId);
      this.releaseSteered(session.sessionId);
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
