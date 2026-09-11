import { describe, it, expect } from "vitest";
import { buildContextHandoverPrimer, getDeltaTurnsForEngine } from "../sessions/handover.js";
import type { Session } from "../sessions/types.js";

describe("Context Handover & Sharing", () => {
  it("generates structured handover primer when switching from Claude to Agy", () => {
    const session: Session = {
      sessionId: "s-1",
      chatId: "123",
      channelType: "telegram",
      activeEngine: "agy",
      lastEngine: "claude",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: 1,
      turns: [
        { id: "1", ts: 1000, role: "user", text: "Create an auth module in src/auth.ts", author: "Alice" },
        { id: "2", ts: 2000, role: "assistant", engine: "claude", text: "Created src/auth.ts with JWT validation." },
      ],
    };

    const primer = buildContextHandoverPrimer(session, "agy", "/workspace/dir");
    expect(primer).not.toBeNull();
    expect(primer).toContain("[Context Handover Notice]");
    expect(primer).toContain("previously ran on claude");
    expect(primer).toContain("switched the active engine to agy");
    expect(primer).toContain("User (Alice)");
    expect(primer).toContain("Create an auth module in src/auth.ts");
    expect(primer).toContain("Assistant (claude)");
    expect(primer).toContain("Created src/auth.ts with JWT validation.");
  });

  it("calculates delta turns when round-tripping back to previous engine", () => {
    const session: Session = {
      sessionId: "s-2",
      chatId: "123",
      channelType: "telegram",
      activeEngine: "claude",
      lastEngine: "agy",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isActive: true,
      sessionNum: 1,
      turns: [
        { id: "1", ts: 1000, role: "user", text: "Initial question" },
        { id: "2", ts: 2000, role: "assistant", engine: "claude", text: "Claude response 1" },
        // Switched to Agy for a turn:
        { id: "3", ts: 3000, role: "user", text: "Now refactor it using agy" },
        { id: "4", ts: 4000, role: "assistant", engine: "agy", text: "Agy refactored the module" },
      ],
    };

    const deltas = getDeltaTurnsForEngine(session, "claude");
    expect(deltas.length).toBe(2);
    expect(deltas[0].text).toBe("Now refactor it using agy");
    expect(deltas[1].text).toBe("Agy refactored the module");
  });
});
