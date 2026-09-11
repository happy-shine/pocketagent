# PocketAgent 🎒

A unified 3-in-1 AI gateway that bridges chat platforms (**Telegram**, **Discord**) to **Claude Code**, **OpenAI Codex**, and Google **Antigravity (agy)** CLI engines.

Turn your favorite terminal coding agents into an always-on mobile assistant with dynamic CLI switching, seamless context inheritance across engines, dynamic model discovery, and multi-bot collaboration.

```text
┌──────────────────────────────┐
│  Telegram   /   Discord      │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│     PocketAgent Gateway      │
│ • Universal Session History  │
│ • Dynamic Engine Switching   │
│ • Live Model/Effort Probing  │
│ • Context Handover Primer    │
└──────────────┬───────────────┘
   ┌───────────┼───────────┐
   ▼           ▼           ▼
 Claude      Codex        Agy
 Code CLI     CLI         CLI
```

[中文文档 (README_zh.md)](README_zh.md)

---

## ✨ Features

- **3-in-1 Engine Support** — Connect to **Claude Code**, **OpenAI Codex**, and Google **Antigravity (agy)** simultaneously.
- **Dynamic CLI Switching (`/engine`)** — Switch between engines on the fly in Telegram / Discord via inline buttons or commands.
- **Context Inheritance & Sharing** — When switching from Claude to Agy (or Codex), conversation context, file modifications, and workspace state are automatically inherited via structured **Handover Primers**.
- **Dynamic Model Discovery (`/model`)** — Zero hardcoded model lists. PocketAgent live-probes CLI engines (e.g. `agy models`) and renders interactive buttons. Free-form model names are always accepted.
- **Adaptive Reasoning Effort (`/effort`)** — Automatically maps reasoning effort levels (`low`, `medium`, `high`, `max`) per engine.
- **Multi-Channel Architecture** — Production-ready Telegram bot integration with a plug-and-play architecture pre-wired for Discord.
- **Full CLI Superpowers** — Spawns real local CLI processes with tool execution, file reading/writing, terminal commands, and Web search.
- **Session Management** — Multiple persistent sessions per chat (`/new`, `/sessions`, switchable via tappable buttons).
- **Background Daemon & Status** — Run as a daemon (`pocketagent daemon`), monitor health with `doctor`, and inspect logs.
- **Local Gateway API** — CLI agents can curl local endpoints to send files, download attachments, read group history, or modify their own personality (`SOUL.md`).

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** >= 22
- At least one CLI installed:
  - Claude Code: `npm install -g @anthropic-ai/claude-code` (or local launcher)
  - Antigravity: `agy`
  - OpenAI Codex: `npm install -g @openai/codex`
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather) (and optional Discord Bot Token)

### 2. Installation

```bash
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent
npm install
npm run build
npm link        # Makes `pocketagent` and `pa` globally available
```

### 3. Check System & Engines

```bash
pocketagent doctor
# or short alias:
pa doctor
```

### 4. Configuration

Edit `~/.pocketagent/config.yaml` (automatically created on first run):

```yaml
gateway:
  port: 18790
  dataDir: "~/.pocketagent"

engines:
  default: "claude" # Default engine: claude | codex | agy
  claude:
    binary: "claude"
    model: "sonnet"
  agy:
    binary: "agy"
    model: "gemini-3.8-flash-high"
  codex:
    binary: "codex"

auth:
  defaultPolicy: "pairing" # pairing | open | allowlist

bots:
  - name: "pocket-bot"
    token: "123456:ABC-DEF..."    # Telegram token from @BotFather
    engine: "claude"              # Default engine for this bot
```

### 5. Run

```bash
# Foreground:
pocketagent start

# Or Background Daemon:
pocketagent daemon start
pocketagent status
pocketagent daemon stop
```

---

## 📱 Bot Commands

| Command | Description |
| :--- | :--- |
| `/engine [claude\|codex\|agy]` | Switch CLI engine with interactive buttons and context handover |
| `/model [name]` | Live-probe engine models or set any custom model |
| `/effort [level]` | Configure thinking / reasoning effort |
| `/status` | View current session, active engine, model, and workspace info |
| `/new` | Start a fresh session |
| `/sessions [num]` | List sessions with inline switch buttons |
| `/btw <question>` | Ask a non-blocking side question in parallel |
| `/stop` | Interrupt currently running CLI turn |
| `/help` | Display command help |

---

## 🔄 How Context Handover Works

Different AI CLIs have proprietary internal session databases. When you switch engines with `/engine`:

1. **Universal History Ledger**: PocketAgent records every user prompt, assistant response, and tool event into a canonical history store.
2. **Handover Primer**: When the new engine is invoked for the first time in that session, PocketAgent generates a structured context summary injecting previous turns, decisions, and workspace state into the new engine.
3. **Round-trip Resume**: If you switch back to an engine that previously ran in the session, its native session ID is resumed and any delta turns that occurred on the other engine are seamlessly injected.
4. **Physical Workspace Continuity**: All engines share the same disk workspace directory, preserving git branches, files, and build artifacts.

---

## 📄 License

MIT © [happy-shine](https://github.com/happy-shine)
