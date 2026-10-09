import { describe, it, expect, vi } from "vitest";
import type { HistoryMessage, ChannelAdapter, InboundMessage } from "../channels/types.js";
import { SessionManager } from "../sessions/manager.js";
import { buildGroupContext } from "../bot/group-context.js";

describe("Group Chat Context & Delta Deduplication", () => {
  it("formats reply metadata correctly in history messages", () => {
    const msg: HistoryMessage = {
      id: "1001",
      ts: 1775584800,
      sender: "Bob",
      senderId: "u2",
      text: "关注一下支撑位",
      replyToId: "1000",
      replyToSender: "Alice",
      replyToText: "这只股票怎么看",
    };

    const pad = (n: number) => String(n).padStart(2, "0");
    const mDt = new Date(msg.ts * 1000);
    const time = `${pad(mDt.getHours())}:${pad(mDt.getMinutes())}:${pad(mDt.getSeconds())}`;
    let line = `[${time}] ${msg.sender}`;
    if (msg.replyToSender || msg.replyToText) {
      const target = msg.replyToSender || "someone";
      const snippet = msg.replyToText ? ` "${msg.replyToText.slice(0, 80)}"` : "";
      line += ` (replying to ${target}${snippet})`;
    }
    line += `: ${msg.text}`;

    expect(line).toContain("Bob (replying to Alice \"这只股票怎么看\"): 关注一下支撑位");
  });

  it("calculates initial context (up to 100 messages) on first turn", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "guild-channel-1",
      channelType: "discord",
      isGroup: true,
      defaultEngine: "agy",
    });

    const history: HistoryMessage[] = [];
    for (let i = 1; i <= 150; i++) {
      history.push({
        id: `msg-${i}`,
        ts: 1775580000 + i,
        sender: `User${i % 3}`,
        senderId: `u${i % 3}`,
        text: `Message content ${i}`,
      });
    }

    const currentMsgId = "msg-150";
    const priorMessages = history.filter((m) => m.id !== currentMsgId);

    const lastCursor = session.lastContextMessageId;
    let newMessages: HistoryMessage[] = [];
    let header = "";

    if (!lastCursor) {
      newMessages = priorMessages.slice(-100);
      header = "### Recent Group Chat Context (prior messages leading up to this turn):";
    }

    expect(newMessages.length).toBe(100);
    expect(newMessages[0].id).toBe("msg-50");
    expect(newMessages[99].id).toBe("msg-149");
    expect(header).toContain("Recent Group Chat Context");

    // Advance cursor
    session.lastContextMessageId = currentMsgId;
    expect(session.lastContextMessageId).toBe("msg-150");
  });

  it("sends ONLY newly added delta messages when there is an overlap with previously sent messages", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "guild-channel-1",
      channelType: "discord",
      isGroup: true,
      defaultEngine: "agy",
    });

    // Turn 1 had cursor at msg-150
    session.lastContextMessageId = "msg-150";

    // Now 5 new messages happened in the channel: msg-151, msg-152, msg-153, msg-154, and current msg-155
    const history: HistoryMessage[] = [];
    for (let i = 100; i <= 155; i++) {
      history.push({
        id: `msg-${i}`,
        ts: 1775580000 + i,
        sender: `User${i % 3}`,
        senderId: `u${i % 3}`,
        text: `Message content ${i}`,
      });
    }

    const currentMsgId = "msg-155";
    const priorMessages = history.filter((m) => m.id !== currentMsgId);

    const lastCursor = session.lastContextMessageId;
    let newMessages: HistoryMessage[] = [];
    let header = "";

    const cursorIdx = priorMessages.findIndex((m) => m.id === lastCursor);
    expect(cursorIdx).not.toBe(-1);

    if (cursorIdx !== -1) {
      newMessages = priorMessages.slice(cursorIdx + 1);
      header = "### New Group Chat Messages (since last turn):";
    }

    // Only newly added messages between msg-150 and msg-155: msg-151, 152, 153, 154
    expect(newMessages.length).toBe(4);
    expect(newMessages.map((m) => m.id)).toEqual(["msg-151", "msg-152", "msg-153", "msg-154"]);
    expect(header).toBe("### New Group Chat Messages (since last turn):");

    // Advance cursor
    session.lastContextMessageId = currentMsgId;
    expect(session.lastContextMessageId).toBe("msg-155");
  });

  it("produces zero context block when user sends consecutive message without background chat", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "guild-channel-1",
      channelType: "discord",
      isGroup: true,
      defaultEngine: "agy",
    });

    // Suppose Bot just replied with msg-200
    session.lastContextMessageId = "msg-200";

    // User immediately sends msg-201
    const history: HistoryMessage[] = [
      { id: "msg-199", ts: 1775580199, sender: "Alice", senderId: "u1", text: "Question 1" },
      { id: "msg-200", ts: 1775580200, sender: "Bot", senderId: "bot", text: "Answer 1" },
      { id: "msg-201", ts: 1775580201, sender: "Alice", senderId: "u1", text: "Follow up question" },
    ];

    const currentMsgId = "msg-201";
    const triggerIdx = history.findIndex((m) => m.id === currentMsgId);
    const priorMessages = triggerIdx !== -1 ? history.slice(0, triggerIdx) : history.filter((m) => m.id !== currentMsgId);

    const cursorIdx = priorMessages.findIndex((m) => m.id === session.lastContextMessageId);
    expect(cursorIdx).toBe(1); // Points to msg-200

    let newMessages = priorMessages.slice(cursorIdx + 1);
    expect(newMessages.length).toBe(0); // Zero background messages in between!
  });

  it("handles interleaved message when User 2 speaks while Bot is generating", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "guild-channel-1",
      channelType: "discord",
      isGroup: true,
      defaultEngine: "agy",
    });

    // Turn 1: User 1 sends msg-100: "@bot analyze NVDA"
    session.lastContextMessageId = "msg-100";

    // While Bot was generating or right around then:
    // User 2 sends msg-101: "I think it's breaking resistance"
    // Bot finishes Turn 1 and outputs msg-102: "NVDA trend is bullish..."
    // Then Turn 2: User 1 sends msg-103: "@bot what do you think of User 2's point?"
    const history: HistoryMessage[] = [
      { id: "msg-99", ts: 1775580099, sender: "Alice", senderId: "u1", text: "Earlier chat" },
      { id: "msg-100", ts: 1775580100, sender: "Alice", senderId: "u1", text: "@bot analyze NVDA" },
      { id: "msg-101", ts: 1775580102, sender: "Bob", senderId: "u2", text: "I think it's breaking resistance" },
      { id: "msg-102", ts: 1775580105, sender: "PocketAgent", senderId: "bot", text: "NVDA trend is bullish..." },
      { id: "msg-103", ts: 1775580110, sender: "Alice", senderId: "u1", text: "@bot what do you think of User 2's point?" },
    ];

    const currentMsgId = "msg-103";
    const triggerIdx = history.findIndex((m) => m.id === currentMsgId);
    const priorMessages = triggerIdx !== -1 ? history.slice(0, triggerIdx) : history.filter((m) => m.id !== currentMsgId);

    // Prior messages strictly before msg-103: [msg-99, msg-100, msg-101, msg-102]
    expect(priorMessages.map((m) => m.id)).toEqual(["msg-99", "msg-100", "msg-101", "msg-102"]);

    // Look for previous cursor (msg-100)
    const cursorIdx = priorMessages.findIndex((m) => m.id === session.lastContextMessageId);
    expect(cursorIdx).toBe(1); // Points to msg-100

    let newMessages = priorMessages.slice(cursorIdx + 1);
    // Contains msg-101 (Bob's interleaved message) and msg-102 (Bot's reply)
    expect(newMessages.map((m) => m.id)).toEqual(["msg-101", "msg-102"]);

    // Check that Bob's message is preserved and detected
    const hasOtherUserMessages = newMessages.some((m) => m.senderId !== "bot" && m.sender !== "PocketAgent");
    expect(hasOtherUserMessages).toBe(true);

    // Ensure Bob's interleaved message is NOT lost
    expect(newMessages.find((m) => m.sender === "Bob")?.text).toBe("I think it's breaking resistance");
  });

  it("captures interleaved messages sent between split long-response chunks", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "guild-channel-1",
      channelType: "discord",
      isGroup: true,
      defaultEngine: "agy",
    });

    // Turn 1: User 1 sends msg-300 requesting a long report
    session.lastContextMessageId = "msg-300";

    // Bot generates long output split into Chunk 1 and Chunk 2.
    // Someone in the channel sends msg-302 in the ~100ms window between Chunk 1 (msg-301) and Chunk 2 (msg-303)
    const history: HistoryMessage[] = [
      { id: "msg-300", ts: 1775580300, sender: "Alice", senderId: "u1", text: "@bot 请写一篇长研报" },
      { id: "msg-301", ts: 1775580302, sender: "PocketAgent", senderId: "bot", text: "(研报前半部分 Part 1)..." },
      { id: "msg-302", ts: 1775580303, sender: "Charlie", senderId: "u3", text: "插话：真的假的？" },
      { id: "msg-303", ts: 1775580304, sender: "PocketAgent", senderId: "bot", text: "(研报后半部分 Part 2)..." },
      { id: "msg-304", ts: 1775580310, sender: "Alice", senderId: "u1", text: "@bot 回复一下刚才Charlie的问题" },
    ];

    const currentMsgId = "msg-304";
    const triggerIdx = history.findIndex((m) => m.id === currentMsgId);
    const priorMessages = triggerIdx !== -1 ? history.slice(0, triggerIdx) : history.filter((m) => m.id !== currentMsgId);

    // Prior messages before msg-304: [msg-300, msg-301, msg-302, msg-303]
    expect(priorMessages.map((m) => m.id)).toEqual(["msg-300", "msg-301", "msg-302", "msg-303"]);

    // Locate cursor msg-300
    const cursorIdx = priorMessages.findIndex((m) => m.id === session.lastContextMessageId);
    expect(cursorIdx).toBe(0);

    const newMessages = priorMessages.slice(cursorIdx + 1);
    // Verified: exactly Chunk 1, Charlie's interleaved message, and Chunk 2
    expect(newMessages.map((m) => m.id)).toEqual(["msg-301", "msg-302", "msg-303"]);

    // Verify Charlie's message between chunks is preserved
    const charlieMsg = newMessages.find((m) => m.sender === "Charlie");
    expect(charlieMsg).toBeDefined();
    expect(charlieMsg?.text).toBe("插话：真的假的？");

    const hasOtherUserMessages = newMessages.some((m) => m.senderId !== "bot" && m.sender !== "PocketAgent");
    expect(hasOtherUserMessages).toBe(true);
  });
});

