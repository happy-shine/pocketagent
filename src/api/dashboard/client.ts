// @ts-nocheck
// Browser-side dashboard app. getDashboardHtml() embeds this function's source with toString(), so it runs in the
// page, not in Node: everything it needs must live inside it, apart from the helpers in ./lib.ts, which are embedded
// alongside it (escapeHtml, mdInline, renderMarkdown, renderTgHtml, renderRich, splitReply, describeCron).
// Do not import anything here.

export function dashboardClient() {
  "use strict";

  // ---------------------------------------------------------------- basics
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = escapeHtml;
  const enc = encodeURIComponent;
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const pad2 = (n) => String(n).padStart(2, "0");
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
  };

  let lang = store.get("pa2.lang", (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en");
  let theme = store.get("pa2.theme", "system");
  const L = (zh, en) => (lang === "zh" ? zh : en);

  const ic = (name, cls) => `<svg class="i${cls ? " " + cls : ""}"><use href="#i-${name}"/></svg>`;
  const chn = (ch, cls) => `<svg class="chn${cls ? " " + cls : ""}"><use href="#c-${ch === "discord" ? "dc" : "tg"}"/></svg>`;
  const ENG = { claude: "Claude", codex: "Codex", agy: "AGY", grok: "Grok" };
  const ENG_FULL = { claude: "Claude Code", codex: "OpenAI Codex", agy: "Antigravity", grok: "xAI Grok" };
  const ENGINES = ["claude", "codex", "agy", "grok"];
  const eng = (e) => (e ? `<span class="eng ${esc(e)}">${esc(ENG[e] || e)}</span>` : "");
  const hue = (s) => {
    let h = 0;
    for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  };
  const initial = (s) => esc((Array.from(String(s || "?").trim())[0] || "?").toUpperCase());
  const copyBtn = (text, title) => `<button class="copy" data-act="copy" data-text="${esc(text)}" title="${esc(title || L("复制", "Copy"))}">${ic("copy")}</button>`;
  const tzCity = (tz) => String(tz || "").split("/").pop().replace(/_/g, " ");
  // One-line plain text from Markdown / Telegram HTML, for previews and quotes
  const plain = (s) =>
    String(s || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\[([^\]]+)\]\(<?[^)\s]*>?\)/g, "$1")
      .replace(/(^|\n)\s*(-#|#{1,6})\s+/g, "$1")
      .replace(/[*_`>|]+/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

  // ---------------------------------------------------------------- time
  const WD = { zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
  const wd = (i) => WD[lang][i] || "";
  function tzParts(ts, tz) {
    const opt = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" };
    if (tz) opt.timeZone = tz;
    let parts;
    try {
      parts = new Intl.DateTimeFormat("en-US", opt).formatToParts(new Date(ts));
    } catch {
      delete opt.timeZone;
      parts = new Intl.DateTimeFormat("en-US", opt).formatToParts(new Date(ts));
    }
    const o = {};
    for (const p of parts) o[p.type] = p.value;
    return {
      y: +o.year, m: +o.month, d: +o.day, H: +o.hour % 24, M: +o.minute,
      wd: WD.en.indexOf(o.weekday),
      day: Date.UTC(+o.year, +o.month - 1, +o.day) / 86400000,
    };
  }
  const hhmm = (p) => pad2(p.H) + ":" + pad2(p.M);
  const dayDiff = (ts, tz) => tzParts(ts, tz).day - tzParts(Date.now(), tz).day;
  function fmtWhen(ts, tz) {
    if (!ts) return "—";
    const p = tzParts(ts, tz);
    const diff = p.day - tzParts(Date.now(), tz).day;
    let d;
    if (diff === 0) d = L("今天", "Today");
    else if (diff === 1) d = L("明天", "Tomorrow");
    else if (diff === -1) d = L("昨天", "Yesterday");
    else if (diff > 1 && diff < 7) d = wd(p.wd);
    else d = p.m + "/" + p.d + " " + wd(p.wd);
    return d + " " + hhmm(p);
  }
  function fullDate(ts, tz) {
    if (!ts) return "—";
    const p = tzParts(ts, tz);
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)} ${hhmm(p)}`;
  }
  function ago(ts) {
    if (!ts) return "—";
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 45) return L("刚刚", "just now");
    if (s < 3600) {
      const m = Math.max(1, Math.round(s / 60));
      return L(m + " 分钟前", m + "m ago");
    }
    const diff = dayDiff(ts);
    const p = tzParts(ts);
    if (diff === 0) {
      const h = Math.floor(s / 3600);
      return L(h + " 小时前", h + "h ago");
    }
    if (diff === -1) return L("昨天 ", "Yesterday ") + hhmm(p);
    if (diff > -7) return wd(p.wd) + " " + hhmm(p);
    return p.m + "/" + p.d;
  }
  function until(ts) {
    if (!ts) return "—";
    const s = (ts - Date.now()) / 1000;
    if (s < 60) return L("马上", "any moment");
    if (s < 3600) {
      const m = Math.round(s / 60);
      return L(m + " 分钟后", "in " + m + "m");
    }
    if (s < 86400) {
      const h = Math.floor(s / 3600);
      const m = Math.round((s % 3600) / 60);
      return h < 10 && m ? L(`${h} 小时 ${m} 分后`, `in ${h}h ${m}m`) : L(h + " 小时后", "in " + h + "h");
    }
    const d = Math.round(s / 86400);
    return L(d + " 天后", "in " + d + "d");
  }
  function dur(ms) {
    if (ms === undefined || ms === null || isNaN(ms)) return "—";
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const x = s % 60;
    if (h) return L(`${h} 小时 ${m} 分`, `${h}h ${m}m`);
    if (m) return L(`${m}分${pad2(x)}秒`, `${m}m ${x}s`);
    return L(`${x} 秒`, `${x}s`);
  }
  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return (h ? h + ":" + pad2(m) : pad2(m)) + ":" + pad2(s % 60);
  }
  function bytes(n) {
    if (!n) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.min(3, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
  }
  function dayHeading(ts) {
    const p = tzParts(ts);
    const diff = dayDiff(ts);
    const base = lang === "zh" ? `${p.m} 月 ${p.d} 日 ${wd(p.wd)}` : `${wd(p.wd)}, ${p.m}/${p.d}`;
    if (diff === 0) return L("今天 · ", "Today · ") + base;
    if (diff === -1) return L("昨天 · ", "Yesterday · ") + base;
    return (p.y !== tzParts(Date.now()).y ? p.y + (lang === "zh" ? " 年 " : " ") : "") + base;
  }
  function uptimeText(long) {
    const g = S.status?.gateway;
    if (!g) return "";
    const sec = (g.uptime || 0) + Math.floor((Date.now() - S.statusAt) / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (long) {
      if (d) return L(`${d} 天 ${h} 小时`, `${d}d ${h}h`);
      if (h) return L(`${h} 小时 ${pad2(m)} 分`, `${h}h ${pad2(m)}m`);
      return L(`${m} 分钟`, `${m}m`);
    }
    return d ? `${d}d ${h}h` : h ? `${h}h ${pad2(m)}m` : `${m}m`;
  }

  // ---------------------------------------------------------------- state
  const S = {
    status: null, statusAt: Date.now(), online: true,
    config: null, yaml: "", configPath: "",
    caps: {}, skills: [], hubDir: "", pairings: [],
    sessions: [], workspaces: [], cron: [], cronTz: "", jobs: [],
    loaded: {}, lastSync: 0,
  };
  let draft = null;
  const ui = {
    route: { page: "overview", args: [] },
    ses: { ch: "all", bot: "", q: "" },
    sesSel: {},
    cronF: { st: "all", bot: "", q: "" },
    jobsF: { st: "all", bot: "", q: "" },
    turns: {}, files: {}, runs: {}, soul: {}, skill: {}, logs: {},
    cronTab: "runs", cronRunSel: {}, cronRaw: false, promptMd: false,
    jobOpen: null, follow: {},
    engOpen: null, reveal: {}, newBot: null,
    rail: false, diffOpen: false,
    compose: {}, yamlText: null, skillText: {},
    pal: null, fb: null,
  };
  let composing = false;
  let pendingRender = false;
  const aliases = store.get("pa2.alias", {});
  const names = store.get("pa2.names", {});

  // ---------------------------------------------------------------- data
  async function api(url, opts) {
    const init = Object.assign({}, opts || {});
    if (init.json !== undefined) {
      init.method = init.method || "POST";
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(init.json);
      delete init.json;
    }
    const res = await fetch(url, init);
    let data = {};
    try {
      data = await res.json();
    } catch {}
    if (!res.ok || data.ok === false) throw new Error(data.error || "HTTP " + res.status);
    return data;
  }

  const loaders = {
    status: async () => {
      try {
        const d = await api("/api/status");
        S.status = d;
        S.statusAt = Date.now();
        S.online = true;
      } catch (e) {
        S.online = false;
        throw e;
      }
    },
    config: async () => {
      const d = await api("/api/config");
      const next = d.config || {};
      // Keep unsaved edits: replay them on top of the config the server now has
      draft = draft && S.config && isDirty() ? rebase(S.config, next) : clone(next);
      S.config = next;
      S.yaml = d.yaml || "";
      S.configPath = d.configPath || "";
    },
    models: async (force) => {
      const d = await api("/api/models" + (force ? "?refresh=true" : ""));
      S.caps = d.capabilities || {};
    },
    skills: async () => {
      const d = await api("/api/skills");
      S.skills = d.skills || [];
      S.hubDir = d.hubDir || "";
    },
    pairings: async () => {
      const d = await api("/api/pairings");
      S.pairings = d.pending || [];
    },
    sessions: async () => {
      const [a, b] = await Promise.all([api("/api/sessions"), api("/api/workspaces")]);
      S.sessions = a.sessions || [];
      S.workspaces = b.workspaces || [];
    },
    cron: async () => {
      const d = await api("/api/cron");
      S.cron = d.jobs || [];
      S.cronTz = d.timezone || "";
    },
    jobs: async () => {
      const d = await api("/api/jobs");
      S.jobs = d.jobs || [];
    },
  };
  const inflight = {};
  async function load(kinds, force) {
    const todo = kinds.filter((k) => !inflight[k]);
    todo.forEach((k) => (inflight[k] = true));
    const res = await Promise.allSettled(todo.map((k) => loaders[k](force)));
    todo.forEach((k, i) => {
      inflight[k] = false;
      if (res[i].status === "fulfilled") S.loaded[k] = true;
    });
    S.lastSync = Date.now();
    onData(todo);
  }
  function onData(kinds) {
    renderSide();
    renderDirty();
    const p = PAGES[ui.route.page];
    if (kinds.length > 1 || kinds.some((k) => p.deps.includes(k))) renderMain();
    else updateLive();
  }

  // Fetches a lazily loaded resource once per stamp, then re-renders.
  function ensure(cache, key, stamp, fetcher) {
    const c = cache[key];
    if (c && (c.loading || c.stamp === stamp)) return c;
    const prev = c && c.data;
    cache[key] = { loading: true, stamp, data: prev, err: null };
    fetcher()
      .then((d) => {
        cache[key] = { loading: false, stamp, data: d, err: null };
        renderMain();
      })
      .catch((e) => {
        cache[key] = { loading: false, stamp, data: prev, err: e.message };
        renderMain();
      });
    return cache[key];
  }

  const POLLS = [
    { kinds: ["status", "pairings"], every: () => 5000 },
    { kinds: ["jobs"], every: () => (S.jobs.some(jobActive) ? 3000 : 8000) },
    { kinds: ["sessions"], every: () => 15000 },
    { kinds: ["cron"], every: () => (S.cron.some((j) => j.running) ? 5000 : 15000) },
  ];
  const lastPoll = {};
  let lastLogPoll = 0;
  function tick() {
    const t = Date.now();
    if (!document.hidden) {
      POLLS.forEach((p, i) => {
        if (t - (lastPoll[i] || t) >= p.every()) {
          lastPoll[i] = t;
          load(p.kinds);
        } else if (!lastPoll[i]) lastPoll[i] = t;
      });
      if (t - lastLogPoll >= 2000) {
        lastLogPoll = t;
        pollLogs();
      }
    }
    updateLive();
  }

  // ---------------------------------------------------------------- derived data
  const botsRt = () => (S.status && S.status.bots) || [];
  const rtById = (id) => botsRt().find((b) => b.botId === id);
  const rtByName = (name) => botsRt().find((b) => b.name === name);
  const botName = (id) => (rtById(id) || {}).name || id;
  const botFace = (id) => {
    const b = rtById(id);
    return b ? String(b.username || b.name).replace(/#\d+$/, "") : "Bot";
  };
  const defaultEngine = () => (draft && draft.engines && draft.engines.default) || (S.status && S.status.defaultEngine) || "claude";
  const chatKey = (botId, chatId) => botId + "|" + chatId;

  let chatMemo = { src: null, list: [] };
  function chats() {
    if (chatMemo.src === S.sessions) return chatMemo.list;
    const map = new Map();
    for (const s of S.sessions) {
      const key = chatKey(s.botId, s.chatId);
      let c = map.get(key);
      if (!c) {
        c = { key, botId: s.botId, botName: s.botName, chatId: s.chatId, channelType: s.channelType, sessions: [], last: 0 };
        map.set(key, c);
      }
      c.sessions.push(s);
      c.last = Math.max(c.last, s.lastActiveAt || 0);
    }
    for (const c of map.values()) {
      c.sessions.sort((a, b) => (b.sessionNum || 0) - (a.sessionNum || 0) || (b.createdAt || 0) - (a.createdAt || 0));
      c.active = c.sessions.find((s) => s.isActive) || c.sessions[0];
    }
    chatMemo = { src: S.sessions, list: Array.from(map.values()).sort((a, b) => b.last - a.last) };
    return chatMemo.list;
  }
  function chatKind(botId, chatId, channelType) {
    const ch = channelType || (rtById(botId) || {}).channel;
    if (ch === "telegram") return String(chatId).startsWith("-") ? "group" : "dm";
    const hint = S.cron.find((j) => j.botId === botId && j.chatId === chatId) || S.jobs.find((j) => j.botId === botId && j.chatId === chatId);
    if (hint) return hint.isGroup ? "channel" : "dm";
    return "channel";
  }
  function chatTitle(botId, chatId, channelType) {
    const key = chatKey(botId, chatId);
    if (aliases[key]) return { text: aliases[key], alias: true };
    const titled = S.sessions.find((s) => s.botId === botId && s.chatId === chatId && s.title);
    if (titled) return { text: titled.title };
    const kind = chatKind(botId, chatId, channelType);
    if (kind === "dm" && names[key]) return { text: names[key], dm: true };
    const tail = String(chatId).replace(/^-/, "").slice(-6);
    const word = kind === "dm" ? L("私聊", "DM") : kind === "group" ? L("群组", "Group") : L("频道", "Channel");
    return { text: word + " ·" + tail, mono: true };
  }
  function chatTitleHtml(botId, chatId, channelType) {
    const t = chatTitle(botId, chatId, channelType);
    if (t.mono) return `<span class="idt">${esc(t.text)}</span>`;
    return esc(t.text) + (t.dm ? ` <span class="chip sm">${L("私聊", "DM")}</span>` : "");
  }
  const chatText = (botId, chatId, ch) => chatTitle(botId, chatId, ch).text;
  function learnName(c, turns) {
    if (chatKind(c.botId, c.chatId, c.channelType) !== "dm" || names[c.key]) return;
    const t = (turns || []).find((x) => x.role === "user" && x.author);
    if (t) {
      names[c.key] = t.author;
      store.set("pa2.names", names);
    }
  }

  const cronFailed = (j) => j.state && (j.state.lastStatus === "error" || j.state.lastStatus === "timeout");
  const cronAttention = (j) => (j.enabled && cronFailed(j)) || (!j.enabled && j.state && j.state.pausedReason);
  const jobActive = (j) => j.status === "running" || j.status === "queued";
  const jobFailed = (j) => j.status === "failed" || j.status === "timeout" || j.status === "lost";
  function cronSched(j) {
    if (j.schedule.kind === "at") return { main: L("仅一次", "Once"), sub: fmtWhen(j.schedule.at, S.cronTz), raw: false };
    const d = describeCron(j.schedule.expr, lang);
    const tz = j.schedule.tz && j.schedule.tz !== S.cronTz ? tzCity(j.schedule.tz) : "";
    return { main: d || j.schedule.expr, sub: j.schedule.expr + (tz ? " · " + tz : ""), raw: !d };
  }
  function runPill(st) {
    switch (st) {
      case "ok": return `<span class="pill ok">${L("成功", "OK")}</span>`;
      case "silent": return `<span class="pill silent">${L("静默", "Silent")}</span>`;
      case "error": return `<span class="pill err">${L("失败", "Failed")}</span>`;
      case "timeout": return `<span class="pill err">${L("超时", "Timed out")}</span>`;
      case "skipped": return `<span class="pill nodot">${L("跳过", "Skipped")}</span>`;
      default: return `<span class="pill nodot">${L("未运行", "Never run")}</span>`;
    }
  }
  function cronPill(j) {
    if (j.running) return `<span class="pill run">${L("运行中", "Running")}</span>`;
    if (!j.enabled) return `<span class="pill warn">${L("已暂停", "Paused")}</span>`;
    return runPill(j.state && j.state.lastStatus);
  }
  function jobResult(j) {
    switch (j.status) {
      case "succeeded": return `<span class="pill ok">${L("退出码 0", "Exit 0")}</span>`;
      case "failed": return `<span class="pill err">${j.exitCode !== undefined && j.exitCode !== null ? L("退出码 ", "Exit ") + esc(j.exitCode) : L("失败", "Failed")}</span>`;
      case "timeout": return `<span class="pill err">${L("超时", "Timed out")}</span>`;
      case "cancelled": return `<span class="pill nodot"${j.cancelledBy ? ` title="${esc(j.cancelledBy)}"` : ""}>${L("已取消", "Cancelled")}</span>`;
      case "lost": return `<span class="pill warn">${L("进程丢失", "Lost")}</span>`;
      case "queued": return `<span class="pill nodot">${L("排队中", "Queued")}</span>`;
      default: return `<span class="pill run">${L("运行中", "Running")}</span>`;
    }
  }
  function jobIcon(j) {
    switch (j.status) {
      case "succeeded": return `<span class="st-ic ok">${ic("check")}</span>`;
      case "failed": return `<span class="st-ic err">${ic("x")}</span>`;
      case "timeout": return `<span class="st-ic err">${ic("hourglass")}</span>`;
      case "cancelled": return `<span class="st-ic mute">${ic("ban")}</span>`;
      case "lost": return `<span class="st-ic warn">${ic("q")}</span>`;
      case "queued": return `<span class="st-ic q"></span>`;
      default: return `<span class="spin"></span>`;
    }
  }
  function callbackHtml(j) {
    switch (j.callback) {
      case "done": return `<span class="cb ok">${ic("check")}${L("已回传", "Sent back")}</span>`;
      case "pending": return `<span class="cb wait">${ic("send")}${L("等待回传", "Pending")}</span>`;
      case "failed": return `<span class="cb err">${ic("alert")}${L("回传失败", "Failed")}</span>`;
      case "skipped": return `<span class="cb mute">${L("无需回传", "Not needed")}</span>`;
      default: return `<span class="cb mute">—</span>`;
    }
  }
  function cronWorkspace(j) {
    return S.workspaces.find((w) => w.botId === j.botId && w.sessionId === "cron-" + j.id);
  }

  // ---------------------------------------------------------------- config draft
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (isObj(v) && Object.keys(v).length === 0);
  const norm = (v) => (isEmpty(v) ? undefined : v);
  const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
  function diffCfg(a, b, path, out) {
    path = path || [];
    out = out || [];
    if (isObj(a) && isObj(b)) {
      for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) diffCfg(a[k], b[k], path.concat(k), out);
      return out;
    }
    if (Array.isArray(a) && Array.isArray(b) && path.length === 1 && path[0] === "bots") {
      const key = (x, i) => (x && x.name) || "#" + i;
      const am = new Map(a.map((x, i) => [key(x, i), x]));
      const bm = new Map(b.map((x, i) => [key(x, i), x]));
      for (const k of new Set(Array.from(am.keys()).concat(Array.from(bm.keys())))) {
        if (!am.has(k)) out.push({ path: ["bots", k], from: undefined, to: L("（新增）", "(added)"), whole: true });
        else if (!bm.has(k)) out.push({ path: ["bots", k], from: L("（存在）", "(present)"), to: undefined, whole: true });
        else diffCfg(am.get(k), bm.get(k), ["bots", k], out);
      }
      return out;
    }
    if (!same(a, b)) out.push({ path, from: a, to: b });
    return out;
  }
  function changes() {
    if (!draft || !S.config) return [];
    const ch = diffCfg(S.config, draft);
    // engines.default and the legacy top-level defaultEngine always move together; show them once
    return ch.some((c) => c.path.join(".") === "engines.default") ? ch.filter((c) => c.path.join(".") !== "defaultEngine") : ch;
  }
  function rebase(old, next) {
    const out = clone(next);
    for (const c of diffCfg(old, draft)) {
      if (c.path[0] !== "bots") {
        const p = c.path.join(".");
        setPath(out, p, clone(getPath(draft, p)));
        continue;
      }
      out.bots = out.bots || [];
      const di = (draft.bots || []).findIndex((b) => b.name === c.path[1]);
      const oi = out.bots.findIndex((b) => b.name === c.path[1]);
      if (c.path.length === 2) {
        if (di >= 0 && oi < 0) out.bots.push(clone(draft.bots[di]));
        else if (di < 0 && oi >= 0) out.bots.splice(oi, 1);
      } else if (di >= 0 && oi >= 0) {
        const p = c.path.slice(2).join(".");
        setPath(out.bots[oi], p, clone(getPath(draft.bots[di], p)));
      }
    }
    return out;
  }
  const isDirty = () => changes().length > 0;
  function pathLabel(p) {
    if (p[0] === "bots") return "bots[" + p[1] + "]" + (p.length > 2 ? "." + p.slice(2).join(".") : "");
    return p.join(".");
  }
  function fmtVal(v, p) {
    if (v === undefined || v === null || v === "") return L("（未设置）", "(unset)");
    if (p.some((k) => /token/i.test(String(k))) && typeof v === "string") return "••••" + v.slice(-4);
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  }
  function pageOfPath(p) {
    const k = p[0];
    if (k === "bots") return "bots";
    if (k === "engines" || k === "defaultEngine" || k === "engine") return "engines";
    if (k === "auth") return "security";
    if (k === "gateway" || k === "scheduler" || k === "jobs") return "gateway";
    return "yaml";
  }

  // Bindings: "a.b.0.c" addresses the draft; "@new.x" addresses the bot being added.
  function bindRoot(path) {
    if (path.startsWith("@new.")) return [ui.newBot, path.slice(5)];
    return [draft, path];
  }
  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const ks = path.split(".");
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] === undefined || o[ks[i]] === null || typeof o[ks[i]] !== "object") o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (val === undefined) delete o[last];
    else o[last] = val;
  }
  const bget = (path) => {
    const [o, p] = bindRoot(path);
    return o ? getPath(o, p) : undefined;
  };
  function bset(path, val) {
    const [o, p] = bindRoot(path);
    if (!o) return;
    setPath(o, p, val);
    if (p === "engines.default") setPath(o, "defaultEngine", val);
  }
  function fromStore(v, conv) {
    if (v === undefined || v === null || v === "") return "";
    if (conv === "min") return +(v / 60000).toFixed(2);
    if (conv === "hour") return +(v / 3600000).toFixed(2);
    if (conv === "sec") return +(v / 1000).toFixed(2);
    return v;
  }
  function toStore(raw, conv) {
    if (raw === "" || raw === undefined || raw === null) return undefined;
    if (!conv) return raw;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    if (conv === "int") return Math.round(n);
    if (conv === "min") return Math.round(n * 60000);
    if (conv === "hour") return Math.round(n * 3600000);
    if (conv === "sec") return Math.round(n * 1000);
    return n;
  }
  const isMod = (path) => !path.startsWith("@") && S.config && draft && !same(getPath(S.config, path), getPath(draft, path));

  // Form helpers
  function fld(label, ctl, o) {
    o = o || {};
    const mod = o.path && isMod(o.path);
    return `<div class="fld${mod ? " mod" : ""}${o.cls ? " " + o.cls : ""}"${o.path ? ` data-fld="${esc(o.path)}"` : ""}><div class="lbl" data-mod="${L("已修改", "Modified")}">${label}</div>${ctl}${o.hint ? `<div class="hint">${o.hint}</div>` : ""}</div>`;
  }
  function inp(path, o) {
    o = o || {};
    const v = fromStore(bget(path), o.conv);
    return `<input class="app-input${o.cls ? " " + o.cls : ""}" type="${o.type || "text"}" data-path="${esc(path)}"${o.conv ? ` data-conv="${o.conv}"` : ""} value="${esc(v)}" placeholder="${esc(o.ph || "")}"${o.step ? ` step="${o.step}"` : ""}${o.min !== undefined ? ` min="${o.min}"` : ""} spellcheck="false" autocomplete="off">`;
  }
  function unitInp(path, unit, o) {
    return `<div class="unit">${inp(path, Object.assign({ type: "number" }, o || {}))}<span>${unit}</span></div>`;
  }
  function selPath(path, options, o) {
    o = o || {};
    const v = bget(path);
    const cur = v === undefined || v === null ? "" : String(v);
    let opts = options.slice();
    if (cur && !opts.some((x) => String(x[0]) === cur)) opts.push([cur, cur]);
    return `<select class="app-input${o.cls ? " " + o.cls : ""}" data-path="${esc(path)}"${o.disabled ? " disabled" : ""}>${opts
      .map(([val, label]) => `<option value="${esc(val)}"${String(val) === cur ? " selected" : ""}>${esc(label)}</option>`)
      .join("")}</select>`;
  }
  function tagsHtml(path, ph) {
    const vals = bget(path) || [];
    return `<div class="tags">${vals
      .map((v, i) => `<span class="chip">${esc(v)}<button data-act="tagDel" data-path="${esc(path)}" data-i="${i}" title="${L("移除", "Remove")}">×</button></span>`)
      .join("")}<input data-tag="${esc(path)}" placeholder="${esc(ph)}" spellcheck="false"></div>`;
  }
  function swPath(path, def) {
    const v = bget(path);
    const on = v === undefined ? def : !!v;
    return `<button class="sw${on ? " on" : ""}" data-act="swPath" data-path="${esc(path)}" data-on="${on ? 1 : 0}" aria-pressed="${on}"></button>`;
  }
  const POLICIES = () => [
    ["pairing", L("配对", "Pairing"), L("陌生人会收到 6 位码，在「安全与配对」批准后才能使用", "Strangers get a 6-digit code to approve here")],
    ["allowlist", L("白名单", "Allowlist"), L("只回复授权列表里的用户和群组", "Only answers listed users and groups")],
    ["open", L("开放", "Open"), L("任何人都能使用，会消耗你的 CLI 额度", "Anyone can use it, on your CLI quota")],
    ["disabled", L("关闭", "Disabled"), L("完全不响应", "Does not respond")],
  ];
  const policyName = (p) => (POLICIES().find((x) => x[0] === p) || [p, p || "—"])[1];
  function policyPill(p, inherited) {
    if (!p) return `<span class="pill nodot muted">—</span>`;
    const cls = p === "pairing" ? "brand" : p === "open" ? "warn" : "";
    return `<span class="pill nodot ${cls}"${p === "disabled" ? ' style="color:var(--ink-3)"' : ""}>${esc(policyName(p))}${inherited ? L(" · 默认", " · default") : ""}</span>`;
  }
  function policyCards(path) {
    const cur = bget(path);
    return `<div class="rc">${POLICIES()
      .map(([v, t, d]) => `<button class="rco${cur === v ? " on" : ""}" data-act="setPath" data-path="${esc(path)}" data-val="${v}"><i></i><div><b>${t}</b><span>${d}</span></div></button>`)
      .join("")}</div>`;
  }

  // Engine model / effort options from the detected capabilities
  function modelOptions(e, firstLabel) {
    const cap = S.caps[e] || {};
    const opts = [["", firstLabel]];
    for (const m of cap.models || []) opts.push([m.id, (m.label || m.id) + (m.isDefault ? L(" · CLI 默认", " · CLI default") : "")]);
    const custom = (draft && draft.engines && draft.engines[e] && draft.engines[e].customModels) || [];
    for (const m of custom) if (!opts.some((o) => o[0] === m.id)) opts.push([m.id, (m.label || m.id) + L(" · 自定义", " · custom")]);
    return opts;
  }
  function effortOptions(e, modelId) {
    const cap = S.caps[e] || {};
    const models = cap.models || [];
    const m = models.find((x) => x.id === modelId) || models.find((x) => x.isDefault);
    const list = (m && m.supportedEfforts && m.supportedEfforts.length ? m.supportedEfforts : cap.efforts || []).map((x) => [x.id, x.label || x.id]);
    const opts = [["", L("默认", "Default")]].concat(list.length ? list : [["low", "low"], ["medium", "medium"], ["high", "high"]]);
    return opts;
  }

  // ---------------------------------------------------------------- shell
  const PAGES = {
    overview: { g: "op", icon: "dash", t: () => L("概览", "Overview"), deps: ["status", "pairings", "cron", "jobs", "sessions"], render: pageOverview },
    sessions: { g: "op", icon: "chat", t: () => L("会话", "Sessions"), deps: ["sessions", "cron", "jobs"], render: pageSessions },
    cron: { g: "op", icon: "clock", t: () => L("定时任务", "Scheduled tasks"), deps: ["cron", "sessions"], render: pageCron },
    jobs: { g: "op", icon: "term", t: () => L("后台作业", "Background jobs"), deps: ["jobs"], render: pageJobs },
    bots: { g: "cfg", icon: "bot", t: () => "Bots", deps: [], render: pageBots },
    engines: { g: "cfg", icon: "cpu", t: () => L("引擎", "Engines"), deps: [], render: pageEngines },
    skills: { g: "cfg", icon: "blocks", t: () => L("技能", "Skills"), deps: [], render: pageSkills },
    security: { g: "cfg", icon: "shield", t: () => L("安全与配对", "Security"), deps: ["pairings"], render: pageSecurity },
    gateway: { g: "cfg", icon: "server", t: () => L("网关与运行时", "Gateway & runtime"), deps: [], render: pageGateway },
    yaml: { g: "cfg", icon: "code", t: () => "config.yaml", deps: [], render: pageYaml },
  };
  const NAV = [
    ["op", () => L("运行", "Operate"), ["overview", "sessions", "cron", "jobs"]],
    ["cfg", () => L("配置", "Configure"), ["bots", "engines", "skills", "security", "gateway", "yaml"]],
  ];

  function mountShell() {
    $("#root").innerHTML = `<div id="app"><aside class="side" id="side"></aside><main class="main" id="main"><header class="top" id="top"></header><div id="offline"></div><div class="body" id="body"></div><div id="dirty"></div></main></div><div class="toasts" id="toasts"></div><div id="layer"></div><div id="palroot"></div>`;
  }
  function renderAll() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = "PocketAgent · " + PAGES[ui.route.page].t();
    renderSide();
    renderMain(true);
    renderDirty();
  }
  function navBadge(k) {
    if (k === "cron") {
      const n = S.cron.filter(cronAttention).length;
      return n ? `<span class="nb err">${n}</span>` : "";
    }
    if (k === "jobs") {
      const n = S.jobs.filter((j) => j.status === "running").length;
      return n ? `<span class="nb run">${n}</span>` : "";
    }
    if (k === "security" && S.pairings.length) return `<span class="nb warn">${S.pairings.length}</span>`;
    if (k === "skills" && Object.keys(ui.skillText).length) return `<span class="nb dirty">•</span>`;
    if (PAGES[k].g === "cfg" && changes().some((c) => pageOfPath(c.path) === k)) return `<span class="nb dirty">•</span>`;
    return "";
  }
  function renderSide() {
    const g = S.status && S.status.gateway;
    const online = S.online && g;
    const themes = [["system", "monitor", L("跟随系统", "System")], ["light", "sun", L("浅色", "Light")], ["dark", "moon", L("深色", "Dark")]];
    $("#side").innerHTML = `
      <div class="brand"><div class="logo">${ic("pocket")}</div><div><div class="bn">PocketAgent</div><div class="bs">${esc(location.host)}</div></div></div>
      <button class="sbtn" data-act="palette" title="${L("搜索或跳转", "Search or jump")} (⌘K)">${ic("search")}<span>${L("搜索或跳转", "Search or jump")}</span><span class="kbd">⌘K</span></button>
      <nav class="nav">${NAV.map(([, label, items]) => `<div class="ng"><div class="ng-t">${label()}</div>${items
        .map((k) => `<a class="ni${ui.route.page === k ? " on" : ""}" href="#/${k}" title="${esc(PAGES[k].t())}">${ic(PAGES[k].icon)}<span>${esc(PAGES[k].t())}</span>${navBadge(k)}</a>`)
        .join("")}</div>`).join("")}</nav>
      <div class="side-foot">
        <div class="hl"><span class="dot ${online ? "ok" : "err"} pulse"></span><span>${online ? L("网关在线", "Gateway online") : S.loaded.status === undefined && S.online ? L("连接中…", "Connecting…") : L("网关离线", "Gateway offline")}</span><span class="muted" data-uptime>${online ? "· " + uptimeText() : ""}</span></div>
        <div class="hs">${online ? `PID ${esc(g.pid)} · ${L("内存", "mem")} ${bytes(g.memory && g.memory.rss)}` : L("自动重试中", "Retrying")}</div>
        <div class="fr"><div class="seg sm">${themes.map(([v, i, t]) => `<button class="${theme === v ? "on" : ""}" data-act="theme" data-v="${v}" title="${t}">${ic(i)}</button>`).join("")}</div><div class="seg sm"><button class="${lang === "zh" ? "on" : ""}" data-act="lang" data-v="zh">中</button><button class="${lang === "en" ? "on" : ""}" data-act="lang" data-v="en">EN</button></div></div>
      </div>`;
  }
  function syncText() {
    if (!S.lastSync) return L("加载中…", "Loading…");
    const s = Math.round((Date.now() - S.lastSync) / 1000);
    return L("自动刷新 · ", "Live · ") + (s < 3 ? L("刚刚", "just now") : L(s + " 秒前", s + "s ago"));
  }
  function canAutoRender() {
    if (composing) return false;
    if ($("#body") && $("#body").querySelector(".menu:not([hidden])")) return false;
    const a = document.activeElement;
    if (!a || a === document.body || !$("#body").contains(a)) return true;
    if (a.matches("[data-filter]")) return true;
    return !a.matches("input,textarea,select");
  }
  function renderMain(force) {
    if (!$("#body")) return;
    if (!force && !canAutoRender()) {
      pendingRender = true;
      return;
    }
    pendingRender = false;
    const p = PAGES[ui.route.page];
    const keep = {};
    $$("[data-keep]").forEach((el) => {
      keep[el.dataset.keep] = { top: el.scrollTop, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 40 };
    });
    const pg = $("#body > .page");
    const pgTop = pg && ui.lastPage === ui.route.page && !pg.dataset.keep ? pg.scrollTop : null;
    const a = document.activeElement;
    const focus = a && a.id && $("#body").contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
    let r;
    try {
      r = p.render(ui.route.args);
    } catch (err) {
      console.error(err);
      r = { html: `<div class="page"><div class="errbox">${ic("alert")}<div>${esc(err && err.stack ? err.stack : err)}</div></div></div>` };
    }
    const crumbs = [p.g === "op" ? L("运行", "Operate") : L("配置", "Configure")].concat(r.crumb || [p.t()]);
    $("#top").innerHTML = `<div class="crumb">${crumbs
      .map((c, i) => (i === crumbs.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)}</span><i>/</i>`))
      .join("")}</div><div class="top-r">${r.actions || ""}${p.deps.length ? `<button class="sync" data-act="refresh" title="${L("立即刷新", "Refresh now")}"><span class="dot ${S.online ? "ok" : "err"}"></span><span data-sync>${syncText()}</span></button>` : ""}</div>`;
    $("#offline").innerHTML = S.online ? "" : `<div class="offline">${ic("alert")}${L("连不上网关，显示的是上次拿到的数据，正在自动重试。", "Can't reach the gateway. Showing the last data received; retrying.")}</div>`;
    $("#body").innerHTML = r.html;
    $$("[data-keep]").forEach((el) => {
      const k = keep[el.dataset.keep];
      if (el.dataset.stick === "bottom" && (!k || k.bottom)) el.scrollTop = el.scrollHeight;
      else if (k) el.scrollTop = k.top;
    });
    const npg = $("#body > .page");
    if (npg && pgTop !== null) npg.scrollTop = pgTop;
    ui.lastPage = ui.route.page;
    if (focus) {
      const el = document.getElementById(focus.id);
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(focus.s, focus.e);
        } catch {}
      }
    }
    if (r.after) r.after();
    updateLive();
  }
  function updateLive() {
    const set = (el, v) => {
      if (el.textContent !== v) el.textContent = v;
    };
    $$("[data-sync]").forEach((el) => set(el, syncText()));
    $$("[data-uptime]").forEach((el) => set(el, S.status ? "· " + uptimeText() : ""));
    $$("[data-uptime-long]").forEach((el) => set(el, uptimeText(true)));
    $$("[data-since]").forEach((el) => set(el, clock(Date.now() - Number(el.dataset.since))));
    $$("[data-ago]").forEach((el) => set(el, ago(Number(el.dataset.ago))));
    $$("[data-until]").forEach((el) => set(el, until(Number(el.dataset.until))));
    $$("[data-expire]").forEach((el) => {
      const left = Number(el.dataset.expire) - Date.now();
      set(el, left > 0 ? L(clock(left) + " 后过期", "expires in " + clock(left)) : L("已过期", "expired"));
      const bar = el.parentElement && el.parentElement.querySelector(".bar i");
      if (bar && el.dataset.total) bar.style.width = Math.max(0, Math.min(100, (left / Number(el.dataset.total)) * 100)) + "%";
    });
  }

  // ---------------------------------------------------------------- router
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h ? h.split("/").map((x) => {
      try {
        return decodeURIComponent(x);
      } catch {
        return x;
      }
    }) : [];
    const page = PAGES[parts[0]] ? parts[0] : "overview";
    return { page, args: PAGES[parts[0]] ? parts.slice(1) : [] };
  }
  function go(page) {
    const args = Array.prototype.slice.call(arguments, 1).filter((x) => x !== undefined && x !== null && x !== "");
    const h = "#/" + [page].concat(args).map(enc).join("/");
    if (location.hash === h) route();
    else location.hash = h;
  }
  function route() {
    const prev = ui.route.page;
    ui.route = parseHash();
    ui.scrolledJob = false;
    ui.jobOpenFromRoute = null;
    closeMenus();
    if (prev !== ui.route.page) {
      const b = $("#body");
      if (b) b.scrollTop = 0;
    }
    renderAll();
  }

  // ---------------------------------------------------------------- overlays
  function toast(msg, type, list) {
    const el = document.createElement("div");
    el.className = "toast";
    const icon = type === "error" ? `<span class="st-ic err">${ic("x")}</span>` : type === "success" ? `<span class="st-ic ok">${ic("check")}</span>` : `<span class="st-ic mute">${ic("info")}</span>`;
    el.innerHTML = `${icon}<div>${esc(msg)}${list && list.length ? `<ul>${list.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join("")}${list.length > 8 ? `<li>…</li>` : ""}</ul>` : ""}</div>`;
    $("#toasts").appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 260);
    }, type === "error" ? 7000 : list && list.length ? 6000 : 3200);
  }
  const fail = (e) => toast(e && e.message ? e.message : String(e), "error");

  function openModal(o) {
    const layer = $("#layer");
    let wrap = o.key ? layer.querySelector(`[data-modal="${o.key}"]`) : null;
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "scrim";
      if (o.key) wrap.dataset.modal = o.key;
      layer.appendChild(wrap);
    }
    wrap.innerHTML = `<div class="modal ${o.size || ""}" role="dialog"><div class="mo-h"><div style="min-width:0"><h2>${o.title}</h2>${o.sub ? `<div class="sub">${o.sub}</div>` : ""}</div><div class="r">${o.headActions || ""}<button class="btn icon sm ghost" data-act="closeModal" title="${L("关闭", "Close")}">${ic("x")}</button></div></div><div class="mo-b${o.flush ? " flush" : ""}">${o.body}</div>${o.foot ? `<div class="mo-f">${o.foot}</div>` : ""}</div>`;
    if (o.onMount) o.onMount(wrap);
    if (o.focus) {
      const f = wrap.querySelector(o.focus);
      if (f) setTimeout(() => f.focus(), 30);
    }
    return wrap;
  }
  function closeModal() {
    const layer = $("#layer");
    const top = layer.lastElementChild;
    if (top) {
      if (top._resolve) top._resolve(null);
      top.remove();
    }
    if (!layer.querySelector('[data-modal="files"]')) ui.fb = null;
  }
  const modalOpen = () => !!$("#layer").lastElementChild;
  function confirmDialog(o) {
    return new Promise((resolve) => {
      const wrap = openModal({
        title: o.title,
        body: `<div style="font-size:13px;line-height:1.6;color:var(--ink-2)">${o.body || ""}</div>${o.check ? `<label class="check" style="margin-top:14px"><input type="checkbox" id="cf-check"${o.check.on ? " checked" : ""}>${o.check.label}</label>` : ""}`,
        foot: `<button class="btn ghost" data-act="closeModal">${L("取消", "Cancel")}</button><button class="btn ${o.danger ? "primary danger" : "primary"}" data-act="confirmOk">${o.ok || L("确定", "OK")}</button>`,
        focus: "[data-act=confirmOk]",
      });
      wrap._resolve = resolve;
    });
  }
  function closeMenus() {
    $$(".menu").forEach((m) => (m.hidden = true));
    if (pendingRender) setTimeout(() => renderMain(), 0);
  }
  function menu(btnHtml, items, right) {
    return `<div class="menu-wrap">${btnHtml.replace("<button", "<button data-menu")}<div class="menu${right ? " right" : ""}" hidden>${items.join("")}</div></div>`;
  }
  const mi = (icon, label, attrs, danger) => `<button ${attrs}${danger ? ' class="danger"' : ""}>${ic(icon)}${label}</button>`;

  // ---------------------------------------------------------------- overview
  function pageOverview() {
    const bots = botsRt();
    const items = [];
    for (const p of S.pairings) {
      const r = p.req || {};
      const group = r.chatId && r.chatId !== r.senderId;
      items.push({
        kind: "warn", icon: "shield", k: L("配对请求", "Pairing request"),
        t: esc(r.senderName || r.senderId) + L(` 想通过 ${esc(p.botName)} ${group ? "在群组里使用" : "私聊"}`, ` wants to use ${esc(p.botName)}${group ? " in a group" : ""}`),
        d: `${L("配对码", "Code")} <span class="code6">${esc(r.code)}</span> · <span data-expire="${esc(r.expiresAt)}"></span>`,
        a: `<button class="btn sm primary" data-act="approve" data-code="${esc(r.code)}">${ic("check")}${L("批准", "Approve")}</button><a class="btn sm ghost" href="#/security">${L("查看", "View")}</a>`,
      });
    }
    for (const j of S.cron) {
      if (j.enabled && cronFailed(j)) {
        const n = (j.state && j.state.consecutiveFailures) || 1;
        items.push({
          kind: "err", icon: "clock",
          k: n > 1 ? L(`定时任务连续失败 ${n} 次`, `Task failed ${n} times in a row`) : L("定时任务失败", "Task failed"),
          t: esc(j.name),
          d: esc(j.state.lastError || (j.state.lastStatus === "timeout" ? L("运行超时", "Timed out") : L("运行失败", "Failed"))) + " · " + esc(ago(j.state.lastRunAt)),
          a: `<a class="btn sm outline" href="#/cron/${enc(j.id)}">${L("查看运行记录", "Run history")}</a><button class="btn sm ghost" data-act="runCron" data-id="${esc(j.id)}"${j.running ? " disabled" : ""}>${ic("play")}${L("重跑", "Run again")}</button>`,
        });
      } else if (!j.enabled && j.state && j.state.pausedReason) {
        items.push({
          kind: "warn", icon: "pause", k: L("定时任务已自动暂停", "Task paused automatically"), t: esc(j.name), d: esc(j.state.pausedReason),
          a: `<a class="btn sm outline" href="#/cron/${enc(j.id)}">${L("查看", "View")}</a>`,
        });
      }
    }
    for (const j of S.jobs) {
      if (!jobFailed(j) || !j.finishedAt || Date.now() - j.finishedAt > 86400000) continue;
      items.push({
        kind: "err", icon: "term", k: L("后台作业失败", "Background job failed"), t: `#${esc(j.seq)} ${esc(j.title)}`,
        d: (j.status === "timeout" ? L("超时", "Timed out") : j.status === "lost" ? L("进程丢失", "Process lost") : L("退出码 ", "Exit code ") + esc(j.exitCode ?? "?")) + " · " + esc(ago(j.finishedAt)) + (j.callback === "done" ? L(" · 结果已回传到聊天", " · result sent to the chat") : ""),
        a: `<a class="btn sm outline" href="#/jobs/${enc(j.id)}">${L("查看日志", "View log")}</a>`,
      });
    }
    const attn = !S.loaded.status
      ? ""
      : items.length
        ? `<div class="sec-h"><h3>${L("需要处理", "Needs attention")}</h3><span class="cnt">${items.length}</span></div><div class="attn">${items
            .map((x) => `<div class="ac ${x.kind}"><div class="ac-ic">${ic(x.icon)}</div><div class="ac-b"><div class="ac-k">${x.k}</div><div class="ac-t">${x.t}</div><div class="ac-d">${x.d}</div><div class="ac-a">${x.a}</div></div></div>`)
            .join("")}</div>`
        : `<div class="allok"><span class="st-ic ok">${ic("check")}</span><span>${L("一切正常：没有待批准的配对、失败的定时任务或后台作业。", "All clear: no pending pairings, failed tasks or failed jobs.")}</span></div>`;

    const dayAgo = Date.now() - 86400000;
    const all = chats();
    const active24 = S.sessions.filter((s) => (s.lastActiveAt || 0) > dayAgo).length;
    const running = S.jobs.filter((j) => j.status === "running").length;
    const queued = S.jobs.filter((j) => j.status === "queued").length;
    const doneToday = S.jobs.filter((j) => j.finishedAt && dayDiff(j.finishedAt) === 0).length;
    const enabled = S.cron.filter((j) => j.enabled);
    const next = enabled.filter((j) => j.state && j.state.nextRunAt).sort((a, b) => a.state.nextRunAt - b.state.nextRunAt);
    const wsBytes = S.workspaces.reduce((n, w) => n + (w.sizeBytes || 0), 0);
    const orphans = S.workspaces.filter((w) => !w.isKnownSession).length;
    const sz = bytes(wsBytes).split(" ");
    const stats = `<div class="stats">
      <div class="st"><div class="st-l">${L("24 小时内活跃", "Active in 24h")}</div><div class="st-v">${active24}<small>${L("个会话", "sessions")}</small></div><div class="st-s">${L(`共 ${S.sessions.length} 个会话 · ${all.length} 个聊天`, `${S.sessions.length} sessions · ${all.length} chats`)}</div></div>
      <div class="st"><div class="st-l">${L("后台作业", "Background jobs")}</div><div class="st-v"${running ? ' style="color:var(--run)"' : ""}>${running}<small>${L("运行中", "running")}</small></div><div class="st-s">${L(`排队 ${queued} · 今天结束 ${doneToday} 个`, `${queued} queued · ${doneToday} finished today`)}</div></div>
      <div class="st"><div class="st-l">${L("定时任务", "Scheduled tasks")}</div><div class="st-v">${enabled.length}<small>/ ${S.cron.length} ${L("启用", "enabled")}</small></div><div class="st-s">${next[0] ? L("下一个 ", "Next ") + esc(fmtWhen(next[0].state.nextRunAt, S.cronTz)) : L("没有待运行的任务", "Nothing scheduled")}</div></div>
      <div class="st"><div class="st-l">${L("工作区占用", "Workspace storage")}</div><div class="st-v">${esc(sz[0])}<small>${esc(sz[1] || "")}</small></div><div class="st-s">${L(`${S.workspaces.length} 个目录 · `, `${S.workspaces.length} folders · `)}${orphans ? `<a href="#/sessions" style="color:var(--warn)">${L(`${orphans} 个孤立目录`, `${orphans} orphaned`)}</a>` : L("无孤立目录", "none orphaned")}</div></div>
    </div>`;

    const recent = all.slice(0, 6).map((c) => {
      const s = c.active;
      const tc = ensure(ui.turns, s.sessionId, s.turnCount + "|" + s.lastActiveAt, () => api(`/api/sessions/turns?botId=${enc(s.botId)}&chatId=${enc(s.chatId)}&sessionId=${enc(s.sessionId)}`));
      const turns = (tc.data && tc.data.turns) || [];
      if (turns.length) learnName(c, turns);
      const last = turns[turns.length - 1];
      let prev = "";
      if (last) {
        const rep = splitReply(last.text);
        const txt = plain(rep ? rep.body : last.text || "");
        prev = `<span class="who">${esc(last.role === "user" ? last.author || L("用户", "User") : botFace(c.botId))}：</span>${esc(txt.slice(0, 160))}`;
      } else if (!tc.loading) prev = `<span class="who">${L("还没有消息", "No messages yet")}</span>`;
      return `<a class="cr" href="#/sessions/${enc(c.botId)}/${enc(c.chatId)}">${chn(c.channelType)}<div class="cr-b"><div class="cr-t"><b>${chatTitleHtml(c.botId, c.chatId, c.channelType)}</b>${eng(s.activeEngine)}<span class="muted ell">${esc(c.botName)} · #${esc(s.sessionNum)}</span></div><div class="cr-p">${prev}</div></div><span class="cr-time" data-ago="${c.last}">${esc(ago(c.last))}</span></a>`;
    });

    const upcoming = next.slice(0, 5).map((j) => {
      const p = tzParts(j.state.nextRunAt, S.cronTz);
      const dd = dayDiff(j.state.nextRunAt, S.cronTz);
      return `<a class="up" href="#/cron/${enc(j.id)}"><div class="up-t">${hhmm(p)}<small>${dd === 0 ? L("今天", "Today") : dd === 1 ? L("明天", "Tomorrow") : p.m + "/" + p.d}</small></div><div class="up-l"><span class="dot ${cronFailed(j) ? "err" : "ok"}"></span></div><div class="up-n"><b>${esc(j.name)}</b><span>${esc(chatText(j.botId, j.chatId, j.channelType))} · ${esc(botName(j.botId))}</span></div></a>`;
    });
    const botRows = bots.map((b) => `<a class="br" href="#/bots">${chn(b.channel)}<b>${esc(b.name)}</b><span class="muted ell">${b.username ? (b.channel === "discord" ? "" : "@") + esc(String(b.username).replace(/^@/, "")) : ""}</span><div class="r">${eng(b.engine)}</div></a>`);
    const engTiles = ENGINES.map((e) => {
      const cap = S.caps[e];
      const n = (cap && cap.models && cap.models.length) || 0;
      const m = (draft && draft.engines && draft.engines[e] && draft.engines[e].model) || ((cap && cap.models && (cap.models.find((x) => x.isDefault) || cap.models[0])) || {}).id;
      return `<a class="et" href="#/engines"><span class="eng ${e}">${ENG_FULL[e]}</span><div>${n ? L(`${n} 个模型`, `${n} models`) + (m ? " · " + esc(m) : "") : L("未检测到", "Not detected")}</div></a>`;
    });

    const de = defaultEngine();
    const head = `<div class="ph"><div><h1>${L("概览", "Overview")}</h1><p>${S.loaded.status ? L(`${bots.length} 个 Bot 在线 · 默认引擎 `, `${bots.length} bots online · default engine `) + eng(de) + L(" · 网关已运行 ", " · up ") + `<span data-uptime-long>${uptimeText(true)}</span>` : L("正在连接网关…", "Connecting to the gateway…")}</p></div></div>`;
    return {
      html: `<div class="page">${head}${attn}${stats}<div class="ovg">
        <div class="card"><div class="card-h"><h3>${L("最近对话", "Recent conversations")}</h3><div class="r"><a class="btn xs ghost" href="#/sessions">${L("全部会话", "All sessions")}${ic("right")}</a></div></div><div>${recent.join("") || `<div class="empty">${L("还没有任何对话", "No conversations yet")}</div>`}</div></div>
        <div class="ovr">
          <div class="card"><div class="card-h"><h3>${L("接下来", "Up next")}</h3><div class="r"><span class="muted" style="font-size:11.5px">${esc(S.cronTz)}</span></div></div><div style="padding:4px 0">${upcoming.join("") || `<div class="empty" style="padding:20px">${L("没有待运行的定时任务", "No upcoming tasks")}</div>`}</div></div>
          <div class="card"><div class="card-h"><h3>Bots</h3><div class="r">${bots.length ? `<span class="pill ok">${L(`${bots.length} 在线`, `${bots.length} online`)}</span>` : ""}</div></div>${botRows.join("") || `<div class="empty" style="padding:20px">${L("还没有运行中的 Bot", "No bots running")}</div>`}</div>
          <div class="card"><div class="card-h"><h3>${L("引擎", "Engines")}</h3></div><div class="egrid">${engTiles.join("")}</div></div>
        </div></div></div>`,
    };
  }

  // ---------------------------------------------------------------- sessions
  function bucket(ts) {
    const d = dayDiff(ts);
    if (d === 0) return L("今天", "Today");
    if (d === -1) return L("昨天", "Yesterday");
    if (d > -7) return L("本周早些时候", "Earlier this week");
    return L("更早", "Older");
  }
  function pageSessions(args) {
    const all = chats();
    const f = ui.ses;
    const q = f.q.trim().toLowerCase();
    const list = all.filter((c) => {
      if (f.ch !== "all" && c.channelType !== f.ch) return false;
      if (f.bot && c.botId !== f.bot) return false;
      if (!q) return true;
      const hay = [chatText(c.botId, c.chatId, c.channelType), c.chatId, c.botName].concat(c.sessions.map((s) => s.sessionId + " " + (s.title || "") + " " + s.activeEngine)).join(" ").toLowerCase();
      return hay.includes(q);
    });
    let cur = args[0] ? all.find((c) => c.botId === args[0] && c.chatId === args[1]) : list[0] || all[0];
    const cnt = (ch) => all.filter((c) => ch === "all" || c.channelType === ch).length;
    const groups = [];
    let lastB = null;
    for (const c of list) {
      const b = bucket(c.last);
      if (b !== lastB) groups.push(`<div class="sl-g">${b}</div>`);
      lastB = b;
      const s = c.active;
      groups.push(`<a class="si${cur && cur.key === c.key ? " on" : ""}" href="#/sessions/${enc(c.botId)}/${enc(c.chatId)}">${chn(c.channelType)}<div class="si-t">${chatTitleHtml(c.botId, c.chatId, c.channelType)}</div><span class="si-time" data-ago="${c.last}">${esc(ago(c.last))}</span><div class="si-m">${esc(c.botName)}${eng(s.activeEngine)}#${esc(s.sessionNum)} · ${L(`${s.turnCount} 轮`, `${s.turnCount} turns`)}${c.sessions.length > 1 ? `<span class="ns">${L(`${c.sessions.length} 个会话`, `${c.sessions.length} sessions`)}</span>` : ""}</div></a>`);
    }
    const orphans = S.workspaces.filter((w) => !w.isKnownSession);
    const botOpts = [["", L("全部 Bot", "All bots")]].concat(botsRt().map((b) => [b.botId, b.name]));
    const left = `<section class="sl">
      <div class="sl-h"><h2>${L("会话", "Sessions")}</h2><span class="muted" style="font-size:12px">${L(`${all.length} 个聊天 · ${S.sessions.length} 个会话`, `${all.length} chats · ${S.sessions.length} sessions`)}</span><button class="btn icon sm outline" style="margin-left:auto" data-act="newSession" title="${L("新建会话", "New session")}">${ic("plus")}</button></div>
      <div class="sl-f">
        <div class="input sm">${ic("search")}<input id="ses-q" data-filter="ses.q" value="${esc(f.q)}" placeholder="${L("搜索聊天、备注、会话 ID…", "Search chats, names, session IDs…")}" spellcheck="false" autocomplete="off"></div>
        <div class="row"><div class="seg sm full" style="flex:1">${[["all", L("全部", "All")], ["telegram", "Telegram"], ["discord", "Discord"]]
          .map(([v, t]) => `<button class="${f.ch === v ? "on" : ""}" data-act="sesCh" data-v="${v}">${t} <i>${cnt(v)}</i></button>`)
          .join("")}</div></div>
        <select class="app-input sm" data-filter="ses.bot">${botOpts.map(([v, t]) => `<option value="${esc(v)}"${f.bot === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
      </div>
      <div class="sl-items" data-keep="sl">${!S.loaded.sessions ? `<div class="empty">${L("加载中…", "Loading…")}</div>` : groups.join("") || `<div class="empty">${all.length ? L("没有匹配的聊天", "No matching chats") : L("还没有会话。在 Telegram 或 Discord 里给 Bot 发条消息就会出现在这里。", "No sessions yet. Message a bot on Telegram or Discord and it shows up here.")}</div>`}</div>
      <div class="sl-foot">${ic("folder")}${orphans.length ? `<a data-act="orphans" style="color:var(--warn)">${L(`孤立工作区 ${orphans.length} 个`, `${orphans.length} orphaned workspaces`)}</a>` : L("孤立工作区 0 个", "No orphaned workspaces")}</div>
    </section>`;

    if (!cur) {
      return {
        html: `<div class="ses norail">${left}<section class="conv"><div class="empty" style="margin:auto">${args[0] ? `<b>${L("找不到这个聊天", "Chat not found")}</b>${L("它可能已经被删除。", "It may have been deleted.")}` : S.loaded.sessions ? L("选择左侧的一个聊天", "Pick a chat on the left") : ""}</div></section></div>`,
      };
    }
    const sel = cur.sessions.find((s) => s.sessionId === ui.sesSel[cur.key]) || cur.active;
    const title = chatTitle(cur.botId, cur.chatId, cur.channelType);
    const kind = chatKind(cur.botId, cur.chatId, cur.channelType);
    const kindWord = kind === "dm" ? L("私聊", "DM") : kind === "group" ? L("群组", "Group") : L("频道", "Channel");

    const shown = cur.sessions.slice(0, 3);
    if (!shown.includes(sel)) shown.push(sel);
    const rest = cur.sessions.filter((s) => !shown.includes(s));
    const sb = (s) => `<button class="sb${s === sel ? " on" : ""}" data-act="pickSession" data-key="${esc(cur.key)}" data-sid="${esc(s.sessionId)}">${s.isActive ? `<span class="dot ok"></span>` : ""}#${esc(s.sessionNum)}${s.isActive ? L(" 当前", " current") : ""}${eng(s.activeEngine)}<span class="muted">${L(`${s.turnCount} 轮`, `${s.turnCount} turns`)}</span></button>`;
    const switcher = shown.map(sb).join("") + (rest.length
      ? menu(`<button class="sb">${L(`更早 ${rest.length} 个`, `${rest.length} older`)}${ic("down")}</button>`, rest.map((s) => `<button data-act="pickSession" data-key="${esc(cur.key)}" data-sid="${esc(s.sessionId)}">#${esc(s.sessionNum)} ${eng(s.activeEngine)}<span class="muted" style="margin-left:auto">${L(`${s.turnCount} 轮`, `${s.turnCount} turns`)} · ${esc(fmtWhen(s.lastActiveAt))}</span></button>`))
      : "");

    const tc = ensure(ui.turns, sel.sessionId, sel.turnCount + "|" + sel.lastActiveAt, () => api(`/api/sessions/turns?botId=${enc(sel.botId)}&chatId=${enc(sel.chatId)}&sessionId=${enc(sel.sessionId)}`));
    const turns = (tc.data && tc.data.turns) || [];
    if (turns.length) learnName(cur, turns);
    let msgs;
    if (tc.err && !tc.data) msgs = `<div class="errbox" style="margin-top:16px">${ic("alert")}<div>${esc(tc.err)}</div></div>`;
    else if (!tc.data) msgs = `<div class="empty"><span class="spin"></span></div>`;
    else msgs = transcript(sel, turns, cur);

    const more = menu(`<button class="btn icon sm ghost" title="${L("更多", "More")}">${ic("more")}</button>`, [
      mi("plus", L("在这个聊天新建会话", "New session in this chat"), `data-act="newSession" data-bot="${esc(cur.botId)}" data-chat="${esc(cur.chatId)}"`),
      mi("pencil", L("修改本地备注名", "Rename locally"), `data-act="alias" data-key="${esc(cur.key)}"`),
      mi("copy", L("复制会话 ID", "Copy session ID"), `data-act="copy" data-text="${esc(sel.sessionId)}"`),
      mi("info", ui.rail ? L("隐藏信息栏", "Hide details") : L("显示信息栏", "Show details"), `data-act="toggleRail"`),
      `<div class="sep"></div>`,
      mi("trash", L("删除这个会话…", "Delete this session…"), `data-act="delSession" data-sid="${esc(sel.sessionId)}" data-key="${esc(cur.key)}"`, true),
    ], true);
    const conv = `<section class="conv">
      <div class="cvh">
        <div class="cvh-1">${chn(cur.channelType)}<h2>${title.mono ? `<span class="idt">${esc(title.text)}</span>` : esc(title.text)}</h2><button class="btn icon xs ghost" data-act="alias" data-key="${esc(cur.key)}" title="${L("修改本地备注名", "Rename locally")}">${ic("pencil")}</button>${title.alias ? `<span class="chip">${L("本地备注", "Local name")}</span>` : ""}<div class="r"><button class="btn sm outline" data-act="setCurrent" data-key="${esc(cur.key)}" data-sid="${esc(sel.sessionId)}"${sel.isActive ? " disabled" : ""} title="${L("让这个聊天之后的消息进入这个会话", "Route new messages in this chat to this session")}">${L("设为当前", "Make current")}</button>${more}</div></div>
        <div class="cvh-2">${esc(cur.botName)} · ${kindWord} <span class="mono">${esc(cur.chatId)}</span>${copyBtn(cur.chatId, L("复制聊天 ID", "Copy chat ID"))}</div>
        <div class="sess">${switcher}</div>
      </div>
      <div class="msgs" data-keep="msgs-${esc(sel.sessionId)}" data-stick="bottom">${msgs}</div>
      <div class="comp"><input class="app-input" id="composer" data-composer="${esc(cur.key)}" value="${esc(ui.compose[cur.key] || "")}" placeholder="${esc(L(`以 ${cur.botName} 的身份发一条消息到这个聊天（Agent 不会回复）`, `Send a message here as ${cur.botName} (the agent won't reply)`))}" autocomplete="off"><button class="btn outline" data-act="send" data-key="${esc(cur.key)}">${ic("send")}${L("发送", "Send")}</button></div>
    </section>`;

    // rail
    const s = sel;
    const effModel = s.model || ((draft && draft.bots && (draft.bots.find((b) => b.name === cur.botName) || {}).model) || (draft && draft.engines && draft.engines[s.activeEngine] && draft.engines[s.activeEngine].model));
    let files = "";
    if (s.workspaceExists) {
      const fc = ensure(ui.files, s.workspacePath + "|", (s.workspaceFileCount || 0) + "|" + (s.workspaceSizeBytes || 0), () => api(`/api/workspaces/files?path=${enc(s.workspacePath)}`).then((d) => d.files || []));
      const fl = fc.data || [];
      files = fl.slice(0, 12).map((x) => `<a class="fl" data-act="files" data-path="${esc(s.workspacePath)}" data-sub="${x.isDir ? esc(x.relPath) : ""}" data-file="${x.isDir ? "" : esc(x.relPath)}">${ic(x.isDir ? "folder" : "file")}<b>${esc(x.name)}</b><span>${x.isDir ? "" : bytes(x.size)}</span></a>`).join("") + (fl.length > 12 ? `<a class="fl" data-act="files" data-path="${esc(s.workspacePath)}"><b class="muted">${L(`还有 ${fl.length - 12} 项…`, `${fl.length - 12} more…`)}</b></a>` : "") || (fc.loading ? `<div class="empty-s">${L("加载中…", "Loading…")}</div>` : `<div class="empty-s">${L("空目录", "Empty")}</div>`);
    }
    const relCron = S.cron.filter((j) => j.botId === cur.botId && j.chatId === cur.chatId);
    const relJobs = S.jobs.filter((j) => j.botId === cur.botId && j.chatId === cur.chatId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const rail = `<aside class="rail" data-keep="rail">
      <div class="rs"><div class="rs-h">${L("会话", "Session")} #${esc(s.sessionNum)}<div class="r">${s.isActive ? `<span class="pill ok">${L("当前", "Current")}</span>` : `<span class="pill nodot">${L("历史", "Past")}</span>`}</div></div>
        <dl class="kv">
          <dt>${L("引擎", "Engine")}</dt><dd>${eng(s.activeEngine)}</dd>
          <dt>${L("模型", "Model")}</dt><dd style="flex-direction:column;align-items:flex-start;gap:0">${s.model ? `<span class="mono">${esc(s.model)}</span>` : `<span class="mono">${esc(effModel || L("CLI 默认", "CLI default"))}</span><span class="muted" style="font-size:11px">${L("跟随默认", "inherited")}</span>`}</dd>
          <dt>${L("推理强度", "Effort")}</dt><dd>${esc(s.effort || L("默认", "default"))}</dd>
          <dt>${L("轮次", "Turns")}</dt><dd>${esc(s.turnCount)}</dd>
          <dt>${L("开始", "Started")}</dt><dd>${esc(fmtWhen(s.createdAt))}</dd>
          <dt>${L("最近活动", "Last active")}</dt><dd data-ago="${s.lastActiveAt}">${esc(ago(s.lastActiveAt))}</dd>
          <dt>${L("会话 ID", "Session ID")}</dt><dd><span class="mono">${esc(s.sessionId.slice(0, 8))}…${esc(s.sessionId.slice(-4))}</span>${copyBtn(s.sessionId)}</dd>
        </dl></div>
      <div class="rs"><div class="rs-h">${L("工作区", "Workspace")}${s.workspaceExists ? `<span class="muted">${L(`${s.workspaceFileCount || 0} 个文件`, `${s.workspaceFileCount || 0} files`)} · ${bytes(s.workspaceSizeBytes)}</span><div class="r">${copyBtn(s.workspacePath, L("复制路径", "Copy path"))}<button class="copy" data-act="files" data-path="${esc(s.workspacePath)}" title="${L("浏览文件", "Browse files")}">${ic("folder")}</button></div>` : ""}</div>${s.workspaceExists ? files : `<div class="empty-s">${L("还没有创建工作区目录", "No workspace folder yet")}</div>`}</div>
      <div class="rs"><div class="rs-h">${L("此聊天的定时任务", "Tasks in this chat")}${relCron.length ? `<span class="cnt">${relCron.length}</span>` : ""}<div class="r"><button class="copy" data-act="newCron" data-bot="${esc(cur.botId)}" data-chat="${esc(cur.chatId)}" title="${L("新建定时任务", "New task")}">${ic("plus")}</button></div></div>${relCron
        .map((j) => `<a class="rel" href="#/cron/${enc(j.id)}">${ic("clock")}<div style="min-width:0"><b>${esc(j.name)}</b><div class="muted" style="font-size:11.5px">${esc(cronSched(j).main)}${j.enabled && j.state.nextRunAt ? " · " + esc(fmtWhen(j.state.nextRunAt, S.cronTz)) : ""}</div></div><span class="r">${cronPill(j)}</span></a>`)
        .join("") || `<div class="empty-s">${L("没有", "None")}</div>`}</div>
      <div class="rs"><div class="rs-h">${L("此聊天的后台作业", "Jobs in this chat")}</div>${relJobs
        .map((j) => `<a class="rel" href="#/jobs/${enc(j.id)}">${jobIcon(j)}<div style="min-width:0"><b>#${esc(j.seq)} ${esc(j.title)}</b><div class="muted" style="font-size:11.5px">${esc(ago(j.finishedAt || j.startedAt || j.createdAt))}</div></div></a>`)
        .join("") || `<div class="empty-s">${L("没有", "None")}</div>`}</div>
      <div class="rs" style="border-bottom:0"><button class="btn sm ghost danger" style="margin-left:-8px" data-act="delSession" data-sid="${esc(s.sessionId)}" data-key="${esc(cur.key)}">${ic("trash")}${L("删除这个会话…", "Delete this session…")}</button></div>
    </aside>`;
    return { crumb: [L("会话", "Sessions"), title.text], html: `<div class="ses${ui.rail ? " showrail" : ""}">${left}${conv}${rail}</div>` };
  }

  function transcript(sess, turns, chat) {
    if (!turns.length) return `<div class="empty" style="margin:auto">${L("这个会话还没有对话", "No messages in this session yet")}</div>`;
    const out = [];
    let lastDay = null;
    let lastEngine = null;
    let prevUserTs = null;
    const firstEngine = (turns.find((t) => t.engine) || {}).engine || sess.activeEngine;
    const startTs = sess.createdAt || turns[0].ts;
    const dayOf = (ts) => {
      const p = tzParts(ts);
      return p.y + "-" + p.m + "-" + p.d;
    };
    if (startTs) {
      lastDay = dayOf(startTs);
      out.push(`<div class="day">${esc(dayHeading(startTs))}</div>`);
      out.push(`<div class="sys"><span>${ic("sparkle")}${L("会话", "Session")} #${esc(sess.sessionNum)} ${L("开始", "started")} · ${esc(ENG[firstEngine] || firstEngine || "")} · ${esc(hhmm(tzParts(startTs)))}</span></div>`);
    }
    const face = botFace(chat.botId);
    for (const t of turns) {
      if (t.ts && dayOf(t.ts) !== lastDay) {
        lastDay = dayOf(t.ts);
        out.push(`<div class="day">${esc(dayHeading(t.ts))}</div>`);
      }
      if (t.engine && lastEngine && t.engine !== lastEngine) {
        out.push(`<div class="sys"><span>${ic("swap")}${L("引擎切换", "Engine switched")} ${esc(ENG[lastEngine] || lastEngine)} → ${esc(ENG[t.engine] || t.engine)}${L(" · 上下文已移交", " · context handed over")}</span></div>`);
      }
      if (t.engine) lastEngine = t.engine;
      const time = t.ts ? hhmm(tzParts(t.ts)) : "";
      if (t.role === "user") {
        prevUserTs = t.ts;
        const rep = splitReply(t.text);
        const who = t.author || L("用户", "User");
        out.push(`<div class="msg u"><div class="av" style="--h:${hue(who)}">${initial(who)}</div><div class="mb"><div class="mh"><b>${esc(who)}</b><span>${esc(time)}</span></div>${rep ? `<div class="reply">${ic("reply")}<span>${L("回复 ", "Reply to ")}${esc(rep.who)}${rep.who ? "：" : ""}${esc(plain(rep.quote))}</span></div>` : ""}<div class="mt">${esc(rep ? rep.body : t.text || "")}</div></div></div>`);
      } else if (t.role === "assistant") {
        const took = prevUserTs && t.ts ? t.ts - prevUserTs : null;
        prevUserTs = null;
        out.push(`<div class="msg a"><div class="av bot">${ic("pocket")}</div><div class="mb"><div class="mh"><b>${esc(face)}</b>${eng(t.engine)}<span>${esc(time)}${took && took > 0 ? L(" · 用时 ", " · took ") + esc(dur(took)) : ""}</span></div><div class="mbody md">${renderRich(t.text || "")}</div></div></div>`);
      } else {
        out.push(`<div class="sys"><span>${ic("info")}${esc(t.text || t.role)}</span></div>`);
      }
    }
    return out.join("");
  }

  // ---------------------------------------------------------------- cron
  function pageCron(args) {
    const f = ui.cronF;
    const q = f.q.trim().toLowerCase();
    const all = S.cron.slice().sort((a, b) => Number(b.enabled) - Number(a.enabled) || ((a.state && a.state.nextRunAt) || Infinity) - ((b.state && b.state.nextRunAt) || Infinity));
    const match = (j) => {
      if (f.bot && j.botId !== f.bot) return false;
      if (f.st === "enabled" && !j.enabled) return false;
      if (f.st === "paused" && j.enabled) return false;
      if (f.st === "attn" && !cronAttention(j)) return false;
      if (q && ![j.name, j.prompt, j.chatId, j.id, chatText(j.botId, j.chatId, j.channelType)].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    };
    const list = all.filter(match);
    const sel = (args[0] && S.cron.find((j) => j.id === args[0])) || list[0] || null;
    const n = { all: S.cron.length, enabled: S.cron.filter((j) => j.enabled).length, paused: S.cron.filter((j) => !j.enabled).length, attn: S.cron.filter(cronAttention).length };
    const tzNote = S.cronTz ? `<span class="tz">${ic("globe")}${L("时间按 ", "Times in ")}${esc(S.cronTz)}${L(" 显示", "")}</span>` : "";
    const botOpts = [["", L("全部 Bot", "All bots")]].concat(botsRt().map((b) => [b.botId, b.name]));
    const rows = list.map((j) => {
      const sc = cronSched(j);
      const st = j.state || {};
      let next;
      if (j.running) next = `<span class="l1">${cronPill(j)}</span><span>${L("开始于 ", "since ")}${esc(fmtWhen(st.lastRunAt, S.cronTz))}</span>`;
      else if (!j.enabled) next = `<b style="font-weight:500">—</b><span>${st.pausedReason ? L("自动暂停", "Auto-paused") : L("已暂停", "Paused")}</span>`;
      else if (st.nextRunAt) next = `<b data-until="${st.nextRunAt}">${esc(until(st.nextRunAt))}</b><span>${esc(fmtWhen(st.nextRunAt, S.cronTz))}</span>`;
      else next = `<b style="font-weight:500">—</b><span>${L("不会再运行", "Won't run again")}</span>`;
      let last;
      if (!st.lastRunAt) last = `<span class="l1">${runPill()}</span>`;
      else {
        const fails = st.consecutiveFailures || 0;
        last = `<span class="l1">${runPill(st.lastStatus)}<span data-ago="${st.lastRunAt}">${esc(ago(st.lastRunAt))}</span></span><span${cronFailed(j) && fails > 1 ? ' style="color:var(--err)"' : ""}>${cronFailed(j) && fails > 1 ? L(`连续失败 ${fails} 次`, `${fails} failures in a row`) : st.lastStatus === "silent" ? L("无新内容，未发消息", "Nothing to post") : (st.lastDurationMs !== undefined ? esc(dur(st.lastDurationMs)) + " · " : "") + L(`共 ${st.runCount || 0} 次`, `${st.runCount || 0} runs`)}</span>`;
      }
      const sub = !j.enabled && st.pausedReason
        ? `<span class="pause">${ic("alert")}${esc(st.pausedReason)}</span>`
        : `<span>${chn(j.channelType)}${esc(chatText(j.botId, j.chatId, j.channelType))} · ${esc(botName(j.botId))}</span>`;
      return `<div class="tr${sel && sel.id === j.id ? " sel" : ""}${j.enabled ? "" : " off"}" data-go="cron|${esc(j.id)}"><span><button class="sw${j.enabled ? " on" : ""}" data-act="toggleCron" data-id="${esc(j.id)}" title="${j.enabled ? L("暂停", "Pause") : L("启用", "Enable")}"></button></span><div class="c2"><b>${esc(j.name)}</b>${sub}</div><div class="c2"><b${sc.raw ? ' class="mono" style="font-size:12.5px"' : ""}>${esc(sc.main)}</b><span class="mono">${esc(sc.sub)}</span></div><div class="c2">${next}</div><div class="c2">${last}</div></div>`;
    });
    const table = `<div class="card tbl cron-t" data-keep="cron-t"><div class="th"><span></span><span>${L("任务", "Task")}</span><span>${L("计划", "Schedule")}</span><span>${L("下次运行", "Next run")}</span><span>${L("上次运行", "Last run")}</span></div>${rows.join("") || `<div class="empty">${!S.loaded.cron ? L("加载中…", "Loading…") : S.cron.length ? L("没有匹配的任务", "No matching tasks") : `<b>${L("还没有定时任务", "No scheduled tasks yet")}</b>${L("可以在这里新建，也可以直接在聊天里让 Agent 帮你建。", "Create one here, or just ask the agent in a chat.")}<br><button class="btn primary" data-act="newCron">${ic("plus")}${L("新建任务", "New task")}</button>`}</div>`}</div>`;
    const det = sel ? cronDetail(sel) : `<aside class="card det"><div class="empty" style="margin:auto">${L("选择一个任务查看运行记录", "Pick a task to see its runs")}</div></aside>`;
    return {
      crumb: sel && args[0] ? [L("定时任务", "Scheduled tasks"), sel.name] : null,
      html: `<div class="page fill">
        <div class="ph"><div><h1>${L("定时任务", "Scheduled tasks")}</h1><p>${L("按计划运行提示词，把结果发到对应聊天。每次运行都是全新会话，工作目录按任务保留。", "Prompts the gateway runs on a schedule and posts to their chat. Each run is a fresh session; the working folder is kept per task.")}</p></div><div class="act"><button class="btn primary" data-act="newCron">${ic("plus")}${L("新建任务", "New task")}</button></div></div>
        <div class="tb"><div class="seg">${[["all", L("全部", "All")], ["enabled", L("启用", "Enabled")], ["paused", L("已暂停", "Paused")], ["attn", L("异常", "Attention")]]
          .map(([v, t]) => `<button class="${f.st === v ? "on" : ""}${v === "attn" && n.attn ? " err" : ""}" data-act="cronSt" data-v="${v}">${t} <i>${n[v]}</i></button>`)
          .join("")}</div><select class="app-input" data-filter="cronF.bot">${botOpts.map(([v, t]) => `<option value="${esc(v)}"${f.bot === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><div class="input">${ic("search")}<input id="cron-q" data-filter="cronF.q" value="${esc(f.q)}" placeholder="${L("搜索名称、提示词、聊天…", "Search name, prompt, chat…")}" autocomplete="off"></div>${tzNote}</div>
        <div class="split">${table}${det}</div>
      </div>`,
    };
  }
  function cronDetail(j) {
    const st = j.state || {};
    const ws = cronWorkspace(j);
    const tab = ui.cronTab;
    const timeoutMin = Math.round((j.timeoutMs || (S.config && S.config.scheduler && S.config.scheduler.defaultTimeoutMs) || 1800000) / 60000);
    const via = j.createdBy ? (j.createdBy.senderName ? esc(j.createdBy.senderName) + L(" 通过", " via ") + (j.createdBy.via === "agent" ? L("对话", " chat") : j.createdBy.via === "command" ? L("命令", " command") : " API") + L("创建", "") : L("通过 ", "via ") + esc(j.createdBy.via)) : "";
    const notes = (!j.enabled && st.pausedReason ? `<div class="note warn">${ic("alert")}<div>${L("已自动暂停：", "Paused automatically: ")}${esc(st.pausedReason)}</div></div>` : "") + (j.enabled && cronFailed(j) && st.lastError ? `<div class="errbox">${ic("alert")}<div>${esc(st.lastError)}</div></div>` : "");
    let body = "";
    if (tab === "runs") {
      const rc = ensure(ui.runs, j.id, `${st.runCount}|${st.lastRunAt}|${j.running}`, () => api(`/api/cron/runs?id=${enc(j.id)}`).then((d) => d.runs || []));
      const runs = (rc.data || []).slice().sort((a, b) => b.runNum - a.runNum);
      if (rc.err && !rc.data) body = `<div class="errbox">${ic("alert")}<div>${esc(rc.err)}</div></div>`;
      else if (!rc.data) body = `<div class="empty"><span class="spin"></span></div>`;
      else if (!runs.length) body = `<div class="empty">${L("还没有运行过", "Hasn't run yet")}${j.state.nextRunAt ? "<br>" + L("第一次运行：", "First run: ") + esc(fmtWhen(j.state.nextRunAt, S.cronTz)) : ""}</div>`;
      else {
        const selNum = ui.cronRunSel[j.id] || runs[0].runNum;
        const last14 = runs.slice(0, 14).reverse();
        const pads = Array(14 - last14.length).fill(`<i class="e"></i>`).join("");
        const counted = runs.filter((r) => r.status !== "skipped");
        const okN = counted.filter((r) => r.status === "ok" || r.status === "silent").length;
        const cls = (s) => (s === "ok" ? "ok" : s === "silent" ? "silent" : s === "skipped" ? "skipped" : "err");
        body = `<div class="strip-row">${L("最近 14 次", "Last 14")}<div class="strip">${pads}${last14.map((r) => `<i class="${cls(r.status)}${r.runNum === selNum ? " cur" : ""}" data-act="cronRun" data-id="${esc(j.id)}" data-n="${r.runNum}" title="#${r.runNum} ${esc(fullDate(r.startedAt, S.cronTz))}"></i>`).join("")}</div><span style="margin-left:auto">${counted.length ? L("成功率 ", "Success ") + Math.round((okN / counted.length) * 100) + "%" : ""}</span></div>` +
          runs.slice(0, 30).map((r) => {
            const open = r.runNum === selNum;
            const head = `<div class="run-h" data-act="cronRun" data-id="${esc(j.id)}" data-n="${r.runNum}">${runPill(r.status)}<b>#${r.runNum}</b><span>${esc(fmtWhen(r.startedAt, S.cronTz))} · ${r.trigger === "manual" ? L("手动", "manual") : L("计划", "scheduled")}</span><span class="r">${r.status === "skipped" ? "" : esc(clock(r.finishedAt - r.startedAt))}</span></div>`;
            return `<div class="run${open ? " sel" : ""}">${head}${open ? `<div class="run-x">${runBody(r)}</div>` : ""}</div>`;
          }).join("");
      }
    } else if (tab === "prompt") {
      body = `<div class="out-l">${L("提示词", "Prompt")}<div class="r"><button class="btn xs ghost" data-act="promptMd">${ui.promptMd ? L("原文", "Raw") : L("渲染", "Rendered")}</button>${`<button class="btn xs ghost" data-act="copy" data-text="${esc(j.prompt)}">${ic("copy")}${L("复制", "Copy")}</button>`}</div></div><div class="prompt-box">${ui.promptMd ? `<div class="md">${renderMarkdown(j.prompt)}</div>` : `<pre class="raw">${esc(j.prompt)}</pre>`}</div>`;
    } else {
      const sc = cronSched(j);
      body = `<dl class="kv" style="grid-template-columns:88px minmax(0,1fr)">
        <dt>${L("计划", "Schedule")}</dt><dd>${esc(sc.main)}</dd>
        ${j.schedule.kind === "cron" ? `<dt>${L("表达式", "Expression")}</dt><dd class="mono">${esc(j.schedule.expr)}</dd><dt>${L("时区", "Timezone")}</dt><dd>${esc(j.schedule.tz || S.cronTz)}</dd>` : `<dt>${L("运行时间", "Runs at")}</dt><dd>${esc(fullDate(j.schedule.at, S.cronTz))}</dd>`}
        <dt>${L("下次运行", "Next run")}</dt><dd>${j.enabled && st.nextRunAt ? esc(fullDate(st.nextRunAt, S.cronTz)) : "—"}</dd>
        <dt>${L("引擎", "Engine")}</dt><dd>${j.engine ? eng(j.engine) : L("Bot 默认", "Bot default")}</dd>
        <dt>${L("模型", "Model")}</dt><dd>${esc(j.model || L("默认", "default"))}</dd>
        <dt>${L("推理强度", "Effort")}</dt><dd>${esc(j.effort || L("默认", "default"))}</dd>
        <dt>${L("超时上限", "Timeout")}</dt><dd>${L(`${timeoutMin} 分钟`, `${timeoutMin} min`)}${j.timeoutMs ? "" : L("（默认）", " (default)")}</dd>
        <dt>${L("运行次数", "Runs")}</dt><dd>${esc(st.runCount || 0)}${st.consecutiveFailures ? L(` · 连续失败 ${st.consecutiveFailures} 次`, ` · ${st.consecutiveFailures} failures in a row`) : ""}</dd>
        <dt>${L("创建", "Created")}</dt><dd>${esc(fullDate(j.createdAt))}${via ? " · " + via : ""}</dd>
        <dt>${L("更新", "Updated")}</dt><dd>${esc(fullDate(j.updatedAt))}</dd>
        <dt>${L("聊天", "Chat")}</dt><dd><a href="#/sessions/${enc(j.botId)}/${enc(j.chatId)}" style="text-decoration:underline;text-underline-offset:2px">${esc(chatText(j.botId, j.chatId, j.channelType))}</a><span class="mono muted">${esc(j.chatId)}</span></dd>
        <dt>ID</dt><dd class="mono">${esc(j.id)}${copyBtn(j.id)}</dd>
        ${ws ? `<dt>${L("工作目录", "Folder")}</dt><dd><span class="mono ell" style="max-width:100%">${esc(ws.path)}</span>${copyBtn(ws.path)}</dd>` : ""}
      </dl>`;
    }
    return `<aside class="card det">
      <div class="det-h">
        <div class="det-t"><h2>${esc(j.name)}</h2>${cronPill(j)}<span class="r">${j.enabled ? L("启用", "On") : L("暂停", "Off")}<button class="sw${j.enabled ? " on" : ""}" data-act="toggleCron" data-id="${esc(j.id)}"></button></span></div>
        <div class="det-m">${chn(j.channelType)}${esc(chatText(j.botId, j.chatId, j.channelType))} · ${esc(botName(j.botId))} · ${j.engine ? eng(j.engine) : L("Bot 默认引擎", "Bot's engine")} · ${L(`超时上限 ${timeoutMin} 分钟`, `${timeoutMin} min timeout`)}</div>
        ${notes}
        <div class="det-a"><button class="btn sm primary" data-act="runCron" data-id="${esc(j.id)}"${j.running ? " disabled" : ""}>${j.running ? `<span class="spin" style="width:12px;height:12px"></span>${L("运行中", "Running")}` : ic("play") + L("立即运行", "Run now")}</button><button class="btn sm outline" data-act="editCron" data-id="${esc(j.id)}">${ic("pencil")}${L("编辑", "Edit")}</button>${ws ? `<button class="btn sm outline" data-act="files" data-path="${esc(ws.path)}">${ic("folder")}${L("工作区", "Folder")}</button>` : ""}<span style="margin-left:auto">${menu(`<button class="btn icon sm ghost">${ic("more")}</button>`, [mi("copy", L("复制提示词", "Copy prompt"), `data-act="copy" data-text="${esc(j.prompt)}"`), `<div class="sep"></div>`, mi("trash", L("删除任务…", "Delete task…"), `data-act="delCron" data-id="${esc(j.id)}"`, true)], true)}</span></div>
        <div class="tabs">${[["runs", L("运行记录", "Runs"), st.runCount || 0], ["prompt", L("提示词", "Prompt")], ["info", L("详情", "Details")]]
          .map(([v, t, c]) => `<a class="${tab === v ? "on" : ""}" data-act="cronTab" data-v="${v}">${t}${c !== undefined ? ` <i>${c}</i>` : ""}</a>`)
          .join("")}</div>
      </div>
      <div class="det-b" data-keep="cron-det-${esc(j.id)}-${tab}">${body}</div>
    </aside>`;
  }
  function runOutput(r) {
    return (r.output ?? r.outputPreview ?? "").replace("[SILENT]", "").trim();
  }
  function runBody(r) {
    const out = runOutput(r);
    let h = "";
    if (r.status === "silent") h += `<div class="note">${ic("info")}<div>${L("Agent 回复了 [SILENT]，这次没有发消息到聊天。", "The agent replied [SILENT], so nothing was posted.")}</div></div>`;
    if (r.error) h += r.status === "skipped" ? `<div class="note">${ic("info")}<div>${esc(r.error)}</div></div>` : `<div class="errbox">${ic("alert")}<div>${esc(r.error)}</div></div>`;
    if (!r.output && r.outputPreview && r.outputPreview.length >= 500) h += `<div class="note warn">${ic("alert")}<div>${L("这是旧记录，只保存了前 500 个字符。", "Older record: only the first 500 characters were kept.")}</div></div>`;
    if (out) {
      h += `<div class="out-l">${r.status === "ok" || r.status === "silent" ? L("输出", "Output") : L("输出", "Output")}<div class="r"><button class="btn xs ghost" data-act="cronRaw">${ui.cronRaw ? L("渲染", "Rendered") : L("原文", "Raw")}</button><button class="btn xs ghost" data-act="copy" data-text="${esc(out)}">${ic("copy")}${L("复制", "Copy")}</button></div></div>`;
      h += ui.cronRaw ? `<pre class="raw">${esc(out)}</pre>` : `<div class="md">${renderMarkdown(out)}</div>`;
    } else if (r.status === "ok") h += `<div class="empty-s">${L("没有输出", "No output")}</div>`;
    return h;
  }

  // ---------------------------------------------------------------- jobs
  function pageJobs(args) {
    const f = ui.jobsF;
    const q = f.q.trim().toLowerCase();
    const all = S.jobs.slice().sort((a, b) => Number(jobActive(b)) - Number(jobActive(a)) || b.createdAt - a.createdAt);
    const list = all.filter((j) => {
      if (f.bot && j.botId !== f.bot) return false;
      if (f.st === "active" && !jobActive(j)) return false;
      if (f.st === "finished" && jobActive(j)) return false;
      if (f.st === "failed" && !jobFailed(j)) return false;
      if (q && ![j.title, j.command, j.chatId, j.id, chatText(j.botId, j.chatId, j.channelType)].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    });
    if (args[0] && args[0] !== ui.jobOpenFromRoute) {
      ui.jobOpen = args[0];
      ui.jobOpenFromRoute = args[0];
    }
    const n = { all: S.jobs.length, active: S.jobs.filter(jobActive).length, finished: S.jobs.filter((j) => !jobActive(j)).length, failed: S.jobs.filter(jobFailed).length };
    const active = list.filter(jobActive);
    const done = list.filter((j) => !jobActive(j));
    const botOpts = [["", L("全部 Bot", "All bots")]].concat(botsRt().map((b) => [b.botId, b.name]));
    const cards = active.map((j) => {
      needLog(j.id);
      const who = j.requester && j.requester.senderName ? esc(j.requester.senderName) + L(" 发起", "") : "";
      return `<div class="job" id="job-${esc(j.id)}">
        <div class="jh">${jobIcon(j)}<div class="jt"><b><span class="n">#${esc(j.seq)}</span>${esc(j.title)}</b><div>${chn(j.channelType)}${esc(chatText(j.botId, j.chatId, j.channelType))} · ${esc(j.bot_name || botName(j.botId))}${who ? " · " + who : ""}${j.startedAt ? " · " + esc(fmtWhen(j.startedAt)) + L(" 开始", "") : ""}</div></div>
        ${j.status === "running" ? `<div class="jclock"><div data-since="${j.startedAt || j.createdAt}">${clock(Date.now() - (j.startedAt || j.createdAt))}</div><span>${j.timeoutMs ? L("上限 ", "limit ") + esc(dur(j.timeoutMs)) : ""}</span></div>` : `<div class="jclock q"><div>${L("排队中", "Queued")}</div><span data-ago="${j.createdAt}">${esc(ago(j.createdAt))}</span></div>`}
        <button class="btn sm outline danger" data-act="cancelJob" data-id="${esc(j.id)}">${L("取消作业", "Cancel")}</button></div>
        <div class="jcmd" title="${esc(j.command)}"><span class="p">$</span>${esc(j.command)} <span class="muted">· cwd ${esc(j.cwd)}</span></div>
        ${termHtml(j)}
        ${j.then || j.sessionId ? `<div class="jthen">${ic("send")}${j.then ? `${L("结束后回传给 Agent：", "When it exits, the agent will: ")}<b>${esc(j.then)}</b>` : L("结束后把结果回传给 Agent", "The result goes back to the agent when it exits")}${j.sessionId ? `<span class="r">${L("会话 ", "session ")}<span class="mono">${esc(j.sessionId.slice(0, 8))}</span></span>` : ""}</div>` : ""}
      </div>`;
    });
    const rows = done.map((j) => {
      const open = ui.jobOpen === j.id;
      if (open) needLog(j.id);
      const row = `<div class="tr${open ? " sel" : ""}" data-act="toggleJob" data-id="${esc(j.id)}">${jobIcon(j)}<div class="c2"><b><span class="mono muted" style="font-size:12px">#${esc(j.seq)}</span> ${esc(j.title)}</b><span class="mono">${esc(j.command)}</span></div><div class="c2"><span class="l1">${chn(j.channelType)}${esc(chatText(j.botId, j.chatId, j.channelType))}</span><span>${esc(j.bot_name || botName(j.botId))}</span></div><span class="tnum">${j.elapsed_seconds !== undefined ? esc(dur(j.elapsed_seconds * 1000)) : "—"}</span><span>${jobResult(j)}</span>${callbackHtml(j)}<span class="muted" style="font-size:12px" data-ago="${j.finishedAt || j.createdAt}">${esc(ago(j.finishedAt || j.createdAt))}</span></div>`;
      if (!open) return row;
      const meta = [
        [L("开始", "Started"), fullDate(j.startedAt)], [L("结束", "Finished"), fullDate(j.finishedAt)], [L("退出码", "Exit code"), j.exitCode ?? "—"], ["PID", j.pid || "—"],
        [L("发起人", "Requested by"), (j.requester && j.requester.senderName) || "—"],
        ...(j.cancelledBy ? [[L("取消人", "Cancelled by"), j.cancelledBy]] : []), [L("回传", "Callback"), { done: L("已回传", "Sent"), pending: L("等待", "Pending"), failed: L("失败", "Failed"), skipped: L("无需", "Not needed") }[j.callback] || "—"], [L("超时上限", "Timeout"), j.timeoutMs ? dur(j.timeoutMs) : "—"], ["ID", j.id],
      ];
      return row + `<div class="tr jl-x" style="display:block;cursor:default">
        <div class="jmeta">${meta.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
        <div class="jmeta" style="grid-template-columns:1fr"><div><span>${L("工作目录", "Working folder")}</span><b class="mono">${esc(j.cwd)}</b></div>${j.then ? `<div><span>${L("结束后 Agent 要做的事", "Follow-up for the agent")}</span><b>${esc(j.then)}</b></div>` : ""}</div>
        ${j.error ? `<div class="errbox">${ic("alert")}<div>${esc(j.error)}</div></div>` : ""}
        ${termHtml(j)}
        <div style="display:flex;gap:6px;margin-top:10px"><button class="btn sm outline" data-act="copy" data-text="${esc(j.command)}">${ic("copy")}${L("复制命令", "Copy command")}</button><button class="btn sm ghost danger" data-act="delJob" data-id="${esc(j.id)}">${ic("trash")}${L("删除记录和日志", "Delete record & log")}</button></div>
      </div>`;
    });
    const empty = !S.loaded.jobs ? L("加载中…", "Loading…") : S.jobs.length ? L("没有匹配的作业", "No matching jobs") : `<b>${L("还没有后台作业", "No background jobs yet")}</b>${L("Agent 遇到要跑很久的命令（大下载、训练、完整构建）时会交给网关在后台跑，结束后把结果发回聊天。", "When the agent needs a long command (big downloads, training, full builds) it hands it to the gateway, which sends the result back to the chat.")}`;
    return {
      html: `<div class="page" data-keep="jobs">
        <div class="ph"><div><h1>${L("后台作业", "Background jobs")}</h1><p>${L("Agent 交给网关在后台跑的长命令。结束后网关把结果发回原来的聊天，Agent 接着处理。网关重启不影响正在运行的作业。", "Long commands the agent handed to the gateway. When one exits, the result goes back to the chat that started it. Jobs survive gateway restarts.")}</p></div></div>
        <div class="tb"><div class="seg">${[["all", L("全部", "All")], ["active", L("进行中", "Active")], ["finished", L("已结束", "Finished")], ["failed", L("失败", "Failed")]]
          .map(([v, t]) => `<button class="${f.st === v ? "on" : ""}${v === "failed" && n.failed ? " err" : ""}" data-act="jobsSt" data-v="${v}">${t} <i>${n[v]}</i></button>`)
          .join("")}</div><select class="app-input" data-filter="jobsF.bot">${botOpts.map(([v, t]) => `<option value="${esc(v)}"${f.bot === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><div class="input">${ic("search")}<input id="jobs-q" data-filter="jobsF.q" value="${esc(f.q)}" placeholder="${L("搜索标题、命令、聊天…", "Search title, command, chat…")}" autocomplete="off"></div></div>
        ${cards.join("")}
        ${done.length ? `<div class="card tbl jl"><div class="th"><span></span><span>${L("作业", "Job")}</span><span>${L("聊天", "Chat")}</span><span>${L("耗时", "Took")}</span><span>${L("结果", "Result")}</span><span>${L("回传", "Callback")}</span><span>${L("时间", "When")}</span></div>${rows.join("")}</div>` : cards.length ? "" : `<div class="card"><div class="empty">${empty}</div></div>`}
      </div>`,
      after: () => {
        if (args[0]) {
          const el = document.getElementById("job-" + args[0]);
          if (el && !ui.scrolledJob) {
            el.scrollIntoView({ block: "nearest" });
            ui.scrolledJob = true;
          }
        }
      },
    };
  }
  function termHtml(j) {
    const lg = ui.logs[j.id];
    const live = jobActive(j);
    const follow = ui.follow[j.id] !== false;
    return `<div class="term-wrap"><div class="term-bar">${live ? `<button data-act="follow" data-id="${esc(j.id)}" class="${follow ? "" : "off"}"><i></i>${follow ? L("跟随输出", "Following") : L("已暂停跟随", "Paused")}</button>` : ""}<span>${L("最近 300 行", "Last 300 lines")}</span></div><pre class="term" data-log="${esc(j.id)}" data-keep="log-${esc(j.id)}"${live && follow ? ' data-stick="bottom"' : ""}>${lg ? esc(lg.text || L("（还没有输出）", "(no output yet)")) : L("加载日志…", "Loading log…")}</pre></div>`;
  }
  const logBusy = {};
  function fetchLog(id) {
    if (logBusy[id]) return;
    logBusy[id] = true;
    api(`/api/jobs/log?lines=300&id=${enc(id)}`)
      .then((d) => {
        const prev = ui.logs[id];
        ui.logs[id] = { text: d.log || "", status: d.status };
        const pre = document.querySelector(`pre[data-log="${CSS.escape(id)}"]`);
        if (pre && (!prev || prev.text !== ui.logs[id].text)) {
          const atEnd = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30;
          pre.textContent = ui.logs[id].text || L("（还没有输出）", "(no output yet)");
          if (ui.follow[id] !== false && (atEnd || !prev)) pre.scrollTop = pre.scrollHeight;
        }
        const job = S.jobs.find((j) => j.id === id);
        if (job && jobActive(job) && d.status && d.status !== job.status) load(["jobs"]);
      })
      .catch(() => {})
      .finally(() => (logBusy[id] = false));
  }
  function needLog(id) {
    if (!ui.logs[id]) setTimeout(() => fetchLog(id), 0);
  }
  function pollLogs() {
    if (ui.route.page !== "jobs") return;
    for (const j of S.jobs) if (jobActive(j) && document.querySelector(`pre[data-log="${CSS.escape(j.id)}"]`)) fetchLog(j.id);
  }

  // ---------------------------------------------------------------- bots
  function pageBots(args) {
    if (!draft) return { html: `<div class="page"><div class="empty">${L("加载中…", "Loading…")}</div></div>` };
    const bots = draft.bots || [];
    const editing = args[0] === "new" ? "new" : args[0] !== undefined && bots[Number(args[0])] ? Number(args[0]) : null;
    if (editing === "new" && !ui.newBot) ui.newBot = { name: "", channel: "telegram", token: "", dmPolicy: "pairing", groupPolicy: "pairing", allowFrom: [], groups: {} };
    const de = defaultEngine();
    const cards = bots.map((b, i) => {
      const rt = rtByName(b.name);
      const groups = Object.values(b.groups || {}).filter((v) => v === true || (v && v.enabled !== false)).length;
      const dc = b.channel === "discord";
      let soul = "";
      if (rt) {
        const sc = ensure(ui.soul, rt.botId, "1", () => api(`/api/soul?bot_id=${enc(rt.botId)}`).then((d) => !!(d.content && d.content.trim())));
        soul = sc.data === true ? `<span class="pill ok nodot">${L("SOUL.md 已设置", "SOUL.md set")}</span>` : sc.data === false ? `<span class="pill nodot">${L("未设置", "Not set")}</span>` : `<span class="muted">…</span>`;
      } else soul = `<span class="muted">${L("Bot 运行后可设置", "After the bot starts")}</span>`;
      const model = [b.model, b.effort].filter(Boolean).join(" · ");
      return `<div class="card bc${editing === i ? " sel" : ""}">
        <div class="bc-h">${chn(b.channel)}<div style="min-width:0"><b class="ell">${esc(b.name)}</b><span>${rt ? (rt.username ? esc(String(rt.username).startsWith("@") || dc ? rt.username : "@" + rt.username) : "") : L("未运行（保存后启动）", "Not running (starts after save)")}</span></div>${rt ? `<span class="pill ok">${L("在线", "Online")}</span>` : `<span class="pill nodot">${L("未运行", "Stopped")}</span>`}</div>
        <dl class="bc-b"><dt>${L("默认执行", "Runs on")}</dt><dd>${b.engine ? eng(b.engine) : eng(de) + `<span class="muted">${L("· 跟随全局", "· global default")}</span>`}${model ? `<span class="muted">· ${esc(model)}</span>` : ""}</dd>
          <dt>${L("访问", "Access")}</dt><dd>${L("私聊 ", "DM ")}${esc(policyName(b.dmPolicy || (draft.auth && draft.auth.defaultPolicy) || "pairing"))} · ${dc ? L("频道 ", "Channels ") : L("群组 ", "Groups ")}${esc(policyName(b.groupPolicy || (draft.auth && draft.auth.defaultPolicy) || "pairing"))}</dd>
          <dt>${L("已授权", "Allowed")}</dt><dd>${L(`${(b.allowFrom || []).length} 位用户 · ${groups} 个${dc ? "频道" : "群组"}`, `${(b.allowFrom || []).length} users · ${groups} ${dc ? "channels" : "groups"}`)}</dd>
          <dt>${L("人设", "Persona")}</dt><dd>${soul}</dd></dl>
        <div class="bc-f"><a class="btn sm ghost" href="#/bots/${i}">${ic("pencil")}${L("编辑", "Edit")}</a><button class="btn sm ghost" data-act="soul" data-i="${i}"${rt ? "" : " disabled"}>${ic("user")}${L("人设", "Persona")}</button><span class="r">${menu(`<button class="btn icon sm ghost">${ic("more")}</button>`, [mi("trash", L("删除这个 Bot…", "Delete this bot…"), `data-act="delBot" data-i="${i}"`, true)], true)}</span></div>
      </div>`;
    });
    const drawer = editing === null ? "" : botDrawer(editing);
    return {
      crumb: editing === null ? null : ["Bots", editing === "new" ? L("添加", "Add") : bots[editing].name],
      actions: `<a class="btn sm outline" href="#/bots/new">${ic("plus")}${L("添加 Bot", "Add bot")}</a>`,
      html: `<div class="page">
        <div class="ph"><div><h1>Bots</h1><p>${L("每个 Bot 是一个 Telegram 或 Discord 机器人，可以单独设置默认引擎、访问策略和人设。", "Each bot is a Telegram or Discord bot with its own default engine, access policy and persona.")}</p></div></div>
        <div class="bots${drawer ? " open" : ""}"><div class="bgrid">${cards.join("") || `<div class="card"><div class="empty"><b>${L("还没有 Bot", "No bots yet")}</b>${L("先在 BotFather 或 Discord 开发者后台拿到 Token。", "Get a token from BotFather or the Discord developer portal first.")}<br><a class="btn primary" href="#/bots/new">${ic("plus")}${L("添加 Bot", "Add bot")}</a></div></div>`}</div>${drawer}</div>
      </div>`,
    };
  }
  function botDrawer(i) {
    const isNew = i === "new";
    const pre = isNew ? "@new." : `bots.${i}.`;
    const b = isNew ? ui.newBot : draft.bots[i];
    const dc = b.channel === "discord";
    const e = b.engine || defaultEngine();
    const rk = isNew ? "new" : b.name;
    const groups = Object.entries(b.groups || {});
    const rt = !isNew && rtByName(b.name);
    const inherit = (draft.auth && draft.auth.defaultPolicy) || "pairing";
    return `<aside class="card drawer">
      <div class="dr-h">${chn(b.channel)}<h2>${isNew ? L("添加 Bot", "Add bot") : L("编辑 ", "Edit ") + esc(b.name)}</h2><div class="r"><a class="btn icon sm ghost" href="#/bots" title="${L("关闭", "Close")}">${ic("x")}</a></div></div>
      <div class="dr-b">
        <div class="dr-s">${L("基本", "BASICS")}</div>
        ${isNew ? fld(L("渠道", "Channel"), `<div class="seg full">${[["telegram", "Telegram"], ["discord", "Discord"]].map(([v, t]) => `<button class="${b.channel === v ? "on" : ""}" data-act="setPath" data-path="@new.channel" data-val="${v}">${t}</button>`).join("")}</div>`) : ""}
        <div class="g2">
          ${fld(L("名称", "Name"), inp(pre + "name", { ph: "my-bot" }), { path: isNew ? "" : pre + "name" })}
          ${fld("Bot Token", `<div class="input" style="padding-right:4px"><input type="${ui.reveal[rk] ? "text" : "password"}" data-path="${pre}token" value="${esc(b.token || b.discordToken || "")}" placeholder="${dc ? "MTIz…" : "123456:ABC…"}" autocomplete="off" spellcheck="false" class="mono"><button class="copy" data-act="reveal" data-k="${esc(rk)}" title="${L("显示/隐藏", "Show/hide")}">${ic(ui.reveal[rk] ? "eyeoff" : "eye")}</button></div>`, { path: isNew ? "" : pre + "token" })}
        </div>
        <div class="dr-s">${L("默认执行", "DEFAULTS")}</div>
        <div class="g3">
          ${fld(L("引擎", "Engine"), selPath(pre + "engine", [["", L("跟随全局（", "Global (") + (ENG[defaultEngine()] || "") + L("）", ")")]].concat(ENGINES.map((x) => [x, ENG_FULL[x]]))), { path: isNew ? "" : pre + "engine" })}
          ${fld(L("模型", "Model"), selPath(pre + "model", modelOptions(e, L("跟随引擎默认", "Engine default"))), { path: isNew ? "" : pre + "model" })}
          ${fld(L("推理强度", "Effort"), selPath(pre + "effort", effortOptions(e, b.model)), { path: isNew ? "" : pre + "effort" })}
        </div>
        <div class="hint" style="margin:-6px 0 0">${L("模型和推理强度来自本机检测结果，只列所选模型支持的档位。", "Models and effort levels come from what was detected on this machine.")}</div>
        <div class="dr-s">${L("访问 · 私聊", "ACCESS · DIRECT MESSAGES")}</div>
        ${policyCards(pre + "dmPolicy")}${b.dmPolicy ? "" : `<div class="hint">${L("未单独设置，使用全局默认：", "Not set; using the global default: ")}${esc(policyName(inherit))}</div>`}
        <div class="fld" style="margin-top:12px"><div class="lbl">${L("已授权用户", "Allowed users")} <span class="muted">${(b.allowFrom || []).length}</span></div>${tagsHtml(pre + "allowFrom", L("输入用户 ID 后回车", "User ID, then Enter"))}<div class="hint">${L("批准配对后会自动加进来。", "Approved pairings are added here automatically.")}</div></div>
        <div class="dr-s">${dc ? L("访问 · 服务器频道", "ACCESS · SERVER CHANNELS") : L("访问 · 群组", "ACCESS · GROUPS")}</div>
        ${policyCards(pre + "groupPolicy")}${b.groupPolicy ? "" : `<div class="hint">${L("未单独设置，使用全局默认：", "Not set; using the global default: ")}${esc(policyName(inherit))}</div>`}
        <div class="fld" style="margin-top:12px"><div class="lbl">${dc ? L("已授权频道", "Allowed channels") : L("已授权群组", "Allowed groups")} <span class="muted">${groups.length}</span></div>
          ${groups.length ? `<div class="gl">${groups.map(([gid, v]) => {
            const on = v === true || (v && v.enabled !== false);
            const label = rt ? chatTitle(rt.botId, gid, b.channel) : null;
            return `<div class="gl-r">${ic("users")}<span class="mono">${esc(gid)}</span>${label && !label.mono ? `<span class="muted ell" style="font-size:11.5px">${esc(label.text)}</span>` : ""}<span class="r"><button class="sw${on ? " on" : ""}" data-act="groupToggle" data-path="${pre}groups" data-g="${esc(gid)}" title="${on ? L("停用", "Disable") : L("启用", "Enable")}"></button><button class="copy" data-act="groupDel" data-path="${pre}groups" data-g="${esc(gid)}" title="${L("移除", "Remove")}">${ic("x")}</button></span></div>`;
          }).join("")}</div>` : ""}
          <div class="gl-add"><input class="app-input mono" id="grp-add" placeholder="${dc ? L("频道 ID", "Channel ID") : L("群组 ID，例如 -100…", "Group ID, e.g. -100…")}" autocomplete="off"><button class="btn outline" data-act="groupAdd" data-path="${pre}groups">${ic("plus")}${L("添加", "Add")}</button></div>
        </div>
      </div>
      <div class="dr-f">${isNew ? `<span class="muted">${L("添加后在底部保存即可启动", "Save at the bottom to start it")}</span><div class="r"><a class="btn sm ghost" href="#/bots">${L("取消", "Cancel")}</a><button class="btn sm primary" data-act="addBot">${L("添加", "Add")}</button></div>` : `<button class="btn sm ghost danger" data-act="delBot" data-i="${i}">${ic("trash")}${L("删除", "Delete")}</button><span class="muted">${L("改动会先暂存，统一保存", "Changes are staged until you save")}</span><div class="r"><a class="btn sm primary" href="#/bots">${L("完成", "Done")}</a></div>`}</div>
    </aside>`;
  }

  // ---------------------------------------------------------------- engines
  function pageEngines() {
    if (!draft) return { html: `<div class="page"><div class="empty">${L("加载中…", "Loading…")}</div></div>` };
    const de = defaultEngine();
    const desc = { claude: L("Anthropic · CLAUDE.md 与工具调用", "Anthropic · CLAUDE.md and tools"), codex: L("OpenAI · AGENTS.md，带沙箱", "OpenAI · AGENTS.md with sandbox"), agy: L("Google · 原生技能与子代理", "Google · native skills and subagents"), grok: L("xAI · 无头会话与子代理", "xAI · headless sessions and subagents") };
    const tiles = ENGINES.map((e) => {
      const n = (S.caps[e] && S.caps[e].models && S.caps[e].models.length) || 0;
      return `<button class="etile${de === e ? " on" : ""}" data-act="setPath" data-path="engines.default" data-val="${e}"><span class="rad"></span><span class="eng ${e}">${ENG_FULL[e]}</span><p>${desc[e]}</p><div class="meta">${S.loaded.models ? (n ? `<span class="dot ok"></span>${L(`已检测 · ${n} 个模型`, `Detected · ${n} models`)}` : `<span class="dot"></span>${L("未检测到模型", "No models detected")}`) : L("检测中…", "Detecting…")}</div></button>`;
    });
    const open = ui.engOpen || de;
    const acc = ENGINES.map((e) => {
      const c = (draft.engines && draft.engines[e]) || {};
      const p = `engines.${e}.`;
      const sumParts = [`<span class="mono">${esc(c.binary || e)}</span>`, esc(c.model || L("CLI 默认模型", "CLI default model")), L("推理 ", "effort ") + esc(c.effort || L("默认", "default"))];
      if (e === "codex") sumParts.push(L("沙箱 ", "sandbox ") + (c.sandbox === "danger-full-access" || !c.sandbox ? `<span class="pill warn nodot" style="height:18px;font-size:11px">${L("完全访问", "full access")}</span>` : esc(c.sandbox)), L("审批 ", "approval ") + esc(c.approvalPolicy || "never"));
      if ((c.extraArgs || []).length) sumParts.push(L(`${c.extraArgs.length} 个额外参数`, `${c.extraArgs.length} extra args`));
      const mod = changes().some((x) => x.path[0] === "engines" && x.path[1] === e);
      const head = `<div class="acc-r${open === e ? " open" : ""}" data-act="engOpen" data-v="${e}"><span class="eng ${e}">${ENG_FULL[e]}</span><span class="sum">${sumParts.join(" · ")}</span>${mod ? `<span class="pill brand nodot">${L("已修改", "Modified")}</span>` : ""}<span class="chev"${mod ? "" : ' style="margin-left:auto"'}>${ic(open === e ? "down" : "right")}</span></div>`;
      if (open !== e) return head;
      return head + `<div class="acc-x">
        <div class="g3">
          ${fld(L("可执行文件", "Binary"), inp(p + "binary", { ph: e, cls: "code" }), { path: p + "binary" })}
          ${fld(L("默认模型", "Default model"), selPath(p + "model", modelOptions(e, L("CLI 默认", "CLI default"))), { path: p + "model" })}
          ${fld(L("推理强度", "Effort"), selPath(p + "effort", effortOptions(e, c.model)), { path: p + "effort" })}
        </div>
        ${e === "codex" ? `<div class="g2">${fld(L("沙箱", "Sandbox"), selPath(p + "sandbox", [["danger-full-access", L("完全访问（不限制）", "Full access (unrestricted)")], ["workspace-write", L("只能写工作区", "Workspace write")], ["read-only", L("只读", "Read only")]]), { path: p + "sandbox" })}${fld(L("审批策略", "Approval policy"), selPath(p + "approvalPolicy", [["never", L("从不询问（自动批准）", "Never ask (auto-approve)")], ["on-request", L("需要时询问", "On request")], ["untrusted", L("总是询问", "Always ask")]]), { path: p + "approvalPolicy", hint: L("通过聊天远程使用时没人能点批准，一般保持「从不询问」。", "Nobody can click approve over chat, so this is usually Never.") })}</div>` : ""}
        ${fld(L("额外参数", "Extra arguments"), tagsHtml(p + "extraArgs", L("例如 --verbose，回车添加", "e.g. --verbose, then Enter")), { path: p + "extraArgs", hint: L("每次启动 CLI 时追加到命令行。", "Appended to the command line each time the CLI starts.") })}
      </div>`;
    });
    return {
      actions: `<button class="btn sm outline" data-act="rescan">${ic("refresh")}${L("重新扫描模型", "Rescan models")}</button>`,
      html: `<div class="page narrow">
        <div class="ph"><div><h1>${L("引擎", "Engines")}</h1><p>${L("本机的四个 CLI。Bot 没有单独指定时，所有会话都用默认引擎。", "The four CLIs on this machine. Sessions use the default engine unless their bot picks another.")}</p></div></div>
        <div class="sec"><div class="sec-h"><h3>${L("默认引擎", "Default engine")}</h3>${isMod("engines.default") ? `<span class="pill brand nodot">${L("已修改", "Modified")}</span>` : ""}</div><div class="etiles">${tiles.join("")}</div></div>
        <div class="sec"><div class="sec-h"><h3>${L("进程", "Processes")}</h3></div><div class="g3">
          ${fld(L("最多同时运行", "Max concurrent"), unitInp("engines.maxProcesses", L("个进程", "processes"), { conv: "int", min: 1 }), { path: "engines.maxProcesses" })}
          ${fld(L("空闲多久后回收", "Idle timeout"), unitInp("engines.idleTimeoutMs", L("分钟", "min"), { conv: "min", min: 1, step: "1" }), { path: "engines.idleTimeoutMs", hint: L("会话空闲超过这个时间，CLI 进程会被关闭，下次消息再启动。", "Idle CLI processes are stopped after this and restarted on the next message.") })}
        </div></div>
        <div class="sec"><div class="sec-h"><h3>${L("各引擎设置", "Per-engine settings")}</h3></div><div class="acc">${acc.join("")}</div></div>
      </div>`,
    };
  }

  // ---------------------------------------------------------------- skills
  function pageSkills(args) {
    const skills = S.skills;
    const name = args[0] || (skills[0] && skills[0].name);
    const s = skills.find((x) => x.name === name);
    const sync4 = (x) => `<div class="sync4">${["claude", "codex", "agy", "grok"].map((e) => `<span class="${x.synced && x.synced[e] ? "" : "no"}">${ENG[e]}</span>`).join("")}</div>`;
    const left = `<section class="sk-l">
      <div style="padding:2px 8px 12px;display:flex;align-items:center;gap:8px"><b style="font-size:15px">${L("技能", "Skills")}</b><span class="chip mono" style="font-size:10.5px" title="${esc(S.hubDir)}">${esc(String(S.hubDir).replace(/^\/(Users|home)\/[^/]+/, "~"))}</span></div>
      ${skills.map((x) => `<a class="sk-i${x.name === name ? " on" : ""}" href="#/skills/${enc(x.name)}"><b>${esc(x.name)}${ui.skillText[x.name] !== undefined ? `<span class="dot" style="background:var(--brand)"></span>` : ""}</b><p>${esc(x.description || L("（没有描述）", "(no description)"))}</p>${sync4(x)}</a>`).join("") || `<div class="empty">${S.loaded.skills ? L("还没有技能", "No skills yet") : L("加载中…", "Loading…")}</div>`}
    </section>`;
    let right;
    if (!s) right = `<section class="sk-r"><div class="empty" style="margin:auto"><b>${L("技能是给四个 CLI 共用的说明书", "Skills are instructions shared by all four CLIs")}</b>${L("每个技能是一个带 SKILL.md 的文件夹，会自动同步到 Claude、Codex、AGY 和 Grok。", "Each skill is a folder with a SKILL.md, synced to Claude, Codex, AGY and Grok.")}<br><button class="btn primary" data-act="newSkill">${ic("plus")}${L("新建技能", "New skill")}</button></div></section>`;
    else {
      const dc = ensure(ui.skill, s.name, "1", () => api(`/api/skills/detail?name=${enc(s.name)}`));
      const d = dc.data;
      const text = ui.skillText[s.name] !== undefined ? ui.skillText[s.name] : d ? d.skillMd || "" : "";
      const dirty = ui.skillText[s.name] !== undefined && d && ui.skillText[s.name] !== d.skillMd;
      const allSynced = s.synced && ["claude", "codex", "agy", "grok"].every((e) => s.synced[e]);
      const files = (d && d.files) || [];
      right = `<section class="sk-r">
        <div class="sk-h">
          <div class="t"><h2>${esc(s.name)}</h2>${allSynced ? `<span class="pill ok">${L("已同步到 4 个 CLI", "Synced to all 4 CLIs")}</span>` : `<span class="pill warn">${L("部分 CLI 未同步", "Not synced everywhere")}</span>`}${dirty ? `<span class="pill brand nodot">${L("未保存", "Unsaved")}</span>` : ""}<div class="r"><button class="btn sm ghost danger" data-act="delSkill" data-name="${esc(s.name)}">${ic("trash")}${L("删除", "Delete")}</button>${dirty ? `<button class="btn sm ghost" data-act="revertSkill" data-name="${esc(s.name)}">${L("还原", "Revert")}</button>` : ""}<button class="btn sm primary" data-act="saveSkill" data-name="${esc(s.name)}"${dirty ? "" : " disabled"}>${L("保存并同步", "Save & sync")}</button></div></div>
          <div class="sk-meta">${sync4(s)}${files.map((f) => `<span class="chip mono" title="${esc(f.relPath)}">${ic(f.isDir ? "folder" : "file")}${esc(f.relPath)}${f.isDir ? "" : ` <span class="muted">${bytes(f.size)}</span>`}</span>`).join("")}${s.dir ? `<span class="muted mono" style="font-size:11px">${esc(String(s.dir).replace(/^\/(Users|home)\/[^/]+/, "~"))}</span>${copyBtn(s.dir, L("复制路径", "Copy path"))}` : ""}</div>
        </div>
        <div class="sk-ed">${dc.err && !d ? `<div class="errbox">${ic("alert")}<div>${esc(dc.err)}</div></div>` : !d ? `<div class="empty"><span class="spin"></span></div>` : `<div class="lbl">SKILL.md <span class="muted">${L("开头 --- 之间的 name 和 description 决定引擎什么时候调用它", "The name and description between the --- lines decide when engines use it")}</span></div><textarea class="app-input" id="skillEd" data-skill="${esc(s.name)}" spellcheck="false">${esc(text)}</textarea>`}</div>
      </section>`;
    }
    return {
      crumb: s ? [L("技能", "Skills"), s.name] : null,
      actions: `<button class="btn sm outline" data-act="syncSkills">${ic("refresh")}${L("全部同步", "Sync all")}</button><button class="btn sm primary" data-act="newSkill">${ic("plus")}${L("新建技能", "New skill")}</button>`,
      html: `<div class="sk">${left}${right}</div>`,
    };
  }

  // ---------------------------------------------------------------- security
  function pageSecurity() {
    const pend = S.pairings.map((p) => {
      const r = p.req || {};
      const group = r.chatId && r.chatId !== r.senderId;
      const total = r.expiresAt && r.createdAt ? r.expiresAt - r.createdAt : 0;
      const code = String(r.code || "");
      return `<div class="pr">
        <div><div class="pr-who"><div class="av" style="--h:${hue(r.senderName || r.senderId)};width:34px;height:34px">${initial(r.senderName || r.senderId)}</div><div style="min-width:0"><b>${esc(r.senderName || r.senderId)}</b><span>${L("用户 ID ", "User ID ")}<span class="mono">${esc(r.senderId)}</span></span></div></div>
          <div class="pr-code">${esc(code.length === 6 ? code.slice(0, 3) + " " + code.slice(3) : code)}</div>
          <div class="pr-meta">${chn(r.channelType)}${group ? L("群组 ", "Group ") + `<span class="mono">${esc(r.chatId)}</span>` : L("私聊", "Direct message")} · ${esc(p.botName)} · <span data-ago="${esc(r.createdAt)}">${esc(ago(r.createdAt))}</span></div></div>
        <div><button class="btn primary" data-act="approve" data-code="${esc(r.code)}">${ic("check")}${L("批准", "Approve")}</button></div>
        <div class="exp"><span data-expire="${esc(r.expiresAt)}" data-total="${total}"></span><div class="bar"><i style="width:100%"></i></div></div>
      </div>`;
    });
    const bots = (draft && draft.bots) || [];
    const inherit = (draft && draft.auth && draft.auth.defaultPolicy) || "pairing";
    const rows = bots.map((b, i) => {
      const groups = Object.values(b.groups || {}).filter((v) => v === true || (v && v.enabled !== false)).length;
      return `<div class="tr" data-go="bots|${i}"><div class="c2"><b style="display:flex;align-items:center;gap:8px">${chn(b.channel)}${esc(b.name)}</b></div><span>${policyPill(b.dmPolicy || inherit, !b.dmPolicy)}</span><span>${policyPill(b.groupPolicy || inherit, !b.groupPolicy)}</span><span>${(b.allowFrom || []).length}</span><span>${groups}</span><span><a class="btn xs ghost" href="#/bots/${i}">${L("编辑", "Edit")}</a></span></div>`;
    });
    return {
      html: `<div class="page narrow">
        <div class="ph"><div><h1>${L("安全与配对", "Security & pairing")}</h1><p>${L("谁能和 Bot 说话。新用户第一次发消息时会拿到 6 位配对码，在这里批准后才能使用。", "Who can talk to your bots. New users get a 6-digit code on their first message; approve it here.")}</p></div></div>
        <div class="sec"><div class="sec-h"><h3>${L("待批准", "Pending")}</h3>${S.pairings.length ? `<span class="cnt">${S.pairings.length}</span>` : ""}</div>${pend.length ? `<div class="prs">${pend.join("")}</div>` : `<div class="allok"><span class="st-ic ok">${ic("check")}</span><span>${L("没有待批准的配对请求。新请求会自动出现在这里，并在侧栏提醒。", "No pending requests. New ones appear here automatically.")}</span></div>`}</div>
        <div class="sec"><div class="sec-h"><h3>${L("各 Bot 的访问策略", "Access policy per bot")}</h3><div class="r"><span class="muted" style="font-size:12px">${L("未单独设置时使用", "Default for bots without one")}</span><div style="width:130px">${selPath("auth.defaultPolicy", POLICIES().map((p) => [p[0], p[1]]), { cls: "sm" })}</div></div></div>
          <div class="card pol"><div class="th"><span>Bot</span><span>${L("私聊", "DMs")}</span><span>${L("群组 / 频道", "Groups / channels")}</span><span>${L("已授权用户", "Users")}</span><span>${L("已授权群组", "Groups")}</span><span></span></div>${rows.join("") || `<div class="empty">${L("还没有 Bot", "No bots yet")}</div>`}</div>
          <div class="legend">${POLICIES().map(([v, t, d]) => `<div><b>${policyPill(v)}</b>${d}</div>`).join("")}</div>
        </div>
      </div>`,
    };
  }

  // ---------------------------------------------------------------- gateway
  function pageGateway() {
    if (!draft) return { html: `<div class="page"><div class="empty">${L("加载中…", "Loading…")}</div></div>` };
    const g = S.status && S.status.gateway;
    const info = g
      ? `<dl class="kv" style="grid-template-columns:100px minmax(0,1fr)">
          <dt>PID</dt><dd class="mono">${esc(g.pid)}</dd>
          <dt>${L("已运行", "Uptime")}</dt><dd data-uptime-long>${esc(uptimeText(true))}</dd>
          <dt>${L("内存", "Memory")}</dt><dd>RSS ${bytes(g.memory && g.memory.rss)} · heap ${bytes(g.memory && g.memory.heapUsed)} / ${bytes(g.memory && g.memory.heapTotal)}</dd>
          <dt>Node</dt><dd class="mono">${esc(g.nodeVersion)}</dd>
          <dt>${L("配置文件", "Config file")}</dt><dd><span class="mono">${esc(g.configPath)}</span>${copyBtn(g.configPath)}</dd>
        </dl>`
      : `<div class="empty-s">${L("网关离线", "Gateway offline")}</div>`;
    return {
      html: `<div class="page narrow">
        <div class="ph"><div><h1>${L("网关与运行时", "Gateway & runtime")}</h1><p>${L("本地网关本身的设置，以及定时任务调度器和后台作业的并发、超时。", "Settings for the gateway itself, plus concurrency and timeouts for the scheduler and background jobs.")}</p></div></div>
        <div class="sec"><div class="sec-h"><h3>${L("运行信息", "Process")}</h3></div><div class="card card-b">${info}</div></div>
        <div class="sec"><div class="sec-h"><h3>${L("网关", "Gateway")}</h3><p>${L("端口和数据目录改了之后要重启网关（pa restart）才生效。", "Port and data folder changes need a restart (pa restart).")}</p></div><div class="g4">
          ${fld(L("端口", "Port"), inp("gateway.port", { type: "number", conv: "int", min: 1024 }), { path: "gateway.port" })}
          ${fld(L("数据目录", "Data folder"), inp("gateway.dataDir", { ph: "~/.pocketagent", cls: "code" }), { path: "gateway.dataDir" })}
          ${fld(L("日志级别", "Log level"), selPath("gateway.logLevel", [["debug", "debug"], ["info", "info"], ["warn", "warn"], ["error", "error"]]), { path: "gateway.logLevel" })}
          ${fld(L("日志格式", "Log format"), selPath("gateway.logFormat", [["pretty", "pretty"], ["json", "json"]]), { path: "gateway.logFormat" })}
        </div></div>
        <div class="sec"><div class="sec-h"><h3>${L("定时任务调度器", "Scheduler")}</h3><span class="r">${L("启用", "Enabled")} ${swPath("scheduler.enabled", true)}</span></div><div class="g3">
          ${fld(L("同时运行的任务", "Concurrent runs"), unitInp("scheduler.maxConcurrent", L("个", ""), { conv: "int", min: 1 }), { path: "scheduler.maxConcurrent" })}
          ${fld(L("默认超时", "Default timeout"), unitInp("scheduler.defaultTimeoutMs", L("分钟", "min"), { conv: "min", min: 1 }), { path: "scheduler.defaultTimeoutMs" })}
          ${fld(L("每个聊天最多", "Max per chat"), unitInp("scheduler.maxJobsPerChat", L("个任务", "tasks"), { conv: "int", min: 1 }), { path: "scheduler.maxJobsPerChat" })}
          ${fld(L("最短间隔", "Min interval"), unitInp("scheduler.minIntervalMs", L("分钟", "min"), { conv: "min", min: 1 }), { path: "scheduler.minIntervalMs", hint: L("周期任务两次运行之间至少隔多久。", "Shortest allowed gap between runs.") })}
          ${fld(L("错过后补跑窗口", "Catch-up window"), unitInp("scheduler.catchUpGraceMs", L("分钟", "min"), { conv: "min", min: 0 }), { path: "scheduler.catchUpGraceMs", hint: L("网关停机错过的运行，在这个时间内恢复会补跑。", "Missed runs within this window are run on restart.") })}
          ${fld(L("时区", "Timezone"), inp("scheduler.timezone", { ph: S.cronTz || Intl.DateTimeFormat().resolvedOptions().timeZone }), { path: "scheduler.timezone", hint: L("留空使用系统时区。", "Empty uses the system timezone.") })}
        </div></div>
        <div class="sec"><div class="sec-h"><h3>${L("后台作业", "Background jobs")}</h3><span class="r">${L("启用", "Enabled")} ${swPath("jobs.enabled", true)}</span></div><div class="g3">
          ${fld(L("全局同时运行", "Concurrent (all chats)"), unitInp("jobs.maxConcurrent", L("个", ""), { conv: "int", min: 1 }), { path: "jobs.maxConcurrent" })}
          ${fld(L("每个聊天同时运行", "Concurrent per chat"), unitInp("jobs.maxPerChat", L("个", ""), { conv: "int", min: 1 }), { path: "jobs.maxPerChat" })}
          ${fld(L("每个聊天最多排队", "Queued per chat"), unitInp("jobs.maxQueuedPerChat", L("个", ""), { conv: "int", min: 0 }), { path: "jobs.maxQueuedPerChat" })}
          ${fld(L("一轮对话最多发起", "Per agent turn"), unitInp("jobs.maxPerTurn", L("个", ""), { conv: "int", min: 1 }), { path: "jobs.maxPerTurn" })}
          ${fld(L("默认超时", "Default timeout"), unitInp("jobs.defaultTimeoutMs", L("小时", "h"), { conv: "hour", min: 0.1, step: "0.5" }), { path: "jobs.defaultTimeoutMs" })}
          ${fld(L("最长超时", "Max timeout"), unitInp("jobs.maxTimeoutMs", L("小时", "h"), { conv: "hour", min: 0.1, step: "0.5" }), { path: "jobs.maxTimeoutMs" })}
          ${fld(L("保留记录", "History kept"), unitInp("jobs.historyLimit", L("条", "jobs"), { conv: "int", min: 1 }), { path: "jobs.historyLimit" })}
          ${fld(L("检查间隔", "Poll interval"), unitInp("jobs.pollIntervalMs", L("秒", "s"), { conv: "sec", min: 0.5, step: "0.5" }), { path: "jobs.pollIntervalMs" })}
        </div></div>
      </div>`,
    };
  }

  // ---------------------------------------------------------------- yaml
  function pageYaml() {
    const text = ui.yamlText !== null ? ui.yamlText : S.yaml;
    const edited = ui.yamlText !== null && ui.yamlText !== S.yaml;
    const n = changes().length;
    return {
      actions: `${edited ? `<button class="btn sm ghost" data-act="revertYaml">${L("还原", "Revert")}</button>` : ""}<button class="btn sm primary" data-act="applyYaml"${edited ? "" : " disabled"}>${L("应用并热重载", "Apply & hot reload")}</button>`,
      html: `<div class="page fill">
        <div class="ph"><div><h1>config.yaml</h1><p>${L("直接编辑配置文件。应用前会做校验，出错不会写入。注意：从表单保存会按表单内容重写这个文件，注释不会保留。", "Edit the config file directly. It is validated before it's written. Saving from the forms rewrites this file, so comments are not kept.")}</p></div></div>
        ${n ? `<div class="note warn">${ic("alert")}<div>${L(`表单里有 ${n} 处未保存的更改。应用 YAML 会以这里的内容为准，那些更改会被丢弃。`, `The forms have ${n} unsaved changes. Applying YAML replaces them.`)}</div></div>` : ""}
        <div class="yaml"><div class="yaml-bar"><span class="mono">${esc(S.configPath)}</span>${copyBtn(S.configPath)}<span style="margin-left:auto">${edited ? `<span class="pill brand nodot">${L("已修改", "Edited")}</span>` : L("与服务器一致", "In sync with the server")}</span></div><textarea class="app-input" id="yamlEd" data-yaml spellcheck="false">${esc(text)}</textarea></div>
      </div>`,
    };
  }

  // ---------------------------------------------------------------- dirty bar
  function renderDirty() {
    const el = $("#dirty");
    if (!el) return;
    const ch = changes();
    if (!ch.length) {
      el.innerHTML = "";
      ui.diffOpen = false;
      return;
    }
    const first = ch[0];
    el.innerHTML = `${ui.diffOpen ? `<div class="diffpop"><h4>${L("未保存的更改", "Unsaved changes")}<span>${L("与上次加载的配置比较", "Compared with the last loaded config")}</span></h4><div class="dl">${ch
      .map((c) => `<div class="df"><span class="k">${esc(pathLabel(c.path))}</span><span>${c.from !== undefined ? `<del>${esc(fmtVal(c.from, c.path))}</del>` : ""}${c.from !== undefined && c.to !== undefined ? " → " : ""}${c.to !== undefined ? `<ins>${esc(fmtVal(c.to, c.path))}</ins>` : c.whole ? "" : `<ins>${L("（清空）", "(cleared)")}</ins>`}${/Ms$/.test(String(c.path[c.path.length - 1])) && typeof c.to === "number" ? ` <span class="muted">(${esc(dur(c.to))})</span>` : ""}</span></div>`)
      .join("")}</div></div>` : ""}
      <div class="dirty"><span class="dot"></span><span>${L(`${ch.length} 处未保存的更改`, `${ch.length} unsaved change${ch.length > 1 ? "s" : ""}`)}</span><span class="muted">${esc(pathLabel(first.path))}</span><button class="btn sm ghost" data-act="diff">${ui.diffOpen ? L("收起差异", "Hide diff") : L("查看差异", "View diff")}</button><button class="btn sm ghost" data-act="discard">${L("放弃", "Discard")}</button><button class="btn sm brand" data-act="save">${L("保存并热重载", "Save & hot reload")} <span class="kbd">⌘S</span></button></div>`;
  }
  async function saveConfig() {
    if (!isDirty()) return;
    const btn = $("#dirty [data-act=save]");
    if (btn) btn.disabled = true;
    try {
      const out = clone(draft);
      if (out.engines && out.engines.default) out.defaultEngine = out.engines.default;
      const d = await api("/api/config", { json: { config: out } });
      S.config = d.config;
      S.yaml = d.yaml || S.yaml;
      draft = clone(d.config);
      ui.diffOpen = false;
      ui.yamlText = null;
      const ch = d.changes || [];
      toast(L("已保存并热重载", "Saved and hot-reloaded") + (ch.length ? "" : L("（没有需要重载的内容）", " (nothing to reload)")), "success", ch);
      renderAll();
      load(["status", "config"]);
    } catch (e) {
      fail(new Error(L("保存失败：", "Save failed: ") + e.message));
      if (btn) btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------- modals
  function chatOptions(botId) {
    return chats().filter((c) => c.botId === botId).map((c) => `<option value="${esc(c.chatId)}">${esc(chatText(c.botId, c.chatId, c.channelType))}</option>`).join("");
  }
  function botSelect(id, val, disabled) {
    return `<select class="app-input" id="${id}"${disabled ? " disabled" : ""}>${botsRt().map((b) => `<option value="${esc(b.botId)}"${b.botId === val ? " selected" : ""}>${esc(b.name)} (${esc(b.channel)})</option>`).join("")}${val && !rtById(val) ? `<option value="${esc(val)}" selected>${esc(val)}</option>` : ""}</select>`;
  }
  function engineSelect(id, val, firstLabel) {
    return `<select class="app-input" id="${id}"><option value="">${esc(firstLabel)}</option>${ENGINES.map((e) => `<option value="${e}"${val === e ? " selected" : ""}>${ENG_FULL[e]}</option>`).join("")}</select>`;
  }
  function modelList(id) {
    const all = new Set();
    for (const e of ENGINES) for (const m of (S.caps[e] && S.caps[e].models) || []) all.add(m.id);
    return `<datalist id="${id}">${Array.from(all).map((m) => `<option value="${esc(m)}">`).join("")}</datalist>`;
  }

  function openNewSession(botId, chatId) {
    const bid = botId || (botsRt()[0] || {}).botId || "";
    openModal({
      key: "newSession",
      title: L("新建会话", "New session"),
      body: `<div class="g2">${fld("Bot", botSelect("ns-bot", bid))}${fld(L("聊天 ID", "Chat ID"), `<input class="app-input mono" id="ns-chat" list="ns-chats" value="${esc(chatId || "")}" placeholder="1465542100 / -100…" autocomplete="off"><datalist id="ns-chats">${chatOptions(bid)}</datalist>`)}</div>
        ${fld(L("标题（可选）", "Title (optional)"), `<input class="app-input" id="ns-title" placeholder="${L("例如：周报整理", "e.g. Weekly report")}">`)}
        <div class="g3">${fld(L("引擎", "Engine"), engineSelect("ns-engine", "", L("Bot 默认", "Bot default")))}${fld(L("模型", "Model"), `<input class="app-input" id="ns-model" list="ns-models" placeholder="${L("默认", "default")}">${modelList("ns-models")}`)}${fld(L("推理强度", "Effort"), `<input class="app-input" id="ns-effort" list="ns-efforts" placeholder="${L("默认", "default")}"><datalist id="ns-efforts"><option value="low"><option value="medium"><option value="high"><option value="xhigh"><option value="max"></datalist>`)}</div>
        <div class="hint">${L("新会话会成为这个聊天的当前会话，之后的消息都进入它。", "The new session becomes current for that chat.")}</div>`,
      foot: `<button class="btn ghost" data-act="closeModal">${L("取消", "Cancel")}</button><button class="btn primary" data-act="createSession">${L("创建", "Create")}</button>`,
      focus: chatId ? "#ns-title" : "#ns-chat",
    });
  }
  function toCronInput(ts) {
    const p = tzParts(ts, S.cronTz);
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${hhmm(p)}`;
  }
  function openCronModal(id, botId, chatId) {
    const j = id ? S.cron.find((x) => x.id === id) : null;
    const bid = (j && j.botId) || botId || (botsRt()[0] || {}).botId || "";
    const kind = j ? j.schedule.kind : "cron";
    const defMin = Math.round(((S.config && S.config.scheduler && S.config.scheduler.defaultTimeoutMs) || 1800000) / 60000);
    openModal({
      key: "cron",
      size: "lg",
      title: j ? L("编辑定时任务", "Edit task") : L("新建定时任务", "New scheduled task"),
      sub: j ? esc(j.id) : "",
      body: `<div class="g2">${fld("Bot", botSelect("cf-bot", bid, !!j))}${fld(L("聊天", "Chat"), `<input class="app-input mono" id="cf-chat" list="cf-chats" value="${esc((j && j.chatId) || chatId || "")}" placeholder="${L("聊天 ID", "Chat ID")}"${j ? " disabled" : ""} autocomplete="off"><datalist id="cf-chats">${chatOptions(bid)}</datalist>`, { hint: j ? "" : L("Bot 必须已经在这个聊天里说过话。", "The bot must already have talked in this chat.") })}</div>
        ${fld(L("名称", "Name"), `<input class="app-input" id="cf-name" value="${esc((j && j.name) || "")}" placeholder="${L("例如：每日 AI 新闻摘要", "e.g. Daily AI news digest")}">`)}
        <div class="fld"><div class="lbl">${L("重复", "Repeat")}</div><div class="seg" id="cf-kind" data-kind="${kind}"><button class="${kind === "cron" ? "on" : ""}" data-act="cfKind" data-v="cron">${L("周期（cron）", "Recurring (cron)")}</button><button class="${kind === "at" ? "on" : ""}" data-act="cfKind" data-v="at">${L("仅一次", "Once")}</button></div></div>
        <div class="g2" id="cf-cron"${kind === "cron" ? "" : " hidden"}>${fld(L("Cron 表达式", "Cron expression"), `<input class="app-input mono" id="cf-expr" data-cronprev value="${esc(j && j.schedule.kind === "cron" ? j.schedule.expr : "")}" placeholder="0 9 * * 1-5" autocomplete="off">`, { hint: `<span id="cf-prev">${L("分 时 日 月 周，例如 “0 9 * * 1-5” 是工作日 09:00，“*/30 * * * *” 是每 30 分钟", "min hour day month weekday, e.g. “0 9 * * 1-5” = weekdays 09:00")}</span>` })}${fld(L("时区", "Timezone"), `<input class="app-input" id="cf-tz" value="${esc(j && j.schedule.kind === "cron" ? j.schedule.tz : "")}" placeholder="${esc(S.cronTz || "Asia/Shanghai")}">`, { hint: L("留空使用调度器时区", "Empty uses the scheduler's timezone") })}</div>
        <div id="cf-at"${kind === "at" ? "" : " hidden"}>${fld(L("运行时间", "Run at") + (S.cronTz ? ` <span class="muted">(${esc(S.cronTz)})</span>` : ""), `<input class="app-input" type="datetime-local" id="cf-attime" value="${esc(j && j.schedule.kind === "at" ? toCronInput(j.schedule.at) : "")}">`)}</div>
        ${fld(L("提示词", "Prompt"), `<textarea class="app-input" id="cf-prompt" style="min-height:170px" placeholder="${L("搜索过去 24 小时最重要的 AI 新闻，写一份简短摘要。", "Search the web for the most important AI news of the last 24 hours and write a short digest.")}">${esc((j && j.prompt) || "")}</textarea>`, { hint: L("运行时没有对话历史，也没人回答问题，所以要写得完整。回复 [SILENT] 就不发消息。", "Runs with no history and nobody to answer questions, so make it self-contained. Reply [SILENT] to post nothing.") })}
        <div class="g4">${fld(L("引擎", "Engine"), engineSelect("cf-engine", (j && j.engine) || "", L("Bot 默认", "Bot default")))}${fld(L("模型", "Model"), `<input class="app-input" id="cf-model" list="cf-models" value="${esc((j && j.model) || "")}" placeholder="${L("默认", "default")}">${modelList("cf-models")}`)}${fld(L("推理强度", "Effort"), `<input class="app-input" id="cf-effort" list="cf-efforts" value="${esc((j && j.effort) || "")}" placeholder="${L("默认", "default")}"><datalist id="cf-efforts"><option value="low"><option value="medium"><option value="high"><option value="xhigh"><option value="max"></datalist>`)}${fld(L("超时（分钟）", "Timeout (min)"), `<input class="app-input" type="number" min="1" id="cf-timeout" value="${j && j.timeoutMs ? Math.round(j.timeoutMs / 60000) : ""}" placeholder="${defMin}">`)}</div>`,
      foot: `<button class="btn ghost" data-act="closeModal">${L("取消", "Cancel")}</button><button class="btn primary" data-act="saveCron" data-id="${j ? esc(j.id) : ""}">${L("保存", "Save")}</button>`,
      focus: j ? "#cf-name" : "#cf-chat",
      onMount: (w) => updateCronPreview(w),
    });
  }
  function updateCronPreview(root) {
    const ex = (root || document).querySelector("#cf-expr");
    const pv = (root || document).querySelector("#cf-prev");
    if (!ex || !pv || !ex.value.trim()) return;
    const d = describeCron(ex.value, lang);
    pv.textContent = d ? "= " + d : L("（无法翻译成白话，会按原表达式执行）", "(no plain-language form; runs as written)");
  }

  function fbOpen(path, sub, file) {
    ui.fb = { path, sub: sub || "", file: file || null, raw: false };
    ui.fbList = {};
    ui.fbFile = {};
    renderFiles();
  }
  function renderFiles() {
    const fb = ui.fb;
    if (!fb) return;
    const key = fb.sub;
    const lists = ui.fbList;
    if (!lists[key]) {
      lists[key] = { loading: true, data: [] };
      api(`/api/workspaces/files?path=${enc(fb.path)}&subDir=${enc(fb.sub)}`)
        .then((d) => (lists[key] = { loading: false, data: d.files || [] }))
        .catch((e) => (lists[key] = { loading: false, data: [], err: e.message }))
        .finally(() => {
          if (!ui.fb || ui.fbList !== lists) return;
          const files = lists[key].data || [];
          if (!ui.fb.file) {
            const first = files.find((f) => !f.isDir && /\.(md|txt|json|ya?ml|log|csv|py|js|ts|sh)$/i.test(f.name)) || files.find((f) => !f.isDir);
            if (first) ui.fb.file = first.relPath;
          }
          renderFiles();
        });
    }
    const files = lists[key].data || [];
    let preview = `<div class="empty" style="margin:auto">${L("选择左侧的文件预览", "Pick a file on the left")}</div>`;
    if (fb.file) {
      const fk = fb.file;
      const fc = ui.fbFile;
      if (!fc[fk]) {
        fc[fk] = { loading: true };
        api(`/api/workspaces/file-content?path=${enc(fb.path)}&file=${enc(fb.file)}`)
          .then((d) => (fc[fk] = { data: d }))
          .catch((e) => (fc[fk] = { err: e.message }))
          .finally(() => ui.fb && ui.fbFile === fc && renderFiles());
      }
      const f = fc[fk];
      const isMd = /\.md$/i.test(fb.file);
      const content = f.data ? f.data.content || "" : "";
      preview = `<div class="fpv-h"><b>${esc(fb.file)}</b>${f.data ? `<span class="muted">${bytes(f.data.size)}</span>` : ""}<div class="r">${isMd && f.data ? `<button class="btn xs ghost" data-act="fbRaw">${fb.raw ? L("渲染", "Rendered") : L("原文", "Raw")}</button>` : ""}${f.data ? `<button class="btn xs ghost" data-act="copy" data-text="${esc(content)}">${ic("copy")}${L("复制", "Copy")}</button>` : ""}</div></div>` +
        (f.loading ? `<div class="empty"><span class="spin"></span></div>` : f.err ? `<div style="padding:14px"><div class="errbox">${ic("alert")}<div>${esc(f.err)}</div></div></div>` : isMd && !fb.raw ? `<div class="md">${renderMarkdown(content)}</div>` : `<pre>${esc(content || L("（空文件）", "(empty file)"))}</pre>`);
    }
    const up = fb.sub ? fb.sub.split("/").slice(0, -1).join("/") : null;
    const list = (fb.sub ? `<a class="fl" data-act="fbDir" data-sub="${esc(up)}">${ic("folder")}<b>..</b></a>` : "") +
      (files.map((f) => `<a class="fl${fb.file === f.relPath ? " on" : ""}" data-act="${f.isDir ? "fbDir" : "fbFile"}" data-sub="${esc(f.relPath)}">${ic(f.isDir ? "folder" : "file")}<b>${esc(f.name)}</b><span>${f.isDir ? "" : bytes(f.size)}</span></a>`).join("") || `<div class="empty-s" style="padding:10px">${lists[key].loading ? L("加载中…", "Loading…") : L("空目录", "Empty folder")}</div>`);
    openModal({
      key: "files",
      size: "xl",
      flush: true,
      title: L("工作区文件", "Workspace files") + (fb.sub ? " / " + esc(fb.sub) : ""),
      sub: esc(fb.path),
      headActions: copyBtn(fb.path, L("复制路径", "Copy path")),
      body: `<div class="fpv"><div class="fpv-l">${list}</div><div class="fpv-r">${preview}</div></div>`,
    });
  }
  function openOrphans() {
    const list = S.workspaces.filter((w) => !w.isKnownSession);
    openModal({
      key: "orphans",
      size: "lg",
      title: L("孤立工作区", "Orphaned workspaces"),
      body: `<p class="hint" style="margin:0 0 12px">${L("这些目录在磁盘上，但已经没有对应的会话或定时任务（比如会话被删了但目录还在）。可以查看内容后删除。", "These folders are on disk but no session or task uses them anymore. Look inside, then delete if you don't need them.")}</p>${list
        .map((w) => `<div class="rel"><span>${ic("folder")}</span><div style="min-width:0;flex:1"><b class="mono" style="font-size:12px">${esc(w.folderName)}</b><div class="muted" style="font-size:11.5px">${esc(w.botName || w.botId || "")} · ${L(`${w.fileCount} 个文件`, `${w.fileCount} files`)} · ${bytes(w.sizeBytes)} · ${esc(fmtWhen(w.mtime))}</div></div><button class="btn sm outline" data-act="files" data-path="${esc(w.path)}">${L("查看", "Browse")}</button><button class="btn sm ghost danger" data-act="delWorkspace" data-path="${esc(w.path)}" data-name="${esc(w.folderName)}">${ic("trash")}</button></div>`)
        .join("") || `<div class="empty">${L("没有孤立工作区", "Nothing orphaned")}</div>`}`,
    });
  }
  function openSoul(i) {
    const b = draft.bots[i];
    const rt = rtByName(b.name);
    if (!rt) return;
    const wrap = openModal({
      key: "soul",
      size: "lg",
      title: L("人设 · ", "Persona · ") + esc(b.name),
      sub: esc(`~/.pocketagent/agents/${rt.botId}/SOUL.md`),
      body: `<p class="hint" style="margin:0 0 10px">${L("Bot 的性格、口吻和行为准则。每次对话都会放进系统提示词里，保存后下一条消息生效。", "The bot's personality, tone and rules. It goes into the system prompt of every conversation from the next message on.")}</p><textarea class="app-input code" id="soulEd" style="min-height:380px" spellcheck="false">${L("加载中…", "Loading…")}</textarea>`,
      foot: `<span class="l" id="soul-state"></span><button class="btn ghost" data-act="closeModal">${L("取消", "Cancel")}</button><button class="btn primary" data-act="saveSoul" data-bot="${esc(rt.botId)}">${L("保存", "Save")}</button>`,
    });
    api(`/api/soul?bot_id=${enc(rt.botId)}`)
      .then((d) => {
        const ta = wrap.querySelector("#soulEd");
        if (ta) {
          ta.value = d.content || "";
          ta.focus();
        }
        const st = wrap.querySelector("#soul-state");
        if (st) st.textContent = d.content ? "" : L("还没有 SOUL.md，保存后创建。", "No SOUL.md yet; saving creates it.");
      })
      .catch(fail);
  }
  function openAlias(key) {
    const [botId, chatId] = key.split("|");
    const c = chats().find((x) => x.key === key);
    openModal({
      key: "alias",
      title: L("本地备注名", "Local name"),
      body: `${fld(L("名称", "Name"), `<input class="app-input" id="al-name" value="${esc(aliases[key] || "")}" placeholder="${esc(chatTitle(botId, chatId, c && c.channelType).text)}">`, { hint: L("只保存在这个浏览器里，用来认出聊天。接口不提供群名和频道名，所以需要你自己起。留空就恢复默认。", "Only stored in this browser, to recognise the chat. The API doesn't expose chat names. Leave empty to reset.") })}`,
      foot: `<button class="btn ghost" data-act="closeModal">${L("取消", "Cancel")}</button><button class="btn primary" data-act="saveAlias" data-key="${esc(key)}">${L("保存", "Save")}</button>`,
      focus: "#al-name",
    });
  }
  function openNewSkill() {
    openModal({
      key: "newSkill",
      title: L("新建技能", "New skill"),
      body: `${fld(L("名称", "Name"), `<input class="app-input mono" id="sk-name" placeholder="stock-analyzer" autocomplete="off">`, { hint: L("用小写字母和连字符。", "Lowercase letters and dashes.") })}${fld(L("描述", "Description"), `<textarea class="app-input" id="sk-desc" placeholder="${L("这个技能做什么、什么时候该用它？", "What does it do, and when should engines use it?")}"></textarea>`, { hint: L("引擎会根据描述决定什么时候调用。", "Engines decide when to use it from this.") })}`,
      foot: `<button class="btn ghost" data-act="closeModal">${L("取消", "Cancel")}</button><button class="btn primary" data-act="createSkill">${L("创建并同步", "Create & sync")}</button>`,
      focus: "#sk-name",
    });
  }

  // ---------------------------------------------------------------- command palette
  function openPalette() {
    ui.pal = { q: "", idx: 0 };
    renderPalette();
  }
  function closePalette() {
    ui.pal = null;
    $("#palroot").innerHTML = "";
  }
  function markText(text, q) {
    const s = String(text || "");
    if (!q) return esc(s);
    const i = s.toLowerCase().indexOf(q);
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + q.length)) + "</mark>" + esc(s.slice(i + q.length));
  }
  function palItems(q) {
    const out = [];
    const hit = (...xs) => !q || xs.some((x) => String(x || "").toLowerCase().includes(q));
    const add = (g, it, limit) => {
      const n = out.filter((x) => x.g === g).length;
      if (n < (limit || 6)) out.push(Object.assign({ g }, it));
    };
    for (const k of Object.keys(PAGES)) if (hit(PAGES[k].t(), k)) add(L("页面", "Pages"), { icon: ic(PAGES[k].icon), label: PAGES[k].t(), run: () => go(k) }, q ? 6 : 10);
    for (const c of chats()) {
      const t = chatText(c.botId, c.chatId, c.channelType);
      if (hit(t, c.chatId, c.botName, c.sessions.map((s) => s.sessionId).join(" "))) add(L("聊天", "Chats"), { icon: chn(c.channelType), label: t, sub: `${c.botName} · ${L(`${c.sessions.length} 个会话`, `${c.sessions.length} sessions`)}`, right: eng(c.active.activeEngine), run: () => go("sessions", c.botId, c.chatId) }, q ? 6 : 4);
    }
    if (q) {
      for (const j of S.cron) if (hit(j.name, j.id, j.prompt)) {
        add(L("定时任务", "Tasks"), { icon: ic("clock"), label: j.name, sub: cronSched(j).main, right: cronPill(j), run: () => go("cron", j.id) });
        add(L("操作", "Actions"), { icon: ic("play"), label: L(`立即运行「${j.name}」`, `Run “${j.name}” now`), run: () => ACT.runCron({ dataset: { id: j.id } }) }, 3);
      }
      for (const j of S.jobs) if (hit("#" + j.seq + " " + j.title, j.id, j.command)) add(L("后台作业", "Jobs"), { icon: ic("term"), label: `#${j.seq} ${j.title}`, sub: ago(j.finishedAt || j.createdAt), right: jobResult(j), run: () => go("jobs", j.id) });
      for (const s of S.skills) if (hit(s.name, s.description)) add(L("技能", "Skills"), { icon: ic("blocks"), label: s.name, sub: s.description, run: () => go("skills", s.name) });
      ((draft && draft.bots) || []).forEach((b, i) => {
        if (hit(b.name)) add("Bots", { icon: chn(b.channel), label: b.name, run: () => go("bots", i) });
      });
    }
    const acts = [
      [L("新建会话", "New session"), "plus", () => openNewSession()],
      [L("新建定时任务", "New scheduled task"), "plus", () => openCronModal()],
      [L("新建技能", "New skill"), "plus", () => openNewSkill()],
      [L("添加 Bot", "Add bot"), "plus", () => go("bots", "new")],
      [L("刷新数据", "Refresh data"), "refresh", () => ACT.refresh()],
      [L("切换语言 / Switch language", "Switch language / 切换语言"), "globe", () => ACT.lang({ dataset: { v: lang === "zh" ? "en" : "zh" } })],
      [theme === "dark" ? L("切换到浅色主题", "Light theme") : L("切换到深色主题", "Dark theme"), theme === "dark" ? "sun" : "moon", () => ACT.theme({ dataset: { v: theme === "dark" ? "light" : "dark" } })],
    ];
    if (isDirty()) acts.unshift([L("保存配置并热重载", "Save config & hot reload"), "check", () => saveConfig()]);
    for (const [label, icon, run] of acts) if (hit(label)) add(L("操作", "Actions"), { icon: ic(icon), label, run }, 8);
    const order = [];
    for (const it of out) if (!order.includes(it.g)) order.push(it.g);
    return out.map((it, i) => [it, i]).sort((a, b) => order.indexOf(a[0].g) - order.indexOf(b[0].g) || a[1] - b[1]).map((x) => x[0]);
  }
  function renderPalette() {
    if (!ui.pal) return;
    const q = ui.pal.q.trim().toLowerCase();
    const items = palItems(q);
    ui.pal.items = items;
    if (ui.pal.idx >= items.length) ui.pal.idx = Math.max(0, items.length - 1);
    let lastG = null;
    const list = items.map((it, i) => {
      const g = it.g !== lastG ? `<div class="pal-g">${esc(it.g)}</div>` : "";
      lastG = it.g;
      return `${g}<div class="pal-i${i === ui.pal.idx ? " on" : ""}" data-pal="${i}">${it.icon}<span class="t">${markText(it.label, q)}</span>${it.sub ? `<span class="muted">${esc(it.sub)}</span>` : ""}<span class="r">${it.right || ""}${i === ui.pal.idx ? `<span class="kbd">↵</span>` : ""}</span></div>`;
    }).join("");
    const root = $("#palroot");
    if (!root.firstElementChild) {
      root.innerHTML = `<div class="scrim" data-palscrim><div class="pal"><div class="pal-in">${ic("search")}<input id="pal-in" placeholder="${L("搜索聊天、任务、作业、技能，或输入操作…", "Search chats, tasks, jobs, skills, or an action…")}" autocomplete="off" spellcheck="false"><span class="kbd">esc</span></div><div class="pal-list"></div><div class="pal-f"><span><span class="kbd">↑</span> <span class="kbd">↓</span> ${L("选择", "select")}</span><span><span class="kbd">↵</span> ${L("打开", "open")}</span><span class="r">${L("只搜索已加载的数据", "Searches loaded data only")}</span></div></div></div>`;
      setTimeout(() => $("#pal-in") && $("#pal-in").focus(), 10);
    }
    root.querySelector(".pal-list").innerHTML = list || `<div class="empty">${L("没有结果", "No results")}</div>`;
    const on = root.querySelector(".pal-i.on");
    if (on) on.scrollIntoView({ block: "nearest" });
  }
  function runPal(i) {
    const it = ui.pal && ui.pal.items && ui.pal.items[i];
    closePalette();
    if (it) it.run();
  }

  // ---------------------------------------------------------------- actions
  const ACT = {
    refresh: () => load(["status", "pairings", "sessions", "cron", "jobs", "config", "skills"]),
    theme: (el) => {
      theme = el.dataset.v;
      store.set("pa2.theme", theme);
      applyTheme();
      renderSide();
    },
    lang: (el) => {
      lang = el.dataset.v;
      store.set("pa2.lang", lang);
      renderAll();
    },
    palette: () => openPalette(),
    closeModal: () => closeModal(),
    confirmOk: (el) => {
      const wrap = el.closest(".scrim");
      const chk = wrap.querySelector("#cf-check");
      const res = { ok: true, checked: chk ? chk.checked : false };
      const r = wrap._resolve;
      wrap._resolve = null;
      wrap.remove();
      if (r) r(res);
    },
    copy: (el) => {
      const text = el.dataset.text || "";
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable")))
        .then(() => toast(L("已复制", "Copied"), "success"))
        .catch(fail);
    },
    diff: () => {
      ui.diffOpen = !ui.diffOpen;
      renderDirty();
    },
    discard: async () => {
      const r = await confirmDialog({ title: L("放弃未保存的更改？", "Discard unsaved changes?"), body: L(`这 ${changes().length} 处更改会丢失。`, `${changes().length} changes will be lost.`), ok: L("放弃", "Discard"), danger: true });
      if (!r) return;
      draft = clone(S.config);
      ui.newBot = null;
      renderAll();
    },
    save: () => saveConfig(),
    approve: async (el) => {
      try {
        const d = await api("/api/pairings/approve", { json: { code: el.dataset.code } });
        toast(L(`已批准 ${d.senderId || ""}（${d.botName || ""}）`, `Approved ${d.senderId || ""} (${d.botName || ""})`), "success");
      } catch (e) {
        fail(e);
      }
      load(["pairings", "config", "status"]);
    },
    // sessions
    sesCh: (el) => {
      ui.ses.ch = el.dataset.v;
      renderMain(true);
    },
    pickSession: (el) => {
      ui.sesSel[el.dataset.key] = el.dataset.sid;
      renderMain(true);
    },
    toggleRail: () => {
      ui.rail = !ui.rail;
      renderMain(true);
    },
    setCurrent: async (el) => {
      const [botId, chatId] = el.dataset.key.split("|");
      try {
        await api("/api/sessions/switch", { json: { botId, chatId, sessionId: el.dataset.sid } });
        toast(L("已设为当前会话", "Now the current session"), "success");
        load(["sessions"]);
      } catch (e) {
        fail(e);
      }
    },
    delSession: async (el) => {
      const [botId, chatId] = el.dataset.key.split("|");
      const s = S.sessions.find((x) => x.sessionId === el.dataset.sid && x.botId === botId);
      const r = await confirmDialog({
        title: L("删除这个会话？", "Delete this session?"),
        body: L(`会话 #${s ? s.sessionNum : ""} 的 ${s ? s.turnCount : 0} 轮对话记录会被删除，无法恢复。`, `The ${s ? s.turnCount : 0} turns of session #${s ? s.sessionNum : ""} will be deleted for good.`),
        check: s && s.workspaceExists ? { label: L(`同时删除工作区目录（${s.workspaceFileCount || 0} 个文件，${bytes(s.workspaceSizeBytes)}）`, `Also delete its workspace folder (${s.workspaceFileCount || 0} files, ${bytes(s.workspaceSizeBytes)})`), on: true } : null,
        ok: L("删除", "Delete"),
        danger: true,
      });
      if (!r) return;
      try {
        await api("/api/sessions", { method: "DELETE", json: { botId, chatId, sessionId: el.dataset.sid, deleteWorkspace: !!r.checked } });
        delete ui.sesSel[el.dataset.key];
        toast(L("会话已删除", "Session deleted"), "success");
        load(["sessions"]);
      } catch (e) {
        fail(e);
      }
    },
    newSession: (el) => openNewSession(el.dataset.bot, el.dataset.chat),
    createSession: async () => {
      const botId = $("#ns-bot").value;
      const chatId = $("#ns-chat").value.trim();
      if (!botId || !chatId) return toast(L("请选择 Bot 并填写聊天 ID", "Pick a bot and enter a chat ID"), "error");
      const v = (id) => $(id).value.trim() || undefined;
      try {
        await api("/api/sessions/new", { json: { botId, chatId, title: v("#ns-title"), engine: v("#ns-engine"), model: v("#ns-model"), effort: v("#ns-effort") } });
        closeModal();
        toast(L("会话已创建", "Session created"), "success");
        await load(["sessions"]);
        go("sessions", botId, chatId);
      } catch (e) {
        fail(e);
      }
    },
    alias: (el) => openAlias(el.dataset.key),
    saveAlias: (el) => {
      const v = $("#al-name").value.trim();
      if (v) aliases[el.dataset.key] = v;
      else delete aliases[el.dataset.key];
      store.set("pa2.alias", aliases);
      closeModal();
      renderMain(true);
    },
    send: async (el) => {
      const key = el.dataset.key;
      const [botId, chatId] = key.split("|");
      const input = $("#composer");
      const text = ((input && input.value) || "").trim();
      if (!text) return;
      try {
        await api(`/api/send-message?chat_id=${enc(chatId)}&bot_id=${enc(botId)}`, { json: { text } });
        ui.compose[key] = "";
        if (input) input.value = "";
        toast(L("已发送", "Sent"), "success");
      } catch (e) {
        fail(e);
      }
    },
    files: (el) => {
      fbOpen(el.dataset.path, el.dataset.sub, el.dataset.file);
    },
    fbDir: (el) => {
      ui.fb.sub = el.dataset.sub || "";
      ui.fb.file = null;
      renderFiles();
    },
    fbFile: (el) => {
      ui.fb.file = el.dataset.sub;
      renderFiles();
    },
    fbRaw: () => {
      ui.fb.raw = !ui.fb.raw;
      renderFiles();
    },
    orphans: () => openOrphans(),
    delWorkspace: async (el) => {
      const r = await confirmDialog({ title: L("删除这个目录？", "Delete this folder?"), body: `<span class="mono">${esc(el.dataset.name)}</span><br>${L("目录里的所有文件都会被删除，无法恢复。", "Everything in it is deleted for good.")}`, ok: L("删除", "Delete"), danger: true });
      if (!r) return;
      try {
        await api(`/api/workspaces?path=${enc(el.dataset.path)}`, { method: "DELETE" });
        toast(L("目录已删除", "Folder deleted"), "success");
        await load(["sessions"]);
        if ($('[data-modal="orphans"]')) openOrphans();
      } catch (e) {
        fail(e);
      }
    },
    // cron
    cronSt: (el) => {
      ui.cronF.st = el.dataset.v;
      renderMain(true);
    },
    cronTab: (el) => {
      ui.cronTab = el.dataset.v;
      renderMain(true);
    },
    cronRun: (el) => {
      ui.cronRunSel[el.dataset.id] = ui.cronRunSel[el.dataset.id] === Number(el.dataset.n) && el.classList.contains("run-h") ? -1 : Number(el.dataset.n);
      renderMain(true);
    },
    cronRaw: () => {
      ui.cronRaw = !ui.cronRaw;
      renderMain(true);
    },
    promptMd: () => {
      ui.promptMd = !ui.promptMd;
      renderMain(true);
    },
    runCron: async (el) => {
      try {
        await api(`/api/cron/run?id=${enc(el.dataset.id)}`, { method: "POST" });
        toast(L("已开始运行，结果会发到聊天", "Started; the result goes to the chat"), "success");
        load(["cron"]);
      } catch (e) {
        fail(e);
      }
    },
    toggleCron: async (el) => {
      const j = S.cron.find((x) => x.id === el.dataset.id);
      if (!j) return;
      try {
        await api("/api/cron/update", { json: { id: j.id, enabled: !j.enabled } });
        j.enabled = !j.enabled;
        renderMain(true);
        load(["cron"]);
      } catch (e) {
        fail(e);
      }
    },
    delCron: async (el) => {
      const j = S.cron.find((x) => x.id === el.dataset.id);
      const r = await confirmDialog({ title: L("删除定时任务？", "Delete scheduled task?"), body: L(`「${esc(j ? j.name : el.dataset.id)}」和它的运行记录会被删除。`, `“${esc(j ? j.name : el.dataset.id)}” and its run history will be deleted.`), ok: L("删除", "Delete"), danger: true });
      if (!r) return;
      try {
        await api(`/api/cron?id=${enc(el.dataset.id)}`, { method: "DELETE" });
        toast(L("任务已删除", "Task deleted"), "success");
        await load(["cron"]);
        go("cron");
      } catch (e) {
        fail(e);
      }
    },
    newCron: (el) => openCronModal(null, el && el.dataset && el.dataset.bot, el && el.dataset && el.dataset.chat),
    editCron: (el) => openCronModal(el.dataset.id),
    cfKind: (el) => {
      const k = el.dataset.v;
      $("#cf-kind").dataset.kind = k;
      $$("#cf-kind button").forEach((b) => b.classList.toggle("on", b.dataset.v === k));
      $("#cf-cron").hidden = k !== "cron";
      $("#cf-at").hidden = k !== "at";
    },
    saveCron: async (el) => {
      const id = el.dataset.id;
      const get = (s) => ($(s) ? $(s).value.trim() : "");
      const kind = $("#cf-kind").dataset.kind;
      const body = { name: get("#cf-name"), prompt: get("#cf-prompt"), engine: get("#cf-engine"), model: get("#cf-model"), effort: get("#cf-effort"), timeout_minutes: get("#cf-timeout") || null };
      if (kind === "cron") {
        body.cron = get("#cf-expr");
        body.tz = get("#cf-tz");
      } else body.at = get("#cf-attime");
      const botId = get("#cf-bot");
      const chatId = get("#cf-chat");
      if (!botId || !chatId || !body.prompt || !(body.cron || body.at)) return toast(L("Bot、聊天、计划和提示词都要填", "Bot, chat, schedule and prompt are required"), "error");
      try {
        const d = id ? await api("/api/cron/update", { json: Object.assign({ id }, body) }) : await api("/api/cron", { json: Object.assign({ bot_id: botId, chat_id: chatId }, body) });
        closeModal();
        toast(L("任务已保存", "Task saved"), "success");
        await load(["cron"]);
        if (d.job) go("cron", d.job.id);
      } catch (e) {
        fail(e);
      }
    },
    // jobs
    jobsSt: (el) => {
      ui.jobsF.st = el.dataset.v;
      renderMain(true);
    },
    toggleJob: (el) => {
      ui.jobOpen = ui.jobOpen === el.dataset.id ? null : el.dataset.id;
      renderMain(true);
    },
    follow: (el) => {
      const id = el.dataset.id;
      ui.follow[id] = ui.follow[id] === false;
      el.classList.toggle("off", ui.follow[id] === false);
      el.innerHTML = `<i></i>${ui.follow[id] === false ? L("已暂停跟随", "Paused") : L("跟随输出", "Following")}`;
      if (ui.follow[id] !== false) {
        const pre = document.querySelector(`pre[data-log="${CSS.escape(id)}"]`);
        if (pre) pre.scrollTop = pre.scrollHeight;
      }
    },
    cancelJob: async (el) => {
      const j = S.jobs.find((x) => x.id === el.dataset.id);
      const r = await confirmDialog({ title: L("取消这个作业？", "Cancel this job?"), body: L(`#${j ? j.seq : ""} ${esc(j ? j.title : "")} 会被终止，Agent 会收到「已取消」的结果。`, `#${j ? j.seq : ""} ${esc(j ? j.title : "")} will be stopped and the agent told it was cancelled.`), ok: L("取消作业", "Cancel job"), danger: true });
      if (!r) return;
      try {
        await api(`/api/jobs/cancel?id=${enc(el.dataset.id)}`, { method: "POST" });
        toast(L("已取消", "Cancelled"), "success");
        setTimeout(() => load(["jobs"]), 600);
      } catch (e) {
        fail(e);
      }
    },
    delJob: async (el) => {
      const r = await confirmDialog({ title: L("删除这条记录？", "Delete this record?"), body: L("作业记录和日志会被删除。", "The job record and its log are deleted."), ok: L("删除", "Delete"), danger: true });
      if (!r) return;
      try {
        await api(`/api/jobs?id=${enc(el.dataset.id)}`, { method: "DELETE" });
        ui.jobOpen = null;
        toast(L("已删除", "Deleted"), "success");
        load(["jobs"]);
      } catch (e) {
        fail(e);
      }
    },
    // config editing
    setPath: (el) => {
      bset(el.dataset.path, el.dataset.val === "" ? undefined : el.dataset.val);
      configChanged(true);
    },
    swPath: (el) => {
      bset(el.dataset.path, el.dataset.on !== "1");
      configChanged(true);
    },
    tagDel: (el) => {
      const arr = (bget(el.dataset.path) || []).slice();
      arr.splice(Number(el.dataset.i), 1);
      bset(el.dataset.path, arr);
      configChanged(true);
    },
    reveal: (el) => {
      ui.reveal[el.dataset.k] = !ui.reveal[el.dataset.k];
      renderMain(true);
    },
    groupToggle: (el) => {
      const groups = Object.assign({}, bget(el.dataset.path) || {});
      const v = groups[el.dataset.g];
      if (v && typeof v === "object") groups[el.dataset.g] = Object.assign({}, v, { enabled: v.enabled === false });
      else groups[el.dataset.g] = !(v === true || v === undefined);
      bset(el.dataset.path, groups);
      configChanged(true);
    },
    groupDel: (el) => {
      const groups = Object.assign({}, bget(el.dataset.path) || {});
      delete groups[el.dataset.g];
      bset(el.dataset.path, groups);
      configChanged(true);
    },
    groupAdd: (el) => {
      const input = $("#grp-add");
      const v = ((input && input.value) || "").trim();
      if (!v) return;
      const groups = Object.assign({}, bget(el.dataset.path) || {});
      groups[v] = true;
      bset(el.dataset.path, groups);
      configChanged(true);
    },
    addBot: () => {
      const b = ui.newBot;
      if (!b.name || !b.name.trim()) return toast(L("请填写名称", "Name is required"), "error");
      if (!b.token) return toast(L("请填写 Token", "Token is required"), "error");
      if ((draft.bots || []).some((x) => x.name === b.name.trim())) return toast(L("已经有同名的 Bot", "A bot with this name exists"), "error");
      b.name = b.name.trim();
      draft.bots = (draft.bots || []).concat([clone(b)]);
      ui.newBot = null;
      configChanged(false);
      go("bots", draft.bots.length - 1);
      toast(L("已添加，保存后启动", "Added; save to start it"), "success");
    },
    delBot: async (el) => {
      const i = Number(el.dataset.i);
      const b = draft.bots[i];
      const r = await confirmDialog({ title: L("删除这个 Bot？", "Delete this bot?"), body: L(`「${esc(b.name)}」会从配置中移除，保存后停止运行。它的会话记录和工作区不会被删除。`, `“${esc(b.name)}” is removed from the config and stops after you save. Its sessions and workspaces are kept.`), ok: L("删除", "Delete"), danger: true });
      if (!r) return;
      draft.bots.splice(i, 1);
      configChanged(false);
      go("bots");
    },
    soul: (el) => openSoul(Number(el.dataset.i)),
    saveSoul: async (el) => {
      const content = $("#soulEd").value;
      try {
        await api("/api/soul", { json: { bot_id: el.dataset.bot, content } });
        delete ui.soul[el.dataset.bot];
        closeModal();
        toast(L("SOUL.md 已保存，下一条消息生效", "SOUL.md saved; applies from the next message"), "success");
        renderMain(true);
      } catch (e) {
        fail(e);
      }
    },
    engOpen: (el) => {
      ui.engOpen = (ui.engOpen || defaultEngine()) === el.dataset.v ? "none" : el.dataset.v;
      renderMain(true);
    },
    rescan: async () => {
      toast(L("正在重新扫描模型…", "Rescanning models…"));
      await load(["models"], true);
      toast(L("模型列表已更新", "Model list updated"), "success");
    },
    // skills
    newSkill: () => openNewSkill(),
    createSkill: async () => {
      const name = $("#sk-name").value.trim();
      if (!name) return toast(L("请填写名称", "Name is required"), "error");
      try {
        await api("/api/skills/new", { json: { name, description: $("#sk-desc").value.trim() } });
        closeModal();
        toast(L("技能已创建并同步", "Skill created and synced"), "success");
        await load(["skills"]);
        go("skills", name);
      } catch (e) {
        fail(e);
      }
    },
    saveSkill: async (el) => {
      const name = el.dataset.name;
      const text = ui.skillText[name];
      if (text === undefined) return;
      try {
        await api("/api/skills/update", { json: { name, skillMd: text } });
        delete ui.skillText[name];
        delete ui.skill[name];
        toast(L("已保存并同步到 4 个 CLI", "Saved and synced to all 4 CLIs"), "success");
        load(["skills"]);
      } catch (e) {
        fail(e);
      }
    },
    revertSkill: (el) => {
      delete ui.skillText[el.dataset.name];
      renderAll();
    },
    delSkill: async (el) => {
      const name = el.dataset.name;
      const r = await confirmDialog({ title: L("删除技能？", "Delete skill?"), body: L(`「${esc(name)}」的文件夹会被删除，并从 4 个 CLI 中移除。`, `The “${esc(name)}” folder is deleted and removed from all 4 CLIs.`), ok: L("删除", "Delete"), danger: true });
      if (!r) return;
      try {
        await api(`/api/skills?name=${enc(name)}`, { method: "DELETE" });
        delete ui.skillText[name];
        toast(L("技能已删除", "Skill deleted"), "success");
        await load(["skills"]);
        go("skills");
      } catch (e) {
        fail(e);
      }
    },
    syncSkills: async () => {
      try {
        const d = await api("/api/skills/sync", { method: "POST" });
        toast(L(`已同步 ${(d.skills || []).length} 个技能`, `Synced ${(d.skills || []).length} skills`), "success");
        load(["skills"]);
      } catch (e) {
        fail(e);
      }
    },
    // yaml
    revertYaml: () => {
      ui.yamlText = null;
      renderMain(true);
    },
    applyYaml: async () => {
      if (ui.yamlText === null) return;
      try {
        const d = await api("/api/config", { json: { yaml: ui.yamlText } });
        S.config = d.config;
        S.yaml = d.yaml || ui.yamlText;
        draft = clone(d.config);
        ui.yamlText = null;
        toast(L("已应用并热重载", "Applied and hot-reloaded"), "success", d.changes || []);
        renderAll();
        load(["status"]);
      } catch (e) {
        fail(new Error(L("YAML 有误，没有写入：", "Invalid YAML, nothing written: ") + e.message));
      }
    },
  };

  function configChanged(rerender) {
    renderDirty();
    renderSide();
    if (rerender) renderMain(true);
    else {
      // Only refresh the "modified" markers so the focused input keeps its state
      $$("[data-fld]").forEach((el) => el.classList.toggle("mod", isMod(el.dataset.fld)));
    }
  }

  // ---------------------------------------------------------------- events
  function onClick(e) {
    const pi = e.target.closest("[data-pal]");
    if (pi) return runPal(Number(pi.dataset.pal));
    if (e.target.matches("[data-palscrim]")) return closePalette();
    const mb = e.target.closest("[data-menu]");
    if (mb) {
      e.preventDefault();
      const m = mb.parentElement.querySelector(".menu");
      const wasHidden = m.hidden;
      $$(".menu").forEach((x) => (x.hidden = true));
      m.hidden = !wasHidden;
      return;
    }
    if (!e.target.closest(".menu")) closeMenus();
    const a = e.target.closest("[data-act]");
    if (a) {
      if (a.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (a.closest(".menu")) closeMenus();
      const fn = ACT[a.dataset.act];
      if (fn) fn(a, e);
      return;
    }
    const g = e.target.closest("[data-go]");
    if (g && !e.target.closest("a,button,input,select,textarea")) {
      go.apply(null, g.dataset.go.split("|"));
      return;
    }
    if (e.target.classList.contains("scrim") && !e.target.dataset.palscrim) closeModal();
  }
  function onInput(e) {
    const t = e.target;
    if (composing || e.isComposing) return;
    if (t.id === "pal-in") {
      ui.pal.q = t.value;
      ui.pal.idx = 0;
      return renderPalette();
    }
    if (t.dataset.path !== undefined && t.matches("input:not([type=checkbox]),textarea")) {
      bset(t.dataset.path, toStore(t.value, t.dataset.conv));
      return configChanged(false);
    }
    if (t.dataset.filter !== undefined && t.matches("input")) {
      const [o, k] = t.dataset.filter.split(".");
      ui[o][k] = t.value;
      return renderMain(true);
    }
    if (t.dataset.composer !== undefined) ui.compose[t.dataset.composer] = t.value;
    if (t.dataset.yaml !== undefined) {
      const was = ui.yamlText !== null && ui.yamlText !== S.yaml;
      ui.yamlText = t.value;
      const now = ui.yamlText !== S.yaml;
      if (was !== now) renderMain(true);
    }
    if (t.dataset.skill !== undefined) {
      const name = t.dataset.skill;
      const orig = ui.skill[name] && ui.skill[name].data ? ui.skill[name].data.skillMd || "" : "";
      const was = ui.skillText[name] !== undefined;
      if (t.value === orig) delete ui.skillText[name];
      else ui.skillText[name] = t.value;
      if (was !== (ui.skillText[name] !== undefined)) {
        renderMain(true);
        renderSide();
      }
    }
    if (t.dataset.cronprev !== undefined) updateCronPreview(t.closest(".modal"));
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.path !== undefined && t.matches("select")) {
      bset(t.dataset.path, t.value === "" ? undefined : t.value);
      return configChanged(true);
    }
    if (t.dataset.filter !== undefined && t.matches("select")) {
      const [o, k] = t.dataset.filter.split(".");
      ui[o][k] = t.value;
      return renderMain(true);
    }
    if (t.id === "ns-bot") $("#ns-chats").innerHTML = chatOptions(t.value);
    if (t.id === "cf-bot") $("#cf-chats").innerHTML = chatOptions(t.value);
  }
  function addTag(input) {
    const path = input.dataset.tag;
    const vals = input.value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!vals.length) return;
    const arr = (bget(path) || []).slice();
    for (const v of vals) if (!arr.includes(v)) arr.push(v);
    bset(path, arr);
    input.value = "";
    configChanged(true);
    const again = document.querySelector(`[data-tag="${CSS.escape(path)}"]`);
    if (again) again.focus();
  }
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      return ui.pal ? closePalette() : openPalette();
    }
    if (ui.pal) {
      const n = (ui.pal.items || []).length;
      if (e.key === "Escape") return closePalette();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        ui.pal.idx = n ? (ui.pal.idx + 1) % n : 0;
        return renderPalette();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        ui.pal.idx = n ? (ui.pal.idx - 1 + n) % n : 0;
        return renderPalette();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        return runPal(ui.pal.idx);
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (ui.route.page === "skills" && ui.skillText[ui.route.args[0] || (S.skills[0] && S.skills[0].name)] !== undefined) return ACT.saveSkill({ dataset: { name: ui.route.args[0] || S.skills[0].name } });
      if (ui.route.page === "yaml" && ui.yamlText !== null) return ACT.applyYaml();
      if (isDirty()) return saveConfig();
      return;
    }
    if (e.key === "Escape") {
      if ($$(".menu:not([hidden])").length) return closeMenus();
      if (modalOpen()) return closeModal();
      if (ui.diffOpen) {
        ui.diffOpen = false;
        return renderDirty();
      }
      if (ui.route.page === "bots" && ui.route.args.length) return go("bots");
      return;
    }
    const t = e.target;
    if (t.dataset && t.dataset.tag !== undefined) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        return addTag(t);
      }
      if (e.key === "Backspace" && !t.value) {
        const arr = (bget(t.dataset.tag) || []).slice();
        if (arr.length) {
          arr.pop();
          bset(t.dataset.tag, arr);
          configChanged(true);
          const again = document.querySelector(`[data-tag="${CSS.escape(t.dataset.tag)}"]`);
          if (again) again.focus();
        }
      }
      return;
    }
    if (t.id === "composer" && e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      return ACT.send({ dataset: { key: t.dataset.composer } });
    }
    if (t.id === "grp-add" && e.key === "Enter") {
      e.preventDefault();
      const btn = $("[data-act=groupAdd]");
      if (btn) ACT.groupAdd(btn);
    }
    if (t.id === "al-name" && e.key === "Enter") {
      e.preventDefault();
      const btn = $("[data-act=saveAlias]");
      if (btn) ACT.saveAlias(btn);
    }
  }

  function applyTheme() {
    const dark = theme === "dark" || (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  function init() {
    applyTheme();
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => theme === "system" && applyTheme());
    mountShell();
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    document.addEventListener("compositionstart", () => (composing = true));
    document.addEventListener("compositionend", (e) => {
      composing = false;
      onInput(e);
    });
    document.addEventListener("focusout", () => setTimeout(() => pendingRender && canAutoRender() && renderMain(), 0));
    document.addEventListener("visibilitychange", () => !document.hidden && load(["status", "pairings", "jobs", "sessions", "cron"]));
    window.addEventListener("hashchange", route);
    window.addEventListener("beforeunload", (e) => {
      if (isDirty() || Object.keys(ui.skillText).length || (ui.yamlText !== null && ui.yamlText !== S.yaml)) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    ui.route = parseHash();
    renderAll();
    load(["status", "config", "models", "skills", "pairings", "sessions", "cron", "jobs"]);
    setInterval(tick, 1000);
  }

  init();
}
