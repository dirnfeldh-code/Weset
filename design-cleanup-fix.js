(() => {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --clean-shadow: 0 10px 28px rgba(18, 35, 39, 0.07);
      --clean-shadow-small: 0 4px 14px rgba(18, 35, 39, 0.06);
    }

    body {
      background:
        linear-gradient(145deg, rgba(57, 181, 74, 0.16), rgba(20, 92, 88, 0.10) 48%, rgba(255, 255, 255, 0.42)),
        #eef6f1 !important;
    }

    .app-shell {
      background:
        linear-gradient(145deg, rgba(57, 181, 74, 0.20), rgba(20, 92, 88, 0.12) 46%, rgba(255, 255, 255, 0.40)),
        #eef6f1 !important;
    }

    .main {
      padding: clamp(16px, 2.2vw, 28px) !important;
    }

    .topbar,
    .card-top,
    .toolbar,
    .card-actions,
    .top-actions {
      gap: 10px !important;
      min-width: 0 !important;
    }

    .topbar,
    .top-actions,
    .card-actions {
      flex-wrap: wrap !important;
    }

    .topbar h1,
    .panel h2,
    .quote-card h3,
    .client-mini h3,
    .catalog-item h3,
    .install-card h3 {
      letter-spacing: 0 !important;
      min-width: 0 !important;
      overflow-wrap: anywhere !important;
    }

    .topbar h1 {
      font-size: clamp(24px, 2.4vw, 32px) !important;
      line-height: 1.15 !important;
      margin-bottom: 4px !important;
    }

    .panel h2 {
      font-size: 18px !important;
      line-height: 1.25 !important;
    }

    .quote-card h3,
    .client-mini h3,
    .catalog-item h3,
    .install-card h3 {
      font-size: 15px !important;
      line-height: 1.25 !important;
      margin: 0 !important;
    }

    .panel,
    .metric,
    .quote-card,
    .client-mini,
    .catalog-item,
    .install-card,
    .modal-card,
    .dialog-card,
    dialog > div,
    .invoice-notice,
    .quote-record-actions,
    .quote-status-actions {
      border-color: #dfe8e5 !important;
      border-radius: 8px !important;
      box-shadow: var(--clean-shadow-small) !important;
      min-width: 0 !important;
    }

    .panel,
    .modal-card,
    .dialog-card,
    dialog > div {
      box-shadow: var(--clean-shadow) !important;
    }

    .panel {
      padding: clamp(14px, 1.6vw, 20px) !important;
    }

    .metric,
    .quote-card,
    .client-mini,
    .catalog-item,
    .install-card {
      overflow: hidden !important;
    }

    .quote-status-board {
      align-items: start !important;
      gap: 14px !important;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)) !important;
      width: 100% !important;
    }

    .quote-status-column {
      gap: 10px !important;
      min-width: 0 !important;
      padding: 10px !important;
    }

    .quote-card {
      display: grid !important;
      gap: 10px !important;
      padding: 12px !important;
    }

    .quote-card p,
    .quote-card div,
    .quote-card span,
    .meta,
    .muted,
    td,
    th {
      min-width: 0 !important;
      overflow-wrap: anywhere !important;
    }

    .card-top {
      align-items: start !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
    }

    .badge,
    .status-badge,
    [class*="badge"] {
      align-items: center !important;
      border-radius: 999px !important;
      display: inline-flex !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      line-height: 1.1 !important;
      max-width: 160px !important;
      min-height: 24px !important;
      overflow: hidden !important;
      padding: 5px 9px !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    button,
    a.as-link,
    input,
    select,
    textarea {
      max-width: 100% !important;
    }

    button,
    a.as-link {
      line-height: 1.15 !important;
      min-width: 0 !important;
      text-align: center !important;
      white-space: normal !important;
      word-break: normal !important;
      overflow-wrap: anywhere !important;
    }

    input,
    select,
    textarea {
      min-height: 38px !important;
    }

    textarea {
      line-height: 1.35 !important;
    }

    .quote-card .quote-record-actions {
      background: #f8fbfa !important;
      gap: 8px !important;
      padding: 8px !important;
    }

    .quote-action-panel {
      gap: 8px !important;
      grid-template-columns: 1fr !important;
    }

    .quote-action-group {
      gap: 6px !important;
      min-width: 0 !important;
    }

    .quote-action-label,
    .quote-card .quote-status-actions::before {
      color: #5e6d70 !important;
      font-size: 10px !important;
      line-height: 1.2 !important;
    }

    .quote-action-row,
    .quote-action-group.is-tools .quote-action-row {
      gap: 6px !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .quote-action-row > button,
    .quote-action-row > a.as-link,
    .card-actions button,
    .card-actions a.as-link {
      font-size: 13px !important;
      min-height: 34px !important;
      padding: 6px 9px !important;
      width: 100% !important;
    }

    .quote-card .quote-status-actions {
      background: #ffffff !important;
      gap: 6px !important;
      margin-top: 8px !important;
      padding: 8px !important;
    }

    .quote-card .quote-status-actions button,
    .status-move-button {
      font-size: 12px !important;
      min-height: 32px !important;
      padding: 5px 8px !important;
      width: 100% !important;
    }

    button.status-live-current,
    button.is-current,
    .status-move-button.is-current {
      background: #145c58 !important;
      border: 1px solid #145c58 !important;
      color: #ffffff !important;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 3px 10px rgba(20,92,88,0.16) !important;
    }

    button.status-live-current::after {
      content: "" !important;
      display: none !important;
    }

    .quote-money-lines {
      background: #f8fbfa !important;
      border-radius: 8px !important;
      margin: 0 !important;
      padding: 8px !important;
    }

    .quote-money-lines div {
      gap: 10px !important;
    }

    .status-rail,
    .kanban-column,
    .items-grid,
    .clients-grid,
    .dashboard-grid,
    .work-grid,
    .accounting-grid,
    .metrics {
      gap: 14px !important;
    }

    table {
      table-layout: fixed !important;
      width: 100% !important;
    }

    th,
    td {
      line-height: 1.35 !important;
      vertical-align: top !important;
    }

    dialog,
    .modal,
    .inside-window {
      padding: 12px !important;
    }

    dialog .dialog-card,
    dialog > div,
    .modal-card,
    .inside-window > div {
      max-height: calc(100vh - 32px) !important;
      max-width: min(980px, calc(100vw - 24px)) !important;
      overflow: auto !important;
      width: 100% !important;
    }

    .form-grid,
    .fields-grid,
    .quote-form-grid {
      gap: 12px !important;
    }

    .form-grid > *,
    .fields-grid > *,
    .quote-form-grid > * {
      min-width: 0 !important;
    }

    @media (min-width: 920px) {
      .quote-action-panel {
        grid-template-columns: 1fr !important;
      }
    }

    @media (max-width: 900px) {
      .app-shell {
        grid-template-columns: 1fr !important;
        overflow: visible !important;
      }

      .sidebar {
        gap: 14px !important;
        padding: 16px !important;
        position: relative !important;
      }

      .nav {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      .nav-item {
        min-height: 40px !important;
      }

      .main {
        padding: 16px !important;
      }

      .topbar,
      .top-actions {
        display: grid !important;
        grid-template-columns: 1fr !important;
        width: 100% !important;
      }

      .top-actions > *,
      .search,
      .search input {
        width: 100% !important;
      }

      .metrics,
      .dashboard-grid,
      .work-grid,
      .accounting-grid {
        grid-template-columns: 1fr !important;
      }
    }

    @media (max-width: 620px) {
      .quote-status-board {
        grid-template-columns: 1fr !important;
      }

      .quote-action-row,
      .quote-action-group.is-tools .quote-action-row {
        grid-template-columns: 1fr !important;
      }

      .card-top {
        grid-template-columns: 1fr !important;
      }

      .badge,
      .status-badge,
      [class*="badge"] {
        justify-self: start !important;
        max-width: 100% !important;
      }

      .card-actions {
        display: grid !important;
        grid-template-columns: 1fr !important;
      }

      .nav {
        grid-template-columns: 1fr !important;
      }

      .panel {
        padding: 14px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
