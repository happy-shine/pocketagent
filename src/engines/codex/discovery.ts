import type { EngineCapabilities, ModelInfo, EffortInfo } from "../types.js";

const DEFAULT_CODEX_MODELS: ModelInfo[] = [
  { id: "gpt-5.5", label: "GPT-5.5 (Default)", isDefault: true },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  { id: "o3-mini", label: "o3-mini" },
  { id: "o1", label: "o1" },
  { id: "gpt-4o", label: "GPT-4o" },
];

const DEFAULT_CODEX_EFFORTS: EffortInfo[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra High" },
];

export async function discoverCodexCapabilities(
  _binary: string = "codex",
  customModels: ModelInfo[] = [],
  _forceRefresh: boolean = false,
): Promise<EngineCapabilities> {
  const models = [...DEFAULT_CODEX_MODELS];

  for (const cm of customModels) {
    if (!models.some((m) => m.id === cm.id)) {
      models.unshift(cm);
    }
  }

  return {
    models,
    efforts: DEFAULT_CODEX_EFFORTS,
    supportsEffort: true,
    supportsCustomModel: true,
  };
}
