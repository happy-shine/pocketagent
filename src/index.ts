#!/usr/bin/env node

import dns from "node:dns";
import net from "node:net";
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

import { Command } from "commander";
import pino from "pino";
import { loadConfig, resolveBots, resolveDataDir } from "./config/loader.js";
import type { GatewayConfig } from "./config/types.js";
import { Gateway } from "./gateway/gateway.js";
import { PairingManager } from "./auth/pairing.js";
import { spawn, spawnSync } from "node:child_process";
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  openSync,
  closeSync,
} from "node:fs";
import { resolve, join } from "node:path";

const program = new Command();

program
  .name("pocketagent")
  .alias("pa")
  .description("Unified Gateway bridging chat platforms to Claude Code, Codex, and Antigravity (agy) CLI engines")
  .version("0.1.0");

function getDataDir(configPath?: string): string {
  try {
    const config = loadConfig(configPath);
    return resolve(config.gateway.dataDir.replace(/^~/, process.env.HOME ?? ""));
  } catch {
    return resolve(process.env.HOME ?? "~", ".pocketagent");
  }
}

function getLogDir(dataDir: string): string {
  const logDir = join(dataDir, "logs");
  mkdirSync(logDir, { recursive: true });
  return logDir;
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getRunningPid(dataDir: string): number | null {
  const lockPath = join(dataDir, "gateway.lock");
  if (!existsSync(lockPath)) return null;
  try {
    const lockData = JSON.parse(readFileSync(lockPath, "utf-8"));
    if (isPidRunning(lockData.pid)) return lockData.pid;
    try { unlinkSync(lockPath); } catch {}
    return null;
  } catch {
    try { unlinkSync(lockPath); } catch {}
    return null;
  }
}

function printBanner(): void {
  console.log("");
  console.log("  🎒 PocketAgent v0.1.0");
  console.log("  3-in-1 Gateway: Claude Code | Codex | Antigravity");
  console.log("  Channels: Telegram | Discord");
  console.log("");
}

function checkEngineClis(config: GatewayConfig): void {
  const engines = [
    { name: "Claude Code", binary: config.engines.claude.binary, flag: "--version" },
    { name: "Codex CLI", binary: config.engines.codex.binary, flag: "--version" },
    { name: "Antigravity (agy)", binary: config.engines.agy.binary, flag: "--help" },
  ];

  for (const eng of engines) {
    const res = spawnSync(eng.binary, [eng.flag], { stdio: "pipe", timeout: 3000 });
    if (res.status === 0) {
      console.log(`  ✓ ${eng.name} found (${eng.binary})`);
    } else {
      console.log(`  - ${eng.name} not found or inactive (${eng.binary})`);
    }
  }
}

async function startForeground(opts: { config?: string }): Promise<void> {
  printBanner();
  const config = loadConfig(opts.config);
  const dataDir = getDataDir(opts.config);

  const existingPid = getRunningPid(dataDir);
  if (existingPid) {
    console.error(`Gateway is already running (PID: ${existingPid})`);
    console.error(`Use 'pa stop' to stop it before running in the foreground.`);
    process.exit(1);
  }

  mkdirSync(dataDir, { recursive: true });
  const lockPath = join(dataDir, "gateway.lock");
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));

  const log = pino({
    level: config.gateway.logLevel,
    transport:
      config.gateway.logFormat === "pretty"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });

  const gateway = new Gateway(config, log, opts.config);

  const cleanup = async () => {
    console.log("\nShutting down PocketAgent Gateway...");
    try { unlinkSync(lockPath); } catch {}
    await gateway.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", (err) => {
    try { unlinkSync(lockPath); } catch {}
    console.error("Uncaught exception:", err);
    process.exit(1);
  });

  await gateway.start();
  if (process.send) {
    process.send({ type: "ready" });
    process.disconnect?.();
  }
}

