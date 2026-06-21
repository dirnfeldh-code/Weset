(() => {
  const invoiceStoreKey = "weset.invoices";
  const paymentStoreKey = "weset.client.payments";
  const quoteSendStoreKey = "weset.quote.sends";
  let refreshQueued = false;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
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
    if (typeof date === "function") return date(raw);
    return raw;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function getClientSafe(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || { company: "Client", contact: "", email: "" };
  }

  function quoteTotal(quote) {
    if (typeof window.wesetQuoteTotals === "function") return Number(window.wesetQuoteTotals(quote).total || 0);
    if (typeof quoteCosts === "function") return Number(quoteCosts(quote).total || 0);
    return (quote.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || item.unit_cost || 0), 0);
  }

  function invoiceNumberOf(invoice) {
    return invoice.invoiceNumber || invoice.invoice_number || invoice.id || "";
  }

  function normalizeInvoice(invoice) {
    const number = invoiceNumberOf(invoice);
    return {
      ...invoice,
      id: invoice.id || number,
      invoiceNumber: number,
      quoteId: invoice.quoteId || invoice.quote_id || "",
      clientId: invoice.clientId || invoice.client_id || "",
      status: invoice.status || "Unpaid",
      subtotal: Number(invoice.subtotal || 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      html: invoice.html || invoice.invoice_html || "",
      createdAt: invoice.createdAt || invoice.created_at || "",
      sentAt: invoice.sentAt || invoice.sent_at || "",
      paidAt: invoice.paidAt || invoice.paid_at || ""
    };
  }

  function normalizePayment(payment) {
    return {
      ...payment,
      id: payment.id || crypto.randomUUID(),
      date: payment.date || payment.payment_date || today(),
      clientId: payment.clientId || payment.client_id || "",
      invoiceNumber: payment.invoiceNumber || payment.invoice_number || "",
      amount: Number(payment.amount || 0),
      method: payment.method || "Bank transfer",
      reference: payment.reference || "",
      notes: payment.notes || ""
    };
  }

  function invoices() {
    const map = new Map();
    readJson(invoiceStoreKey, []).map(normalizeInvoice).filter((invoice) => invoice.invoiceNumber).forEach((invoice) => {
      const old = map.get(invoice.invoiceNumber) || {};
      map.set(invoice.invoiceNumber, {
        ...old,
        ...invoice,
        createdAt: old.createdAt || invoice.createdAt,
        sentAt: invoice.sentAt || old.sentAt,
        paidAt: invoice.paidAt || old.paidAt,
        html: invoice.html || old.html
      });
    });
    return [...map.values()];
  }

  function payments() {
    const byId = new Set();
    const byMeaning = new Set();
    const rows = [];
    readJson(paymentStoreKey, []).map(normalizePayment).forEach((payment) => {
      const meaning = [payment.invoiceNumber, payment.date, Number(payment.amount || 0).toFixed(2), payment.method, payment.reference, payment.notes].join("|");
      if (byId.has(payment.id) || byMeaning.has(meaning)) return;
      byId.add(payment.id);
      byMeaning.add(meaning);
      rows.push(payment);
    });
    return rows;
  }

  function saveInvoices(rows) {
    writeJson(invoiceStoreKey, rows);
  }

  function savePayments(rows) {
    writeJson(paymentStoreKey, rows);
  }

  function paymentsForInvoice(invoiceNumber) {
    return payments().filter((payment) => payment.invoiceNumber === invoiceNumber).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function statusFromPayments(invoice) {
    if (invoice.status === "Cancelled") return "Cancelled";
    const total = Number(invoice.total || 0);
    const paid = paymentsForInvoice(invoice.invoiceNumber);
    if (total && paid >= total - 0.005) return "Paid";
    if (paid > 0) return "Part paid";
    if (invoice.sentAt || invoice.status === "Sent") return "Sent";
    return "Unpaid";
  }

  function repairChain() {
    const repairedInvoices = invoices().map((invoice) => {
      const status = statusFromPayments(invoice);
      return { ...invoice, status, paidAt: status === "Paid" ? (invoice.paidAt || new Date().toISOString()) : "" };
    });
    saveInvoices(repairedInvoices);
    savePayments(payments());
  }

  function quoteStats() {
    const quotes = state.quotes || [];
    const activeQuotes = quotes.filter((quote) => quote.status !== "Declined");
    const draft = activeQuotes.filter((quote) => quote.status === "Draft");
    const sent = activeQuotes.filter((quote) => quote.status === "Sent");
    const accepted = activeQuotes.filter((quote) => quote.status === "Accepted");
    return {
      count: activeQuotes.length,
      total: activeQuotes.reduce((sum, quote) => sum + quoteTotal(quote), 0),
      draftTotal: draft.reduce((sum, quote) => sum + quoteTotal(quote), 0),
      sentTotal: sent.reduce((sum, quote) => sum + quoteTotal(quote), 0),
      acceptedTotal: accepted.reduce((sum, quote) => sum + quoteTotal(quote), 0),
      draftCount: draft.length,
      sentCount: sent.length,
      acceptedCount: accepted.length
    };
  }

  function invoiceStats() {
    const rows = invoices();
    const paid = rows.filter((invoice) => statusFromPayments(invoice) === "Paid");
    const open = rows.filter((invoice) => !["Paid", "Cancelled"].includes(statusFromPayments(invoice)));
    return {
      total: rows.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      paid: paid.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      outstanding: open.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total || 0) - paymentsForInvoice(invoice.invoiceNumber)), 0),
      count: rows.length,
      paidCount: paid.length,
      openCount: open.length
    };
  }

  function paymentStats() {
    const rows = payments();
    return { count: rows.length, total: rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) };
  }

  function ensureStyles() {
    if (document.querySelector("#businessChainFixStyles")) return;
    const style = document.createElement("style");
    style.id = "businessChainFixStyles";
    style.textContent = `
      .business-chain-panel { margin-top: 14px; }
      .business-chain-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); }
      .business-chain-card { background: #f8fbfa; border: 1px solid var(--line,#d9e0e1); border-radius: 8px; min-height: 82px; padding: 12px; }
      .business-chain-card span { color: var(--muted,#687478); display: block; font-size: 12px; font-weight: 900; text-transform: uppercase; }
      .business-chain-card strong { display: block; font-size: 20px; line-height: 1.15; margin-top: 6px; overflow-wrap: anywhere; }
      .business-chain-card small { color: var(--muted,#687478); display: block; font-weight: 700; margin-top: 5px; }
      .business-chain-card.is-total { background: #e4f2ed; border-color: rgba(57,181,74,.32); }
      .business-chain-filter { align-items: end; display: grid; gap: 10px; grid-template-columns: minmax(220px, 1fr) auto auto; margin-top: 12px; }
      .business-chain-filter select, .business-chain-filter button { min-height: 38px; }
      .business-chain-note { background: #eef5f4; border: 1px solid var(--line,#d9e0e1); border-radius: 8px; color: #145c58; font-weight: 800; margin-top: 10px; padding: 9px 10px; }
      .client-history-section .client-history-table td, .client-history-section .client-history-table th { white-space: normal; }
      @media (max-width: 720px) { .business-chain-filter { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function ensureAccountingSummary() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting) return null;
    let panel = document.querySelector("#businessChainSummaryPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "businessChainSummaryPanel";
      panel.className = "panel business-chain-panel";
      panel.innerHTML = `
        <div class="panel-head"><div><h2>Quote, invoice and payment chain</h2><p class="meta">Shows quoted work, real invoice records, real payments, and what is still outstanding.</p></div></div>
        <div class="business-chain-grid" id="businessChainSummaryCards"></div>
        <div class="business-chain-filter">
          <label>Client records<select id="businessChainClientSelect"></select></label>
          <button class="secondary" id="businessChainOpenClient" type="button">Open client chain</button>
          <button class="secondary" id="businessChainRefresh" type="button">Refresh chain</button>
        </div>
        <div class="business-chain-note" id="businessChainNote">Invoice paid status is calculated from payment records, not from a loose paid button.</div>
      `;
      const metrics = document.querySelector("#accountingMetrics");
      if (metrics) metrics.insertAdjacentElement("afterend", panel);
      else accounting.prepend(panel);
      panel.querySelector("#businessChainOpenClient")?.addEventListener("click", () => {
        const clientId = document.querySelector("#businessChainClientSelect")?.value || "";
        if (!clientId) return;
        if (typeof window.wesetOpenClientHistory === "function") window.wesetOpenClientHistory(clientId);
      });
      panel.querySelector("#businessChainRefresh")?.addEventListener("click", () => {
        repairChain();
        refreshEverything("Chain refreshed from quotes, invoices and payments.");
      });
    }
    return panel;
  }

  function renderClientOptions() {
    const select = document.querySelector("#businessChainClientSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = (state.clients || []).map((client) => `<option value="${esc(client.id)}">${esc(client.company || client.contact || client.email || "Client")}</option>`).join("") || `<option value="">No clients yet</option>`;
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function renderAccountingSummary() {
    ensureStyles();
    ensureAccountingSummary();
    renderClientOptions();
    const quote = quoteStats();
    const invoice = invoiceStats();
    const payment = paymentStats();
    const cards = document.querySelector("#businessChainSummaryCards");
    if (!cards) return;
    cards.innerHTML = [
      ["Quotes", quote.total, `${quote.count} active quotes`, "is-total"],
      ["Sent quotes", quote.sentTotal, `${quote.sentCount} waiting for answer`, ""],
      ["Accepted quotes", quote.acceptedTotal, `${quote.acceptedCount} accepted works`, "is-total"],
      ["Invoices", invoice.total, `${invoice.count} invoice records`, ""],
      ["Paid invoices", invoice.paid, `${invoice.paidCount} fully paid`, "is-total"],
      ["Outstanding", invoice.outstanding, `${invoice.openCount} open invoices`, invoice.outstanding ? "" : "is-total"],
      ["Payments", payment.total, `${payment.count} payment records`, "is-total"]
    ].map(([label, value, note, className]) => `<article class="business-chain-card ${className}"><span>${esc(label)}</span><strong>${moneyText(value)}</strong><small>${esc(note)}</small></article>`).join("");
  }

  function recordQuoteSend(quoteId) {
    if (!quoteId) return;
    const quote = (state.quotes || []).find((entry) => String(entry.id) === String(quoteId));
    if (!quote) return;
    const rows = readJson(quoteSendStoreKey, []);
    rows.unshift({ id: crypto.randomUUID(), quoteId: quote.id, clientId: quote.clientId, sentAt: new Date().toISOString(), total: quoteTotal(quote) });
    writeJson(quoteSendStoreKey, rows.slice(0, 500));
  }

  function removeLoosePaidButtons() {
    document.querySelectorAll("[data-mark-invoice-paid], [data-mark-invoice-paid-workflow]").forEach((button) => {
      const number = button.dataset.markInvoicePaid || button.dataset.markInvoicePaidWorkflow || "";
      const replacement = document.createElement("button");
      replacement.className = "secondary";
      replacement.type = "button";
      replacement.dataset.recordInvoicePayment = number;
      replacement.textContent = "Record payment";
      button.replaceWith(replacement);
    });
  }

  function enhanceClientHistory(clientId) {
    const dialog = document.querySelector("#clientHistoryDialog");
    const body = document.querySelector("#clientHistoryBody");
    if (!dialog?.open || !body || !clientId) return;
    const clientInvoices = invoices().filter((invoice) => String(invoice.clientId) === String(clientId));
    const clientPayments = payments().filter((payment) => String(payment.clientId) === String(clientId) || clientInvoices.some((invoice) => invoice.invoiceNumber === payment.invoiceNumber));
    const totalQuoted = (state.quotes || []).filter((quote) => String(quote.clientId) === String(clientId)).reduce((sum, quote) => sum + quoteTotal(quote), 0);
    const totalInvoiced = clientInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const totalPaid = clientPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const outstanding = clientInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total || 0) - paymentsForInvoice(invoice.invoiceNumber)), 0);
    if (!body.querySelector("#clientChainSummaryCards")) {
      body.insertAdjacentHTML("afterbegin", `<div class="business-chain-grid" id="clientChainSummaryCards"></div>`);
    }
    const cards = body.querySelector("#clientChainSummaryCards");
    cards.innerHTML = [
      ["Total quoted", totalQuoted],
      ["Total invoiced", totalInvoiced],
      ["Total paid", totalPaid],
      ["Outstanding", outstanding]
    ].map(([label, value]) => `<article class="business-chain-card"><span>${esc(label)}</span><strong>${moneyText(value)}</strong></article>`).join("");
  }

  function refreshEverything(message = "") {
    renderAccountingSummary();
    removeLoosePaidButtons();
    if (typeof window.wesetRefreshAccountingReports === "function") window.wesetRefreshAccountingReports();
    if (typeof renderAccounting === "function") setTimeout(renderAccounting, 80);
    if (message) {
      const note = document.querySelector("#businessChainNote");
      if (note) note.textContent = message;
    }
  }

  function scheduleRefresh(delay = 0) {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      repairChain();
      refreshEverything();
    }, delay);
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) {
    renderAccounting = function renderAccountingWithBusinessChain() {
      oldRenderAccounting();
      setTimeout(() => {
        repairChain();
        renderAccountingSummary();
        removeLoosePaidButtons();
      }, 0);
    };
  }

  const oldUpdateQuote = typeof updateQuote === "function" ? updateQuote : null;
  if (oldUpdateQuote) {
    updateQuote = function updateQuoteWithChain(id, patch) {
      const result = oldUpdateQuote(id, patch);
      if (patch?.status === "Sent") recordQuoteSend(id);
      scheduleRefresh(180);
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    const confirm = event.target.closest?.("#sendPreviewConfirm");
    const sendQuote = event.target.closest?.("[data-send-quote]");
    const paid = event.target.closest?.("[data-mark-invoice-paid], [data-mark-invoice-paid-workflow]");
    if (confirm?.dataset.kind === "Quote") recordQuoteSend(confirm.dataset.quote);
    if (sendQuote?.dataset.sendQuote) recordQuoteSend(sendQuote.dataset.sendQuote);
    if (paid) {
      event.preventDefault();
      event.stopPropagation();
      const number = paid.dataset.markInvoicePaid || paid.dataset.markInvoicePaidWorkflow || "";
      paid.removeAttribute("data-mark-invoice-paid");
      paid.removeAttribute("data-mark-invoice-paid-workflow");
      paid.dataset.recordInvoicePayment = number;
      paid.textContent = "Record payment";
      paid.click();
    }
    setTimeout(() => {
      const openDialog = document.querySelector("#clientHistoryDialog[open]");
      const title = openDialog?.querySelector("#clientHistoryTitle")?.textContent || "";
      const client = (state.clients || []).find((entry) => (entry.company || "") === title);
      if (client) enhanceClientHistory(client.id);
      scheduleRefresh(0);
    }, 220);
  }, true);

  document.addEventListener("change", () => scheduleRefresh(220), true);
  document.addEventListener("submit", () => scheduleRefresh(450), true);
  window.addEventListener("storage", () => scheduleRefresh(50));

  window.wesetRepairBusinessChain = () => {
    repairChain();
    refreshEverything("Business chain repaired: duplicate records removed and invoice status recalculated from payments.");
    return { quotes: quoteStats(), invoices: invoiceStats(), payments: paymentStats() };
  };

  setTimeout(() => { repairChain(); refreshEverything("Quote totals, invoice records and client payments are linked here."); }, 650);
  setTimeout(() => { repairChain(); refreshEverything(); }, 2200);
})();
