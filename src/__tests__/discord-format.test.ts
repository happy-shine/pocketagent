import { describe, expect, it } from "vitest";
import { formatForDiscord, splitDiscordText } from "../channels/discord/formatter.js";
import { buildSystemPromptParts } from "../engines/prompt.js";

describe("formatForDiscord", () => {
  it("turns Markdown tables into lists", () => {
    const md = ["Results:", "| 标的 | 方向 | 结果 |", "|---|:---:|---|", "| **ES** | 做多 | 已达标 |", "| QQQ Put | 对冲 | |", "", "Done"].join("\n");
    expect(formatForDiscord(md)).toBe(
      ["Results:", "- **ES** · 方向: 做多 · 结果: 已达标", "- **QQQ Put** · 方向: 对冲", "", "Done"].join("\n"),
    );
  });

  it("rewrites deep headings and horizontal rules but keeps supported syntax", () => {
    const md = ["### Section", "#### Detail", "text", "", "---", "", "-# 2026-10-03 美东", "***", "> quote"].join("\n");
    expect(formatForDiscord(md)).toBe(["### Section", "**Detail**", "text", "", "-# 2026-10-03 美东", "", "> quote"].join("\n"));
  });

  it("leaves code blocks untouched", () => {
    const md = ["```", "| a | b |", "|---|---|", "#### not a heading", "---", "```"].join("\n");
    expect(formatForDiscord(md)).toBe(md);
  });
});

describe("splitDiscordText", () => {
  it("returns short text unchanged", () => {
    expect(splitDiscordText("hello")).toEqual(["hello"]);
  });

  it("splits at line breaks under the limit", () => {
    const text = Array.from({ length: 40 }, (_, i) => `line ${i} ${"x".repeat(80)}`).join("\n");
    const chunks = splitDiscordText(text, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
    expect(chunks.join("\n")).toBe(text);
  });

  it("closes and reopens a code block cut by a split", () => {
    const code = Array.from({ length: 30 }, (_, i) => `    print(${i})  # ${"y".repeat(40)}`).join("\n");
    const text = `Intro\n\`\`\`python\n${code}\n\`\`\`\nOutro`;
    const chunks = splitDiscordText(text, 800);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect((c.match(/```/g) ?? []).length % 2).toBe(0);
      expect(c.length).toBeLessThanOrEqual(820);
    }
    expect(chunks[1].startsWith("```python\n    print(")).toBe(true);
    expect(chunks.at(-1)!.endsWith("```\nOutro")).toBe(true);
  });
});

describe("system prompt formatting guidance", () => {
  const base = { agentsDir: "/nonexistent", botId: "b", apiPort: 1, chatId: "c", isGroup: false };

  it("gives Discord sessions Discord Markdown guidance", () => {
    const prompt = buildSystemPromptParts({ ...base, channelType: "discord" }).join("\n");
    expect(prompt).toContain("Output Formatting (Discord Markdown)");
    expect(prompt).toContain("-# text");
    expect(prompt).not.toContain("parse_mode=HTML");
    expect(prompt).not.toContain("Telegram buttons");
  });

  it("gives Telegram sessions Telegram HTML guidance", () => {
    const prompt = buildSystemPromptParts({ ...base, channelType: "telegram" }).join("\n");
    expect(prompt).toContain("parse_mode=HTML");
    expect(prompt).not.toContain("Discord Markdown");
  });
});
