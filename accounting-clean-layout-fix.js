(() => {
  function ensureStyles() {
    if (document.querySelector("#accountingCleanLayoutFixStyles")) return;
    const style = document.createElement("style");
    style.id = "accountingCleanLayoutFixStyles";
    style.textContent = `
      #accountingView {
        gap: 14px;
      }
      #accountingReportsPanel {
        overflow: hidden;
      }
      #accountingReportsPanel .panel-head,
      #vatSummaryPanel .panel-head,
      #expenseCategoryManager .panel-head {
        align-items: start;
        gap: 12px;
      }
      #accountingReportsPanel .panel-head h2,
      #vatSummaryPanel .panel-head h2,
      #expenseCategoryManager .panel-head h2 {
        line-height: 1.2;
        margin: 0;
      }
      .accounting-report-controls label {
        min-width: 0;
      }
      .accounting-report-controls input,
      .accounting-report-controls select {
        min-width: 0;
        width: 100%;
      }
      .report-summary-grid {
        align-items: stretch;
      }
      .report-mini-card {
        display: grid;
        gap: 4px;
        min-height: 72px;
      }
      .report-mini-card strong {
        align-self: end;
        line-height: 1.15;
      }
      .accounting-live-grid > .panel {
        align-content: start;
        min-width: 0;
      }
      .report-line {
        min-height: 38px;
      }
      .report-line span,
      .vat-summary-row span {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .report-line strong,
      .vat-summary-row strong {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .vat-summary-list .meta,
      #balanceSheetReport .meta,
      #accountingReportSource {
        line-height: 1.35;
      }
      #accountingReportSource {
        margin-bottom: 0;
      }
      .expense-vat-preview {
        align-self: center;
        line-height: 1.35;
      }
      .expense-vat-note {
        background: #eef5f4;
        border-radius: 6px;
        display: inline-block !important;
        margin-top: 6px !important;
        padding: 3px 6px;
      }
      .invoice-row-actions,
      #expensesTable .expense-row-actions {
        align-items: center;
      }
      .invoice-row-actions button,
      #expensesTable .expense-row-actions button,
      .expense-vat-button {
        border-radius: 7px !important;
        min-height: 34px;
        padding: 7px 10px !important;
      }
      .report-table-wrap table th,
      .report-table-wrap table td {
        vertical-align: top;
      }
      .report-table-wrap table th:last-child,
      .report-table-wrap table td:last-child {
        min-width: 160px;
      }
      @media (min-width: 1120px) {
        .accounting-live-grid {
          grid-template-columns: minmax(520px, 1.45fr) minmax(320px, 1fr);
        }
        .accounting-live-grid > .panel:first-child {
          grid-row: span 3;
        }
      }
      @media (max-width: 760px) {
        #accountingReportsPanel .panel-head,
        #vatSummaryPanel .panel-head,
        #expenseCategoryManager .panel-head {
          align-items: stretch;
          display: grid;
        }
        #accountingReportsPanel .panel-head button,
        .accounting-live-grid .panel-head button {
          width: 100%;
        }
        .report-mini-card {
          min-height: 62px;
        }
        .report-line,
        .vat-summary-row {
          align-items: flex-start;
          display: grid;
          gap: 4px;
        }
        .report-line strong,
        .vat-summary-row strong {
          text-align: left;
          white-space: normal;
        }
        .report-table-wrap table {
          min-width: 700px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function tidyVatHelpText() {
    document.querySelectorAll("#vatSummaryList .meta").forEach((node) => {
      if (node.dataset.cleanLayoutFixed) return;
      node.dataset.cleanLayoutFixed = "true";
      node.textContent = node.textContent.replace("Expense VAT is calculated as amount before VAT x VAT rate.", "Expense VAT uses the amount before VAT x VAT rate.");
    });
  }

  function refresh() {
    ensureStyles();
    tidyVatHelpText();
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithCleanLayout() { oldRenderAccounting(); setTimeout(refresh, 0); };

  document.addEventListener("click", () => setTimeout(refresh, 150), true);
  document.addEventListener("input", refresh, true);
  refresh();
})();
