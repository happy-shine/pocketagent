import { existsSync, mkdirSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import type { Logger } from "pino";
import { ApiServer } from "../api/server.js";
import { BotInstance } from "../bot/bot-instance.js";
import { setMessageStore } from "../channels/telegram/handlers.js";
import { loadConfig, resolveBots, resolveDataDir } from "../config/loader.js";
import type { GatewayConfig } from "../config/types.js";
import { EngineManager } from "../engines/manager.js";
import { MessageStore } from "../sessions/message-store.js";

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
      onReloadConfig: () => this.reloadConfig(),
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

  async reloadConfig(): Promise<{ ok: boolean; changes: string[] }> {
    try {
      const newConfig = loadConfig(this.configPath);
      const changes: string[] = [];

      this.config = newConfig;
      this.log.info({ changes }, "Config hot-reloaded successfully");
      return { ok: true, changes };
    } catch (err) {
      this.log.error({ error: err }, "Failed to reload config");
      return { ok: false, changes: [String(err)] };
    }
  }

  private startConfigWatcher(): void {
    if (!existsSync(this.configPath)) return;
    try {
      this.configWatcher = watch(this.configPath, async (event) => {
        if (event === "change") {
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
