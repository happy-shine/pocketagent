import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineCapabilities, ModelInfo, EffortInfo } from "../types.js";

let cachedCapabilities: EngineCapabilities | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const DEFAULT_CLAUDE_EFFORTS: EffortInfo[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra High" },
  { id: "max", label: "Max" },
];

const CORE_CLAUDE_MODELS: ModelInfo[] = [
  {
    id: "sonnet",
    label: "Claude Sonnet (Sonnet 5)",
    description: "Claude Sonnet 5 · Balanced intelligence and speed",
    defaultEffort: "high",
    supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === "high" })),
  },
  {
    id: "opus",
    label: "Claude Opus (Opus 5)",
    description: "Claude Opus 5 · High intelligence and deep reasoning",
    defaultEffort: "medium",
    supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === "medium" })),
  },
  {
    id: "fable",
    label: "Claude Fable (Fable 5.1)",
    description: "Claude Fable 5.1 · Maximum capability for hardest tasks",
    defaultEffort: "high",
    supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === "high" })),
  },
  {
    id: "haiku",
    label: "Claude Haiku (Haiku 4.5)",
    description: "Claude Haiku 4.5 · Fast and lightweight",
    defaultEffort: "medium",
    supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === "medium" })),
  },
];

function formatClaudeModelName(id: string, customLabel?: string, description?: string): string {
  let suffix = "";
  if (id.includes("[1m]") || id.includes("1m")) {
    suffix = " (1M)";
  }
  if (customLabel) {
    let base = customLabel.startsWith("Claude") ? customLabel : `Claude ${customLabel}`;
    if (description) {
      const verMatch = description.match(/(\d+\.\d+)/);
      if (verMatch && !base.includes(verMatch[1])) {
        base += ` ${verMatch[1]}`;
      }
    }
    if (suffix && !base.includes("(1M)")) {
      base += suffix;
    }
    return base;
  }
  let clean = id.replace(/^claude-/, "");
  if (clean.includes("[1m]") || clean.includes("1m")) {
    clean = clean.replace(/\[1m\]/g, "").replace(/-?1m$/, "");
  }
  clean = clean.replace(/(\d+)-(\d+)/g, "$1.$2");
  const parts = clean.split("-").map((part) => {
    if (/^\d+(\.\d+)*$/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  });
  return `Claude ${parts.join(" ")}${suffix}`;
}

export async function discoverClaudeCapabilities(
  _binary: string = "claude",
  customModels: ModelInfo[] = [],
  forceRefresh: boolean = false,
): Promise<EngineCapabilities> {
  const now = Date.now();
  if (!forceRefresh && cachedCapabilities && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedCapabilities;
  }

  const models: ModelInfo[] = CORE_CLAUDE_MODELS.map((m) => ({ ...m }));
  const seenIds = new Set<string>(models.map((m) => m.id));

  // Mark canonical model IDs that the core aliases already represent
  seenIds.add("claude-sonnet-5");
  seenIds.add("claude-opus-5");
  seenIds.add("claude-fable-5");
  seenIds.add("claude-fable");
  seenIds.add("claude-haiku-4-5-20251001");

  const homeDir = process.env.CLAUDE_HOME || process.env.HOME || "";
  let defaultModelId = "sonnet";

  // Check user settings for default model preference
  try {
    const settingsPath = join(homeDir, ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (typeof settings.model === "string" && settings.model) {
        defaultModelId = settings.model;
      }
    }
  } catch {}

  // Read ~/.claude.json for account-cached and available models
  try {
    const claudeJsonPath = join(homeDir, ".claude.json");
    if (existsSync(claudeJsonPath)) {
      const data = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));

      // 1. additionalModelOptionsCache
      if (Array.isArray(data.additionalModelOptionsCache)) {
        for (const opt of data.additionalModelOptionsCache) {
          if (opt && typeof opt.value === "string" && !seenIds.has(opt.value)) {
            seenIds.add(opt.value);
            models.push({
              id: opt.value,
              label: formatClaudeModelName(opt.value, opt.label, opt.description),
              description: opt.description,
              defaultEffort: "high",
              supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === "high" })),
            });
          }
        }
      }

      // 2. clientDataCacheSlots
      if (data.clientDataCacheSlots && typeof data.clientDataCacheSlots === "object") {
        for (const slot of Object.values(data.clientDataCacheSlots)) {
          if (!slot || typeof slot !== "object") continue;
          const s = slot as { model?: unknown; data?: { cedar_lagoon?: Record<string, unknown> } };
          if (typeof s.model === "string" && s.model.startsWith("claude-") && !seenIds.has(s.model)) {
            seenIds.add(s.model);
            const defEff = s.model.includes("opus") ? "medium" : "high";
            models.push({
              id: s.model,
              label: formatClaudeModelName(s.model),
              defaultEffort: defEff,
              supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === defEff })),
            });
          }
          if (s.data?.cedar_lagoon && typeof s.data.cedar_lagoon === "object") {
            for (const [k, v] of Object.entries(s.data.cedar_lagoon)) {
              if (v && k.startsWith("claude-") && !seenIds.has(k)) {
                seenIds.add(k);
                const defEff = k.includes("opus") ? "medium" : "high";
                models.push({
                  id: k,
                  label: formatClaudeModelName(k),
                  defaultEffort: defEff,
                  supportedEfforts: DEFAULT_CLAUDE_EFFORTS.map((e) => ({ ...e, isDefault: e.id === defEff })),
                });
              }
            }
          }
        }
      }

      // If orgModelDefaultCache has a default and settings didn't override it
      if (defaultModelId === "sonnet" && typeof data.orgModelDefaultCache === "string" && data.orgModelDefaultCache) {
        defaultModelId = data.orgModelDefaultCache;
      }
    }
  } catch {}

  // Set default model indicator
  for (const m of models) {
    if (m.id === defaultModelId) {
      m.isDefault = true;
    }
  }
  if (!models.some((m) => m.isDefault)) {
    const sonnet = models.find((m) => m.id === "sonnet");
    if (sonnet) sonnet.isDefault = true;
  }

  // Include custom models configured in config.yaml
  for (const cm of customModels) {
    if (!models.some((m) => m.id === cm.id)) {
      models.unshift(cm);
    }
  }

  cachedCapabilities = {
    models,
    efforts: DEFAULT_CLAUDE_EFFORTS,
    supportsEffort: true,
    supportsCustomModel: true,
  };
  lastFetchedAt = now;

  return cachedCapabilities;
}
