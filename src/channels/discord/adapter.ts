import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  type Message,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Logger } from "pino";
import type {
  ChannelAdapter,
  OutboundMessage,
  MessageHandler,
  CommandHandler,
  InlineButton,
  InboundMessage,
  Attachment,
} from "../types.js";

function splitDiscordText(text: string, limit = 1900): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n", limit);
    if (splitIdx === -1 || splitIdx < limit / 2) {
      splitIdx = remaining.lastIndexOf(" ", limit);
    }
    if (splitIdx === -1 || splitIdx < limit / 2) {
      splitIdx = limit;
    }
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}

export class DiscordAdapter implements ChannelAdapter {
  readonly type = "discord";
  private token: string;
  private log: Logger;
  private client?: Client;
  private messageHandler?: MessageHandler;
  private commandHandlers = new Map<string, CommandHandler>();
  private callbackHandlers = new Map<string, (ctx: any) => Promise<void>>();
  private activeSlashInteractions = new Map<string, ChatInputCommandInteraction>();
  private stopped = false;
  username?: string;

  constructor(token: string, log: Logger) {
    this.token = token;
    this.log = log.child({ module: "discord" });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onCommand(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command, handler);
  }

  onCallback(prefix: string, handler: (ctx: any) => Promise<void>): void {
    this.callbackHandlers.set(prefix, handler);
  }

  async start(): Promise<void> {
    const baseIntents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
    ];
    const fullIntents = [
      ...baseIntents,
      GatewayIntentBits.MessageContent,
    ];

    const createClient = (intents: GatewayIntentBits[]) => {
      return new Client({
        intents,
        partials: [Partials.Channel, Partials.Message],
      });
    };

    let client = createClient(fullIntents);

    try {
      await client.login(this.token);
    } catch (err: any) {
      if (err?.message?.includes("disallowed intents") || err?.code === "DisallowedIntents") {
        this.log.warn(
          "Discord login failed with MessageContent intent. Falling back to basic intents. (Note: Enable 'MESSAGE CONTENT INTENT' in Discord Developer Portal -> Bot -> Privileged Gateway Intents so bot can read channel messages)"
        );
        client.destroy();
        client = createClient(baseIntents);
        await client.login(this.token);
      } else {
        throw err;
      }
    }

    this.client = client;
    this.username = client.user?.tag || client.user?.username;
    this.log.info({ username: this.username }, "Discord bot connected successfully");

    this.registerSlashCommands().catch((err) => {
      this.log.warn({ error: err }, "Failed to register Discord slash commands");
    });

    client.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return;

      let text = message.content.trim();
      const isMentioned = client.user && (message.mentions.has(client.user) || text.includes(client.user.id));
      if (client.user && isMentioned) {
        text = text.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
      }

      // In guild channels, respond if:
      // 1) In Direct Message (DM), OR
      // 2) Bot is mentioned in a guild, OR
      // 3) Message is a reply to one of bot's own messages, OR
      // 4) Message starts with command slash '/'
      const isDM = !message.guildId;
      const isReply = message.reference?.messageId ? true : false;

      if (!isDM && !isMentioned && !isReply && !text.startsWith("/")) {
        return;
      }

      const inboundAttachments: Attachment[] = [];
      if (message.attachments.size > 0) {
        for (const [, att] of message.attachments) {
          const isPhoto = att.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(att.name);
          inboundAttachments.push({
            type: isPhoto ? "photo" : "document",
            fileId: att.url,
            fileName: att.name,
            mimeType: att.contentType ?? undefined,
          });
        }
      }

      let replyText: string | undefined;
      let replySenderName: string | undefined;
      const replyAttachments: Attachment[] = [];

      if (message.reference?.messageId) {
        try {
          const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
          if (refMsg) {
            replySenderName = refMsg.author?.displayName || refMsg.author?.username || undefined;
            replyText = refMsg.content || undefined;

            if (refMsg.attachments && refMsg.attachments.size > 0) {
              for (const [, att] of refMsg.attachments) {
                const isPhoto = att.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(att.name);
                replyAttachments.push({
                  type: isPhoto ? "photo" : "document",
                  fileId: att.url,
                  fileName: att.name,
                  mimeType: att.contentType ?? undefined,
                });
              }
              if (!replyText) {
                replyText = replyAttachments[0]?.type === "photo" ? "[Photo]" : `[File: ${replyAttachments[0]?.fileName || "Document"}]`;
              }
            }
          }
        } catch {
          // Ignore reference fetch errors
        }
      }

