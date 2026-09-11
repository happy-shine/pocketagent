# PocketAgent 🎒

**PocketAgent** 是一款三合一的统一 AI 网关，将聊天平台（**Telegram**、**Discord**）无缝连接到本地终端的 **Claude Code**、**OpenAI Codex** 和 Google **Antigravity (agy)** CLI 引擎。

把原本只能坐在电脑桌前运行的强大命令行 Coding Agent，真正塞进你的口袋，随时随地在手机上遥控写代码、做调研、审 PR！

```text
┌──────────────────────────────┐
│  Telegram   /   Discord      │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│     PocketAgent Gateway      │
│ • 通用会话历史与账本         │
│ • /engine 动态引擎热切换     │
│ • 动态模型/思考模式探测发现  │
│ • 转场注射 (Context Handover)│
└──────────────┬───────────────┘
   ┌───────────┼───────────┐
   ▼           ▼           ▼
 Claude      Codex        Agy
 Code CLI     CLI         CLI
```

---

## ✨ 核心特性

- **三合一引擎原生支持** — 聚合连接 **Claude Code**、**OpenAI Codex** 和 **Antigravity (agy)**，打破工具壁垒。
- **跨 CLI 动态切换 (`/engine` 或 `/cli`)** — 在 Telegram / Discord 中随时弹出 Inline 按钮，一键在 Claude、Codex 和 Agy 之间自由切换。
- **上下文无缝继承（Context Handover Primer）** — 切换 CLI 后，网关自动将之前的对话脉络、关键代码方案与工作区状态打包为结构化引导注入新引擎，新引擎立即接盘继续工作；切回旧引擎还能恢复原生会话并追回增量对话！
- **动态模型发现 (`/model`)** — **绝不在代码中写死模型列表**！网关实时动态探测各 CLI 当前推出的模型（如自动执行 `agy models` 获取最新的 Gemini / Claude 模型），并切出 Inline 按钮网格；同时支持自由输入任何最新模型名，无任何限制。
- **思考模式自适应 (`/effort`)** — 动态感知当前激活引擎，智能映射各引擎的 reasoning effort 档位（`low` / `medium` / `high` / `max`）。
- **双聊天渠道设计** — 生产就绪的 Telegram 机器人支持，同时预留了完整的 Discord Bot 架构接口。
- **全能力进程接管** — 每个会话拉起真正的本地 CLI 子进程，拥有完整的文件读写、Bash 命令、Web 搜索与 Git 操作权限。
- **会话多路复用** — 单个聊天支持多会话切换（`/new`、`/sessions` 按钮列表），物理工作区完全隔离。
- **守护进程管理** — 支持后台 Daemon 运行、状态查询、自动重启与 `doctor` 环境体检。
- **本地网关 API** — CLI 智能体可在会话中通过 curl 自动发送文件给用户、下载用户上传的附件、读取群聊历史或修改自身性格（`SOUL.md`）。

---

## 🚀 快速上手

### 1. 环境准备

- **Node.js** >= 22
- 至少安装了以下任意一个 CLI：
  - Claude Code: `npm install -g @anthropic-ai/claude-code`（或本地安装）
  - Antigravity: `agy`
  - OpenAI Codex: `npm install -g @openai/codex`
- Telegram Bot Token（从 [@BotFather](https://t.me/BotFather) 获取）

### 2. 安装与构建

```bash
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent
npm install
npm run build
npm link        # 全局注册 `pocketagent` 和短别名 `pa`
```

### 3. 环境与引擎自检

```bash
pocketagent doctor
# 或者使用超短别名：
pa doctor
```

会输出系统环境以及检测到的 Claude Code、Codex、Agy CLI 状态。

### 4. 配置文件

修改 `~/.pocketagent/config.yaml`（首次运行会自动生成模板）：

```yaml
gateway:
  port: 18790
  dataDir: "~/.pocketagent"

engines:
  default: "claude" # 默认引擎: claude | codex | agy
  claude:
    binary: "claude"
    model: "sonnet"
  agy:
    binary: "agy"
    model: "gemini-3.8-flash-high"
  codex:
    binary: "codex"

auth:
  defaultPolicy: "pairing" # pairing (配对码) | open | allowlist

bots:
  - name: "my-pocket-bot"
    token: "123456:ABC-DEF..."    # Telegram Bot Token
    engine: "claude"              # 默认启动引擎 (可随心通过 /engine 切换)
```

### 5. 启动运行

```bash
# 前台启动调试：
pocketagent start
# 或简写：
pa start

# 后台守护进程启动：
pocketagent daemon start
pocketagent status
pocketagent daemon stop
```

---

## 📱 常用指令

| 指令 | 说明 |
| :--- | :--- |
| `/engine [claude\|codex\|agy]` | 动态切换 CLI 引擎，弹出交互按钮并继承上下文 |
| `/model [name]` | 动态探测并列出当前引擎可用模型，或直接指定任意模型 |
| `/effort [level]` | 设置当前引擎的推理思考深度（如 high, medium, low） |
| `/status` | 查看当前会话状态、活跃引擎、模型、工作区与轮数 |
| `/new` | 新建独立会话 |
| `/sessions [num]` | 查看会话列表并通过 Inline 按钮快速切换 |
| `/btw <问题>` | 侧边栏独立快问，不打断主任务流程 |
| `/stop` | 紧急中断当前正在执行的任务 |
| `/help` | 查看完整帮助说明 |

---

## 🔄 上下文继承机制解析

不同 CLI 具有独立的内部存储格式。PocketAgent 通过四重设计实现平滑接盘：

1. **通用会话历史总账（Universal Ledger）**：网关独立记录每一次对话、发问者、回答引擎和时间戳。
2. **转场注射（Handover Primer）**：当首次切换到新 CLI 时，网关自动将近期关键上下文与目标工作区信息格式化为系统前置引导注入新 CLI，新 CLI 即可无缝接盘。
3. **回切无缝恢复（Round-trip Resume）**：如果切回之前使用过的 CLI，网关恢复其原生会话，并将期间在其他引擎产生的增量消息补齐同步。
4. **共享代码工作区（Workspace Continuity）**：各引擎均工作在同一个本地工作区目录下，前一个引擎新建或修改的文件，后一个引擎物理可见。

---

## 📄 License

MIT © [happy-shine](https://github.com/happy-shine)
