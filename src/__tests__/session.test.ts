import { describe, it, expect } from "vitest";
import { SessionManager } from "../sessions/manager.js";

describe("SessionManager Multi-Engine Functionality", () => {
  it("resolves and tracks multi-engine session states", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "12345",
      channelType: "telegram",
      defaultEngine: "claude",
      defaultModel: "sonnet",
      defaultEffort: "high",
    });

    expect(session.activeEngine).toBe("claude");
    expect(session.model).toBe("sonnet");
    expect(session.effort).toBe("high");
    expect(session.turns).toEqual([]);

    // Add user turn
    sm.addTurn(session.sessionId, { role: "user", text: "Hello AI", author: "User1" });
    expect(session.turns.length).toBe(1);

    // Switch engine to agy
    const switched = sm.setEngine(session.sessionId, "agy");
    expect(switched).toBe(true);
    expect(session.activeEngine).toBe("agy");
    expect(session.lastEngine).toBe("claude");

    // Change model
    sm.setModel(session.sessionId, "gemini-3.8-flash-high");
    expect(session.model).toBe("gemini-3.8-flash-high");

    // Change effort
    sm.setEffort(session.sessionId, "medium");
    expect(session.effort).toBe("medium");

    // Add assistant turn on agy
    sm.addTurn(session.sessionId, { role: "assistant", text: "Hello from Agy!", engine: "agy" });
    expect(session.turns.length).toBe(2);
    expect(session.turns[1].engine).toBe("agy");
  });

  it("creates new sessions with specified engine and defaults", () => {
    const sm = new SessionManager();
    sm.resolve({ chatId: "user1", channelType: "telegram", defaultEngine: "claude" });

    const session2 = sm.createNew("user1", "codex", "gpt-5.4", "low");
    expect(session2.sessionNum).toBe(2);
    expect(session2.activeEngine).toBe("codex");
    expect(session2.model).toBe("gpt-5.4");
    expect(session2.effort).toBe("low");
  });

  it("inherits active session engine and settings when creating new session without overrides", () => {
    const sm = new SessionManager();
    const session1 = sm.resolve({ chatId: "user2", channelType: "telegram", defaultEngine: "agy" });
    expect(session1.activeEngine).toBe("agy");

    // User switches engine to claude
    sm.setEngine(session1.sessionId, "claude");
    sm.setModel(session1.sessionId, "claude-3-7-sonnet");
    sm.setEffort(session1.sessionId, "high");

    // User creates new session without overrides
    const session2 = sm.createNew("user2");
    expect(session2.sessionNum).toBe(2);
    expect(session2.activeEngine).toBe("claude");
    expect(session2.model).toBe("claude-3-7-sonnet");
    expect(session2.effort).toBe("high");
  });

  it("isolates models and efforts per engine when switching engines", () => {
    const sm = new SessionManager();
    const session = sm.resolve({
      chatId: "user3",
      channelType: "telegram",
      defaultEngine: "agy",
      defaultModel: "gemini-3.8-flash-high",
      defaultEffort: "high",
    });

    expect(session.activeEngine).toBe("agy");
    expect(session.model).toBe("gemini-3.8-flash-high");

    // Switch engine to codex
    sm.setEngine(session.sessionId, "codex");
    expect(session.activeEngine).toBe("codex");
    // Should NOT leak gemini model to codex!
    expect(session.model).toBeUndefined();

    // Set model for codex
    sm.setModel(session.sessionId, "gpt-5.5");
    expect(session.model).toBe("gpt-5.5");

    // Switch back to agy
    sm.setEngine(session.sessionId, "agy");
    expect(session.activeEngine).toBe("agy");
    expect(session.model).toBe("gemini-3.8-flash-high");

    // Switch back to codex
    sm.setEngine(session.sessionId, "codex");
    expect(session.activeEngine).toBe("codex");
    expect(session.model).toBe("gpt-5.5");
  });

  it("supports getAllChats, switchSessionById, and deleteSession", () => {
    const sm = new SessionManager();
    const s1 = sm.resolve({ chatId: "chat-xyz", channelType: "telegram", defaultEngine: "claude" });
    const s2 = sm.createNew("chat-xyz", "codex");

    expect(s2.isActive).toBe(true);
    expect(s1.isActive).toBe(false);

    // getAllChats
    const allChats = sm.getAllChats();
    expect(allChats.length).toBe(1);
    expect(allChats[0].chatId).toBe("chat-xyz");
    expect(allChats[0].sessions.length).toBe(2);

    // switchSessionById
    const switched = sm.switchSessionById("chat-xyz", s1.sessionId);
    expect(switched).toBeDefined();
    expect(switched?.sessionId).toBe(s1.sessionId);
    expect(s1.isActive).toBe(true);
    expect(s2.isActive).toBe(false);

    // deleteSession
    const deleted = sm.deleteSession("chat-xyz", s2.sessionId);
    expect(deleted).toBe(true);
    expect(sm.getAllChats()[0].sessions.length).toBe(1);

    // cannot delete non-existent session
    expect(sm.deleteSession("chat-xyz", "non-existent")).toBe(false);
  });
});
