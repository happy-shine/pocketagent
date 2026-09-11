import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineCapabilities, ModelInfo, EffortInfo } from "../types.js";

const execFileAsync = promisify(execFile);

let cachedCapabilities: EngineCapabilities | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface RawCodexModel {
  slug: string;
  display_name?: string;
  description?: string;
  default_reasoning_level?: string;
  supported_reasoning_levels?: Array<{
    effort: string;
    description?: string;
  }>;
}

const FALLBACK_CODEX_MODELS: ModelInfo[] = [
  { id: "gpt-6-astra", label: "GPT-6-Astra", isDefault: true },
  { id: "gpt-5.6-sol", label: "GPT-5.6-Sol" },
  { id: "gpt-5.6-terra", label: "GPT-5.6-Terra" },
  { id: "gpt-5.6-luna", label: "GPT-5.6-Luna" },
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-5.3-codex-spark", label: "GPT-5.3-Codex-Spark" },
];

const EFFORT_LABEL_MAP: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
  ultra: "Ultra",
};

export async function discoverCodexCapabilities(
  binary: string = "codex",
  customModels: ModelInfo[] = [],
  forceRefresh: boolean = false,
): Promise<EngineCapabilities> {
  const now = Date.now();
  if (!forceRefresh && cachedCapabilities && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedCapabilities;
  }

  let rawModels: RawCodexModel[] = [];

  // 1. Try running `codex debug models`
  try {
    const { stdout } = await execFileAsync(binary, ["debug", "models"], { timeout: 6000 });
    const data = JSON.parse(stdout);
    if (Array.isArray(data.models)) {
      rawModels = data.models;
    }
  } catch {
    // 2. Try reading from ~/.codex/models_cache.json
    try {
      const codexHome = process.env.CODEX_HOME || join(process.env.HOME || "", ".codex");
      const cachePath = join(codexHome, "models_cache.json");
      if (existsSync(cachePath)) {
        const fileData = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (Array.isArray(fileData.models)) {
          rawModels = fileData.models;
        }
      }
    } catch {}
  }

  const models: ModelInfo[] = [];
  const effortSet = new Set<string>();

  if (rawModels.length > 0) {
    for (let i = 0; i < rawModels.length; i++) {
      const m = rawModels[i];
      if (m.slug) {
        models.push({
          id: m.slug,
          label: m.display_name || m.slug,
          description: m.description,
          isDefault: i === 0,
        });
      }
      for (const r of m.supported_reasoning_levels ?? []) {
        if (r.effort) effortSet.add(r.effort);
      }
    }
  } else {
    models.push(...FALLBACK_CODEX_MODELS);
    ["low", "medium", "high", "xhigh"].forEach((e) => effortSet.add(e));
  }

  // Include custom models configured in config.yaml
  for (const cm of customModels) {
    if (!models.some((m) => m.id === cm.id)) {
      models.unshift(cm);
    }
  }

  const efforts: EffortInfo[] = Array.from(effortSet).map((eff) => ({
    id: eff,
    label: EFFORT_LABEL_MAP[eff.toLowerCase()] ?? eff,
  }));

  cachedCapabilities = {
    models,
    efforts: efforts.length > 0 ? efforts : [
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
    ],
    supportsEffort: true,
    supportsCustomModel: true,
  };
  lastFetchedAt = now;

  return cachedCapabilities;
}
