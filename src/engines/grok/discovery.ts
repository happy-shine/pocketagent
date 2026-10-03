import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineCapabilities, ModelInfo, EffortInfo } from "../types.js";

const execFileAsync = promisify(execFile);

let cachedCapabilities: EngineCapabilities | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface RawGrokEffort {
  id?: string;
  value?: string;
  label?: string;
  default?: boolean;
}

interface RawGrokModelInfo {
  id?: string;
  name?: string;
  description?: string;
  hidden?: boolean;
  reasoning_effort?: string;
  supports_reasoning_effort?: boolean;
  reasoning_efforts?: RawGrokEffort[];
}

const EFFORT_LABEL_MAP: Record<string, string> = {
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
};

const DEFAULT_GROK_EFFORTS: EffortInfo[] = ["low", "medium", "high", "xhigh"].map((e) => ({
  id: e,
  label: EFFORT_LABEL_MAP[e],
  isDefault: e === "high",
}));

const FALLBACK_GROK_MODELS: ModelInfo[] = [
  {
    id: "grok-4.7",
    label: "Grok 4.7",
    description: "xAI's latest frontier model",
    isDefault: true,
    defaultEffort: "high",
    supportedEfforts: DEFAULT_GROK_EFFORTS,
  },
];

/**
 * Parse the plain-text output of `grok models`:
 *
 *   Default model: grok-4.7
 *
 *   Available models:
 *     * grok-4.7 (default)
 *       my-custom-model
 */
export function parseGrokModelsOutput(stdout: string): { defaultModel?: string; ids: string[] } {
  let defaultModel: string | undefined;
  const ids: string[] = [];
  let inList = false;

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    const defMatch = line.match(/^Default model:\s*(\S+)/i);
    if (defMatch) {
      defaultModel = defMatch[1];
      continue;
    }
    if (/^Available models:/i.test(line)) {
      inList = true;
      continue;
    }
    if (!inList || !line) continue;

    const match = line.match(/^\*?\s*(\S+)(\s+\(default\))?$/);
    if (match) {
      ids.push(match[1]);
      if (match[2]) defaultModel ??= match[1];
    }
  }

  return { defaultModel, ids };
}

function readGrokModelsCache(): Map<string, RawGrokModelInfo> {
  const result = new Map<string, RawGrokModelInfo>();
  try {
    const grokHome = process.env.GROK_HOME || join(process.env.HOME || "", ".grok");
    const cachePath = join(grokHome, "models_cache.json");
    if (!existsSync(cachePath)) return result;
    const data = JSON.parse(readFileSync(cachePath, "utf-8"));
    if (data?.models && typeof data.models === "object") {
      for (const [id, entry] of Object.entries(data.models as Record<string, { info?: RawGrokModelInfo }>)) {
        if (entry?.info) result.set(id, entry.info);
      }
    }
  } catch {}
  return result;
}

function toModelInfo(id: string, info?: RawGrokModelInfo): ModelInfo {
  const efforts: EffortInfo[] = info?.supports_reasoning_effort === false
    ? []
    : (info?.reasoning_efforts ?? [])
        .map((e) => {
          const effortId = e.value ?? e.id ?? "";
          return {
            id: effortId,
            label: e.label ?? EFFORT_LABEL_MAP[effortId.toLowerCase()] ?? effortId,
            isDefault: Boolean(e.default),
          };
        })
        .filter((e) => e.id);

  return {
    id,
    label: info?.name || id,
    description: info?.description,
    defaultEffort: info?.reasoning_effort ?? efforts.find((e) => e.isDefault)?.id,
    supportedEfforts: efforts.length > 0 ? efforts : undefined,
  };
}

export async function discoverGrokCapabilities(
  binary: string = "grok",
  customModels: ModelInfo[] = [],
  forceRefresh: boolean = false,
): Promise<EngineCapabilities> {
  const now = Date.now();
  if (!forceRefresh && cachedCapabilities && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedCapabilities;
  }

  const cache = readGrokModelsCache();
  let listed: { defaultModel?: string; ids: string[] } = { ids: [] };

  // 1. `grok models` reflects login state and config.toml custom models
  try {
    const { stdout } = await execFileAsync(binary, ["models"], { timeout: 8000 });
    listed = parseGrokModelsOutput(stdout);
  } catch {}

  // 2. Fall back to the visible entries of ~/.grok/models_cache.json
  const ids = listed.ids.length > 0
    ? listed.ids
    : [...cache.entries()].filter(([, info]) => !info.hidden).map(([id]) => id);

  const models: ModelInfo[] = ids.length > 0
    ? ids.map((id) => toModelInfo(id, cache.get(id)))
    : FALLBACK_GROK_MODELS.map((m) => ({ ...m }));

  const defaultId = listed.defaultModel ?? models[0]?.id;
  for (const m of models) {
    if (m.id === defaultId) m.isDefault = true;
  }

  // Include custom models configured in config.yaml
  for (const cm of customModels) {
    if (!models.some((m) => m.id === cm.id)) {
      models.unshift(cm);
    }
  }

  const effortIds = new Set<string>();
  for (const m of models) {
    for (const e of m.supportedEfforts ?? []) effortIds.add(e.id);
  }
  const efforts: EffortInfo[] = effortIds.size > 0
    ? Array.from(effortIds).map((id) => ({ id, label: EFFORT_LABEL_MAP[id.toLowerCase()] ?? id }))
    : DEFAULT_GROK_EFFORTS;

  cachedCapabilities = {
    models,
    efforts,
    supportsEffort: true,
    supportsCustomModel: true,
  };
  lastFetchedAt = now;
  return cachedCapabilities;
}
