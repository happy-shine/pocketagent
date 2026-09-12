export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PocketAgent Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2318181b'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>">
  <style>
    /* Minimalist Design System */
    :root {
      --bg-page: #f8fafc;
      --bg-surface: #ffffff;
      --bg-card: #ffffff;
      --bg-card-subtle: #f8fafc;
      --bg-hover: #f1f5f9;
      --bg-input: #ffffff;
      --border: #e2e8f0;
      --border-subtle: #edf2f7;
      --border-focus: #0f172a;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      
      --btn-primary-bg: #0f172a;
      --btn-primary-text: #ffffff;
      --btn-primary-hover: #1e293b;
      
      --btn-secondary-bg: #ffffff;
      --btn-secondary-border: #cbd5e1;
      --btn-secondary-text: #0f172a;
      --btn-secondary-hover: #f1f5f9;
      
      --tag-bg: #f1f5f9;
      --tag-border: #e2e8f0;
      --tag-text: #0f172a;
      
      --badge-green-bg: #ecfdf5;
      --badge-green-text: #047857;
      --badge-green-border: #a7f3d0;
      
      --badge-red-bg: #fef2f2;
      --badge-red-text: #b91c1c;
      --badge-red-border: #fecaca;
      
      --badge-amber-bg: #fffbeb;
      --badge-amber-text: #b45309;
      --badge-amber-border: #fde68a;
      
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03);
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    [data-theme="dark"] {
      --bg-page: #09090b;
      --bg-surface: #121215;
      --bg-card: #121215;
      --bg-card-subtle: #18181b;
      --bg-hover: #1c1c21;
      --bg-input: #18181b;
      --border: #27272a;
      --border-subtle: #1f1f23;
      --border-focus: #fafafa;
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      
      --btn-primary-bg: #fafafa;
      --btn-primary-text: #09090b;
      --btn-primary-hover: #e4e4e7;
      
      --btn-secondary-bg: #18181b;
      --btn-secondary-border: #27272a;
      --btn-secondary-text: #fafafa;
      --btn-secondary-hover: #222226;
      
      --tag-bg: #18181b;
      --tag-border: #27272a;
      --tag-text: #fafafa;
      
      --badge-green-bg: rgba(5, 150, 105, 0.15);
      --badge-green-text: #34d399;
      --badge-green-border: rgba(52, 211, 153, 0.25);
      
      --badge-red-bg: rgba(220, 38, 38, 0.15);
      --badge-red-text: #f87171;
      --badge-red-border: rgba(248, 113, 113, 0.25);
      
      --badge-amber-bg: rgba(217, 119, 6, 0.15);
      --badge-amber-text: #fbbf24;
      --badge-amber-border: rgba(251, 191, 36, 0.25);
      
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background-color: var(--bg-page);
      color: var(--text-primary);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: background-color 0.2s ease, color 0.2s ease;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Navigation Bar */
    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    
    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .brand-icon {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.95rem;
    }
    
    .brand-title {
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    /* Minimal Segmented Switcher */
    .segmented-control {
      display: inline-flex;
      background: var(--bg-hover);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 2px;
      gap: 2px;
    }
    .segment-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.25rem 0.55rem;
      font-size: 0.78rem;
      font-weight: 500;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .segment-btn.active {
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
      font-weight: 600;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.42rem 0.85rem;
      font-size: 0.83rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      text-decoration: none;
      font-family: inherit;
    }
    .btn-primary {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
    }
    .btn-primary:hover {
      background: var(--btn-primary-hover);
    }
    .btn-secondary {
      background: var(--btn-secondary-bg);
      border-color: var(--btn-secondary-border);
      color: var(--btn-secondary-text);
    }
    .btn-secondary:hover {
      background: var(--btn-secondary-hover);
    }
    .btn-danger {
      background: var(--badge-red-bg);
      border-color: var(--badge-red-border);
      color: var(--badge-red-text);
    }
    .btn-danger:hover {
      filter: brightness(0.95);
    }
    .btn-sm {
      padding: 0.28rem 0.6rem;
      font-size: 0.78rem;
    }

    /* Status Pill */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.6rem;
      background: var(--badge-green-bg);
      border: 1px solid var(--badge-green-border);
      color: var(--badge-green-text);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    /* Horizontal Sub-Navbar */
    .subnav-wrapper {
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
    }
    .subnav {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .subnav::-webkit-scrollbar { display: none; }
    
    .nav-tab {
      padding: 0.65rem 0.95rem;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      white-space: nowrap;
      user-select: none;
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .nav-tab:hover {
      color: var(--text-primary);
    }
    .nav-tab.active {
      color: var(--text-primary);
      border-bottom-color: var(--text-primary);
      font-weight: 600;
    }

    /* Page Content */
    .app-main {
      flex: 1;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .tab-pane {
      display: none;
    }
    .tab-pane.active {
      display: block;
      animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Section Header */
    .section-header {
      margin-bottom: 1.25rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }
    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }
    .section-desc {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 0.2rem;
    }

    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.15rem 1.25rem;
      margin-bottom: 1.1rem;
      box-shadow: var(--shadow-sm);
    }
    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.35rem;
    }
    .card-title {
      font-size: 0.98rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .card-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }

    /* Metrics Grid */
    .grid-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.85rem;
      margin-bottom: 1.25rem;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.15rem;
      box-shadow: var(--shadow-sm);
    }
    .metric-label {
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .metric-value {
      font-size: 1.45rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0.25rem 0;
      letter-spacing: -0.02em;
    }
    .metric-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Form Fields */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .form-label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .form-control {
      background: var(--bg-input);
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      width: 100%;
      font-family: inherit;
    }
    .form-control:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 1px var(--border-focus);
    }
    select.form-control {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.65rem center;
      background-size: 0.9rem;
      padding-right: 2rem;
    }
    textarea.form-control {
      resize: vertical;
      min-height: 80px;
    }

    /* Engine Cards */
    .engine-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.85rem;
      margin-bottom: 1.25rem;
    }
    .engine-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: var(--shadow-sm);
    }
    .engine-card:hover {
      border-color: var(--text-secondary);
    }
    .engine-card.selected {
      border-color: var(--text-primary);
      background: var(--bg-card-subtle);
      box-shadow: 0 0 0 1px var(--text-primary);
    }
    .engine-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }
    .engine-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .engine-tag {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      background: var(--tag-bg);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      font-weight: 500;
    }
    .engine-desc {
      font-size: 0.78rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* Bot Cards */
    .bot-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.15rem;
      margin-bottom: 0.85rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .bot-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .bot-identity {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .channel-badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .channel-tg {
      background: rgba(0, 136, 204, 0.1);
      color: #0088cc;
      border: 1px solid rgba(0, 136, 204, 0.3);
    }
    .channel-dc {
      background: rgba(88, 101, 242, 0.1);
      color: #5865F2;
      border: 1px solid rgba(88, 101, 242, 0.3);
    }
    .bot-name {
      font-size: 0.98rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .bot-subtitle {
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    /* Tags Input */
    .tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      background: var(--bg-input);
      border: 1px solid var(--border);
      padding: 0.35rem;
      border-radius: 6px;
      min-height: 38px;
      align-items: center;
    }
    .tag {
      background: var(--tag-bg);
      border: 1px solid var(--tag-border);
      color: var(--tag-text);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: var(--font-mono);
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .tag-remove {
      cursor: pointer;
      color: var(--text-muted);
      font-weight: bold;
    }
    .tag-remove:hover { color: var(--badge-red-text); }
    .tag-input {
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-size: 0.8rem;
      padding: 0.2rem 0.35rem;
      outline: none;
      flex: 1;
      min-width: 90px;
    }

    /* Skills Grid */
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 0.85rem;
    }
    .skill-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.1rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .skill-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .skill-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
      font-family: var(--font-mono);
    }
    .skill-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sync-tags {
      display: flex;
      gap: 0.35rem;
    }
    .sync-tag {
      font-size: 0.7rem;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-weight: 500;
    }
    .sync-on {
      background: var(--badge-green-bg);
      color: var(--badge-green-text);
      border: 1px solid var(--badge-green-border);
    }
    .sync-off {
      background: var(--badge-red-bg);
      color: var(--badge-red-text);
      border: 1px solid var(--badge-red-border);
    }

    /* Raw YAML */
    .yaml-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .yaml-bar {
      background: var(--bg-card-subtle);
      border-bottom: 1px solid var(--border);
      padding: 0.5rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .yaml-editor {
      background: var(--bg-input);
      border: none;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 0.85rem;
      line-height: 1.55;
      padding: 0.9rem;
      width: 100%;
      height: 520px;
      outline: none;
      resize: vertical;
      tab-size: 2;
    }

    /* Modal Dialogs */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(2px);
      z-index: 90;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-backdrop.show { display: flex; }
    .modal {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      width: 100%;
      max-width: 540px;
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }
    .modal-lg { max-width: 720px; }
    .modal-header {
      padding: 0.95rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-title { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
    }
    .modal-close:hover { color: var(--text-primary); }
    .modal-body {
      padding: 1.25rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .modal-footer {
      padding: 0.85rem 1.25rem;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.6rem;
    }

    /* Toast Container */
    .toast-container {
      position: fixed;
      bottom: 1.25rem;
      right: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 100;
      max-width: 400px;
    }
    .toast {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.8rem 1rem;
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .toast-success { border-left: 3px solid var(--badge-green-text); }
    .toast-error { border-left: 3px solid var(--badge-red-text); }
    .toast-title { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); }
    .toast-msg { font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4; }
  </style>
</head>
<body>

  <!-- Top Navbar -->
  <header>
    <div class="header-inner">
      <div class="brand">
        <div class="brand-icon">PA</div>
        <div>
          <div class="brand-title" data-i18n="dashboardTitle">PocketAgent Dashboard</div>
        </div>
      </div>

      <div class="header-controls">
        <div id="statusBadge" class="status-pill">
          <span class="status-dot"></span>
          <span id="statusText" data-i18n="statusOnline">Online</span>
        </div>

        <!-- Language Switcher -->
        <div class="segmented-control">
          <button id="langZh" class="segment-btn" onclick="setLanguage('zh')">中文</button>
          <button id="langEn" class="segment-btn" onclick="setLanguage('en')">EN</button>
        </div>

        <!-- Theme Switcher -->
        <div class="segmented-control">
          <button id="themeLight" class="segment-btn" onclick="setTheme('light')">☀️</button>
          <button id="themeDark" class="segment-btn" onclick="setTheme('dark')">🌙</button>
        </div>

        <button id="btnRefresh" class="btn btn-secondary btn-sm" title="Reload from server" data-i18n="refresh">
          ↻ Refresh
        </button>
        <button id="btnSaveConfig" class="btn btn-primary btn-sm" title="Save & Hot Reload (Cmd+S)" data-i18n="saveAndHotReload">
          ⚡ Save & Hot Reload
        </button>
      </div>
    </div>
  </header>

  <!-- Horizontal Sub-Navbar Tabs -->
  <div class="subnav-wrapper">
    <nav class="subnav">
      <div class="nav-tab active" data-tab="overview" data-i18n="tabOverview">Overview</div>
      <div class="nav-tab" data-tab="bots" data-i18n="tabBots">Bots</div>
      <div class="nav-tab" data-tab="engines" data-i18n="tabEngines">Engines</div>
      <div class="nav-tab" data-tab="gateway" data-i18n="tabGateway">Gateway</div>
      <div class="nav-tab" data-tab="security" data-i18n="tabSecurity">Security & Auth</div>
      <div class="nav-tab" data-tab="skills" data-i18n="tabSkills">Skills (3-CLI)</div>
      <div class="nav-tab" data-tab="yaml" data-i18n="tabYaml">Raw YAML</div>
    </nav>
  </div>

  <!-- Main Container -->
  <main class="app-main">

    <!-- TAB: Overview -->
    <section id="tab-overview" class="tab-pane active">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="overviewTitle">System Overview</h1>
          <p class="section-desc" data-i18n="overviewDesc">Real-time metrics and operational health of PocketAgent Gateway</p>
        </div>
      </div>

      <div class="grid-metrics">
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricGatewayStatus">Gateway Status</div>
          <div id="mGatewayStatus" class="metric-value" style="color: var(--badge-green-text);">Online</div>
          <div id="mGatewayPort" class="metric-sub">Port: --</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricActiveBots">Active Bots</div>
          <div id="mBotsCount" class="metric-value">0</div>
          <div id="mBotsDetail" class="metric-sub">--</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricDefaultEngine">Default Engine</div>
          <div id="mDefaultEngine" class="metric-value" style="text-transform: uppercase;">--</div>
          <div class="metric-sub">Claude • Codex • AGY</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricSkillsCount">3-CLI Skills</div>
          <div id="mSkillsCount" class="metric-value">0</div>
          <div class="metric-sub">Unified Hub (~/.pocketagent/skills)</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header-row">
          <div class="card-title" data-i18n="configuredBots">Configured Bots</div>
          <button class="btn btn-secondary btn-sm" onclick="switchTab('bots')" data-i18n="manageBots">Manage Bots →</button>
        </div>
        <div class="card-desc" data-i18n="botsDesc">Active chat platform bridges connected to PocketAgent</div>
        <div id="overviewBotsList" style="display: flex; flex-direction: column; gap: 0.65rem;">
          <div style="color: var(--text-muted); font-size: 0.85rem;">Loading bots...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header-row">
          <div class="card-title" data-i18n="engineDiscovery">Engine Discovery & Models</div>
          <button class="btn btn-secondary btn-sm" onclick="fetchModels(true)" data-i18n="scanModels">Scan Models</button>
        </div>
        <div class="card-desc">Dynamically detected CLI binaries and available models on this machine</div>
        <div id="overviewEnginesGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem;">
          <!-- Dynamically filled -->
        </div>
      </div>
    </section>

    <!-- TAB: Bots -->
    <section id="tab-bots" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="botsTitle">Bots Management</h1>
          <p class="section-desc" data-i18n="botsDesc">Configure Telegram and Discord bot bridges, tokens, engines, and access policies</p>
        </div>
        <button id="btnAddBot" class="btn btn-primary btn-sm" data-i18n="addBot">+ Add Bot</button>
      </div>

      <div id="botsContainer">
        <!-- Dynamically filled -->
      </div>
    </section>

    <!-- TAB: Engines -->
    <section id="tab-engines" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="enginesTitle">Engines Configuration</h1>
          <p class="section-desc" data-i18n="enginesDesc">Configure Claude Code, OpenAI Codex, and Google Antigravity (AGY) backends</p>
        </div>
      </div>

      <!-- Default Engine Selection -->
      <div class="card">
        <div class="card-title" data-i18n="defaultEngineCard">Default Execution Engine</div>
        <div class="card-desc" data-i18n="defaultEngineCardDesc">Engine used for all sessions unless overridden by a bot or /engine command</div>
        <div class="engine-cards">
          <div class="engine-card" data-engine="claude" onclick="selectDefaultEngine('claude')">
            <div class="engine-card-top">
              <span class="engine-title">Claude Code</span>
              <span class="engine-tag">Anthropic</span>
            </div>
            <p class="engine-desc">Official Claude CLI with CLAUDE.md workspace injection and tools</p>
          </div>
          <div class="engine-card" data-engine="codex" onclick="selectDefaultEngine('codex')">
            <div class="engine-card-top">
              <span class="engine-title">OpenAI Codex</span>
              <span class="engine-tag">OpenAI</span>
            </div>
            <p class="engine-desc">Codex CLI with AGENTS.md, sandboxing, and autonomous tool calling</p>
          </div>
          <div class="engine-card" data-engine="agy" onclick="selectDefaultEngine('agy')">
            <div class="engine-card-top">
              <span class="engine-title">Google Antigravity</span>
              <span class="engine-tag">DeepMind</span>
            </div>
            <p class="engine-desc">AGY CLI with native skills, subagents, and Gemini reasoning models</p>
          </div>
        </div>
      </div>

      <!-- Concurrency & Timeouts -->
      <div class="card">
        <div class="card-title" data-i18n="concurrencySettings">Concurrency & Timeouts</div>
        <div class="card-desc" data-i18n="concurrencyDesc">Process limits and idle lifecycle across all engine adapters</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" data-i18n="maxProcesses">Max Concurrent Processes</label>
            <input id="cfgMaxProcesses" type="number" class="form-control" min="1" max="50" value="10">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="idleTimeoutMs">Idle Process Timeout (ms)</label>
            <input id="cfgIdleTimeout" type="number" class="form-control" min="60000" step="10000" value="600000">
          </div>
        </div>
      </div>

      <!-- Claude Settings -->
      <div class="card">
        <div class="card-title" data-i18n="claudeEngine">Claude Code Engine</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" data-i18n="binaryCommand">Binary Command</label>
            <input id="cfgClaudeBinary" type="text" class="form-control" value="claude">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="defaultModel">Default Model</label>
            <select id="cfgClaudeModel" class="form-control"></select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="effortLevel">Effort Level</label>
            <select id="cfgClaudeEffort" class="form-control">
              <option value="">Default</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="extraArgs">Extra Args</label>
            <input id="cfgClaudeExtraArgs" type="text" class="form-control" placeholder="--dangerously-skip-permissions">
          </div>
        </div>
      </div>

      <!-- Codex Settings -->
      <div class="card">
        <div class="card-title" data-i18n="codexEngine">OpenAI Codex Engine</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" data-i18n="binaryCommand">Binary Command</label>
            <input id="cfgCodexBinary" type="text" class="form-control" value="codex">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="defaultModel">Default Model</label>
            <select id="cfgCodexModel" class="form-control"></select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="sandboxMode">Sandbox Mode</label>
            <select id="cfgCodexSandbox" class="form-control">
              <option value="danger-full-access">danger-full-access (Unrestricted)</option>
              <option value="workspace-write">workspace-write (Workspace Only)</option>
              <option value="read-only">read-only (Read Only)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="approvalPolicy">Approval Policy</label>
            <select id="cfgCodexApproval" class="form-control">
              <option value="never">never (Auto-approve)</option>
              <option value="on-request">on-request (Interactive)</option>
              <option value="untrusted">untrusted (Prompt always)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- AGY Settings -->
      <div class="card">
        <div class="card-title" data-i18n="agyEngine">Google Antigravity (AGY) Engine</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" data-i18n="binaryCommand">Binary Command</label>
            <input id="cfgAgyBinary" type="text" class="form-control" value="agy">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="defaultModel">Default Model</label>
            <select id="cfgAgyModel" class="form-control"></select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="effortLevel">Effort Level</label>
            <select id="cfgAgyEffort" class="form-control">
              <option value="">Default</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="extraArgs">Extra Args</label>
            <input id="cfgAgyExtraArgs" type="text" class="form-control" placeholder="--resume">
          </div>
        </div>
      </div>
    </section>

    <!-- TAB: Gateway -->
    <section id="tab-gateway" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="gatewayTitle">Gateway & Network</h1>
          <p class="section-desc" data-i18n="gatewayDesc">Host listening port, log levels, formatting, and file storage directories</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title" data-i18n="gatewayTitle">Server Settings</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" data-i18n="apiPort">API / Dashboard Port</label>
            <input id="cfgPort" type="number" class="form-control" min="1024" max="65535" value="18790">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="dataDir">Data Directory</label>
            <input id="cfgDataDir" type="text" class="form-control" value="~/.pocketagent">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="logLevel">Log Level</label>
            <select id="cfgLogLevel" class="form-control">
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="logFormat">Log Format</label>
            <select id="cfgLogFormat" class="form-control">
              <option value="pretty">pretty</option>
              <option value="json">json</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB: Security -->
    <section id="tab-security" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="securityTitle">Security & Pairing</h1>
          <p class="section-desc" data-i18n="securityDesc">Authentication policies and one-click approval for pending device pairings</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title" data-i18n="globalAuthPolicy">Global Default Policy</div>
        <div class="card-desc" data-i18n="globalAuthDesc">Applied to bots without explicit policy overrides</div>
        <div class="form-group" style="max-width: 320px;">
          <select id="cfgDefaultAuthPolicy" class="form-control">
            <option value="pairing">pairing</option>
            <option value="allowlist">allowlist</option>
            <option value="open">open</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-title" data-i18n="pendingPairings">Pending Pairing Requests</div>
        <div class="card-desc" data-i18n="pendingPairingsDesc">Users or groups attempting to authenticate via pairing code</div>
        <div id="pendingPairingsContainer" style="display: flex; flex-direction: column; gap: 0.65rem;">
          <div style="color: var(--text-muted); font-size: 0.85rem;" data-i18n="noPendingPairings">No pending pairing requests.</div>
        </div>
      </div>
    </section>

    <!-- TAB: Skills -->
    <section id="tab-skills" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="skillsTitle">Skills (3-CLI Mesh)</h1>
          <p class="section-desc" data-i18n="skillsDesc">Unified hub at ~/.pocketagent/skills/ mirrored to Claude Code, Codex, and AGY</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnSyncSkills" class="btn btn-secondary btn-sm" data-i18n="syncSkills">↻ Sync All Skills</button>
          <button id="btnNewSkill" class="btn btn-primary btn-sm" data-i18n="newSkill">+ New Skill</button>
        </div>
      </div>

      <div id="skillsGrid" class="skills-grid">
        <!-- Dynamically filled -->
      </div>
    </section>

    <!-- TAB: Raw YAML -->
    <section id="tab-yaml" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="rawYamlTitle">Raw YAML Editor</h1>
          <p class="section-desc" data-i18n="rawYamlDesc">Directly view and edit config.yaml with live schema validation</p>
        </div>
        <button id="btnApplyYaml" class="btn btn-primary btn-sm" data-i18n="applyYaml">Apply & Hot Reload</button>
      </div>

      <div class="yaml-box">
        <div class="yaml-bar">
          <span id="yamlValidationStatus" style="font-size: 0.8rem; color: var(--badge-green-text);" data-i18n="yamlReady">✓ Schema Valid</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Syncs with visual forms</span>
        </div>
        <textarea id="rawYamlEditor" class="yaml-editor" spellcheck="false"></textarea>
      </div>
    </section>

  </main>

  <!-- Toast Notifications -->
  <div id="toastContainer" class="toast-container"></div>

  <!-- Modal: Add / Edit Bot -->
  <div id="modalBot" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" data-i18n="modalAddBotTitle">Add New Bot</div>
        <button class="modal-close" onclick="closeModal('modalBot')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" data-i18n="modalBotName">Bot Name</label>
          <input id="botModalName" type="text" class="form-control" placeholder="my-bot">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="modalChannel">Channel</label>
          <select id="botModalChannel" class="form-control">
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="modalToken">Bot Token</label>
          <input id="botModalToken" type="password" class="form-control" placeholder="Bot Token">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="engineOverride">Engine Override</label>
          <select id="botModalEngine" class="form-control">
            <option value="" data-i18n="inheritDefault">Inherit Global Default</option>
            <option value="claude">Claude Code</option>
            <option value="codex">OpenAI Codex</option>
            <option value="agy">Google Antigravity (AGY)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="dmPolicy">DM Policy</label>
          <select id="botModalDmPolicy" class="form-control">
            <option value="pairing">pairing</option>
            <option value="allowlist">allowlist</option>
            <option value="open">open</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="groupPolicy">Group Policy</label>
          <select id="botModalGroupPolicy" class="form-control">
            <option value="pairing">pairing</option>
            <option value="allowlist">allowlist</option>
            <option value="open">open</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalBot')" data-i18n="modalCancel">Cancel</button>
        <button id="btnSaveModalBot" class="btn btn-primary" data-i18n="modalConfirm">Add Bot</button>
      </div>
    </div>
  </div>

  <!-- Modal: SOUL Editor -->
  <div id="modalSoul" class="modal-backdrop">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="soulModalTitle" data-i18n="modalSoulTitle">Edit Persona (SOUL.md)</div>
        <button class="modal-close" onclick="closeModal('modalSoul')">×</button>
      </div>
      <div class="modal-body">
        <p class="card-desc" style="margin-bottom: 0.5rem;" data-i18n="modalSoulDesc">Defines the bot's core personality, guidelines, and behavioral traits.</p>
        <textarea id="soulEditorText" class="form-control" style="height: 340px; font-family: var(--font-mono); font-size: 0.85rem;"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalSoul')" data-i18n="modalCancel">Cancel</button>
        <button id="btnSaveSoul" class="btn btn-primary" data-i18n="modalSoulSave">Save SOUL.md</button>
      </div>
    </div>
  </div>

  <!-- Modal: New Skill -->
  <div id="modalNewSkill" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" data-i18n="modalNewSkillTitle">Create New Skill</div>
        <button class="modal-close" onclick="closeModal('modalNewSkill')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" data-i18n="modalSkillName">Skill Name</label>
          <input id="newSkillName" type="text" class="form-control" placeholder="e.g. stock-analyzer">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="modalSkillDesc">Description</label>
          <textarea id="newSkillDesc" class="form-control" placeholder="What does this skill do and when should the engine call it?"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalNewSkill')" data-i18n="modalCancel">Cancel</button>
        <button id="btnCreateSkillConfirm" class="btn btn-primary" data-i18n="modalSkillCreate">Create & Sync</button>
      </div>
    </div>
  </div>

  <script>
    // Bilingual Dictionary
    const I18N = {
      zh: {
        dashboardTitle: "PocketAgent 网关控制台",
        statusOnline: "运行中",
        statusOffline: "离线 / 异常",
        refresh: "↻ 刷新",
        saveAndHotReload: "⚡ 保存并热更新",
        saving: "正在保存...",
        tabOverview: "系统概览",
        tabBots: "机器人管理",
        tabEngines: "模型引擎",
        tabGateway: "网关设置",
        tabSecurity: "安全与配对",
        tabSkills: "技能中心",
        tabYaml: "YAML 源码",
        
        overviewTitle: "系统概览",
        overviewDesc: "PocketAgent 网关与多平台桥接器的实时运行状态",
        metricGatewayStatus: "网关状态",
        metricActiveBots: "已接入机器人",
        metricDefaultEngine: "全局默认引擎",
        metricSkillsCount: "3-CLI 共享技能",
        configuredBots: "已配置的机器人",
        manageBots: "管理机器人 →",
        engineDiscovery: "引擎与可用模型",
        scanModels: "重新扫描模型",
        
        botsTitle: "机器人管理",
        botsDesc: "管理 Telegram 与 Discord 机器人桥接实例、Token 凭据、引擎分流与用户权限",
        addBot: "+ 添加机器人",
        noBotsConfigured: "暂无配置的机器人",
        noBotsDesc: "请添加首个 Telegram 或 Discord 机器人以开启桥接服务。",
        botToken: "Bot 访问密钥 (Token)",
        engineOverride: "引擎独立覆盖",
        inheritDefault: "继承全局默认",
        dmPolicy: "私聊策略 (DM Policy)",
        groupPolicy: "群聊策略 (Group Policy)",
        allowedUsers: "授权用户白名单 (allowFrom)",
        allowedGroups: "授权群组 ID (groups)",
        addUserPlaceholder: "+ 输入用户 ID 并按回车",
        addGroupPlaceholder: "+ 输入群组 ID 并按回车",
        editSoul: "✎ SOUL.md",
        deleteBot: "删除",
        confirmDeleteBot: "确认删除机器人 \\"{name}\\" 吗？",
        botAddedToast: "已添加机器人 \\"{name}\\"，点击「保存并热更新」生效。",
        botDeletedToast: "已移除机器人，点击「保存并热更新」生效。",

        enginesTitle: "模型引擎设置",
        enginesDesc: "配置 Claude Code、OpenAI Codex 与 Google Antigravity (AGY) 执行引擎",
        defaultEngineCard: "全局默认执行引擎",
        defaultEngineCardDesc: "所有未单独指定引擎的机器人会话将默认使用此引擎处理任务",
        concurrencySettings: "并发与超时控制",
        concurrencyDesc: "控制 CLI 引擎的最大进程数与空闲释放时间",
        maxProcesses: "最大并发进程数",
        idleTimeoutMs: "进程空闲超时 (毫秒)",
        claudeEngine: "Claude Code 引擎 (Anthropic)",
        codexEngine: "OpenAI Codex 引擎 (OpenAI)",
        agyEngine: "Google Antigravity 引擎 (DeepMind)",
        binaryCommand: "命令行二进制 (Binary)",
        defaultModel: "默认模型",
        effortLevel: "思考深度 (Effort)",
        extraArgs: "附加 CLI 启动参数 (逗号分隔)",
        sandboxMode: "沙箱权限等级",
        approvalPolicy: "执行审批模式",
        
        gatewayTitle: "网关与服务配置",
        gatewayDesc: "服务监听端口、数据持久化存储目录与日志格式",
        apiPort: "服务监听端口 (Port)",
        dataDir: "数据目录 (dataDir)",
        logLevel: "日志级别 (logLevel)",
        logFormat: "日志输出格式 (logFormat)",
        
        securityTitle: "安全与配对审批",
        securityDesc: "全局身份认证策略与免命令行一键批准用户配对申请",
        globalAuthPolicy: "全局认证默认策略",
        globalAuthDesc: "当机器人未显式配置私聊或群聊策略时默认生效",
        pendingPairings: "待审批配对申请",
        pendingPairingsDesc: "用户或群组在发起配对时生成的待确认校验码",
        noPendingPairings: "当前没有待处理的配对申请。",
        approve: "✓ 批准",
        pairingApprovedToast: "已批准用户 {id} 的配对申请 (Bot: {bot})",
        
        skillsTitle: "3-CLI 技能中心",
        skillsDesc: "统一技能库 (~/.pocketagent/skills/) 已物理软链至 Claude、Codex 与 AGY 客户端",
        syncSkills: "↻ 全网同步技能",
        newSkill: "+ 新建技能",
        noSkillsFound: "未检测到自定义技能，点击上方「新建技能」快速创建。",
        
        rawYamlTitle: "YAML 源码编辑器",
        rawYamlDesc: "直接查看与编辑 config.yaml 完整内容，包含实时规则校验",
        applyYaml: "应用并热更新",
        yamlReady: "✓ 规则校验通过",
        yamlError: "✗ 格式或语法错误",
        
        modalAddBotTitle: "添加新机器人",
        modalBotName: "机器人标识名 (例如 atri-bot)",
        modalChannel: "所属通讯平台",
        modalToken: "Bot Token",
        modalCancel: "取消",
        modalConfirm: "添加机器人",
        modalSoulTitle: "编辑机器人设定 (SOUL.md)",
        modalSoulDesc: "定义该机器人的性格、行为基准与角色认知，在会话初始化时注入系统提示词。",
        modalSoulSave: "保存 SOUL.md",
        modalNewSkillTitle: "创建新技能",
        modalSkillName: "技能英文标识 (如 web-search)",
        modalSkillDesc: "技能功能说明与调用场景描述",
        modalSkillCreate: "创建并同步",
        
        hotReloadSuccess: "✓ 热更新成功生效",
        hotReloadFailed: "热更新失败",
      },
      en: {
        dashboardTitle: "PocketAgent Dashboard",
        statusOnline: "Online",
        statusOffline: "Offline / Error",
        refresh: "↻ Refresh",
        saveAndHotReload: "⚡ Save & Hot Reload",
        saving: "Saving...",
        tabOverview: "Overview",
        tabBots: "Bots",
        tabEngines: "Engines",
        tabGateway: "Gateway",
        tabSecurity: "Security & Auth",
        tabSkills: "Skills (3-CLI)",
        tabYaml: "Raw YAML",
        
        overviewTitle: "System Overview",
        overviewDesc: "Real-time metrics and operational health of PocketAgent Gateway",
        metricGatewayStatus: "Gateway Status",
        metricActiveBots: "Active Bots",
        metricDefaultEngine: "Default Engine",
        metricSkillsCount: "3-CLI Skills",
        configuredBots: "Configured Bots",
        manageBots: "Manage Bots →",
        engineDiscovery: "Engine Discovery & Models",
        scanModels: "Scan Models",
        
        botsTitle: "Bots Management",
        botsDesc: "Configure Telegram and Discord bot bridges, tokens, engines, and access policies",
        addBot: "+ Add Bot",
        noBotsConfigured: "No Bots Configured",
        noBotsDesc: "Add your first Telegram or Discord bot to get started.",
        botToken: "Bot Token",
        engineOverride: "Engine Override",
        inheritDefault: "Inherit Global Default",
        dmPolicy: "DM Policy",
        groupPolicy: "Group Policy",
        allowedUsers: "Allowed User IDs (allowFrom)",
        allowedGroups: "Allowed Group IDs (groups)",
        addUserPlaceholder: "+ Type user ID and press Enter",
        addGroupPlaceholder: "+ Type group ID and press Enter",
        editSoul: "✎ SOUL.md",
        deleteBot: "Delete",
        confirmDeleteBot: "Delete bot \\"{name}\\"?",
        botAddedToast: "Added bot \\"{name}\\", click 'Save & Hot Reload' to apply.",
        botDeletedToast: "Bot removed, click 'Save & Hot Reload' to apply.",

        enginesTitle: "Engines Configuration",
        enginesDesc: "Configure Claude Code, OpenAI Codex, and Google Antigravity (AGY) backends",
        defaultEngineCard: "Default Execution Engine",
        defaultEngineCardDesc: "Engine used for all sessions unless overridden by a bot or /engine command",
        concurrencySettings: "Concurrency & Timeouts",
        concurrencyDesc: "Process limits and idle lifecycle across all engine adapters",
        maxProcesses: "Max Concurrent Processes",
        idleTimeoutMs: "Idle Process Timeout (ms)",
        claudeEngine: "Claude Code Engine",
        codexEngine: "OpenAI Codex Engine",
        agyEngine: "Google Antigravity (AGY) Engine",
        binaryCommand: "Binary Command",
        defaultModel: "Default Model",
        effortLevel: "Effort Level",
        extraArgs: "Extra Args",
        sandboxMode: "Sandbox Mode",
        approvalPolicy: "Approval Policy",
        
        gatewayTitle: "Gateway & Network",
        gatewayDesc: "Host listening port, log levels, formatting, and file storage directories",
        apiPort: "API / Dashboard Port",
        dataDir: "Data Directory",
        logLevel: "Log Level",
        logFormat: "Log Format",
        
        securityTitle: "Security & Pairing",
        securityDesc: "Authentication policies and one-click approval for pending device pairings",
        globalAuthPolicy: "Global Default Policy",
        globalAuthDesc: "Applied to bots without explicit policy overrides",
        pendingPairings: "Pending Pairing Requests",
        pendingPairingsDesc: "Users or groups attempting to authenticate via pairing code",
        noPendingPairings: "No pending pairing requests.",
        approve: "✓ Approve",
        pairingApprovedToast: "Approved pairing for user {id} (bot: {bot})",
        
        skillsTitle: "Skills (3-CLI Mesh)",
        skillsDesc: "Unified hub at ~/.pocketagent/skills/ mirrored to Claude Code, Codex, and AGY",
        syncSkills: "↻ Sync All Skills",
        newSkill: "+ New Skill",
        noSkillsFound: "No custom skills found. Click 'New Skill' to create one.",
        
        rawYamlTitle: "Raw YAML Editor",
        rawYamlDesc: "Directly view and edit config.yaml with live schema validation",
        applyYaml: "Apply & Hot Reload",
        yamlReady: "✓ Schema Valid",
        yamlError: "✗ Syntax / Validation Error",
        
        modalAddBotTitle: "Add New Bot",
        modalBotName: "Bot Name",
        modalChannel: "Channel",
        modalToken: "Bot Token",
        modalCancel: "Cancel",
        modalConfirm: "Add Bot",
        modalSoulTitle: "Edit Persona (SOUL.md)",
        modalSoulDesc: "Defines the bot's core personality, guidelines, and behavioral traits.",
        modalSoulSave: "Save SOUL.md",
        modalNewSkillTitle: "Create New Skill",
        modalSkillName: "Skill Name",
        modalSkillDesc: "Description",
        modalSkillCreate: "Create & Sync",
        
        hotReloadSuccess: "✓ Hot Reload Successful",
        hotReloadFailed: "Hot reload failed",
      }
    };

    // State
    let currentLang = localStorage.getItem("pa_lang") || (navigator.language.startsWith("zh") ? "zh" : "en");
    let currentTheme = localStorage.getItem("pa_theme") || "light";
    let currentConfig = null;
    let currentYaml = "";
    let systemStatus = null;
    let capabilities = {};
    let activeSoulBotId = null;

    function t(key, vars = {}) {
      const dict = I18N[currentLang] || I18N.en;
      let text = dict[key] || I18N.en[key] || key;
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(\`\\\\{\${k}\\\\}\`, "g"), v);
      }
      return text;
    }

    function setLanguage(lang) {
      currentLang = lang;
      localStorage.setItem("pa_lang", lang);
      document.getElementById("langZh").classList.toggle("active", lang === "zh");
      document.getElementById("langEn").classList.toggle("active", lang === "en");
      updateDomI18n();
      if (currentConfig) {
        renderBotsManager(currentConfig.bots || []);
      }
      if (systemStatus) {
        renderOverviewBots(systemStatus.bots || []);
      }
      renderOverviewEngines();
    }

    function setTheme(theme) {
      currentTheme = theme;
      localStorage.setItem("pa_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      document.getElementById("themeLight").classList.toggle("active", theme === "light");
      document.getElementById("themeDark").classList.toggle("active", theme === "dark");
    }

    function updateDomI18n() {
      document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        el.textContent = t(key);
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        el.setAttribute("placeholder", t(key));
      });
    }

    // Tab Navigation
    function setupTabNavigation() {
      document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          switchTab(tab.dataset.tab);
        });
      });
    }

    function switchTab(tabId) {
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      const targetTab = document.querySelector(\`.nav-tab[data-tab="\${tabId}"]\`);
      const targetPane = document.getElementById(\`tab-\${tabId}\`);
      if (targetTab && targetPane) {
        targetTab.classList.add("active");
        targetPane.classList.add("active");
      }

      if (tabId === "yaml") {
        syncFormToYaml();
      }
    }

    // Keyboard shortcuts
    function setupKeyboardShortcuts() {
      window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
          e.preventDefault();
          saveAndHotReload();
        }
      });
    }

    // Initialize
    async function init() {
      setTheme(currentTheme);
      setLanguage(currentLang);
      setupTabNavigation();
      setupKeyboardShortcuts();
      setupEvents();

      await Promise.all([
        fetchStatus(),
        fetchConfig(),
        fetchModels(),
        fetchSkills(),
        fetchPairings()
      ]);
    }

    function setupEvents() {
      document.getElementById("btnRefresh").addEventListener("click", async () => {
        showToast(t("refresh") + "...", "info");
        await Promise.all([fetchStatus(), fetchConfig(), fetchModels(true), fetchSkills(), fetchPairings()]);
      });

      document.getElementById("btnSaveConfig").addEventListener("click", () => saveAndHotReload());
      document.getElementById("btnApplyYaml").addEventListener("click", () => applyYaml());
      document.getElementById("btnAddBot").addEventListener("click", () => openAddBotModal());
      document.getElementById("btnSaveModalBot").addEventListener("click", () => saveModalBot());
      document.getElementById("btnSaveSoul").addEventListener("click", () => saveSoul());
      document.getElementById("btnSyncSkills").addEventListener("click", () => syncSkills());
      document.getElementById("btnNewSkill").addEventListener("click", () => openModal("modalNewSkill"));
      document.getElementById("btnCreateSkillConfirm").addEventListener("click", () => createSkill());
    }

    // Fetch Status
    async function fetchStatus() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        systemStatus = data;

        document.getElementById("statusText").textContent = t("statusOnline") + \` (PID \${data.gateway.pid})\`;
        document.getElementById("mGatewayStatus").textContent = t("statusOnline");
        document.getElementById("mGatewayPort").textContent = \`Port: \${data.gateway.port} • Uptime: \${formatUptime(data.gateway.uptime)}\`;
        document.getElementById("mBotsCount").textContent = data.bots.length;
        document.getElementById("mBotsDetail").textContent = \`\${data.bots.filter(b => b.channel === 'telegram').length} Telegram • \${data.bots.filter(b => b.channel === 'discord').length} Discord\`;
        document.getElementById("mDefaultEngine").textContent = data.defaultEngine || "claude";

        renderOverviewBots(data.bots);
      } catch (err) {
        document.getElementById("statusText").textContent = t("statusOffline");
      }
    }

    // Fetch Config
    async function fetchConfig() {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        currentConfig = data.config;
        currentYaml = data.yaml;

        document.getElementById("rawYamlEditor").value = currentYaml;
        populateVisualForm(currentConfig);
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    function populateVisualForm(cfg) {
      if (!cfg) return;

      const defEngine = cfg.defaultEngine || cfg.engine || cfg.engines?.default || "claude";
      selectDefaultEngine(defEngine, false);

      document.getElementById("cfgMaxProcesses").value = cfg.engines?.maxProcesses ?? 10;
      document.getElementById("cfgIdleTimeout").value = cfg.engines?.idleTimeoutMs ?? 600000;

      if (cfg.engines?.claude) {
        document.getElementById("cfgClaudeBinary").value = cfg.engines.claude.binary || "claude";
        document.getElementById("cfgClaudeEffort").value = cfg.engines.claude.effort || "";
        document.getElementById("cfgClaudeExtraArgs").value = (cfg.engines.claude.extraArgs || []).join(", ");
      }

      if (cfg.engines?.codex) {
        document.getElementById("cfgCodexBinary").value = cfg.engines.codex.binary || "codex";
        document.getElementById("cfgCodexSandbox").value = cfg.engines.codex.sandbox || "danger-full-access";
        document.getElementById("cfgCodexApproval").value = cfg.engines.codex.approvalPolicy || "never";
      }

      if (cfg.engines?.agy) {
        document.getElementById("cfgAgyBinary").value = cfg.engines.agy.binary || "agy";
        document.getElementById("cfgAgyEffort").value = cfg.engines.agy.effort || "";
        document.getElementById("cfgAgyExtraArgs").value = (cfg.engines.agy.extraArgs || []).join(", ");
      }

      document.getElementById("cfgPort").value = cfg.gateway?.port ?? 18790;
      document.getElementById("cfgDataDir").value = cfg.gateway?.dataDir ?? "~/.pocketagent";
      document.getElementById("cfgLogLevel").value = cfg.gateway?.logLevel ?? "info";
      document.getElementById("cfgLogFormat").value = cfg.gateway?.logFormat ?? "pretty";

      document.getElementById("cfgDefaultAuthPolicy").value = cfg.auth?.defaultPolicy ?? "pairing";

      renderBotsManager(cfg.bots || []);
    }

    function selectDefaultEngine(engine, sync = true) {
      document.querySelectorAll(".engine-card").forEach(c => {
        c.classList.toggle("selected", c.dataset.engine === engine);
      });
      if (currentConfig && sync) {
        currentConfig.defaultEngine = engine;
      }
    }

    async function fetchModels(forceRefresh = false) {
      try {
        const url = forceRefresh ? "/api/models?refresh=true" : "/api/models";
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        capabilities = data.capabilities || {};

        populateModelSelect("cfgClaudeModel", capabilities.claude?.models || [], currentConfig?.engines?.claude?.model);
        populateModelSelect("cfgCodexModel", capabilities.codex?.models || [], currentConfig?.engines?.codex?.model);
        populateModelSelect("cfgAgyModel", capabilities.agy?.models || [], currentConfig?.engines?.agy?.model);

        renderOverviewEngines();
      } catch {}
    }

    function populateModelSelect(selectId, models, currentVal) {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="">(Default / Auto-detected)</option>';
      for (const m of models) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label ? \`\${m.label} (\${m.id})\` : m.id;
        if (currentVal && currentVal === m.id) opt.selected = true;
        sel.appendChild(opt);
      }
      if (currentVal && !models.some(m => m.id === currentVal)) {
        const opt = document.createElement("option");
        opt.value = currentVal;
        opt.textContent = \`Custom: \${currentVal}\`;
        opt.selected = true;
        sel.appendChild(opt);
      }
    }

    function renderOverviewBots(bots) {
      const container = document.getElementById("overviewBotsList");
      if (!bots || bots.length === 0) {
        container.innerHTML = \`<div style="color: var(--text-muted); font-size: 0.85rem;">\${t("noBotsDesc")}</div>\`;
        return;
      }
      container.innerHTML = bots.map(b => \`
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: var(--bg-card-subtle); border-radius: 6px; border: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <span class="channel-badge \${b.channel === 'telegram' ? 'channel-tg' : 'channel-dc'}">\${b.channel === 'telegram' ? 'TG' : 'DC'}</span>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">
                \${escapeHtml(b.name)}
                \${b.username ? \`<span style="color: var(--text-secondary); font-size: 0.78rem; font-weight: 400;">(@\${escapeHtml(b.username)})</span>\` : ''}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">Engine: \${b.engine} • DM: \${b.dmPolicy} • Allow: \${(b.allowFrom || []).length}</div>
            </div>
          </div>
          <span class="status-pill" style="font-size: 0.7rem;">\${b.status}</span>
        </div>
      \`).join("");
    }

    function renderOverviewEngines() {
      const container = document.getElementById("overviewEnginesGrid");
      if (!container) return;

      const engines = [
        { id: "claude", name: "Claude Code", cap: capabilities.claude },
        { id: "codex", name: "OpenAI Codex", cap: capabilities.codex },
        { id: "agy", name: "Google Antigravity", cap: capabilities.agy },
      ];

      container.innerHTML = engines.map(e => {
        const count = e.cap?.models?.length ?? 0;
        return \`
          <div style="background: var(--bg-card-subtle); border: 1px solid var(--border); border-radius: 6px; padding: 0.85rem 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">\${e.name}</span>
              <span class="status-pill" style="font-size: 0.7rem;">\${count} models</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.45;">
              \${e.cap?.models?.slice(0, 3).map(m => m.label || m.id).join(", ") || "Auto-discovery active"}
              \${count > 3 ? \`<span style="color: var(--text-muted);">+ \${count - 3} more</span>\` : ''}
            </div>
          </div>
        \`;
      }).join("");
    }

    function renderBotsManager(bots) {
      const container = document.getElementById("botsContainer");
      if (!bots || bots.length === 0) {
        container.innerHTML = \`
          <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">\${t("noBotsConfigured")}</div>
            <p style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 0.25rem;">\${t("noBotsDesc")}</p>
            <button class="btn btn-primary btn-sm" style="margin-top: 0.85rem;" onclick="openAddBotModal()">\${t("addBot")}</button>
          </div>
        \`;
        return;
      }

      container.innerHTML = bots.map((bot, index) => {
        const tokenVal = bot.token || bot.discordToken || "";
        const allowFrom = bot.allowFrom || [];
        const groups = bot.groups || {};

        return \`
          <div class="bot-card" data-index="\${index}">
            <div class="bot-card-top">
              <div class="bot-identity">
                <span class="channel-badge \${bot.channel === 'discord' ? 'channel-dc' : 'channel-tg'}">
                  \${bot.channel === 'discord' ? 'Discord' : 'Telegram'}
                </span>
                <div>
                  <div class="bot-name">\${escapeHtml(bot.name)}</div>
                  <div class="bot-subtitle">Engine: \${bot.engine || t("inheritDefault")}</div>
                </div>
              </div>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary btn-sm" onclick="openSoulModal('\${escapeHtml(bot.name)}')">\${t("editSoul")}</button>
                <button class="btn btn-danger btn-sm" onclick="deleteBot(\${index})">\${t("deleteBot")}</button>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">\${t("botToken")}</label>
                <input type="password" class="form-control" value="\${escapeHtml(tokenVal)}" onchange="updateBotField(\${index}, 'token', this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">\${t("engineOverride")}</label>
                <select class="form-control" onchange="updateBotField(\${index}, 'engine', this.value)">
                  <option value="" \${!bot.engine ? 'selected' : ''}>\${t("inheritDefault")}</option>
                  <option value="claude" \${bot.engine === 'claude' ? 'selected' : ''}>Claude Code</option>
                  <option value="codex" \${bot.engine === 'codex' ? 'selected' : ''}>OpenAI Codex</option>
                  <option value="agy" \${bot.engine === 'agy' ? 'selected' : ''}>Google Antigravity</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">\${t("dmPolicy")}</label>
                <select class="form-control" onchange="updateBotField(\${index}, 'dmPolicy', this.value)">
                  <option value="pairing" \${bot.dmPolicy === 'pairing' ? 'selected' : ''}>pairing</option>
                  <option value="allowlist" \${bot.dmPolicy === 'allowlist' ? 'selected' : ''}>allowlist</option>
                  <option value="open" \${bot.dmPolicy === 'open' ? 'selected' : ''}>open</option>
                  <option value="disabled" \${bot.dmPolicy === 'disabled' ? 'selected' : ''}>disabled</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">\${t("groupPolicy")}</label>
                <select class="form-control" onchange="updateBotField(\${index}, 'groupPolicy', this.value)">
                  <option value="pairing" \${bot.groupPolicy === 'pairing' ? 'selected' : ''}>pairing</option>
                  <option value="allowlist" \${bot.groupPolicy === 'allowlist' ? 'selected' : ''}>allowlist</option>
                  <option value="open" \${bot.groupPolicy === 'open' ? 'selected' : ''}>open</option>
                  <option value="disabled" \${bot.groupPolicy === 'disabled' ? 'selected' : ''}>disabled</option>
                </select>
              </div>
            </div>

            <!-- Allowed Users -->
            <div class="form-group">
              <label class="form-label">\${t("allowedUsers")}</label>
              <div class="tag-container" id="tags-allow-\${index}">
                \${allowFrom.map(id => \`
                  <span class="tag">\${escapeHtml(String(id))} <span class="tag-remove" onclick="removeAllowTag(\${index}, '\${escapeHtml(String(id))}')">×</span></span>
                \`).join("")}
                <input type="text" class="tag-input" placeholder="\${t("addUserPlaceholder")}" onkeydown="handleTagInput(event, \${index})">
              </div>
            </div>

            <!-- Allowed Groups -->
            <div class="form-group">
              <label class="form-label">\${t("allowedGroups")}</label>
              <div class="tag-container" id="tags-groups-\${index}">
                \${Object.keys(groups).map(gid => \`
                  <span class="tag">\${escapeHtml(String(gid))} <span class="tag-remove" onclick="removeGroupTag(\${index}, '\${escapeHtml(String(gid))}')">×</span></span>
                \`).join("")}
                <input type="text" class="tag-input" placeholder="\${t("addGroupPlaceholder")}" onkeydown="handleGroupInput(event, \${index})">
              </div>
            </div>
          </div>
        \`;
      }).join("");
    }

    function handleTagInput(event, botIndex) {
      if (event.key === "Enter" && event.target.value.trim()) {
        event.preventDefault();
        const val = event.target.value.trim();
        if (!currentConfig.bots[botIndex].allowFrom) currentConfig.bots[botIndex].allowFrom = [];
        if (!currentConfig.bots[botIndex].allowFrom.includes(val)) {
          currentConfig.bots[botIndex].allowFrom.push(val);
          renderBotsManager(currentConfig.bots);
        }
      }
    }

    function removeAllowTag(botIndex, val) {
      if (!currentConfig.bots[botIndex].allowFrom) return;
      currentConfig.bots[botIndex].allowFrom = currentConfig.bots[botIndex].allowFrom.filter(id => String(id) !== String(val));
      renderBotsManager(currentConfig.bots);
    }

    function handleGroupInput(event, botIndex) {
      if (event.key === "Enter" && event.target.value.trim()) {
        event.preventDefault();
        const val = event.target.value.trim();
        if (!currentConfig.bots[botIndex].groups) currentConfig.bots[botIndex].groups = {};
        currentConfig.bots[botIndex].groups[val] = true;
        renderBotsManager(currentConfig.bots);
      }
    }

    function removeGroupTag(botIndex, val) {
      if (!currentConfig.bots[botIndex].groups) return;
      delete currentConfig.bots[botIndex].groups[val];
      renderBotsManager(currentConfig.bots);
    }

    function updateBotField(botIndex, field, value) {
      if (!currentConfig.bots[botIndex]) return;
      if (!value) {
        delete currentConfig.bots[botIndex][field];
      } else {
        currentConfig.bots[botIndex][field] = value;
      }
    }

    function deleteBot(index) {
      const name = currentConfig.bots[index].name;
      if (confirm(t("confirmDeleteBot", { name }))) {
        currentConfig.bots.splice(index, 1);
        renderBotsManager(currentConfig.bots);
        showToast(t("botDeletedToast"), "info");
      }
    }

    function openAddBotModal() {
      document.getElementById("botModalName").value = "";
      document.getElementById("botModalToken").value = "";
      openModal("modalBot");
    }

    function saveModalBot() {
      const name = document.getElementById("botModalName").value.trim();
      const channel = document.getElementById("botModalChannel").value;
      const token = document.getElementById("botModalToken").value.trim();
      const engine = document.getElementById("botModalEngine").value;
      const dmPolicy = document.getElementById("botModalDmPolicy").value;
      const groupPolicy = document.getElementById("botModalGroupPolicy").value;

      if (!name || !token) {
        alert("Bot Name & Token are required.");
        return;
      }

      const newBot = {
        name,
        channel,
        token,
        dmPolicy,
        groupPolicy,
        allowFrom: [],
        groups: {}
      };
      if (engine) newBot.engine = engine;

      if (!currentConfig.bots) currentConfig.bots = [];
      currentConfig.bots.push(newBot);

      closeModal("modalBot");
      renderBotsManager(currentConfig.bots);
      showToast(t("botAddedToast", { name }), "success");
    }

    // SOUL Modal
    async function openSoulModal(botId) {
      activeSoulBotId = botId;
      document.getElementById("soulModalTitle").textContent = t("modalSoulTitle") + \` (\${botId})\`;
      document.getElementById("soulEditorText").value = "Loading...";
      openModal("modalSoul");

      try {
        const res = await fetch(\`/api/soul?bot_id=\${encodeURIComponent(botId)}\`);
        const data = await res.json();
        document.getElementById("soulEditorText").value = data.content || "";
      } catch (err) {
        document.getElementById("soulEditorText").value = "# Error loading SOUL.md: " + err.message;
      }
    }

    async function saveSoul() {
      if (!activeSoulBotId) return;
      const content = document.getElementById("soulEditorText").value;
      try {
        const res = await fetch("/api/soul", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: activeSoulBotId, content })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(\`SOUL.md updated for \${activeSoulBotId}\`, "success");
          closeModal("modalSoul");
        } else {
          showToast("Failed to save soul: " + data.error, "error");
        }
      } catch (err) {
        showToast("Error saving soul: " + err.message, "error");
      }
    }

    // Skills
    async function fetchSkills() {
      try {
        const res = await fetch("/api/skills");
        if (!res.ok) return;
        const data = await res.json();
        const skills = data.skills || [];
        document.getElementById("mSkillsCount").textContent = skills.length;
        renderSkills(skills);
      } catch {}
    }

    function renderSkills(skills) {
      const container = document.getElementById("skillsGrid");
      if (!skills || skills.length === 0) {
        container.innerHTML = \`<div style="color: var(--text-muted); font-size: 0.85rem;">\${t("noSkillsFound")}</div>\`;
        return;
      }
      container.innerHTML = skills.map(s => \`
        <div class="skill-card">
          <div class="skill-header">
            <span class="skill-name">\${escapeHtml(s.name)}</span>
            <div class="sync-tags">
              <span class="sync-tag \${s.synced?.claude ? 'sync-on' : 'sync-off'}">\${s.synced?.claude ? 'Claude' : '!Claude'}</span>
              <span class="sync-tag \${s.synced?.codex ? 'sync-on' : 'sync-off'}">\${s.synced?.codex ? 'Codex' : '!Codex'}</span>
              <span class="sync-tag \${s.synced?.agy ? 'sync-on' : 'sync-off'}">\${s.synced?.agy ? 'AGY' : '!AGY'}</span>
            </div>
          </div>
          <p class="skill-desc">\${escapeHtml(s.description || 'No description provided')}</p>
          <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Scripts: \${s.scripts?.length ? escapeHtml(s.scripts.join(', ')) : 'None'}</span>
            <span style="font-family: var(--font-mono);">\${escapeHtml(s.dir.split('/').pop())}</span>
          </div>
        </div>
      \`).join("");
    }

    async function syncSkills() {
      const btn = document.getElementById("btnSyncSkills");
      btn.textContent = t("saving");
      try {
        const res = await fetch("/api/skills/sync", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          showToast(\`Synchronized \${data.skills.length} skills across engines\`, "success");
          fetchSkills();
        } else {
          showToast(data.error || "Sync error", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.textContent = t("syncSkills");
      }
    }

    async function createSkill() {
      const name = document.getElementById("newSkillName").value.trim();
      const desc = document.getElementById("newSkillDesc").value.trim();
      if (!name) return;

      try {
        const res = await fetch("/api/skills/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: desc })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(\`Skill "\${name}" created and mirrored\`, "success");
          closeModal("modalNewSkill");
          fetchSkills();
        } else {
          showToast(data.error, "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    // Pairings
    async function fetchPairings() {
      try {
        const res = await fetch("/api/pairings");
        if (!res.ok) return;
        const data = await res.json();
        renderPairings(data.pending || []);
      } catch {}
    }

    function renderPairings(pending) {
      const container = document.getElementById("pendingPairingsContainer");
      if (!pending || pending.length === 0) {
        container.innerHTML = \`<div style="color: var(--text-muted); font-size: 0.85rem;">\${t("noPendingPairings")}</div>\`;
        return;
      }
      container.innerHTML = pending.map(p => \`
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.95rem; background: var(--bg-card-subtle); border-radius: 6px; border: 1px solid var(--border);">
          <div>
            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.88rem;">
              User: \${escapeHtml(p.req.senderName || p.req.senderId)}
              <span style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono);">(\${escapeHtml(p.req.senderId)})</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
              Channel: \${p.req.channelType} • Bot: \${escapeHtml(p.botName)} • Code: <strong style="color: var(--badge-amber-text); font-family: var(--font-mono); font-size: 0.9rem;">\${escapeHtml(p.req.code)}</strong>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="approvePairing('\${escapeHtml(p.req.code)}')">\${t("approve")}</button>
        </div>
      \`).join("");
    }

    async function approvePairing(code) {
      try {
        const res = await fetch("/api/pairings/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(t("pairingApprovedToast", { id: data.senderId, bot: data.botName }), "success");
          fetchPairings();
          fetchConfig();
        } else {
          showToast(data.error || "Approval failed", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    // Save & Hot Reload
    async function saveAndHotReload() {
      const btn = document.getElementById("btnSaveConfig");
      const originalText = btn.innerHTML;
      btn.innerHTML = t("saving");
      btn.disabled = true;

      try {
        collectFormData();

        const res = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: currentConfig })
        });

        const data = await res.json();
        if (data.ok) {
          currentConfig = data.config;
          currentYaml = data.yaml;
          document.getElementById("rawYamlEditor").value = currentYaml;

          const changeCount = data.changes?.length ?? 0;
          const msg = changeCount > 0
            ? data.changes.join("<br>• ")
            : "No changes detected";

          showToast(\`\${t("hotReloadSuccess")} (\${changeCount}):<br>• \${msg}\`, "success", 5000);
          fetchStatus();
        } else {
          showToast(t("hotReloadFailed") + ": " + (data.error || ""), "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    function collectFormData() {
      if (!currentConfig) currentConfig = {};
      if (!currentConfig.engines) currentConfig.engines = {};
      if (!currentConfig.gateway) currentConfig.gateway = {};
      if (!currentConfig.auth) currentConfig.auth = {};

      currentConfig.engines.maxProcesses = parseInt(document.getElementById("cfgMaxProcesses").value, 10) || 10;
      currentConfig.engines.idleTimeoutMs = parseInt(document.getElementById("cfgIdleTimeout").value, 10) || 600000;

      // Claude
      if (!currentConfig.engines.claude) currentConfig.engines.claude = {};
      currentConfig.engines.claude.binary = document.getElementById("cfgClaudeBinary").value.trim() || "claude";
      currentConfig.engines.claude.model = document.getElementById("cfgClaudeModel").value || undefined;
      currentConfig.engines.claude.effort = document.getElementById("cfgClaudeEffort").value || undefined;
      currentConfig.engines.claude.extraArgs = document.getElementById("cfgClaudeExtraArgs").value.split(",").map(s => s.trim()).filter(Boolean);

      // Codex
      if (!currentConfig.engines.codex) currentConfig.engines.codex = {};
      currentConfig.engines.codex.binary = document.getElementById("cfgCodexBinary").value.trim() || "codex";
      currentConfig.engines.codex.model = document.getElementById("cfgCodexModel").value || undefined;
      currentConfig.engines.codex.sandbox = document.getElementById("cfgCodexSandbox").value;
      currentConfig.engines.codex.approvalPolicy = document.getElementById("cfgCodexApproval").value;

      // AGY
      if (!currentConfig.engines.agy) currentConfig.engines.agy = {};
      currentConfig.engines.agy.binary = document.getElementById("cfgAgyBinary").value.trim() || "agy";
      currentConfig.engines.agy.model = document.getElementById("cfgAgyModel").value || undefined;
      currentConfig.engines.agy.effort = document.getElementById("cfgAgyEffort").value || undefined;
      currentConfig.engines.agy.extraArgs = document.getElementById("cfgAgyExtraArgs").value.split(",").map(s => s.trim()).filter(Boolean);

      // Gateway
      currentConfig.gateway.port = parseInt(document.getElementById("cfgPort").value, 10) || 18790;
      currentConfig.gateway.dataDir = document.getElementById("cfgDataDir").value.trim() || "~/.pocketagent";
      currentConfig.gateway.logLevel = document.getElementById("cfgLogLevel").value;
      currentConfig.gateway.logFormat = document.getElementById("cfgLogFormat").value;

      // Auth
      currentConfig.auth.defaultPolicy = document.getElementById("cfgDefaultAuthPolicy").value;
    }

    async function applyYaml() {
      const yaml = document.getElementById("rawYamlEditor").value;
      const btn = document.getElementById("btnApplyYaml");
      btn.textContent = t("saving");
      btn.disabled = true;

      try {
        const res = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yaml })
        });
        const data = await res.json();
        if (data.ok) {
          currentConfig = data.config;
          currentYaml = data.yaml;
          populateVisualForm(currentConfig);
          showToast(t("hotReloadSuccess"), "success");
          fetchStatus();
        } else {
          showToast(t("yamlError") + ": " + (data.error || ""), "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.textContent = t("applyYaml");
        btn.disabled = false;
      }
    }

    function syncFormToYaml() {
      collectFormData();
      fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: currentConfig })
      }).then(r => r.json()).then(data => {
        if (data.ok && data.yaml) {
          document.getElementById("rawYamlEditor").value = data.yaml;
        }
      }).catch(() => {});
    }

    // Modal Helpers
    function openModal(id) { document.getElementById(id).classList.add("show"); }
    function closeModal(id) { document.getElementById(id).classList.remove("show"); }

    // Toast
    function showToast(message, type = "info", duration = 4000) {
      const container = document.getElementById("toastContainer");
      const toast = document.createElement("div");
      toast.className = \`toast \${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}\`;
      const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice';
      toast.innerHTML = \`
        <div class="toast-title">\${title}</div>
        <div class="toast-msg">\${message}</div>
      \`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 250);
      }, duration);
    }

    function escapeHtml(str) {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatUptime(sec) {
      if (!sec) return "0s";
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      if (h > 0) return \`\${h}h \${m}m\`;
      if (m > 0) return \`\${m}m \${s}s\`;
      return \`\${s}s\`;
    }

    window.addEventListener("DOMContentLoaded", init);
  </script>
</body>
</html>`;
}
