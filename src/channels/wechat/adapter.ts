import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import type { Logger } from "pino";
import type {
  ChannelAdapter,
  OutboundMessage,
  MessageHandler,
  CommandHandler,
  InlineButton,
  InboundMessage,
  Attachment,
  HistoryMessage,
} from "../types.js";
import type { MessageStore } from "../../sessions/message-store.js";
import {
  DEFAULT_BASE_URL,
  DEFAULT_CDN_BASE_URL,
  fetchBotQrCode,
  fetchQrCodeStatus,
  notifyStart,
  notifyStop,
  getUpdates,
  sendMessage,
  sendTyping,
} from "./api.js";
import { downloadInboundMedia, uploadAndSendWechatMedia } from "./media.js";
import { formatWechatText, formatButtonsAsText, splitWechatMessage } from "./formatter.js";
import {
  MessageItemType,
  type WechatSessionData,
  type WechatChannelConfig,
  type WeixinMessage,
  type SendMessageReq,
} from "./types.js";

export class WechatAdapter implements ChannelAdapter {
  readonly type = "wechat";
  username?: string;

  private botId: string;
  private dataDir: string;
  private config: WechatChannelConfig;
  private log: Logger;
  private messageHandler?: MessageHandler;
  private commandHandlers = new Map<string, CommandHandler>();
  private messageStore?: MessageStore;
  private botName: string = "PocketAgent";
  private stopped = false;
  private sessionData?: WechatSessionData;
  private syncBuf: string = "";
  private contextTokens = new Map<string, string>();
  private triggerWordsResolver?: (chatId: string) => string[];
  private lastPollingErrorAt: number = 0;

  constructor(opts: {
    botId: string;
    dataDir: string;
    config?: WechatChannelConfig;
    log: Logger;
  }) {
    this.botId = opts.botId;
    this.dataDir = opts.dataDir;
    this.config = opts.config ?? {};
    this.log = opts.log.child({ module: "wechat" });
  }

  setTriggerWordsResolver(resolver: (chatId: string) => string[]): void {
    this.triggerWordsResolver = resolver;
  }

  setMessageStore(store: MessageStore, botName?: string): void {
    this.messageStore = store;
    if (botName) this.botName = botName;
  }

