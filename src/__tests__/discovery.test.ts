import { describe, it, expect } from "vitest";
import { discoverAgyCapabilities } from "../engines/agy/discovery.js";
import { discoverClaudeCapabilities } from "../engines/claude/discovery.js";
import { discoverCodexCapabilities } from "../engines/codex/discovery.js";

describe("Engine Capabilities Discovery", () => {
  it("discovers Agy capabilities dynamically (or fallback)", async () => {
    const caps = await discoverAgyCapabilities("agy", [
      { id: "custom-gemini", label: "Custom Gemini" },
    ]);
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.efforts.length).toBe(3);
    expect(caps.supportsEffort).toBe(true);
    expect(caps.supportsCustomModel).toBe(true);
    // Custom model is merged
    expect(caps.models.some((m) => m.id === "custom-gemini")).toBe(true);
  });

  it("discovers Claude capabilities and merges custom models", async () => {
    const caps = await discoverClaudeCapabilities("claude", [
      { id: "claude-custom-x", label: "Claude Custom X" },
    ]);
    expect(caps.models.some((m) => m.id === "sonnet")).toBe(true);
    expect(caps.models.some((m) => m.id === "claude-custom-x")).toBe(true);
    expect(caps.efforts.map((e) => e.id)).toContain("high");
  });

  it("discovers Codex capabilities", async () => {
    const caps = await discoverCodexCapabilities("codex");
    expect(caps.models.some((m) => m.id.includes("gpt"))).toBe(true);
    expect(caps.efforts.some((e) => e.id === "high")).toBe(true);
  });
});
