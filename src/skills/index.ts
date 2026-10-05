export function getTelegramFileSkill(apiPort: number, chatId: string, botId: string, isGroup?: boolean): string {
  return `
## File Transfer API

You can send files to the user and download files the user sent to you via the local Gateway API.

### 1. Send files to user

When the user asks you to send/export/share/download a file, or when your task creates or generates an output file (reports, scripts, images, audio, etc.) that the user needs, send it to the chat:

\`\`\`bash
curl -s -X POST "http://127.0.0.1:${apiPort}/api/send-file" \\
  -H "Content-Type: application/json" \\
  -d '{"bot_id":"${botId}","chat_id":"${chatId}","file_path":"/absolute/path/to/file.ext","caption":"Optional description"}'
\`\`\`

- \`file_path\`: Absolute path to a local file. Images (jpg, png, gif, webp) are sent as photos, everything else as documents.
- \`caption\`: Optional text shown with the file.
- For multiple files, call the command once per file.

### 2. Download files from user

Files attached to the message you are answering are already downloaded; their local paths appear in the message as \`[Attached ...: /path]\`.
For other files (e.g. a \`media\` entry like \`photo:<FILE_ID>\` or \`document:<FILE_ID>:<name>\` in chat history), download by file id:

\`\`\`bash
curl -s -X POST "http://127.0.0.1:${apiPort}/api/download-file" \\
  -H "Content-Type: application/json" \\
  -d '{"bot_id":"${botId}","file_id":"<FILE_ID>","dest_dir":"/absolute/destination/dir"}'
\`\`\`

The response contains \`local_path\`, the saved file's location.
`.trim();
}

export function getTelegramButtonsSkill(): string {
  return `
## Interactive Buttons

When offering the user a discrete choice (e.g. confirming an action, choosing between options, or yes/no), format your question with inline button options using the syntax:

\`\`\`
[button: Choice 1 | Choice 2 | Choice 3]
\`\`\`

The gateway will automatically convert these into tappable buttons in the chat (Telegram and Discord).
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

export function getBackgroundJobSkill(apiPort: number, botId: string, chatId: string): string {
  const base = `http://127.0.0.1:${apiPort}/api/jobs`;
  return `
## Background Jobs (for genuinely long commands only)

While you wait on a command, this chat is blocked for everyone in it. For the rare command that runs for a long time, hand it to the gateway as a background job instead: the gateway runs it outside your turn, you end your turn, and when the command exits the gateway sends you a message in this same conversation with its exit code and the end of its output, so you can continue the work.

Start a background job ONLY if ALL of these are true:
1. It is one non-interactive shell command or script that you expect to run for MORE THAN 5 MINUTES, and you can point to concrete evidence for that: file size against bandwidth, dataset size, number of epochs, a previous run's duration. Typical cases: downloading multi-GB files or datasets, training or fine-tuning, a full build of a large project, a long crawl or batch-processing run.
2. There is nothing else useful you can do until it finishes.

In every other case run the command directly, as usual. Never use a background job for:
- commands that should finish within a few minutes: package installs, git operations, small or medium downloads, normal builds and test runs, quick scripts;
- reading, editing or searching files, or anything you could do with your normal tools;
- splitting one piece of work into several jobs, or checking on or waiting for another job.
If you are not sure it will take more than 5 minutes, it does not qualify: run it directly. A job that finishes quickly costs the user an extra round trip.

\`\`\`bash
curl -s -X POST "${base}" -H "Content-Type: application/json" -H "X-PocketAgent-Session: $POCKETAGENT_SESSION_ID" \\
  -d '{"bot_id":"${botId}","chat_id":"${chatId}","title":"Download the 40GB dataset","command":"cd /abs/path && wget -c -q --show-progress https://example.com/data.tar","then":"Verify the checksum, extract it and tell the user how many files it contains"}'
\`\`\`

- \`command\` runs with bash in \`cwd\` (defaults to your current workspace). Make it non-interactive and self-contained: absolute paths, \`-y\` flags, resumable downloads (\`wget -c\`, \`curl -C -\`), results written to files. Its output goes to a log file.
- \`then\`: what you will do once it finishes. It is handed back to you with the result.
- Optional: \`cwd\` (absolute path), \`timeout_minutes\` (default 360).
- Keep the \`X-PocketAgent-Session\` header exactly as shown; the shell fills it in. At most 2 jobs per message.
- After starting a job, tell the user in one or two sentences what is running and roughly how long it may take, then END YOUR TURN. Do not sleep, poll, tail the log or check on the job: the gateway will message you when it exits.
- When the gateway's "[Background job #N ...]" message arrives, continue from where you left off and reply with the outcome.
- Only if the user asks about or wants to stop a job: list this chat's jobs with \`curl -s "${base}?bot_id=${botId}&chat_id=${chatId}"\`, stop one with \`curl -s -X POST "${base}/cancel?id=<JOB_ID>" -H "X-PocketAgent-Session: $POCKETAGENT_SESSION_ID"\`. Users can also manage jobs with \`/jobs\`.
`.trim();
}
