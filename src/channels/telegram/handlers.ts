import type { Bot, Context } from "grammy";
import type { InboundMessage, MessageHandler, CommandHandler, Attachment } from "../types.js";
import type { Logger } from "pino";
import type { MessageStore } from "../../sessions/message-store.js";

const mediaGroupBuffers = new Map<string, {
  messages: Array<{ msg: InboundMessage; attachments: Attachment[] }>;
  timer: ReturnType<typeof setTimeout>;
  text: string;
}>();

const MEDIA_GROUP_WAIT_MS = 500;

const callbackHandlers = new Map<string, (ctx: Context) => Promise<void>>();

export function onCallback(prefix: string, handler: (ctx: Context) => Promise<void>): void {
  callbackHandlers.set(prefix, handler);
}

let messageStore: MessageStore | undefined;

export function setMessageStore(store: MessageStore): void {
  messageStore = store;
}

function recordGroupMessage(msg: InboundMessage, text: string, media?: string[]): void {
  if (!messageStore) return;
  messageStore.append(msg.chatId, {
    id: msg.messageId,
    ts: msg.timestamp,
    sender: msg.senderName,
    senderId: msg.senderId,
    text,
    media,
    replyToId: msg.replyToMessageId,
    replyToSender: msg.replySenderName,
    replyToText: msg.replyText,
    threadId: msg.threadId,
  });
}

