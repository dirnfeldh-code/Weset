(() => {
  let tidyQueued = false;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function quoteById(id) {
    return (state.quotes || []).find((quote) => String(quote.id) === String(id));
  }

  function clientById(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || null;
  }

  function clientName(client) {
    return String(client?.company || client?.contact || client?.email || "Client").trim() || "Client";
  }

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => String(entry.id) === raw);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function quoteTotal(quote) {
    if (typeof window.wesetQuoteTotals === "function") return Number(window.wesetQuoteTotals(quote).total || 0);
    if (typeof quoteCosts === "function") return Number(quoteCosts(quote).total || 0);
    return (quote.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || item.unit_cost || 0), 0);
  }

  function moneyText(value) {
    const amount = Number(value || 0);
    if (typeof formatMoney === "function") return formatMoney(amount);
    if (typeof money === "function") return money(amount);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(amount);
  }

  function quoteIdFromCard(card) {
    const statusButton = card.querySelector("[data-status]")?.dataset.status || "";
    if (statusButton) return statusButton.split(":")[0];
    return card.querySelector("[data-send-quote], [data-edit-quote], [data-delete-quote], [data-invoice-quote]")?.dataset.sendQuote
      || card.querySelector("[data-edit-quote]")?.dataset.editQuote
      || card.querySelector("[data-delete-quote]")?.dataset.deleteQuote
      || card.querySelector("[data-invoice-quote]")?.dataset.invoiceQuote
      || "";
  }

  function ensureStyles() {
    if (document.querySelector("#readabilityActionsFixStyles")) return;
    const style = document.createElement("style");
    style.id = "readabilityActionsFixStyles";
    style.textContent = `
      .clean-record-title { display: grid; gap: 3px; line-height: 1.2; }
      .clean-record-title strong { color: var(--ink,#1d2528); font-size: 16px; overflow-wrap: anywhere; }
      .clean-record-ref { color: var(--muted,#687478); display: block; font-size: 12px; font-weight: 800; letter-spacing: 0; text-transform: none; }
      .quote-card h3, .catalog-item h3, td strong { line-height: 1.22; }
      .card-actions, .invoice-row-actions, .quote-record-actions, .item-catalog-actions, .client-row-actions, .payment-row-actions, .expense-row-actions { align-items: center !important; display: flex !important; flex-wrap: wrap !important; gap: 7px !important; justify-content: flex-start !important; }
      .card-actions button, .invoice-row-actions button, .quote-record-actions button, .item-catalog-actions button, .client-row-actions button, .payment-row-actions button, .expense-row-actions button { border-radius: 7px !important; min-height: 34px !important; padding: 7px 10px !important; white-space: nowrap !important; width: auto !important; }
      .invoice-row-actions button, .report-table-wrap td:last-child button { min-width: 72px; }
      .report-table-wrap table, .table-wrap table { border-collapse: collapse; }
      .report-table-wrap td, .report-table-wrap th, .table-wrap td, .table-wrap th { line-height: 1.35; vertical-align: top; }
      .report-table-wrap td:not(:last-child), .table-wrap td:not(:last-child) { overflow-wrap: anywhere; }
      .badge { max-width: 100%; overflow-wrap: anywhere; white-space: normal !important; }
      .clean-hidden-action { display: none !important; }
      @media (max-width: 760px) { .card-actions button, .invoice-row-actions button, .quote-record-actions button, .client-row-actions button { flex: 1 1 auto; } }
    `;
    document.head.appendChild(style);
  }

  function renameButton(button) {
    if (!button || button.dataset.cleanActionFixed === "1") return;
    const text = button.textContent.trim().toLowerCase();
    if (button.matches("[data-send-quote]") || text === "prepare email") button.textContent = "Send quote";
    if (button.matches("[data-send-stored-invoice]") || text === "send") button.textContent = "Send invoice";
    if (button.matches("[data-record-invoice-payment]") || text === "payment" || text === "mark paid" || text === "paid") button.textContent = "Record payment";
    if (text === "accept") button.textContent = "Mark accepted";
    if (text === "decline") button.textContent = "Decline";
    if (text === "quote") button.textContent = "New quote";
    if (text === "history") button.textContent = "Client records";
    if (button.matches("[data-view-live-invoice]") || text === "view") button.textContent = "View";
    button.dataset.cleanActionFixed = "1";
  }

  function cleanQuoteCards() {
    document.querySelectorAll(".quote-card").forEach((card) => {
      const id = quoteIdFromCard(card);
      const quote = quoteById(id);
      if (quote) {
        const client = clientById(quote.clientId);
        const title = card.querySelector("h3");
        if (title && title.dataset.cleanTitleFixed !== quote.id) {
          title.classList.add("clean-record-title");
          title.innerHTML = `<strong>${esc(clientName(client))}</strong><span class="clean-record-ref">Quote ${esc(quoteRef(quote))} | ${esc(moneyText(quoteTotal(quote)))}</span>`;
          title.dataset.cleanTitleFixed = quote.id;
        }
      }
      card.querySelectorAll("[data-status]").forEach((button) => {
        const target = button.dataset.status?.split(":")[1] || "";
        if (target === "Sent") button.remove();
        else renameButton(button);
      });
      card.querySelectorAll("button").forEach(renameButton);
    });
  }

  function cleanClientRows() {
    document.querySelectorAll("[data-new-quote]").forEach((button) => renameButton(button));
    document.querySelectorAll("[data-client-history]").forEach((button) => renameButton(button));
  }

  function cleanSalesRows() {
    const tbody = document.querySelector("#salesTable");
    if (!tbody) return;
    [...tbody.querySelectorAll("tr")].forEach((row) => {
      const first = row.cells?.[0];
      const clientCell = row.cells?.[1];
      if (!first || first.dataset.cleanRefFixed === "1") return;
      const raw = first.textContent.trim();
      const quote = quoteById(raw);
      if (!quote) return;
      first.innerHTML = `<strong>${esc(quoteRef(quote))}</strong><span class="clean-record-ref">Quote record</span>`;
      if (clientCell && !clientCell.textContent.trim()) clientCell.textContent = clientName(clientById(quote.clientId));
      first.dataset.cleanRefFixed = "1";
    });
  }

  function cleanInvoiceRows() {
    document.querySelectorAll(".invoice-row-actions").forEach((actions) => {
      actions.querySelectorAll("[data-mark-invoice-paid], [data-mark-invoice-paid-workflow]").forEach((button) => {
        const invoiceNumber = button.dataset.markInvoicePaid || button.dataset.markInvoicePaidWorkflow || "";
        button.removeAttribute("data-mark-invoice-paid");
        button.removeAttribute("data-mark-invoice-paid-workflow");
        button.dataset.recordInvoicePayment = invoiceNumber;
      });
      actions.querySelectorAll("button").forEach((button) => {
        renameButton(button);
        const label = button.textContent.trim().toLowerCase();
        if (label === "mark sent" || label === "paid") button.remove();
      });
    });

    const table = document.querySelector("#liveInvoicesTable");
    if (!table) return;
    [...table.querySelectorAll("tr")].forEach((row) => {
      const numberCell = row.cells?.[0];
      const clientCell = row.cells?.[1];
      const quoteCell = row.cells?.[2];
      if (!numberCell || numberCell.dataset.cleanInvoiceFixed === "1") return;
      const number = numberCell.textContent.trim();
      const client = clientCell?.textContent.trim() || "Client";
      const quote = quoteCell?.textContent.trim() || "Quote";
      numberCell.innerHTML = `<strong>${esc(client)}</strong><span class="clean-record-ref">Invoice ${esc(number)} | ${esc(quote)}</span>`;
      numberCell.dataset.cleanInvoiceFixed = "1";
    });
  }

  function cleanReportButtons() {
    document.querySelectorAll("[data-export-report='pl']").forEach((button) => { button.textContent = "Export P&L"; });
    document.querySelectorAll("[data-export-report='balance']").forEach((button) => { button.textContent = "Export balance sheet"; });
    document.querySelectorAll("[data-export-report='vat']").forEach((button) => { button.textContent = "Export VAT"; });
    document.querySelectorAll("[data-export-report='invoices']").forEach((button) => { button.textContent = "Export invoices"; });
    document.querySelectorAll("button").forEach(renameButton);
  }

  function tidy() {
    tidyQueued = false;
    ensureStyles();
    cleanQuoteCards();
    cleanClientRows();
    cleanSalesRows();
    cleanInvoiceRows();
    cleanReportButtons();
  }

  function scheduleTidy(delay = 0) {
    if (tidyQueued) return;
    tidyQueued = true;
    setTimeout(tidy, delay);
  }

  const oldRender = typeof render === "function" ? render : null;
  if (oldRender) render = function renderWithReadableActions(...args) { const result = oldRender.apply(this, args); scheduleTidy(0); return result; };

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithReadableActions(...args) { const result = oldRenderAccounting.apply(this, args); scheduleTidy(0); return result; };

  document.addEventListener("click", () => scheduleTidy(120), true);
  document.addEventListener("change", () => scheduleTidy(120), true);
  const observer = new MutationObserver(() => scheduleTidy(120));
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleTidy(350);
})();
