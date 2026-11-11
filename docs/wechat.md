# Native WeChat channel

WeChat uses the same PocketAgent bot lifecycle, engines, sessions, tools, memory,
scheduled tasks, and background jobs as the other channels. The adapter implements
Tencent's iLink bot protocol; it does not control a personal WeChat account or read
unrelated conversations.

## Current support

| Capability | Behavior |
| --- | --- |
| Text replies | Plain text, split into messages of at most 2,000 UTF-16 code units; every returned send ID is tracked. |
| Progress | Native typing indicators; final answers are new messages because WeChat cannot edit the progress message. |
| Built-in menus | Reply to `/engine`, `/model`, `/effort`, `/sessions`, or task menus with a number or exact label. The latest menu is single-use and expires after five minutes. Sending ordinary text cancels it. |
| Photos | Download/decrypt originals; PNG, GIF, and WebP retain their detected format. Local image uploads use the encrypted CDN pipeline. |
| Voice | Preserve server transcripts even when the audio URL is missing or fails; decode SILK to WAV when possible. |
| Video and files | Download/decrypt to the bot's local downloads directory; local video and file uploads are supported by the transport. |
| Restart | Login credentials, polling cursor, and account-scoped reply contexts are persisted. Contexts are sensitive and stored with credentials, never in logs. |
| Delivery errors | HTTP and application errors propagate to callers. A failed attachment upload does not report successful delivery. Missing inbound attachments are explicitly marked unreadable. |

The local integration limits each media transfer to 100 MiB and uses a 60-second
transfer deadline. These are PocketAgent guardrails, not claims about Tencent's
maximum file size. File uploads must be smaller than 100 MiB minus 16 bytes to leave
room for encryption padding.

## Usage and limits

Configure a bot with `channel: wechat` and enable `channels.wechat`. The first start
without credentials requests a login QR code and saves its PNG in the bot's
credentials directory. Scanning and authorizing that QR code is a user action.
Existing credentials are reused on later starts.

The server issues reply contexts in inbound messages. Saving them across restarts
improves continuity but does not make them permanent: an expired context may still
require a fresh message from the recipient before a reply or scheduled report is
accepted. Do not promise unrestricted proactive notifications.

Transporting media is separate from understanding it. The active engine must have
appropriate image/audio/video support or usable transcription/frame-extraction
tools. WAV conversion alone does not give every engine speech recognition. A failed
download must never be described as an inspected photo, audio recording, or video.

Rich HTML, editable messages, native inline buttons, normal personal group access,
and an always-on voice call are not provided by this integration. Conversational
choices can use plain option text. Built-in numbered menu state is intentionally
not persisted; reopen the command after a restart.

## Follow-up work

- Dashboard-managed QR refresh, binding status, and verification-code handling.
- A durable inbound queue with deduplication, so long-running model turns do not
  hold up polling and interruption commands.
- Engine-aware speech transcription and video frame extraction with explicit
  capability reporting and user-controlled resource limits.
- Restore referenced image/file context from a local message index.
- Surface expired-context and media-delivery failures in the channel dashboard.

## Protocol references

Verified against Tencent's [protocol documentation](https://github.com/Tencent/openclaw-weixin/blob/main/docs/protocol.md)
and [CDN URL builders](https://github.com/Tencent/openclaw-weixin/blob/main/src/cdn/cdn-url.ts).
The API origin and CDN origin differ. The CDN fallback query parameter is
`encrypted_query_param`, and outgoing media declares `encrypt_type: 1` with a
base64-encoded hexadecimal AES key, matching the upstream sender.
