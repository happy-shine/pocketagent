import { existsSync, mkdirSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import type { Logger } from "pino";
import { ApiServer } from "../api/server.js";
import { BotInstance } from "../bot/bot-instance.js";
import { setMessageStore } from "../channels/telegram/handlers.js";
import { loadConfig, resolveBots, resolveDataDir, saveConfig, syncPairingToConfig } from "../config/loader.js";
import type { GatewayConfig, ResolvedBotConfig } from "../config/types.js";
import { EngineManager } from "../engines/manager.js";
import { MessageStore } from "../sessions/message-store.js";
import { SkillRegistry } from "../skills/index.js";

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
