import { dashboardClient } from "./dashboard/client.js";
import { describeCron, escapeHtml, mdInline, renderMarkdown, renderRich, renderTgHtml, splitReply } from "./dashboard/lib.js";
import { DASHBOARD_CSS } from "./dashboard/styles.js";

const ICONS: Record<string, string> = {
  pocket: '<path d="M5 6h14v6a7 7 0 0 1-14 0z"/><path d="M5 6l7 4 7-4"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  term: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m7 10 3 2.5L7 15M13 15h4"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1.5M15 13v1.5"/><circle cx="12" cy="3.5" r=".8"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M19 9h3M19 15h3M2 9h3M2 15h3"/>',
  blocks: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><path d="M17.25 14v6.5M14 17.25h6.5"/>',
  shield: '<path d="M12 21.5s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5V12c0 6 7.5 9.5 7.5 9.5z"/><path d="m9 12 2 2 4-4"/>',
  server: '<rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  code: '<path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3v6h6M10 13l-2 2 2 2M14 13l2 2-2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  more: '<circle cx="5.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18.5" cy="12" r="1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  file: '<path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3v6h6"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  pencil: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M20 20v-5a6 6 0 0 0-6-6H4"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  q: '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17h.01"/>',
};

const CHANNEL_ICONS =
  '<symbol id="c-tg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2AABEE"/><path d="M5.3 11.7 16.7 7.3c.55-.2 1 .13.83.95l-1.94 9.13c-.14.65-.53.8-1.07.5l-2.96-2.18-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.02 5.5-4.97c.24-.21-.05-.33-.37-.12l-6.8 4.28-2.93-.91c-.64-.2-.65-.64.14-.95z" fill="#fff"/></symbol>' +
  '<symbol id="c-dc" viewBox="0 0 24 24"><rect width="24" height="24" rx="7" fill="#5865F2"/><path d="M17.2 7.4a13 13 0 0 0-3.2-1l-.4.8a12 12 0 0 0-3.3 0l-.4-.8a13 13 0 0 0-3.2 1C4.9 10.4 4.4 13.3 4.6 16.1a13 13 0 0 0 3.9 2l.8-1.3a8 8 0 0 1-1.3-.6l.3-.2a9.3 9.3 0 0 0 7.9 0l.3.2a8 8 0 0 1-1.3.6l.8 1.3a13 13 0 0 0 3.9-2c.3-3.3-.5-6.1-2.4-8.7z" fill="#fff"/><ellipse cx="9.6" cy="12.9" rx="1.35" ry="1.5" fill="#5865F2"/><ellipse cx="14.4" cy="12.9" rx="1.35" ry="1.5" fill="#5865F2"/></symbol>';

let cached: string | undefined;

/**
 * The dashboard is one self-contained page: styles, an icon sprite, and a script built from the functions in
 * ./dashboard. It only talks to the gateway through the public /api endpoints.
 */
export function getDashboardHtml(): string {
  if (cached) return cached;
  const sprite =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    Object.entries(ICONS)
      .map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`)
      .join("") +
    CHANNEL_ICONS +
    "</defs></svg>";
  // esbuild-based loaders (tsx, vitest) wrap functions in a __name() helper that is not in the page
  const script = ["var __name = function (fn) { return fn; };"]
    .concat([escapeHtml, mdInline, renderMarkdown, renderTgHtml, renderRich, splitReply, describeCron].map((fn) => fn.toString()))
    .concat(`(${dashboardClient.toString()})();`)
    .join("\n")
    // A literal closing script tag inside the code would end the element early
    .replace(/<\/script/gi, "<\\/script");
  cached = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>PocketAgent Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%23E8641B'/><path d='M6 7h12v5a6 6 0 0 1-12 0z M6 7l6 3.5L18 7' fill='none' stroke='white' stroke-width='2' stroke-linejoin='round'/></svg>">
  <style>${DASHBOARD_CSS}</style>
</head>
<body>
${sprite}
<div id="root"></div>
<noscript>PocketAgent Dashboard needs JavaScript.</noscript>
<script>
${script}
</script>
</body>
</html>`;
  return cached;
}