async function startDaemon(opts: { config?: string }): Promise<void> {
  const dataDir = getDataDir(opts.config);
  const runningPid = getRunningPid(dataDir);
  if (runningPid) {
    console.log(`PocketAgent is already running (PID: ${runningPid})`);
    console.log(`Use 'pa restart' to restart or 'pa stop' to stop.`);
    return;
  }

  try {
    loadConfig(opts.config);
  } catch (err) {
    console.error(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const logDir = getLogDir(dataDir);
  const outLog = join(logDir, "gateway.log");
  const errLog = join(logDir, "gateway.err");

  const out = openSync(outLog, "a");
  const err = openSync(errLog, "a");

  const child = spawn(
    process.argv[0],
    [process.argv[1], "start", "-f", ...(opts.config ? ["-c", opts.config] : [])],
    {
      detached: true,
      stdio: ["ignore", out, err, "ipc"],
      env: { ...process.env },
    }
  );

  closeSync(out);
  closeSync(err);

  await new Promise<void>((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.unref();
        console.log(`PocketAgent daemon started in background (PID: ${child.pid})`);
        console.log(`Logs: ${outLog}`);
        resolve();
      }
    }, 10000);

    child.on("message", (msg: { type?: string }) => {
      if (msg?.type === "ready") {
        settled = true;
        clearTimeout(timer);
        child.unref();
        console.log(`PocketAgent daemon started in background (PID: ${child.pid})`);
        console.log(`Logs: ${outLog}`);
        resolve();
      }
    });

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        console.error(`PocketAgent daemon failed to start (exit code: ${code}).`);
        if (existsSync(errLog)) {
          const errContent = readFileSync(errLog, "utf-8").trim();
          if (errContent) {
            const lines = errContent.split("\n");
            const lastLines = lines.slice(-10).join("\n");
            console.error(`\nError details:\n${lastLines}\n`);
          }
        }
        console.error(`Check error log: ${errLog}`);
        process.exit(1);
      }
    });
  });
}

