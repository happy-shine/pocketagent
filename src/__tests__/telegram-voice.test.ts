import { describe, it, expect, vi } from "vitest";
import { registerHandlers, contextToInbound } from "../channels/telegram/handlers.js";
import type { Context } from "grammy";
import type { InboundMessage } from "../channels/types.js";

describe("telegram voice & audio handling", () => {
  it("contextToInbound correctly parses voice and audio messages and replies", () => {
    const mockCtx = {
      message: {
        message_id: 101,
        date: 1727527614,
        chat: { id: 123456, type: "private" },
        from: { id: 789, first_name: "Test", last_name: "User" },
        voice: {
          file_id: "voice_file_123",
          file_unique_id: "uniq_v_1",
          duration: 5,
          mime_type: "audio/ogg",
        },
        reply_to_message: {
          message_id: 100,
          from: { id: 999, first_name: "Bot" },
          voice: {
            file_id: "replied_voice_file",
            file_unique_id: "uniq_v_0",
            mime_type: "audio/ogg",
          },
        },
      },
    } as unknown as Context;

    const inbound = contextToInbound(mockCtx);
    expect(inbound).not.toBeNull();
    expect(inbound?.channelType).toBe("telegram");
    expect(inbound?.chatId).toBe("123456");
    expect(inbound?.senderId).toBe("789");
    expect(inbound?.senderName).toBe("Test User");
    expect(inbound?.messageId).toBe("101");
    expect(inbound?.text).toBe("");
    expect(inbound?.isGroup).toBe(false);
    expect(inbound?.replyToMessageId).toBe("100");
    expect(inbound?.replyText).toBe("[Voice]");
    expect(inbound?.replyAttachments).toEqual([
      {
        type: "voice",
        fileId: "replied_voice_file",
        fileName: "voice_uniq_v_0.oga",
        mimeType: "audio/ogg",
      },
    ]);
  });

  it("contextToInbound correctly parses audio reply", () => {
    const mockCtx = {
      message: {
        message_id: 102,
        date: 1727527620,
        chat: { id: 123456, type: "private" },
        from: { id: 789, first_name: "Test" },
        reply_to_message: {
          message_id: 101,
          from: { id: 999, first_name: "Bot" },
          audio: {
            file_id: "audio_file_456",
            file_name: "song.mp3",
            mime_type: "audio/mpeg",
          },
        },
      },
    } as unknown as Context;

    const inbound = contextToInbound(mockCtx);
    expect(inbound?.replyText).toBe("[Audio: song.mp3]");
    expect(inbound?.replyAttachments).toEqual([
      {
        type: "audio",
        fileId: "audio_file_456",
        fileName: "song.mp3",
        mimeType: "audio/mpeg",
      },
    ]);
  });

  it("registers message:voice and message:audio handlers and invokes messageHandler", async () => {
    const registeredEvents: Record<string, (ctx: Context) => Promise<void>> = {};
    const mockBot = {
      command: vi.fn(),
      on: vi.fn((event: string, handler: (ctx: Context) => Promise<void>) => {
        registeredEvents[event] = handler;
      }),
    };

    let receivedMsg: InboundMessage | undefined;
    const messageHandler = async (msg: InboundMessage) => {
      receivedMsg = msg;
    };

    const mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    registerHandlers(
      mockBot as any,
      messageHandler,
      new Map(),
      mockLogger as any,
    );

    expect(registeredEvents["message:voice"]).toBeDefined();
    expect(registeredEvents["message:audio"]).toBeDefined();

    // Simulate incoming voice message
    const voiceCtx = {
      message: {
        message_id: 201,
        date: 1727527650,
        chat: { id: 123456, type: "private" },
        from: { id: 789, first_name: "Shine" },
        voice: {
          file_id: "tg_voice_abc",
          file_unique_id: "uniq_voice_999",
          duration: 5,
          mime_type: "audio/ogg",
        },
      },
      me: { id: 999, username: "AtriBot" },
    } as unknown as Context;

    await registeredEvents["message:voice"](voiceCtx);

    expect(receivedMsg).toBeDefined();
    expect(receivedMsg?.channelType).toBe("telegram");
    expect(receivedMsg?.chatId).toBe("123456");
    expect(receivedMsg?.attachments).toEqual([
      {
        type: "voice",
        fileId: "tg_voice_abc",
        fileName: "voice_uniq_voice_999.oga",
        mimeType: "audio/ogg",
      },
    ]);

    // Simulate incoming audio message
    const audioCtx = {
      message: {
        message_id: 202,
        date: 1727527660,
        chat: { id: 123456, type: "private" },
        from: { id: 789, first_name: "Shine" },
        caption: "check this audio",
        audio: {
          file_id: "tg_audio_def",
          file_unique_id: "uniq_audio_888",
          file_name: "speech.mp3",
          duration: 12,
          mime_type: "audio/mpeg",
        },
      },
      me: { id: 999, username: "AtriBot" },
    } as unknown as Context;

    await registeredEvents["message:audio"](audioCtx);

    expect(receivedMsg?.chatId).toBe("123456");
    expect(receivedMsg?.text).toBe("check this audio");
    expect(receivedMsg?.attachments).toEqual([
      {
        type: "audio",
        fileId: "tg_audio_def",
        fileName: "speech.mp3",
        mimeType: "audio/mpeg",
      },
    ]);
  });
});
