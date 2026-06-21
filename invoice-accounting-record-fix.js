(() => {
  const invoiceStoreKey = "weset.invoices";

  function readInvoices() {
    try { return JSON.parse(localStorage.getItem(invoiceStoreKey) || "[]"); } catch { return []; }
  }

  function saveInvoices(invoices) {
    localStorage.setItem(invoiceStoreKey, JSON.stringify(invoices));
  }

  function quoteById(id) {
    return (state.quotes || []).find((quote) => String(quote.id) === String(id));
  }

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function invoiceNumber(quote) {
    return `INV-${quoteRef(quote).replace(/^Q-?/i, "")}`;
  }

  function totalsForQuote(quote) {
    if (typeof window.wesetQuoteTotals === "function") return window.wesetQuoteTotals(quote);
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { total: 0 };
    return { subtotal: Number(costs.total || 0), vatEnabled: false, vatRate: 0, vatAmount: 0, total: Number(costs.total || 0) };
  }

  function invoiceHtmlForQuote(quote) {
    if (typeof window.wesetQuoteInvoiceHtml === "function") return window.wesetQuoteInvoiceHtml(quote);
    return `<div><h1>Invoice ${invoiceNumber(quote)}</h1></div>`;
  }

  function invoiceRecord(quote, status = "Sent") {
    const totals = totalsForQuote(quote);
    const now = new Date().toISOString();
    return {
      id: invoiceNumber(quote),
      invoiceNumber: invoiceNumber(quote),
      quoteId: quote.id,
      clientId: quote.clientId,
      status,
      subtotal: Number(totals.subtotal || 0),
      vatEnabled: Boolean(totals.vatEnabled),
      vatRate: Number(totals.vatRate || 0),
      vatAmount: Number(totals.vatAmount || 0),
      total: Number(totals.total || 0),
      html: invoiceHtmlForQuote(quote),
      createdAt: now,
      sentAt: now
    };
  }

  async function saveInvoiceToSupabase(record) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    const body = {
      quote_id: record.quoteId,
      client_id: record.clientId,
      invoice_number: record.invoiceNumber,
      status: record.status,
      subtotal: record.subtotal,
      vat_enabled: record.vatEnabled,
      vat_rate: record.vatRate,
      vat_amount: record.vatAmount,
      total: record.total,
      invoice_html: record.html,
      sent_at: record.sentAt || null
    };
    try {
      const existing = await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(record.invoiceNumber)}&select=id`);
      if (existing?.length) await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(record.invoiceNumber)}`, { method: "PATCH", body });
      else await sbRequest("invoices", { method: "POST", body });
    } catch (error) {
      console.warn("Invoice accounting record could not be saved to Supabase", error);
    }
  }

  function refreshInvoiceAccounting(invoiceNumber) {
    if (typeof window.wesetRefreshInvoiceRecognition === "function") {
      window.wesetRefreshInvoiceRecognition(`Invoice ${invoiceNumber} is recorded in Accounting and ready for client payments.`);
    }
    if (typeof window.wesetRefreshAccountingReports === "function") window.wesetRefreshAccountingReports();
    if (typeof renderAccounting === "function") setTimeout(renderAccounting, 150);
  }

  function recordInvoiceForAccounting(quoteId, status = "Sent") {
    const quote = quoteById(quoteId);
    if (!quote) return null;
    const record = invoiceRecord(quote, status);
    const invoices = readInvoices().filter((invoice) => (invoice.invoiceNumber || invoice.invoice_number || invoice.id) !== record.invoiceNumber);
    invoices.unshift(record);
    saveInvoices(invoices);
    saveInvoiceToSupabase(record);
    refreshInvoiceAccounting(record.invoiceNumber);
    return record;
  }

  document.addEventListener("click", (event) => {
    const confirm = event.target.closest?.("#sendPreviewConfirm");
    if (!confirm || confirm.dataset.kind !== "Invoice") return;
    recordInvoiceForAccounting(confirm.dataset.quote, "Sent");
  }, true);

  document.addEventListener("click", (event) => {
    const sendButton = event.target.closest?.("[data-send-invoice]");
    if (!sendButton) return;
    setTimeout(() => {
      const quote = quoteById(sendButton.dataset.sendInvoice);
      if (!quote) return;
      const number = invoiceNumber(quote);
      const exists = readInvoices().some((invoice) => (invoice.invoiceNumber || invoice.invoice_number || invoice.id) === number);
      if (!exists) recordInvoiceForAccounting(quote.id, "Prepared");
    }, 1800);
  }, true);

  window.wesetRecordInvoiceForAccounting = recordInvoiceForAccounting;
})();