async function stopDaemon(dataDir: string): Promise<boolean> {
  const runningPid = getRunningPid(dataDir);
  if (!runningPid) {
    console.log("PocketAgent is not running");
    return false;
  }
  console.log(`Stopping PocketAgent (PID: ${runningPid})...`);
  try { process.kill(runningPid, "SIGTERM"); } catch {}
  const start = Date.now();
  while (isPidRunning(runningPid) && Date.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (isPidRunning(runningPid)) {
    try { process.kill(runningPid, "SIGKILL"); } catch {}
  }
  const lockPath = join(dataDir, "gateway.lock");
  try { unlinkSync(lockPath); } catch {}
  console.log(`Stopped PocketAgent (PID: ${runningPid})`);
  return true;
}

async function restartDaemon(opts: { config?: string }): Promise<void> {
  const dataDir = getDataDir(opts.config);
  const runningPid = getRunningPid(dataDir);
  if (runningPid) {
    await stopDaemon(dataDir);
  }
  await startDaemon(opts);
}

function printStatus(configPath?: string): void {
  const dataDir = getDataDir(configPath);
  const pid = getRunningPid(dataDir);
  if (pid) {
    console.log(`PocketAgent is active in background (PID: ${pid})`);
  } else {
    console.log("PocketAgent is not running");
  }
}

program
  .command("start")
  .description("Start the PocketAgent gateway (daemon by default, use -f for foreground)")
  .option("-f, --foreground", "Run in foreground with real-time log output")
  .option("-c, --config <path>", "Path to config file")
  .action(async (opts) => {
    if (opts.foreground) {
      await startForeground(opts);
    } else {
      await startDaemon(opts);
    }
  });

program
  .command("daemon")
  .description("Manage the PocketAgent background daemon")
  .argument("[action]", "start, stop, restart, or status", "start")
  .option("-c, --config <path>", "Path to config file")
  .action(async (action, opts) => {
    const dataDir = getDataDir(opts.config);

    if (action === "status") {
      printStatus(opts.config);
      return;
    }

    if (action === "stop") {
      await stopDaemon(dataDir);
      return;
    }

    if (action === "restart") {
      await restartDaemon(opts);
      return;
    }

    if (action === "start") {
      await startDaemon(opts);
      return;
    }

    console.error(`Unknown action: ${action}. Available actions: start, stop, restart, status`);
  });

program
  .command("stop")
  .description("Stop running PocketAgent daemon")
  .option("-c, --config <path>", "Path to config file")
  .action(async (opts) => {
    const dataDir = getDataDir(opts.config);
    await stopDaemon(dataDir);
  });

program
  .command("restart")
  .description("Restart running PocketAgent daemon")
  .option("-c, --config <path>", "Path to config file")
  .action(async (opts) => {
    await restartDaemon(opts);
  });

program
  .command("status")
  .description("Check running status")
  .option("-c, --config <path>", "Path to config file")
  .action((opts) => {
    printStatus(opts.config);
  });

program
  .command("doctor")
  .description("Check health, installation and CLI engines")
  .option("-c, --config <path>", "Path to config file")
  .action((opts) => {
    printBanner();
    console.log("Running system & engine check...\n");
    console.log(`  Node.js version: ${process.version}`);

    try {
      const config = loadConfig(opts.config);
      console.log("  ✓ Config file parsed successfully\n");
      console.log("Detecting CLI Engines:");
      checkEngineClis(config);

      console.log("\nConfigured Bots:");
      const bots = resolveBots(config);
      for (const b of bots) {
        console.log(`  • ${b.name} (Default Engine: ${b.engine.toUpperCase()})`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to read config: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log("\nReady to run: `pocketagent start` or `pa start`");
  });

program
  .command("pairing")
  .description("Manage access pairing codes")
  .argument("[action]", "list or approve", "list")
  .argument("[code]", "Pairing code to approve")
  .option("-c, --config <path>", "Path to config file")
  .option("-b, --bot <name>", "Bot name")
  .action((action, code, opts) => {
    const dataDir = getDataDir(opts.config);
    const config = loadConfig(opts.config);
    const bots = resolveBots(config);
    const targetBots = opts.bot ? bots.filter((b) => b.name === opts.bot) : bots;
    if (targetBots.length === 0) {
      console.error("No matching bot found");
      return;
    }

    if (action === "approve") {
      if (!code) {
        console.error("Provide a pairing code to approve: `pocketagent pairing approve <code>`");
        return;
      }
      let approvedBotName: string | undefined;
      let approvedSenderId: string | undefined;

      for (const bot of targetBots) {
        const pairingPath = join(dataDir, "credentials", bot.botId, "telegram-pairing.json");
        const pm = new PairingManager(pairingPath);
        const result = pm.approve(code);
        if (result) {
          const allowPath = join(dataDir, "credentials", bot.botId, "telegram-allowFrom.json");
          let list: string[] = [];
          if (existsSync(allowPath)) {
            try { list = JSON.parse(readFileSync(allowPath, "utf-8")).allowFrom ?? []; } catch {}
          }
          if (!list.includes(result.senderId)) {
            list.push(result.senderId);
            writeFileSync(allowPath, JSON.stringify({ allowFrom: list }, null, 2));
          }

          if (result.chatId && result.chatId !== result.senderId) {
            const groupsPath = join(dataDir, "credentials", bot.botId, "telegram-groups.json");
            let groups: Record<string, { enabled: boolean; allowFrom?: string[] }> = {};
            if (existsSync(groupsPath)) {
              try { groups = JSON.parse(readFileSync(groupsPath, "utf-8")).groups ?? {}; } catch {}
            }
            groups[result.chatId] = { enabled: true };
            writeFileSync(groupsPath, JSON.stringify({ groups }, null, 2));
          }

          approvedBotName = bot.name;
          approvedSenderId = result.senderId;
          break;
        }
      }

      if (approvedSenderId) {
        console.log(`Approved pairing code ${code} for user ${approvedSenderId} (bot: ${approvedBotName})`);
      } else {
        console.error(`Pairing code ${code} not found or already approved/expired.`);
      }
      return;
    }

    const allPending: Array<{ botName: string; p: any }> = [];
    for (const bot of targetBots) {
      const pairingPath = join(dataDir, "credentials", bot.botId, "telegram-pairing.json");
      const pm = new PairingManager(pairingPath);
      for (const p of pm.listPending()) {
        allPending.push({ botName: bot.name, p });
      }
    }

    if (allPending.length === 0) {
      console.log("No pending pairing requests");
    } else {
      console.log("Pending pairing requests:");
      for (const { botName, p } of allPending) {
        console.log(`  • [${botName}] Code: ${p.code} | User: ${p.senderName} (${p.senderId}) | Channel: ${p.channelType}`);
      }
    }
  });

program.parse();
