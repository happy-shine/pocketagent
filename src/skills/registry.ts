import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  lstatSync,
  symlinkSync,
  rmSync,
  cpSync,
  readlinkSync,
  renameSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join, basename, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { parse as parseYaml } from "yaml";

function samePath(a: string, b: string): boolean {
  return process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
}

export interface SkillInfo {
  name: string;
  description: string;
  dir: string;
  skillMdPath: string;
  scripts: string[];
  synced: {
    agy: boolean;
    claude: boolean;
    codex: boolean;
    grok: boolean;
  };
}

export interface SkillRegistryOptions {
  hubDir?: string;
  agySkillsDir?: string;
  claudeSkillsDir?: string;
  codexSkillsDir?: string;
  grokSkillsDir?: string;
}

export class SkillRegistry {
  private static instance?: SkillRegistry;

  readonly hubDir: string;
  readonly agySkillsDir: string;
  readonly claudeSkillsDir: string;
  readonly codexSkillsDir: string;
  readonly grokSkillsDir: string;

  constructor(opts?: SkillRegistryOptions) {
    const home = homedir();
    this.hubDir = opts?.hubDir ?? join(process.env.POCKETAGENT_HOME ?? join(home, ".pocketagent"), "skills");
    this.agySkillsDir = opts?.agySkillsDir ?? join(home, ".gemini", "config", "skills");
    this.claudeSkillsDir = opts?.claudeSkillsDir ?? join(home, ".claude", "skills");
    this.codexSkillsDir = opts?.codexSkillsDir ?? join(home, ".codex", "skills");
    this.grokSkillsDir = opts?.grokSkillsDir ?? join(process.env.GROK_HOME || join(home, ".grok"), "skills");
  }

  static getInstance(opts?: SkillRegistryOptions): SkillRegistry {
    if (!SkillRegistry.instance || opts) {
      SkillRegistry.instance = new SkillRegistry(opts);
    }
    return SkillRegistry.instance;
  }

