const DISCORD_SPLIT_LIMIT = 1900;
const FENCE_RE = /^\s*```(\S*)/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const HORIZONTAL_RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;

/**
 * Rewrites Markdown that Discord shows literally into equivalents it renders:
 * tables become lists (readable on phones), #### and deeper headings become bold
 * lines, and horizontal rules become blank lines. Code blocks are left untouched.
 */
export function formatForDiscord(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && isTableRow(lines[i]); i++) rows.push(splitTableRow(lines[i]));
      i--;
      out.push(...tableToList(header, rows));
      continue;
    }

    const deepHeading = line.match(/^\s*#{4,}\s+(.*)$/);
    if (deepHeading) {
      out.push(`**${deepHeading[1].trim()}**`);
      continue;
    }

    if (HORIZONTAL_RULE_RE.test(line)) {
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      // Swallow the blank lines that usually surround a rule so only one remains
      while (i + 1 < lines.length && lines[i + 1].trim() === "") i++;
      continue;
    }

    out.push(line);
  }
  return out.join("\n");
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.length > 1;
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Each row becomes "- **first cell** · Header: value · Header: value". */
function tableToList(header: string[], rows: string[][]): string[] {
  return rows.map((row) => {
    const [first = "", ...rest] = row;
    const parts = rest
      .map((cell, j) => {
        if (!cell) return "";
        const label = stripBold(header[j + 1] ?? "");
        return label ? `${label}: ${cell}` : cell;
      })
      .filter(Boolean);
    const title = first ? `**${stripBold(first)}**` : "";
    return `- ${[title, ...parts].filter(Boolean).join(" · ")}`;
  });
}

function stripBold(cell: string): string {
  return cell.replace(/\*\*(.+?)\*\*/g, "$1");
}

/**
 * Splits text into chunks under Discord's 2000-character message limit, preferring
 * line breaks. A code block cut by a split is closed and reopened in the next chunk.
 */
export function splitDiscordText(text: string, limit = DISCORD_SPLIT_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n", limit);
    if (splitIdx === -1 || splitIdx < limit / 2) {
      splitIdx = remaining.lastIndexOf(" ", limit);
    }
    if (splitIdx === -1 || splitIdx < limit / 2) {
      splitIdx = limit;
    }
    let chunk = remaining.slice(0, splitIdx);
    const rest = remaining.slice(splitIdx);
    const openFence = unclosedFence(chunk);
    if (openFence !== null) {
      chunk += "\n```";
      remaining = "```" + openFence + "\n" + rest.replace(/^\n/, "");
    } else {
      remaining = rest.trimStart();
    }
    chunks.push(chunk);
  }
  return chunks;
}

/** Language of the code block left open at the end of `text`, or null if all blocks are closed. */
function unclosedFence(text: string): string | null {
  let open: string | null = null;
  for (const line of text.split("\n")) {
    const m = FENCE_RE.exec(line);
    if (m) open = open === null ? m[1] : null;
  }
  return open;
}

export function prepareDiscordText(text: string): string[] {
  return splitDiscordText(formatForDiscord(text));
}
