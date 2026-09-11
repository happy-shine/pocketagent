# PocketAgent 🎒

<p align="center">
  <strong>The Unified 3-in-1 AI Gateway: Bridging Chat Platforms to CLI Coding Agents</strong><br>
  Run <strong>Claude Code</strong>, <strong>OpenAI Codex</strong>, and <strong>Google Antigravity (agy)</strong> directly from your pocket via <strong>Telegram</strong> & <strong>Discord</strong>.
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D22.0.0-339933?logo=node.js&logoColor=white" alt="Node Version"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/Engines-Claude%20%7C%20Codex%20%7C%20Agy-orange" alt="Engines">
  <img src="https://img.shields.io/badge/Channels-Telegram%20%7C%20Discord-blue" alt="Channels">
</p>

<p align="center">
  <a href="README.md">English</a> • <a href="README_zh.md">简体中文</a>
</p>

---

## 🌟 Overview

**PocketAgent** turns command-line AI coding agents—normally tethered to your desktop—into an always-on mobile companion. Manage repositories, inspect PRs, query codebase architecture, and generate code directly from your smartphone or tablet through Telegram or Discord.

```text
┌─────────────────────────────────────────────────────────────┐
│                 Telegram   /   Discord                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    PocketAgent Gateway                      │
│  • Universal Session Ledger    • Dynamic Engine Switching   │
│  • Live Model & Effort Probing • Context Handover Primer    │
│  • Background IPC Daemon       • REST Agent API Server      │
└──────────────────────────────┬──────────────────────────────┘
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         Claude Code CLI   Codex CLI       Agy CLI
         (Anthropic)       (OpenAI)        (Google DeepMind)
               │               │               │
               └───────────────┼───────────────┘
                               ▼
            Shared Local Workspace & Git Repository
```

---

## ✨ Key Features

- **3-in-1 Native Engine Aggregation**: Simultaneously connects to Anthropic's **Claude Code**, OpenAI's **Codex**, and Google's **Antigravity (agy)** CLI engines.
- **Dynamic Hot-Swapping (`/engine`)**: Switch between engines in Telegram or Discord on the fly with interactive inline buttons.
- **Seamless Context Handover (Handover Primer)**: When switching engines, PocketAgent formats prior turns, architectural decisions, and repository changes into a structured primer injected into the new engine. Returning to a previous engine resumes its native session with zero context loss.
- **Zero-Hardcoding Dynamic Discovery (`/model`)**: No rigid, hardcoded model lists. PocketAgent live-probes CLI engines (e.g. `agy models`, Codex models cache, Claude modern stack) and renders adaptive interactive buttons. Custom model inputs are always accepted.
- **Adaptive Thinking Effort (`/effort`)**: Intelligently senses the active engine's supported reasoning levels (`low`, `medium`, `high`, `max`) and lets you toggle depth with a single tap.
- **Production-Grade Background Daemon**: `pa start` launches an asynchronous background daemon by default with IPC readiness handshake. Supports `-f / --foreground` for live debugging, plus `pa restart`, `pa stop`, and `pa status`.
- **Multi-Tenant Session Multiplexing**: Maintain multiple concurrent tasks per chat (`/new`, `/sessions`) with isolated physical workspaces.
- **Secure Pairing Authentication**: Fine-grained pairing codes (`pa pairing approve <code>`) preventing unauthorized bot usage, with separate policies for direct messages and group chats.
- **Local Gateway REST API**: CLI agents can curl local endpoints inside active turns to send files, download attachments, read conversation history, or update their own personality (`SOUL.md`).

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** >= 22.0.0
- At least one CLI coding engine installed:
  - **Claude Code**: `npm install -g @anthropic-ai/claude-code` (or local binary)
  - **Antigravity (agy)**: `agy` CLI installed and authenticated
  - **OpenAI Codex**: `npm install -g @openai/codex`
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### 2. Installation & Build

