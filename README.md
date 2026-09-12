# PocketAgent 🎒

<p align="center">
  <strong>Control Claude Code, OpenAI Codex, and Google Antigravity (AGY) via Telegram & Discord across any device.</strong><br>
  Break out of the terminal. Asynchronous interaction, remote DevOps, data automation, and coding from anywhere.
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D22.0.0-339933?logo=node.js&logoColor=white" alt="Node Version"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="README.md">English</a> • <a href="README_zh.md">简体中文</a>
</p>

---

## Overview

Terminal agents like **Claude Code**, **OpenAI Codex**, and Google **Antigravity (AGY)** are far more than code generators. With full host permissions, they can run bash commands, monitor server processes, manage Docker containers, execute Python data scripts, and invoke custom extension tools.

Their main drawback is that **they require you to stay at your desk in front of a terminal**.

**PocketAgent** is a lightweight local gateway daemon that bridges these three CLI agents directly to **Telegram** and **Discord**. Whether you are on mobile, a tablet, a secondary laptop, or desktop chat, you can dispatch tasks directly to your machine without keeping a terminal open or setting up complicated SSH tunnels and remote desktops.

```text
    Telegram / Discord (Mobile / Desktop / Web / Tablet)
                          │
                          ▼
           PocketAgent Gateway (Local Daemon)
             ├─ 6-digit Pairing Security Gate
             ├─ Universal Conversation Ledger
             ├─ 3-CLI Skill Hub (~/.pocketagent/skills)
             └─ Web Dashboard (http://127.0.0.1:18790)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Claude Code       OpenAI Codex    Google Antigravity
      (CLI)             (CLI)              (AGY)
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
              Your Local Computer & OS
   (Bash/Zsh • Python • Git • Docker • File System • Skills)
```

---

## Features

- **Ubiquitous Terminal Access Across Devices**: Runs real CLI processes on your machine with native shell, git, and filesystem permissions. Beyond writing code, you can monitor servers, inspect production logs, run maintenance scripts, and review diffs from any chat client.
- **Mid-Conversation Engine Switching (`/engine`)**: Switch between Claude Code, OpenAI Codex, and Antigravity anytime within the same conversation. PocketAgent automatically extracts conversation history, modified files, and task goals to hand over context without losing track.
- **3-CLI Unified Skill Hub**: Manage custom extension skills centrally in `~/.pocketagent/skills/`. Skills are automatically symlinked across Claude, Codex, and AGY, eliminating the need to maintain separate tool definitions for each engine.
- **Multi-Bot & Multi-Channel**: Run multiple Telegram and Discord bots concurrently on a single gateway. Each bot can be configured with its own default engine, model, reasoning effort, and custom system prompt (`SOUL.md`).
- **Local Web Dashboard**: Built-in minimalist console at `http://127.0.0.1:18790` for live status monitoring, configuration hot reload (`Cmd+S`), workspace and file inspection, turn-by-turn dialogue logs, and online skill editing.
- **100% Local & Secure**: Operates strictly on your own hardware without third-party cloud intermediaries. New conversations require approving a 6-digit pairing code in the terminal before gaining access.

---

## Use Cases

| Scenario | Message / Command | Local Machine Action |
| :--- | :--- | :--- |
| **Remote DevOps** | `Check why the staging nginx container restarted` | CLI inspects `docker logs`, identifies the error, and replies with a summary |
| **Log & Data Processing** | `Summarize status code breakdown from access.log today` | CLI executes a Python or awk script to parse local logs and returns the summary |
| **Code Changes on the Go** | `Update auth token expiration to 2h in auth.ts and run vitest` | CLI edits the file, executes the test suite, and outputs the git diff and test status |
| **Multi-Engine Workflow** | Draft architecture with Claude, then send `/engine` to switch to AGY | Automatically hands off context to Antigravity for implementation against a large codebase |

---

## Quick Start

### 1. Prerequisites

- **Node.js** >= 22
- At least one supported CLI installed:
  - Claude Code (`claude`)
  - Google Antigravity (`agy`)
  - OpenAI Codex (`codex`)
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather) and/or a Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications) (enable **MESSAGE CONTENT INTENT** under the Bot tab).

### 2. Installation

```bash
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent
npm install
npm run build
npm link        # Registers global `pa` and `pocketagent` commands
```

### 3. Check Environment

```bash
pa doctor
```

Checks your Node.js runtime and detects which CLI engines are installed on your machine.

### 4. Configuration

Edit `~/.pocketagent/config.yaml` (created automatically on first run, or edit in the Web Dashboard):

```yaml
defaultEngine: "claude" # claude | codex | agy

bots:
  - name: "my-telegram-bot"
    channel: telegram # telegram | discord
    token: "123456:ABC-DEF..." # Telegram Bot Token
    dmPolicy: pairing # pairing | allowlist | open | disabled
    groupPolicy: pairing
    # allowFrom:
    #   - "1465542100"

  # Optional Discord bot:
  # - name: "my-discord-bot"
  #   channel: discord
  #   token: "MTE3..."
```

### 5. Service Management

```bash
# Start background daemon (default):
pa start

# Check status:
pa status

# Open Web Dashboard in browser:
open http://127.0.0.1:18790

# Restart or stop:
pa restart
pa stop

# View live background logs:
tail -f ~/.pocketagent/logs/gateway.log

# Run in foreground for debugging:
pa start -f
```

### 6. Device Pairing

When you first message the bot on Telegram or Discord, it will reply with a 6-digit pairing code (e.g. `123456`).  
Approve it in your terminal (or via the Web Dashboard):

```bash
pa pairing approve 123456
```

---

## Bot Commands

| Command | Description |
| :--- | :--- |
| `/engine` | Open interactive menu to switch active CLI engine with context handover |
| `/model` | Select available models for the current engine |
| `/effort` | Adjust reasoning effort level (`low`, `medium`, `high`, `max`) |
| `/status` | View active engine, model, current workspace path, and turn count |
| `/new` | Start a new conversation in a fresh workspace |
| `/sessions` | List active sessions with inline buttons to switch or inspect |
| `/btw <question>` | Ask a quick side question without interrupting active tasks |
| `/stop` | Abort the current running CLI turn |
| `/help` | Display command help |

---

## CLI Commands

| Command | Description |
| :--- | :--- |
| `pa start [-f]` | Start PocketAgent daemon (`-f` for foreground mode) |
| `pa status` | Check daemon status, PID, and port |
| `pa restart` | Restart the background daemon |
| `pa stop` | Stop the daemon |
| `pa doctor` | Health check for environment and installed CLI engines |
| `pa pairing list` | List pending pairing authorization requests |
| `pa pairing approve <code>` | Approve a pairing code |

---

## Context Handover Mechanism

Because different CLIs store conversation state in incompatible formats, PocketAgent coordinates transitions using three components:

1. **Universal Ledger**: Logs all prompts, assistant outputs, tool calls, and modified file paths in a unified local ledger.
2. **Handover Primer**: When switching to another engine, the gateway summarizes past context, modified files, and remaining goals into a structured primer prompt for the incoming engine.
3. **Shared Working Directory**: All engines work directly in the same local directory on disk. File changes, git commits, and artifacts produced by one engine are immediately available to the others.

---

## License

MIT © [happy-shine](https://github.com/happy-shine)
