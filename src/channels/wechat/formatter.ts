import type { InlineButton } from "../types.js";

/**
 * Strips HTML tags and formats code blocks for WeChat's plain text display.
 */
export function formatWechatText(input: string): string {
  if (!input) return "";

  let text = input;

  // Replace <pre><code class="language-*">...</code></pre> or <pre><code>...</code></pre>
  text = text.replace(/<pre><code(?:\s+class="[^"]*")?>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    return `\n---\n${code.trim()}\n---\n`;
  });
  text = text.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, code) => {
    return `\n---\n${code.trim()}\n---\n`;
  });

  // Inline code <code>foo</code> -> `foo`
  text = text.replace(/<code>(.*?)<\/code>/gi, "`$1`");

  // Bold <b>foo</b>, <strong>foo</strong> -> foo
  text = text.replace(/<(?:b|strong)>(.*?)<\/(?:b|strong)>/gi, "$1");

  // Italic <i>foo</i>, <em>foo</em> -> foo
  text = text.replace(/<(?:i|em)>(.*?)<\/(?:i|em)>/gi, "$1");

  // Underline <u>foo</u>, <ins>foo</ins> -> foo
  text = text.replace(/<(?:u|ins)>(.*?)<\/(?:u|ins)>/gi, "$1");

  // Strikethrough <s>foo</s>, <del>foo</del>, <strike>foo</strike> -> foo
  text = text.replace(/<(?:s|del|strike)>(.*?)<\/(?:s|del|strike)>/gi, "$1");

  // Links <a href="url">text</a> -> text (url)
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, href, content) => {
    if (content.trim() === href.trim()) return href;
    return `${content} (${href})`;
  });

  // Clean any remaining HTML tags
  text = text.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text.trim();
}

/**
 * Formats inline buttons as a readable numbered list appended to the message.
 */
export function formatButtonsAsText(text: string, buttons: InlineButton[][]): string {
  const flat = buttons.flat().filter(Boolean);
  if (flat.length === 0) return text;

  const lines = [text.trim(), "", "【请选择回复编号或内容】"];
  flat.forEach((btn, idx) => {
    lines.push(`${idx + 1}. ${btn.text}`);
  });

  return lines.join("\n");
}

/**
 * Splits text into chunks below maxLength (default 2000 chars for WeChat).
 */
export function splitWechatMessage(text: string, maxLength: number = 2000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      if (line.length > maxLength) {
        // Line itself exceeds max length; hard split
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