      const inbound: InboundMessage = {
        channelType: "discord",
        chatId: message.channelId,
        senderId: message.author.id,
        senderName: message.author.displayName || message.author.username,
        messageId: message.id,
        text,
        isGroup: message.guildId !== null,
        timestamp: Math.floor(message.createdTimestamp / 1000),
        replyToMessageId: message.reference?.messageId,
        replyText,
        replySenderName,
        replyAttachments: replyAttachments.length > 0 ? replyAttachments : undefined,
        attachments: inboundAttachments.length > 0 ? inboundAttachments : undefined,
        raw: message,
      };

      if (text.startsWith("/")) {
        const parts = text.slice(1).trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const args = text.slice(1).trim().slice(cmd.length).trim();
        const handler = this.commandHandlers.get(cmd);
        if (handler) {
          inbound.text = args;
          try {
            await handler(inbound);
          } catch (err) {
            this.log.error({ error: err instanceof Error ? err.message : String(err), cmd }, "Discord command handler failed");
          }
          return;
        }
      }

      if (this.messageHandler) {
        try {
          await this.messageHandler(inbound);
        } catch (err) {
          this.log.error({ error: err instanceof Error ? err.message : String(err) }, "Discord message handler failed");
        }
      }
    });

    client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName.toLowerCase();
        const handler = this.commandHandlers.get(cmd);
        if (!handler) {
          await interaction.reply({ content: `Unknown command: /${cmd}`, ephemeral: true }).catch(() => {});
          return;
        }

        let textArg = "";
        const sub = interaction.options.getSubcommand(false);
        if (sub) textArg += sub + " ";
        const options = interaction.options.data;
        if (options && options.length > 0) {
          textArg += options.map((o) => String(o.value ?? "")).filter(Boolean).join(" ");
        }
        textArg = textArg.trim();

        await interaction.deferReply().catch(() => {});

        const inbound: InboundMessage = {
          channelType: "discord",
          chatId: interaction.channelId,
          senderId: interaction.user.id,
          senderName: interaction.user.displayName || interaction.user.username,
          messageId: interaction.id,
          text: textArg,
          isGroup: interaction.guildId !== null,
          timestamp: Math.floor(interaction.createdTimestamp / 1000),
          raw: interaction,
        };

        this.activeSlashInteractions.set(interaction.channelId, interaction);
        setTimeout(() => {
          if (this.activeSlashInteractions.get(interaction.channelId) === interaction) {
            this.activeSlashInteractions.delete(interaction.channelId);
          }
        }, 15000);

        try {
          await handler(inbound);
        } catch (err) {
          this.log.error({ error: err instanceof Error ? err.message : String(err), cmd }, "Discord slash command failed");
        }
        return;
      }

      if (!interaction.isButton()) return;
      const btnInteraction = interaction as ButtonInteraction;
      const customId = btnInteraction.customId;

      let matchedHandler: ((ctx: any) => Promise<void>) | undefined;
      for (const [prefix, handler] of this.callbackHandlers) {
        if (customId.startsWith(prefix)) {
          matchedHandler = handler;
          break;
        }
      }

      if (matchedHandler) {
        const ctx = {
          data: customId,
          chatId: btnInteraction.channelId,
          editMessageText: async (newText: string) => {
            await btnInteraction.update({
              content: newText,
              components: [],
            });
          },
        };

        try {
          await matchedHandler(ctx);
        } catch (err) {
          this.log.error({ error: err instanceof Error ? err.message : String(err), customId }, "Discord button interaction failed");
        }
      } else {
        // If no callback handler matched, it's an interactive user button (e.g. from an AI prompt)
        await btnInteraction.deferUpdate().catch(() => {});
        const inbound: InboundMessage = {
          channelType: "discord",
          chatId: btnInteraction.channelId,
          senderId: btnInteraction.user.id,
          senderName: btnInteraction.user.displayName || btnInteraction.user.username,
          messageId: btnInteraction.id,
          text: customId,
          isGroup: btnInteraction.guildId !== null,
          timestamp: Math.floor(btnInteraction.createdTimestamp / 1000),
          replyToMessageId: btnInteraction.message?.id,
          raw: btnInteraction,
        };
        if (this.messageHandler) {
          try {
            await this.messageHandler(inbound);
          } catch (err) {
            this.log.error({ error: err instanceof Error ? err.message : String(err), customId }, "Discord button message handler failed");
          }
        }
      }
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.client) {
      await this.client.destroy();
      this.client = undefined;
    }
    this.log.info("Discord adapter stopped");
  }

  async send(msg: OutboundMessage): Promise<string> {
    if (!this.client) return "";

    const slashInteraction = this.activeSlashInteractions.get(msg.chatId);
    if (slashInteraction) {
      this.activeSlashInteractions.delete(msg.chatId);
      const chunks = splitDiscordText(msg.text);
      const firstChunk = chunks[0] || msg.text;
      const files = msg.attachments?.map((a) => ({
        attachment: a.path,
        name: a.caption,
      })) ?? [];
      const payload: any = { content: firstChunk };
      if (files.length > 0) payload.files = files;
      const res = await slashInteraction.editReply(payload).catch(() => null);
      if (chunks.length > 1) {
        const channel = await this.client.channels.fetch(msg.chatId).catch(() => null);
        if (channel && channel.isTextBased()) {
          for (let i = 1; i < chunks.length; i++) {
            await (channel as any).send({ content: chunks[i] }).catch(() => {});
          }
        }
      }
      return (res as any)?.id ?? "";
    }

    const channel = await this.client.channels.fetch(msg.chatId).catch(() => null);
    if (!channel || !channel.isTextBased()) return "";

    const chunks = splitDiscordText(msg.text);
    const files = msg.attachments?.map((a) => ({
      attachment: a.path,
      name: a.caption,
    })) ?? [];

    let lastMsg: Message | undefined;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;
      const payload: any = { content: chunk };
      if (isFirst && msg.replyToMessageId) {
        payload.reply = { messageReference: msg.replyToMessageId, failIfNotExists: false };
      }
      if (isLast && files.length > 0) {
        payload.files = files;
      }
      lastMsg = await (channel as any).send(payload).catch((err: any) => {
        this.log.error({ error: err?.message, chatId: msg.chatId }, "Failed to send message to Discord channel");
        return undefined;
      });
    }
    return lastMsg?.id ?? "";
  }

  async sendWithButtons(chatId: string, text: string, buttons: InlineButton[][]): Promise<string> {
    if (!this.client) return "";

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (const buttonRow of buttons.slice(0, 5)) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const btn of buttonRow.slice(0, 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(btn.data)
            .setLabel(btn.text.slice(0, 80))
            .setStyle(ButtonStyle.Primary)
        );
      }
      if (row.components.length > 0) {
        rows.push(row);
      }
    }

    const chunks = splitDiscordText(text);
    const mainText = chunks[0] || text;

    const slashInteraction = this.activeSlashInteractions.get(chatId);
    if (slashInteraction) {
      this.activeSlashInteractions.delete(chatId);
      const res = await slashInteraction.editReply({
        content: mainText,
        components: rows,
      }).catch(() => null);
      if (chunks.length > 1) {
        const channel = await this.client.channels.fetch(chatId).catch(() => null);
        if (channel && channel.isTextBased()) {
          for (let i = 1; i < chunks.length; i++) {
            await (channel as any).send({ content: chunks[i] }).catch(() => {});
          }
        }
      }
      return (res as any)?.id ?? "";
    }

    const channel = await this.client.channels.fetch(chatId).catch(() => null);
    if (!channel || !channel.isTextBased()) return "";

    const sent = await (channel as any).send({
      content: mainText,
      components: rows,
    }).catch((err: any) => {
      this.log.error({ error: err?.message, chatId }, "Failed to send Discord message with buttons");
      return null;
    });

    if (chunks.length > 1) {
      for (let i = 1; i < chunks.length; i++) {
        await (channel as any).send({ content: chunks[i] }).catch(() => {});
      }
    }

    return sent?.id ?? "";
  }

  async editMessage(chatId: string, messageId: string, text: string, buttons?: string[]): Promise<void> {
    if (!this.client) return;
    const channel = await this.client.channels.fetch(chatId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (channel as any).messages.fetch(messageId).catch(() => null);
    if (msg) {
      const chunks = splitDiscordText(text);
      const firstChunk = chunks[0] || text;
      const payload: any = { content: firstChunk };
      if (buttons && buttons.length > 0) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (const btn of buttons.slice(0, 5)) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(btn)
              .setLabel(btn.slice(0, 80))
              .setStyle(ButtonStyle.Secondary)
          );
        }
        payload.components = [row];
      }
      await msg.edit(payload).catch((err: any) => {
        this.log.error({ error: err?.message, chatId, messageId }, "Failed to edit Discord message");
      });

      if (chunks.length > 1) {
        for (let i = 1; i < chunks.length; i++) {
          await (channel as any).send({ content: chunks[i] }).catch((err: any) => {
            this.log.error({ error: err?.message, chatId }, "Failed to send follow-up Discord chunk");
          });
        }
      }
    }
  }

  async downloadFile(fileId: string, destDir: string, fileName?: string): Promise<string> {
    const resp = await fetch(fileId);
    if (!resp.ok) throw new Error(`Failed to download Discord file: ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const ext = fileName && fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const ts = Date.now();
    const idSuffix = fileId.slice(-8).replace(/[^a-zA-Z0-9]/g, "");
    const baseName = fileName
      ? fileName.replace(/(\.[^.]+)$/, `_${ts}$1`).replace(/^([^.]+)$/, `$1_${ts}`)
      : `${ts}_${idSuffix}${ext}`;
    const localPath = join(destDir, baseName);
    mkdirSync(destDir, { recursive: true });
    writeFileSync(localPath, buffer);
    return localPath;
  }

  async sendTyping(chatId: string): Promise<void> {
    if (!this.client) return;
    const channel = await this.client.channels.fetch(chatId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await (channel as any).sendTyping().catch(() => {});
    }
  }

  private async registerSlashCommands(): Promise<void> {
    if (!this.client?.user) return;
    const rest = new REST().setToken(this.token);
    const slashCommands = [
      new SlashCommandBuilder()
        .setName("engine")
        .setDescription("Switch active CLI engine (claude, codex, agy)")
        .addStringOption((opt) => opt.setName("name").setDescription("Engine name (claude, codex, agy)").setRequired(false)),
      new SlashCommandBuilder()
        .setName("model")
        .setDescription("Choose or view models supported by current engine")
        .addStringOption((opt) => opt.setName("name").setDescription("Model name or id").setRequired(false)),
      new SlashCommandBuilder()
        .setName("effort")
        .setDescription("Set reasoning effort depth (low, medium, high)")
        .addStringOption((opt) => opt.setName("level").setDescription("Effort level").setRequired(false)),
      new SlashCommandBuilder()
        .setName("status")
        .setDescription("View current session, engine, model & status"),
      new SlashCommandBuilder()
        .setName("new")
        .setDescription("Start a fresh session in a new workspace")
        .addStringOption((opt) => opt.setName("title").setDescription("Session title or engine").setRequired(false)),
      new SlashCommandBuilder()
        .setName("sessions")
        .setDescription("List and switch sessions")
        .addIntegerOption((opt) => opt.setName("number").setDescription("Session number to switch to").setRequired(false)),
      new SlashCommandBuilder()
        .setName("title")
        .setDescription("Set session title")
        .addStringOption((opt) => opt.setName("text").setDescription("New session title").setRequired(false)),
      new SlashCommandBuilder()
        .setName("btw")
        .setDescription("Ask a quick side question without modifying workspace files")
        .addStringOption((opt) => opt.setName("question").setDescription("Your question").setRequired(true)),
      new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Interrupt current running task"),
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show command help message"),
    ];

    const body = slashCommands.map((c) => c.toJSON());
    const userId = this.client.user.id;

    try {
      await rest.put(Routes.applicationCommands(userId), { body });
      for (const [guildId] of this.client.guilds.cache) {
        await rest.put(Routes.applicationGuildCommands(userId, guildId), { body: [] }).catch(() => {});
      }
      this.log.info("Discord slash commands registered successfully");
    } catch (err) {
      this.log.warn({ error: err }, "Failed to register Discord slash commands");
    }
  }
}
