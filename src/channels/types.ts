export interface InboundMessage {
  channelType: "telegram" | "discord" | string;
  chatId: string;
  senderId: string;
  senderName: string;
  messageId: string;
  text: string;
  isGroup: boolean;
  timestamp: number;
  threadId?: string;
  replyToMessageId?: string;
  replyText?: string;
  replySenderName?: string;
  replyIsQuote?: boolean;
  attachments?: Attachment[];
  replyAttachments?: Attachment[];
  raw: unknown;
}

export interface Attachment {
  type: "photo" | "document" | "audio" | "voice" | "video";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  localPath?: string;
}

export interface OutboundAttachment {
  type: "file" | "photo";
  path: string;
  caption?: string;
}

export interface OutboundMessage {
  chatId: string;
  text: string;
  parseMode?: "MarkdownV2" | "HTML";
  plainFallback?: string;
  replyToMessageId?: string;
  attachments?: OutboundAttachment[];
}

export interface InlineButton {
  text: string;
  data: string;
}

export type MessageHandler = (msg: InboundMessage) => Promise<void>;
export type CommandHandler = (msg: InboundMessage) => Promise<void>;

export interface ChannelAdapter {
  readonly type: string;
  username?: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(msg: OutboundMessage): Promise<string>;
  sendWithButtons?(chatId: string, text: string, buttons: InlineButton[][]): Promise<string>;
  editMessage(
    chatId: string,
    messageId: string,
    text: string,
    buttons?: string[],
    parseMode?: "MarkdownV2" | "HTML",
    plainFallback?: string,
  ): Promise<void>;
  downloadFile?(fileId: string, destDir: string, fileName?: string): Promise<string>;
  onMessage(handler: MessageHandler): void;
  onCommand(command: string, handler: CommandHandler): void;
  onCallback?(prefix: string, handler: (ctx: any) => Promise<void>): void;
  sendTyping(chatId: string): Promise<void>;
}