```bash
# Clone repository
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent

# Install dependencies and build
npm install
npm run build

# Register global `pocketagent` and short alias `pa`
npm link
```

### 3. System & Engine Health Check

Verify your installed CLI engines and environment:

```bash
pa doctor
# or:
pocketagent doctor
```

### 4. Configuration

Edit `~/.pocketagent/config.yaml` (auto-generated on first run):

```yaml
gateway:
  port: 18790
  dataDir: "~/.pocketagent"
  logLevel: "info"
  logFormat: "pretty"

engines:
  default: "claude" # Default engine: claude | codex | agy
  claude:
    binary: "claude"
    model: "sonnet"
  agy:
    binary: "agy"
    model: "gemini-3.8-flash-high"
    effort: "high"
  codex:
    binary: "codex"

auth:
  defaultPolicy: "pairing" # pairing | open | allowlist

bots:
  - name: "my-pocket-bot"
    token: "123456:ABC-DEF..."    # Telegram Bot Token
    engine: "claude"              # Default engine for this bot
```

### 5. Running PocketAgent

PocketAgent runs as a background daemon by default:

```bash
# Start in background (daemon mode with IPC readiness check):
pa start

# Check service status & PID:
pa status

# Inspect live background logs:
tail -f ~/.pocketagent/logs/gateway.log

# Restart background service:
pa restart

# Stop background service:
pa stop

# Run in foreground for real-time terminal debugging:
pa start -f
# or:
pa start --foreground
```

### 6. Pair Your Telegram Account

If `auth.defaultPolicy` is set to `pairing`:
1. Send `/start` or any message to your bot on Telegram.
2. The bot will respond with a 6-digit pairing code (e.g. `123456`).
3. In your terminal, approve the user:
   ```bash
   pa pairing approve 123456
   ```

---

## 📱 Bot Commands

| Command | Description |
| :--- | :--- |
| `/engine [claude\|codex\|agy]` | Open engine selection menu, hot-swap active engine with context handover |
| `/model [name]` | Live-probe engine for supported models or manually specify any model |
| `/effort [level]` | Toggle thinking / reasoning effort (`low`, `medium`, `high`, `max`) |
| `/status` | View current session details, active engine, model, effort, and turn count |
| `/new` | Create a new isolated session workspace |
| `/sessions [num]` | Display session list with interactive switch buttons |
| `/btw <question>` | Ask a quick side question without interrupting active tasks |
| `/stop` | Abort the currently running turn or task |
| `/help` | Display command guide and quick tips |

---

## 💻 CLI Commands Reference

| CLI Command | Description |
| :--- | :--- |
| `pa start` | Start PocketAgent as a background daemon |
| `pa start -f` | Start in foreground with real-time colored log output |
| `pa status` | Check if PocketAgent daemon is running and view PID |
| `pa restart` | Gracefully restart running daemon instance |
| `pa stop` | Stop running background daemon |
| `pa doctor` | Run comprehensive system, Node.js, and engine binary diagnosis |
| `pa pairing list` | List pending bot access pairing requests |
| `pa pairing approve <code>` | Approve a pairing code to authorize user access |
| `pa daemon <action>` | Manage daemon (`start`, `stop`, `restart`, `status`) |

---

## 🔄 How Context Handover Works

Different AI CLIs have fundamentally incompatible internal state stores. PocketAgent solves this through a four-pillar design:

1. **Universal History Ledger**: The gateway records every turn, sender, model output, and timestamp in an engine-agnostic log.
2. **Handover Primer**: When switching to an engine for the first time in a session, PocketAgent synthesizes recent key history and workspace state into an introductory primer, enabling immediate task continuation.
3. **Round-trip Resume**: Switching back to a previously used engine resumes its native session directly, injecting only the delta messages that occurred in the interim.
4. **Physical Workspace Continuity**: All engines operate inside the same underlying workspace directory on disk, ensuring file changes and git commits remain consistent across engines.

---

## 📄 License

MIT © [happy-shine](https://github.com/happy-shine)
