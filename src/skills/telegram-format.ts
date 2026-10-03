/**
 * Skill: teach AI to format final replies as Telegram-flavored HTML
 * so the gateway can send them with parse_mode=HTML and render properly.
 */
export function getTelegramFormatSkill(): string {
  return `## Output Formatting (Telegram HTML)

Your final reply to the user is sent through Telegram with \`parse_mode=HTML\`. Output HTML directly — do NOT use Markdown syntax (no \`**bold**\`, \`#headings\`, \`- lists\`, triple-backtick fences, or tables). The gateway passes your text through verbatim.

### Supported tags (only these — anything else will fail to parse)

| Tag | Use for |
|-----|---------|
| \`<b>text</b>\` (alias: \`<strong>\`) | bold |
| \`<i>text</i>\` (alias: \`<em>\`) | italic |
| \`<u>text</u>\` (alias: \`<ins>\`) | underline |
| \`<s>text</s>\` (aliases: \`<strike>\`, \`<del>\`) | strikethrough |
| \`<code>text</code>\` | inline code (monospace, tap-to-copy) |
| \`<pre>text</pre>\` | code block |
| \`<pre><code class="language-python">text</code></pre>\` | code block with syntax hint (language ONLY works on nested \`<code>\` inside \`<pre>\` — never on a standalone \`<code>\`) |
| \`<a href="URL">text</a>\` | link |
| \`<a href="tg://user?id=USER_ID">name</a>\` | mention a Telegram user by numeric id |
| \`<tg-spoiler>text</tg-spoiler>\` | spoiler (hidden until tapped) |
| \`<blockquote>text</blockquote>\` | quote block |
| \`<blockquote expandable>text</blockquote>\` | collapsed-by-default quote (tap to expand — use for long quotes) |

### Escaping rules

Inside text content (between tags), escape these three characters:
- \`<\` → \`&lt;\`
- \`>\` → \`&gt;\`
- \`&\` → \`&amp;\`

Telegram also accepts \`&quot;\` as a named entity. Numeric entities (\`&#60;\` etc.) are supported but unnecessary — stick to the four named ones. Everything else (including \`.\`, \`!\`, \`(\`, \`_\`, etc.) is literal — no escaping needed.

Inside \`<code>\` and \`<pre>\`, escape the same three characters. Tags inside \`<code>\`/\`<pre>\` are NOT parsed — so \`<pre>&lt;div&gt;</pre>\` correctly shows literal \`<div>\` in a code block.

### Layout conventions (no native support → use these)

- **Headings**: wrap in \`<b>\` and put on its own line (Telegram has no \`<h1>\`).
- **Lists**: plain text with \`•\` or \`-\` + space at line start. Nested lists: indent with spaces.
- **Tables**: put the whole table inside a single \`<pre>\` block with spaces for column alignment (monospace font will keep columns aligned).
- **Horizontal rule**: a line of em-dashes like \`———————\` (no native \`<hr>\`).
- **Paragraph spacing**: use blank lines.

### Example of a well-formed reply

\`\`\`
<b>Analysis complete</b>

Found 3 issues in the authentication flow:

• <b>Token expiry</b>: refresh is not triggered on 401
• <b>CSRF check</b>: missing on the <code>/logout</code> endpoint
• <b>Rate limit</b>: login accepts unbounded attempts

Example fix for the token refresh:

<pre><code class="language-typescript">if (response.status === 401) {
  await refreshToken();
  return retry(request);
}</code></pre>

See the <a href="https://example.com/docs">auth docs</a> for context.
\`\`\`

### Rules

- Do NOT wrap your entire reply in \`<pre>\` unless it genuinely is one code block.
- Do NOT use tags not in the table above (\`<h1>\`, \`<div>\`, \`<table>\`, \`<ul>\`, \`<li>\`, \`<br>\`, etc. will break rendering).
- Do NOT mix Markdown and HTML — if you output \`**bold**\` it will show literally as asterisks.
- Nesting is allowed (e.g. \`<b><i>bold italic</i></b>\`) but keep it shallow.
- If unsure whether content needs a tag, leave it plain — plain text always renders.`;
}

export function getDiscordFormatSkill(): string {
  return `## Output Formatting (Discord Markdown)

Your final reply is posted to Discord as a regular message. Discord renders its own Markdown flavor. Use only the syntax below; never HTML.

### Supported syntax

- \`# Title\`, \`## Section\`, \`### Subsection\`: headings. Only these three levels, and the \`#\` must start the line.
- \`-# text\`: subtext, a small grey line. Good for dates, sources and footnotes.
- \`**bold**\`, \`*italic*\`, \`__underline__\`, \`~~strikethrough~~\`, \`||spoiler||\`
- \`\` \`inline code\` \`\`, and fenced code blocks: three backticks on their own line, optionally followed by a language such as \`python\` for highlighting.
- \`> quote\` quotes one line; \`>>> quote\` quotes everything after it until the end of the message.
- \`- item\` or \`1. item\` lists. Nest a sub-item by indenting it with two spaces.
- \`[title](https://example.com)\`: masked link. \`<https://example.com>\`: a link without a preview card.
- \`<t:UNIX_SECONDS:f>\`: a timestamp shown in each reader's own timezone (styles: \`t\` time, \`d\` date, \`f\` date and time, \`R\` relative like "in 2 hours").

### Not supported (these show up as literal characters)

- Tables (\`| a | b |\`): write a list instead, one item per row, e.g. \`- **ES** · 方向: 做多 · 结果: 已达标\`. For columns of numbers, use a code block with space-aligned columns.
- \`####\` and deeper headings: use \`###\` or a **bold** line.
- Horizontal rules (\`---\`, \`***\`): separate sections with a heading or a blank line.
- HTML tags (\`<b>\`, \`<br>\`, \`<pre>\`, ...) and Markdown images (\`![](...)\`). To show an image, send the file with the File Transfer API.

The gateway converts stray tables, deep headings and horizontal rules automatically, but writing Discord syntax yourself reads better.

### Escaping

\`*\`, \`_\`, \`~\`, \`|\` and \`\` \` \`\` are formatting characters, and so is \`>\` at the start of a line. When they are meant literally (cron expressions like \`*/5 * * * *\`, file globs, \`a*b\`), wrap the text in inline code or escape each character with a backslash (\`\\*\`).

### Layout

- Lead with the conclusion, then details under \`###\` headings. Keep paragraphs short and put a blank line between blocks.
- Every bare URL produces a large preview card. Use \`[title](url)\`, or wrap the URL in \`<>\`, unless the preview itself is useful. Never post more than one previewed link per reply.
- Replies over 2000 characters are split into several messages at line breaks, and code blocks are reopened across splits, so long answers are fine. Just avoid single lines over 2000 characters.
- Never use \`@everyone\` or \`@here\`. Mention a user only as \`<@USER_ID>\`, and only when asked to.

### Example of a well-formed reply

\`\`\`\`
### Analysis complete
Found **3 issues** in the authentication flow:
- **Token expiry**: refresh is not triggered on 401
- **CSRF check**: missing on \`/logout\`
  - affects every browser session
- **Rate limit**: login accepts unbounded attempts

\`\`\`ts
if (response.status === 401) await refreshToken();
\`\`\`
-# Details: [auth docs](https://example.com/docs)
\`\`\`\`
`;
}
