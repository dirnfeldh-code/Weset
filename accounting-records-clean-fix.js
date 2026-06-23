(() => {
  const invoiceStoreKey = "weset.invoices";
  const paymentStoreKey = "weset.client.payments";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function moneyText(value) {
    const amount = Number(value || 0);
    if (typeof formatMoney === "function") return formatMoney(amount);
    if (typeof money === "function") return money(amount);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(amount);
  }

  function dateText(value) {
    const raw = String(value || "").slice(0, 10);
    if (!raw) return "No date";
    if (typeof formatDate === "function") return formatDate(raw);
    if (typeof date === "function") return date(raw);
    return raw;
  }

  function clientById(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || { company: "Client", contact: "" };
  }

  function quoteRef(invoice) {
    const quoteId = invoice.quoteId || invoice.quote_id || "";
    const quote = (state.quotes || []).find((entry) => String(entry.id) === String(quoteId));
    if (quote?.id && typeof window.wesetQuoteRef === "function") return window.wesetQuoteRef(quote);
    if (quote?.id && /^Q-\d+/i.test(String(quote.id))) return String(quote.id).toUpperCase();
    return quoteId || "No quote";
  }

  function invoiceDate(invoice) {
    return invoice.paidAt || invoice.paid_at || invoice.sentAt || invoice.sent_at || invoice.createdAt || invoice.created_at || "";
  }

  function invoiceNumber(invoice) {
    return invoice.invoiceNumber || invoice.invoice_number || invoice.id || "Invoice";
  }

  function normalInvoice(invoice) {
    return {
      ...invoice,
      invoiceNumber: invoiceNumber(invoice),
      clientId: invoice.clientId || invoice.client_id || "",
      status: invoice.status || "Unpaid",
      subtotal: Number(invoice.subtotal || 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0)
    };
  }

  function paymentsForInvoice(number) {
    return readJson(paymentStoreKey, []).filter((payment) => (payment.invoiceNumber || payment.invoice_number) === number)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function statusFor(invoice) {
    if (invoice.status === "Cancelled") return "Cancelled";
    const paid = paymentsForInvoice(invoice.invoiceNumber);
    if (invoice.total && paid >= invoice.total - 0.005) return "Paid";
    if (paid > 0) return "Part paid";
    return invoice.status || "Unpaid";
  }

  function ensureStyles() {
    if (document.querySelector("#accountingRecordsCleanFixStyles")) return;
    const style = document.createElement("style");
    style.id = "accountingRecordsCleanFixStyles";
    style.textContent = `
      #paymentRestoreShortcut { display: none !important; }
      #accountingRecordsSection .payment-restore-shortcut { display: none !important; }
      .weset-expanded-backdrop {
        background: transparent !important;
      }
      dialog::backdrop,
      .report-dialog::backdrop,
      .client-history-dialog::backdrop,
      .invoice-created-dialog::backdrop,
      .stage-dialog::backdrop,
      .app-settings-dialog::backdrop {
        background: transparent !important;
      }
      .weset-expanded-window,
      dialog.weset-expanded-window {
        background: #fff !important;
        box-shadow: 0 10px 28px rgba(23, 37, 42, 0.12) !important;
        filter: none !important;
        opacity: 1 !important;
      }
      .weset-expanded-window .panel,
      .weset-expanded-window .report-table-wrap,
      .weset-expanded-window table,
      .weset-expanded-window tbody,
      .weset-expanded-window tr,
      .weset-expanded-window td {
        background-color: #fff !important;
        filter: none !important;
        opacity: 1 !important;
      }
      .weset-expanded-toolbar {
        background: #edf2f3 !important;
        color: #145c58 !important;
        border: 1px solid #d9e0e1 !important;
      }
      .weset-expanded-toolbar button {
        background: #fff !important;
        border: 1px solid #d9e0e1 !important;
        color: #145c58 !important;
      }
      #accountingReportsPanel .panel-head > .weset-expand-btn,
      #accountingRecordsSection .panel-head > .weset-expand-btn,
      #liveInvoicesTable.closest-panel-placeholder {
        display: none !important;
      }
      .accounting-inline-expand-btn {
        background: #edf2f3;
        border: 0;
        border-radius: 7px;
        color: #145c58;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        font-weight: 900;
        min-height: 34px;
        padding: 0 10px;
        white-space: nowrap;
      }
      .accounting-inline-expand-btn:hover { background: #dfe9ea; }
      .accounting-inline-expanded .report-table-wrap,
      .accounting-inline-expanded .table-wrap {
        max-height: none !important;
        overflow: auto !important;
      }
      #liveInvoicesTable tr.accounting-invoice-row {
        border-bottom: 1px solid var(--line, #d9e0e1);
      }
      #liveInvoicesTable td {
        line-height: 1.35;
      }
      .invoice-main-cell {
        display: grid;
        gap: 3px;
        min-width: 150px;
      }
      .invoice-main-cell strong,
      .invoice-client-cell strong {
        color: var(--ink, #1d2528);
      }
      .invoice-client-cell {
        display: grid;
        gap: 3px;
        min-width: 150px;
      }
      .invoice-money-cell {
        white-space: nowrap;
      }
      .invoice-row-actions {
        align-items: center !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 7px !important;
        justify-content: flex-start !important;
        min-width: 190px;
      }
      .invoice-row-actions button {
        border-radius: 7px !important;
        flex: 0 0 auto !important;
        font-size: 13px !important;
        font-weight: 850 !important;
        min-height: 34px !important;
        min-width: 58px !important;
        padding: 7px 10px !important;
        white-space: nowrap !important;
        width: auto !important;
      }
      .invoice-row-actions [data-record-invoice-payment] {
        background: #145c58 !important;
        color: #fff !important;
      }
      .invoice-detail-text {
        color: var(--muted, #687478);
        display: block;
        font-size: 12px;
        font-weight: 750;
        overflow-wrap: anywhere;
      }
      @media (max-width: 760px) {
        #liveInvoicesTable tr.accounting-invoice-row {
          display: grid !important;
          gap: 8px;
          grid-template-columns: 1fr;
        }
        #liveInvoicesTable tr.accounting-invoice-row td {
          display: grid !important;
          gap: 3px;
          padding: 7px 0 !important;
        }
        #liveInvoicesTable tr.accounting-invoice-row td::before {
          color: var(--muted, #687478);
          content: attr(data-label);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .invoice-row-actions {
          min-width: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function removePaymentShortcut() {
    document.querySelector("#paymentRestoreShortcut")?.remove();
    document.querySelectorAll(".payment-restore-shortcut").forEach((node) => node.remove());
  }

  function addInlineExpand(panel) {
    if (!panel || panel.dataset.accountingInlineExpandReady === "1") return;
    const head = panel.querySelector(":scope > .panel-head") || panel.querySelector(".panel-head");
    if (!head) return;
    head.querySelectorAll(".weset-expand-btn").forEach((button) => button.remove());
    panel.dataset.accountingInlineExpandReady = "1";
    const button = document.createElement("button");
    button.className = "accounting-inline-expand-btn";
    button.type = "button";
    button.textContent = "Show all";
    button.title = "Expand this records box in place";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      panel.classList.toggle("accounting-inline-expanded");
      button.textContent = panel.classList.contains("accounting-inline-expanded") ? "Show less" : "Show all";
    });
    head.appendChild(button);
  }

  function invoiceFromRow(row) {
    const viewButton = row.querySelector("[data-view-live-invoice]");
    const number = viewButton?.dataset.viewLiveInvoice || row.querySelector("[data-record-invoice-payment]")?.dataset.recordInvoicePayment || "";
    if (!number) return null;
    return readJson(invoiceStoreKey, []).map(normalInvoice).find((invoice) => invoice.invoiceNumber === number) || null;
  }

  function rebuildInvoiceRow(row) {
    if (row.dataset.accountingRecordClean === "1") return;
    const invoice = invoiceFromRow(row);
    if (!invoice) return;
    row.dataset.accountingRecordClean = "1";
    row.classList.add("accounting-invoice-row");
    const client = clientById(invoice.clientId);
    const number = escapeHtml(invoice.invoiceNumber);
    const status = statusFor(invoice);
    const paid = paymentsForInvoice(invoice.invoiceNumber);
    const due = Math.max(0, Number(invoice.total || 0) - paid);
    const canSend = !["Sent", "Part paid", "Paid", "Cancelled"].includes(status);
    const canPay = !["Paid", "Cancelled"].includes(status);
    row.innerHTML = `
      <td data-label="Invoice"><span class="invoice-main-cell"><strong>${number}</strong><span class="invoice-detail-text">${dateText(invoiceDate(invoice))}</span></span></td>
      <td data-label="Client"><span class="invoice-client-cell"><strong>${escapeHtml(client.company || client.contact || "Client")}</strong><span class="invoice-detail-text">${escapeHtml(client.email || client.phone || "")}</span></span></td>
      <td data-label="Quote">${escapeHtml(quoteRef(invoice))}</td>
      <td data-label="Status"><span class="badge ${escapeHtml(String(status).replaceAll(" ", "-"))}">${escapeHtml(status)}</span></td>
      <td data-label="Subtotal" class="invoice-money-cell">${moneyText(invoice.subtotal)}</td>
      <td data-label="VAT" class="invoice-money-cell">${moneyText(invoice.vatAmount)}</td>
      <td data-label="Total" class="invoice-money-cell"><strong>${moneyText(invoice.total)}</strong><span class="invoice-detail-text">Due: ${moneyText(due)}</span></td>
      <td data-label="Actions"><div class="invoice-row-actions">
        ${canSend ? `<button class="secondary" data-send-stored-invoice="${number}" type="button">Send</button>` : ""}
        ${canPay ? `<button class="secondary" data-record-invoice-payment="${number}" type="button">Pay</button>` : ""}
        <button class="secondary" data-view-live-invoice="${number}" type="button">View</button>
      </div></td>
    `;
  }

  function cleanInvoiceTable() {
    const table = document.querySelector("#liveInvoicesTable");
    if (!table) return;
    const panel = table.closest(".panel");
    panel?.querySelectorAll(":scope > .panel-head .weset-expand-btn").forEach((button) => button.remove());
    addInlineExpand(panel);
    panel?.querySelector(".report-table-wrap")?.style.setProperty("max-height", "min(58vh, 680px)");
    table.querySelectorAll("tr").forEach(rebuildInvoiceRow);
    const headRow = table.closest("table")?.querySelector("thead tr");
    if (headRow && headRow.dataset.accountingRecordClean !== "1") {
      headRow.dataset.accountingRecordClean = "1";
      headRow.innerHTML = "<th>Invoice</th><th>Client</th><th>Quote</th><th>Status</th><th>Subtotal</th><th>VAT</th><th>Total</th><th>Actions</th>";
    }
  }

  function cleanPaymentButtons() {
    document.querySelectorAll("[data-record-invoice-payment]").forEach((button) => {
      button.textContent = "Pay";
      button.title = "Record a payment for this invoice";
    });
    document.querySelectorAll("[data-mark-invoice-paid], [data-mark-invoice-paid-workflow]").forEach((button) => {
      button.textContent = "Pay";
      const number = button.dataset.markInvoicePaid || button.dataset.markInvoicePaidWorkflow || "";
      if (number) button.dataset.recordInvoicePayment = number;
      button.removeAttribute("data-mark-invoice-paid");
      button.removeAttribute("data-mark-invoice-paid-workflow");
    });
    document.querySelectorAll(".invoice-row-actions button").forEach((button) => {
      if (/record payment|payment|mark paid|paid/i.test(button.textContent.trim())) button.textContent = "Pay";
      if (button.matches("[data-view-live-invoice]")) button.textContent = "View";
      if (button.matches("[data-send-stored-invoice]")) button.textContent = "Send";
    });
  }

  function refresh() {
    ensureStyles();
    removePaymentShortcut();
    cleanInvoiceTable();
    cleanPaymentButtons();
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) {
    renderAccounting = function renderAccountingWithCleanRecords() {
      oldRenderAccounting();
      setTimeout(refresh, 0);
      setTimeout(refresh, 250);
    };
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-send-stored-invoice], [data-record-invoice-payment], [data-view-live-invoice], .accounting-inline-expand-btn")) return;
    setTimeout(refresh, 120);
  }, true);
  document.addEventListener("submit", () => setTimeout(refresh, 250), true);
  document.addEventListener("change", () => setTimeout(refresh, 120), true);
  window.addEventListener("hashchange", () => setTimeout(refresh, 250));
  setTimeout(refresh, 300);
  setTimeout(refresh, 1200);
})();
