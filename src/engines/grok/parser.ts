import type { EngineEvent } from "../types.js";

const MAX_DETAIL_LENGTH = 500;

export interface GrokSpawnConfig {
  binary: string;
  promptFile: string;
  /** Existing Grok session to resume. */
  resumeSessionId?: string;
  /** Pre-assigned UUID for a brand-new Grok session (ignored when resuming). */
  newSessionId?: string;
  /** System prompt rules; Grok persists them with the session, so only applied on creation. */
  rules?: string;
  model?: string;
  effort?: string;
  extraArgs: string[];
}

export interface GrokJsonEvent {
  type?: string;
  [key: string]: unknown;
}

export interface GrokSpawnCommand {
  cmd: string;
  args: string[];
}

// Grok built-in tool IDs -> tool names understood by the progress tracker
const TOOL_NAME_MAP: Record<string, string> = {
  run_terminal_command: "Bash",
  run_terminal_cmd: "Bash",
  read_file: "Read",
  write: "Write",
  search_replace: "Edit",
  list_dir: "LS",
  grep: "Grep",
  web_search: "WebSearch",
  web_fetch: "WebFetch",
  spawn_subagent: "Agent",
  task: "Agent",
  todo_write: "TodoWrite",
};

export function buildGrokSpawnArgs(config: GrokSpawnConfig): GrokSpawnCommand {
  const args = [
    "--prompt-file", config.promptFile,
    "--output-format", "streaming-json",
    "--always-approve",
  ];

  if (config.resumeSessionId) {
    args.push("--resume", config.resumeSessionId);
  } else {
    if (config.newSessionId) args.push("--session-id", config.newSessionId);
    if (config.rules) args.push("--rules", config.rules);
  }

  if (config.model) args.push("--model", config.model);
  if (config.effort) args.push("--reasoning-effort", config.effort);

  args.push(...config.extraArgs);
  return { cmd: config.binary, args };
}

export function parseGrokJsonLine(line: string): GrokJsonEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isRecord(parsed) && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Stateful mapper for `grok --output-format streaming-json` events.
 * Thought deltas arrive token-by-token, so only the first delta of each
 * reasoning block is surfaced as `thinking_started`.
 */
export class GrokEventMapper {
  private inThought = false;

  map(event: GrokJsonEvent): EngineEvent[] {
    if (event.type === "thought") {
      if (this.inThought) return [];
      this.inThought = true;
      return [{ type: "thinking_started" }];
    }
    this.inThought = false;

    if (event.type === "text") {
      return typeof event.data === "string" && event.data ? [{ type: "text", text: event.data }] : [];
    }

    if (event.type === "tool_call") {
      return [mapGrokTool(event)];
    }

    if (event.type === "end") {
      const sessionId = typeof event.sessionId === "string" ? event.sessionId : undefined;
      const events: EngineEvent[] = [];
      if (sessionId) events.push({ type: "session_started", sessionId });
      events.push({ type: "result", isError: false });
      return events;
    }

    if (event.type === "error") {
      const message = typeof event.message === "string" ? event.message : "Grok turn failed";
      return [
        { type: "error", message },
        { type: "result", result: message, isError: true },
      ];
    }

    return [];
  }
}

export function mapGrokTool(event: GrokJsonEvent): EngineEvent {
  const rawName = typeof event.toolName === "string"
    ? event.toolName
    : typeof event.title === "string" ? event.title : "tool";
  const name = TOOL_NAME_MAP[rawName] ?? rawName;
  return { type: "tool_started", name, detail: toolDetail(event.rawInput) };
}

function toolDetail(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (isRecord(input)) {
    for (const key of ["command", "file_path", "path", "pattern", "query", "url", "description", "prompt"]) {
      const value = input[key];
      if (typeof value === "string" && value) return truncate(value);
    }
  }
  if (typeof input === "string") return truncate(input);
  try {
    return truncate(JSON.stringify(input));
  } catch {
    return undefined;
  }
}

function truncate(value: string): string {
  if (value.length <= MAX_DETAIL_LENGTH) return value;
  return `${value.slice(0, MAX_DETAIL_LENGTH - 3)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
