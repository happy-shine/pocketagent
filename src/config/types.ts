import type { AppConfig, BotConfig, EngineType } from "./schema.js";

export type GatewayConfig = AppConfig;
export type { BotConfig, EngineType };

export interface ResolvedBotConfig {
  name: string;
  channel: "telegram" | "discord";
  token?: string; // Telegram bot token
  discordToken?: string; // Discord bot token
  botId: string;
  engine: EngineType;
  model?: string;
  effort?: string;
  extraArgs: string[];
  dmPolicy: "open" | "pairing" | "allowlist" | "disabled";
  groupPolicy: "open" | "pairing" | "allowlist" | "disabled";
  guildPolicy: "open" | "pairing" | "allowlist" | "disabled";
  allowFrom: string[];
  triggerWords?: string[];
  groups: Record<string, { enabled: boolean; allowFrom?: string[]; triggerWords?: string[] }>;
  guilds: Record<string, { enabled: boolean; allowedChannels?: string[]; allowFrom?: string[]; triggerWords?: string[] }>;
  soul?: string;
  skills?: boolean | string[];
  followUp: "steer" | "queue";
  interimText: "message" | "final";
  contextFooter: boolean;
}