export function registerHandlers(
  bot: Bot,
  messageHandler: MessageHandler | undefined,
  commandHandlers: Map<string, CommandHandler>,
  log: Logger,
  adapterCallbackHandlers?: Map<string, (ctx: Context) => Promise<void>>,
  getTriggerWords?: (chatId: string) => string[],
): void {
  for (const [cmd, handler] of commandHandlers) {
    bot.command(cmd, (ctx) => {
      const msg = contextToInbound(ctx);
      if (!msg) return;
      const text = ctx.message?.text ?? "";
      const spaceIdx = text.indexOf(" ");
      msg.text = spaceIdx > 0 ? text.slice(spaceIdx + 1).trim() : "";
      handler(msg).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err), cmd }, "Command handler failed");
      });
    });
  }

  bot.on("message:text", (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (!messageHandler) return;
    const msg = contextToInbound(ctx);
    if (!msg) return;

    if (msg.isGroup) {
      recordGroupMessage(msg, ctx.message.text);

      const triggers = getTriggerWords?.(msg.chatId);
      const result = checkGroupMention(ctx, msg, ctx.message.text, triggers);
      if (!result) return;
      msg.text = result;
    }

    messageHandler(msg).catch((err: unknown) => {
      log.error({ error: err instanceof Error ? err.message : String(err) }, "Message handler failed");
    });
  });

  bot.on("message:photo", (ctx) => {
    if (!messageHandler) return;
    const msg = contextToInbound(ctx);
    if (!msg) return;

    const caption = ctx.message.caption ?? "";

    if (msg.isGroup) {
      const photo = ctx.message.photo;
      const largest = photo[photo.length - 1];
      recordGroupMessage(msg, caption ? `[Photo] ${caption}` : "[Photo]", [`photo:${largest.file_id}`]);

      const triggers = getTriggerWords?.(msg.chatId);
      const result = checkGroupMention(ctx, msg, caption, triggers);
      if (result === null) return;
      msg.text = result;
    } else {
      msg.text = caption;
    }

    const photo = ctx.message.photo;
    const largest = photo[photo.length - 1];
    const attachment: Attachment = { type: "photo", fileId: largest.file_id };

    const mediaGroupId = ctx.message.media_group_id;
    if (mediaGroupId) {
      bufferMediaGroup(mediaGroupId, msg, [attachment], msg.text, messageHandler, log);
    } else {
      msg.attachments = [attachment];
      messageHandler(msg).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err) }, "Photo handler failed");
      });
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data) return;

    const prefix = data.split(":")[0];
    const systemHandler = adapterCallbackHandlers?.get(prefix) ?? callbackHandlers.get(prefix);
    if (systemHandler) {
      await ctx.answerCallbackQuery();
      await systemHandler(ctx);
      return;
    }

    if (!messageHandler) return;
    await ctx.answerCallbackQuery();

    try {
      const orig = ctx.callbackQuery.message;
      if (orig && "text" in orig) {
        await ctx.editMessageText(orig.text + `\n\n→ ${data}`, {
          reply_markup: { inline_keyboard: [] },
        });
      }
    } catch {}

    const chat = ctx.callbackQuery.message?.chat;
    const from = ctx.callbackQuery.from;
    if (!chat) return;

    const msg: InboundMessage = {
      channelType: "telegram",
      chatId: String(chat.id),
      senderId: String(from.id),
      senderName: [from.first_name, from.last_name].filter(Boolean).join(" ") || "Unknown",
      messageId: String(ctx.callbackQuery.message?.message_id ?? ""),
      text: data,
      isGroup: chat.type === "group" || chat.type === "supergroup",
      timestamp: Math.floor(Date.now() / 1000),
      raw: ctx.callbackQuery,
    };

    messageHandler(msg).catch((err: unknown) => {
      log.error({ error: err instanceof Error ? err.message : String(err) }, "Callback handler failed");
    });
  });

  bot.on("message:document", (ctx) => {
    if (!messageHandler) return;
    const msg = contextToInbound(ctx);
    if (!msg) return;

    const caption = ctx.message.caption ?? "";

    if (msg.isGroup) {
      const doc = ctx.message.document;
      const fileName = doc?.file_name;
      recordGroupMessage(
        msg,
        caption ? `[File: ${fileName ?? "document"}] ${caption}` : `[File: ${fileName ?? "document"}]`,
        doc ? [`document:${doc.file_id}:${fileName ?? ""}`] : undefined,
      );

      const triggers = getTriggerWords?.(msg.chatId);
      const result = checkGroupMention(ctx, msg, caption, triggers);
      const mediaGroupId = ctx.message.media_group_id;
      if (result === null && !mediaGroupId) return;
      msg.text = result ?? "";
    } else {
      msg.text = caption;
    }

    const doc = ctx.message.document;
    const attachment: Attachment = {
      type: "document",
      fileId: doc.file_id,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
    };

    const mediaGroupId = ctx.message.media_group_id;
    if (mediaGroupId) {
      bufferMediaGroup(mediaGroupId, msg, [attachment], msg.text, messageHandler, log);
    } else {
      msg.attachments = [attachment];
      messageHandler(msg).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err) }, "Document handler failed");
      });
    }
  });

  bot.on("message:voice", (ctx) => {
    if (!messageHandler) return;
    const msg = contextToInbound(ctx);
    if (!msg) return;

    const caption = ctx.message.caption ?? "";

    if (msg.isGroup) {
      const voice = ctx.message.voice;
      recordGroupMessage(msg, caption ? `[Voice] ${caption}` : "[Voice]", [`voice:${voice.file_id}`]);

      const triggers = getTriggerWords?.(msg.chatId);
      const result = checkGroupMention(ctx, msg, caption, triggers);
      if (result === null) return;
      msg.text = result;
    } else {
      msg.text = caption;
    }

    const voice = ctx.message.voice;
    const attachment: Attachment = {
      type: "voice",
      fileId: voice.file_id,
      fileName: `voice_${voice.file_unique_id}.oga`,
      mimeType: voice.mime_type ?? "audio/ogg",
    };

    msg.attachments = [attachment];
    messageHandler(msg).catch((err: unknown) => {
      log.error({ error: err instanceof Error ? err.message : String(err) }, "Voice handler failed");
    });
  });

  bot.on("message:audio", (ctx) => {
    if (!messageHandler) return;
    const msg = contextToInbound(ctx);
    if (!msg) return;

    const caption = ctx.message.caption ?? "";
    const audio = ctx.message.audio;
    const fileName = audio.file_name ?? `audio_${audio.file_unique_id}.mp3`;

    if (msg.isGroup) {
      recordGroupMessage(msg, caption ? `[Audio: ${fileName}] ${caption}` : `[Audio: ${fileName}]`, [`audio:${audio.file_id}:${fileName}`]);

      const triggers = getTriggerWords?.(msg.chatId);
      const result = checkGroupMention(ctx, msg, caption, triggers);
      const mediaGroupId = ctx.message.media_group_id;
      if (result === null && !mediaGroupId) return;
      msg.text = result ?? "";
    } else {
      msg.text = caption;
    }

    const attachment: Attachment = {
      type: "audio",
      fileId: audio.file_id,
      fileName,
      mimeType: audio.mime_type ?? "audio/mpeg",
    };

    const mediaGroupId = ctx.message.media_group_id;
    if (mediaGroupId) {
      bufferMediaGroup(mediaGroupId, msg, [attachment], msg.text, messageHandler, log);
    } else {
      msg.attachments = [attachment];
      messageHandler(msg).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err) }, "Audio handler failed");
      });
    }
  });
}

export function checkGroupMention(
  ctx: Context,
  _msg: InboundMessage,
  text: string,
  triggerWords?: string[],
): string | null {
  const botUsername = ctx.me?.username;
  const isReplyToBot = ctx.message?.reply_to_message?.from?.id === ctx.me?.id;
  const isMentioned = botUsername && text.includes(`@${botUsername}`);
  const matchedTrigger = triggerWords?.some((word) => {
    const trimmed = word.trim();
    return trimmed.length > 0 && text.toLowerCase().includes(trimmed.toLowerCase());
  });

  if (!isMentioned && !isReplyToBot && !matchedTrigger) return null;

  if (isMentioned && botUsername) {
    return text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();
  }
  return text;
}

