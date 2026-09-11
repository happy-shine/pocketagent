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

program
  .command("start")
  .description("Start the PocketAgent gateway in the foreground")
  .option("-c, --config <path>", "Path to config file")
  .action(async (opts) => {
    printBanner();
    const config = loadConfig(opts.config);
    const dataDir = getDataDir(opts.config);

    const existingPid = getRunningPid(dataDir);
    if (existingPid) {
      console.error(`Gateway is already running (PID: ${existingPid})`);
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

    await gateway.start();
  });

program
  .command("daemon")
  .description("Manage the PocketAgent background daemon")
  .argument("[action]", "start, stop, restart, or status", "start")
  .option("-c, --config <path>", "Path to config file")
  .action(async (action, opts) => {
    const dataDir = getDataDir(opts.config);
    const runningPid = getRunningPid(dataDir);

    if (action === "status") {
      if (runningPid) {
        console.log(`PocketAgent is running in background (PID: ${runningPid})`);
      } else {
        console.log("PocketAgent is stopped");
      }
      return;
    }

    if (action === "stop") {
      if (!runningPid) {
        console.log("PocketAgent is not running");
        return;
      }
      try { process.kill(runningPid, "SIGTERM"); } catch {}
      console.log(`Stopping PocketAgent (PID: ${runningPid})...`);
      const start = Date.now();
      while (isPidRunning(runningPid) && Date.now() - start < 5000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (isPidRunning(runningPid)) {
        try { process.kill(runningPid, "SIGKILL"); } catch {}
      }
      console.log(`Stopped PocketAgent (PID: ${runningPid})`);
      return;
    }

    if (action === "start" || action === "restart") {
      if (runningPid) {
        try { process.kill(runningPid, "SIGTERM"); } catch {}
        console.log(`Stopping existing instance (PID: ${runningPid})...`);
        const start = Date.now();
        while (isPidRunning(runningPid) && Date.now() - start < 5000) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (isPidRunning(runningPid)) {
          try { process.kill(runningPid, "SIGKILL"); } catch {}
        }
        console.log(`Stopped existing instance (PID: ${runningPid})`);
      }

      const logDir = getLogDir(dataDir);
      const outLog = join(logDir, "gateway.log");
      const errLog = join(logDir, "gateway.err");

      const out = openSync(outLog, "a");
      const err = openSync(errLog, "a");

      const child = spawn(process.argv[0], [process.argv[1], "start", ...(opts.config ? ["-c", opts.config] : [])], {
        detached: true,
        stdio: ["ignore", out, err],
        env: { ...process.env },
      });

      child.unref();
      console.log(`PocketAgent daemon started in background (PID: ${child.pid})`);
      console.log(`Logs: ${outLog}`);
    }
  });

program
  .command("stop")
  .description("Stop running PocketAgent daemon")
  .action(async () => {
    const dataDir = getDataDir();
    const runningPid = getRunningPid(dataDir);
    if (!runningPid) {
      console.log("PocketAgent is not running");
      return;
    }
    process.kill(runningPid, "SIGTERM");
    console.log(`Stopped PocketAgent (PID: ${runningPid})`);
  });

program
  .command("status")
  .description("Check running status")
  .action(() => {
    const dataDir = getDataDir();
    const pid = getRunningPid(dataDir);
    if (pid) {
      console.log(`PocketAgent is active (PID: ${pid})`);
    } else {
      console.log("PocketAgent is not running");
    }
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
    const bot = opts.bot ? bots.find((b) => b.name === opts.bot) : bots[0];
    if (!bot) {
      console.error("No matching bot found");
      return;
    }

    const pairingPath = join(dataDir, "credentials", bot.botId, "telegram-pairing.json");
    const pm = new PairingManager(pairingPath);

    if (action === "approve") {
      if (!code) {
        console.error("Provide a pairing code to approve: `pocketagent pairing approve <code>`");
        return;
      }
      const result = pm.approve(code);
      if (result) {
        // Add to allowFrom
        const allowPath = join(dataDir, "credentials", bot.botId, "telegram-allowFrom.json");
        let list: string[] = [];
        if (existsSync(allowPath)) {
          try { list = JSON.parse(readFileSync(allowPath, "utf-8")).allowFrom ?? []; } catch {}
        }
        if (!list.includes(result.senderId)) {
          list.push(result.senderId);
          writeFileSync(allowPath, JSON.stringify({ allowFrom: list }, null, 2));
        }
        console.log(`Approved pairing code ${code} for user ${result.senderId}`);
      } else {
        console.error(`Pairing code ${code} not found or expired`);
      }
      return;
    }

    const pending = pm.listPending();
    if (pending.length === 0) {
      console.log("No pending pairing requests");
    } else {
      console.log("Pending pairing requests:");
      for (const p of pending) {
        console.log(`  • Code: ${p.code} | User: ${p.senderName} (${p.senderId}) | Chat: ${p.chatId}`);
      }
    }
  });

program.parse();
