import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A read-only copy of PocketAgent's source in the data directory (<dataDir>/source), so agents can read how the
 * gateway they run in actually works. Installing or updating PocketAgent always ends in a gateway start, so the copy
 * is refreshed at start whenever the code changed.
 */

const SNAPSHOT_DIR = "source";
const INFO_FILE = "SNAPSHOT.json";
// Besides src/, the files that explain how PocketAgent is built and configured
const EXTRA_FILES = ["package.json", "tsconfig.json", "README.md", "README_zh.md", "config.example.yaml"];

export interface SnapshotInfo {
  fingerprint: string;
  checkout: string;
  commit?: string;
  version?: string;
  takenAt: string;
}

// The PocketAgent checkout this code runs from: the nearest package.json named "pocketagent" above this file
export function findPocketAgentRoot(start = dirname(fileURLToPath(import.meta.url))): string | undefined {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as { name?: string };
      if (pkg.name === "pocketagent") return dir;
    } catch {
      // not here, keep going up
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function snapshotDir(dataDir: string): string {
  return join(dataDir, SNAPSHOT_DIR);
}

export function readSnapshotInfo(dataDir: string): SnapshotInfo | undefined {
  try {
    return JSON.parse(readFileSync(join(snapshotDir(dataDir), INFO_FILE), "utf-8")) as SnapshotInfo;
  } catch {
    return undefined;
  }
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      if (name.startsWith(".") || name === "node_modules") continue;
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

function sourceFiles(root: string): string[] {
  return [
    ...listFiles(join(root, "src")),
    ...EXTRA_FILES.map((f) => join(root, f)).filter((f) => existsSync(f)),
  ];
}

function fingerprint(root: string, files: string[]): string {
  const h = createHash("sha256");
  for (const f of files) {
    h.update(relative(root, f));
    h.update("\0");
    h.update(readFileSync(f));
    h.update("\0");
  }
  return h.digest("hex");
}

function gitCommit(root: string): string | undefined {
  try {
    const head = readFileSync(join(root, ".git", "HEAD"), "utf-8").trim();
    if (!head.startsWith("ref:")) return head;
    const ref = head.slice(4).trim();
    const loose = join(root, ".git", ref);
    if (existsSync(loose)) return readFileSync(loose, "utf-8").trim();
    const packed = readFileSync(join(root, ".git", "packed-refs"), "utf-8");
    return packed.split("\n").find((l) => l.endsWith(` ${ref}`))?.split(" ")[0];
  } catch {
    return undefined; // a worktree (.git is a file) or no git at all; the commit is only informational
  }
}

/**
 * Copies the checkout's src/ and build files to <dataDir>/source when they differ from the last copy.
 * Returns what happened; never throws, since a missing copy must not stop the gateway.
 */
export function syncSourceSnapshot(
  dataDir: string,
  root = findPocketAgentRoot(),
): { status: "created" | "updated" | "unchanged" | "no-source"; info?: SnapshotInfo; error?: string } {
  try {
    if (!root || !existsSync(join(root, "src"))) return { status: "no-source" };
    const files = sourceFiles(root);
    const fp = fingerprint(root, files);
    const previous = readSnapshotInfo(dataDir);
    if (previous?.fingerprint === fp && existsSync(join(snapshotDir(dataDir), "src"))) {
      return { status: "unchanged", info: previous };
    }

    let version: string | undefined;
    try {
      version = (JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { version?: string }).version;
    } catch {
      // optional
    }
    const info: SnapshotInfo = { fingerprint: fp, checkout: root, commit: gitCommit(root), version, takenAt: new Date().toISOString() };

    // Build the new copy next to the old one, then swap, so agents never read a half-written tree
    const target = snapshotDir(dataDir);
    const staging = `${target}.tmp-${process.pid}`;
    rmSync(staging, { recursive: true, force: true });
    for (const f of files) {
      const dest = join(staging, relative(root, f));
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(f, dest);
      chmodSync(dest, 0o444); // a reference copy: edits belong in the checkout
    }
    writeFileSync(join(staging, INFO_FILE), JSON.stringify(info, null, 2) + "\n");
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
    return { status: previous ? "updated" : "created", info };
  } catch (err) {
    return { status: "no-source", error: err instanceof Error ? err.message : String(err) };
  }
}
