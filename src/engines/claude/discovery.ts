import type { EngineCapabilities, ModelInfo, EffortInfo } from "../types.js";

const DEFAULT_CLAUDE_MODELS: ModelInfo[] = [
  { id: "sonnet", label: "Claude Sonnet (Latest)", isDefault: true },
  { id: "opus", label: "Claude Opus (Latest)" },
  { id: "haiku", label: "Claude Haiku (Latest)" },
  { id: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet" },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku", label: "Claude 3.5 Haiku" },
];

const DEFAULT_CLAUDE_EFFORTS: EffortInfo[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
];

export async function discoverClaudeCapabilities(
  binary: string = "claude",
  customModels: ModelInfo[] = [],
  _forceRefresh: boolean = false,
): Promise<EngineCapabilities> {
  const models = [...DEFAULT_CLAUDE_MODELS];

  for (const cm of customModels) {
    if (!models.some((m) => m.id === cm.id)) {
      models.unshift(cm);
    }
  }

  return {
    models,
    efforts: DEFAULT_CLAUDE_EFFORTS,
    supportsEffort: true,
    supportsCustomModel: true,
  };
}
