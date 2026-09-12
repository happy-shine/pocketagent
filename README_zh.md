# PocketAgent 🎒

<p align="center">
  <strong>通过 Telegram & Discord 随时随地连接你的 Claude Code、OpenAI Codex 与 Google Antigravity (AGY)。</strong><br>
  打破终端窗口限制，跨端随行、异步交互、远程运维、数据处理与代码编写。
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

## 为什么需要 PocketAgent？

像 **Claude Code**、**OpenAI Codex** 和 Google **Antigravity (AGY)** 这类终端智能体，本质上并不只是代码生成器。它们拥有宿主操作系统的完整权限：跑 Shell 脚本、查系统日志、管理后台服务、运行 Python 处理数据，以及调用各类自定义技能（Skills）。

但它们最大的痛点是：**你必须坐在电脑前守着终端窗口**。

虽然部分工具提供了官方的远程控制或 Web 界面，但在日常使用中仍有明显局限：
- **打破厂商生态绑定**：官方方案仅能控制自家 CLI（Claude 只能连 Claude）。PocketAgent 提供了统一接入网关，无论你偏好使用 Claude Code、OpenAI Codex 还是 Google Antigravity，都能通过同一套 Telegram / Discord 界面直接操作本地机器，无需为不同工具维护多套远程方案，需要时也可随时自由切换。
- **移动端终端折磨 vs. 原生即时通讯**：官方远程方案多采用 Web 终端或独立界面，在移动设备上极易切后台断连、会话超时，且虚拟键盘操作繁琐。PocketAgent 接入 Telegram / Discord，发完消息即可锁屏离开，任务完成后后台自动推送通知。
- **群聊协作与账号共享**：官方远程工具均为单人独占，而 PocketAgent 天然支持拉入团队群组。群成员可以实时共享同一个任务的会话上下文，共同查看执行细节与产出；同时直接复用宿主机上的 CLI 登录授权与账号订阅配额，无需每位成员单独配置环境或订阅付费。

**PocketAgent** 是一个跑在本地的轻量级网关，把这三个 CLI 直接接入到 **Telegram** 与 **Discord**。无论是在手机、平板、远程笔记本还是桌面端聊天软件里，随时随地发条消息，本地电脑就会直接在后台执行任务并推送通知，甚至可以拉入团队群组协同使用，彻底摆脱终端窗口与复杂 SSH 配置的束缚。

```text
    Telegram / Discord (手机 / 平板 / 电脑客户端 / Web)
                          │
                          ▼
            PocketAgent 本地网关 (守护进程)
             ├─ 6 位配对码安全准入
             ├─ 统一会话总账 (Universal Ledger)
             ├─ 3-CLI 技能中心 (~/.pocketagent/skills)
             └─ Web 管理后台 (http://127.0.0.1:18790)
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Claude Code       OpenAI Codex    Google Antigravity
      (CLI)             (CLI)              (AGY)
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                你的本地电脑与操作系统环境
   (Bash/Zsh • Python • Git • 系统服务 • 文件系统 • 自定义技能)
```

---

## 核心特性

- **跨端随行，随地交互**：直接以本地真实进程运行 CLI，拥有完整的 Bash/Zsh、Git、文件读写与网络权限。不只是写代码改 Bug，还能随时排查线上服务故障、查看运行日志、调用本地脚本、跑数据分析任务。
- **三引擎无缝切换 (`/engine`)**：在同一个会话中随时切换 Claude Code、Codex 或 Antigravity。PocketAgent 会自动打包过往对话脉络与修改过的文件列表，在切换时无缝移交上下文，无需重复交代背景。
- **3-CLI 技能互通中心**：统一管理自定义技能（位于 `~/.pocketagent/skills/`）。写好的技能会自动软链分发给 Claude、Codex 和 AGY，三端都能用，避免重复开发维护。
- **多 Bot、群聊协同与多渠道支持**：单实例支持同时挂载多个 Telegram 和 Discord Bot，支持私聊与群组。群成员可实时共享会话上下文与宿主机 CLI 账号配额；每个 Bot 可单独指定默认引擎、模型、推理强度（effort）及专属 System Prompt（`SOUL.md`）。
- **本地 Web 管理后台**：内置极简风格的 Web 控制台（`http://127.0.0.1:18790`），支持配置热重载（`Cmd+S`）、会话与工作区文件树浏览、历史轮次追溯以及技能在线编辑与同步。
- **本地运行与配对安全**：纯本地运行，不经过任何第三方云端中转；首次发消息强制要求在终端批准 6 位配对码，杜绝未授权访问。

---

## 常见使用场景

