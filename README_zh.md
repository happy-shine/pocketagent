# PocketAgent 🎒

<p align="center">
  <strong>三合一终端 AI 智能体统一网关：将命令行 Coding Agent 装进口袋</strong><br>
  在 <strong>Telegram</strong> 和 <strong>Discord</strong> 上随时随地遥控运行 <strong>Claude Code</strong>、<strong>OpenAI Codex</strong> 与 <strong>Google Antigravity (agy)</strong>。
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

## 🌟 项目简介

**PocketAgent** 将原本只能坐在电脑桌前使用的命令行 AI Coding Agent，真正变成可以随身携带的智能编程助手。无论你在通勤途中、会议室还是床上，拿起手机打开 Telegram 或 Discord，即可随心指派本地 AI 写代码、做技术调研、排查 Bug、阅读代码库与审查 PR！

```text
┌─────────────────────────────────────────────────────────────┐
│                 Telegram   /   Discord                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    PocketAgent Gateway                      │
│  • 通用会话总账 (Ledger)       • 跨 CLI 动态无缝热切换      │
│  • 动态模型/思考模式探测发现   • 转场引导注射 (Handover)    │
│  • 守护进程与 IPC 握手管理     • 本地智能体 REST API 服务   │
└──────────────────────────────┬──────────────────────────────┘
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         Claude Code CLI   Codex CLI       Agy CLI
         (Anthropic)       (OpenAI)        (Google DeepMind)
               │               │               │
               └───────────────┼───────────────┘
                               ▼
              共享本地物理工作区与 Git 仓库
```

---

## ✨ 核心特性

- **三合一原生引擎聚合** — 原生深度集成 Anthropic **Claude Code**、OpenAI **Codex** 与 Google **Antigravity (agy)**，打破工具壁垒。
- **跨 CLI 动态热切换 (`/engine`)** — 在聊天界面随时弹出交互按钮，一键在 Claude、Codex 和 Agy 之间自由换人，无需重开会话。
- **上下文无缝继承（Context Handover Primer）** — 切换引擎时，网关自动将之前的对话脉络、关键架构决策与工作区状态打包为结构化系统引导注入新引擎；切回历史引擎时自动恢复原生会话并无缝追回增量对话。
- **零硬编码动态模型探测 (`/model`)** — **绝不在代码中写死模型列表**！网关实时动态探测各 CLI 当前推出的最新模型（如实时执行 `agy models` 获取 Gemini / Claude 最新列表、读取 Codex 模型缓存等），动态生成交互按钮网格；同时支持手动输入任意最新模型名称。
- **思考深度自适应 (`/effort`)** — 动态感知当前激活引擎所支持的推理思考深度（`low` / `medium` / `high` / `max`），轻点按钮即可随心调配算力。
- **生产级后台守护进程** — `pa start` 默认后台静默运行，并配备进程 IPC 双向握手校验，确保真实就绪才返回终端；支持 `-f / --foreground` 前台彩色日志调试，提供 `pa status`、`pa restart`、`pa stop` 极简运维指令。
- **多会话物理隔离** — 单个聊天支持维护多个独立会话（`/new`、`/sessions` 按钮列表），多任务并行互不干扰。
- **配对码安全准入机制** — 支持 6 位动态配对码（`pa pairing approve <code>`）安全准入，支持私聊与群聊独立策略，杜绝未经授权的滥用。
- **本地网关 REST API** — CLI 智能体在执行任务时，可直接通过本地 `curl` 接口向用户发送文件、下载用户附件、读取历史发言或动态调整自己的性格设定（`SOUL.md`）。

---

## 🚀 快速上手

### 1. 环境准备

- **Node.js** >= 22.0.0
- 至少安装并配置好以下任意一个 CLI：
  - **Claude Code**: `npm install -g @anthropic-ai/claude-code`（或本地全局别名）
  - **Antigravity (agy)**: 安装 Google `agy` 命令行工具并登录
  - **OpenAI Codex**: `npm install -g @openai/codex`
