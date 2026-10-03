export function getTelegramFileSkill(apiPort: number, chatId: string, botId: string, isGroup?: boolean): string {
  return `
## File Transfer API

You can send files to the user and download files the user sent to you via the local Gateway API.

### 1. Send files to user

When the user asks you to send/export/share/download a file, or when your task creates or generates an output file (reports, scripts, images, audio, etc.) that the user needs, use this API to upload it:

\`\`\`bash
curl -s -X POST "http://127.0.0.1:${apiPort}/api/file/upload" \\
  -F "chat_id=${chatId}" \\
  -F "file=@/absolute/path/to/file.ext" \\
  -F "caption=Optional description"
\`\`\`

- \`file\`: Absolute path to the local file (prefixed with \`@\`).
- \`caption\`: Optional text description shown with the file in Telegram.
- For multiple files, call the curl command once per file.

### 2. Download files from user

When the user sends a file (document, photo, audio), the message includes attachment info with a \`file_id\`.
Download it using:

\`\`\`bash
curl -s "http://127.0.0.1:${apiPort}/api/file/download?file_id=<FILE_ID>&bot_id=${botId}" -o /path/to/save/filename.ext
\`\`\`
`.trim();
}

export function getTelegramButtonsSkill(): string {
  return `
## Interactive Buttons

When offering the user a discrete choice (e.g. confirming an action, choosing between options, or yes/no), format your question with inline button options using the syntax:

\`\`\`
[button: Choice 1 | Choice 2 | Choice 3]
\`\`\`

The gateway will automatically convert these into tappable Telegram buttons.
`.trim();
}

export { getTelegramFormatSkill, getDiscordFormatSkill } from "./telegram-format.js";
export { SkillRegistry, type SkillInfo, type SkillRegistryOptions } from "./registry.js";

export function getSoulEditorSkill(apiPort: number, botId: string): string {
  return `
## Personality & Soul Management

You have a soul configuration (SOUL.md) defining your personality and behavioral style.
You can read or update your soul via:

\`\`\`bash
# Read current soul:
curl -s "http://127.0.0.1:${apiPort}/api/soul?bot_id=${botId}"

# Update soul:
curl -s -X POST "http://127.0.0.1:${apiPort}/api/soul" \\
  -H "Content-Type: application/json" \\
  -d '{"bot_id":"${botId}","content":"# New soul instructions..."}'
\`\`\`
`.trim();
}

export function getChatHistorySkill(apiPort: number, chatId: string): string {
  return `
## Reading Group Chat History

You can query the group chat history to understand context, summarize discussions, or find specific messages:

\`\`\`bash
curl -s "http://127.0.0.1:${apiPort}/api/chat-history?chat_id=${chatId}&since=2h&limit=100"
\`\`\`
`.trim();
}

export function getSchedulerSkill(apiPort: number, botId: string, chatId: string): string {
  const base = `http://127.0.0.1:${apiPort}/api/cron`;
  return `
## Scheduled Tasks

You can schedule tasks that the gateway runs automatically later, once or on a recurring schedule. Each run starts a fresh session in a dedicated working directory, and its final reply is posted to this chat. Use this when the user wants something to happen at a time or on a schedule (e.g. "every weekday at 9am send me an AI news digest", "remind me tomorrow at 3pm to call Alice").

\`\`\`bash
# Recurring task (5-field cron: minute hour day-of-month month day-of-week)
curl -s -X POST "${base}" -H "Content-Type: application/json" \\
  -d '{"bot_id":"${botId}","chat_id":"${chatId}","name":"AI news digest","cron":"0 9 * * 1-5","prompt":"Search the web for the most important AI news of the last 24 hours and write a concise digest in Chinese."}'

# One-off task
curl -s -X POST "${base}" -H "Content-Type: application/json" \\
  -d '{"bot_id":"${botId}","chat_id":"${chatId}","name":"Call Alice","at":"2026-01-31 15:00","prompt":"Reply with a short reminder: call Alice about the contract."}'

# List this chat's tasks
curl -s "${base}?bot_id=${botId}&chat_id=${chatId}"

# Edit, pause or resume: send only the fields to change ("enabled":false pauses)
curl -s -X POST "${base}/update" -H "Content-Type: application/json" -d '{"id":"<TASK_ID>","enabled":false}'

# Run now / delete
curl -s -X POST "${base}/run?id=<TASK_ID>"
curl -s -X DELETE "${base}?id=<TASK_ID>"
\`\`\`

- Times without a UTC offset, and cron expressions without \`tz\`, use the gateway's local timezone (the same clock as message timestamps). Pass \`"tz":"<IANA name>"\` only if the user asks for another timezone.
- The prompt runs later with no conversation history and nobody to answer questions, so make it self-contained: what to do, which sources, output language and format.
- For monitoring tasks ("tell me when X changes"), have the prompt keep state in files in its working directory and reply exactly [SILENT] when there is nothing new, so nothing is posted.
- Optional fields: \`engine\` (claude|codex|agy|grok), \`model\`, \`effort\`, \`timeout_minutes\`.
- After creating a task, confirm its name, the schedule in plain words, and \`next_run\` from the response. If the API returns an error (e.g. the user is not allowed to manage tasks in this group), relay it.
`.trim();
}
