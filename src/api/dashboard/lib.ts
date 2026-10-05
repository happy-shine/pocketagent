// Pure helpers shared by the dashboard page and the tests. Each function is embedded into the page with
// Function.prototype.toString(), so they must stay self-contained: no imports, and they may only call each other.

export function escapeHtml(str: unknown): string {
  if (str === undefined || str === null || str === "") return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function mdInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
}

// Minimal Markdown renderer. Input is escaped first, so only the tags below are produced.
export function renderMarkdown(src: string): string {
  const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let listItems: string[] | null = null;
  const flushPara = () => {
    if (para.length) out.push("<p>" + para.map(mdInline).join("<br>") + "</p>");
    para = [];
  };
  const flushList = () => {
    if (listItems) out.push('<div class="md-list">' + listItems.join("") + "</div>");
    listItems = null;
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };
  const tableCells = (row: string) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    let m: RegExpMatchArray | null;

    if (trimmed.startsWith("```")) {
      flushAll();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      out.push("<pre><code>" + escapeHtml(code.join("\n")) + "</code></pre>");
      continue;
    }
    if (!trimmed) {
      flushAll();
      continue;
    }
    if ((m = trimmed.match(/^(#{1,6})\s+(.*)$/))) {
      flushAll();
      out.push("<h" + m[1].length + ">" + mdInline(m[2]) + "</h" + m[1].length + ">");
      continue;
    }
    if (/^([-*_━─=])(\s*\1){2,}$/.test(trimmed)) {
      flushAll();
      out.push("<hr>");
      continue;
    }
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      flushAll();
      const head = tableCells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(tableCells(lines[i]));
      i--;
      out.push(
        "<table><thead><tr>" + head.map((c) => "<th>" + mdInline(c) + "</th>").join("") + "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + r.map((c) => "<td>" + mdInline(c) + "</td>").join("") + "</tr>").join("") +
          "</tbody></table>",
      );
      continue;
    }
    if ((m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))) {
      flushPara();
      if (!listItems) listItems = [];
      const level = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
      const marker = /\d/.test(m[2]) ? escapeHtml(m[2]) : "&bull;";
      listItems.push(
        '<div class="md-li" style="margin-left: ' + level * 1.25 + 'rem;"><span class="md-marker">' + marker + "</span><span>" + mdInline(m[3]) + "</span></div>",
      );
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushAll();
      out.push("<blockquote>" + mdInline(trimmed.replace(/^>\s?/, "")) + "</blockquote>");
      continue;
    }
    if ((m = trimmed.match(/^-#\s+(.*)$/))) {
      // Discord subtext
      flushAll();
      out.push('<p class="md-small">' + mdInline(m[1]) + "</p>");
      continue;
    }
    if (listItems && /^\s+/.test(line)) {
      // Indented continuation of the previous list item
      const last = listItems.length - 1;
      listItems[last] = listItems[last].replace(/<\/span><\/div>$/, "<br>" + mdInline(trimmed) + "</span></div>");
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushAll();
  return out.join("");
}

/** Telegram replies are written in Telegram's HTML subset; keep those tags and escape everything else. */
export function renderTgHtml(src: string): string {
  const h = escapeHtml(src)
    .replace(/&lt;pre&gt;&lt;code class=&quot;[\w+#-]*&quot;&gt;/gi, "<pre><code>")
    .replace(/&lt;(\/?)(b|strong|i|em|u|ins|s|strike|del|code|pre|blockquote)&gt;/gi, (_m, slash, tag) => "<" + slash + String(tag).toLowerCase() + ">")
    .replace(/&lt;blockquote expandable&gt;/gi, "<blockquote>")
    .replace(/&lt;(tg-spoiler|span class=&quot;tg-spoiler&quot;)&gt;/gi, '<span class="spoiler">')
    .replace(/&lt;\/(tg-spoiler|span)&gt;/gi, "</span>")
    .replace(/&lt;a href=&quot;(https?:\/\/.*?)&quot;&gt;/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">')
    .replace(/&lt;\/a&gt;/gi, "</a>");
  return '<div class="tg">' + h + "</div>";
}

/** Assistant replies are Markdown, except on Telegram where they use its HTML subset. */
export function renderRich(src: string): string {
  return /<\/?(b|strong|i|em|u|s|code|pre|blockquote|tg-spoiler)>|<a href="https?:/i.test(String(src || "")) ? renderTgHtml(src) : renderMarkdown(src);
}

/** Splits the "[In reply to Name: quoted text]" prefix the channels add to replies. */
export function splitReply(text: string): { who: string; quote: string; body: string } | null {
  const s = String(text || "");
  const prefix = "[In reply to ";
  if (!s.startsWith(prefix)) return null;
  let end = s.indexOf("]\n");
  if (end < 0) end = s.endsWith("]") ? s.length - 1 : -1;
  if (end < 0) return null;
  const inner = s.slice(prefix.length, end);
  const colon = inner.indexOf(": ");
  return {
    who: colon > 0 ? inner.slice(0, colon) : "",
    quote: colon > 0 ? inner.slice(colon + 2) : inner,
    body: s.slice(end + 1).replace(/^\n/, ""),
  };
}

/** Plain-language form of the common cron shapes; returns null when the expression is better shown as-is. */
export function describeCron(expr: string, lang: string): string | null {
  const zh = lang === "zh";
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [mi, hr, dom, mon, dow] = parts;
  const num = (v: string) => /^\d+$/.test(v);
  const pad = (n: string) => String(Number(n)).padStart(2, "0");
  const time = () => pad(hr) + ":" + pad(mi);
  const dayNames = zh ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六", "周日"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let m: RegExpMatchArray | null;
  if ((m = mi.match(/^\*\/(\d+)$/)) && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return zh ? "每 " + m[1] + " 分钟" : "Every " + m[1] + " min";
  }
  if (mi === "*" && hr === "*" && dom === "*" && mon === "*" && dow === "*") return zh ? "每分钟" : "Every minute";
  if (num(mi) && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return zh ? "每小时第 " + Number(mi) + " 分" : "Hourly at :" + pad(mi);
  }
  if (num(mi) && (m = hr.match(/^\*\/(\d+)$/)) && dom === "*" && mon === "*" && dow === "*") {
    return zh ? "每 " + m[1] + " 小时" + (Number(mi) ? "（第 " + Number(mi) + " 分）" : "") : "Every " + m[1] + " h" + (Number(mi) ? " at :" + pad(mi) : "");
  }
  if (!num(mi) || !num(hr) || mon !== "*") return null;
  if (dom === "*" && dow === "*") return (zh ? "每天 " : "Daily ") + time();
  if (dom === "*") {
    if (dow === "1-5" || dow === "MON-FRI") return (zh ? "工作日 " : "Weekdays ") + time();
    if (dow === "0,6" || dow === "6,0" || dow === "6,7" || dow === "SAT,SUN") return (zh ? "周末 " : "Weekends ") + time();
    if (/^[0-7](,[0-7])*$/.test(dow)) {
      const days = dow.split(",").map((d) => dayNames[Number(d)]);
      return (zh ? "每" + days.join("、") + " " : days.join(", ") + " ") + time();
    }
    if ((m = dow.match(/^([0-7])-([0-7])$/))) {
      return (zh ? dayNames[Number(m[1])] + "至" + dayNames[Number(m[2])] + " " : dayNames[Number(m[1])] + "–" + dayNames[Number(m[2])] + " ") + time();
    }
    return null;
  }
  if (num(dom) && dow === "*") return zh ? "每月 " + Number(dom) + " 日 " + time() : "Monthly on day " + Number(dom) + " " + time();
  return null;
}