| 场景 | 发送消息 / 指令 | 本地机器实际执行 |
| :--- | :--- | :--- |
| **系统运维** | `看看本地 web 服务为什么一直 502` | CLI 检查端口占用、排查错误日志并定位配置问题，把诊断分析返回到聊天窗口 |
| **数据与日志分析** | `统计一下今天 access.log 里各状态码的分布` | CLI 运行本地 Python 或 awk 脚本统计本地日志并返回汇总 |
| **随时改代码** | `把 auth.ts 里的 token 过期时间改长一点，跑下 vitest` | CLI 自动修改文件并运行测试套件，返回测试结果与 Git Diff |
| **跨模型协作** | 用 Claude 设计架构后，输入 `/engine` 选 `agy` | 自动携带上下文切到 Antigravity，利用大上下文进行全库重构 |

---

## 快速开始

### 1. 环境准备

- **Node.js** >= 22
- 本机至少安装并认证了以下任意一个 CLI：
  - Claude Code (`claude`)
  - Google Antigravity (`agy`)
  - OpenAI Codex (`codex`)
- 一个 Telegram Bot Token（从 [@BotFather](https://t.me/BotFather) 获取）或 Discord Bot Token（从 [Discord 开发者中心](https://discord.com/developers/applications) 获取，在 Bot 页面开启 **MESSAGE CONTENT INTENT**）。

### 2. 下载安装与构建

```bash
git clone https://github.com/happy-shine/pocketagent.git
cd pocketagent
npm install
npm run build
npm link        # 注册全局 `pa` 与 `pocketagent` 命令
```

### 3. 环境检测

```bash
pa doctor
```

自动检测 Node.js 版本并探测本机已安装的 CLI 引擎。

### 4. 配置文件

修改 `~/.pocketagent/config.yaml`（首次启动会自动生成，也支持在 Web 后台直接可视化修改）：

```yaml
defaultEngine: "claude" # 全局默认引擎: claude | codex | agy

bots:
  - name: "my-telegram-bot"
    channel: telegram # telegram | discord
    token: "123456:ABC-DEF..." # Telegram Bot Token
    dmPolicy: pairing # pairing (配对码) | allowlist | open | disabled
    groupPolicy: pairing
    # allowFrom:
    #   - "1465542100"

  # 也可同时接入 Discord 机器人:
  # - name: "my-discord-bot"
  #   channel: discord
  #   token: "MTE3..."
```

### 5. 启动与管理

```bash
# 默认后台守护进程启动:
pa start

# 查看服务状态与端口:
pa status

# 打开 Web 可视化管理后台:
open http://127.0.0.1:18790

# 重启或停止服务:
pa restart
pa stop

# 查看实时运行日志:
tail -f ~/.pocketagent/logs/gateway.log

# 前台调试模式（直观打印彩色运行日志）:
pa start -f
```

### 6. 配对授权

首次在 Telegram/Discord 给机器人发送消息时，机器人会回复一组 6 位配对码（例如 `123456`）。  
在终端执行批准命令（或直接在 Web 后台一键批准）：

```bash
pa pairing approve 123456
```

---

## Bot 交互指令

| 指令 | 作用说明 |
| :--- | :--- |
| `/engine` | 弹出交互菜单，在 Claude / Codex / Agy 之间切换，保留上下文 |
| `/model` | 探测并切换当前引擎支持的最新模型 |
| `/effort` | 调整思考/推理强度级别（`low` / `medium` / `high` / `max`） |
| `/status` | 查看当前会话状态、活跃引擎、工作区物理路径与轮数统计 |
| `/new` | 新开一个干净独立的会话工作区 |
| `/sessions` | 弹出列表，快速切换或查看历史会话 |
| `/btw <问题>` | 侧边栏快问快答，独立执行且不打断当前正在运行的任务 |
| `/stop` | 立即中断当前正在运行的 CLI 轮次 |
| `/help` | 显示指令帮助菜单 |

---

## 命令行 CLI 管理

| 命令 | 描述 |
| :--- | :--- |
| `pa start [-f]` | 启动 PocketAgent 守护进程（加 `-f` 为前台调试模式） |
| `pa status` | 查看守护进程运行状态、PID 及端口占用 |
| `pa restart` | 重启守护进程并加载最新构建 |
| `pa stop` | 停止守护进程 |
| `pa doctor` | 检查系统运行环境与本地 CLI 安装状态 |
| `pa pairing list` | 查看所有待审批的配对授权请求 |
| `pa pairing approve <code>` | 批准客户端发起的配对码 |

---

## 跨引擎上下文衔接机制

各 CLI 的底层对话格式互不相通。通过 `/engine` 切换引擎时，PocketAgent 在底层完成状态衔接：

1. **统一会话总账（Universal Ledger）**：记录每一轮对话输入、智能体输出、调用的工具参数及修改的文件列表。
2. **转场引导（Handover Primer）**：切换到新引擎时，网关将过往核心脉络、修改过的文件清单与当前任务目标压缩提炼为一段结构化的开场引导，让新引擎立即接管。
3. **物理工作区一致**：所有引擎工作在完全相同的本地物理代码目录下，上一引擎产生的文件变动或 Git 提交对新引擎实时可见。

---

## 开源协议

本项目采用 MIT 协议开源 © [happy-shine](https://github.com/happy-shine)
