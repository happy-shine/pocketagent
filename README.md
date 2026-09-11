# PocketAgent 🎒

<p align="center">
  <strong>Control Claude Code, OpenAI Codex, and Antigravity from Telegram & Discord</strong><br>
  Turn terminal coding agents into an always-on mobile companion on your phone.
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

## 💡 What is this?

Normally, running **Claude Code**, **OpenAI Codex**, or Google **Antigravity (agy)** requires sitting at your desktop staring at a terminal.

**PocketAgent** is a local gateway that connects those CLI agents to **Telegram** (and Discord). Wherever you are—commuting, in a meeting, or lying on the couch—send a message on your phone, and your local machine writes code, runs terminal commands, and edits files for you.

```text
   Telegram / Discord (on your phone)
                   │
                   ▼
     PocketAgent Gateway (local daemon)
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     Claude      Codex       Agy
      Code        CLI        CLI
        │          │          │
        └──────────┴──────────┘
                   ▼
       Your Local Git Repository
```

---

## ✨ Features

- **3-in-1 CLI Gateway**: Run Claude Code, OpenAI Codex, and Antigravity (agy) seamlessly through a single bot.
- **Switch Engines Mid-Conversation (`/engine`)**: Switch between Claude, Codex, and Agy anytime. PocketAgent automatically carries over conversation context and file changes so you don't have to re-explain anything.
- **Real Local Execution**: Runs real CLI processes on your machine with full bash commands, file editing, and git permissions—not a watered-down web API.
- **Zero-Fuss Background Daemon**: `pa start` runs in the background by default. Check status with `pa status`, restart with `pa restart`, or use `pa start -f` for foreground debugging.
- **Pairing Code Security**: First-time chats require approving a 6-digit code (`pa pairing approve <code>`) in your terminal, preventing unauthorized access.
- **Multi-Sessions & Side Questions**: Open separate session workspaces (`/new`, `/sessions`), or ask quick questions without interrupting running tasks (`/btw`).

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** >= 22
- At least one CLI installed:
  - Claude Code (`claude`)
  - Google Antigravity (`agy`)
  - OpenAI Codex (`codex`)
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather) and/or a Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications) (make sure to enable **MESSAGE CONTENT INTENT** under the Bot tab)

### 2. Install & Build

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

Inspects Node.js version and detects which CLI engines are installed.

### 4. Configuration

Edit `~/.pocketagent/config.yaml` (auto-generated on first run):

```yaml
defaultEngine: "claude" # Global default engine: claude | codex | agy

bots:
  - name: "my-telegram-bot"
    channel: telegram # telegram | discord
    token: "123456:ABC-DEF..." # Telegram Bot Token
    # allowFrom:
    #   - "1465542100"
    # groups:
    #   "-1003981923249": true

  # Connect a Discord Bot simultaneously:
  # - name: "my-discord-bot"
  #   channel: discord
  #   token: "MTE3..."
```

### 5. Start & Manage

```bash
# Start background daemon (default):
pa start

# Check status:
pa status

# Restart or stop:
pa restart
pa stop

# Tail live logs:
tail -f ~/.pocketagent/logs/gateway.log

# Run in foreground for debugging:
pa start -f
```

### 6. Pair Your Bot

When you first message your bot on Telegram, it replies with a 6-digit code (e.g. `123456`).  
Approve it in your terminal:

```bash
pa pairing approve 123456
```

---

## 📱 Bot Commands

| Command | Description |
| :--- | :--- |
| `/engine` | Interactive menu to switch active CLI engine with context handover |
| `/model` | Probe and pick available models for current engine |
| `/effort` | Set reasoning effort (`low`, `medium`, `high`, `max`) |
| `/status` | View active engine, model, workspace, and turn count |
| `/new` | Start a fresh session in a new workspace |
| `/sessions` | List sessions with inline switch buttons |
| `/btw <question>` | Ask a quick side question without interrupting active tasks |
| `/stop` | Abort current turn |
| `/help` | Display command help |

---

## 💻 CLI Commands

| Command | Description |
| :--- | :--- |
| `pa start` | Start PocketAgent daemon (add `-f` for foreground) |
| `pa status` | Check running daemon status and PID |
| `pa restart` | Restart running daemon |
| `pa stop` | Stop daemon |
| `pa doctor` | Health check for Node and installed CLI engines |
| `pa pairing list` | List pending pairing requests |
| `pa pairing approve <code>` | Approve a pairing code |

---

## 🔄 How Context Handover Works

Different CLIs have separate, non-compatible session databases. When you switch engines with `/engine`:

1. **Universal Ledger**: The gateway independently logs every message, turn, and executed action.
2. **Handover Primer**: When switching to a new engine, PocketAgent summarizes previous turns, modified files, and workspace state into an introductory prompt so the new engine picks up immediately.
3. **Round-trip Resume**: Switching back to a previously used engine resumes its native session and syncs intermediate turns.
4. **Shared Workspace**: All engines operate in the exact same local folder on your disk, so file modifications are always visible.

---

## 📄 License

MIT © [happy-shine](https://github.com/happy-shine)
