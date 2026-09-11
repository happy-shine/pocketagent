const TELEGRAM_MAX_LENGTH = 4096;

export function splitMessage(text: string, maxLength = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = remaining.lastIndexOf("\n", maxLength);
    if (splitIdx === -1 || splitIdx < maxLength * 0.5) {
      splitIdx = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength * 0.5) {
      splitIdx = maxLength;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return chunks;
}

export function stripHtml(text: string): string {
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function escapeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert standard Markdown to Telegram-compatible HTML.
 * If the text already has Telegram HTML tags, preserves them and avoids double escaping.
 */
export function markdownToTelegramHtml(text: string): string {
  if (!text) return "";

  // 1. Extract and preserve code blocks
  const codeBlocks: string[] = [];
  let s = text.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = escapeHtmlEntities(code.trimEnd());
    const tag = lang
      ? `<pre><code class="language-${lang}">${escaped}</code></pre>`
      : `<pre>${escaped}</pre>`;
    codeBlocks.push(tag);
    return `\x00CB_${codeBlocks.length - 1}\x00`;
  });

  // 2. Extract and preserve inline code
  const inlineCodes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const escaped = escapeHtmlEntities(code);
    inlineCodes.push(`<code>${escaped}</code>`);
    return `\x00IC_${inlineCodes.length - 1}\x00`;
  });

  // 3. Extract blockquotes (before entity escaping so > is not converted to &gt;)
  s = s.replace(/(?:^[ \t]*>[ \t]?(.*)(?:\r?\n|$))+/gm, (match) => {
    const lines = match.trim().split(/\r?\n/).map((l) => l.replace(/^[ \t]*>[ \t]?/, ""));
    return `\x00BQ_START\x00${lines.join("\n")}\x00BQ_END\x00\n`;
  });

  // 4. Entity escaping for non-HTML text
  const hasHtml = /<\/?(b|i|u|s|code|pre|blockquote|a|tg-spoiler)[^>]*>/i.test(s);
  if (!hasHtml) {
    s = escapeHtmlEntities(s);
  } else {
    // Only escape raw & that are not part of an entity reference
    s = s.replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  }

  // Restore blockquote tags
  s = s.replace(/\x00BQ_START\x00/g, "<blockquote>").replace(/\x00BQ_END\x00/g, "</blockquote>");

  // 5. Headings: # Heading -> <b>Heading</b>
  s = s.replace(/^#{1,6}[ \t]+(.+)$/gm, "<b>$1</b>");

  // 6. Horizontal rules: --- or *** or ___ -> ———————
  s = s.replace(/^(?:---|—{3,}|\*\*\*|___)[ \t]*$/gm, "———————");

  // 7. Bold: **text**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");

  // 8. Italic: *text* or _text_ (when bounded)
  s = s.replace(/(?<!\*)\*([^*\s\n][^*\n]*?[^*\s\n])\*(?!\*)/g, "<i>$1</i>");
  s = s.replace(/(?<![\w_])_([^_\s\n][^_\n]*?[^_\s\n])_(?![\w_])/g, "<i>$1</i>");

  // 9. Strikethrough: ~~text~~
  s = s.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");

  // 10. Bullet lists: lines starting with * or - or + -> •
  s = s.replace(/^([ \t]*)[*+-][ \t]+(.+)$/gm, "$1• $2");

  // 11. Links: [text](url) -> <a href="url">text</a>
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, `<a href="$2">$1</a>`);

  // 12. Restore inline codes
  s = s.replace(/\x00IC_(\d+)\x00/g, (_, idx) => inlineCodes[Number(idx)]);

  // 13. Restore code blocks
  s = s.replace(/\x00CB_(\d+)\x00/g, (_, idx) => codeBlocks[Number(idx)]);

  return s;
}

