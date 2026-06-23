(() => {
  function ensureStyles() {
    if (document.querySelector("#appQualityCleanupStyles")) return;
    const style = document.createElement("style");
    style.id = "appQualityCleanupStyles";
    style.textContent = `
      .login-card > p:last-child {
        display: none !important;
      }
      button {
        max-width: 100%;
        overflow-wrap: normal;
        text-align: center;
      }
      button:not(.app-icon-action):not(.icon-btn) {
        min-height: 36px;
      }
      .top-actions button,
      .card-actions button,
      .quote-record-actions button,
      .invoice-row-actions button,
      .payment-row-actions button,
      .expense-row-actions button,
      .item-catalog-actions button,
      .client-row-actions button,
      .dialog-actions button,
      .send-preview-actions button,
      .doc-edit-actions button,
      .stage-action-row button {
        border-radius: 7px !important;
        flex: 0 1 auto;
        line-height: 1.15;
        min-width: 0 !important;
        white-space: normal !important;
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
        align-items: center !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 7px !important;
      }
      .status-move-button.is-current,
      .accounting-workspace-nav button.is-active {
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.28);
      }
      button.danger,
      .ghost.danger {
        background: #fff !important;
        border-color: #efc7c7 !important;
        color: #9b1c1c !important;
      }
      button.danger:hover,
      .ghost.danger:hover {
        background: #fff1f1 !important;
      }
      button[disabled] {
        cursor: not-allowed !important;
        opacity: .58 !important;
      }
      .clean-hidden {
        display: none !important;
      }
      .clean-action-note {
        color: var(--muted,#687478);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
        margin-top: 6px;
      }
      .panel-head button {
        flex-shrink: 0;
      }
      @media (max-width: 760px) {
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
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
        }
        .card-actions button,
        .quote-record-actions button,
        .invoice-row-actions button,
        .payment-row-actions button,
        .expense-row-actions button,
        .item-catalog-actions button,
        .client-row-actions button,
        .dialog-actions button,
        .send-preview-actions button,
        .doc-edit-actions button,
        .stage-action-row button {
          width: 100% !important;
        }
      }
      @media (max-width: 480px) {
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
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function label(button, text) {
    if (!button || !text || button.textContent.trim() === text) return;
    button.textContent = text;
  }

  function normalizeButtonLabels() {
    document.querySelectorAll("button").forEach((button) => {
      const text = button.textContent.trim().replace(/\s+/g, " ");
      const lower = text.toLowerCase();

      if (lower === "send from app" || lower === "prepare email") label(button, "Send quote");
      if (lower === "confirm & send") label(button, "Send now");
      if (lower === "go back") label(button, "Back");
      if (lower === "save and print pdf") label(button, "Save & PDF");
      if (lower === "print / save pdf") label(button, "PDF");
      if (lower === "copy invoice text") label(button, "Copy");
      if (lower === "apply filters") label(button, "Apply");
      if (lower === "export balance sheet") label(button, "Export balance");
      if (lower === "create / record") label(button, "Create & record");
      if (lower === "open payment form") label(button, "Record payment");
      if (lower === "paid" || lower === "mark paid" || lower === "payment") label(button, "Record payment");
      if (lower === "view invoice") label(button, "View");
      if (lower === "delete user") label(button, "Delete");
      if (lower === "edit user") label(button, "Edit");

      if (button.matches("[data-delete-quote], [data-delete-item], [data-delete-user], [data-delete-expense], [data-delete-client-payment], [data-delete-vat-payment], [data-delete-category]")) {
        button.classList.add("danger");
      }
      if (button.matches("[data-stage-send-quote], [data-send-in-app]")) {
        label(button, "Send quote");
        button.classList.add("primary");
      }
      if (button.matches("[data-stage-invoice-quote], [data-invoice-quote]") && !/open invoice/i.test(button.textContent)) {
        label(button, "Create invoice");
      }
      if (button.matches("[data-record-invoice-payment], [data-mark-invoice-paid], [data-mark-invoice-paid-workflow]")) {
        label(button, "Record payment");
      }
    });
  }

  function removeConfusingOldControls() {
    document.querySelectorAll("[data-send-quote]").forEach((button) => {
      if (/prepare email/i.test(button.textContent || "")) button.remove();
    });
    document.querySelectorAll(".login-card > p").forEach((paragraph) => {
      if (/login:\s*info@weset\.co\.uk/i.test(paragraph.textContent || "")) paragraph.remove();
    });
  }

  function deDuplicateActions() {
    document.querySelectorAll(".card-actions, .quote-record-actions, .invoice-row-actions, .payment-row-actions, .expense-row-actions, .item-catalog-actions, .client-row-actions").forEach((group) => {
      const seen = new Set();
      [...group.querySelectorAll("button")].forEach((button) => {
        const key = [
          button.dataset.stageSendQuote && `send-quote:${button.dataset.stageSendQuote}`,
          button.dataset.sendInApp && `send-quote:${button.dataset.sendInApp}`,
          button.dataset.stageInvoiceQuote && `invoice:${button.dataset.stageInvoiceQuote}`,
          button.dataset.invoiceQuote && `invoice:${button.dataset.invoiceQuote}`,
          button.dataset.recordInvoicePayment && `payment:${button.dataset.recordInvoicePayment}`,
          button.dataset.markInvoicePaid && `payment:${button.dataset.markInvoicePaid}`,
          button.dataset.viewLiveInvoice && `view-invoice:${button.dataset.viewLiveInvoice}`,
          button.dataset.deleteQuote && `delete-quote:${button.dataset.deleteQuote}`,
          button.dataset.editQuote && `edit-quote:${button.dataset.editQuote}`,
          button.dataset.editDocument && `edit-document:${button.dataset.editDocument}:${button.dataset.documentKind || ""}`,
          button.textContent.trim()
        ].filter(Boolean)[0];
        if (!key) return;
        if (seen.has(key)) button.remove();
        else seen.add(key);
      });
    });
  }

  function addDisabledNotes() {
    document.querySelectorAll("[data-stage-invoice-quote][disabled]").forEach((button) => {
      const card = button.closest(".quote-card");
      if (!card || card.querySelector(".clean-action-note")) return;
      button.insertAdjacentHTML("afterend", `<span class="clean-action-note">Accept the quote before creating an invoice.</span>`);
    });
  }

  function makeCloseButtonsConsistent() {
    document.querySelectorAll("dialog button[aria-label='Close'], dialog .icon-btn").forEach((button) => {
      if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", "Close");
      if (!button.getAttribute("title")) button.setAttribute("title", "Close");
      if (button.textContent.trim().toLowerCase() === "x") button.textContent = "x";
    });
  }

  function cleanup() {
    ensureStyles();
    removeConfusingOldControls();
    normalizeButtonLabels();
    deDuplicateActions();
    addDisabledNotes();
    makeCloseButtonsConsistent();
  }

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(cleanup, 90);
    };
  })();

  document.addEventListener("input", schedule, true);
  window.addEventListener("hashchange", () => setTimeout(cleanup, 160));
  if (document.body) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  setTimeout(cleanup, 120);
  setTimeout(cleanup, 900);
})();
