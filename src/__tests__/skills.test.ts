import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillRegistry } from "../skills/registry.js";

describe("SkillRegistry 3-CLI interoperability", () => {
  let testDir: string;
  let hubDir: string;
  let agyDir: string;
  let claudeDir: string;
  let codexDir: string;
  let registry: SkillRegistry;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "pa-skills-test-"));
    hubDir = join(testDir, "hub");
    agyDir = join(testDir, "agy");
    claudeDir = join(testDir, "claude");
    codexDir = join(testDir, "codex");

    mkdirSync(hubDir, { recursive: true });
    mkdirSync(agyDir, { recursive: true });
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(codexDir, { recursive: true });

    registry = new SkillRegistry({
      hubDir,
      agySkillsDir: agyDir,
      claudeSkillsDir: claudeDir,
      codexSkillsDir: codexDir,
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("parses YAML frontmatter from SKILL.md", () => {
    const skillPath = join(hubDir, "sample-skill");
    mkdirSync(skillPath, { recursive: true });
    const skillMd = join(skillPath, "SKILL.md");
    writeFileSync(
      skillMd,
      `---
name: sample-skill
description: Useful for sample testing
---
# Sample
Instructions here.`,
    );

    const meta = registry.parseSkillMd(skillMd);
    expect(meta.name).toBe("sample-skill");
    expect(meta.description).toBe("Useful for sample testing");
  });

  it("ingests existing skills from CLI dirs into Hub and establishes 3-way symlinks", () => {
    // Put a skill in claudeDir only
    const claudeSkill = join(claudeDir, "chat-query");
    mkdirSync(join(claudeSkill, "scripts"), { recursive: true });
    writeFileSync(
      join(claudeSkill, "SKILL.md"),
      `---
name: chat-query
description: Query group chats
---
# Chat Query`,
    );
    writeFileSync(join(claudeSkill, "scripts", "query.py"), "#!/usr/bin/env python3\nprint('ok')");

    // Run sync
    const synced = registry.sync();
    expect(synced.length).toBe(1);
    expect(synced[0].name).toBe("chat-query");

    // Canonical Hub should now exist
    const hubSkill = join(hubDir, "chat-query");
    expect(existsSync(join(hubSkill, "SKILL.md"))).toBe(true);
    expect(existsSync(join(hubSkill, "scripts", "query.py"))).toBe(true);

    // All 3 CLI dirs should have valid symlinks pointing to Hub
    expect(lstatSync(join(claudeDir, "chat-query")).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(agyDir, "chat-query")).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(codexDir, "chat-query")).isSymbolicLink()).toBe(true);

    expect(synced[0].synced.claude).toBe(true);
    expect(synced[0].synced.agy).toBe(true);
    expect(synced[0].synced.codex).toBe(true);
  });

  it("generates markdown catalog prompt for system prompt injection", () => {
    registry.createSkill("risk-calc", "Calculates portfolio risk");

    const prompt = registry.generateSkillsPrompt();
    expect(prompt).toContain("## Available Custom Skills");
    expect(prompt).toContain("**risk-calc**");
    expect(prompt).toContain("Calculates portfolio risk");
    expect(prompt).toContain("file://");
    expect(prompt).toContain("run.py");
  });

  it("creates a new skill and immediately synchronizes across all 3 CLIs", () => {
    const created = registry.createSkill("market-fetcher", "Fetches market data");
    expect(created.name).toBe("market-fetcher");
    expect(existsSync(join(hubDir, "market-fetcher", "SKILL.md"))).toBe(true);

    expect(existsSync(join(agyDir, "market-fetcher", "SKILL.md"))).toBe(true);
    expect(existsSync(join(claudeDir, "market-fetcher", "SKILL.md"))).toBe(true);
    expect(existsSync(join(codexDir, "market-fetcher", "SKILL.md"))).toBe(true);
  });

  it("retrieves skill details, raw SKILL.md, and file list", () => {
    registry.createSkill("crypto-tracker", "Tracks crypto prices");
    const detail = registry.getSkill("crypto-tracker");
    expect(detail).toBeDefined();
    expect(detail?.skill.name).toBe("crypto-tracker");
    expect(detail?.skillMd).toContain("name: crypto-tracker");
    expect(detail?.files.some((f) => f.name === "SKILL.md")).toBe(true);
    expect(detail?.files.some((f) => f.name === "run.py")).toBe(true);
  });

  it("updates SKILL.md content and re-syncs", () => {
    registry.createSkill("report-gen", "Generates daily reports");
    const updatedMd = `---
name: report-gen
description: Advanced report generation engine
---
# Advanced Reports
Updated instructions here.
`;
    const updated = registry.updateSkill("report-gen", updatedMd);
    expect(updated.description).toBe("Advanced report generation engine");

    const detail = registry.getSkill("report-gen");
    expect(detail?.skillMd).toBe(updatedMd);
  });

  it("deletes skill permanently and unlinks from all 3 CLIs", () => {
    registry.createSkill("temp-skill", "Temporary skill to delete");
    expect(existsSync(join(hubDir, "temp-skill"))).toBe(true);
    expect(existsSync(join(claudeDir, "temp-skill"))).toBe(true);
    expect(existsSync(join(agyDir, "temp-skill"))).toBe(true);
    expect(existsSync(join(codexDir, "temp-skill"))).toBe(true);

    const ok = registry.deleteSkill("temp-skill");
    expect(ok).toBe(true);

    expect(existsSync(join(hubDir, "temp-skill"))).toBe(false);
    expect(existsSync(join(claudeDir, "temp-skill"))).toBe(false);
    expect(existsSync(join(agyDir, "temp-skill"))).toBe(false);
    expect(existsSync(join(codexDir, "temp-skill"))).toBe(false);
    expect(registry.getSkill("temp-skill")).toBeNull();
  });
});
