import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSystemPromptParts, getSourceCodeNote } from "../engines/prompt.js";
import { findPocketAgentRoot, readSnapshotInfo, syncSourceSnapshot } from "../source/snapshot.js";

describe("PocketAgent source copy for agents", () => {
  let dir: string;
  let checkout: string;
  let dataDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pa-src-"));
    checkout = join(dir, "checkout");
    dataDir = join(dir, "data");
    mkdirSync(join(checkout, "src", "engines"), { recursive: true });
    mkdirSync(join(checkout, "src", "__tests__"), { recursive: true });
    mkdirSync(join(checkout, "node_modules", "x"), { recursive: true });
    writeFileSync(join(checkout, "package.json"), JSON.stringify({ name: "pocketagent", version: "9.9.9" }));
    writeFileSync(join(checkout, "src", "index.ts"), "export {};\n");
    writeFileSync(join(checkout, "src", "engines", "prompt.ts"), "// prompt\n");
    writeFileSync(join(checkout, "node_modules", "x", "big.js"), "nope");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("finds the checkout this code runs from", () => {
    expect(findPocketAgentRoot()).toBeDefined();
    expect(findPocketAgentRoot(join(checkout, "src", "engines"))).toBe(checkout);
  });

  it("copies src/ and the build files, read-only, and only when the code changed", () => {
    const first = syncSourceSnapshot(dataDir, checkout);
    expect(first.status).toBe("created");
    const copied = join(dataDir, "source", "src", "engines", "prompt.ts");
    expect(readFileSync(copied, "utf-8")).toBe("// prompt\n");
    expect(statSync(copied).mode & 0o222).toBe(0);
    expect(existsSync(join(dataDir, "source", "package.json"))).toBe(true);
    expect(existsSync(join(dataDir, "source", "node_modules"))).toBe(false);
    expect(readSnapshotInfo(dataDir)).toMatchObject({ checkout, version: "9.9.9" });

    expect(syncSourceSnapshot(dataDir, checkout).status).toBe("unchanged");

    writeFileSync(join(checkout, "src", "engines", "prompt.ts"), "// prompt v2\n");
    expect(syncSourceSnapshot(dataDir, checkout).status).toBe("updated");
    expect(readFileSync(copied, "utf-8")).toBe("// prompt v2\n");
  });

  it("does nothing without a source tree", () => {
    expect(syncSourceSnapshot(dataDir, join(dir, "missing")).status).toBe("no-source");
  });

  it("points agents at the copy, with the checkout to change", () => {
    syncSourceSnapshot(dataDir, checkout);
    const note = getSourceCodeNote(dataDir, checkout)!;
    expect(note).toContain(`Its source code is at \`${join(dataDir, "source")}\``);
    expect(note).toContain(`copied`);
    expect(note).toContain(`from \`${checkout}\``);
    expect(note).toContain("Folders in `src/`: engines.");
    expect(note).toContain("read the code that implements it before you answer or act");
    expect(note).toContain(`in a git worktree of \`${checkout}\``);
  });

  it("falls back to the checkout before the first copy", () => {
    const note = getSourceCodeNote(dataDir, checkout)!;
    expect(note).toContain(`Its source code is at \`${checkout}\``);
    expect(getSourceCodeNote(dataDir, join(dir, "missing"))).toBeUndefined();
  });

  it("is part of every engine's system prompt", () => {
    syncSourceSnapshot(dataDir, checkout);
    const parts = buildSystemPromptParts({ agentsDir: join(dataDir, "agents"), botId: "b", apiPort: 1, chatId: "c", isGroup: false });
    expect(parts.find((p) => p.startsWith("## PocketAgent source code"))).toContain(join(dataDir, "source"));
  });
});
