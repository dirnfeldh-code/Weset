(() => {
  function ensureStyles() {
    if (document.querySelector("#appProfessionalPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "appProfessionalPolishStyles";
    style.textContent = `
      body {
        font-family: Arial, Helvetica, sans-serif;
        text-rendering: optimizeLegibility;
      }
      p, span, strong, small, label, td, th, h1, h2, h3, h4, button, input, select, textarea {
        hyphens: manual !important;
        overflow-wrap: break-word !important;
        word-break: normal !important;
      }
      button,
      .badge,
      .nav-item,
      .accounting-workspace-nav button,
      .invoice-row-actions button,
      .quote-record-actions button,
      .card-actions button,
      .dialog-actions button,
      .send-preview-actions button {
        overflow-wrap: normal !important;
        text-wrap: balance;
        word-break: normal !important;
      }
      button {
        box-shadow: none;
        letter-spacing: 0 !important;
        transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
      }
      button:hover:not([disabled]) {
        box-shadow: 0 3px 10px rgba(23, 37, 42, .07);
      }
      button:active:not([disabled]) {
        transform: none;
      }
      .view {
        min-width: 0;
      }
      .panel,
      .metric-card,
      .quote-card,
      .catalog-item,
      .client-history-section,
      .business-chain-card,
      .report-mini-card,
      .payment-card {
        border-color: rgba(20, 92, 88, .14) !important;
        box-shadow: 0 10px 26px rgba(23, 37, 42, .07) !important;
      }
      .panel {
        background: rgba(255, 255, 255, .96) !important;
      }
      .panel-head {
        align-items: flex-start;
        gap: 12px;
      }
      .panel-head h1,
      .panel-head h2,
      .panel-head h3 {
        line-height: 1.18;
        margin: 0;
      }
      .panel-head .meta,
      .meta {
        line-height: 1.38;
      }
      .table-wrap,
      .report-table-wrap {
        border-radius: 8px;
      }
      table {
        border-collapse: separate;
        border-spacing: 0;
      }
      th {
        color: #365358;
        font-size: 12px;
        letter-spacing: 0 !important;
        line-height: 1.25;
        white-space: nowrap;
      }
      td {
        line-height: 1.38;
      }
      tr {
        background: #fff;
      }
      tr + tr td {
        border-top-color: rgba(20, 92, 88, .12) !important;
      }
      .badge {
        align-items: center;
        border: 1px solid rgba(20, 92, 88, .12);
        display: inline-flex;
        line-height: 1.15;
        min-height: 24px;
        white-space: nowrap;
      }
      dialog {
        background: #f5faf8 !important;
        border: 1px solid rgba(20, 92, 88, .18) !important;
        border-radius: 10px !important;
        box-shadow: 0 14px 42px rgba(23, 37, 42, .16) !important;
        color: var(--ink, #1d2528);
      }
      dialog::backdrop,
      .report-dialog::backdrop,
      .client-history-dialog::backdrop,
      .invoice-created-dialog::backdrop,
      .stage-dialog::backdrop,
      .app-settings-dialog::backdrop {
        background: rgba(232, 243, 241, .34) !important;
        backdrop-filter: blur(1px);
      }
      .dialog-card,
      .client-history-card,
      .invoice-created-card,
      .stage-dialog-card,
      .app-settings-card {
        background: #f5faf8 !important;
        border-radius: 10px !important;
        overflow: hidden;
      }
      .dialog-card > *:not(.panel-head),
      .client-history-card > *:not(.panel-head),
      .invoice-created-body,
      .stage-dialog-body,
      .report-dialog-body,
      .app-settings-body {
        background: #fff;
      }
      .report-dialog-body,
      .client-history-body,
      .stage-dialog-body,
      .app-settings-body {
        border-top: 1px solid rgba(20, 92, 88, .12);
      }
      .weset-expanded-window {
        background: #f5faf8 !important;
        border: 1px solid rgba(20, 92, 88, .18) !important;
        box-shadow: 0 14px 42px rgba(23, 37, 42, .14) !important;
      }
      .weset-expanded-window > .table-wrap,
      .weset-expanded-window .report-table-wrap,
      .weset-expanded-window .catalog-list,
      .weset-expanded-window .list,
      .weset-expanded-window .timeline,
      .weset-expanded-window .install-board,
      .weset-expanded-window .selected-items {
        background: #fff;
        border: 1px solid rgba(20, 92, 88, .12);
        border-radius: 8px;
      }
      .weset-expanded-toolbar {
        background: #e8f3f1 !important;
        border: 1px solid rgba(20, 92, 88, .16) !important;
        color: #145c58 !important;
      }
      .weset-expanded-toolbar button {
        background: #fff !important;
        border: 1px solid rgba(20, 92, 88, .16) !important;
        color: #145c58 !important;
      }
      input, select, textarea {
        border-color: rgba(20, 92, 88, .2) !important;
        border-radius: 7px !important;
      }
      input:focus, select:focus, textarea:focus {
        box-shadow: 0 0 0 3px rgba(57, 181, 74, .16);
        outline: 1px solid rgba(20, 92, 88, .35);
      }
      .card-actions,
      .quote-record-actions,
      .invoice-row-actions,
      .payment-row-actions,
      .expense-row-actions,
      .item-catalog-actions,
      .client-row-actions,
      .dialog-actions,
      .send-preview-actions,
      .doc-edit-actions,
      .stage-action-row {
        gap: 8px !important;
      }
      @media (max-width: 760px) {
        .panel {
          padding: 14px !important;
        }
        .panel-head {
          display: grid !important;
        }
        th {
          white-space: normal;
        }
        button {
          text-wrap: wrap;
        }
        dialog {
          max-width: calc(100vw - 18px) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function tidyTextNodes() {
    document.querySelectorAll("button, th, .badge, .meta, td, h1, h2, h3").forEach((node) => {
      if (node.childElementCount) return;
      const clean = node.textContent.replace(/\s+/g, " ").trim();
      if (clean && clean !== node.textContent) node.textContent = clean;
    });
  }

  function polish() {
    ensureStyles();
    tidyTextNodes();
  }

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(polish, 80);
    };
  })();

  document.addEventListener("input", schedule, true);
  window.addEventListener("hashchange", () => setTimeout(polish, 160));
  if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  setTimeout(polish, 100);
  setTimeout(polish, 900);
})();
