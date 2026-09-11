import { z } from "zod";

export const EngineTypeSchema = z.enum(["claude", "codex", "agy"]);
export type EngineType = z.infer<typeof EngineTypeSchema>;

const customModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

const telegramGroupSchema = z.object({
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).optional(),
});

const telegramChannelSchema = z.object({
  botToken: z.string().min(1, "botToken is required"),
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("pairing"),
  groupPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("disabled"),
  allowFrom: z.array(z.string()).default([]),
  groups: z.record(z.string(), telegramGroupSchema).default({}),
});

const discordGuildSchema = z.object({
  enabled: z.boolean().default(true),
  allowedChannels: z.array(z.string()).optional(),
  allowFrom: z.array(z.string()).optional(),
});

const discordChannelSchema = z.object({
  botToken: z.string().min(1, "botToken is required"),
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("pairing"),
  guildPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("disabled"),
  allowFrom: z.array(z.string()).default([]),
  guilds: z.record(z.string(), discordGuildSchema).default({}),
});

const gatewaySchema = z.object({
  port: z.number().int().positive().default(18790),
  dataDir: z.string().default("~/.pocketagent"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  logFormat: z.enum(["pretty", "json"]).default("pretty"),
});

const claudeEngineSchema = z.object({
  binary: z.string().default("claude"),
  model: z.string().optional(),
  effort: z.string().optional(),
  extraArgs: z.array(z.string()).default([]),
  customModels: z.array(customModelSchema).default([]),
});

const codexEngineSchema = z.object({
  binary: z.string().default("codex"),
  model: z.string().optional(),
  effort: z.string().optional(),
  sandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).default("danger-full-access"),
  approvalPolicy: z.enum(["untrusted", "on-request", "never"]).default("never"),
  extraArgs: z.array(z.string()).default([]),
  customModels: z.array(customModelSchema).default([]),
});

const agyEngineSchema = z.object({
  binary: z.string().default("agy"),
  model: z.string().optional(),
  effort: z.string().optional(),
  extraArgs: z.array(z.string()).default([]),
  customModels: z.array(customModelSchema).default([]),
});

const enginesSchema = z.object({
  default: EngineTypeSchema.default("claude"),
  maxProcesses: z.number().int().positive().default(10),
  idleTimeoutMs: z.number().int().positive().default(600000),
  claude: claudeEngineSchema.default(claudeEngineSchema.parse({})),
  codex: codexEngineSchema.default(codexEngineSchema.parse({})),
  agy: agyEngineSchema.default(agyEngineSchema.parse({})),
});

const authSchema = z.object({
  defaultPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("pairing"),
});

const channelsSchema = z.object({
  telegram: telegramChannelSchema.optional(),
  discord: discordChannelSchema.optional(),
});

const botAuthSchema = z.object({
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  groupPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  guildPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  allowFrom: z.array(z.string()).optional(),
  groups: z.record(z.string(), telegramGroupSchema).optional(),
  guilds: z.record(z.string(), discordGuildSchema).optional(),
});

const botSchema = z.object({
  name: z.string().min(1, "bot name is required"),
  channel: z.enum(["telegram", "discord"]).optional(),
  token: z.string().optional(), // Telegram or Discord Bot Token
  discordToken: z.string().optional(), // For backward compatibility
  engine: EngineTypeSchema.optional(), // Default engine for this bot
  model: z.string().optional(),
  effort: z.string().optional(),
  extraArgs: z.array(z.string()).optional(),
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  groupPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  guildPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  allowFrom: z.array(z.string()).optional(),
  groups: z.record(z.string(), z.union([z.boolean(), telegramGroupSchema])).optional(),
  guilds: z.record(z.string(), z.union([z.boolean(), discordGuildSchema])).optional(),
  auth: botAuthSchema.optional(),
  soul: z.string().optional(),
  skills: z.union([z.boolean(), z.array(z.string())]).optional(),
});

export const configSchema = z.preprocess((input) => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const engines = { ...((raw.engines as Record<string, unknown> | undefined) ?? {}) };

  // Support top-level `defaultEngine` or `engine`
  const topEngine = (raw.defaultEngine ?? raw.engine) as string | undefined;
  if (topEngine && ["claude", "codex", "agy"].includes(topEngine)) {
    engines.default ??= topEngine;
  }

  // Compatibility with single `engine` or `claude` block
  const oldEngine = typeof raw.engine === "object" ? (raw.engine as Record<string, unknown>) : undefined;
  const oldClaude = raw.claude as Record<string, unknown> | undefined;

  if (oldEngine?.type && typeof oldEngine.type === "string") {
    engines.default ??= oldEngine.type;
  }
  if (oldEngine?.maxProcesses) engines.maxProcesses ??= oldEngine.maxProcesses;
  if (oldEngine?.idleTimeoutMs) engines.idleTimeoutMs ??= oldEngine.idleTimeoutMs;
  if (oldEngine?.codex) engines.codex ??= oldEngine.codex;
  if (oldEngine?.claude) engines.claude ??= oldEngine.claude;
  if (oldEngine?.agy) engines.agy ??= oldEngine.agy;

  if (oldClaude) {
    engines.maxProcesses ??= oldClaude.maxProcesses;
    engines.idleTimeoutMs ??= oldClaude.idleTimeoutMs;
    const claudeObj = { ...((engines.claude as Record<string, unknown> | undefined) ?? {}) };
    if (oldClaude.binary !== undefined) claudeObj.binary ??= oldClaude.binary;
    if (oldClaude.model !== undefined) claudeObj.model ??= oldClaude.model;
    if (oldClaude.extraArgs !== undefined) claudeObj.extraArgs ??= oldClaude.extraArgs;
    engines.claude = claudeObj;
  }

  return { ...raw, engines };
}, z.object({
  defaultEngine: EngineTypeSchema.optional(),
  engine: EngineTypeSchema.optional(),
  gateway: gatewaySchema.default(gatewaySchema.parse({})),
  engines: enginesSchema.default(enginesSchema.parse({})),
  auth: authSchema.default(authSchema.parse({})),
  channels: channelsSchema.optional(),
  bots: z.array(botSchema).optional(),
}));

export type AppConfig = z.infer<typeof configSchema>;
export type BotConfig = z.infer<typeof botSchema>;
export type TelegramChannelConfig = z.infer<typeof telegramChannelSchema>;
export type DiscordChannelConfig = z.infer<typeof discordChannelSchema>;
export type EnginesConfig = z.infer<typeof enginesSchema>;
export type CustomModel = z.infer<typeof customModelSchema>;
