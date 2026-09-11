# PocketAgent 🎒

<p align="center">
  <strong>将终端里的 Claude Code、Codex 和 Antigravity 塞进你的 Telegram / Discord</strong><br>
  在手机上随时随地遥控本地 CLI 编程智能体写代码、改 Bug、跑任务。
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

## 💡 这是什么？

平时用 **Claude Code**、**OpenAI Codex** 或 Google **Antigravity (agy)** 只能守在电脑前看终端。

**PocketAgent** 是一个本地网关服务，把你电脑上的这些 CLI 智能体接进 **Telegram**（同时支持 Discord）。无论在通勤、开会还是躺在床上，拿起手机发条消息，就能让家里的电脑帮你写代码、改文件、执行命令。

```text
  Telegram / Discord (手机端)
            │
            ▼
   PocketAgent 网关 (本地常驻)
            │
   ┌────────┼────────┐
   ▼        ▼        ▼
 Claude   Codex     Agy
  Code     CLI      CLI
   │        │        │
   └────────┴────────┘
            ▼
     你的本地代码仓库 (Git)
```

---

## ✨ 核心特性

- **三合一 CLI 支持**：同时支持 Claude Code、Codex 和 Agy，想用哪个用哪个。
- **对话中随意切引擎 (`/engine`)**：聊到一半随时切。比如先让 Claude 做架构，再切 Agy 接着写。网关会自动把上下文和改过的代码带过去，不用重头解释。
- **真实本地进程接管**：不是调用精简版 API，而是直接在你的机器上跑真实的 CLI，拥有完整的文件读写、Bash 执行、Git 和搜索权限。
- **开箱即用后台常驻**：`pa start` 直接后台跑，`pa status`、`pa restart`、`pa stop` 一键运维，加 `-f` 可看前台实时日志。
- **安全配对准入**：首次私聊需要输入 6 位配对码（`pa pairing approve <code>`）通过审批，不用担心 Bot Token 泄露被他人盗用机器。
- **多会话与侧边快问**：支持新开会话（`/new`）、列表切换（`/sessions`），还支持不打断当前主任务的快问快答（`/btw`）。

---

## 🚀 快速开始

### 1. 环境准备

- **Node.js** >= 22
- 本地至少安装了以下任意一个 CLI：
  - Claude Code (`claude`)
  - Google Antigravity (`agy`)
  - OpenAI Codex (`codex`)
- 一个 Telegram Bot Token（从 [@BotFather](https://t.me/BotFather) 免费获取）

### 2. 安装与构建

```bash
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent
npm install
npm run build
npm link        # 注册全局 `pa` 与 `pocketagent` 命令
```

### 3. 环境检查

```bash
pa doctor
```

会检查 Node 版本并检测本机有哪些可用的 CLI 引擎。

### 4. 配置文件

修改 `~/.pocketagent/config.yaml`（首次运行会自动生成）：

```yaml
defaultEngine: "claude" # 全局默认引擎: claude | codex | agy

bots:
  - name: "my-telegram-bot"
    channel: telegram # telegram | discord
    token: "123456:ABC-DEF..." # Telegram Bot Token
    # allowFrom:
    #   - "1465542100"
    # groups:
    #   "-1003981923249": true

  # 也支持同时接入 Discord Bot
  # - name: "my-discord-bot"
  #   channel: discord
  #   token: "MTE3..."
```

### 5. 启动与管理

```bash
# 后台启动（默认）：
pa start

# 查看状态：
pa status

# 重启 / 停止：
pa restart
pa stop

# 实时查看后台日志：
tail -f ~/.pocketagent/logs/gateway.log

# 前台调试（查看彩色实时日志）：
pa start -f
```

### 6. 配对授权

首次在 Telegram 给机器人发消息，机器人会返回一组 6 位配对码（例如 `123456`）。  
在终端执行批准即可：

```bash
pa pairing approve 123456
```

---

## 📱 Bot 常用指令

| 指令 | 说明 |
| :--- | :--- |
| `/engine` | 弹出按钮切换当前使用的 CLI（Claude / Codex / Agy），保留上下文 |
| `/model` | 探测并切换当前引擎的模型 |
| `/effort` | 设置思考/推理档位（low / medium / high / max） |
| `/status` | 查看当前会话状态、活跃引擎、工作区与轮数 |
| `/new` | 新开一个独立会话工作区 |
| `/sessions` | 查看会话列表并通过按钮切换 |
| `/btw <问题>` | 侧边栏快问，不打断主任务 |
| `/stop` | 中断当前正在执行的任务 |
| `/help` | 查看帮助 |

---

## 💻 CLI 命令行

| 命令 | 说明 |
| :--- | :--- |
| `pa start` | 后台启动 PocketAgent（加 `-f` 为前台调试） |
| `pa status` | 查看运行状态与 PID |
| `pa restart` | 重启服务 |
| `pa stop` | 停止服务 |
| `pa doctor` | 检测环境与 CLI 引擎安装情况 |
| `pa pairing list` | 查看所有待审批的配对请求 |
| `pa pairing approve <code>` | 批准配对码 |

---

## 🔄 上下文是如何继承的？

不同 CLI 的会话互不相通。当你在 Telegram 里用 `/engine` 切换引擎时：

1. **总账记录**：网关独立记录每一次对话、发问者与执行动作。
2. **转场引导**：首次切换到新引擎时，网关把之前的对话重点、修改过的文件与工作区状态打包成前置引导喂给新引擎，新引擎直接接手。
3. **回切恢复**：切回之前用过的引擎时，网关恢复其原有会话并把离开期间的增量补齐。
4. **同一个工作区**：所有引擎都在你的同一个本地代码目录工作，文件改动各引擎实时物理可见。

---

## 📄 License

MIT © [happy-shine](https://github.com/happy-shine)
