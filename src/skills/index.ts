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

export function getTelegramFormatSkill(): string {
  return `
## Telegram Formatting Guidelines

Format your responses cleanly for Telegram:
- Use standard Markdown (*bold*, _italic_, \`code\`, \`\`\`code blocks\`\`\`).
- Avoid deeply nested tables or unsupported HTML tags.
- Keep paragraphs concise for comfortable mobile reading.
`.trim();
}

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
