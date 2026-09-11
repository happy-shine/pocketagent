import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EngineCapabilities, ModelInfo, EffortInfo } from "../types.js";

const execFileAsync = promisify(execFile);

let cachedCapabilities: EngineCapabilities | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const DEFAULT_AGY_EFFORTS: EffortInfo[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export async function discoverAgyCapabilities(
  binary: string = "agy",
  customModels: ModelInfo[] = [],
  forceRefresh: boolean = false,
): Promise<EngineCapabilities> {
  const now = Date.now();
  if (!forceRefresh && cachedCapabilities && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedCapabilities;
  }

  const models: ModelInfo[] = [];

  try {
    const { stdout } = await execFileAsync(binary, ["models"], { timeout: 8000 });
    const lines = stdout.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("Fetching") || line.startsWith("Listing")) continue;

      // Format is typically: model-id\tModel Label or model-id  Model Label
      const parts = line.split(/\t+/);
      if (parts.length >= 2) {
        const id = parts[0].trim();
        const label = parts[1].trim();
        if (id && label) {
          models.push({ id, label });
        }
      } else {
        const match = line.match(/^([a-zA-Z0-9._-]+)\s{2,}(.+)$/);
        if (match) {
          models.push({ id: match[1].trim(), label: match[2].trim() });
        }
      }
    }
  } catch (err) {
    // If CLI models command fails, fall back to known models
    if (models.length === 0) {
      models.push(
        { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)" },
        { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash (Medium)" },
        { id: "gemini-3.7-flash-high", label: "Gemini 3.7 Flash (High)" },
        { id: "gemini-3.1-pro-high", label: "Gemini 3.1 Pro (High)" },
        { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Thinking)" },
      );
    }
  }

  // Merge customModels from config (giving priority or deduplicating)
  for (const cm of customModels) {
    if (!models.some((m) => m.id === cm.id)) {
      models.unshift(cm);
    }
  }

  cachedCapabilities = {
    models,
    efforts: DEFAULT_AGY_EFFORTS,
    supportsEffort: true,
    supportsCustomModel: true,
  };
  lastFetchedAt = now;
  return cachedCapabilities;
}