  /**
   * Parse YAML frontmatter metadata from SKILL.md
   */
  parseSkillMd(skillMdPath: string): { name: string; description: string } {
    try {
      const content = readFileSync(skillMdPath, "utf-8");
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const parsed = parseYaml(fmMatch[1]);
        if (parsed && typeof parsed === "object") {
          return {
            name: String(parsed.name || basename(dirname(skillMdPath))),
            description: String(parsed.description || "").trim(),
          };
        }
      }
    } catch {}
    return {
      name: basename(dirname(skillMdPath)),
      description: "",
    };
  }

  /**
   * Consolidate skills from all 4 CLI directories into Hub,
   * and ensure symlinks are created in all CLI directories.
   */
  sync(): SkillInfo[] {
    mkdirSync(this.hubDir, { recursive: true });
    mkdirSync(this.agySkillsDir, { recursive: true });
    mkdirSync(this.claudeSkillsDir, { recursive: true });
    mkdirSync(this.codexSkillsDir, { recursive: true });
    mkdirSync(this.grokSkillsDir, { recursive: true });

    const cliDirs = [
      { type: "claude" as const, dir: this.claudeSkillsDir },
      { type: "agy" as const, dir: this.agySkillsDir },
      { type: "codex" as const, dir: this.codexSkillsDir },
      { type: "grok" as const, dir: this.grokSkillsDir },
    ];

    // 1. Ingest real skill directories or external symlinks from CLI folders into Hub if missing
    for (const { dir } of cliDirs) {
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
          if (entry.name.startsWith(".")) continue;

          const srcSkillDir = join(dir, entry.name);
          const hubSkillDir = join(this.hubDir, entry.name);
          const hasSkillMd = existsSync(join(srcSkillDir, "SKILL.md"));
          if (!hasSkillMd) continue;

          try {
            const stat = lstatSync(srcSkillDir);
            let isTargetingHub = false;
            if (stat.isSymbolicLink()) {
              const currentTarget = resolve(dir, readlinkSync(srcSkillDir));
              isTargetingHub = samePath(currentTarget, hubSkillDir);
            }

            if (!isTargetingHub) {
              // Keep an independent same-name skill intact instead of overwriting it.
              if (existsSync(hubSkillDir)) continue;
              cpSync(srcSkillDir, hubSkillDir, { recursive: true, dereference: true });
              this.linkSkill(hubSkillDir, srcSkillDir);
            }
          } catch {
            // Ignore single skill sync error
          }
        }
      } catch {
        // Ignore folder read error
      }
    }

    // 2. Ensure all skills in hubDir are symlinked into all 4 CLI directories
    if (existsSync(this.hubDir)) {
      const hubEntries = readdirSync(this.hubDir, { withFileTypes: true });
      for (const entry of hubEntries) {
        if (entry.name.startsWith(".")) continue;
        const hubSkillDir = join(this.hubDir, entry.name);
        if (!existsSync(join(hubSkillDir, "SKILL.md"))) continue;

        for (const { dir } of cliDirs) {
          const targetLink = join(dir, entry.name);
          try {
            const stat = lstatSync(targetLink, { throwIfNoEntry: false });
            if (stat) {
              if (stat.isSymbolicLink()) {
                const existingTarget = resolve(dir, readlinkSync(targetLink));
                if (samePath(existingTarget, hubSkillDir)) {
                  continue;
                }
                if (existsSync(targetLink)) continue;
                rmSync(targetLink, { force: true });
              } else {
                // It may contain local edits that differ from the Hub.
                continue;
              }
            }
            symlinkSync(resolve(hubSkillDir), targetLink, process.platform === "win32" ? "junction" : "dir");
          } catch {
            // Ignore symlink failure
          }
        }
      }
    }

    // 3. Clean up dangling symlinks in CLI dirs that point to non-existent skills
    for (const { dir } of cliDirs) {
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          const targetLink = join(dir, entry.name);
          try {
            const stat = lstatSync(targetLink);
            if (stat.isSymbolicLink()) {
              const resolvedTarget = resolve(dir, readlinkSync(targetLink));
              if (!existsSync(resolvedTarget)) {
                rmSync(targetLink, { force: true });
              }
            }
          } catch {}
        }
      } catch {}
    }

    return this.list();
  }

  private linkSkill(hubSkillDir: string, source: string): void {
    const temporary = join(dirname(source), `.pa-link-${randomUUID()}`);
    const backup = join(dirname(source), `.pa-backup-${randomUUID()}`);
    // Establish a usable link before touching the original. Junctions need no admin privileges.
    symlinkSync(resolve(hubSkillDir), temporary, process.platform === "win32" ? "junction" : "dir");
    try {
      renameSync(source, backup);
      try { renameSync(temporary, source); }
      catch (error) { renameSync(backup, source); throw error; }
      rmSync(backup, { recursive: true, force: true });
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }

  /**
   * List all skills in hubDir and their sync status across CLIs.
   */
  list(): SkillInfo[] {
    if (!existsSync(this.hubDir)) return [];

    const skills: SkillInfo[] = [];
    let entries;
    try {
      entries = readdirSync(this.hubDir, { withFileTypes: true });
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const skillDir = join(this.hubDir, entry.name);
      const skillMdPath = join(skillDir, "SKILL.md");
      if (!existsSync(skillMdPath)) continue;

      const meta = this.parseSkillMd(skillMdPath);

      // Find scripts in scripts/
      const scripts: string[] = [];
      const scriptsDir = join(skillDir, "scripts");
      if (existsSync(scriptsDir)) {
        try {
          const scriptEntries = readdirSync(scriptsDir, { withFileTypes: true });
          for (const se of scriptEntries) {
            if (!se.name.startsWith(".")) scripts.push(se.name);
          }
        } catch {}
      }

      const checkSynced = (cliDir: string) => {
        const target = join(cliDir, entry.name);
        try {
          if (!lstatSync(target).isSymbolicLink()) return false;
          const linkTarget = resolve(cliDir, readlinkSync(target));
          const canonical = resolve(skillDir);
          return samePath(linkTarget, canonical);
        } catch { return false; }
      };

      skills.push({
        name: meta.name || entry.name,
        description: meta.description,
        dir: skillDir,
        skillMdPath,
        scripts,
        synced: {
          agy: checkSynced(this.agySkillsDir),
          claude: checkSynced(this.claudeSkillsDir),
          codex: checkSynced(this.codexSkillsDir),
          grok: checkSynced(this.grokSkillsDir),
        },
      });
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Generate markdown prompt catalog describing all available skills
   */
  generateSkillsPrompt(): string {
    const skills = this.list();
    if (skills.length === 0) return "";

    const lines: string[] = [
      "## Available Custom Skills",
      "",
      "The following custom skills are installed and available. When a user request matches a skill's description, read its `SKILL.md` instructions using your file viewing tool and execute its helper scripts or commands:",
      "",
    ];

    for (const skill of skills) {
      lines.push(`- **${skill.name}** (\`${pathToFileURL(skill.skillMdPath).href}\`):`);
      if (skill.description) {
        lines.push(`  ${skill.description}`);
      }
      if (skill.scripts.length > 0) {
        lines.push(`  *Scripts*: ${skill.scripts.map((s) => `\`${join(skill.dir, "scripts", s)}\``).join(", ")}`);
      }
      lines.push("");
    }

    return lines.join("\n").trim();
  }

  /**
   * Create a new skill in hub and immediately sync to all CLIs
   */
  createSkill(name: string, description: string, opts?: { scriptName?: string; scriptContent?: string }): SkillInfo {
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const skillDir = join(this.hubDir, safeName);
    mkdirSync(skillDir, { recursive: true });

    const scriptsDir = join(skillDir, "scripts");
    mkdirSync(scriptsDir, { recursive: true });

    const scriptName = opts?.scriptName ?? "run.py";
    const scriptPath = join(scriptsDir, scriptName);
    const defaultScriptContent =
      opts?.scriptContent ??
      `#!/usr/bin/env python3
import sys

def main():
    print(f"Executing skill: {safeName}")

if __name__ == "__main__":
    main()
`;
    writeFileSync(scriptPath, defaultScriptContent);

    const desc = description.trim() || `Custom skill: ${safeName}`;
    const skillMdContent = `---
name: ${safeName}
description: ${desc}
---

# ${safeName}

${desc}

## Usage

\`\`\`${process.platform === "win32" ? "powershell" : "bash"}
${process.platform === "win32" ? "python" : "python3"} "${scriptPath}" [options]
\`\`\`
`;
    writeFileSync(join(skillDir, "SKILL.md"), skillMdContent);

    this.sync();
    const skills = this.list();
    const created = skills.find((s) => s.name === safeName);
    if (!created) {
      throw new Error(`Failed to create skill ${safeName}`);
    }
    return created;
  }

  /**
   * Get skill details including SKILL.md raw content and list of files
   */
  getSkill(name: string): {
    skill: SkillInfo;
    skillMd: string;
    files: Array<{ name: string; relPath: string; isDir: boolean; size: number }>;
  } | null {
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const skills = this.list();
    const skill = skills.find((s) => s.name === safeName || s.name === name || basename(s.dir) === safeName);
    if (!skill) return null;

    const skillMdPath = join(skill.dir, "SKILL.md");
    const skillMd = existsSync(skillMdPath) ? readFileSync(skillMdPath, "utf-8") : "";

    const files: Array<{ name: string; relPath: string; isDir: boolean; size: number }> = [];
    const scanDir = (dir: string, baseRel = "") => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue;
          const fullPath = join(dir, entry.name);
          const relPath = baseRel ? `${baseRel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            files.push({ name: entry.name, relPath, isDir: true, size: 0 });
            scanDir(fullPath, relPath);
          } else {
            const stat = lstatSync(fullPath);
            files.push({ name: entry.name, relPath, isDir: false, size: stat.size });
          }
        }
      } catch {}
    };
    scanDir(skill.dir);

    return { skill, skillMd, files };
  }

  /**
   * Update SKILL.md content of a skill and re-sync across CLIs
   */
  updateSkill(name: string, skillMd: string): SkillInfo {
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const skillDir = join(this.hubDir, safeName);
    if (!existsSync(skillDir)) {
      throw new Error(`Skill "${name}" not found in hub`);
    }

    const skillMdPath = join(skillDir, "SKILL.md");
    writeFileSync(skillMdPath, skillMd, "utf-8");

    this.sync();
    const updated = this.list().find((s) => s.name === safeName || basename(s.dir) === safeName);
    if (!updated) {
      throw new Error(`Failed to update skill "${name}"`);
    }
    return updated;
  }

  /**
   * Permanently delete a skill from Hub and remove symlinks across all 4 CLIs
   */
  deleteSkill(name: string): boolean {
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const hubSkillDir = join(this.hubDir, safeName);
    if (!existsSync(hubSkillDir)) {
      return false;
    }

    // 1. Remove Hub canonical directory
    rmSync(hubSkillDir, { recursive: true, force: true });

    // 2. Remove symlinks in all 4 CLIs
    const cliDirs = [this.claudeSkillsDir, this.agySkillsDir, this.codexSkillsDir, this.grokSkillsDir];
    for (const dir of cliDirs) {
      const target = join(dir, safeName);
      try {
        if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()
          && samePath(resolve(dir, readlinkSync(target)), hubSkillDir)) {
          rmSync(target, { recursive: true, force: true });
        }
      } catch {}
    }

    return true;
  }
}
