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
    .form-control:disabled {
      background-color: var(--bg-card-subtle);
      color: var(--text-muted);
      cursor: not-allowed;
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
    .modal-xl { max-width: 960px; }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      min-width: 260px;
    }

    /* Sessions & Workspaces Cards */
    .session-card, .workspace-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.15rem;
      margin-bottom: 0.75rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: border-color 0.15s ease;
    }
    .session-card:hover, .workspace-card:hover {
      border-color: var(--text-secondary);
    }
    .session-card.is-active {
      border-color: var(--border-focus);
    }
    .card-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 0.5rem 1rem;
      font-size: 0.8rem;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .meta-label {
      color: var(--text-muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .meta-val {
      color: var(--text-primary);
      font-weight: 500;
      word-break: break-all;
    }
    .badge-status {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .badge-active {
      background: var(--badge-green-bg);
      color: var(--badge-green-text);
      border: 1px solid var(--badge-green-border);
    }
    .badge-inactive {
      background: var(--tag-bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .badge-orphaned {
      background: var(--badge-amber-bg);
      color: var(--badge-amber-text);
      border: 1px solid var(--badge-amber-border);
    }
    .badge-engine {
      font-size: 0.72rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-weight: 600;
      background: var(--tag-bg);
      color: var(--text-primary);
      border: 1px solid var(--border);
      font-family: var(--font-mono);
      text-transform: uppercase;
    }

    .badge-paused {
      background: var(--badge-amber-bg);
      color: var(--badge-amber-text);
      border: 1px solid var(--badge-amber-border);
    }
    .badge-failed {
      background: var(--badge-red-bg);
      color: var(--badge-red-text);
      border: 1px solid var(--badge-red-border);
    }
    .cron-prompt {
      font-family: var(--font-mono);
      font-size: 0.76rem;
      color: var(--text-secondary);
      background: var(--bg-card-subtle);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.65rem;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 7.5em;
      overflow: hidden;
    }
    .status-dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      background: currentColor;
      display: inline-block;
      flex-shrink: 0;
    }
    .st-ok { color: var(--badge-green-text); }
    .st-fail { color: var(--badge-red-text); }
    .st-muted { color: var(--text-muted); }
    .job-log {
      font-family: var(--font-mono);
      font-size: 0.74rem;
      line-height: 1.45;
      color: var(--text-primary);
      background: var(--bg-card-subtle);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 60vh;
      min-height: 8rem;
      overflow: auto;
    }
    .job-latest {
      font-family: var(--font-mono);
      font-size: 0.74rem;
      color: var(--badge-green-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cron-runs-browser {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 0.85rem;
      height: min(68vh, 640px);
      min-height: 380px;
    }
    @media (max-width: 768px) {
      .cron-runs-browser {
        grid-template-columns: 1fr;
        height: auto;
      }
    }
    .cron-run-list {
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow-y: auto;
      background: var(--bg-card-subtle);
    }
    .cron-run-item {
      padding: 0.6rem 0.8rem;
      border-bottom: 1px solid var(--border-subtle);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.8rem;
    }
    .cron-run-item:hover { background: var(--bg-hover); }
    .cron-run-item.selected {
      background: var(--bg-card);
      box-shadow: inset 3px 0 0 var(--border-focus);
    }
    .cron-run-detail {
      border: 1px solid var(--border);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      background: var(--bg-input);
      overflow: hidden;
    }
    .cron-run-detail-header {
      padding: 0.6rem 0.9rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
    }
    .cron-run-detail-body {
      padding: 1rem 1.25rem;
      overflow: auto;
      flex: 1;
    }
    .cron-run-note {
      font-size: 0.8rem;
      padding: 0.55rem 0.75rem;
      border-radius: 6px;
      margin-bottom: 0.85rem;
      background: var(--tag-bg);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .cron-run-note.is-error {
      background: var(--badge-red-bg);
      color: var(--badge-red-text);
      border-color: var(--badge-red-border);
    }
    .cron-run-note.is-warn {
      background: var(--badge-amber-bg);
      color: var(--badge-amber-text);
      border-color: var(--badge-amber-border);
    }
    .md-body {
      font-size: 0.86rem;
      line-height: 1.7;
      color: var(--text-primary);
      word-break: break-word;
    }
    .md-body > :first-child { margin-top: 0; }
    .md-body h1 { font-size: 1.15rem; font-weight: 700; margin: 1.1rem 0 0.6rem; }
    .md-body h2 { font-size: 1.05rem; font-weight: 650; margin: 1.1rem 0 0.5rem; }
    .md-body h3 { font-size: 0.97rem; font-weight: 650; margin: 1rem 0 0.45rem; }
    .md-body h4, .md-body h5, .md-body h6 { font-size: 0.9rem; font-weight: 600; margin: 0.85rem 0 0.35rem; }
    .md-body p { margin: 0 0 0.6rem; }
    .md-body hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
    .md-body .md-list { margin: 0 0 0.6rem; }
    .md-body .md-li { display: flex; gap: 0.5rem; }
    .md-body .md-marker { color: var(--text-muted); flex-shrink: 0; min-width: 0.9rem; }
    .md-body code {
      font-family: var(--font-mono);
      font-size: 0.8em;
      background: var(--tag-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.05rem 0.3rem;
    }
    .md-body pre {
      background: var(--bg-card-subtle);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.65rem 0.8rem;
      overflow-x: auto;
      margin: 0 0 0.6rem;
    }
    .md-body pre code { background: none; border: none; padding: 0; }
    .md-body table {
      border-collapse: collapse;
      margin: 0 0 0.75rem;
      font-size: 0.82rem;
      display: block;
      overflow-x: auto;
      max-width: 100%;
    }
    .md-body th, .md-body td {
      border: 1px solid var(--border);
      padding: 0.35rem 0.6rem;
      text-align: left;
      vertical-align: top;
    }
    .md-body th { background: var(--bg-card-subtle); font-weight: 600; }
    .md-body blockquote {
      border-left: 3px solid var(--border);
      padding-left: 0.75rem;
      color: var(--text-secondary);
      margin: 0 0 0.6rem;
    }
    .md-body a { color: var(--text-primary); text-decoration: underline; }
    .md-raw {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      color: var(--text-primary);
    }

    /* Dialogue Turns Modal */
    .turns-container {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 0.3rem;
    }
    .turn-bubble {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      background: var(--bg-card);
    }
    .turn-bubble-user {
      border-color: var(--border-focus);
      background: var(--bg-card-subtle);
    }
    .turn-bubble-assistant {
      border-color: var(--border);
    }
    .turn-bubble-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    .turn-role-tag {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      padding: 0.1rem 0.35rem;
      border-radius: 3px;
    }
    .role-user {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
    }
    .role-assistant {
      background: var(--badge-green-bg);
      color: var(--badge-green-text);
      border: 1px solid var(--badge-green-border);
    }
    .role-system {
      background: var(--tag-bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .turn-text {
      font-size: 0.83rem;
      line-height: 1.5;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-sans);
    }

    /* Workspace File Browser Layout */
    .ws-browser {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 0.85rem;
      height: 480px;
    }
    @media (max-width: 768px) {
      .ws-browser {
        grid-template-columns: 1fr;
        height: auto;
      }
    }
    .ws-file-list-pane {
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow-y: auto;
      background: var(--bg-card-subtle);
      display: flex;
      flex-direction: column;
    }
    .ws-file-item {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--border-subtle);
      cursor: pointer;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.1s ease;
      color: var(--text-primary);
    }
    .ws-file-item:hover {
      background: var(--bg-hover);
    }
    .ws-file-item.selected {
      background: var(--bg-input);
      font-weight: 600;
      border-left: 3px solid var(--border-focus);
    }
    .ws-file-preview-pane {
      border: 1px solid var(--border);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      background: var(--bg-input);
      overflow: hidden;
    }
    .ws-preview-header {
      padding: 0.5rem 0.85rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
    }
    .ws-preview-content {
      padding: 0.75rem;
      flex: 1;
      overflow: auto;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text-primary);
    }
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
      <div class="nav-tab" data-tab="sessions" data-i18n="tabSessions">Sessions & Workspaces</div>
      <div class="nav-tab" data-tab="cron" data-i18n="tabCron">Scheduled Tasks</div>
      <div class="nav-tab" data-tab="jobs" data-i18n="tabJobs">Background Jobs</div>
      <div class="nav-tab" data-tab="gateway" data-i18n="tabGateway">Gateway</div>
      <div class="nav-tab" data-tab="security" data-i18n="tabSecurity">Security & Auth</div>
      <div class="nav-tab" data-tab="skills" data-i18n="tabSkills">Skills (4-CLI)</div>
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
          <div class="metric-sub">Claude • Codex • AGY • Grok</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricSkillsCount">4-CLI Skills</div>
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
          <p class="section-desc" data-i18n="enginesDesc">Configure Claude Code, OpenAI Codex, Google Antigravity (AGY), and xAI Grok backends</p>
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
          <div class="engine-card" data-engine="grok" onclick="selectDefaultEngine('grok')">
            <div class="engine-card-top">
              <span class="engine-title">xAI Grok</span>
              <span class="engine-tag">xAI</span>
            </div>
            <p class="engine-desc">Grok Build CLI with headless sessions, subagents, and Grok reasoning models</p>
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

      <!-- Grok Settings -->
      <div class="card">
        <div class="card-title" data-i18n="grokEngine">xAI Grok Engine</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" data-i18n="binaryCommand">Binary Command</label>
            <input id="cfgGrokBinary" type="text" class="form-control" value="grok">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="defaultModel">Default Model</label>
            <select id="cfgGrokModel" class="form-control"></select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="effortLevel">Effort Level</label>
            <select id="cfgGrokEffort" class="form-control">
              <option value="">Default</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="xhigh">xhigh</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="extraArgs">Extra Args</label>
            <input id="cfgGrokExtraArgs" type="text" class="form-control" placeholder="--disable-web-search">
          </div>
        </div>
      </div>
    </section>

    <!-- TAB: Sessions & Workspaces -->
    <section id="tab-sessions" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="sessionsTitle">Sessions & Workspaces</h1>
          <p class="section-desc" data-i18n="sessionsDesc">Inspect multi-turn dialogue histories, switch active sessions, and browse bound CLI execution workspaces</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnRefreshSessions" class="btn btn-secondary btn-sm" data-i18n="refreshSessions">↻ Refresh</button>
          <button id="btnNewSession" class="btn btn-primary btn-sm" data-i18n="newSession">+ New Session</button>
        </div>
      </div>

      <div class="grid-metrics">
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricTotalSessions">Total Sessions</div>
          <div id="mTotalSessions" class="metric-value">0</div>
          <div class="metric-sub">Across all bots & chats</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricActiveSessions">Active Sessions</div>
          <div id="mActiveSessions" class="metric-value" style="color: var(--badge-green-text);">0</div>
          <div class="metric-sub" data-i18n="sessionActive">Currently receiving turns</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricTotalTurns">Total Dialogue Turns</div>
          <div id="mTotalTurns" class="metric-value">0</div>
          <div class="metric-sub">User & Assistant messages</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="metricTotalDiskUsage">Workspace Storage</div>
          <div id="mTotalDiskUsage" class="metric-value">0 KB</div>
          <div class="metric-sub">~/.pocketagent/workspaces</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <select id="sessionsBotFilter" class="form-control" style="max-width: 200px;">
            <option value="" data-i18n="filterAllBots">All Bots</option>
          </select>
          <select id="sessionsStatusFilter" class="form-control" style="max-width: 170px;">
            <option value="all" data-i18n="filterAllStatus">All Status</option>
            <option value="active" data-i18n="filterActiveOnly">Active Only</option>
            <option value="inactive" data-i18n="filterInactiveOnly">Historical</option>
            <option value="orphaned" data-i18n="filterOrphanedOnly">Orphaned Folders</option>
          </select>
          <input id="sessionsSearchInput" type="text" class="form-control" placeholder="Search by Chat ID, Session ID, Engine..." data-i18n-placeholder="searchSessionsPlaceholder">
        </div>
      </div>

      <div id="sessionsListContainer">
        <!-- Dynamically rendered unified session & workspace cards -->
      </div>

      <div id="orphanedWorkspacesSection" style="margin-top: 1.5rem; display: none;">
        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--badge-amber-text);">▲</span>
          <span data-i18n="orphanedSectionTitle">Orphaned Workspace Folders (Unlinked to active chats)</span>
        </div>
        <div id="orphanedListContainer"></div>
      </div>
    </section>

    <!-- TAB: Scheduled Tasks -->
    <section id="tab-cron" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="cronTitle">Scheduled Tasks</h1>
          <p class="section-desc" data-i18n="cronDesc">Prompts the gateway runs automatically on a schedule, posting each result to its chat. Each run starts a fresh session with its own persistent working directory.</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnRefreshCron" class="btn btn-secondary btn-sm" data-i18n="refreshSessions">↻ Refresh</button>
          <button id="btnNewCron" class="btn btn-primary btn-sm" data-i18n="cronNew">+ New Task</button>
        </div>
      </div>

      <div class="grid-metrics">
        <div class="metric-card">
          <div class="metric-label" data-i18n="cronMetricTotal">Total Tasks</div>
          <div id="mCronTotal" class="metric-value">0</div>
          <div id="mCronTimezone" class="metric-sub">--</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="cronMetricEnabled">Enabled</div>
          <div id="mCronEnabled" class="metric-value" style="color: var(--badge-green-text);">0</div>
          <div class="metric-sub" data-i18n="cronMetricEnabledSub">Waiting for their next run</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="cronMetricRunning">Running Now</div>
          <div id="mCronRunning" class="metric-value">0</div>
          <div class="metric-sub" data-i18n="cronMetricRunningSub">Unattended CLI runs in progress</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="cronMetricAttention">Needs Attention</div>
          <div id="mCronAttention" class="metric-value" style="color: var(--badge-red-text);">0</div>
          <div class="metric-sub" data-i18n="cronMetricAttentionSub">Paused or last run failed</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <select id="cronBotFilter" class="form-control" style="max-width: 200px;">
            <option value="" data-i18n="filterAllBots">All Bots</option>
          </select>
          <select id="cronStatusFilter" class="form-control" style="max-width: 170px;">
            <option value="all" data-i18n="filterAllStatus">All Status</option>
            <option value="enabled" data-i18n="cronFilterEnabled">Enabled</option>
            <option value="paused" data-i18n="cronFilterPaused">Paused</option>
          </select>
          <input id="cronSearchInput" type="text" class="form-control" placeholder="Search by name, prompt, Chat ID..." data-i18n-placeholder="cronSearchPlaceholder">
        </div>
      </div>

      <div id="cronListContainer">
        <!-- Dynamically rendered scheduled task cards -->
      </div>
    </section>

    <!-- TAB: Background Jobs -->
    <section id="tab-jobs" class="tab-pane">
      <div class="section-header">
        <div>
          <h1 class="section-title" data-i18n="jobsTitle">Background Jobs</h1>
          <p class="section-desc" data-i18n="jobsDesc">Long-running commands the agent handed to the gateway (big downloads, training runs, full builds). They run outside the chat; when one exits, the gateway sends the result back to the conversation that started it so the agent can continue. Jobs keep running across gateway restarts.</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnRefreshJobs" class="btn btn-secondary btn-sm" data-i18n="refreshSessions">↻ Refresh</button>
        </div>
      </div>

      <div class="grid-metrics">
        <div class="metric-card">
          <div class="metric-label" data-i18n="jobsMetricRunning">Running</div>
          <div id="mJobsRunning" class="metric-value" style="color: var(--badge-green-text);">0</div>
          <div class="metric-sub" data-i18n="jobsMetricRunningSub">Commands executing now</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="jobsMetricQueued">Queued</div>
          <div id="mJobsQueued" class="metric-value">0</div>
          <div class="metric-sub" data-i18n="jobsMetricQueuedSub">Waiting for a free slot</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="jobsMetricDone">Succeeded</div>
          <div id="mJobsDone" class="metric-value">0</div>
          <div class="metric-sub" data-i18n="jobsMetricDoneSub">Finished with exit code 0</div>
        </div>
        <div class="metric-card">
          <div class="metric-label" data-i18n="jobsMetricFailed">Failed / Timed Out</div>
          <div id="mJobsFailed" class="metric-value" style="color: var(--badge-red-text);">0</div>
          <div class="metric-sub" data-i18n="jobsMetricFailedSub">Worth a look</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <select id="jobsBotFilter" class="form-control" style="max-width: 200px;">
            <option value="" data-i18n="filterAllBots">All Bots</option>
          </select>
          <select id="jobsStatusFilter" class="form-control" style="max-width: 170px;">
            <option value="all" data-i18n="filterAllStatus">All Status</option>
            <option value="active" data-i18n="jobsFilterActive">In Progress</option>
            <option value="finished" data-i18n="jobsFilterFinished">Finished</option>
            <option value="failed" data-i18n="jobsFilterFailed">Failed</option>
          </select>
          <input id="jobsSearchInput" type="text" class="form-control" placeholder="Search by title, command, Chat ID..." data-i18n-placeholder="jobsSearchPlaceholder">
        </div>
      </div>

      <div id="jobsListContainer">
        <!-- Dynamically rendered background job cards -->
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
          <h1 class="section-title" data-i18n="skillsTitle">Skills (4-CLI Mesh)</h1>
          <p class="section-desc" data-i18n="skillsDesc">Unified hub at ~/.pocketagent/skills/ mirrored to Claude Code, Codex, AGY, and Grok</p>
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
            <option value="grok">xAI Grok</option>
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

  <!-- Modal: View & Edit Skill -->
  <div id="modalSkillDetail" class="modal-backdrop">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div>
          <div class="modal-title" data-i18n="modalSkillDetailTitle">Skill Details & Editor</div>
          <div id="modalSkillSubtitle" style="font-size: 0.76rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.2rem;"></div>
        </div>
        <button class="modal-close" onclick="closeModal('modalSkillDetail')">×</button>
      </div>
      <div class="modal-body">
        <div id="modalSkillSyncBanner" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem; padding: 0.65rem 0.85rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <!-- Sync tags & metadata -->
        </div>

        <div style="margin-bottom: 0.85rem;">
          <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.35rem;" data-i18n="skillFilesLabel">Associated Scripts & Files</div>
          <div id="modalSkillFilesList" style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
            <!-- Scripts and other files -->
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <label class="form-label" style="margin-bottom: 0;" data-i18n="skillMdLabel">SKILL.md (Instructions & YAML Frontmatter)</label>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Markdown • Auto-syncs to Claude, Codex, AGY, Grok</span>
          </div>
          <textarea id="modalSkillMdEditor" class="form-control" style="font-family: var(--font-mono); font-size: 0.82rem; height: 320px; line-height: 1.45; resize: vertical;" spellcheck="false"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalSkillDetail')" data-i18n="modalCancel">Cancel</button>
        <button id="btnSaveSkillMd" class="btn btn-primary" onclick="saveSkillDetail()" data-i18n="skillSaveBtn">Save & Sync</button>
      </div>
    </div>
  </div>

  <!-- Modal: Session Turns History -->
  <div id="modalSessionTurns" class="modal-backdrop">
    <div class="modal modal-xl">
      <div class="modal-header">
        <div>
          <div class="modal-title" data-i18n="modalSessionTurnsTitle">Session Dialogue History</div>
          <div id="modalSessionSubtitle" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; font-family: var(--font-mono);"></div>
        </div>
        <button class="modal-close" onclick="closeModal('modalSessionTurns')">×</button>
      </div>
      <div class="modal-body">
        <div id="modalSessionMetaBanner" class="card" style="margin-bottom: 0.2rem; padding: 0.75rem 1rem;"></div>
        <div id="sessionTurnsList" class="turns-container">
          <!-- Dynamically filled turns bubbles -->
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalSessionTurns')" data-i18n="modalCancel">Close</button>
      </div>
    </div>
  </div>

  <!-- Modal: New Session -->
  <div id="modalNewSession" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" data-i18n="modalNewSessionTitle">Create New Session</div>
        <button class="modal-close" onclick="closeModal('modalNewSession')">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Bot</label>
          <select id="newSessionBotSelect" class="form-control"></select>
        </div>
        <div class="form-group">
          <label class="form-label">Chat ID</label>
          <input id="newSessionChatId" type="text" class="form-control" placeholder="e.g. 1465542100 or -100...">
        </div>
        <div class="form-group">
          <label class="form-label">Engine (Optional)</label>
          <select id="newSessionEngine" class="form-control">
            <option value="">Default (Inherit bot default)</option>
            <option value="claude">Claude Code</option>
            <option value="codex">OpenAI Codex</option>
            <option value="agy">Google Antigravity (AGY)</option>
            <option value="grok">xAI Grok</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Model (Optional)</label>
          <input id="newSessionModel" type="text" class="form-control" placeholder="e.g. sonnet, gpt-5, gemini-2.5-flash">
        </div>
        <div class="form-group">
          <label class="form-label">Effort (Optional)</label>
          <input id="newSessionEffort" type="text" class="form-control" placeholder="e.g. low, medium, high, xhigh">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalNewSession')" data-i18n="modalCancel">Cancel</button>
        <button id="btnCreateSessionConfirm" class="btn btn-primary" data-i18n="modalConfirm">Create Session</button>
      </div>
    </div>
  </div>

  <!-- Modal: New / Edit Scheduled Task -->
  <div id="modalCron" class="modal-backdrop">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="cronModalTitle" data-i18n="cronModalNewTitle">New Scheduled Task</div>
        <button class="modal-close" onclick="closeModal('modalCron')">×</button>
      </div>
      <div class="modal-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 0.85rem;">
          <div class="form-group">
            <label class="form-label">Bot</label>
            <select id="cronBotSelect" class="form-control"></select>
          </div>
          <div class="form-group">
            <label class="form-label">Chat ID</label>
            <input id="cronChatId" type="text" class="form-control" list="cronChatOptions" placeholder="e.g. 1465542100 or -100...">
            <datalist id="cronChatOptions"></datalist>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="cronFieldName">Name</label>
          <input id="cronName" type="text" class="form-control" placeholder="AI news digest">
        </div>
        <div style="display: grid; grid-template-columns: 160px 1fr 1fr; gap: 0 0.85rem;">
          <div class="form-group">
            <label class="form-label" data-i18n="cronFieldKind">Repeat</label>
            <select id="cronKind" class="form-control">
              <option value="cron" data-i18n="cronKindCron">Recurring (cron)</option>
              <option value="at" data-i18n="cronKindAt">Once</option>
            </select>
          </div>
          <div class="form-group" id="cronExprGroup">
            <label class="form-label" data-i18n="cronFieldExpr">Cron Expression</label>
            <input id="cronExpr" type="text" class="form-control" style="font-family: var(--font-mono);" placeholder="0 9 * * 1-5">
          </div>
          <div class="form-group" id="cronTzGroup">
            <label class="form-label" data-i18n="cronFieldTz">Timezone</label>
            <input id="cronTz" type="text" class="form-control" placeholder="Asia/Shanghai">
          </div>
          <div class="form-group" id="cronAtGroup" style="display: none; grid-column: span 2;">
            <label class="form-label" id="cronAtLabel" data-i18n="cronFieldAt">Run At</label>
            <input id="cronAt" type="datetime-local" class="form-control">
          </div>
        </div>
        <div id="cronExprHint" class="card-desc" style="margin-top: -0.35rem; margin-bottom: 0.85rem;" data-i18n="cronExprHint">minute hour day-of-month month day-of-week, e.g. "0 9 * * 1-5" = weekdays at 09:00, "*/30 * * * *" = every 30 minutes</div>
        <div class="form-group">
          <label class="form-label" data-i18n="cronFieldPrompt">Prompt</label>
          <textarea id="cronPrompt" class="form-control" style="height: 150px; font-size: 0.85rem;" placeholder="Search the web for the most important AI news of the last 24 hours and write a concise digest."></textarea>
          <div class="card-desc" style="margin-top: 0.35rem;" data-i18n="cronPromptHint">Runs with no conversation history and nobody to answer questions, so make it self-contained. Reply [SILENT] to post nothing.</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0 0.85rem;">
          <div class="form-group">
            <label class="form-label">Engine</label>
            <select id="cronEngine" class="form-control">
              <option value="" data-i18n="cronInheritEngine">Bot Default</option>
              <option value="claude">Claude Code</option>
              <option value="codex">OpenAI Codex</option>
              <option value="agy">Antigravity</option>
              <option value="grok">xAI Grok</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Model</label>
            <input id="cronModel" type="text" class="form-control" placeholder="default">
          </div>
          <div class="form-group">
            <label class="form-label">Effort</label>
            <input id="cronEffort" type="text" class="form-control" placeholder="default">
          </div>
          <div class="form-group">
            <label class="form-label" data-i18n="cronFieldTimeout">Timeout (min)</label>
            <input id="cronTimeout" type="number" min="1" class="form-control" placeholder="30">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalCron')" data-i18n="modalCancel">Cancel</button>
        <button id="btnSaveCron" class="btn btn-primary" data-i18n="cronSave">Save Task</button>
      </div>
    </div>
  </div>

  <!-- Modal: Scheduled Task Run History -->
  <div id="modalCronRuns" class="modal-backdrop">
    <div class="modal modal-xl">
      <div class="modal-header">
        <div>
          <div class="modal-title" data-i18n="cronRunsTitle">Run History</div>
          <div id="cronRunsSubtitle" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;"></div>
        </div>
        <button class="modal-close" onclick="closeModal('modalCronRuns')">×</button>
      </div>
      <div class="modal-body" style="padding: 1rem;">
        <div class="cron-runs-browser">
          <div id="cronRunList" class="cron-run-list"></div>
          <div class="cron-run-detail">
            <div id="cronRunDetailHeader" class="cron-run-detail-header"></div>
            <div id="cronRunDetailBody" class="cron-run-detail-body"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalCronRuns')" data-i18n="cronClose">Close</button>
      </div>
    </div>
  </div>

  <!-- Modal: Background Job Log -->
  <div id="modalJobLog" class="modal-backdrop">
    <div class="modal modal-xl">
      <div class="modal-header">
        <div>
          <div class="modal-title" data-i18n="jobLogTitle">Job Log</div>
          <div id="jobLogSubtitle" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;"></div>
        </div>
        <button class="modal-close" onclick="closeJobLog()">×</button>
      </div>
      <div class="modal-body" style="padding: 1rem;">
        <div id="jobLogMeta" class="st-muted" style="font-size: 0.78rem; margin-bottom: 0.5rem;"></div>
        <pre id="jobLogContent" class="job-log"></pre>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeJobLog()" data-i18n="cronClose">Close</button>
      </div>
    </div>
  </div>

  <!-- Modal: Workspace Files & Preview -->
  <div id="modalWorkspaceFiles" class="modal-backdrop">
    <div class="modal modal-xl">
      <div class="modal-header">
        <div>
          <div class="modal-title" data-i18n="modalWorkspaceFilesTitle">Workspace Files & Preview</div>
          <div id="modalWorkspaceSubtitle" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; font-family: var(--font-mono);"></div>
        </div>
        <button class="modal-close" onclick="closeModal('modalWorkspaceFiles')">×</button>
      </div>
      <div class="modal-body" style="padding: 1rem;">
        <div class="ws-browser">
          <div class="ws-file-list-pane">
            <div style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">
              Files in Workspace
            </div>
            <div id="workspaceFileList" style="overflow-y: auto; flex: 1;">
              <!-- Dynamically populated files -->
            </div>
          </div>
          <div class="ws-file-preview-pane">
            <div class="ws-preview-header">
              <span id="wsPreviewFilename" style="font-weight: 600; font-family: var(--font-mono);"></span>
              <button id="btnCopyWsPreview" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" data-i18n="copyContent">Copy</button>
            </div>
            <pre id="wsPreviewContent" class="ws-preview-content" data-i18n="selectFilePrompt">← Click a file on the left to preview its content</pre>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modalWorkspaceFiles')" data-i18n="modalCancel">Close</button>
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
        tabSessions: "会话与工作区",
        tabYaml: "YAML 源码",
        tabCron: "定时任务",

        cronTitle: "定时任务",
        cronDesc: "网关按计划自动执行的 prompt，结果推送到对应聊天。每次运行都是全新会话，工作目录在多次运行之间保留。",
        cronNew: "+ 新建任务",
        cronMetricTotal: "任务总数",
        cronMetricEnabled: "已启用",
        cronMetricEnabledSub: "等待下一次运行",
        cronMetricRunning: "正在运行",
        cronMetricRunningSub: "无人值守的 CLI 运行",
        cronMetricAttention: "需要关注",
        cronMetricAttentionSub: "已暂停或上次运行失败",
        cronDefaultTz: "默认时区：{tz}",
        cronFilterEnabled: "已启用",
        cronFilterPaused: "已暂停",
        cronSearchPlaceholder: "搜索名称 / prompt / Chat ID...",
        cronEmpty: "还没有定时任务。在聊天里直接说“每天早上 8 点给我发 AI 早报”，或点击“新建任务”。",
        cronNoMatch: "没有符合条件的任务",
        cronStatusEnabled: "已启用",
        cronStatusPaused: "已暂停",
        cronStatusRunning: "运行中",
        cronRunNow: "立即运行",
        cronPause: "暂停",
        cronResume: "恢复",
        cronEdit: "编辑",
        cronHistory: "运行记录",
        cronWorkspace: "工作目录",
        cronSchedule: "计划",
        cronNextRun: "下次运行",
        cronLastRun: "上次运行",
        cronCreatedBy: "创建者",
        cronOnceAt: "单次：{time}",
        cronNever: "从未运行",
        cronPausedReason: "暂停原因：{reason}",
        cronLastError: "上次错误：{error}",
        cronResult_ok: "成功",
        cronResult_silent: "无需通知",
        cronResult_error: "失败",
        cronResult_timeout: "超时",
        cronResult_skipped: "跳过",
        cronTrigger_manual: "手动",
        cronTrigger_schedule: "定时",
        cronModalNewTitle: "新建定时任务",
        cronModalEditTitle: "编辑定时任务",
        cronFieldName: "名称",
        cronFieldKind: "重复",
        cronKindCron: "周期 (cron)",
        cronKindAt: "单次",
        cronFieldExpr: "Cron 表达式",
        cronFieldTz: "时区",
        cronFieldAt: "运行时间",
        cronFieldAtTz: "运行时间（{tz}）",
        cronFieldPrompt: "Prompt",
        cronFieldTimeout: "超时（分钟）",
        cronExprHint: "分 时 日 月 周，例如 「0 9 * * 1-5」= 工作日 09:00，「*/30 * * * *」= 每 30 分钟",
        cronPromptHint: "运行时没有对话历史，也没有人回答问题，请写成自包含的指令。输出 [SILENT] 则不推送。",
        cronSave: "保存任务",
        cronSavedToast: "定时任务已保存",
        cronDeletedToast: "定时任务已删除",
        cronStartedToast: "已开始运行，结果会推送到聊天",
        cronDeleteConfirm: "确定删除定时任务「{name}」吗？工作目录会保留。",
        cronRunsTitle: "运行记录",
        cronRunsEmpty: "暂无运行记录",
        cronMissingFields: "请填写 Bot、Chat ID、计划和 Prompt",
        cronInheritEngine: "机器人默认",
        cronDelete: "删除",
        cronClose: "关闭",
        cronCopy: "复制",
        cronCopied: "已复制到剪贴板",
        cronViewRaw: "查看原文",
        cronViewRendered: "查看排版",
        cronRunSilentNote: "本次运行判断没有需要通知的内容，未向聊天推送消息。",
        tabJobs: "后台任务",
        jobsTitle: "后台任务",
        jobsDesc: "AI 在对话中交给网关托管的长时间命令（大文件下载、训练、全量构建等）。命令在对话之外运行，群聊不会被占住；命令结束后网关把结果发回原会话，AI 接着处理。网关重启不影响正在运行的任务。",
        jobsMetricRunning: "运行中",
        jobsMetricRunningSub: "命令正在执行",
        jobsMetricQueued: "排队中",
        jobsMetricQueuedSub: "等待空闲名额",
        jobsMetricDone: "成功",
        jobsMetricDoneSub: "以退出码 0 结束",
        jobsMetricFailed: "失败 / 超时",
        jobsMetricFailedSub: "需要关注",
        jobsFilterActive: "进行中",
        jobsFilterFinished: "已结束",
        jobsFilterFailed: "失败",
        jobsSearchPlaceholder: "按标题、命令、Chat ID 搜索...",
        jobsEmpty: "还没有后台任务。当 AI 判断某条命令会运行很久（例如下载几十 GB 的数据），会把它交给网关在后台执行。",
        jobsNoMatch: "没有符合筛选条件的后台任务",
        jobStatus_queued: "排队中",
        jobStatus_running: "运行中",
        jobStatus_succeeded: "成功",
        jobStatus_failed: "失败",
        jobStatus_timeout: "超时",
        jobStatus_cancelled: "已停止",
        jobStatus_lost: "异常结束",
        jobCwd: "工作目录",
        jobThen: "完成后",
        jobRequester: "发起人",
        jobStarted: "开始时间",
        jobDuration: "耗时",
        jobExit: "退出码",
        jobCallback: "回调",
        jobCallback_pending: "等待回调",
        jobCallback_done: "已回调会话",
        jobCallback_skipped: "无需回调",
        jobCallback_failed: "回调失败",
        jobViewLog: "日志",
        jobStop: "停止",
        jobDelete: "删除",
        jobStopConfirm: "确定停止后台任务 #{num}「{title}」吗？进程及其子进程都会被终止，不会回调会话。",
        jobDeleteConfirm: "确定删除后台任务 #{num}「{title}」的记录和日志吗？",
        jobStoppedToast: "已发送停止信号",
        jobDeletedToast: "后台任务已删除",
        jobLogTitle: "任务日志",
        jobLogLive: "运行中 · 每 2 秒自动刷新",
        jobLogEmpty: "（暂无输出）",
        cronRunTruncatedNote: "这条是旧记录，只保存了输出的前 500 个字符。之后的运行会保存完整输出。",
        cronRunNoOutput: "本次运行没有输出。",
        
        sessionsTitle: "会话与工作区管理",
        sessionsDesc: "查看各机器人会话生命周期、多轮对话记录，以及 1:1 绑定的本地 CLI 物理工作区目录 (~/.pocketagent/workspaces)",
        metricTotalSessions: "总会话数",
        metricActiveSessions: "活跃会话",
        metricTotalTurns: "累计对话轮次",
        metricTotalDiskUsage: "工作区磁盘占用",

        filterAllBots: "所有机器人",
        filterAllStatus: "全部状态",
        filterActiveOnly: "仅活跃会话",
        filterInactiveOnly: "仅历史会话",
        filterOrphanedOnly: "仅孤立工作区",
        searchSessionsPlaceholder: "搜索会话 ID / Chat ID / 引擎 / 目录...",
        newSession: "+ 新建会话",
        refreshSessions: "↻ 刷新",

        noSessionsFound: "暂无符合条件的会话与工作区记录",
        sessionActive: "活跃中",
        sessionInactive: "历史会话",
        viewTurns: "💬 对话记录",
        exploreFiles: "📂 浏览文件",
        exploreWorkspace: "📂 工作区文件",
        workspaceReady: "物理目录就绪",
        workspaceNone: "未在磁盘创建",
        setActiveSession: "⚡ 设为活跃会话",
        deleteSessionConfirm: "确定要删除会话「{id}」及其本地工作区目录吗？此操作不可逆！",
        deleteSessionAndWorkspace: "同时删除该会话关联的本地工作区目录",
        
        orphanedSectionTitle: "孤立工作区目录 (未绑定已知会话)",
        orphanedSectionDesc: "本地物理目录存在但对应会话元数据已不存在的工作区，可在此浏览或彻底清理",
        noOrphanedFound: "未检测到孤立的工作区目录",
        workspaceActive: "活跃会话",
        workspaceHistory: "历史会话",
        workspaceOrphaned: "孤立工作区",
        deleteWorkspaceConfirm: "确定要物理删除工作区目录「{name}」吗？此操作不可逆！",

        modalSessionTurnsTitle: "会话对话记录",
        modalNewSessionTitle: "新建会话",
        modalWorkspaceFilesTitle: "工作区文件浏览与预览",
        selectFilePrompt: "← 从左侧列表中点击选择要预览的文件",
        copyContent: "复制内容",
        copiedToast: "已复制到剪贴板",
        sessionSwitchedToast: "已成功将会话切换为活跃状态",
        sessionCreatedToast: "已成功创建并激活新会话",
        sessionDeletedToast: "会话及工作区已删除",
        workspaceDeletedToast: "工作区目录已彻底清理",
        
        overviewTitle: "系统概览",
        overviewDesc: "PocketAgent 网关与多平台桥接器的实时运行状态",
        metricGatewayStatus: "网关状态",
        metricActiveBots: "已接入机器人",
        metricDefaultEngine: "全局默认引擎",
        metricSkillsCount: "4-CLI 共享技能",
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
        confirmDeleteBot: "确认删除机器人「{name}」吗？",
        botAddedToast: "已添加机器人「{name}」，点击「保存并热更新」生效。",
        botDeletedToast: "已移除机器人，点击「保存并热更新」生效。",

        enginesTitle: "模型引擎设置",
        enginesDesc: "配置 Claude Code、OpenAI Codex、Google Antigravity (AGY) 与 xAI Grok 执行引擎",
        defaultEngineCard: "全局默认执行引擎",
        defaultEngineCardDesc: "所有未单独指定引擎的机器人会话将默认使用此引擎处理任务",
        concurrencySettings: "并发与超时控制",
        concurrencyDesc: "控制 CLI 引擎的最大进程数与空闲释放时间",
        maxProcesses: "最大并发进程数",
        idleTimeoutMs: "进程空闲超时 (毫秒)",
        claudeEngine: "Claude Code 引擎 (Anthropic)",
        codexEngine: "OpenAI Codex 引擎 (OpenAI)",
        agyEngine: "Google Antigravity 引擎 (DeepMind)",
        grokEngine: "xAI Grok 引擎 (xAI)",
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
        
        skillsTitle: "4-CLI 技能中心",
        skillsDesc: "统一技能库 (~/.pocketagent/skills/) 已物理软链至 Claude、Codex、AGY 与 Grok 客户端",
        syncSkills: "↻ 全网同步技能",
        newSkill: "+ 新建技能",
        noSkillsFound: "未检测到自定义技能，点击上方「新建技能」快速创建。",
        viewAndEditSkill: "✎ 查看 / 编辑",
        deleteSkillPrompt: "确定要永久删除技能「{name}」吗？此操作将同时清理 Claude、Codex、AGY 与 Grok 中的对应软链！",
        skillDeletedToast: "技能「{name}」已彻底删除并清理镜像",
        skillUpdatedToast: "技能「{name}」已保存并同步至 4-CLI",
        modalSkillDetailTitle: "技能详情与编辑",
        skillMdLabel: "SKILL.md (指令规范与 Prompt 描述)",
        skillSaveBtn: "保存并全网同步",
        skillFilesLabel: "关联脚本与文件",
        noScripts: "无独立脚本",
        
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
        tabSkills: "Skills (4-CLI)",
        tabSessions: "Sessions & Workspaces",
        tabYaml: "Raw YAML",
        
        sessionsTitle: "Sessions & Workspaces Management",
        sessionsDesc: "Inspect multi-turn dialogue histories, switch active sessions, and oversee 1-to-1 bound CLI execution workspaces (~/.pocketagent/workspaces)",
        metricTotalSessions: "Total Sessions",
        metricActiveSessions: "Active Sessions",
        metricTotalTurns: "Total Dialogue Turns",
        metricTotalDiskUsage: "Workspace Storage",

        filterAllBots: "All Bots",
        filterAllStatus: "All Status",
        filterActiveOnly: "Active Only",
        filterInactiveOnly: "Historical Only",
        filterOrphanedOnly: "Orphaned Only",
        searchSessionsPlaceholder: "Search Session ID / Chat ID / Engine / Folder...",
        newSession: "+ New Session",
        refreshSessions: "↻ Refresh",

        noSessionsFound: "No sessions or workspaces found matching filters",
        sessionActive: "Active",
        sessionInactive: "Historical",
        viewTurns: "💬 Dialogue History",
        exploreFiles: "📂 Explore Files",
        exploreWorkspace: "📂 Workspace Files",
        workspaceReady: "Ready on disk",
        workspaceNone: "Not created yet",
        setActiveSession: "⚡ Set Active",
        deleteSessionConfirm: "Are you sure you want to delete session '{id}' and its workspace? This cannot be undone.",
        deleteSessionAndWorkspace: "Also delete associated local workspace directory",

        orphanedSectionTitle: "Orphaned Workspace Folders (Unlinked to active chats)",
        orphanedSectionDesc: "Physical folders on disk whose session records no longer exist; safe to inspect or clean up",
        noOrphanedFound: "No orphaned workspace folders found",
        workspaceActive: "Active Session",
        workspaceHistory: "Historical Session",
        workspaceOrphaned: "Orphaned Folder",
        deleteWorkspaceConfirm: "Are you sure you want to delete workspace '{name}'? This cannot be undone.",

        modalSessionTurnsTitle: "Session Dialogue History",
        modalNewSessionTitle: "Create New Session",
        modalWorkspaceFilesTitle: "Workspace Files & Preview",
        selectFilePrompt: "← Click a file on the left to preview its content",
        copyContent: "Copy Content",
        copiedToast: "Copied to clipboard",
        sessionSwitchedToast: "Switched to active session",
        sessionCreatedToast: "Created and activated new session",
        sessionDeletedToast: "Session and workspace deleted",
        workspaceDeletedToast: "Workspace directory cleaned up",
        
        overviewTitle: "System Overview",
        overviewDesc: "Real-time metrics and operational health of PocketAgent Gateway",
        metricGatewayStatus: "Gateway Status",
        metricActiveBots: "Active Bots",
        metricDefaultEngine: "Default Engine",
        metricSkillsCount: "4-CLI Skills",
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
        confirmDeleteBot: "Delete bot '{name}'?",
        botAddedToast: "Added bot '{name}', click 'Save & Hot Reload' to apply.",
        botDeletedToast: "Bot removed, click 'Save & Hot Reload' to apply.",

        enginesTitle: "Engines Configuration",
        enginesDesc: "Configure Claude Code, OpenAI Codex, Google Antigravity (AGY), and xAI Grok backends",
        defaultEngineCard: "Default Execution Engine",
        defaultEngineCardDesc: "Engine used for all sessions unless overridden by a bot or /engine command",
        concurrencySettings: "Concurrency & Timeouts",
        concurrencyDesc: "Process limits and idle lifecycle across all engine adapters",
        maxProcesses: "Max Concurrent Processes",
        idleTimeoutMs: "Idle Process Timeout (ms)",
        claudeEngine: "Claude Code Engine",
        codexEngine: "OpenAI Codex Engine",
        agyEngine: "Google Antigravity (AGY) Engine",
        grokEngine: "xAI Grok Engine",
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
        
        skillsTitle: "Skills (4-CLI Mesh)",
        skillsDesc: "Unified hub at ~/.pocketagent/skills/ mirrored to Claude Code, Codex, AGY, and Grok",
        syncSkills: "↻ Sync All Skills",
        newSkill: "+ New Skill",
        noSkillsFound: "No custom skills found. Click 'New Skill' to create one.",
        viewAndEditSkill: "✎ View / Edit",
        deleteSkillPrompt: "Are you sure you want to delete skill '{name}'? This will also remove symlinks in Claude, Codex, AGY, and Grok!",
        skillDeletedToast: "Skill '{name}' deleted and unlinked",
        skillUpdatedToast: "Skill '{name}' saved and synced to 4-CLI",
        modalSkillDetailTitle: "Skill Details & Editor",
        skillMdLabel: "SKILL.md (Instructions & YAML Frontmatter)",
        skillSaveBtn: "Save & Sync to All",
        skillFilesLabel: "Associated Scripts & Files",
        noScripts: "No standalone scripts",
        
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

        tabCron: "Scheduled Tasks",
        cronTitle: "Scheduled Tasks",
        cronDesc: "Prompts the gateway runs automatically on a schedule, posting each result to its chat. Each run starts a fresh session with its own persistent working directory.",
        cronNew: "+ New Task",
        cronMetricTotal: "Total Tasks",
        cronMetricEnabled: "Enabled",
        cronMetricEnabledSub: "Waiting for their next run",
        cronMetricRunning: "Running Now",
        cronMetricRunningSub: "Unattended CLI runs in progress",
        cronMetricAttention: "Needs Attention",
        cronMetricAttentionSub: "Paused or last run failed",
        cronDefaultTz: "Default timezone: {tz}",
        cronFilterEnabled: "Enabled",
        cronFilterPaused: "Paused",
        cronSearchPlaceholder: "Search by name, prompt, Chat ID...",
        cronEmpty: "No scheduled tasks yet. Ask in chat, e.g. “every day at 8am send me an AI news digest”, or click New Task.",
        cronNoMatch: "No tasks match the filters",
        cronStatusEnabled: "Enabled",
        cronStatusPaused: "Paused",
        cronStatusRunning: "Running",
        cronRunNow: "Run Now",
        cronPause: "Pause",
        cronResume: "Resume",
        cronEdit: "Edit",
        cronHistory: "History",
        cronWorkspace: "Workspace",
        cronSchedule: "Schedule",
        cronNextRun: "Next Run",
        cronLastRun: "Last Run",
        cronCreatedBy: "Created By",
        cronOnceAt: "Once at {time}",
        cronNever: "Never run",
        cronPausedReason: "Paused: {reason}",
        cronLastError: "Last error: {error}",
        cronResult_ok: "Succeeded",
        cronResult_silent: "Nothing to report",
        cronResult_error: "Failed",
        cronResult_timeout: "Timed out",
        cronResult_skipped: "Skipped",
        cronTrigger_manual: "manual",
        cronTrigger_schedule: "scheduled",
        cronModalNewTitle: "New Scheduled Task",
        cronModalEditTitle: "Edit Scheduled Task",
        cronFieldName: "Name",
        cronFieldKind: "Repeat",
        cronKindCron: "Recurring (cron)",
        cronKindAt: "Once",
        cronFieldExpr: "Cron Expression",
        cronFieldTz: "Timezone",
        cronFieldAt: "Run At",
        cronFieldAtTz: "Run At ({tz})",
        cronFieldPrompt: "Prompt",
        cronFieldTimeout: "Timeout (min)",
        cronExprHint: "minute hour day-of-month month day-of-week, e.g. '0 9 * * 1-5' = weekdays at 09:00, '*/30 * * * *' = every 30 minutes",
        cronPromptHint: "Runs with no conversation history and nobody to answer questions, so make it self-contained. Reply [SILENT] to post nothing.",
        cronSave: "Save Task",
        cronSavedToast: "Scheduled task saved",
        cronDeletedToast: "Scheduled task deleted",
        cronStartedToast: "Started, the result will be posted to the chat",
        cronDeleteConfirm: "Delete scheduled task “{name}”? Its workspace folder is kept.",
        cronRunsTitle: "Run History",
        cronRunsEmpty: "No runs yet",
        cronMissingFields: "Please fill in bot, chat ID, schedule and prompt",
        cronInheritEngine: "Bot Default",
        cronDelete: "Delete",
        cronClose: "Close",
        cronCopy: "Copy",
        cronCopied: "Copied to clipboard",
        cronViewRaw: "View Source",
        cronViewRendered: "View Formatted",
        cronRunSilentNote: "This run found nothing worth reporting, so nothing was posted to the chat.",
        tabJobs: "Background Jobs",
        jobsTitle: "Background Jobs",
        jobsDesc: "Long-running commands the agent handed to the gateway (big downloads, training runs, full builds). They run outside the chat so it is not held up; when one exits, the gateway sends the result back to the conversation that started it and the agent continues. Jobs keep running across gateway restarts.",
        jobsMetricRunning: "Running",
        jobsMetricRunningSub: "Commands executing now",
        jobsMetricQueued: "Queued",
        jobsMetricQueuedSub: "Waiting for a free slot",
        jobsMetricDone: "Succeeded",
        jobsMetricDoneSub: "Finished with exit code 0",
        jobsMetricFailed: "Failed / Timed Out",
        jobsMetricFailedSub: "Worth a look",
        jobsFilterActive: "In Progress",
        jobsFilterFinished: "Finished",
        jobsFilterFailed: "Failed",
        jobsSearchPlaceholder: "Search by title, command, Chat ID...",
        jobsEmpty: "No background jobs yet. When the agent expects a command to run for a long time (say, downloading tens of GB), it hands the command to the gateway to run in the background.",
        jobsNoMatch: "No background jobs match the filters",
        jobStatus_queued: "Queued",
        jobStatus_running: "Running",
        jobStatus_succeeded: "Succeeded",
        jobStatus_failed: "Failed",
        jobStatus_timeout: "Timed out",
        jobStatus_cancelled: "Stopped",
        jobStatus_lost: "Ended unexpectedly",
        jobCwd: "Working Dir",
        jobThen: "Then",
        jobRequester: "Requested By",
        jobStarted: "Started",
        jobDuration: "Duration",
        jobExit: "Exit Code",
        jobCallback: "Callback",
        jobCallback_pending: "Pending",
        jobCallback_done: "Sent to conversation",
        jobCallback_skipped: "Not needed",
        jobCallback_failed: "Failed",
        jobViewLog: "Log",
        jobStop: "Stop",
        jobDelete: "Delete",
        jobStopConfirm: "Stop background job #{num} “{title}”? The process and everything it started will be terminated; the conversation is not called back.",
        jobDeleteConfirm: "Delete the record and log of background job #{num} “{title}”?",
        jobStoppedToast: "Stop signal sent",
        jobDeletedToast: "Background job deleted",
        jobLogTitle: "Job Log",
        jobLogLive: "Running · refreshes every 2 seconds",
        jobLogEmpty: "(no output yet)",
        cronRunTruncatedNote: "This is an older record that only kept the first 500 characters of output. New runs keep the full output.",
        cronRunNoOutput: "This run produced no output.",
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
    let allSkills = [];
    let activeSkillName = null;
    let allSessions = [];
    let allWorkspaces = [];
    let activeWsPath = "";
    let activeWsFilePath = "";
    let allCronJobs = [];
    let cronTimezone = "";
    let editingCronId = null;
    let cronRuns = [];
    let selectedCronRun = 0;
    let cronRunRaw = false;

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
    }

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
      document.getElementById("langZh")?.classList.toggle("active", lang === "zh");
      document.getElementById("langEn")?.classList.toggle("active", lang === "en");
      updateDomI18n();
      if (currentConfig) {
        renderBotsManager(currentConfig.bots || []);
      }
      if (systemStatus) {
        renderOverviewBots(systemStatus.bots || []);
      }
      renderOverviewEngines();
      if (allSkills && allSkills.length > 0) {
        renderSkills(allSkills);
      }
      renderSessions();
      populateCronBotFilter();
      renderCronJobs();
    }

    function renderWorkspaces() {
      // Alias for unified sessions and workspaces
      renderSessions();
    }

    function setTheme(theme) {
      currentTheme = theme;
      localStorage.setItem("pa_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      document.getElementById("themeLight")?.classList.toggle("active", theme === "light");
      document.getElementById("themeDark")?.classList.toggle("active", theme === "dark");
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
      } else if (tabId === "sessions" || tabId === "workspaces") {
        fetchSessions();
      } else if (tabId === "cron") {
        fetchCronJobs();
      } else if (tabId === "jobs") {
        fetchJobs();
      }
    }

    // Keyboard shortcuts & backdrop listeners
    function setupKeyboardShortcuts() {
      window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
          e.preventDefault();
          saveAndHotReload();
        }
        if (e.key === "Escape") {
          document.querySelectorAll(".modal-backdrop.show").forEach(m => m.classList.remove("show"));
        }
      });
      document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
        backdrop.addEventListener("click", (e) => {
          if (e.target === backdrop) backdrop.classList.remove("show");
        });
      });
    }

    // Initialize
    async function init() {
      try {
        setTheme(currentTheme);
        setupTabNavigation();
        setupKeyboardShortcuts();
        setupEvents();
        setLanguage(currentLang);

        await Promise.all([
          fetchStatus(),
          fetchConfig(),
          fetchModels(),
          fetchSkills(),
          fetchPairings(),
          fetchSessions(),
          fetchCronJobs(),
          fetchJobs()
        ]);

        // Keep run status fresh while the scheduled tasks tab is open
        setInterval(() => {
          if (!document.hidden && document.getElementById("tab-cron")?.classList.contains("active")) {
            fetchCronJobs();
          }
        }, 10000);

        // Background jobs change by the second (progress, elapsed time)
        setInterval(() => {
          if (!document.hidden && document.getElementById("tab-jobs")?.classList.contains("active")) {
            fetchJobs();
          }
        }, 3000);
      } catch (err) {
        console.error("Dashboard initialization error:", err);
      }
    }

    function setupEvents() {
      const on = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
      };

      on("btnRefresh", "click", async () => {
        showToast(t("refresh") + "...", "info");
        await Promise.all([fetchStatus(), fetchConfig(), fetchModels(true), fetchSkills(), fetchPairings(), fetchSessions(), fetchCronJobs(), fetchJobs()]);
      });

      on("btnSaveConfig", "click", () => saveAndHotReload());
      on("btnApplyYaml", "click", () => applyYaml());
      on("btnAddBot", "click", () => openAddBotModal());
      on("btnSaveModalBot", "click", () => saveModalBot());
      on("btnSaveSoul", "click", () => saveSoul());
      on("btnSyncSkills", "click", () => syncSkills());
      on("btnNewSkill", "click", () => openModal("modalNewSkill"));
      on("btnCreateSkillConfirm", "click", () => createSkill());
      on("btnRefreshSessions", "click", () => fetchSessions());
      on("btnNewSession", "click", () => openNewSessionModal());
      on("btnCreateSessionConfirm", "click", () => confirmCreateSession());
      on("btnSaveSkillMd", "click", () => saveSkillDetail());
      
      on("sessionsBotFilter", "change", () => renderSessions());
      on("sessionsStatusFilter", "change", () => renderSessions());
      on("sessionsSearchInput", "input", () => renderSessions());
      
      on("btnCopyWsPreview", "click", () => copyWsPreview());

      on("btnRefreshCron", "click", () => fetchCronJobs());
      on("btnNewCron", "click", () => openCronModal());
      on("btnSaveCron", "click", () => saveCronJob());
      on("cronBotFilter", "change", () => renderCronJobs());
      on("cronStatusFilter", "change", () => renderCronJobs());
      on("cronSearchInput", "input", () => renderCronJobs());
      on("btnRefreshJobs", "click", () => fetchJobs());
      on("jobsBotFilter", "change", () => renderJobs());
      on("jobsStatusFilter", "change", () => renderJobs());
      on("jobsSearchInput", "input", () => renderJobs());
      on("cronKind", "change", () => updateCronKindFields());
      on("cronBotSelect", "change", () => updateCronChatOptions());
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

      if (cfg.engines?.grok) {
        document.getElementById("cfgGrokBinary").value = cfg.engines.grok.binary || "grok";
        document.getElementById("cfgGrokEffort").value = cfg.engines.grok.effort || "";
        document.getElementById("cfgGrokExtraArgs").value = (cfg.engines.grok.extraArgs || []).join(", ");
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
        populateModelSelect("cfgGrokModel", capabilities.grok?.models || [], currentConfig?.engines?.grok?.model);

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
        { id: "grok", name: "xAI Grok", cap: capabilities.grok },
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
                  <option value="grok" \${bot.engine === 'grok' ? 'selected' : ''}>xAI Grok</option>
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
        allSkills = data.skills || [];
        const mCount = document.getElementById("mSkillsCount");
        if (mCount) mCount.textContent = allSkills.length;
        renderSkills(allSkills);
      } catch (err) {
        console.error("fetchSkills error:", err);
      }
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
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <span class="skill-name">\${escapeHtml(s.name)}</span>
              <div class="sync-tags">
                <span class="sync-tag \${s.synced?.claude ? 'sync-on' : 'sync-off'}">\${s.synced?.claude ? 'Claude' : '!Claude'}</span>
                <span class="sync-tag \${s.synced?.codex ? 'sync-on' : 'sync-off'}">\${s.synced?.codex ? 'Codex' : '!Codex'}</span>
                <span class="sync-tag \${s.synced?.agy ? 'sync-on' : 'sync-off'}">\${s.synced?.agy ? 'AGY' : '!AGY'}</span>
                <span class="sync-tag \${s.synced?.grok ? 'sync-on' : 'sync-off'}">\${s.synced?.grok ? 'Grok' : '!Grok'}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <button class="btn btn-secondary btn-sm" onclick="openSkillDetail('\${escapeHtml(s.name)}')">
                \${t("viewAndEditSkill")}
              </button>
              <button class="btn btn-secondary btn-sm" style="color: var(--badge-red-text);" title="Delete" onclick="deleteSkillConfirm('\${escapeHtml(s.name)}')">
                ✕
              </button>
            </div>
          </div>
          <p class="skill-desc">\${escapeHtml(s.description || 'No description provided')}</p>
          <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
            <span>Scripts: \${s.scripts?.length ? escapeHtml(s.scripts.join(', ')) : t("noScripts")}</span>
            <span style="font-family: var(--font-mono); font-size: 0.7rem;">~/.pocketagent/skills/\${escapeHtml(s.name)}</span>
          </div>
        </div>
      \`).join("");
    }

    async function openSkillDetail(name) {
      activeSkillName = name;
      document.getElementById("modalSkillSubtitle").textContent = "Loading...";
      document.getElementById("modalSkillMdEditor").value = "Loading...";

      try {
        const res = await fetch(\`/api/skills/detail?name=\${encodeURIComponent(name)}\`);
        if (!res.ok) throw new Error("Failed to load skill details");
        const data = await res.json();
        const s = data.skill || {};
        const skillMd = data.skillMd || "";
        const files = data.files || [];

        document.getElementById("modalSkillSubtitle").textContent = s.dir || \`~/.pocketagent/skills/\${name}\`;
        document.getElementById("modalSkillMdEditor").value = skillMd;

        document.getElementById("modalSkillSyncBanner").innerHTML = \`
          <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
            <span style="font-weight: 600; font-size: 0.95rem;">\${escapeHtml(s.name)}</span>
            <div class="sync-tags">
              <span class="sync-tag \${s.synced?.claude ? 'sync-on' : 'sync-off'}">\${s.synced?.claude ? '✓ Claude' : '✗ Claude'}</span>
              <span class="sync-tag \${s.synced?.codex ? 'sync-on' : 'sync-off'}">\${s.synced?.codex ? '✓ Codex' : '✗ Codex'}</span>
              <span class="sync-tag \${s.synced?.agy ? 'sync-on' : 'sync-off'}">\${s.synced?.agy ? '✓ AGY' : '✗ AGY'}</span>
              <span class="sync-tag \${s.synced?.grok ? 'sync-on' : 'sync-off'}">\${s.synced?.grok ? '✓ Grok' : '✗ Grok'}</span>
            </div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            \${files.length} files • \${s.scripts?.length || 0} scripts
          </div>
        \`;

        const filesContainer = document.getElementById("modalSkillFilesList");
        if (files.length === 0) {
          filesContainer.innerHTML = \`<span style="font-size: 0.75rem; color: var(--text-muted);">(No files)</span>\`;
        } else {
          filesContainer.innerHTML = files.map(f => {
            const icon = f.isDir ? "📁" : (f.name.endsWith(".py") ? "🐍" : (f.name.endsWith(".md") ? "📝" : "📄"));
            return \`
              <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.75rem; font-family: var(--font-mono);">
                <span>\${icon}</span>
                <span>\${escapeHtml(f.relPath)}</span>
                \${!f.isDir ? \`<span style="color: var(--text-muted); font-size: 0.7rem;">(\${formatBytes(f.size)})</span>\` : ''}
              </span>
            \`;
          }).join("");
        }

        openModal("modalSkillDetail");
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function saveSkillDetail() {
      if (!activeSkillName) return;
      const skillMd = document.getElementById("modalSkillMdEditor").value;
      const btn = document.getElementById("btnSaveSkillMd");
      btn.textContent = t("saving");
      btn.disabled = true;

      try {
        const res = await fetch("/api/skills/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: activeSkillName, skillMd })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(t("skillUpdatedToast", { name: activeSkillName }), "success");
          closeModal("modalSkillDetail");
          fetchSkills();
        } else {
          showToast(data.error || "Failed to update skill", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.textContent = t("skillSaveBtn");
        btn.disabled = false;
      }
    }

    async function deleteSkillConfirm(name) {
      const ok = confirm(t("deleteSkillPrompt", { name }));
      if (!ok) return;

      try {
        const res = await fetch(\`/api/skills?name=\${encodeURIComponent(name)}\`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.ok) {
          showToast(t("skillDeletedToast", { name }), "success");
          fetchSkills();
        } else {
          showToast(data.error || "Failed to delete skill", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      }
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

    function populateBotFilters() {
      const bots = systemStatus?.bots || currentConfig?.bots || [];
      const sessionSelect = document.getElementById("sessionsBotFilter");
      const wsSelect = document.getElementById("workspacesBotFilter");
      const newSessionSelect = document.getElementById("newSessionBotSelect");

      if (!sessionSelect) return;

      const currSessionVal = sessionSelect.value;
      const currWsVal = wsSelect ? wsSelect.value : "";

      let optionsHtml = \`<option value="">\${t("filterAllBots")}</option>\`;
      let newSessionOpts = "";

      for (const b of bots) {
        const name = escapeHtml(b.name);
        const id = escapeHtml(b.botId || b.name);
        const ch = escapeHtml(b.channel || "bot");
        optionsHtml += \`<option value="\${id}">\${name} (\${ch})</option>\`;
        newSessionOpts += \`<option value="\${id}">\${name} (\${ch})</option>\`;
      }

      sessionSelect.innerHTML = optionsHtml;
      if (wsSelect) wsSelect.innerHTML = optionsHtml;
      if (newSessionSelect) newSessionSelect.innerHTML = newSessionOpts;

      sessionSelect.value = currSessionVal;
      if (wsSelect) wsSelect.value = currWsVal;
    }

    async function fetchSessions() {
      try {
        const [sRes, wRes] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/workspaces")
        ]);
        if (sRes.ok) {
          const sData = await sRes.json();
          allSessions = sData.sessions || [];
        }
        if (wRes.ok) {
          const wData = await wRes.json();
          allWorkspaces = wData.workspaces || [];
        }
        updateSessionMetrics();
        populateBotFilters();
        renderSessions();
      } catch (err) {
        // silent fallback
      }
    }

    function updateSessionMetrics() {
      const total = allSessions.length;
      const active = allSessions.filter(s => s.isActive).length;
      const totalTurns = allSessions.reduce((sum, s) => sum + (s.turnCount || 0), 0);
      const totalBytes = (allWorkspaces && allWorkspaces.length > 0)
        ? allWorkspaces.reduce((sum, w) => sum + (w.sizeBytes || 0), 0)
        : allSessions.reduce((sum, s) => sum + (s.workspaceSizeBytes || 0), 0);
      const mTot = document.getElementById("mTotalSessions");
      const mAct = document.getElementById("mActiveSessions");
      const mTur = document.getElementById("mTotalTurns");
      const mDsk = document.getElementById("mTotalDiskUsage");
      if (mTot) mTot.textContent = total;
      if (mAct) mAct.textContent = active;
      if (mTur) mTur.textContent = totalTurns;
      if (mDsk) mDsk.textContent = formatBytes(totalBytes);
    }

    function renderSessions() {
      const container = document.getElementById("sessionsListContainer");
      if (!container) return;

      const botFilter = document.getElementById("sessionsBotFilter") ? document.getElementById("sessionsBotFilter").value : "";
      const statusFilter = document.getElementById("sessionsStatusFilter") ? document.getElementById("sessionsStatusFilter").value : "all";
      const searchInput = document.getElementById("sessionsSearchInput");
      const search = searchInput ? (searchInput.value || "").trim().toLowerCase() : "";

      let filtered = allSessions;
      if (botFilter) {
        filtered = filtered.filter(s => s.botId === botFilter);
      }
      if (statusFilter === "active") {
        filtered = filtered.filter(s => s.isActive);
      } else if (statusFilter === "inactive") {
        filtered = filtered.filter(s => !s.isActive);
      } else if (statusFilter === "orphaned") {
        filtered = [];
      }
      if (search) {
        filtered = filtered.filter(s =>
          (s.chatId && s.chatId.toLowerCase().includes(search)) ||
          (s.sessionId && s.sessionId.toLowerCase().includes(search)) ||
          (s.activeEngine && s.activeEngine.toLowerCase().includes(search)) ||
          (s.title && s.title.toLowerCase().includes(search)) ||
          (s.botName && s.botName.toLowerCase().includes(search)) ||
          (s.workspacePath && s.workspacePath.toLowerCase().includes(search))
        );
      }

      // Filter orphaned workspaces
      let orphaned = (allWorkspaces || []).filter(w => !w.isKnownSession);
      if (botFilter) {
        orphaned = orphaned.filter(w => w.botId === botFilter);
      }
      if (search) {
        orphaned = orphaned.filter(w =>
          (w.folderName && w.folderName.toLowerCase().includes(search)) ||
          (w.chatId && w.chatId.toLowerCase().includes(search)) ||
          (w.sessionId && w.sessionId.toLowerCase().includes(search)) ||
          (w.path && w.path.toLowerCase().includes(search)) ||
          (w.botName && w.botName.toLowerCase().includes(search))
        );
      }

      if (statusFilter !== "orphaned") {
        if (filtered.length === 0) {
          container.innerHTML = \`
            <div class="card" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
              <div style="font-size: 1.05rem; font-weight: 500; margin-bottom: 0.25rem;">\${t("noSessionsFound")}</div>
            </div>
          \`;
        } else {
          let html = "";
          for (const s of filtered) {
            const isActive = s.isActive;
            const channelBadgeClass = s.channelType === "telegram" ? "channel-tg" : "channel-dc";
            const channelName = s.channelType ? s.channelType.toUpperCase() : "BOT";
            const dateStr = s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : "--";
            const fileCount = s.workspaceFileCount || 0;
            const sizeStr = formatBytes(s.workspaceSizeBytes || 0);

            html += \`
              <div class="session-card \${isActive ? 'is-active' : ''}">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem;">
                  <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <span class="channel-badge \${channelBadgeClass}">\${channelName}</span>
                    <span class="badge-status \${isActive ? 'badge-active' : 'badge-inactive'}">
                      \${isActive ? '● ' + t("sessionActive") : '○ ' + t("sessionInactive")}
                    </span>
                    <span class="badge-engine">\${escapeHtml(s.activeEngine || "claude")}</span>
                    <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">
                      \${escapeHtml(s.botName || s.botId)}
                    </span>
                    <span style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">
                      #\${s.sessionNum || 1}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <button class="btn btn-secondary btn-sm" onclick="openSessionTurns('\${escapeHtml(s.botId)}', '\${escapeHtml(s.chatId)}', '\${escapeHtml(s.sessionId)}')">
                      \${t("viewTurns")} (\${s.turnCount || 0})
                    </button>
                    \${s.workspaceExists ? \`
                      <button class="btn btn-secondary btn-sm" onclick="openWorkspaceFiles('\${escapeHtml(s.workspacePath)}')">
                        \${t("exploreWorkspace")} (\${fileCount})
                      </button>
                    \` : \`
                      <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.5; cursor: not-allowed;">
                        \${t("exploreWorkspace")} (0)
                      </button>
                    \`}
                    \${!isActive ? \`
                      <button class="btn btn-secondary btn-sm" onclick="switchSessionActive('\${escapeHtml(s.botId)}', '\${escapeHtml(s.chatId)}', '\${escapeHtml(s.sessionId)}')">
                        \${t("setActiveSession")}
                      </button>
                    \` : ''}
                    <button class="btn btn-secondary btn-sm" style="color: var(--badge-red-text);" title="Delete" onclick="deleteSessionPrompt('\${escapeHtml(s.botId)}', '\${escapeHtml(s.chatId)}', '\${escapeHtml(s.sessionId)}')">
                      ✕
                    </button>
                  </div>
                </div>

                <div class="card-meta-grid">
                  <div class="meta-item">
                    <span class="meta-label">Chat ID</span>
                    <span class="meta-val" style="font-family: var(--font-mono);">\${escapeHtml(s.chatId)}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Session ID</span>
                    <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.75rem;" title="\${escapeHtml(s.sessionId)}">
                      \${escapeHtml(s.sessionId ? s.sessionId.slice(0, 18) + '...' : '--')}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Model & Effort</span>
                    <span class="meta-val">\${escapeHtml(s.model || "default")} \${s.effort ? '(' + escapeHtml(s.effort) + ')' : ''}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Workspace & Storage</span>
                    <span class="meta-val">
                      \${s.workspaceExists ? \`
                        <span style="color: var(--badge-green-text); cursor: pointer;" onclick="openWorkspaceFiles('\${escapeHtml(s.workspacePath)}')">
                          📁 \${fileCount} files • \${sizeStr}
                        </span>
                      \` : \`<span style="color: var(--text-muted);">📁 \${t("workspaceNone")}</span>\`}
                    </span>
                  </div>
                  <div class="meta-item" style="grid-column: 1 / -1;">
                    <span class="meta-label">Workspace Path</span>
                    <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.73rem; color: var(--text-muted); word-break: break-all;">
                      \${escapeHtml(s.workspacePath || '--')}
                    </span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Last Active</span>
                    <span class="meta-val" style="font-size: 0.76rem; color: var(--text-secondary);">\${dateStr}</span>
                  </div>
                </div>
              </div>
            \`;
          }
          container.innerHTML = html;
        }
      } else {
        container.innerHTML = "";
      }

      // Render orphaned workspaces
      const orphanSection = document.getElementById("orphanedWorkspacesSection");
      const orphanContainer = document.getElementById("orphanedListContainer");
      if (orphanSection && orphanContainer) {
        if (statusFilter === "active" || statusFilter === "inactive") {
          orphanSection.style.display = "none";
        } else if (statusFilter === "orphaned") {
          orphanSection.style.display = "block";
          if (orphaned.length === 0) {
            orphanContainer.innerHTML = \`
              <div class="card" style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
                \${t("noOrphanedFound")}
              </div>
            \`;
          } else {
            renderOrphanCards(orphaned, orphanContainer);
          }
        } else {
          // "all"
          if (orphaned.length > 0) {
            orphanSection.style.display = "block";
            renderOrphanCards(orphaned, orphanContainer);
          } else {
            orphanSection.style.display = "none";
          }
        }
      }
    }

    function renderOrphanCards(orphans, container) {
      let html = "";
      for (const w of orphans) {
        const dateStr = w.mtime ? new Date(w.mtime).toLocaleString() : "--";
        html += \`
          <div class="workspace-card" style="border-left: 3px solid var(--badge-amber-text); margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span style="font-size: 1.1rem;">📁</span>
                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); font-family: var(--font-mono);">
                  \${escapeHtml(w.folderName)}
                </span>
                <span class="badge-status badge-orphaned">▲ \${t("workspaceOrphaned")}</span>
                \${w.botName ? \`<span style="font-size: 0.8rem; color: var(--text-secondary);">(\${escapeHtml(w.botName)})</span>\` : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <button class="btn btn-secondary btn-sm" onclick="openWorkspaceFiles('\${escapeHtml(w.path)}')">
                  \${t("exploreFiles")} (\${w.fileCount})
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--badge-red-text);" onclick="deleteWorkspaceConfirm('\${escapeHtml(w.path)}', '\${escapeHtml(w.folderName)}')">
                  ✕
                </button>
              </div>
            </div>

            <div class="card-meta-grid">
              <div class="meta-item">
                <span class="meta-label">Chat ID</span>
                <span class="meta-val" style="font-family: var(--font-mono);">\${escapeHtml(w.chatId || "--")}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Session ID</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.75rem;" title="\${escapeHtml(w.sessionId || '')}">
                  \${escapeHtml(w.sessionId ? w.sessionId.slice(0, 18) + '...' : '--')}
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">File Count & Size</span>
                <span class="meta-val">\${w.fileCount} files • \${formatBytes(w.sizeBytes)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Last Modified</span>
                <span class="meta-val" style="font-size: 0.76rem; color: var(--text-secondary);">\${dateStr}</span>
              </div>
              <div class="meta-item" style="grid-column: 1 / -1;">
                <span class="meta-label">Physical Path</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted); word-break: break-all;">\${escapeHtml(w.path)}</span>
              </div>
            </div>
          </div>
        \`;
      }
      container.innerHTML = html;
    }

    async function openSessionTurns(botId, chatId, sessionId) {
      try {
        const res = await fetch(\`/api/sessions/turns?botId=\${encodeURIComponent(botId)}&chatId=\${encodeURIComponent(chatId)}&sessionId=\${encodeURIComponent(sessionId)}\`);
        if (!res.ok) throw new Error("Could not load session turns");
        const data = await res.json();
        const s = data.session || {};
        const turns = data.turns || [];

        document.getElementById("modalSessionSubtitle").textContent = \`Chat: \${chatId} • Session: \${sessionId}\`;
        document.getElementById("modalSessionMetaBanner").innerHTML = \`
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; font-size: 0.82rem;">
            <div>
              <strong>\${escapeHtml(s.botName || s.botId)}</strong> • Engine: <span class="badge-engine">\${escapeHtml(s.activeEngine || "claude")}</span>
              \${s.model ? \` • Model: <code>\${escapeHtml(s.model)}</code>\` : ''}
              \${s.effort ? \` • Effort: <code>\${escapeHtml(s.effort)}</code>\` : ''}
            </div>
            <div style="color: var(--text-muted);">
              \${turns.length} dialogue turns recorded
            </div>
          </div>
        \`;

        const turnsList = document.getElementById("sessionTurnsList");
        if (turns.length === 0) {
          turnsList.innerHTML = \`<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No turns recorded in this session yet.</div>\`;
        } else {
          let html = "";
          for (const trn of turns) {
            const role = trn.role || "user";
            const roleClass = role === "user" ? "role-user" : (role === "assistant" ? "role-assistant" : "role-system");
            const bubbleClass = role === "user" ? "turn-bubble-user" : "turn-bubble-assistant";
            const timeStr = trn.ts ? new Date(trn.ts).toLocaleTimeString() : "";
            const engineTag = trn.engine ? \`<span class="badge-engine" style="font-size: 0.65rem; padding: 0.1rem 0.3rem;">\${escapeHtml(trn.engine)}</span>\` : "";

            html += \`
              <div class="turn-bubble \${bubbleClass}">
                <div class="turn-bubble-header">
                  <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span class="turn-role-tag \${roleClass}">\${escapeHtml(role)}</span>
                    \${engineTag}
                    \${trn.author ? \`<span style="color: var(--text-muted); font-size: 0.72rem;">@\${escapeHtml(trn.author)}</span>\` : ''}
                  </div>
                  <span style="color: var(--text-muted); font-size: 0.72rem;">\${timeStr}</span>
                </div>
                <div class="turn-text">\${escapeHtml(trn.text || "")}</div>
              </div>
            \`;
          }
          turnsList.innerHTML = html;
        }

        openModal("modalSessionTurns");
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function switchSessionActive(botId, chatId, sessionId) {
      try {
        const res = await fetch("/api/sessions/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId, chatId, sessionId })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(t("sessionSwitchedToast"), "success");
          fetchSessions();
        } else {
          showToast(data.error || "Failed to switch session", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    function openNewSessionModal() {
      populateBotFilters();
      const chatInput = document.getElementById("newSessionChatId");
      const modelInput = document.getElementById("newSessionModel");
      const effortInput = document.getElementById("newSessionEffort");
      const engineInput = document.getElementById("newSessionEngine");
      if (chatInput) chatInput.value = "";
      if (modelInput) modelInput.value = "";
      if (effortInput) effortInput.value = "";
      if (engineInput) engineInput.value = "";
      openModal("modalNewSession");
    }

    async function confirmCreateSession() {
      const botId = document.getElementById("newSessionBotSelect").value;
      const chatId = document.getElementById("newSessionChatId").value.trim();
      const engine = document.getElementById("newSessionEngine").value || undefined;
      const model = document.getElementById("newSessionModel").value.trim() || undefined;
      const effort = document.getElementById("newSessionEffort").value.trim() || undefined;

      if (!botId || !chatId) {
        showToast("Please enter Bot and Chat ID", "error");
        return;
      }

      try {
        const res = await fetch("/api/sessions/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId, chatId, engine, model, effort })
        });
        const data = await res.json();
        if (data.ok) {
          closeModal("modalNewSession");
          showToast(t("sessionCreatedToast"), "success");
          fetchSessions();
        } else {
          showToast(data.error || "Failed to create session", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function deleteSessionPrompt(botId, chatId, sessionId) {
      const confirmDelete = confirm(t("deleteSessionConfirm", { id: sessionId }));
      if (!confirmDelete) return;

      try {
        const res = await fetch("/api/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId, chatId, sessionId, deleteWorkspace: true })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(t("sessionDeletedToast"), "success");
          fetchSessions();
        } else {
          showToast(data.error || "Failed to delete session", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function fetchWorkspaces() {
      return fetchSessions();
    }

    function switchToWorkspaceView(path) {
      openWorkspaceFiles(path);
    }

    async function openWorkspaceFiles(wsPath) {
      activeWsPath = wsPath;
      document.getElementById("modalWorkspaceSubtitle").textContent = wsPath;
      document.getElementById("wsPreviewFilename").textContent = "";
      document.getElementById("wsPreviewContent").textContent = t("selectFilePrompt");

      try {
        const res = await fetch(\`/api/workspaces/files?path=\${encodeURIComponent(wsPath)}\`);
        if (!res.ok) throw new Error("Could not inspect workspace directory");
        const data = await res.json();
        const files = data.files || [];

        const fileListContainer = document.getElementById("workspaceFileList");
        if (files.length === 0) {
          fileListContainer.innerHTML = \`<div style="padding: 1rem; color: var(--text-muted); font-size: 0.8rem;">(Empty directory)</div>\`;
        } else {
          let html = "";
          for (const f of files) {
            const icon = f.isDir ? "📁" : "📄";
            html += \`
              <div class="ws-file-item" data-relpath="\${escapeHtml(f.relPath)}" onclick="previewWorkspaceFile('\${escapeHtml(f.relPath)}')">
                <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span>\${icon}</span>
                  <span style="font-family: var(--font-mono);">\${escapeHtml(f.name)}</span>
                </div>
                <span style="font-size: 0.72rem; color: var(--text-muted);">\${formatBytes(f.size)}</span>
              </div>
            \`;
          }
          fileListContainer.innerHTML = html;

          // Auto-preview first file if any
          const firstPreviewable = files.find(f => !f.isDir && (f.name.endsWith(".md") || f.name.endsWith(".json") || f.name.endsWith(".txt") || f.name.endsWith(".yaml") || f.name.endsWith(".js") || f.name.endsWith(".ts"))) || files.find(f => !f.isDir);
          if (firstPreviewable) {
            previewWorkspaceFile(firstPreviewable.relPath);
          }
        }

        openModal("modalWorkspaceFiles");
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function previewWorkspaceFile(relPath) {
      activeWsFilePath = relPath;
      document.querySelectorAll(".ws-file-item").forEach(el => {
        el.classList.toggle("selected", el.getAttribute("data-relpath") === relPath);
      });

      document.getElementById("wsPreviewFilename").textContent = relPath;
      document.getElementById("wsPreviewContent").textContent = "Loading file content...";

      try {
        const res = await fetch(\`/api/workspaces/file-content?path=\${encodeURIComponent(activeWsPath)}&file=\${encodeURIComponent(relPath)}\`);
        if (!res.ok) throw new Error("Could not read file");
        const data = await res.json();
        document.getElementById("wsPreviewFilename").textContent = \`\${relPath} (\${formatBytes(data.size)})\`;
        document.getElementById("wsPreviewContent").textContent = data.content || "(Empty file)";
      } catch (err) {
        document.getElementById("wsPreviewContent").textContent = "Error reading file: " + err.message;
      }
    }

    function copyWsPreview() {
      const text = document.getElementById("wsPreviewContent").textContent;
      navigator.clipboard.writeText(text).then(() => {
        showToast(t("copiedToast"), "success");
      });
    }

    async function deleteWorkspaceConfirm(wsPath, folderName) {
      const ok = confirm(t("deleteWorkspaceConfirm", { name: folderName }));
      if (!ok) return;

      try {
        const res = await fetch(\`/api/workspaces?path=\${encodeURIComponent(wsPath)}\`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.ok) {
          showToast(t("workspaceDeletedToast"), "success");
          fetchWorkspaces();
          fetchSessions();
        } else {
          showToast(data.error || "Failed to delete workspace", "error");
        }
      } catch (err) {
        showToast(err.message, "error");
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

      // Grok
      if (!currentConfig.engines.grok) currentConfig.engines.grok = {};
      currentConfig.engines.grok.binary = document.getElementById("cfgGrokBinary").value.trim() || "grok";
      currentConfig.engines.grok.model = document.getElementById("cfgGrokModel").value || undefined;
      currentConfig.engines.grok.effort = document.getElementById("cfgGrokEffort").value || undefined;
      currentConfig.engines.grok.extraArgs = document.getElementById("cfgGrokExtraArgs").value.split(",").map(s => s.trim()).filter(Boolean);

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
    function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add("show"); }
    function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove("show"); }

    // Toast
    function showToast(message, type = "info", duration = 4000) {
      const container = document.getElementById("toastContainer");
      if (!container) return;
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

    // Background Jobs
    let allJobs = [];
    let jobLogTimer = null;
    let jobLogId = null;

    async function fetchJobs() {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) return;
        allJobs = (await res.json()).jobs || [];
        populateJobsBotFilter();
        renderJobs();
      } catch {}
    }

    function populateJobsBotFilter() {
      const sel = document.getElementById("jobsBotFilter");
      if (!sel) return;
      const current = sel.value;
      let html = \`<option value="">\${t("filterAllBots")}</option>\`;
      for (const b of systemStatus?.bots || []) {
        html += \`<option value="\${escapeHtml(b.botId)}">\${escapeHtml(b.name)} (\${escapeHtml(b.channel)})</option>\`;
      }
      sel.innerHTML = html;
      sel.value = current;
    }

    function formatJobDuration(seconds) {
      if (seconds === undefined || seconds === null) return "--";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return h > 0 ? \`\${h}h \${m}m\` : m > 0 ? \`\${m}m \${s}s\` : \`\${s}s\`;
    }

    function jobIsActive(job) {
      return job.status === "running" || job.status === "queued";
    }

    function jobIsFailed(job) {
      return job.status === "failed" || job.status === "timeout" || job.status === "lost";
    }

    function jobStatusBadge(job) {
      const cls = job.status === "running" || job.status === "succeeded"
        ? "badge-active"
        : job.status === "queued" ? "badge-paused" : jobIsFailed(job) ? "badge-failed" : "badge-inactive";
      return \`<span class="badge-status \${cls}"><span class="status-dot"></span>\${t("jobStatus_" + job.status)}</span>\`;
    }

    function renderJobs() {
      const container = document.getElementById("jobsListContainer");
      if (!container) return;
      const jobs = allJobs || [];
      const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      setText("mJobsRunning", jobs.filter(j => j.status === "running").length);
      setText("mJobsQueued", jobs.filter(j => j.status === "queued").length);
      setText("mJobsDone", jobs.filter(j => j.status === "succeeded").length);
      setText("mJobsFailed", jobs.filter(jobIsFailed).length);

      const botFilter = document.getElementById("jobsBotFilter")?.value || "";
      const statusFilter = document.getElementById("jobsStatusFilter")?.value || "all";
      const search = (document.getElementById("jobsSearchInput")?.value || "").trim().toLowerCase();
      const filtered = jobs
        .filter(j =>
          (!botFilter || j.botId === botFilter) &&
          (statusFilter === "all" ||
            (statusFilter === "active" && jobIsActive(j)) ||
            (statusFilter === "finished" && !jobIsActive(j)) ||
            (statusFilter === "failed" && jobIsFailed(j))) &&
          (!search || [j.title, j.command, j.chatId, j.id].some(v => (v || "").toLowerCase().includes(search)))
        )
        // In-progress jobs first, then newest first
        .sort((a, b) => (jobIsActive(b) - jobIsActive(a)) || (b.createdAt - a.createdAt));

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="card" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 0.95rem;">\${jobs.length === 0 ? t("jobsEmpty") : t("jobsNoMatch")}</div>
          </div>
        \`;
        return;
      }

      let html = "";
      for (const job of filtered) {
        const id = escapeHtml(job.id);
        const channelBadgeClass = job.channelType === "telegram" ? "channel-tg" : "channel-dc";
        const requester = job.requester?.senderName
          ? \`\${escapeHtml(job.requester.senderName)}\${job.requester.senderId ? \` <span class="st-muted" style="font-family: var(--font-mono); font-size: 0.72rem;">\${escapeHtml(job.requester.senderId)}</span>\` : ""}\`
          : "--";
        const exit = job.exitCode === undefined || job.exitCode === null
          ? "--"
          : \`<span class="\${job.exitCode === 0 ? "st-ok" : "st-fail"}">\${job.exitCode}</span>\`;
        const callback = job.callback ? t("jobCallback_" + job.callback) : "--";
        const notice = job.error && !jobIsActive(job) && job.status !== "cancelled"
          ? \`<div class="badge-status badge-failed" style="text-transform: none; align-self: flex-start;">\${escapeHtml(job.error)}</div>\`
          : job.status === "cancelled" && job.cancelledBy
            ? \`<div class="st-muted" style="font-size: 0.78rem;">\${escapeHtml(t("jobStatus_cancelled"))} · \${escapeHtml(job.cancelledBy)}</div>\`
            : "";

        html += \`
          <div class="session-card \${job.status === "running" ? "is-active" : ""}">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; min-width: 0;">
                <span class="channel-badge \${channelBadgeClass}">\${escapeHtml((job.channelType || "bot").toUpperCase())}</span>
                \${jobStatusBadge(job)}
                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">#\${job.seq} \${escapeHtml(job.title)}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">\${id}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="openJobLog('\${id}')">\${t("jobViewLog")}</button>
                \${jobIsActive(job)
                  ? \`<button class="btn btn-secondary btn-sm" style="color: var(--badge-red-text);" onclick="stopBgJob('\${id}')">\${t("jobStop")}</button>\`
                  : \`<button class="btn btn-secondary btn-sm" style="color: var(--badge-red-text);" onclick="deleteBgJob('\${id}')">\${t("jobDelete")}</button>\`}
              </div>
            </div>
            <div class="cron-prompt">\${escapeHtml(job.command)}</div>
            \${job.status === "running" && job.last_line ? \`<div class="job-latest" title="\${escapeHtml(job.last_line)}">▸ \${escapeHtml(job.last_line)}</div>\` : ""}
            <div class="card-meta-grid">
              <div class="meta-item">
                <span class="meta-label">Bot · Chat ID</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.78rem;">\${escapeHtml(job.bot_name || job.botId)} · \${escapeHtml(job.chatId)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("jobRequester")}</span>
                <span class="meta-val">\${requester}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("jobStarted")}</span>
                <span class="meta-val" style="font-size: 0.78rem;">\${job.startedAt ? escapeHtml(new Date(job.startedAt).toLocaleString()) : "--"}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("jobDuration")}</span>
                <span class="meta-val">\${formatJobDuration(job.elapsed_seconds)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("jobExit")} · PID</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.78rem;">\${exit} · \${job.pid || "--"}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("jobCallback")}</span>
                <span class="meta-val">\${escapeHtml(callback)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("jobCwd")}</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.74rem; word-break: break-all;">\${escapeHtml(job.cwd)}</span>
              </div>
              \${job.then ? \`
              <div class="meta-item">
                <span class="meta-label">\${t("jobThen")}</span>
                <span class="meta-val" style="font-size: 0.78rem;">\${escapeHtml(job.then)}</span>
              </div>\` : ""}
            </div>
            \${notice}
          </div>
        \`;
      }
      container.innerHTML = html;
    }

    async function jobRequest(url, options) {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || ("HTTP " + res.status));
      return data;
    }

    async function stopBgJob(id) {
      const job = allJobs.find(j => j.id === id);
      if (!confirm(t("jobStopConfirm", { num: job ? job.seq : "?", title: job ? job.title : id }))) return;
      try {
        await jobRequest("/api/jobs/cancel?id=" + encodeURIComponent(id), { method: "POST" });
        showToast(t("jobStoppedToast"), "success");
        setTimeout(fetchJobs, 600);
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function deleteBgJob(id) {
      const job = allJobs.find(j => j.id === id);
      if (!confirm(t("jobDeleteConfirm", { num: job ? job.seq : "?", title: job ? job.title : id }))) return;
      try {
        await jobRequest("/api/jobs?id=" + encodeURIComponent(id), { method: "DELETE" });
        showToast(t("jobDeletedToast"), "success");
        fetchJobs();
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    function openJobLog(id) {
      const job = allJobs.find(j => j.id === id);
      jobLogId = id;
      document.getElementById("jobLogSubtitle").textContent = job ? \`#\${job.seq} \${job.title} · \${job.id}\` : id;
      document.getElementById("jobLogContent").textContent = "";
      openModal("modalJobLog");
      refreshJobLog(true);
      if (jobLogTimer) clearInterval(jobLogTimer);
      jobLogTimer = setInterval(() => refreshJobLog(false), 2000);
    }

    function closeJobLog() {
      if (jobLogTimer) clearInterval(jobLogTimer);
      jobLogTimer = null;
      jobLogId = null;
      closeModal("modalJobLog");
    }

    async function refreshJobLog(scrollToEnd) {
      const modal = document.getElementById("modalJobLog");
      // Closed with Escape or a backdrop click
      if (!jobLogId || !modal?.classList.contains("show")) {
        if (jobLogTimer) clearInterval(jobLogTimer);
        jobLogTimer = null;
        return;
      }
      try {
        const data = await jobRequest("/api/jobs/log?lines=500&id=" + encodeURIComponent(jobLogId));
        const pre = document.getElementById("jobLogContent");
        const atEnd = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 20;
        pre.textContent = data.log || t("jobLogEmpty");
        if (scrollToEnd || atEnd) pre.scrollTop = pre.scrollHeight;
        const live = data.status === "running" || data.status === "queued";
        document.getElementById("jobLogMeta").textContent = live ? t("jobLogLive") : t("jobStatus_" + data.status);
        if (!live && jobLogTimer) {
          clearInterval(jobLogTimer);
          jobLogTimer = null;
        }
      } catch (err) {
        document.getElementById("jobLogMeta").textContent = err.message;
      }
    }

    // Scheduled Tasks
    async function fetchCronJobs() {
      try {
        const [cRes, wRes] = await Promise.all([fetch("/api/cron"), fetch("/api/workspaces")]);
        if (wRes.ok) {
          allWorkspaces = (await wRes.json()).workspaces || [];
        }
        if (!cRes.ok) return;
        const data = await cRes.json();
        allCronJobs = data.jobs || [];
        cronTimezone = data.timezone || "";
        populateCronBotFilter();
        renderCronJobs();
      } catch {}
    }

    async function cronRequest(url, options) {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || ("HTTP " + res.status));
      return data;
    }

    function populateCronBotFilter() {
      const sel = document.getElementById("cronBotFilter");
      if (!sel) return;
      const current = sel.value;
      let html = \`<option value="">\${t("filterAllBots")}</option>\`;
      for (const b of systemStatus?.bots || []) {
        html += \`<option value="\${escapeHtml(b.botId)}">\${escapeHtml(b.name)} (\${escapeHtml(b.channel)})</option>\`;
      }
      sel.innerHTML = html;
      sel.value = current;
    }

    function cronBotName(botId) {
      const bot = (systemStatus?.bots || []).find(b => b.botId === botId);
      return bot ? bot.name : botId;
    }

    function formatCronTs(ts) {
      return toCronInputTime(ts).replace("T", " ");
    }

    function cronScheduleText(job) {
      if (job.schedule.kind === "at") return t("cronOnceAt", { time: formatCronTs(job.schedule.at) });
      return \`\${job.schedule.expr} (\${job.schedule.tz})\`;
    }

    function formatDuration(ms) {
      if (ms === undefined || ms === null) return "";
      const sec = Math.round(ms / 1000);
      return sec < 60 ? \`\${sec}s\` : \`\${Math.floor(sec / 60)}m \${sec % 60}s\`;
    }

    function cronWorkspace(job) {
      return (allWorkspaces || []).find(w => w.botId === job.botId && w.sessionId === "cron-" + job.id);
    }

    function renderCronJobs() {
      const container = document.getElementById("cronListContainer");
      if (!container) return;
      const jobs = allCronJobs || [];
      const failed = (j) => j.state.lastStatus === "error" || j.state.lastStatus === "timeout";

      const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      setText("mCronTotal", jobs.length);
      setText("mCronEnabled", jobs.filter(j => j.enabled).length);
      setText("mCronRunning", jobs.filter(j => j.running).length);
      setText("mCronAttention", jobs.filter(j => (!j.enabled && j.state.pausedReason) || failed(j)).length);
      setText("mCronTimezone", cronTimezone ? t("cronDefaultTz", { tz: cronTimezone }) : "--");

      const botFilter = document.getElementById("cronBotFilter")?.value || "";
      const statusFilter = document.getElementById("cronStatusFilter")?.value || "all";
      const search = (document.getElementById("cronSearchInput")?.value || "").trim().toLowerCase();
      const filtered = jobs.filter(j =>
        (!botFilter || j.botId === botFilter) &&
        (statusFilter === "all" || (statusFilter === "enabled" ? j.enabled : !j.enabled)) &&
        (!search || [j.name, j.prompt, j.chatId, j.id].some(v => (v || "").toLowerCase().includes(search)))
      );

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="card" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 0.95rem;">\${jobs.length === 0 ? t("cronEmpty") : t("cronNoMatch")}</div>
          </div>
        \`;
        return;
      }

      let html = "";
      for (const job of filtered) {
        const id = escapeHtml(job.id);
        const statusBadge = job.running
          ? \`<span class="badge-status badge-active"><span class="status-dot"></span>\${t("cronStatusRunning")}</span>\`
          : job.enabled
            ? \`<span class="badge-status badge-active"><span class="status-dot"></span>\${t("cronStatusEnabled")}</span>\`
            : \`<span class="badge-status badge-paused"><span class="status-dot"></span>\${t("cronStatusPaused")}</span>\`;
        const channelBadgeClass = job.channelType === "telegram" ? "channel-tg" : "channel-dc";
        const lastRun = job.state.lastRunAt
          ? \`<span style="color: \${failed(job) ? 'var(--badge-red-text)' : 'var(--badge-green-text)'};">\${t("cronResult_" + job.state.lastStatus)}</span>
             · \${formatCronTs(job.state.lastRunAt)}\${job.state.lastDurationMs !== undefined ? ' · ' + formatDuration(job.state.lastDurationMs) : ''}\`
          : \`<span style="color: var(--text-muted);">\${t("cronNever")}</span>\`;
        const creator = job.createdBy.senderName
          ? \`\${escapeHtml(job.createdBy.senderName)} (\${escapeHtml(job.createdBy.via)})\`
          : escapeHtml(job.createdBy.via);
        const ws = cronWorkspace(job);
        let notice = "";
        if (!job.enabled && job.state.pausedReason) {
          notice = \`<div class="badge-status badge-paused" style="text-transform: none; align-self: flex-start;">\${escapeHtml(t("cronPausedReason", { reason: job.state.pausedReason }))}</div>\`;
        } else if (failed(job) && job.state.lastError) {
          notice = \`<div class="badge-status badge-failed" style="text-transform: none; align-self: flex-start;">\${escapeHtml(t("cronLastError", { error: job.state.lastError }))}</div>\`;
        }

        html += \`
          <div class="session-card \${job.running ? 'is-active' : ''}">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <span class="channel-badge \${channelBadgeClass}">\${escapeHtml((job.channelType || "bot").toUpperCase())}</span>
                \${statusBadge}
                \${job.engine ? \`<span class="badge-engine">\${escapeHtml(job.engine)}</span>\` : ''}
                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">\${escapeHtml(job.name)}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">\${id}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="runCronNow('\${id}')" \${job.running ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>\${t("cronRunNow")}</button>
                <button class="btn btn-secondary btn-sm" onclick="toggleCron('\${id}', \${!job.enabled})">\${job.enabled ? t("cronPause") : t("cronResume")}</button>
                <button class="btn btn-secondary btn-sm" onclick="openCronModal('\${id}')">\${t("cronEdit")}</button>
                <button class="btn btn-secondary btn-sm" onclick="openCronRuns('\${id}')">\${t("cronHistory")} (\${job.state.runCount || 0})</button>
                \${ws ? \`<button class="btn btn-secondary btn-sm" onclick="openWorkspaceFiles('\${escapeHtml(ws.path)}')">\${t("cronWorkspace")} (\${ws.fileCount || 0})</button>\` : ''}
                <button class="btn btn-secondary btn-sm" style="color: var(--badge-red-text);" onclick="deleteCron('\${id}')">\${t("cronDelete")}</button>
              </div>
            </div>
            <div class="cron-prompt">\${escapeHtml(job.prompt)}</div>
            <div class="card-meta-grid">
              <div class="meta-item">
                <span class="meta-label">\${t("cronSchedule")}</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.78rem;">\${escapeHtml(cronScheduleText(job))}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("cronNextRun")}</span>
                <span class="meta-val">\${escapeHtml(job.next_run || "--")}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("cronLastRun")}</span>
                <span class="meta-val" style="font-size: 0.78rem;">\${lastRun}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Bot · Chat ID</span>
                <span class="meta-val" style="font-family: var(--font-mono); font-size: 0.78rem;">\${escapeHtml(cronBotName(job.botId))} · \${escapeHtml(job.chatId)}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">\${t("cronCreatedBy")}</span>
                <span class="meta-val">\${creator}</span>
              </div>
            </div>
            \${notice}
          </div>
        \`;
      }
      container.innerHTML = html;
    }

    async function runCronNow(id) {
      try {
        await cronRequest("/api/cron/run?id=" + encodeURIComponent(id), { method: "POST" });
        showToast(t("cronStartedToast"), "success");
        fetchCronJobs();
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function toggleCron(id, enabled) {
      try {
        await cronRequest("/api/cron/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, enabled })
        });
        fetchCronJobs();
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function deleteCron(id) {
      const job = allCronJobs.find(j => j.id === id);
      if (!confirm(t("cronDeleteConfirm", { name: job ? job.name : id }))) return;
      try {
        await cronRequest("/api/cron?id=" + encodeURIComponent(id), { method: "DELETE" });
        showToast(t("cronDeletedToast"), "success");
        fetchCronJobs();
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    // Wall-clock "YYYY-MM-DDTHH:MM" of a timestamp in the scheduler timezone, for datetime-local inputs
    function toCronInputTime(ts) {
      const opts = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
      if (cronTimezone) opts.timeZone = cronTimezone;
      return new Intl.DateTimeFormat("sv-SE", opts).format(new Date(ts)).replace(" ", "T");
    }

    function updateCronKindFields() {
      const isAt = document.getElementById("cronKind").value === "at";
      document.getElementById("cronExprGroup").style.display = isAt ? "none" : "";
      document.getElementById("cronTzGroup").style.display = isAt ? "none" : "";
      document.getElementById("cronAtGroup").style.display = isAt ? "" : "none";
      document.getElementById("cronExprHint").style.display = isAt ? "none" : "";
    }

    function updateCronChatOptions() {
      const botId = document.getElementById("cronBotSelect").value;
      const seen = new Set();
      let html = "";
      for (const s of allSessions || []) {
        if (s.botId !== botId || seen.has(s.chatId)) continue;
        seen.add(s.chatId);
        html += \`<option value="\${escapeHtml(s.chatId)}">\${escapeHtml(s.title || s.channelType || "")}</option>\`;
      }
      document.getElementById("cronChatOptions").innerHTML = html;
    }

    function openCronModal(id) {
      editingCronId = id || null;
      const job = id ? allCronJobs.find(j => j.id === id) : null;
      const val = (elId, v) => { document.getElementById(elId).value = v ?? ""; };

      const botSel = document.getElementById("cronBotSelect");
      botSel.innerHTML = (systemStatus?.bots || [])
        .map(b => \`<option value="\${escapeHtml(b.botId)}">\${escapeHtml(b.name)} (\${escapeHtml(b.channel)})</option>\`)
        .join("");
      if (job && !Array.from(botSel.options).some(o => o.value === job.botId)) {
        botSel.innerHTML += \`<option value="\${escapeHtml(job.botId)}">\${escapeHtml(job.botId)}</option>\`;
      }
      if (job) botSel.value = job.botId;
      botSel.disabled = Boolean(job);
      document.getElementById("cronChatId").disabled = Boolean(job);
      val("cronChatId", job?.chatId);
      updateCronChatOptions();

      val("cronName", job?.name);
      val("cronKind", job?.schedule.kind || "cron");
      val("cronExpr", job?.schedule.kind === "cron" ? job.schedule.expr : "");
      val("cronTz", job?.schedule.kind === "cron" ? job.schedule.tz : "");
      document.getElementById("cronTz").placeholder = cronTimezone || "Asia/Shanghai";
      val("cronAt", job?.schedule.kind === "at" ? toCronInputTime(job.schedule.at) : "");
      document.getElementById("cronAtLabel").textContent = cronTimezone ? t("cronFieldAtTz", { tz: cronTimezone }) : t("cronFieldAt");
      val("cronPrompt", job?.prompt);
      val("cronEngine", job?.engine);
      val("cronModel", job?.model);
      val("cronEffort", job?.effort);
      val("cronTimeout", job?.timeoutMs ? Math.round(job.timeoutMs / 60000) : "");

      document.getElementById("cronModalTitle").textContent = t(job ? "cronModalEditTitle" : "cronModalNewTitle");
      updateCronKindFields();
      openModal("modalCron");
    }

    async function saveCronJob() {
      const get = (elId) => document.getElementById(elId).value.trim();
      const kind = get("cronKind");
      const body = {
        name: get("cronName"),
        prompt: get("cronPrompt"),
        engine: get("cronEngine"),
        model: get("cronModel"),
        effort: get("cronEffort"),
        timeout_minutes: get("cronTimeout") || null,
      };
      if (kind === "cron") {
        body.cron = get("cronExpr");
        body.tz = get("cronTz");
      } else {
        body.at = get("cronAt");
      }

      const botId = get("cronBotSelect");
      const chatId = get("cronChatId");
      if (!botId || !chatId || !body.prompt || !(body.cron || body.at)) {
        showToast(t("cronMissingFields"), "error");
        return;
      }

      try {
        if (editingCronId) {
          await cronRequest("/api/cron/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingCronId, ...body })
          });
        } else {
          await cronRequest("/api/cron", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bot_id: botId, chat_id: chatId, ...body })
          });
        }
        closeModal("modalCron");
        showToast(t("cronSavedToast"), "success");
        fetchCronJobs();
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    async function openCronRuns(id) {
      const job = allCronJobs.find(j => j.id === id);
      document.getElementById("cronRunsSubtitle").textContent = job ? \`\${job.name} · \${job.id}\` : id;
      cronRuns = [];
      selectedCronRun = 0;
      document.getElementById("cronRunList").innerHTML = "";
      document.getElementById("cronRunDetailHeader").innerHTML = "";
      document.getElementById("cronRunDetailBody").innerHTML = "";
      openModal("modalCronRuns");
      try {
        const data = await cronRequest("/api/cron/runs?id=" + encodeURIComponent(id));
        cronRuns = (data.runs || []).slice().reverse();
        if (cronRuns.length === 0) {
          document.getElementById("cronRunDetailBody").innerHTML = \`<div class="st-muted" style="text-align: center; padding: 3rem 1rem; font-size: 0.85rem;">\${t("cronRunsEmpty")}</div>\`;
          return;
        }
        selectCronRun(0);
      } catch (err) {
        document.getElementById("cronRunDetailBody").innerHTML = \`<div class="cron-run-note is-error">\${escapeHtml(err.message)}</div>\`;
      }
    }

    function cronStatusClass(status) {
      if (status === "error" || status === "timeout") return "st-fail";
      if (status === "skipped") return "st-muted";
      return "st-ok";
    }

    function cronRunMeta(r) {
      const parts = [t("cronTrigger_" + r.trigger)];
      if (r.status !== "skipped") parts.push(formatDuration(r.finishedAt - r.startedAt));
      return parts.join(" · ");
    }

    function selectCronRun(index) {
      selectedCronRun = index;
      cronRunRaw = false;
      document.getElementById("cronRunList").innerHTML = cronRuns.map((r, i) => {
        const cls = cronStatusClass(r.status);
        return \`
          <div class="cron-run-item \${i === index ? 'selected' : ''}" onclick="selectCronRun(\${i})">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span class="status-dot \${cls}"></span>
              <span class="\${cls}" style="font-weight: 600;">\${t("cronResult_" + r.status)}</span>
              <span class="st-muted" style="margin-left: auto; font-family: var(--font-mono); font-size: 0.72rem;">#\${r.runNum}</span>
            </div>
            <div style="color: var(--text-secondary);">\${formatCronTs(r.startedAt)}</div>
            <div class="st-muted" style="font-size: 0.72rem;">\${cronRunMeta(r)}</div>
          </div>
        \`;
      }).join("");
      renderCronRunDetail();
    }

    function cronRunOutput(r) {
      return (r.output ?? r.outputPreview ?? "").replace("[SILENT]", "").trim();
    }

    function renderCronRunDetail() {
      const r = cronRuns[selectedCronRun];
      if (!r) return;
      const output = cronRunOutput(r);
      const cls = cronStatusClass(r.status);

      document.getElementById("cronRunDetailHeader").innerHTML = \`
        <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          <span style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 600;" class="\${cls}">
            <span class="status-dot"></span>\${t("cronResult_" + r.status)}
          </span>
          <span style="color: var(--text-secondary);">#\${r.runNum} · \${formatCronTs(r.startedAt)}</span>
          <span class="st-muted">\${cronRunMeta(r)}</span>
        </div>
        \${output ? \`
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="toggleCronRunRaw()">\${t(cronRunRaw ? "cronViewRendered" : "cronViewRaw")}</button>
            <button class="btn btn-secondary btn-sm" onclick="copyCronRunOutput()">\${t("cronCopy")}</button>
          </div>
        \` : ''}
      \`;

      let html = "";
      if (r.status === "silent") {
        html += \`<div class="cron-run-note">\${t("cronRunSilentNote")}</div>\`;
      }
      if (r.error) {
        html += \`<div class="cron-run-note \${r.status === "skipped" ? '' : 'is-error'}">\${escapeHtml(r.error)}</div>\`;
      }
      if (!r.output && r.outputPreview && r.outputPreview.length >= 500) {
        html += \`<div class="cron-run-note is-warn">\${t("cronRunTruncatedNote")}</div>\`;
      }
      if (output) {
        html += cronRunRaw
          ? \`<pre class="md-raw">\${escapeHtml(output)}</pre>\`
          : \`<div class="md-body">\${renderMarkdown(output)}</div>\`;
      } else if (r.status === "ok") {
        html += \`<div class="st-muted" style="font-size: 0.85rem;">\${t("cronRunNoOutput")}</div>\`;
      }
      const body = document.getElementById("cronRunDetailBody");
      body.innerHTML = html;
      body.scrollTop = 0;
    }

    function toggleCronRunRaw() {
      cronRunRaw = !cronRunRaw;
      renderCronRunDetail();
    }

    async function copyCronRunOutput() {
      const r = cronRuns[selectedCronRun];
      if (!r) return;
      try {
        await navigator.clipboard.writeText(cronRunOutput(r));
        showToast(t("cronCopied"), "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    // Minimal Markdown renderer for run output. Input is escaped first, so only the tags below are produced.
    function renderMarkdown(src) {
      const lines = String(src || "").replace(/\\r\\n/g, "\\n").split("\\n");
      const out = [];
      let para = [];
      let listItems = null;
      const flushPara = () => {
        if (para.length) out.push("<p>" + para.map(mdInline).join("<br>") + "</p>");
        para = [];
      };
      const flushList = () => {
        if (listItems) out.push('<div class="md-list">' + listItems.join("") + "</div>");
        listItems = null;
      };
      const flushAll = () => { flushPara(); flushList(); };
      const tableCells = (row) => row.trim().replace(/^\\|/, "").replace(/\\|$/, "").split("|").map(c => c.trim());

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        let m;

        if (trimmed.startsWith("\`\`\`")) {
          flushAll();
          const code = [];
          for (i++; i < lines.length && !lines[i].trim().startsWith("\`\`\`"); i++) code.push(lines[i]);
          out.push("<pre><code>" + escapeHtml(code.join("\\n")) + "</code></pre>");
          continue;
        }
        if (!trimmed) {
          flushAll();
          continue;
        }
        if ((m = trimmed.match(/^(#{1,6})\\s+(.*)$/))) {
          flushAll();
          out.push("<h" + m[1].length + ">" + mdInline(m[2]) + "</h" + m[1].length + ">");
          continue;
        }
        if (/^([-*_])(\\s*\\1){2,}$/.test(trimmed)) {
          flushAll();
          out.push("<hr>");
          continue;
        }
        if (trimmed.startsWith("|") && i + 1 < lines.length && /^\\s*\\|?\\s*:?-{3,}/.test(lines[i + 1])) {
          flushAll();
          const head = tableCells(line);
          const rows = [];
          for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(tableCells(lines[i]));
          i--;
          out.push(
            "<table><thead><tr>" + head.map(c => "<th>" + mdInline(c) + "</th>").join("") + "</tr></thead><tbody>" +
            rows.map(r => "<tr>" + r.map(c => "<td>" + mdInline(c) + "</td>").join("") + "</tr>").join("") +
            "</tbody></table>"
          );
          continue;
        }
        if ((m = line.match(/^(\\s*)([-*+]|\\d+[.)])\\s+(.*)$/))) {
          flushPara();
          if (!listItems) listItems = [];
          const level = Math.floor(m[1].replace(/\\t/g, "  ").length / 2);
          const marker = /\\d/.test(m[2]) ? escapeHtml(m[2]) : "&bull;";
          listItems.push(
            '<div class="md-li" style="margin-left: ' + (level * 1.25) + 'rem;"><span class="md-marker">' + marker + "</span><span>" + mdInline(m[3]) + "</span></div>"
          );
          continue;
        }
        if (trimmed.startsWith(">")) {
          flushAll();
          out.push("<blockquote>" + mdInline(trimmed.replace(/^>\\s?/, "")) + "</blockquote>");
          continue;
        }
        if (listItems && /^\\s+/.test(line)) {
          // Indented continuation of the previous list item
          const last = listItems.length - 1;
          listItems[last] = listItems[last].replace(/<\\/span><\\/div>$/, "<br>" + mdInline(trimmed) + "</span></div>");
          continue;
        }
        flushList();
        para.push(trimmed);
      }
      flushAll();
      return out.join("");
    }

    function mdInline(text) {
      return escapeHtml(text)
        .replace(/\`([^\`]+)\`/g, "<code>$1</code>")
        .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
        .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/(^|[\\s(])(https?:\\/\\/[^\\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
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