function bufferMediaGroup(
  mediaGroupId: string,
  msg: InboundMessage,
  attachments: Attachment[],
  text: string,
  handler: MessageHandler,
  log: Logger,
): void {
  const existing = mediaGroupBuffers.get(mediaGroupId);

  if (existing) {
    existing.messages.push({ msg, attachments });
    if (text && !existing.text) existing.text = text;
    return;
  }

  const buffer = {
    messages: [{ msg, attachments }],
    text,
    timer: setTimeout(() => {
      mediaGroupBuffers.delete(mediaGroupId);
      const buf = buffer;
      if (buf.messages.length === 0) return;

      const base = buf.messages[0].msg;
      base.text = buf.text;
      base.attachments = buf.messages.flatMap((m) => m.attachments);

      if (base.isGroup && !buf.text && !base.replyToMessageId) {
        log.debug({ mediaGroupId }, "Media group in group without mention, skipping");
        return;
      }

      handler(base).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err) }, "Media group handler failed");
      });
    }, MEDIA_GROUP_WAIT_MS),
  };

  mediaGroupBuffers.set(mediaGroupId, buffer);
}

export function contextToInbound(ctx: Context): InboundMessage | null {
  const msg = ctx.message;
  if (!msg) return null;

  const chatId = String(msg.chat.id);
  const senderId = String(msg.from?.id ?? "unknown");
  const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Unknown";

  const reply = msg.reply_to_message;
  let replyText: string | undefined;
  let replySenderName: string | undefined;
  let replyIsQuote = false;
  const replyAttachments: Attachment[] = [];
  if (reply) {
    replySenderName = [reply.from?.first_name, reply.from?.last_name].filter(Boolean).join(" ") || undefined;
    const quoteText = (msg as unknown as Record<string, unknown>).quote as { text?: string } | undefined;
    if (quoteText?.text) {
      replyText = quoteText.text;
      replyIsQuote = true;
    } else {
      replyText = reply.text ?? reply.caption ?? undefined;
    }

    const r = reply as unknown as Record<string, unknown>;
    if (r.photo) {
      const photos = r.photo as Array<{ file_id: string }>;
      const largest = photos[photos.length - 1];
      if (largest) replyAttachments.push({ type: "photo", fileId: largest.file_id });
      if (!replyText) replyText = "[Photo]";
    }
    if (r.document) {
      const doc = r.document as { file_id: string; file_name?: string; mime_type?: string };
      replyAttachments.push({
        type: "document",
        fileId: doc.file_id,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
      });
      if (!replyText) replyText = doc.file_name ? `[File: ${doc.file_name}]` : "[Document]";
    }
    if (r.voice) {
      const v = r.voice as { file_id: string; file_unique_id?: string; mime_type?: string };
      replyAttachments.push({
        type: "voice",
        fileId: v.file_id,
        fileName: v.file_unique_id ? `voice_${v.file_unique_id}.oga` : "voice.oga",
        mimeType: v.mime_type ?? "audio/ogg",
      });
      if (!replyText) replyText = "[Voice]";
    }
    if (r.audio) {
      const a = r.audio as { file_id: string; file_unique_id?: string; file_name?: string; mime_type?: string };
      replyAttachments.push({
        type: "audio",
        fileId: a.file_id,
        fileName: a.file_name ?? (a.file_unique_id ? `audio_${a.file_unique_id}.mp3` : "audio.mp3"),
        mimeType: a.mime_type ?? "audio/mpeg",
      });
      if (!replyText) replyText = a.file_name ? `[Audio: ${a.file_name}]` : "[Audio]";
    }
  }

  return {
    channelType: "telegram",
    chatId,
    senderId,
    senderName,
    messageId: String(msg.message_id),
    text: msg.text ?? msg.caption ?? "",
    isGroup: msg.chat.type === "group" || msg.chat.type === "supergroup",
    timestamp: msg.date,
    // Replies in any supergroup carry message_thread_id too; only a forum topic is a thread of its own
    threadId: msg.is_topic_message && msg.message_thread_id ? String(msg.message_thread_id) : undefined,
    replyToMessageId: reply?.message_id ? String(reply.message_id) : undefined,
    replyText,
    replySenderName,
    replyIsQuote,
    replyAttachments: replyAttachments.length > 0 ? replyAttachments : undefined,
    raw: msg,
  };
}
