import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { configSchema } from "./schema.js";
import type { GatewayConfig, ResolvedBotConfig, BotConfig } from "./types.js";

const DEFAULT_CONFIG = `# PocketAgent Configuration
# Bridges Telegram & Discord to Claude Code, Codex, and Antigravity (agy)

defaultEngine: "claude" # claude | codex | agy (switchable dynamically via /engine)

bots:
  - name: "my-pocket-bot"
    channel: telegram # telegram | discord
    token: "\${TELEGRAM_BOT_TOKEN}" # From @BotFather
    # allowFrom:
    #   - "1465542100"
    # groups:
    #   "-1003981923249": true
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
  const defaultEngine = config.defaultEngine ?? config.engine ?? config.engines.default ?? "claude";
  const defaultExtraArgs = config.engines[defaultEngine]?.extraArgs ?? [];

  let rawBots: BotConfig[];

  if (config.bots && config.bots.length > 0) {
    rawBots = config.bots;
  } else if (config.channels?.telegram) {
    const tg = config.channels.telegram;
    rawBots = [
      {
        name: "telegram",
        channel: "telegram",
        token: tg.botToken,
        dmPolicy: tg.dmPolicy,
        groupPolicy: tg.groupPolicy,
        allowFrom: tg.allowFrom,
        groups: tg.groups,
      },
    ];
  } else {
    return [];
  }

  const seenTokens = new Set<string>();
  for (const bot of rawBots) {
    const token = bot.token ?? bot.discordToken;
    if (token) {
      if (seenTokens.has(token)) {
        throw new Error(`Duplicate bot token found for bot "${bot.name}"`);
      }
      seenTokens.add(token);
    }
  }

  return rawBots.map((bot) => {
    const channel: "telegram" | "discord" =
      bot.channel ?? (bot.discordToken && !bot.token ? "discord" : "telegram");

    let tgToken: string | undefined = undefined;
    let dcToken: string | undefined = undefined;

    if (channel === "discord") {
      dcToken = bot.token ?? bot.discordToken;
    } else {
      tgToken = bot.token;
      dcToken = bot.discordToken;
    }

    const engine = bot.engine ?? defaultEngine;
    let botId = bot.name;
    if (tgToken) {
      botId = tgToken.split(":")[0];
    } else if (dcToken) {
      try {
        const decoded = Buffer.from(dcToken.split(".")[0], "base64").toString("utf-8");
        if (/^\d+$/.test(decoded)) {
          botId = decoded;
        }
      } catch {}
    }

    const dmPolicy = (bot.dmPolicy ?? bot.auth?.dmPolicy ?? defaultPolicy) as "open" | "pairing" | "allowlist" | "disabled";
    const groupPolicy = (bot.groupPolicy ?? bot.auth?.groupPolicy ?? defaultPolicy) as "open" | "pairing" | "allowlist" | "disabled";
    const guildPolicy = (bot.guildPolicy ?? bot.auth?.guildPolicy ?? defaultPolicy) as "open" | "pairing" | "allowlist" | "disabled";

    const allowFrom = bot.allowFrom ?? bot.auth?.allowFrom ?? [];

    const rawGroups = (bot.groups ?? bot.auth?.groups ?? {}) as Record<
      string,
      boolean | { enabled?: boolean; allowFrom?: string[] } | undefined
    >;
    const groups: Record<string, { enabled: boolean; allowFrom?: string[] }> = {};
    for (const [gid, gval] of Object.entries(rawGroups)) {
      if (typeof gval === "boolean") {
        groups[gid] = { enabled: gval };
      } else if (gval && typeof gval === "object") {
        groups[gid] = {
          enabled: gval.enabled ?? true,
          allowFrom: gval.allowFrom,
        };
      }
    }

    const rawGuilds = (bot.guilds ?? bot.auth?.guilds ?? {}) as Record<
      string,
      boolean | { enabled?: boolean; allowedChannels?: string[]; allowFrom?: string[] } | undefined
    >;
    const guilds: Record<
      string,
      { enabled: boolean; allowedChannels?: string[]; allowFrom?: string[] }
    > = {};
    for (const [gid, gval] of Object.entries(rawGuilds)) {
      if (typeof gval === "boolean") {
        guilds[gid] = { enabled: gval };
      } else if (gval && typeof gval === "object") {
        guilds[gid] = {
          enabled: gval.enabled ?? true,
          allowedChannels: gval.allowedChannels,
          allowFrom: gval.allowFrom,
        };
      }
    }

    const defaultModel = config.engines[engine]?.model;
    const defaultEffort = config.engines[engine]?.effort;

    return {
      name: bot.name,
      channel,
      token: tgToken,
      discordToken: dcToken,
      botId,
      engine,
      model: bot.model ?? defaultModel,
      effort: bot.effort ?? defaultEffort,
      extraArgs: bot.extraArgs ?? defaultExtraArgs,
      dmPolicy,
      groupPolicy,
      guildPolicy,
      allowFrom,
      groups,
      guilds,
      soul: bot.soul,
      skills: bot.skills,
    };
  });
}
