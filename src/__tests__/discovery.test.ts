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

  it("discovers Claude capabilities dynamically, including modern models and custom models", async () => {
    const caps = await discoverClaudeCapabilities("claude", [
      { id: "claude-custom-x", label: "Claude Custom X" },
    ], true);
    expect(caps.models.some((m) => m.id === "sonnet")).toBe(true);
    expect(caps.models.some((m) => m.id === "opus")).toBe(true);
    expect(caps.models.some((m) => m.id === "fable")).toBe(true);
    expect(caps.models.some((m) => m.id === "haiku")).toBe(true);
    expect(caps.models.some((m) => m.id === "claude-custom-x")).toBe(true);
    // Should NOT contain obsolete 3.5/3.7 models
    expect(caps.models.some((m) => m.id === "claude-3-7-sonnet")).toBe(false);
    expect(caps.models.some((m) => m.id === "claude-3-5-sonnet")).toBe(false);
    expect(caps.models.some((m) => m.id === "claude-3-5-haiku")).toBe(false);
    expect(caps.efforts.map((e) => e.id)).toContain("xhigh");
    expect(caps.efforts.map((e) => e.id)).toContain("max");
  });

  it("discovers Codex capabilities dynamically including live models", async () => {
    const caps = await discoverCodexCapabilities("codex", [], true);
    expect(caps.models.length).toBeGreaterThan(0);
    // Real models include gpt-6-astra or gpt-5.x
    expect(caps.models.some((m) => m.id === "gpt-6-astra" || m.id.includes("gpt"))).toBe(true);
    expect(caps.efforts.some((e) => e.id === "high")).toBe(true);
  });
});