describe("buildGroupContext", () => {
  const msg = (id: string, sender: string, text: string, extra: Partial<HistoryMessage> = {}): HistoryMessage => ({
    id,
    ts: 1775580000 + Number(id.replace(/\D/g, "")),
    sender,
    senderId: sender === "Atri" ? "bot" : sender.toLowerCase(),
    text,
    ...extra,
  });
  const isOwn = (m: HistoryMessage) => m.senderId === "bot";
  const longReply = "图片重新给你发上去了。".repeat(60);

  it("shortens the bot's own earlier messages instead of repeating them", () => {
    const history = [
      msg("m1", "Bob", "Bull Flag呢"),
      msg("m2", "Atri", longReply, { replyToSender: "Bob", replyToText: "Bull Flag呢" }),
      msg("m3", "Bob", "说实话不明显"),
      msg("m4", "Bob", "把箭头换成美少女"),
    ];
    const block = buildGroupContext({ history, triggerId: "m4", lastCursor: "m1", isOwn });
    expect(block).toContain("### New Group Chat Messages (since last turn):");
    expect(block).toContain("Atri (you) (replying to Bob \"Bull Flag呢\"): ");
    expect(block).toContain("[your earlier message, shortened]");
    expect(block.length).toBeLessThan(longReply.length);
    expect(block).toContain("Bob: 说实话不明显");
    expect(block).not.toContain("把箭头换成美少女");
  });

  it("is empty when only the bot spoke since the last turn", () => {
    const history = [msg("m1", "Bob", "hi"), msg("m2", "Atri", longReply), msg("m3", "Bob", "next")];
    expect(buildGroupContext({ history, triggerId: "m3", lastCursor: "m1", isOwn })).toBe("");
  });

  it("gives recent context on a session's first turn, leaving out messages after the trigger", () => {
    const history = [msg("m1", "Alice", "早"), msg("m2", "Bob", "问题"), msg("m3", "Carol", "插话")];
    const block = buildGroupContext({ history, triggerId: "m2", isOwn });
    expect(block).toContain("### Recent Group Chat Context");
    expect(block).toContain("Alice: 早");
    expect(block).not.toContain("插话");
  });
});
