(() => {
  const style = document.createElement("style");
  style.textContent = `
    html,
    body {
      min-height: 100%;
      overflow-x: hidden !important;
    }

    .app-shell {
      grid-template-columns: minmax(212px, 240px) minmax(0, 1fr) !important;
      height: 100dvh !important;
      min-height: 100dvh !important;
      overflow: hidden !important;
    }

    .sidebar {
      gap: 16px !important;
      max-height: 100dvh !important;
      overflow: auto !important;
      padding: 18px !important;
    }

    .brand-mark.full-logo {
      max-width: 218px !important;
    }

    .nav {
      gap: 6px !important;
    }

    .nav-item {
      min-height: 38px !important;
      padding: 6px 10px !important;
    }

    .sidebar-card {
      gap: 8px !important;
      padding: 12px !important;
    }

    .main {
      height: 100dvh !important;
      overflow: auto !important;
      padding: 18px !important;
    }

    .topbar {
      align-items: flex-start !important;
      gap: 12px !important;
      margin-bottom: 14px !important;
    }

    .top-actions {
      align-items: flex-end !important;
      gap: 8px !important;
    }

    .search {
      width: min(300px, 34vw) !important;
    }

    .metrics {
      gap: 10px !important;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)) !important;
      margin-bottom: 14px !important;
    }

    .metric {
      padding: 12px !important;
    }

    .metric strong {
      font-size: 24px !important;
      margin-top: 4px !important;
    }

    .dashboard-grid,
    .work-grid,
    .accounting-grid {
      align-items: start !important;
      gap: 14px !important;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) !important;
    }

    .accounting-grid.lower {
      margin-top: 14px !important;
    }

    .panel {
      padding: 14px !important;
    }

    .panel-head {
      align-items: flex-start !important;
      gap: 8px !important;
      margin-bottom: 12px !important;
    }

    .list,
    .timeline,
    .install-board,
    .catalog-list,
    .accounts-summary,
    .breakdown-list {
      gap: 10px !important;
      min-width: 0 !important;
    }

    .table-wrap {
      max-width: 100% !important;
      overflow: auto !important;
    }

    #clientsView .table-wrap,
    #usersView .table-wrap,
    #accountingView .table-wrap,
    #quotesView .table-wrap,
    #installationsView .table-wrap {
      max-height: calc(100dvh - 250px) !important;
    }

    table {
      min-width: 680px !important;
    }

    #usersView table,
    #accountingView table {
      min-width: 620px !important;
    }

    th,
    td {
      padding: 10px 8px !important;
    }

    .catalog-list {
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
    }

    .catalog-item {
      gap: 10px !important;
      grid-template-columns: minmax(0, 1fr) minmax(160px, 190px) !important;
      padding: 10px !important;
    }

    .quote-status-board {
      gap: 10px !important;
      grid-template-columns: repeat(auto-fit, minmax(236px, 1fr)) !important;
    }

    .quote-status-column {
      max-height: calc(100dvh - 226px) !important;
      overflow: auto !important;
      padding: 10px !important;
    }

    .quote-card,
    .install-card,
    .client-mini {
      padding: 10px !important;
    }

    .quote-card .quote-record-actions,
    .quote-card .quote-status-actions,
    .card-actions,
    .dialog-actions,
    .address-actions {
      gap: 6px !important;
    }

    .quote-action-row,
    .quote-action-group.is-tools .quote-action-row {
      grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)) !important;
    }

    .form-grid,
    .address-grid,
    .permission-grid,
    .options {
      gap: 10px !important;
    }

    .address-builder,
    .item-builder,
    fieldset {
      padding: 10px !important;
    }

    .selected-items {
      max-height: 34dvh !important;
      overflow: auto !important;
      padding-right: 2px !important;
    }

    .selected-item {
      gap: 8px !important;
      grid-template-columns: minmax(0, 1.35fr) 84px 104px 94px 34px !important;
      padding: 8px !important;
    }

    dialog {
      max-height: calc(100dvh - 16px) !important;
      max-width: min(1120px, calc(100vw - 16px)) !important;
    }

    .dialog-card,
    dialog > div,
    .modal-card {
      max-height: calc(100dvh - 16px) !important;
      overflow: auto !important;
      padding: 14px !important;
    }

    .dialog-card.wide {
      width: min(1060px, calc(100vw - 16px)) !important;
    }

    .dialog-card.email-dialog {
      width: min(1160px, calc(100vw - 16px)) !important;
    }

    .dialog-card.client-dialog-card {
      width: min(900px, calc(100vw - 16px)) !important;
    }

    .email-preview {
      max-height: 48dvh !important;
    }

    .send-preview-dialog,
    .doc-edit-dialog {
      height: min(96dvh, calc(100vh - 16px)) !important;
      max-height: min(96dvh, calc(100vh - 16px)) !important;
      max-width: min(1160px, calc(100vw - 16px)) !important;
      width: min(1160px, calc(100vw - 16px)) !important;
    }

    .send-preview-card,
    .doc-edit-card {
      height: 100% !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }

    .send-preview-body,
    .doc-edit-body {
      max-height: none !important;
      min-height: 0 !important;
      overflow: auto !important;
    }

    .send-preview-email,
    .send-preview-attachment,
    .doc-edit-preview {
      max-height: none !important;
      min-height: 0 !important;
      overflow: auto !important;
    }

    .send-preview-attachment-frame,
    .doc-edit-preview-frame {
      max-width: min(100%, 820px) !important;
    }

    .send-preview-attachment-frame > div,
    .doc-edit-preview-frame > div {
      transform-origin: top center !important;
    }

    .doc-edit-lines {
      max-height: 32dvh !important;
      overflow: auto !important;
    }

    .doc-edit-line {
      grid-template-columns: minmax(140px, .9fr) minmax(180px, 1.3fr) 64px 92px 92px 34px !important;
    }

    .status-badge,
    .badge,
    [class*="badge"] {
      flex: 0 0 auto !important;
      max-width: 150px !important;
    }

    @media (max-width: 1180px) {
      .dashboard-grid,
      .work-grid,
      .accounting-grid {
        grid-template-columns: 1fr !important;
      }

      .quote-status-column {
        max-height: none !important;
      }
    }

    @media (max-width: 980px) {
      .app-shell {
        grid-template-columns: 1fr !important;
        height: auto !important;
        min-height: 100dvh !important;
        overflow: visible !important;
      }

      .sidebar {
        max-height: none !important;
        overflow: visible !important;
      }

      .main {
        height: auto !important;
        min-height: 100dvh !important;
        overflow: visible !important;
      }

      .search {
        width: 100% !important;
      }

      .top-actions {
        align-items: stretch !important;
        width: 100% !important;
      }
    }

    @media (max-width: 760px) {
      .main,
      .sidebar {
        padding: 14px !important;
      }

      .metrics,
      .dashboard-grid,
      .work-grid,
      .accounting-grid,
      .catalog-list,
      .quote-status-board,
      .install-board,
      .form-grid,
      .address-grid,
      .permission-grid,
      .options,
      .dialog-card.wide .form-grid,
      .dialog-card.client-dialog-card {
        grid-template-columns: 1fr !important;
      }

      .span-2,
      .address-grid label:first-child {
        grid-column: 1 / -1 !important;
      }

      .catalog-item,
      .selected-item,
      .doc-edit-line {
        grid-template-columns: 1fr !important;
      }

      table {
        min-width: 640px !important;
      }

      .send-preview-dialog,
      .doc-edit-dialog {
        border-radius: 0 !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        max-width: 100vw !important;
        width: 100vw !important;
      }

      .send-preview-body,
      .doc-edit-body {
        grid-template-columns: 1fr !important;
      }

      .send-preview-actions,
      .doc-edit-actions {
        align-items: stretch !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
      }

      .send-preview-actions button,
      .doc-edit-actions button,
      .card-actions button,
      .dialog-actions button {
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
