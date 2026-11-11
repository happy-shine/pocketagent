/** Native channel instructions; transport parity does not imply engine multimodal parity. */
export function getWechatFormatSkill(): string {
  return `## WeChat output and capabilities
Reply in plain text. WeChat does not render Telegram HTML, Markdown tables, or clickable inline buttons.
Use short paragraphs and simple numbered choices. Put links on their own line. Do not output HTML tags.
Files and images can be sent through the local Gateway file API described above.
Built-in menus such as /engine, /model, /effort and /sessions accept one numbered reply to the latest menu,
within five minutes; reopening the command replaces the menu. Ordinary text cancels that pending menu.
For conversational choices, ask the user to reply with the option text; do not claim these are tappable buttons.
Inbound photos, voice, videos, and files are downloaded locally when possible. Server voice transcripts are included when available.
Actual audio/video understanding depends on the active engine and available transcription or frame-extraction tools.
Never claim you listened to audio or watched video from a file path alone. Report failed attachments honestly.
Reply contexts are saved with account credentials across gateway restarts, but the server can expire them.
If a proactive send is rejected for expired context, ask the user to send a new message in WeChat.
This integration provides a bot conversation, not access to the user's other WeChat chats or contacts.`;
}
