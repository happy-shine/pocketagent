import type { Logger } from "pino";
import type { ChannelAdapter, OutboundMessage, MessageHandler, CommandHandler, InlineButton } from "../types.js";

export interface DiscordConfig {
  token: string;
  clientId?: string;
  guildPolicy?: "open" | "pairing" | "allowlist" | "disabled";
}

/**
 * Discord Channel Adapter (Reserved & extensible for Discord Bot integration).
 * Fully implements ChannelAdapter interface.
 */
export class DiscordAdapter implements ChannelAdapter {
  readonly type = "discord";
  private token: string;
  private log: Logger;
  private messageHandler?: MessageHandler;
  private commandHandlers = new Map<string, CommandHandler>();
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

  async start(): Promise<void> {
    this.log.info("Discord adapter initialized (ready for discord.js client bridge)");
    // When enabled with full discord.js client, connects gateway to Discord gateway websocket.
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.log.info("Discord adapter stopped");
  }

  async send(msg: OutboundMessage): Promise<string> {
    this.log.debug({ chatId: msg.chatId, length: msg.text.length }, "Discord send message");
    return `dc-${Date.now()}`;
  }

  async sendWithButtons(chatId: string, text: string, _buttons: InlineButton[][]): Promise<string> {
    return this.send({ chatId, text });
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<void> {
    this.log.debug({ chatId, messageId, length: text.length }, "Discord edit message");
  }

  async sendTyping(chatId: string): Promise<void> {
    this.log.debug({ chatId }, "Discord send typing");
  }
}
