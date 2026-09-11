export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PocketAgent Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>">
  <style>
    :root {
      --bg-base: #0b0f19;
      --bg-surface: #111827;
      --bg-card: #1a2234;
      --bg-card-hover: #222d44;
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: #6366f1;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --text-subtle: #6b7280;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      --emerald: #10b981;
      --emerald-bg: rgba(16, 185, 129, 0.15);
      --amber: #f59e0b;
      --amber-bg: rgba(245, 158, 11, 0.15);
      --rose: #ef4444;
      --rose-bg: rgba(239, 68, 68, 0.15);
      --indigo: #6366f1;
      --indigo-bg: rgba(99, 102, 241, 0.15);
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      padding: 0.85rem 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--primary-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .brand-logo svg {
      width: 20px;
      height: 20px;
      fill: white;
    }
    .brand-title {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .brand-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 1px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.65rem;
      background: var(--emerald-bg);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--emerald);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-pulse {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--emerald);
      box-shadow: 0 0 8px var(--emerald);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      text-decoration: none;
    }
    .btn-primary {
      background: var(--primary-gradient);
      color: #fff;
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.35);
    }
    .btn-primary:hover {
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: var(--bg-card);
      border-color: var(--border);
      color: var(--text-main);
    }
    .btn-secondary:hover {
      background: var(--bg-card-hover);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .btn-danger {
      background: var(--rose-bg);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--rose);
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
    }
    .btn-sm {
      padding: 0.3rem 0.65rem;
      font-size: 0.78rem;
    }

    /* Layout */
    .app-container {
      display: flex;
      flex: 1;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      padding: 1.5rem 1.75rem;
      gap: 1.5rem;
    }

    /* Sidebar Navigation */
    .sidebar {
      width: 230px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.9rem;
      color: var(--text-muted);
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
      user-select: none;
    }
    .nav-item:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.04);
    }
    .nav-item.active {
      color: #fff;
      background: var(--bg-card);
      border-color: var(--border);
      font-weight: 600;
    }
    .nav-item.active .nav-icon {
      color: var(--primary);
    }
    .nav-icon {
      font-size: 1.1rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
    }

    /* Main Content Area */
    .main-content {
      flex: 1;
      min-width: 0;
    }
    .tab-pane {
      display: none;
    }
    .tab-pane.active {
      display: block;
      animation: fadeIn 0.2s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards & Grids */
    .section-header {
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }
    .section-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .grid-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .metric-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .metric-value {
      font-size: 1.55rem;
      font-weight: 700;
      color: #fff;
    }
    .metric-sub {
      font-size: 0.78rem;
      color: var(--text-subtle);
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.4rem;
      margin-bottom: 1.25rem;
    }
    .card-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    /* Form controls */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .form-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .form-control {
      background: #0f1422;
      border: 1px solid var(--border);
      color: #fff;
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s ease;
      width: 100%;
    }
    .form-control:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }
    select.form-control {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1rem;
      padding-right: 2.2rem;
    }
    textarea.form-control {
      resize: vertical;
      min-height: 80px;
      font-family: inherit;
    }

    /* Engine Selector Radio Cards */
    .engine-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .engine-card {
      background: var(--bg-card);
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 1.15rem;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }
    .engine-card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      background: var(--bg-card-hover);
    }
    .engine-card.selected {
      border-color: var(--primary);
      background: rgba(99, 102, 241, 0.08);
    }
    .engine-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .engine-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
    }
    .engine-badge {
      font-size: 0.72rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-weight: 600;
    }
    .engine-desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Bot cards */
    .bot-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: border-color 0.15s ease;
    }
    .bot-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
    }
    .bot-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .bot-title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .channel-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    .channel-tg { background: #0088cc; color: white; }
    .channel-dc { background: #5865F2; color: white; }
    .bot-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
    }
    .bot-meta {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    /* Tag/Chip Input */
    .tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      background: #0f1422;
      border: 1px solid var(--border);
      padding: 0.4rem;
      border-radius: 8px;
      min-height: 42px;
      align-items: center;
    }
    .tag {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-family: var(--font-mono);
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .tag-remove {
      cursor: pointer;
      color: var(--text-subtle);
      font-weight: bold;
      line-height: 1;
    }
    .tag-remove:hover { color: var(--rose); }
    .tag-input {
      background: transparent;
      border: none;
      color: #fff;
      font-size: 0.82rem;
      padding: 0.2rem 0.4rem;
      outline: none;
      flex: 1;
      min-width: 80px;
    }

    /* Skills Grid */
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .skill-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .skill-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .skill-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .skill-desc {
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .skill-sync-badges {
      display: flex;
      gap: 0.4rem;
    }
    .sync-badge {
      font-size: 0.72rem;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      font-weight: 600;
    }
    .sync-ok { background: var(--emerald-bg); color: var(--emerald); border: 1px solid rgba(16, 185, 129, 0.3); }
    .sync-no { background: var(--rose-bg); color: var(--rose); border: 1px solid rgba(239, 68, 68, 0.3); }

    /* Raw YAML Editor */
    .yaml-editor-wrapper {
      background: #0f1422;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .yaml-toolbar {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      padding: 0.6rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .yaml-textarea {
      background: transparent;
      border: none;
      color: #e5e7eb;
      font-family: var(--font-mono);
      font-size: 0.88rem;
      line-height: 1.6;
      padding: 1rem;
      width: 100%;
      height: 520px;
      outline: none;
      resize: vertical;
      tab-size: 2;
    }

    /* Toasts */
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      z-index: 100;
      max-width: 420px;
    }
    .toast {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.85rem 1.15rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .toast-success { border-left: 4px solid var(--emerald); }
    .toast-error { border-left: 4px solid var(--rose); }
    .toast-title { font-size: 0.88rem; font-weight: 700; color: #fff; }
    .toast-msg { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
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
      border-radius: 16px;
      width: 100%;
      max-width: 580px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .modal-lg { max-width: 780px; }
    @keyframes modalIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .modal-header {
      padding: 1.15rem 1.4rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-title { font-size: 1.15rem; font-weight: 700; color: #fff; }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.25rem;
    }
    .modal-body {
      padding: 1.4rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .modal-footer {
      padding: 1rem 1.4rem;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <header>
    <div class="brand">
      <div class="brand-logo">
        <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <div>
        <div class="brand-title">PocketAgent</div>
        <div class="brand-subtitle">Gateway & Hot-Config Dashboard</div>
      </div>
    </div>

    <div class="header-actions">
      <div id="statusBadge" class="status-badge">
        <span class="status-pulse"></span>
        <span id="statusText">Connecting...</span>
      </div>
      <button id="btnRefresh" class="btn btn-secondary btn-sm" title="Reload from server">
        ↻ Refresh
      </button>
      <button id="btnSaveConfig" class="btn btn-primary" title="Save & Hot Reload (Cmd+S / Ctrl+S)">
        ⚡ Save & Hot Reload
      </button>
    </div>
  </header>

  <!-- App Layout -->
  <div class="app-container">
    <!-- Sidebar Tabs -->
    <nav class="sidebar">
      <div class="nav-item active" data-tab="overview">
        <span class="nav-icon">📊</span>
        <span>Overview</span>
      </div>
      <div class="nav-item" data-tab="bots">
        <span class="nav-icon">🤖</span>
        <span>Bots</span>
      </div>
      <div class="nav-item" data-tab="engines">
        <span class="nav-icon">⚡</span>
        <span>Engines</span>
      </div>
      <div class="nav-item" data-tab="gateway">
        <span class="nav-icon">⚙️</span>
        <span>Gateway</span>
      </div>
      <div class="nav-item" data-tab="security">
        <span class="nav-icon">🔒</span>
        <span>Security & Auth</span>
      </div>
      <div class="nav-item" data-tab="skills">
        <span class="nav-icon">🧩</span>
        <span>Skills (3-CLI)</span>
      </div>
      <div class="nav-item" data-tab="yaml">
        <span class="nav-icon">📝</span>
        <span>Raw YAML</span>
      </div>
    </nav>

    <!-- Main Content Panes -->
    <main class="main-content">

      <!-- TAB: Overview -->
      <section id="tab-overview" class="tab-pane active">
        <div class="section-header">
          <div>
            <h1 class="section-title">System Overview</h1>
            <p class="section-desc">Real-time status and operational health of PocketAgent Gateway</p>
          </div>
        </div>

        <div class="grid-metrics">
          <div class="metric-card">
            <span class="metric-label">Gateway Status</span>
            <span id="mGatewayStatus" class="metric-value" style="color: var(--emerald);">Online</span>
            <span id="mGatewayPort" class="metric-sub">Port: --</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Active Bots</span>
            <span id="mBotsCount" class="metric-value">0</span>
            <span id="mBotsDetail" class="metric-sub">--</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Default Engine</span>
            <span id="mDefaultEngine" class="metric-value" style="text-transform: uppercase;">--</span>
            <span id="mEngineDetail" class="metric-sub">Claude • Codex • AGY</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">3-CLI Skills</span>
            <span id="mSkillsCount" class="metric-value">0</span>
            <span class="metric-sub">Claude • Codex • AGY mesh</span>
          </div>
        </div>

        <!-- Connected Bots List Summary -->
        <div class="card">
          <div class="card-title">
            <span>Configured Bots</span>
            <button class="btn btn-secondary btn-sm" onclick="switchTab('bots')">Manage Bots →</button>
          </div>
          <div class="card-desc">Active chat platform bridges connected to PocketAgent</div>
          <div id="overviewBotsList" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="color: var(--text-subtle);">Loading bots...</div>
          </div>
        </div>

        <!-- Discovered Engine Capabilities -->
        <div class="card">
          <div class="card-title">
            <span>Engine Discovery & Models</span>
            <button class="btn btn-secondary btn-sm" onclick="fetchModels(true)">↺ Scan Models</button>
          </div>
          <div class="card-desc">Dynamically detected CLI binaries and available models on this machine</div>
          <div id="overviewEnginesGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </section>

      <!-- TAB: Bots -->
      <section id="tab-bots" class="tab-pane">
        <div class="section-header">
          <div>
            <h1 class="section-title">Bots Management</h1>
            <p class="section-desc">Configure Telegram and Discord bot bridges, tokens, engines, and access policies</p>
          </div>
          <button id="btnAddBot" class="btn btn-primary btn-sm">+ Add New Bot</button>
        </div>

        <div id="botsContainer">
          <!-- Rendered dynamically -->
        </div>
      </section>

      <!-- TAB: Engines -->
      <section id="tab-engines" class="tab-pane">
        <div class="section-header">
          <div>
            <h1 class="section-title">Engines Configuration</h1>
            <p class="section-desc">Manage CLI execution backends (Claude Code, OpenAI Codex, Google Antigravity)</p>
          </div>
        </div>

        <!-- Default Engine Picker -->
        <div class="card">
          <div class="card-title">Default Engine</div>
          <div class="card-desc">Selected engine used for all sessions unless overridden by a bot or /engine command</div>
          <div class="engine-cards">
            <div class="engine-card" data-engine="claude" onclick="selectDefaultEngine('claude')">
              <div class="engine-card-header">
                <span class="engine-name">Claude Code</span>
                <span class="engine-badge" style="background: rgba(217, 119, 6, 0.2); color: #f59e0b;">Anthropic</span>
              </div>
              <p class="engine-desc">Official Claude CLI with CLAUDE.md workspace injection and tools</p>
            </div>
            <div class="engine-card" data-engine="codex" onclick="selectDefaultEngine('codex')">
              <div class="engine-card-header">
                <span class="engine-name">OpenAI Codex</span>
                <span class="engine-badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">OpenAI</span>
              </div>
              <p class="engine-desc">Codex CLI with AGENTS.md, sandboxing, and autonomous tool calling</p>
            </div>
            <div class="engine-card" data-engine="agy" onclick="selectDefaultEngine('agy')">
              <div class="engine-card-header">
                <span class="engine-name">Google Antigravity</span>
                <span class="engine-badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">DeepMind</span>
              </div>
              <p class="engine-desc">AGY CLI with native skills, subagents, and Gemini reasoning models</p>
            </div>
          </div>
        </div>

        <!-- Global Engine Concurrency Settings -->
        <div class="card">
          <div class="card-title">Concurrency & Timeouts</div>
          <div class="card-desc">Process limits and idle lifecycle across all engine adapters</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Max Concurrent Processes</label>
              <input id="cfgMaxProcesses" type="number" class="form-control" min="1" max="50" value="10">
            </div>
            <div class="form-group">
              <label class="form-label">Idle Process Timeout (ms)</label>
              <input id="cfgIdleTimeout" type="number" class="form-control" min="60000" step="10000" value="600000">
            </div>
          </div>
        </div>

        <!-- Individual Engine Settings -->
        <div class="card">
          <div class="card-title">Claude Code Engine</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Binary Command</label>
              <input id="cfgClaudeBinary" type="text" class="form-control" value="claude">
            </div>
            <div class="form-group">
              <label class="form-label">Default Model</label>
              <select id="cfgClaudeModel" class="form-control"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Effort</label>
              <select id="cfgClaudeEffort" class="form-control">
                <option value="">Default</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Extra Args (comma separated)</label>
              <input id="cfgClaudeExtraArgs" type="text" class="form-control" placeholder="--dangerously-skip-permissions">
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">OpenAI Codex Engine</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Binary Command</label>
              <input id="cfgCodexBinary" type="text" class="form-control" value="codex">
            </div>
            <div class="form-group">
              <label class="form-label">Default Model</label>
              <select id="cfgCodexModel" class="form-control"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Sandbox Mode</label>
              <select id="cfgCodexSandbox" class="form-control">
                <option value="danger-full-access">danger-full-access (Unrestricted)</option>
                <option value="workspace-write">workspace-write (Workspace Only)</option>
                <option value="read-only">read-only (Read Only)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Approval Policy</label>
              <select id="cfgCodexApproval" class="form-control">
                <option value="never">never (Auto-approve)</option>
                <option value="on-request">on-request (Interactive)</option>
                <option value="untrusted">untrusted (Prompt always)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Google Antigravity (AGY) Engine</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Binary Command</label>
              <input id="cfgAgyBinary" type="text" class="form-control" value="agy">
            </div>
            <div class="form-group">
              <label class="form-label">Default Model</label>
              <select id="cfgAgyModel" class="form-control"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Effort</label>
              <select id="cfgAgyEffort" class="form-control">
                <option value="">Default</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Extra Args (comma separated)</label>
              <input id="cfgAgyExtraArgs" type="text" class="form-control" placeholder="--resume">
            </div>
          </div>
        </div>
      </section>

      <!-- TAB: Gateway -->
      <section id="tab-gateway" class="tab-pane">
        <div class="section-header">
          <div>
            <h1 class="section-title">Gateway & Network</h1>
            <p class="section-desc">Host listening port, log levels, formatting, and file storage directories</p>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Server Settings</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">API / Dashboard Port</label>
              <input id="cfgPort" type="number" class="form-control" min="1024" max="65535" value="18790">
            </div>
            <div class="form-group">
              <label class="form-label">Data Directory</label>
              <input id="cfgDataDir" type="text" class="form-control" value="~/.pocketagent">
            </div>
            <div class="form-group">
              <label class="form-label">Log Level</label>
              <select id="cfgLogLevel" class="form-control">
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Log Format</label>
              <select id="cfgLogFormat" class="form-control">
                <option value="pretty">pretty (Colorized console)</option>
                <option value="json">json (Structured JSON)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB: Security & Auth -->
      <section id="tab-security" class="tab-pane">
        <div class="section-header">
          <div>
            <h1 class="section-title">Security & Pairing</h1>
            <p class="section-desc">Manage authentication policies and one-click approve pending device pairings</p>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Global Auth Policy</div>
          <div class="card-desc">Default policy applied to bots without explicit policy overrides</div>
          <div class="form-group" style="max-width: 320px;">
            <select id="cfgDefaultAuthPolicy" class="form-control">
              <option value="pairing">pairing (Requires one-time challenge code)</option>
              <option value="allowlist">allowlist (Restricted to allowFrom IDs)</option>
              <option value="open">open (Accept all inbound messages)</option>
              <option value="disabled">disabled (Ignore all messages)</option>
            </select>
          </div>
        </div>

        <!-- Pending Pairings -->
        <div class="card">
          <div class="card-title">Pending Pairing Requests</div>
          <div class="card-desc">Users or groups attempting to authenticate via pairing code</div>
          <div id="pendingPairingsContainer" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="color: var(--text-subtle);">No pending pairing requests.</div>
          </div>
        </div>
      </section>

      <!-- TAB: Skills -->
      <section id="tab-skills" class="tab-pane">
        <div class="section-header">
          <div>
            <h1 class="section-title">Skills (3-CLI Mesh)</h1>
            <p class="section-desc">Unified hub at <code>~/.pocketagent/skills/</code> mirrored to Claude Code, Codex, and AGY</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="btnSyncSkills" class="btn btn-secondary btn-sm">↻ Sync 3-CLI Skills</button>
            <button id="btnNewSkill" class="btn btn-primary btn-sm">+ New Skill</button>
          </div>
        </div>

        <div id="skillsGrid" class="skills-grid">
          <!-- Rendered dynamically -->
        </div>
      </section>

      <!-- TAB: Raw YAML -->
      <section id="tab-yaml" class="tab-pane">
        <div class="section-header">
          <div>
            <h1 class="section-title">Raw YAML Editor</h1>
            <p class="section-desc">Directly view and edit <code>config.yaml</code> with live schema validation</p>
          </div>
          <button id="btnApplyYaml" class="btn btn-primary btn-sm">Apply & Hot Reload</button>
        </div>

        <div class="yaml-editor-wrapper">
          <div class="yaml-toolbar">
            <span id="yamlValidationStatus" style="font-size: 0.8rem; color: var(--emerald);">✓ Ready</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Changes here sync with visual form</span>
          </div>
          <textarea id="rawYamlEditor" class="yaml-textarea" spellcheck="false"></textarea>
        </div>
      </section>

    </main>
  </div>

  <!-- Toast Container -->
  <div id="toastContainer" class="toast-container"></div>

  <!-- Modal: Add / Edit Bot -->
  <div id="modalBot" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="modalBotTitle">Add New Bot</div>
        <button class="modal-close" onclick="closeModal('modalBot')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Bot Name (unique identifier)</label>
          <input id="botModalName" type="text" class="form-control" placeholder="my-bot">
        </div>
        <div class="form-group">
          <label class="form-label">Channel</label>
          <select id="botModalChannel" class="form-control">
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Bot Token</label>
          <input id="botModalToken" type="password" class="form-control" placeholder="Paste bot token from BotFather or Discord portal">
        </div>
        <div class="form-group">
          <label class="form-label">Engine (optional override)</label>
          <select id="botModalEngine" class="form-control">
            <option value="">Inherit Default Engine</option>
            <option value="claude">Claude Code</option>
            <option value="codex">OpenAI Codex</option>
            <option value="agy">Google Antigravity (AGY)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">DM Access Policy</label>
          <select id="botModalDmPolicy" class="form-control">
            <option value="pairing">pairing</option>
            <option value="allowlist">allowlist</option>
            <option value="open">open</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Group Access Policy</label>
          <select id="botModalGroupPolicy" class="form-control">
            <option value="pairing">pairing</option>
            <option value="allowlist">allowlist</option>
            <option value="open">open</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalBot')">Cancel</button>
        <button id="btnSaveModalBot" class="btn btn-primary">Add Bot</button>
      </div>
    </div>
  </div>

  <!-- Modal: SOUL Editor -->
  <div id="modalSoul" class="modal-backdrop">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="soulModalTitle">Edit Persona (SOUL.md)</div>
        <button class="modal-close" onclick="closeModal('modalSoul')">×</button>
      </div>
      <div class="modal-body">
        <p class="section-desc">Defines the bot's core personality, guidelines, and behavioral traits injected into the system prompt.</p>
        <textarea id="soulEditorText" class="form-control" style="height: 320px; font-family: var(--font-mono); font-size: 0.88rem;"></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalSoul')">Close</button>
        <button id="btnSaveSoul" class="btn btn-primary">Save SOUL.md</button>
      </div>
    </div>
  </div>

  <!-- Modal: New Skill -->
  <div id="modalNewSkill" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Create New Skill</div>
        <button class="modal-close" onclick="closeModal('modalNewSkill')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Skill Name</label>
          <input id="newSkillName" type="text" class="form-control" placeholder="e.g. stock-analyzer">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="newSkillDesc" class="form-control" placeholder="What does this skill do and when should the engine call it?"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalNewSkill')">Cancel</button>
        <button id="btnCreateSkillConfirm" class="btn btn-primary">Create & Sync</button>
      </div>
    </div>
  </div>

  <script>
    // Application State
    let currentConfig = null;
    let currentYaml = "";
    let systemStatus = null;
    let capabilities = {};
    let activeSoulBotId = null;

    // Elements
    const statusBadge = document.getElementById("statusBadge");
    const statusText = document.getElementById("statusText");
    const toastContainer = document.getElementById("toastContainer");
    const rawYamlEditor = document.getElementById("rawYamlEditor");

    // Initialize
    async function init() {
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

    // Tab Navigation
    function setupTabNavigation() {
      document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", () => {
          const tab = item.dataset.tab;
          switchTab(tab);
        });
      });
    }

    function switchTab(tabId) {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      const targetNav = document.querySelector(\`.nav-item[data-tab="\${tabId}"]\`);
      const targetPane = document.getElementById(\`tab-\${tabId}\`);
      if (targetNav && targetPane) {
        targetNav.classList.add("active");
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

    // Event Bindings
    function setupEvents() {
      document.getElementById("btnRefresh").addEventListener("click", async () => {
        showToast("Refreshing state from server...", "info");
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
        if (!res.ok) throw new Error("Status API error");
        const data = await res.json();
        systemStatus = data;

        statusBadge.style.background = "var(--emerald-bg)";
        statusBadge.style.color = "var(--emerald)";
        statusText.textContent = \`Online (PID \${data.gateway.pid})\`;

        document.getElementById("mGatewayStatus").textContent = "Online";
        document.getElementById("mGatewayPort").textContent = \`Port: \${data.gateway.port} • Uptime: \${formatUptime(data.gateway.uptime)}\`;
        document.getElementById("mBotsCount").textContent = data.bots.length;
        document.getElementById("mBotsDetail").textContent = \`\${data.bots.filter(b => b.channel === 'telegram').length} Telegram • \${data.bots.filter(b => b.channel === 'discord').length} Discord\`;
        document.getElementById("mDefaultEngine").textContent = data.defaultEngine || "claude";

        renderOverviewBots(data.bots);
      } catch (err) {
        statusBadge.style.background = "var(--rose-bg)";
        statusBadge.style.color = "var(--rose)";
        statusText.textContent = "Offline / Error";
      }
    }

    // Fetch Config
    async function fetchConfig() {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Config API error");
        const data = await res.json();
        currentConfig = data.config;
        currentYaml = data.yaml;

        rawYamlEditor.value = currentYaml;
        populateVisualForm(currentConfig);
      } catch (err) {
        showToast("Failed to load config: " + err.message, "error");
      }
    }

    // Populate Visual Form
    function populateVisualForm(cfg) {
      if (!cfg) return;

      // Default engine
      const defEngine = cfg.defaultEngine || cfg.engine || cfg.engines?.default || "claude";
      selectDefaultEngine(defEngine, false);

      // Concurrency & timeout
      document.getElementById("cfgMaxProcesses").value = cfg.engines?.maxProcesses ?? 10;
      document.getElementById("cfgIdleTimeout").value = cfg.engines?.idleTimeoutMs ?? 600000;

      // Claude
      if (cfg.engines?.claude) {
        document.getElementById("cfgClaudeBinary").value = cfg.engines.claude.binary || "claude";
        document.getElementById("cfgClaudeEffort").value = cfg.engines.claude.effort || "";
        document.getElementById("cfgClaudeExtraArgs").value = (cfg.engines.claude.extraArgs || []).join(", ");
      }

      // Codex
      if (cfg.engines?.codex) {
        document.getElementById("cfgCodexBinary").value = cfg.engines.codex.binary || "codex";
        document.getElementById("cfgCodexSandbox").value = cfg.engines.codex.sandbox || "danger-full-access";
        document.getElementById("cfgCodexApproval").value = cfg.engines.codex.approvalPolicy || "never";
      }

      // AGY
      if (cfg.engines?.agy) {
        document.getElementById("cfgAgyBinary").value = cfg.engines.agy.binary || "agy";
        document.getElementById("cfgAgyEffort").value = cfg.engines.agy.effort || "";
        document.getElementById("cfgAgyExtraArgs").value = (cfg.engines.agy.extraArgs || []).join(", ");
      }

      // Gateway
      document.getElementById("cfgPort").value = cfg.gateway?.port ?? 18790;
      document.getElementById("cfgDataDir").value = cfg.gateway?.dataDir ?? "~/.pocketagent";
      document.getElementById("cfgLogLevel").value = cfg.gateway?.logLevel ?? "info";
      document.getElementById("cfgLogFormat").value = cfg.gateway?.logFormat ?? "pretty";

      // Security
      document.getElementById("cfgDefaultAuthPolicy").value = cfg.auth?.defaultPolicy ?? "pairing";

      // Render bots
      renderBotsManager(cfg.bots || []);
    }

    // Select Default Engine
    function selectDefaultEngine(engine, sync = true) {
      document.querySelectorAll(".engine-card").forEach(c => {
        c.classList.toggle("selected", c.dataset.engine === engine);
      });
      if (currentConfig && sync) {
        currentConfig.defaultEngine = engine;
      }
    }

    // Fetch Models Discovery
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

    // Render Overview Bots
    function renderOverviewBots(bots) {
      const container = document.getElementById("overviewBotsList");
      if (!bots || bots.length === 0) {
        container.innerHTML = '<div style="color: var(--text-subtle);">No bots configured yet. Go to Bots tab to add one.</div>';
        return;
      }
      container.innerHTML = bots.map(b => \`
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="channel-icon \${b.channel === 'telegram' ? 'channel-tg' : 'channel-dc'}" style="width: 26px; height: 26px; font-size: 0.75rem;">
              \${b.channel === 'telegram' ? 'TG' : 'DC'}
            </div>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem; color: #fff;">\${escapeHtml(b.name)} \${b.username ? \`<span style="color: var(--text-muted); font-size: 0.78rem;">(@\${escapeHtml(b.username)})</span>\` : ''}</div>
              <div style="font-size: 0.75rem; color: var(--text-subtle);">Engine: \${b.engine} • DM: \${b.dmPolicy} • Allowed users: \${(b.allowFrom || []).length}</div>
            </div>
          </div>
          <span class="status-badge" style="font-size: 0.7rem;">\${b.status}</span>
        </div>
      \`).join("");
    }

    // Render Overview Engines
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
          <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">\${e.name}</span>
              <span class="status-badge" style="font-size: 0.7rem;">\${count} models</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
              \${e.cap?.models?.slice(0, 3).map(m => m.label || m.id).join(", ") || "Auto discovery active"}
              \${count > 3 ? \`<span style="color: var(--text-subtle);">+ \${count - 3} more</span>\` : ''}
            </div>
          </div>
        \`;
      }).join("");
    }

    // Render Bots Manager
    function renderBotsManager(bots) {
      const container = document.getElementById("botsContainer");
      if (!bots || bots.length === 0) {
        container.innerHTML = \`
          <div class="card" style="text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🤖</div>
            <div style="font-weight: 600; font-size: 1.1rem; color: #fff;">No Bots Configured</div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">Add your first Telegram or Discord bot to get started.</p>
            <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="openAddBotModal()">+ Add Bot</button>
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
              <div class="bot-title-group">
                <div class="channel-icon \${bot.channel === 'discord' ? 'channel-dc' : 'channel-tg'}">
                  \${bot.channel === 'discord' ? 'DC' : 'TG'}
                </div>
                <div>
                  <div class="bot-name">\${escapeHtml(bot.name)}</div>
                  <div class="bot-meta">Channel: \${bot.channel || 'telegram'} • Engine: \${bot.engine || 'inherit'}</div>
                </div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="openSoulModal('\${escapeHtml(bot.name)}')">✎ SOUL.md</button>
                <button class="btn btn-danger btn-sm" onclick="deleteBot(\${index})">Delete</button>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Bot Token</label>
                <input type="password" class="form-control bot-token" value="\${escapeHtml(tokenVal)}" onchange="updateBotField(\${index}, 'token', this.value)">
              </div>
              <div class="form-group">
                <label class="form-label">Engine Override</label>
                <select class="form-control" onchange="updateBotField(\${index}, 'engine', this.value)">
                  <option value="" \${!bot.engine ? 'selected' : ''}>Inherit Global Default</option>
                  <option value="claude" \${bot.engine === 'claude' ? 'selected' : ''}>Claude Code</option>
                  <option value="codex" \${bot.engine === 'codex' ? 'selected' : ''}>OpenAI Codex</option>
                  <option value="agy" \${bot.engine === 'agy' ? 'selected' : ''}>Google Antigravity</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">DM Policy</label>
                <select class="form-control" onchange="updateBotField(\${index}, 'dmPolicy', this.value)">
                  <option value="pairing" \${bot.dmPolicy === 'pairing' ? 'selected' : ''}>pairing</option>
                  <option value="allowlist" \${bot.dmPolicy === 'allowlist' ? 'selected' : ''}>allowlist</option>
                  <option value="open" \${bot.dmPolicy === 'open' ? 'selected' : ''}>open</option>
                  <option value="disabled" \${bot.dmPolicy === 'disabled' ? 'selected' : ''}>disabled</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Group Policy</label>
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
              <label class="form-label">Allowed User IDs (allowFrom)</label>
              <div class="tag-container" id="tags-allow-\${index}">
                \${allowFrom.map(id => \`
                  <span class="tag">\${escapeHtml(String(id))} <span class="tag-remove" onclick="removeAllowTag(\${index}, '\${escapeHtml(String(id))}')">×</span></span>
                \`).join("")}
                <input type="text" class="tag-input" placeholder="+ Add User ID and press Enter" onkeydown="handleTagInput(event, \${index})">
              </div>
            </div>

            <!-- Groups -->
            <div class="form-group">
              <label class="form-label">Allowed Group IDs</label>
              <div class="tag-container" id="tags-groups-\${index}">
                \${Object.keys(groups).map(gid => \`
                  <span class="tag">\${escapeHtml(String(gid))} <span class="tag-remove" onclick="removeGroupTag(\${index}, '\${escapeHtml(String(gid))}')">×</span></span>
                \`).join("")}
                <input type="text" class="tag-input" placeholder="+ Add Group ID and press Enter" onkeydown="handleGroupInput(event, \${index})">
              </div>
            </div>
          </div>
        \`;
      }).join("");
    }

    // Bot Tag Operations
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
      if (confirm(\`Delete bot "\${currentConfig.bots[index].name}"?\`)) {
        currentConfig.bots.splice(index, 1);
        renderBotsManager(currentConfig.bots);
        showToast("Bot removed. Click 'Save & Hot Reload' to apply.", "info");
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

      if (!name) {
        alert("Bot Name is required.");
        return;
      }
      if (!token) {
        alert("Bot Token is required.");
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
      showToast(\`Added bot "\${name}". Click 'Save & Hot Reload' to activate.\`, "success");
    }

    // SOUL Modal
    async function openSoulModal(botId) {
      activeSoulBotId = botId;
      document.getElementById("soulModalTitle").textContent = \`Edit Persona (SOUL.md) for \${botId}\`;
      document.getElementById("soulEditorText").value = "Loading...";
      openModal("modalSoul");

      try {
        const res = await fetch(\`/api/soul?bot_id=\${encodeURIComponent(botId)}\`);
        const data = await res.json();
        document.getElementById("soulEditorText").value = data.content || "";
      } catch (err) {
        document.getElementById("soulEditorText").value = "# Failed to load SOUL.md: " + err.message;
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

    // Fetch Skills
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
        container.innerHTML = '<div style="color: var(--text-subtle);">No custom skills found. Click "New Skill" to create one.</div>';
        return;
      }
      container.innerHTML = skills.map(s => \`
        <div class="skill-card">
          <div class="skill-header">
            <div class="skill-title">
              <span>🧩</span>
              <span>\${escapeHtml(s.name)}</span>
            </div>
            <div class="skill-sync-badges">
              <span class="sync-badge \${s.synced?.claude ? 'sync-ok' : 'sync-no'}">\${s.synced?.claude ? '✓ Claude' : '✗ Claude'}</span>
              <span class="sync-badge \${s.synced?.codex ? 'sync-ok' : 'sync-no'}">\${s.synced?.codex ? '✓ Codex' : '✗ Codex'}</span>
              <span class="sync-badge \${s.synced?.agy ? 'sync-ok' : 'sync-no'}">\${s.synced?.agy ? '✓ AGY' : '✗ AGY'}</span>
            </div>
          </div>
          <p class="skill-desc">\${escapeHtml(s.description || 'No description provided')}</p>
          <div style="font-size: 0.75rem; color: var(--text-subtle); display: flex; justify-content: space-between; align-items: center;">
            <span>Scripts: \${s.scripts?.length ? escapeHtml(s.scripts.join(', ')) : 'None'}</span>
            <code style="font-size: 0.7rem;">\${escapeHtml(s.dir)}</code>
          </div>
        </div>
      \`).join("");
    }

    async function syncSkills() {
      const btn = document.getElementById("btnSyncSkills");
      btn.textContent = "Syncing...";
      try {
        const res = await fetch("/api/skills/sync", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          showToast(\`Synchronized \${data.skills.length} skills across Claude, Codex, and AGY\`, "success");
          fetchSkills();
        } else {
          showToast("Sync failed: " + data.error, "error");
        }
      } catch (err) {
        showToast("Sync error: " + err.message, "error");
      } finally {
        btn.textContent = "↻ Sync 3-CLI Skills";
      }
    }

    async function createSkill() {
      const name = document.getElementById("newSkillName").value.trim();
      const desc = document.getElementById("newSkillDesc").value.trim();
      if (!name) {
        alert("Skill name is required");
        return;
      }
      try {
        const res = await fetch("/api/skills/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: desc })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(\`Skill "\${name}" created and synced across 3 CLIs\`, "success");
          closeModal("modalNewSkill");
          fetchSkills();
        } else {
          showToast("Failed to create skill: " + data.error, "error");
        }
      } catch (err) {
        showToast("Error: " + err.message, "error");
      }
    }

    // Fetch Pairings
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
        container.innerHTML = '<div style="color: var(--text-subtle);">No pending pairing requests.</div>';
        return;
      }
      container.innerHTML = pending.map(p => \`
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border);">
          <div>
            <div style="font-weight: 600; color: #fff; font-size: 0.9rem;">
              User: \${escapeHtml(p.req.senderName || p.req.senderId)}
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">(\${escapeHtml(p.req.senderId)})</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-subtle); margin-top: 2px;">
              Channel: \${p.req.channelType} • Bot: \${escapeHtml(p.botName)} • Code: <strong style="color: var(--amber); font-family: var(--font-mono); font-size: 0.95rem;">\${escapeHtml(p.req.code)}</strong>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="approvePairing('\${escapeHtml(p.req.code)}')">✓ Approve</button>
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
          showToast(\`Approved pairing for user \${data.senderId} (bot: \${data.botName})\`, "success");
          fetchPairings();
          fetchConfig();
        } else {
          showToast("Approval failed: " + data.error, "error");
        }
      } catch (err) {
        showToast("Error: " + err.message, "error");
      }
    }

    // Save & Hot Reload Action
    async function saveAndHotReload() {
      const btn = document.getElementById("btnSaveConfig");
      const originalText = btn.innerHTML;
      btn.innerHTML = "⚡ Saving...";
      btn.disabled = true;

      try {
        // Collect form data into currentConfig
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
          rawYamlEditor.value = currentYaml;

          const changeCount = data.changes?.length ?? 0;
          const msg = changeCount > 0
            ? data.changes.join("<br>• ")
            : "Configuration saved and verified (no runtime differences)";

          showToast(\`✓ Hot Reload Successful (\${changeCount} changes applied):<br>• \${msg}\`, "success", 6000);
          fetchStatus();
        } else {
          showToast("Hot reload failed: " + (data.error || "Validation error"), "error");
        }
      } catch (err) {
        showToast("Error during hot reload: " + err.message, "error");
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    // Collect visual form values into currentConfig
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
      const claudeArgs = document.getElementById("cfgClaudeExtraArgs").value.split(",").map(s => s.trim()).filter(Boolean);
      currentConfig.engines.claude.extraArgs = claudeArgs;

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
      const agyArgs = document.getElementById("cfgAgyExtraArgs").value.split(",").map(s => s.trim()).filter(Boolean);
      currentConfig.engines.agy.extraArgs = agyArgs;

      // Gateway
      currentConfig.gateway.port = parseInt(document.getElementById("cfgPort").value, 10) || 18790;
      currentConfig.gateway.dataDir = document.getElementById("cfgDataDir").value.trim() || "~/.pocketagent";
      currentConfig.gateway.logLevel = document.getElementById("cfgLogLevel").value;
      currentConfig.gateway.logFormat = document.getElementById("cfgLogFormat").value;

      // Auth
      currentConfig.auth.defaultPolicy = document.getElementById("cfgDefaultAuthPolicy").value;
    }

    // Raw YAML apply
    async function applyYaml() {
      const yaml = rawYamlEditor.value;
      const btn = document.getElementById("btnApplyYaml");
      btn.textContent = "Applying...";
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
          const changeCount = data.changes?.length ?? 0;
          showToast(\`✓ Hot Reload Successful (\${changeCount} changes applied)\`, "success");
          fetchStatus();
        } else {
          showToast("YAML Error: " + (data.error || "Invalid YAML"), "error");
        }
      } catch (err) {
        showToast("Error applying YAML: " + err.message, "error");
      } finally {
        btn.textContent = "Apply & Hot Reload";
        btn.disabled = false;
      }
    }

    function syncFormToYaml() {
      collectFormData();
      // If user hasn't heavily edited YAML directly, fetch stringified
      fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: currentConfig })
      }).then(r => r.json()).then(data => {
        if (data.ok && data.yaml) {
          rawYamlEditor.value = data.yaml;
        }
      }).catch(() => {});
    }

    // Modal helpers
    function openModal(id) {
      document.getElementById(id).classList.add("show");
    }
    function closeModal(id) {
      document.getElementById(id).classList.remove("show");
    }

    // Toast Notification System
    function showToast(message, type = "info", duration = 4000) {
      const toast = document.createElement("div");
      toast.className = \`toast \${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}\`;
      const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification';
      toast.innerHTML = \`
        <div class="toast-title">\${title}</div>
        <div class="toast-msg">\${message}</div>
      \`;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    // Helpers
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
