import { existsSync, mkdirSync, watch, type FSWatcher, readdirSync, statSync, readFileSync, rmSync, openSync, readSync, closeSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import type { Logger } from "pino";
import { ApiServer } from "../api/server.js";
import { BotInstance } from "../bot/bot-instance.js";
import { setMessageStore } from "../channels/telegram/handlers.js";
import { loadConfig, resolveBots, resolveDataDir, saveConfig, syncPairingToConfig } from "../config/loader.js";
import type { GatewayConfig, ResolvedBotConfig } from "../config/types.js";
import type { EngineType } from "../config/schema.js";
import { EngineManager } from "../engines/manager.js";
import { MessageStore } from "../sessions/message-store.js";
import { SkillRegistry } from "../skills/index.js";

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

    const botConfigs = resolveBots(config);
    for (const botConfig of botConfigs) {
      const bot = new BotInstance({
        botConfig,
        gatewayConfig: config,
        engineManager: this.engineManager,
        messageStore: this.messageStore,
        dataDir: this.dataDir,
        log,
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
      getBotTelegram: (botId) => this.bots.get(botId)?.telegram,
      getBotChannel: (botId) => this.bots.get(botId)?.telegram ?? this.bots.get(botId)?.discord,
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
    });
    await this.apiServer.start();

    // Notify bots of peers
    this.syncPeerBots();

    for (const bot of this.bots.values()) {
      await bot.start();
    }
    this.syncPeerBots();

    this.startConfigWatcher();
    this.log.info("PocketAgent Gateway running successfully");
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
            workspaceExists: existsSync(wsPath),
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
