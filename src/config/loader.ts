import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { configSchema } from "./schema.js";
import type { GatewayConfig, ResolvedBotConfig, BotConfig } from "./types.js";

const DEFAULT_CONFIG = `# PocketAgent Configuration
# Bridges Telegram & Discord to Claude Code, Codex, and Antigravity (agy)

gateway:
  port: 18790
  dataDir: "~/.pocketagent"
  logLevel: "info"
  logFormat: "pretty"

engines:
  default: "claude" # claude | codex | agy
  maxProcesses: 10
  idleTimeoutMs: 600000

  claude:
    binary: "claude"
    model: "sonnet"
    extraArgs: []

  codex:
    binary: "codex"
    sandbox: "danger-full-access"
    approvalPolicy: "never"
    extraArgs: []

  agy:
    binary: "agy"
    model: "gemini-3.8-flash-high"
    extraArgs: []

auth:
  defaultPolicy: "pairing"

bots:
  - name: "my-pocket-bot"
    token: "\${TELEGRAM_BOT_TOKEN}"   # Telegram Bot Token from @BotFather
    # discordToken: "\${DISCORD_BOT_TOKEN}" # Optional Discord Bot Token
    engine: "claude"                  # Default engine: claude | codex | agy
`;

export function expandEnvVars(input: string): string {
  return input.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? "");
}

export function parseConfig(yamlStr: string): GatewayConfig {
  const expanded = expandEnvVars(yamlStr);
  const raw = parseYaml(expanded);
  return configSchema.parse(raw) as GatewayConfig;
}

export function loadConfig(configPath?: string): GatewayConfig {
  const resolvedPath = configPath
    ?? resolve(process.env.HOME ?? "~", ".pocketagent", "config.yaml");

  if (!existsSync(resolvedPath)) {
    mkdirSync(dirname(resolvedPath), { recursive: true });
    writeFileSync(resolvedPath, DEFAULT_CONFIG);
    console.log(`Created default config at ${resolvedPath}`);
    console.log(`Edit it to add your bot token under bots[], then run: pocketagent start`);
  }

  const content = readFileSync(resolvedPath, "utf-8");
  return parseConfig(content);
}

export function resolveDataDir(config: GatewayConfig): string {
  const dir = config.gateway.dataDir.replace(/^~/, process.env.HOME ?? "");
  return resolve(dir);
}

export function resolveBots(config: GatewayConfig): ResolvedBotConfig[] {
  const defaultPolicy = config.auth.defaultPolicy;
  const defaultEngine = config.engines.default;
  const defaultExtraArgs = config.engines[defaultEngine]?.extraArgs ?? [];

  let bots: BotConfig[];

  if (config.bots && config.bots.length > 0) {
    bots = config.bots;
  } else if (config.channels?.telegram) {
    const tg = config.channels.telegram;
    bots = [
      {
        name: "telegram",
        token: tg.botToken,
        auth: {
          dmPolicy: tg.dmPolicy,
          groupPolicy: tg.groupPolicy,
          allowFrom: tg.allowFrom,
          groups: tg.groups,
        },
      },
    ];
  } else {
    return [];
  }

  const seenTokens = new Set<string>();
  for (const bot of bots) {
    const token = bot.token ?? bot.discordToken;
    if (token) {
      if (seenTokens.has(token)) {
        throw new Error(`Duplicate bot token found for bot "${bot.name}"`);
      }
      seenTokens.add(token);
    }
  }

  return bots.map((bot) => {
    const engine = bot.engine ?? defaultEngine;
    const botId = bot.token ? bot.token.split(":")[0] : (bot.discordToken ? bot.discordToken.slice(0, 10) : bot.name);

    const dmPolicy = (bot.auth?.dmPolicy ?? defaultPolicy) as "open" | "pairing" | "allowlist" | "disabled";
    const groupPolicy = (bot.auth?.groupPolicy ?? defaultPolicy) as "open" | "pairing" | "allowlist" | "disabled";
    const guildPolicy = (bot.auth?.guildPolicy ?? defaultPolicy) as "open" | "pairing" | "allowlist" | "disabled";

    const defaultModel = config.engines[engine]?.model;
    const defaultEffort = config.engines[engine]?.effort;

    return {
      name: bot.name,
      token: bot.token,
      discordToken: bot.discordToken,
      botId,
      engine,
      model: bot.model ?? defaultModel,
      effort: bot.effort ?? defaultEffort,
      extraArgs: bot.extraArgs ?? defaultExtraArgs,
      dmPolicy,
      groupPolicy,
      guildPolicy,
      allowFrom: bot.auth?.allowFrom ?? [],
      groups: bot.auth?.groups ?? {},
      guilds: bot.auth?.guilds ?? {},
      soul: bot.soul,
      skills: bot.skills,
    };
  });
}