  advanceCursorForSession(sessionId: string, messageId: string): void {
    this.messageStore?.advanceCursor(sessionId, messageId);
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onCommand(command: string, handler: CommandHandler): void {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  private credentialsDir(): string {
    const dir = join(this.dataDir, "credentials", this.botId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private sessionFilePath(): string {
    return join(this.credentialsDir(), "wechat-session.json");
  }

  private syncBufFilePath(): string {
    return join(this.credentialsDir(), "wechat-sync.txt");
  }

  private qrImagePath(): string {
    return join(this.credentialsDir(), "wechat-login-qr.png");
  }

  private loadSession(): boolean {
    const path = this.sessionFilePath();
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const data = JSON.parse(raw) as WechatSessionData;
        if (data && data.bot_token) {
          this.sessionData = data;
          this.username = data.ilink_bot_id || "WeChatBot";
          this.log.info({ botId: data.ilink_bot_id, user: data.ilink_user_id }, "Loaded existing WeChat session");
          return true;
        }
      } catch (err) {
        this.log.error({ error: err }, "Failed to read WeChat session file");
      }
    }
    return false;
  }

  private saveSession(data: WechatSessionData): void {
    this.sessionData = data;
    this.username = data.ilink_bot_id || "WeChatBot";
    writeFileSync(this.sessionFilePath(), JSON.stringify(data, null, 2), "utf-8");
    this.log.info({ botId: data.ilink_bot_id }, "Saved WeChat session");
  }

  private loadSyncBuf(): void {
    const path = this.syncBufFilePath();
    if (existsSync(path)) {
      try {
        this.syncBuf = readFileSync(path, "utf-8").trim();
      } catch {}
    }
  }

  private saveSyncBuf(buf: string): void {
    this.syncBuf = buf;
    try {
      writeFileSync(this.syncBufFilePath(), buf, "utf-8");
    } catch {}
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.loadSyncBuf();

    if (!this.loadSession()) {
      await this.loginWithQr();
    }

    if (!this.sessionData?.bot_token) {
      throw new Error("WeChat adapter cannot start: missing authentication token");
    }

    const baseUrl = this.sessionData.baseurl || this.config.baseUrl || DEFAULT_BASE_URL;
    try {
      await notifyStart(baseUrl, this.sessionData.bot_token);
      this.log.info("Registered WeChat client start (notifyStart)");
    } catch (err) {
      this.log.warn({ error: err }, "WeChat notifyStart warning (ignored)");
    }

    void this.listenLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.sessionData?.bot_token) {
      const baseUrl = this.sessionData.baseurl || this.config.baseUrl || DEFAULT_BASE_URL;
      try {
        await notifyStop(baseUrl, this.sessionData.bot_token);
        this.log.info("Notified WeChat client stop (notifyStop)");
      } catch (err) {
        this.log.warn({ error: err }, "WeChat notifyStop failed");
      }
    }
  }

  private async loginWithQr(): Promise<void> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    const botType = this.config.botType || "3";

    this.log.info("Requesting WeChat login QR code from iLink...");
    const { qrcode, qrcode_img_content } = await fetchBotQrCode(baseUrl, botType);

    // Save QR code as PNG image
    const qrPath = this.qrImagePath();
    try {
      await QRCode.toFile(qrPath, qrcode_img_content, { width: 400, margin: 2 });
      this.log.info({ qrPath }, "WeChat login QR image generated");
    } catch (err) {
      this.log.warn({ error: err }, "Failed to generate WeChat QR PNG file");
    }

    // Print QR code directly to console terminal
    console.log("\n=======================================================");
    console.log("  [WeChat ClawBot Login] 请使用手机微信扫码授权登录：");
    console.log(`  (二维码图片已存至: ${qrPath})`);
    console.log("=======================================================\n");
    qrcodeTerminal.generate(qrcode_img_content, { small: true });

    let currentBaseUrl = baseUrl;
    const startTime = Date.now();
    const maxWaitMs = 5 * 60 * 1000; // 5 minutes

    while (Date.now() - startTime < maxWaitMs) {
      if (this.stopped) throw new Error("WeChat login aborted");

      try {
        const statusResp = await fetchQrCodeStatus(currentBaseUrl, qrcode);
        const { status, redirect_host } = statusResp;

        if (status === "wait") {
          // Waiting for scan
        } else if (status === "scaned") {
          this.log.info("WeChat QR scanned; please confirm authorization on your mobile phone");
        } else if (status === "scaned_but_redirect" && redirect_host) {
          currentBaseUrl = `https://${redirect_host}`;
          this.log.info({ currentBaseUrl }, "WeChat IDC redirect during QR poll");
        } else if (status === "confirmed" && statusResp.bot_token) {
          this.log.info("WeChat QR authorization successful!");
          this.saveSession({
            bot_token: statusResp.bot_token,
            ilink_bot_id: statusResp.ilink_bot_id || "",
            ilink_user_id: statusResp.ilink_user_id,
            baseurl: statusResp.baseurl || currentBaseUrl,
            login_time: new Date().toISOString(),
          });
          return;
        } else if (status === "binded_redirect") {
          this.log.warn("WeChat account has existing binding (binded_redirect)");
          if (this.sessionData?.bot_token) return;
        } else if (status === "expired") {
          this.log.error("WeChat QR code expired; please restart login");
          throw new Error("WeChat QR code expired");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("expired")) throw err;
        this.log.debug({ error: err }, "WeChat QR poll retry");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error("WeChat QR code login timed out");
  }

  private async listenLoop(): Promise<void> {
    this.log.info("Starting WeChat message polling loop...");
    let pollTimeout = 35_000;

    while (!this.stopped) {
      if (!this.sessionData?.bot_token) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      const baseUrl = this.sessionData.baseurl || this.config.baseUrl || DEFAULT_BASE_URL;
      try {
        const resp = await getUpdates(baseUrl, this.sessionData.bot_token, this.syncBuf, pollTimeout);

        const isApiError = Boolean(
          resp &&
            ((resp.ret !== undefined && resp.ret !== 0) ||
              (resp.errcode !== undefined && resp.errcode !== 0))
        );

        if (resp && !isApiError) {
          if (resp.get_updates_buf) {
            this.saveSyncBuf(resp.get_updates_buf);
          }
          if (resp.longpolling_timeout_ms && resp.longpolling_timeout_ms > 0) {
            pollTimeout = resp.longpolling_timeout_ms;
          }

          if (resp.msgs && resp.msgs.length > 0) {
            for (const msg of resp.msgs) {
              await this.handleIncomingWechatMessage(msg);
            }
          }
        } else if (resp && isApiError) {
          this.log.warn({ ret: resp.ret, errcode: resp.errcode, errmsg: resp.errmsg }, "getUpdates non-zero response");
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (err) {
        const now = Date.now();
        if (now - this.lastPollingErrorAt > 10_000) {
          this.log.warn({ error: err }, "getUpdates polling error; backing off");
          this.lastPollingErrorAt = now;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private async handleIncomingWechatMessage(msg: WeixinMessage): Promise<void> {
    const fromUser = msg.from_user_id;
    if (!fromUser) return;

    if (msg.context_token) {
      this.contextTokens.set(fromUser, msg.context_token);
    }

    const items = msg.item_list ?? [];
    if (items.length === 0) return;

    const cdnBaseUrl = this.config.cdnBaseUrl || DEFAULT_CDN_BASE_URL;
    const downloadsDir = join(this.dataDir, "downloads", this.botId, fromUser);

    const textParts: string[] = [];
    const attachments: Attachment[] = [];
    let quoteText: string | undefined;

    for (const item of items) {
      if (item.type === MessageItemType.TEXT && item.text_item?.text) {
        textParts.push(item.text_item.text);
      }

      if (item.ref_msg) {
        const refItem = item.ref_msg.message_item;
        if (refItem?.text_item?.text) {
          quoteText = refItem.text_item.text;
        } else if (item.ref_msg.title) {
          quoteText = item.ref_msg.title;
        }
      }

      // Download and decrypt media (voice -> wav, image, video, file)
      if (
        item.type === MessageItemType.IMAGE ||
        item.type === MessageItemType.VOICE ||
        item.type === MessageItemType.VIDEO ||
        item.type === MessageItemType.FILE
      ) {
        try {
          const mediaRes = await downloadInboundMedia(item, downloadsDir, cdnBaseUrl, this.log);
          if (mediaRes) {
            attachments.push({
              type: mediaRes.type,
              fileId: mediaRes.localPath,
              fileName: mediaRes.fileName,
              mimeType: mediaRes.mimeType,
              localPath: mediaRes.localPath,
            });
            // If voice has transcribed text from server, append it
            if (item.voice_item?.text) {
              textParts.push(`[语音转写: ${item.voice_item.text}]`);
            }
          }
        } catch (err) {
          this.log.error({ error: err }, "Error downloading inbound WeChat media");
        }
      }
    }

    let fullText = textParts.join("\n").trim();
    const messageId = msg.message_id || msg.client_id || `wechat-${Date.now()}`;
    const timestamp = msg.create_time_ms ? Math.floor(msg.create_time_ms / 1000) : Math.floor(Date.now() / 1000);

    const inbound: InboundMessage = {
      channelType: "wechat",
      chatId: fromUser,
      senderId: fromUser,
      senderName: fromUser,
      messageId,
      text: fullText,
      isGroup: Boolean(msg.group_id),
      timestamp,
      replyText: quoteText,
      replyIsQuote: Boolean(quoteText),
      attachments: attachments.length > 0 ? attachments : undefined,
      raw: msg,
    };

    this.log.info({ fromUser, text: fullText, attachmentsCount: attachments.length }, "Received WeChat message");

    // Check slash commands (e.g. /engine, /model, /status, /help, /new)
    if (fullText.startsWith("/") || fullText.startsWith("!")) {
      const parts = fullText.slice(1).trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      const arg = fullText.slice(parts[0].length + 1).trim();

      const handler = this.commandHandlers.get(cmd);
      if (handler) {
        const cmdMsg: InboundMessage = { ...inbound, text: arg };
        await handler(cmdMsg);
        return;
      }
    }

    if (this.messageHandler) {
      await this.messageHandler(inbound);
    }
  }

  async send(msg: OutboundMessage): Promise<string> {
    if (!this.sessionData?.bot_token) {
      throw new Error("WeChat adapter not logged in");
    }

    const baseUrl = this.sessionData.baseurl || this.config.baseUrl || DEFAULT_BASE_URL;
    const token = this.sessionData.bot_token;
    const toUserId = msg.chatId;
    const contextToken = this.contextTokens.get(toUserId);

    // Send media attachments if present
    if (msg.attachments && msg.attachments.length > 0) {
      const cdnBaseUrl = this.config.cdnBaseUrl || DEFAULT_CDN_BASE_URL;
      for (const att of msg.attachments) {
        try {
          await uploadAndSendWechatMedia({
            filePath: att.path,
            toUserId,
            baseUrl,
            token,
            cdnBaseUrl,
            contextToken,
            caption: att.caption,
            log: this.log,
          });
        } catch (err) {
          this.log.error({ error: err, file: att.path }, "Failed to send WeChat media attachment");
        }
      }
    }

    const rawText = msg.text.trim();
    if (!rawText) {
      return `wechat-out-${Date.now()}`;
    }

    const plainText = formatWechatText(rawText);
    const chunks = splitWechatMessage(plainText);
    let lastMsgId = `wechat-out-${Date.now()}`;

    for (const chunk of chunks) {
      const clientId = `claw-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const req: SendMessageReq = {
        msg: {
          to_user_id: toUserId,
          client_id: clientId,
          message_type: 2, // BOT
          message_state: 2, // FINISH
          item_list: [
            {
              type: MessageItemType.TEXT,
              text_item: { text: chunk },
            },
          ],
          context_token: contextToken,
        },
      };

      const resp = await sendMessage(baseUrl, token, req);
      lastMsgId = resp.msg_id || resp.message_id || clientId;
    }

    return lastMsgId;
  }

  async sendMessages(msg: OutboundMessage): Promise<string[]> {
    const id = await this.send(msg);
    return [id];
  }

  async sendWithButtons(chatId: string, text: string, buttons: InlineButton[][]): Promise<string> {
    const formatted = formatButtonsAsText(formatWechatText(text), buttons);
    return this.send({ chatId, text: formatted });
  }

  async editMessage(): Promise<void> {
    // WeChat doesn't support editing sent messages; no-op
  }

  async sendTyping(chatId: string): Promise<void> {
    if (!this.sessionData?.bot_token) return;
    const baseUrl = this.sessionData.baseurl || this.config.baseUrl || DEFAULT_BASE_URL;
    try {
      await sendTyping(baseUrl, this.sessionData.bot_token, {
        ilink_user_id: chatId,
        status: 1,
      });
    } catch {}
  }

  async sendPhoto(chatId: string, filePath: string, caption?: string): Promise<string> {
    if (!this.sessionData?.bot_token) throw new Error("WeChat adapter not logged in");
    const baseUrl = this.sessionData.baseurl || this.config.baseUrl || DEFAULT_BASE_URL;
    const cdnBaseUrl = this.config.cdnBaseUrl || DEFAULT_CDN_BASE_URL;
    const contextToken = this.contextTokens.get(chatId);
    return uploadAndSendWechatMedia({
      filePath,
      toUserId: chatId,
      baseUrl,
      token: this.sessionData.bot_token,
      cdnBaseUrl,
      contextToken,
      caption,
      log: this.log,
    });
  }

  async sendDocument(chatId: string, filePath: string, caption?: string): Promise<string> {
    return this.sendPhoto(chatId, filePath, caption);
  }

  async sendFile(chatId: string, filePath: string, caption?: string): Promise<void> {
    await this.sendPhoto(chatId, filePath, caption);
  }

  async downloadFile(fileId: string, destDir: string): Promise<string> {
    if (existsSync(fileId)) {
      return fileId;
    }
    throw new Error(`WeChat downloadFile: file ${fileId} not found locally`);
  }
}