- Telegram Bot Token（从 [@BotFather](https://t.me/BotFather) 申请）

### 2. 安装与构建

```bash
# 克隆仓库
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent

# 安装依赖并编译构建
npm install
npm run build

# 全局注册 `pocketagent` 及超短别名 `pa`
npm link
```

### 3. 环境与引擎自检

一键检测本机环境与已安装的 CLI 引擎：

```bash
pa doctor
# 或完整命令：
pocketagent doctor
```

### 4. 配置文件

修改配置文件 `~/.pocketagent/config.yaml`（首次运行会自动生成模板）：

```yaml
gateway:
  port: 18790
  dataDir: "~/.pocketagent"
  logLevel: "info"
  logFormat: "pretty"

engines:
  default: "claude" # 默认全局引擎: claude | codex | agy
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
  defaultPolicy: "pairing" # 访问认证: pairing (配对码) | open (开放) | allowlist (白名单)

bots:
  - name: "my-pocket-bot"
    token: "123456:ABC-DEF..."    # 从 @BotFather 获取的 Telegram Token
    engine: "claude"              # 当前 Bot 默认启动引擎
```

### 5. 启动与管理

PocketAgent 默认采用稳定后台守护进程运行：

```bash
# 后台启动（默认 Daemon 模式，带就绪握手校验）：
pa start

# 查看运行状态与 PID：
pa status

# 实时查看后台日志流：
tail -f ~/.pocketagent/logs/gateway.log

# 平滑重启后台服务：
pa restart

# 停止后台服务：
pa stop

# 前台调试运行（控制台实时打印彩色日志，Ctrl+C 退出）：
pa start -f
# 或：
pa start --foreground
```

### 6. 配对授权你的 Telegram 账号

如果配置了 `defaultPolicy: pairing`：
1. 打开 Telegram 向你的 Bot 发送 `/start` 或任意内容；
2. Bot 会回复一组 6 位配对码（例如 `123456`）；
3. 在电脑终端中执行授权批准：
   ```bash
   pa pairing approve 123456
   ```
4. 批准后，你即可随心与 Bot 对话开启编程之旅！

---

## 📱 Bot 常用指令表

| 指令 | 说明 |
| :--- | :--- |
| `/engine [claude\|codex\|agy]` | 动态切换 CLI 引擎，弹出交互式按钮并自动继承会话上下文 |
| `/model [name]` | 动态探测并列出当前引擎可用模型网格，或直接指定任意自定义模型 |
| `/effort [level]` | 设置当前引擎的推理思考深度（`low` / `medium` / `high` / `max`） |
| `/status` | 查看当前会话状态、活跃引擎、模型、思考深度与轮数信息 |
| `/new` | 新建独立会话工作区 |
| `/sessions [num]` | 查看所有会话列表并通过 Inline 按钮快速切换 |
| `/btw <问题>` | 侧边栏独立快问，不打断当前正在执行的主任务 |
| `/stop` | 紧急中断当前正在执行的任务 |
| `/help` | 查看命令说明与帮助指南 |

---

## 💻 CLI 命令行速查表

| 命令行指令 | 说明 |
| :--- | :--- |
| `pa start` | 默认在后台以守护进程启动 PocketAgent（含 IPC 就绪状态校验） |
| `pa start -f` | 前台模式启动，实时输出 Pino 彩色格式化日志，适合排查问题 |
| `pa status` | 查看后台守护进程运行状态与 PID |
| `pa restart` | 平滑重启当前运行的后台守护进程 |
| `pa stop` | 优雅停止后台守护进程 |
| `pa doctor` | 检测系统 Node.js 版本及各引擎 CLI 安装与就绪状态 |
| `pa pairing list` | 查看所有待审批的配对码请求 |
| `pa pairing approve <code>` | 批准指定的配对码，允许对应用户访问机器人 |
| `pa daemon <action>` | 管理后台守护进程（支持 `start`, `stop`, `restart`, `status`） |

---

## 🔄 上下文继承机制解析

不同 CLI 具有完全不同的私有内部存储格式。PocketAgent 通过四重设计实现真正的无感平滑接盘：

1. **通用会话历史总账（Universal Ledger）**：网关在独立的数据层记录每一次对话、发问者、回答引擎、执行工具与时间戳。
2. **转场注射（Handover Primer）**：当首次切换到新 CLI 时，网关自动将近期关键上下文、架构决策与目标工作区信息格式化为系统前置引导注入新 CLI，新引擎即可无缝接盘继续工作。
3. **回切无缝恢复（Round-trip Resume）**：如果切回之前使用过的 CLI，网关恢复其原生会话，并将离开期间在其他引擎产生的增量消息与变更补齐同步。
4. **物理工作区连续性（Workspace Continuity）**：各引擎均工作在同一个本地磁盘工作区目录下，前一个引擎新建或修改的代码与 Git 提交，后一个引擎物理可见。

---

## 📄 开源协议

本项目采用 MIT 许可证开源 © [happy-shine](https://github.com/happy-shine)
