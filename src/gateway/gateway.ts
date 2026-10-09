import { existsSync, mkdirSync, watch, type FSWatcher, readdirSync, statSync, readFileSync, rmSync, openSync, readSync, closeSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import type { Logger } from "pino";
import { ApiServer, type ApiSessionBinding, type CronApiResult, type JobApiResult } from "../api/server.js";
import { DEFAULT_SEND_LIMITS } from "../api/send-limiter.js";
import { BotInstance } from "../bot/bot-instance.js";
import { setMessageStore } from "../channels/telegram/handlers.js";
import { loadConfig, resolveBots, resolveDataDir, saveConfig, syncPairingToConfig } from "../config/loader.js";
import type { GatewayConfig, ResolvedBotConfig } from "../config/types.js";
import type { EngineType } from "../config/schema.js";
import { EngineManager } from "../engines/manager.js";
import { MessageStore } from "../sessions/message-store.js";
import { SkillRegistry } from "../skills/index.js";
import { Scheduler } from "../scheduler/scheduler.js";
import { CronStore } from "../scheduler/store.js";
import { cronSessionId, formatTime, parseScheduleInput, scheduleTimezone } from "../scheduler/schedule.js";
import type { CronCreator, CronJob, CronJobPatch, CronSchedule } from "../scheduler/types.js";
import { JobManager } from "../jobs/manager.js";
import { JobStore } from "../jobs/store.js";
import { jobDuration } from "../jobs/format.js";
import { isEphemeralSessionId, isJobActive, type BackgroundJob } from "../jobs/types.js";
import { answerSteerHook, SteerMailbox } from "../steer/steer.js";

export interface SessionSummary {
  botId: string;
  botName: string;
  chatId: string;
  channelType: string;
  sessionId: string;
  sessionNum: number;
  title?: string;
  activeEngine: string;
  model?: string;
  effort?: string;
  isActive: boolean;
  turnCount: number;
  createdAt: number;
  lastActiveAt: number;
  workspacePath: string;
  workspaceExists: boolean;
  workspaceFileCount?: number;
  workspaceSizeBytes?: number;
}

export interface WorkspaceSummary {
  id: string;
  path: string;
  folderName: string;
  botId?: string;
  botName?: string;
  chatId?: string;
  sessionId?: string;
  fileCount: number;
  sizeBytes: number;
  mtime: number;
  isActiveSession: boolean;
  isKnownSession: boolean;
}

export interface WorkspaceFileInfo {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

function getDirectoryStats(dirPath: string, maxFiles = 1000): { fileCount: number; sizeBytes: number; latestMtime: number } {
  let fileCount = 0;
  let sizeBytes = 0;
  let latestMtime = 0;

  try {
    const queue = [dirPath];
    while (queue.length > 0 && fileCount < maxFiles) {
      const current = queue.shift()!;
      let entries: string[] = [];
      try {
        entries = readdirSync(current);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        const full = join(current, entry);
        try {
          const st = statSync(full);
          if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
          if (st.isDirectory()) {
            queue.push(full);
          } else if (st.isFile()) {
            fileCount++;
            sizeBytes += st.size;
          }
        } catch {}
        if (fileCount >= maxFiles) break;
      }
    }
  } catch {}

  return { fileCount, sizeBytes, latestMtime };
}

export class Gateway {
  private config: GatewayConfig;
  private log: Logger;
  private engineManager: EngineManager;
  private apiServer?: ApiServer;
  private messageStore: MessageStore;
  private bots = new Map<string, BotInstance>();
  private dataDir: string;
  private configPath: string;
  private configWatcher?: FSWatcher;
  private lastReloadTime = 0;
  private scheduler: Scheduler;
  private jobManager: JobManager;
  // Chat messages waiting to join the turn running in their session
  private steerMailbox = new SteerMailbox();

  constructor(config: GatewayConfig, log: Logger, configPath?: string) {
    this.config = config;
    this.log = log;
    this.dataDir = resolveDataDir(config);
    this.configPath = configPath ?? join(this.dataDir, "config.yaml");

    this.messageStore = new MessageStore(this.dataDir);
    setMessageStore(this.messageStore);

    const workspacesDir = join(this.dataDir, "workspaces");
    const agentsDir = join(this.dataDir, "agents");
    mkdirSync(workspacesDir, { recursive: true });
    mkdirSync(agentsDir, { recursive: true });

    this.engineManager = new EngineManager(
      config,
      log,
      config.gateway.port,
      this.dataDir,
    );

    this.scheduler = new Scheduler({
      store: new CronStore(join(this.dataDir, "cron")),
      log,
      getSettings: () => this.config.scheduler,
      executor: async (job, run) => {
        const bot = this.bots.get(job.botId);
        if (!bot) {
          return { status: "error", error: "Bot not found", pauseReason: "The bot is no longer configured" };
        }
        return bot.runScheduledTask(job, run);
      },
      notify: async (job, text) => {
        await this.bots.get(job.botId)?.notifyChat(job.chatId, job.channelType, text);
      },
    });

    this.jobManager = new JobManager({
      store: new JobStore(join(this.dataDir, "jobs")),
      log,
      getSettings: () => this.config.jobs,
      onFinish: async (job) => {
        const bot = this.bots.get(job.botId);
        return bot ? bot.handleJobFinished(job) : "failed";
      },
    });

    const botConfigs = resolveBots(config);
    for (const botConfig of botConfigs) {
      const bot = new BotInstance({
        botConfig,
        gatewayConfig: config,
        engineManager: this.engineManager,
        messageStore: this.messageStore,
        dataDir: this.dataDir,
        log,
        scheduler: this.scheduler,
        jobs: this.jobManager,
        steerMailbox: this.steerMailbox,
      });
      this.bots.set(bot.botId, bot);
    }

    if (this.bots.size === 0) {
      this.log.warn("No bots configured. Check config.yaml for bots[] or channels.");
    }
  }

  async start(): Promise<void> {
    this.log.info("Starting PocketAgent Gateway...");

    this.apiServer = new ApiServer({
      port: this.config.gateway.port,
      steerHook: (engine, event, sessionId, payload) => this.answerSteerHook(engine, event, sessionId, payload),
      getBotTelegram: (botId) => this.bots.get(botId)?.telegram,
      getBotChannel: (botId, channelType) => this.bots.get(botId)?.getChannel(channelType),
      resolveSession: (sessionId) => this.resolveApiSession(sessionId),
      getSendLimits: () => this.config.agentMessages ?? DEFAULT_SEND_LIMITS,
      dataDir: this.dataDir,
      log: this.log,
      messageStore: this.messageStore,
      configPath: this.configPath,
      getConfig: () => this.config,
      onSaveConfig: async (newConfigOrYaml) => {
        const saved = saveConfig(this.configPath, newConfigOrYaml);
        if (!saved.ok) {
          return { ok: false, changes: [], error: saved.error };
        }
        const reloadRes = await this.reloadConfig(saved.config);
        return { ok: reloadRes.ok, changes: reloadRes.changes, error: reloadRes.ok ? undefined : reloadRes.changes.join("; ") };
      },
      onReloadConfig: () => this.reloadConfig(),
      getBotsInfo: () => this.getBotsInfo(),
      getEngineManager: () => this.engineManager,
      getPendingPairings: () => this.getPendingPairings(),
      approvePairing: (code) => this.approvePairing(code),
      getAllSessions: () => this.getAllSessions(),
      getSessionTurns: (botId, chatId, sessionId) => this.getSessionTurns(botId, chatId, sessionId),
      switchSession: (botId, chatId, sessionId) => this.switchSession(botId, chatId, sessionId),
      createSession: (botId, chatId, engine, model, effort, title) => this.createSession(botId, chatId, engine, model, effort, title),
      deleteSession: (botId, chatId, sessionId, deleteWorkspace) => this.deleteSession(botId, chatId, sessionId, deleteWorkspace),
      getAllWorkspaces: () => this.getAllWorkspaces(),
      getWorkspaceFiles: (wsPath, subDir) => this.getWorkspaceFiles(wsPath, subDir),
      readWorkspaceFile: (wsPath, filePath) => this.readWorkspaceFile(wsPath, filePath),
      deleteWorkspace: (wsPath) => this.deleteWorkspace(wsPath),
      cron: {
        list: (filter) => this.scheduler.list(filter).map((job) => this.toCronJobView(job)),
        create: (body) => this.createCronJob(body),
        update: (body) => this.updateCronJob(body),
        remove: (id) => this.withCronJob(id, (job) => {
          this.scheduler.remove(job.id);
          return { ok: true };
        }),
        run: (id) => this.withCronJob(id, (job) => this.scheduler.runNow(job.id)),
        runs: (id, limit) => (this.scheduler.get(id) ? this.scheduler.listRuns(id, limit) : null),
        timezone: () => this.scheduler.timezone(),
      },
      jobs: {
        list: (filter) => this.jobManager.list(filter).map((job) => this.toJobView(job)),
        get: (id) => {
          const job = this.jobManager.get(id);
          return job ? { ...this.toJobView(job), log_tail: this.jobManager.readLog(job.id, 100, 20_000) } : null;
        },
        log: (id, lines) => {
          const job = this.jobManager.get(id);
          return job ? { log: this.jobManager.readLog(job.id, lines, 200_000), status: job.status } : null;
        },
        create: (body, callerSessionId) => this.createJob(body, callerSessionId),
        cancel: (id, callerSessionId) => this.cancelJob(id, callerSessionId),
        remove: (id) => {
          const res = this.jobManager.remove(id);
          return res.ok ? { ok: true } : { ok: false, error: res.error, status: res.error === "Job not found" ? 404 : 400 };
        },
      },
    });
    await this.apiServer.start();

    // Notify bots of peers
    this.syncPeerBots();

    for (const bot of this.bots.values()) {
      await bot.start();
    }
    this.syncPeerBots();

    this.scheduler.start();
    this.jobManager.start();
    this.startConfigWatcher();
    this.log.info("PocketAgent Gateway running successfully");
  }

  /** The bot and chat of a CLI session that calls the API, so its messages cannot go anywhere else. */
  private resolveApiSession(sessionId: string): ApiSessionBinding | undefined {
    for (const bot of this.bots.values()) {
      const found = bot.resolveApiSession(sessionId);
      if (found) return { botId: bot.botId, ...found };
    }
    return undefined;
  }

  /** Hands the messages waiting for a session to its running turn, through the hook that asked. */
  private answerSteerHook(engine: string, event: string, sessionId: string, payload: Record<string, unknown>): Record<string, unknown> {
    let agyConversationId: string | undefined;
    for (const bot of this.bots.values()) {
      const session = bot.getSessionManager().findSession(sessionId);
      if (session) {
        agyConversationId = session.agySessionId;
        break;
      }
    }
    const { output, delivered } = answerSteerHook(this.steerMailbox, engine, event, sessionId, payload, agyConversationId);
    if (delivered.length > 0) {
      this.log.info({ sessionId, engine, event, count: delivered.length }, "Relayed chat messages into the running turn");
    }
    return output;
  }

  private syncPeerBots(): void {
    const peers: Array<{ name: string; username: string }> = [];
    for (const bot of this.bots.values()) {
      const username = bot.telegram?.username ?? bot.discord?.username;
      if (username) {
        peers.push({ name: bot.name, username });
      }
    }
    for (const bot of this.bots.values()) {
      bot.setPeerBots(peers);
    }
  }

  async reloadConfig(newConfig?: GatewayConfig): Promise<{ ok: boolean; changes: string[] }> {
    try {
      this.lastReloadTime = Date.now();
      const freshConfig = newConfig ?? loadConfig(this.configPath);
      const changes: string[] = [];

      // Check default engine
      const oldEngine = this.config.defaultEngine ?? this.config.engine ?? this.config.engines.default ?? "claude";
      const newEngine = freshConfig.defaultEngine ?? freshConfig.engine ?? freshConfig.engines.default ?? "claude";
      if (oldEngine !== newEngine) {
        changes.push(`Default engine: ${oldEngine} → ${newEngine}`);
      }

      // Check log level
      if (this.config.gateway.logLevel !== freshConfig.gateway.logLevel) {
        this.log.level = freshConfig.gateway.logLevel;
        changes.push(`Log level: ${this.config.gateway.logLevel} → ${freshConfig.gateway.logLevel}`);
      }

      // Update engine manager
      this.engineManager.updateConfig(freshConfig);
      changes.push("Engine runtime configurations updated");

      // Update bots
      const newBotConfigs = resolveBots(freshConfig);
      const newBotMap = new Map<string, ResolvedBotConfig>();
      for (const bc of newBotConfigs) {
        newBotMap.set(bc.botId, bc);
      }

      // 1. Remove bots no longer in config
      for (const [botId, bot] of Array.from(this.bots.entries())) {
        if (!newBotMap.has(botId)) {
          this.log.info({ bot: bot.name, botId }, "Stopping removed bot");
          await bot.stop();
          this.bots.delete(botId);
          changes.push(`Stopped and removed bot "${bot.name}"`);
        }
      }

      // 2. Add new bots or update existing
      for (const bc of newBotConfigs) {
        const existing = this.bots.get(bc.botId);
        if (existing) {
          existing.updateConfig(bc);
          changes.push(`Updated bot "${bc.name}"`);
        } else {
          this.log.info({ bot: bc.name, botId: bc.botId }, "Starting new bot");
          const newBot = new BotInstance({
            botConfig: bc,
            gatewayConfig: freshConfig,
            engineManager: this.engineManager,
            messageStore: this.messageStore,
            dataDir: this.dataDir,
            log: this.log,
            scheduler: this.scheduler,
            jobs: this.jobManager,
            steerMailbox: this.steerMailbox,
          });
          await newBot.start();
          this.bots.set(newBot.botId, newBot);
          changes.push(`Started new bot "${bc.name}" (${bc.channel})`);
        }
      }

      this.syncPeerBots();

      // Sync skills
      try {
        const synced = SkillRegistry.getInstance().sync();
        if (synced.length > 0) {
          changes.push(`Synchronized ${synced.length} skills across engines`);
        }
      } catch {}

      this.config = freshConfig;
      this.scheduler.refresh();
      this.jobManager.refresh();
      this.log.info({ changes }, "Config hot-reloaded successfully");
      return { ok: true, changes };
    } catch (err) {
      this.log.error({ error: err }, "Failed to reload config");
      return { ok: false, changes: [err instanceof Error ? err.message : String(err)] };
    }
  }

  getBotsInfo() {
    return Array.from(this.bots.values()).map((bot) => ({
      name: bot.name,
      channel: bot.config.channel,
      botId: bot.botId,
      username: bot.getUsername(),
      status: "online" as const,
      engine: bot.config.engine,
      model: bot.config.model,
      effort: bot.config.effort,
      dmPolicy: bot.config.dmPolicy,
      groupPolicy: bot.config.groupPolicy,
      guildPolicy: bot.config.guildPolicy,
      allowFrom: bot.getAllowFrom(),
      groups: bot.getRuntimeGroups(),
    }));
  }

  getPendingPairings() {
    const all: Array<{ botName: string; botId: string; req: any }> = [];
    for (const bot of this.bots.values()) {
      const pending = bot.getPendingPairings();
      for (const req of pending) {
        all.push({ botName: bot.name, botId: bot.botId, req });
      }
    }
    return all;
  }

  async approvePairing(code: string): Promise<{ ok: boolean; senderId?: string; botName?: string; error?: string }> {
    for (const bot of this.bots.values()) {
      const res = bot.approvePairing(code);
      if (res) {
        syncPairingToConfig(this.configPath, bot.name, res.senderId, res.chatId);
        return { ok: true, senderId: res.senderId, botName: bot.name };
      }
    }
    return { ok: false, error: "Pairing code not found or expired" };
  }

  getAllSessions(): SessionSummary[] {
    const results: SessionSummary[] = [];
    for (const bot of this.bots.values()) {
      const sm = bot.getSessionManager();
      const chats = sm.getAllChats();
      for (const chat of chats) {
        const safeChatId = chat.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
        for (const s of chat.sessions) {
          const wsPath = join(this.dataDir, "workspaces", bot.botId, `${safeChatId}_${s.sessionId}`);
          const wsExists = existsSync(wsPath);
          let wsFileCount = 0;
          let wsSizeBytes = 0;
          if (wsExists) {
            const stats = getDirectoryStats(wsPath);
            wsFileCount = stats.fileCount;
            wsSizeBytes = stats.sizeBytes;
          }
          results.push({
            botId: bot.botId,
            botName: bot.name,
            chatId: chat.chatId,
            channelType: s.channelType,
            sessionId: s.sessionId,
            sessionNum: s.sessionNum,
            title: s.title,
            activeEngine: s.activeEngine,
            model: s.model,
            effort: s.effort,
            isActive: s.isActive,
            turnCount: s.turns?.length ?? 0,
            createdAt: s.createdAt,
            lastActiveAt: s.lastActiveAt,
            workspacePath: wsPath,
            workspaceExists: wsExists,
            workspaceFileCount: wsFileCount,
            workspaceSizeBytes: wsSizeBytes,
          });
        }
      }
    }
    results.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return results;
  }

  getSessionTurns(botId: string, chatId: string, sessionId: string) {
    const bot = this.bots.get(botId);
    if (!bot) return null;
    const sm = bot.getSessionManager();
    const chats = sm.getAllChats();
    const chat = chats.find((c) => c.chatId === chatId);
    if (!chat) return null;
    const session = chat.sessions.find((s) => s.sessionId === sessionId);
    if (!session) return null;
    return {
      session: {
        sessionId: session.sessionId,
        sessionNum: session.sessionNum,
        chatId: session.chatId,
        botId: bot.botId,
        botName: bot.name,
        activeEngine: session.activeEngine,
        model: session.model,
        effort: session.effort,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
      },
      turns: session.turns ?? [],
    };
  }

  switchSession(botId: string, chatId: string, sessionId: string) {
    const bot = this.bots.get(botId);
    if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    const sm = bot.getSessionManager();
    const switched = sm.switchSessionById(chatId, sessionId);
    if (!switched) return { ok: false, error: "Session not found" };
    return { ok: true, session: switched };
  }

  createSession(botId: string, chatId: string, engine?: EngineType, model?: string, effort?: string, title?: string) {
    const bot = this.bots.get(botId);
    if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    const sm = bot.getSessionManager();
    const s = sm.createNew(chatId, engine, model, effort, title);
    return { ok: true, session: s };
  }

  deleteSession(botId: string, chatId: string, sessionId: string, deleteWorkspace = false) {
    const bot = this.bots.get(botId);
    if (!bot) return { ok: false, error: `Bot ${botId} not found` };
    const sm = bot.getSessionManager();
    const ok = sm.deleteSession(chatId, sessionId);
    if (!ok) return { ok: false, error: "Session not found" };

    if (deleteWorkspace) {
      const safeChatId = chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const wsPath = join(this.dataDir, "workspaces", botId, `${safeChatId}_${sessionId}`);
      try {
        if (existsSync(wsPath)) {
          rmSync(wsPath, { recursive: true, force: true });
        }
      } catch (err) {
        this.log.warn({ error: err, wsPath }, "Could not delete workspace directory for session");
      }
    }
    return { ok: true };
  }

  getAllWorkspaces(): WorkspaceSummary[] {
    const workspacesRoot = resolve(join(this.dataDir, "workspaces"));
    if (!existsSync(workspacesRoot)) return [];

    const activeSessions = new Set<string>();
    const knownSessions = new Set<string>();
    const botMap = new Map<string, string>();

    for (const bot of this.bots.values()) {
      botMap.set(bot.botId, bot.name);
      const sm = bot.getSessionManager();
      for (const chat of sm.getAllChats()) {
        for (const s of chat.sessions) {
          knownSessions.add(`${bot.botId}:${s.sessionId}`);
          if (s.isActive) {
            activeSessions.add(`${bot.botId}:${s.sessionId}`);
          }
        }
      }
    }
    // Scheduled tasks keep a persistent workspace per task
    for (const job of this.scheduler.list()) {
      knownSessions.add(`${job.botId}:${cronSessionId(job.id)}`);
    }

    const workspaces: WorkspaceSummary[] = [];

    try {
      const topEntries = readdirSync(workspacesRoot, { withFileTypes: true });
      for (const top of topEntries) {
        if (top.name.startsWith(".")) continue;
        if (!top.isDirectory()) continue;

        const topPath = join(workspacesRoot, top.name);
        const subEntries = readdirSync(topPath, { withFileTypes: true });

        const hasSubDirs = subEntries.some((e) => e.isDirectory());
        if (hasSubDirs) {
          const botId = top.name;
          const botName = botMap.get(botId);
          for (const sub of subEntries) {
            if (sub.name.startsWith(".") || !sub.isDirectory()) continue;
            const wsPath = join(topPath, sub.name);
            const stats = getDirectoryStats(wsPath);

            let chatId: string | undefined;
            let sessionId: string | undefined;
            const lastUnderscore = sub.name.lastIndexOf("_");
            if (lastUnderscore > 0) {
              chatId = sub.name.slice(0, lastUnderscore);
              sessionId = sub.name.slice(lastUnderscore + 1);
            }

            const isKnown = sessionId ? knownSessions.has(`${botId}:${sessionId}`) : false;
            const isActive = sessionId ? activeSessions.has(`${botId}:${sessionId}`) : false;

            workspaces.push({
              id: `${botId}/${sub.name}`,
              path: wsPath,
              folderName: sub.name,
              botId,
              botName,
              chatId,
              sessionId,
              fileCount: stats.fileCount,
              sizeBytes: stats.sizeBytes,
              mtime: stats.latestMtime || statSync(wsPath).mtimeMs,
              isActiveSession: isActive,
              isKnownSession: isKnown,
            });
          }
        } else {
          const stats = getDirectoryStats(topPath);
          workspaces.push({
            id: top.name,
            path: topPath,
            folderName: top.name,
            fileCount: stats.fileCount,
            sizeBytes: stats.sizeBytes,
            mtime: stats.latestMtime || statSync(topPath).mtimeMs,
            isActiveSession: false,
            isKnownSession: false,
          });
        }
      }
    } catch (err) {
      this.log.error({ error: err }, "Error reading workspaces directory");
    }

    workspaces.sort((a, b) => b.mtime - a.mtime);
    return workspaces;
  }

  getWorkspaceFiles(workspacePath: string, subDir = ""): WorkspaceFileInfo[] {
    const workspacesRoot = resolve(join(this.dataDir, "workspaces"));
    const resolvedWs = resolve(workspacePath);
    if (!resolvedWs.startsWith(workspacesRoot + "/") && resolvedWs !== workspacesRoot) {
      throw new Error("Access denied: path is outside workspaces directory");
    }
    const targetDir = resolve(join(resolvedWs, subDir));
    if (!targetDir.startsWith(resolvedWs)) {
      throw new Error("Access denied: path traversal detected");
    }
    if (!existsSync(targetDir)) {
      return [];
    }
    const entries = readdirSync(targetDir, { withFileTypes: true });
    return entries
      .filter((e) => !e.name.startsWith("."))
      .map((e) => {
        const full = join(targetDir, e.name);
        const rel = relative(resolvedWs, full);
        let size = 0;
        let mtime = 0;
        try {
          const st = statSync(full);
          size = st.size;
          mtime = st.mtimeMs;
        } catch {}
        return {
          name: e.name,
          relPath: rel,
          isDir: e.isDirectory(),
          size,
          mtime,
        };
      })
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  readWorkspaceFile(workspacePath: string, filePath: string): { content: string; size: number; mtime: number } {
    const workspacesRoot = resolve(join(this.dataDir, "workspaces"));
    const resolvedWs = resolve(workspacePath);
    if (!resolvedWs.startsWith(workspacesRoot + "/")) {
      throw new Error("Access denied: path is outside workspaces directory");
    }
    const full = resolve(join(resolvedWs, filePath));
    if (!full.startsWith(resolvedWs + "/")) {
      throw new Error("Access denied: path traversal detected");
    }
    if (!existsSync(full) || !statSync(full).isFile()) {
      throw new Error("File not found");
    }
    const st = statSync(full);
    const MAX_READ = 512 * 1024;
    let content = "";
    if (st.size > MAX_READ) {
      const buf = Buffer.alloc(MAX_READ);
      const fd = openSync(full, "r");
      readSync(fd, buf, 0, MAX_READ, 0);
      closeSync(fd);
      content = buf.toString("utf-8") + `\n\n--- [File truncated: showing 512KB of ${Math.round(st.size / 1024)}KB] ---`;
    } else {
      content = readFileSync(full, "utf-8");
    }
    return { content, size: st.size, mtime: st.mtimeMs };
  }

  deleteWorkspace(workspacePath: string): boolean {
    const workspacesRoot = resolve(join(this.dataDir, "workspaces"));
    const resolvedWs = resolve(workspacePath);
    if (!resolvedWs.startsWith(workspacesRoot + "/")) {
      throw new Error("Access denied: cannot delete outside workspaces directory");
    }
    if (resolvedWs === workspacesRoot) {
      throw new Error("Access denied: cannot delete root workspaces directory");
    }
    if (!existsSync(resolvedWs)) {
      return false;
    }
    rmSync(resolvedWs, { recursive: true, force: true });
    return true;
  }

  private toCronJobView(job: CronJob) {
    const tz = scheduleTimezone(job.schedule, this.scheduler.timezone());
    const next = job.enabled ? job.state.nextRunAt : undefined;
    return {
      ...job,
      running: this.scheduler.isRunning(job.id),
      next_run: next ? `${formatTime(next, tz)} ${tz}` : null,
    };
  }

  /**
   * Requests to the cron API made while a chat turn is running come from the CLI acting for that turn's
   * sender, so attribute them to that sender and enforce who may manage tasks in the chat.
   */
  private resolveCronCaller(botId: string, chatId: string, isGroup: boolean): { createdBy?: CronCreator; error?: string } {
    const bot = this.bots.get(botId);
    const sender = bot?.getTurnSender(chatId);
    if (!bot || !sender) return { createdBy: { via: "api" } };
    if (!bot.canManageCron(sender.senderId, chatId, isGroup)) {
      return { error: `${sender.senderName} is not allowed to manage scheduled tasks in this chat` };
    }
    return { createdBy: { senderId: sender.senderId, senderName: sender.senderName, via: "agent" } };
  }

  private withCronJob(id: string, action: (job: CronJob) => CronApiResult): CronApiResult {
    const job = id ? this.scheduler.get(id) : undefined;
    if (!job) return { ok: false, error: "Task not found", status: 404 };
    const caller = this.resolveCronCaller(job.botId, job.chatId, job.isGroup);
    if (caller.error) return { ok: false, error: caller.error, status: 403 };
    return action(job);
  }

  private createCronJob(body: Record<string, unknown>): CronApiResult {
    const botId = optionalString(body.bot_id);
    const chatId = optionalString(body.chat_id);
    if (!botId || !chatId) return { ok: false, error: "Missing bot_id or chat_id" };
    const bot = this.bots.get(botId);
    if (!bot) return { ok: false, error: `Unknown bot_id: ${botId}`, status: 404 };
    const chat = bot.getChatInfo(chatId);
    if (!chat) return { ok: false, error: `Bot "${bot.name}" has no conversation with chat_id ${chatId}`, status: 404 };

    const caller = this.resolveCronCaller(botId, chatId, chat.isGroup);
    if (caller.error) return { ok: false, error: caller.error, status: 403 };

    const parsed = parseScheduleInput({ cron: body.cron, tz: body.tz, at: body.at }, this.scheduler.timezone());
    if (!parsed.schedule) return { ok: false, error: parsed.error };

    const res = this.scheduler.create({
      botId,
      chatId,
      channelType: chat.channelType,
      isGroup: chat.isGroup,
      name: optionalString(body.name),
      prompt: optionalString(body.prompt) ?? "",
      schedule: parsed.schedule,
      engine: optionalString(body.engine) as CronJob["engine"],
      model: optionalString(body.model),
      effort: optionalString(body.effort),
      timeoutMs: minutesToMs(body.timeout_minutes),
      createdBy: caller.createdBy!,
    });
    return res.job ? { ok: true, job: this.toCronJobView(res.job) } : { ok: false, error: res.error };
  }

  private updateCronJob(body: Record<string, unknown>): CronApiResult {
    return this.withCronJob(optionalString(body.id) ?? "", (job) => {
      const patch: CronJobPatch = {};
      if (typeof body.name === "string") patch.name = body.name;
      if (typeof body.prompt === "string") patch.prompt = body.prompt;
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      // An empty engine or timeout resets it to the default
      if (body.engine !== undefined) patch.engine = (optionalString(body.engine) as CronJob["engine"]) ?? undefined;
      if (typeof body.model === "string") patch.model = body.model;
      if (typeof body.effort === "string") patch.effort = body.effort;
      if (body.timeout_minutes !== undefined) patch.timeoutMs = minutesToMs(body.timeout_minutes);

      if (body.cron !== undefined || body.at !== undefined || body.tz !== undefined) {
        // Changing only `tz` keeps the current cron expression
        const cron = body.cron ?? (body.at === undefined && job.schedule.kind === "cron" ? job.schedule.expr : undefined);
        const tz = body.tz ?? (job.schedule.kind === "cron" ? job.schedule.tz : undefined);
        const parsed = parseScheduleInput({ cron, tz, at: body.at }, this.scheduler.timezone());
        if (!parsed.schedule) return { ok: false, error: parsed.error };
        patch.schedule = parsed.schedule as CronSchedule;
      }

      const res = this.scheduler.update(job.id, patch);
      return res.job ? { ok: true, job: this.toCronJobView(res.job) } : { ok: false, error: res.error };
    });
  }

  private toJobView(job: BackgroundJob) {
    const duration = jobDuration(job);
    return {
      ...job,
      number: job.seq,
      bot_name: this.bots.get(job.botId)?.name,
      elapsed_seconds: duration !== undefined ? Math.round(duration / 1000) : undefined,
      last_line: job.status === "running" ? this.jobManager.lastLine(job.id) : undefined,
      log_path: this.jobManager.logPath(job.id),
    };
  }

  /**
   * Jobs are started by the CLI while it handles a chat message, so a job belongs to that message's sender,
   * and its result is sent back to that message's session. Scheduled runs and side questions are recognized
   * by their session header and refused: their sessions are gone by the time a job finishes.
   */
  private createJob(body: Record<string, unknown>, callerSessionId?: string): JobApiResult {
    if (callerSessionId && isEphemeralSessionId(callerSessionId)) {
      return { ok: false, status: 409, error: "Scheduled runs and side questions cannot start background jobs; run the command directly" };
    }
    const botId = optionalString(body.bot_id);
    const chatId = optionalString(body.chat_id);
    if (!botId || !chatId) return { ok: false, error: "Missing bot_id or chat_id" };
    const bot = this.bots.get(botId);
    if (!bot) return { ok: false, error: `Unknown bot_id: ${botId}`, status: 404 };
    const chat = bot.getChatInfo(chatId);
    if (!chat) return { ok: false, error: `Bot "${bot.name}" has no conversation with chat_id ${chatId}`, status: 404 };
    const turn = bot.getTurnSender(chatId);
    if (!turn) {
      return { ok: false, status: 409, error: "Background jobs can only be started while handling a chat message" };
    }
    const settings = this.jobManager.settings();
    if (turn.jobsStarted >= settings.maxPerTurn) {
      return {
        ok: false,
        status: 429,
        error: `At most ${settings.maxPerTurn} background jobs per message. Run shorter commands directly instead.`,
      };
    }

    const res = this.jobManager.create({
      botId,
      chatId,
      channelType: chat.channelType,
      isGroup: chat.isGroup,
      title: optionalString(body.title) ?? "",
      command: typeof body.command === "string" ? body.command : "",
      cwd: optionalString(body.cwd) ?? bot.getSessionWorkspace(turn.sessionId) ?? "",
      then: optionalString(body.then),
      requester: { senderId: turn.senderId || undefined, senderName: turn.senderName || undefined },
      originMessageId: turn.messageId || undefined,
      sessionId: turn.sessionId,
      timeoutMs: minutesToMs(body.timeout_minutes),
    });
    if (!res.job) return { ok: false, error: res.error };
    turn.jobsStarted += 1;
    return { ok: true, job: this.toJobView(res.job) };
  }

  /** CLIs (which send the session header) may stop their requester's jobs; the local dashboard may stop any. */
  private cancelJob(id: string, callerSessionId?: string): JobApiResult {
    if (callerSessionId && isEphemeralSessionId(callerSessionId)) {
      return { ok: false, status: 403, error: "Scheduled runs and side questions cannot stop background jobs" };
    }
    const job = id ? this.jobManager.get(id) : undefined;
    if (!job) return { ok: false, error: "Job not found", status: 404 };
    if (!isJobActive(job)) return { ok: false, error: `Job #${job.seq} already finished (${job.status})` };

    let by = "dashboard";
    if (callerSessionId) {
      const bot = this.bots.get(job.botId);
      const turn = bot?.getTurnSender(job.chatId);
      if (bot && turn && turn.senderId !== job.requester.senderId && !bot.canManageCron(turn.senderId, job.chatId, job.isGroup)) {
        return { ok: false, error: `${turn.senderName} is not allowed to stop job #${job.seq}`, status: 403 };
      }
      by = turn?.senderName || "agent";
    }
    const res = this.jobManager.cancel(job.id, by);
    return res.ok ? { ok: true, job: this.toJobView(job) } : { ok: false, error: res.error };
  }

  private startConfigWatcher(): void {
    if (!existsSync(this.configPath)) return;
    try {
      this.configWatcher = watch(this.configPath, async (event) => {
        if (event === "change") {
          if (Date.now() - this.lastReloadTime < 500) return;
          this.log.info("Detected config file change, hot-reloading...");
          await this.reloadConfig();
        }
      });
    } catch (err) {
      this.log.warn({ error: err }, "Could not watch config file");
    }
  }

  async stop(): Promise<void> {
    this.log.info("Stopping PocketAgent Gateway...");
    this.scheduler.stop();
    // Running jobs keep going and are picked up again on the next start
    this.jobManager.stop();
    if (this.configWatcher) {
      this.configWatcher.close();
    }
    for (const bot of this.bots.values()) {
      await bot.stop();
    }
    if (this.apiServer) {
      await this.apiServer.stop();
    }
    await this.engineManager.shutdown();
    this.log.info("PocketAgent Gateway stopped cleanly");
  }
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function minutesToMs(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const minutes = Number(value);
  return Number.isFinite(minutes) ? Math.round(minutes * 60_000) : NaN;
}
