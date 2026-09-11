import { describe, it, expect } from "vitest";
import { parseConfig, resolveBots } from "../config/loader.js";

describe("PocketAgent Config Loader & Schema", () => {
  it("parses modern PocketAgent config with 3-in-1 engines and bots", () => {
    const yaml = `
gateway:
  port: 19000
  dataDir: "~/.pocketagent"

engines:
  default: "agy"
  claude:
    binary: "claude"
    model: "opus"
  agy:
    binary: "agy"
    model: "gemini-3.8-flash-high"
    effort: "high"
  codex:
    binary: "codex"

bots:
  - name: "research-bot"
    token: "111:AAA"
    engine: "agy"
  - name: "code-bot"
    token: "222:BBB"
    engine: "claude"
`;
    const config = parseConfig(yaml);
    expect(config.gateway.port).toBe(19000);
    expect(config.engines.default).toBe("agy");
    expect(config.engines.claude.model).toBe("opus");
    expect(config.engines.agy.model).toBe("gemini-3.8-flash-high");
    expect(config.engines.agy.effort).toBe("high");

    const bots = resolveBots(config);
    expect(bots.length).toBe(2);
    expect(bots[0].engine).toBe("agy");
    expect(bots[0].model).toBe("gemini-3.8-flash-high");
    expect(bots[1].engine).toBe("claude");
    expect(bots[1].model).toBe("opus");
  });

  it("maintains backward compatibility with legacy config styles", () => {
    const legacyYaml = `
claude:
  binary: "claude"
  model: "sonnet"
  maxProcesses: 5

channels:
  telegram:
    botToken: "333:CCC"
    dmPolicy: "open"
`;
    const config = parseConfig(legacyYaml);
    expect(config.engines.claude.model).toBe("sonnet");
    expect(config.engines.maxProcesses).toBe(5);

    const bots = resolveBots(config);
    expect(bots.length).toBe(1);
    expect(bots[0].token).toBe("333:CCC");
    expect(bots[0].dmPolicy).toBe("open");
  });

  it("handles clean configs without any model fields", () => {
    const yaml = `
gateway:
  port: 18790
engines:
  default: "claude"
  claude:
    binary: "claude"
  agy:
    binary: "agy"
  codex:
    binary: "codex"
bots:
  - name: "my-bot"
    token: "123:ABC"
    engine: "claude"
`;
    const config = parseConfig(yaml);
    expect(config.engines.claude.model).toBeUndefined();
    expect(config.engines.agy.model).toBeUndefined();
    expect(config.engines.codex.model).toBeUndefined();
    const bots = resolveBots(config);
    expect(bots[0].model).toBeUndefined();
  });
});
