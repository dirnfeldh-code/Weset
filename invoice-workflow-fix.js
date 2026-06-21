(() => {
  const invoiceStoreKey = "weset.invoices";
  const paymentStoreKey = "weset.client.payments";
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readJson(key, fallback) {
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

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function quoteById(id) {
    return (state.quotes || []).find((quote) => String(quote.id) === String(id));
  }

  function clientById(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || { company: "Client", contact: "", email: "" };
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
    const client = clientById(quote.clientId);
    const totals = totalsForQuote(quote);
    return `<div><h1>Invoice ${escapeHtml(invoiceNumber(quote))}</h1><p>${escapeHtml(client.company || client.contact || "Client")}</p><p>Total: ${moneyText(totals.total)}</p></div>`;
  }

  function invoices() {
    return readJson(invoiceStoreKey, []).map((invoice) => ({
      id: invoice.id || invoice.invoiceNumber || invoice.invoice_number || "",
      invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || invoice.id || "Invoice",
      quoteId: invoice.quoteId || invoice.quote_id || "",
      clientId: invoice.clientId || invoice.client_id || "",
      status: invoice.status || "Unpaid",
      subtotal: Number(invoice.subtotal || 0),
      vatEnabled: Boolean(invoice.vatEnabled ?? invoice.vat_enabled),
      vatRate: Number(invoice.vatRate ?? invoice.vat_rate ?? 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      html: invoice.html || invoice.invoice_html || "",
      createdAt: invoice.createdAt || invoice.created_at || "",
      sentAt: invoice.sentAt || invoice.sent_at || "",
      paidAt: invoice.paidAt || invoice.paid_at || ""
    }));
  }

  function saveInvoices(rows) {
    writeJson(invoiceStoreKey, rows);
  }

  function payments() {
    return readJson(paymentStoreKey, []);
  }

  function savePayments(rows) {
    writeJson(paymentStoreKey, rows);
  }

  function paidAmount(invoiceNumberValue) {
    return payments().filter((payment) => (payment.invoiceNumber || payment.invoice_number) === invoiceNumberValue).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function balanceDue(invoice) {
    return Number(invoice.total || 0) - paidAmount(invoice.invoiceNumber);
  }

  function buildInvoiceRecord(quote, existing = null, status = "Unpaid") {
    const totals = totalsForQuote(quote);
    const now = new Date().toISOString();
    return {
      ...(existing || {}),
      id: invoiceNumber(quote),
      invoiceNumber: invoiceNumber(quote),
      quoteId: quote.id,
      clientId: quote.clientId,
      status: existing?.status === "Paid" ? "Paid" : status,
      subtotal: Number(totals.subtotal || 0),
      vatEnabled: Boolean(totals.vatEnabled),
      vatRate: Number(totals.vatRate || 0),
      vatAmount: Number(totals.vatAmount || 0),
      total: Number(totals.total || 0),
      html: invoiceHtmlForQuote(quote),
      createdAt: existing?.createdAt || now,
      sentAt: existing?.sentAt || "",
      paidAt: existing?.paidAt || ""
    };
  }

  async function saveInvoiceToSupabase(invoice) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    const body = {
      quote_id: invoice.quoteId,
      client_id: invoice.clientId,
      invoice_number: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: invoice.subtotal,
      vat_enabled: invoice.vatEnabled,
      vat_rate: invoice.vatRate,
      vat_amount: invoice.vatAmount,
      total: invoice.total,
      invoice_html: invoice.html,
      sent_at: invoice.sentAt || null
    };
    try {
      const existing = await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(invoice.invoiceNumber)}&select=id`);
      if (existing?.length) await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(invoice.invoiceNumber)}`, { method: "PATCH", body });
      else await sbRequest("invoices", { method: "POST", body });
    } catch (error) {
      console.warn("Invoice could not be saved to Supabase", error);
    }
  }

  function refreshAccounting(message = "Invoice records refreshed.") {
    if (typeof window.wesetRefreshInvoiceRecognition === "function") window.wesetRefreshInvoiceRecognition(message);
    if (typeof window.wesetRefreshAccountingReports === "function") window.wesetRefreshAccountingReports();
    if (typeof renderAccounting === "function") setTimeout(renderAccounting, 120);
  }

  function createInvoice(quoteId, status = "Unpaid") {
    const quote = quoteById(quoteId);
    if (!quote) return null;
    const number = invoiceNumber(quote);
    const rows = invoices();
    const existing = rows.find((invoice) => invoice.invoiceNumber === number) || null;
    const record = buildInvoiceRecord(quote, existing, status);
    const nextRows = rows.filter((invoice) => invoice.invoiceNumber !== number);
    nextRows.unshift(record);
    saveInvoices(nextRows);
    saveInvoiceToSupabase(record);
    refreshAccounting(`Invoice ${number} created and stored. You can now send it or record a payment.`);
    return record;
  }

  function updateInvoice(invoiceNumberValue, patch) {
    const rows = invoices().map((invoice) => invoice.invoiceNumber === invoiceNumberValue ? { ...invoice, ...patch } : invoice);
    saveInvoices(rows);
    const invoice = rows.find((entry) => entry.invoiceNumber === invoiceNumberValue);
    if (invoice) saveInvoiceToSupabase(invoice);
    refreshAccounting(`Invoice ${invoiceNumberValue} updated.`);
    return invoice;
  }

  function token() {
    if (typeof sbAnonKey !== "undefined" && sbAnonKey) return sbAnonKey;
    try { return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || ""; } catch { return ""; }
  }

  async function sendInvoice(invoiceNumberValue) {
    const invoice = invoices().find((entry) => entry.invoiceNumber === invoiceNumberValue);
    const quote = invoice ? quoteById(invoice.quoteId) : null;
    if (!invoice || !quote) throw new Error("Invoice or quote was not found.");
    const client = clientById(invoice.clientId || quote.clientId);
    if (!client.email) throw new Error("This client has no email address saved.");
    const payload = typeof window.wesetInvoiceEmailPayload === "function"
      ? window.wesetInvoiceEmailPayload(quote)
      : { to: client.email, subject: `Invoice ${invoice.invoiceNumber}`, text: `Invoice ${invoice.invoiceNumber}`, html: invoice.html, reference: invoice.invoiceNumber, invoiceHtml: invoice.html };
    const auth = token();
    if (!auth) throw new Error("Email sender is missing the Supabase token. Refresh and try again.");
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ quoteId: quote.id, ...payload, reference: invoice.invoiceNumber, invoiceHtml: payload.invoiceHtml || invoice.html })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
    updateInvoice(invoice.invoiceNumber, { status: balanceDue(invoice) <= 0 ? "Paid" : "Sent", sentAt: new Date().toISOString() });
    if (typeof updateQuote === "function") updateQuote(quote.id, { status: "Sent" });
    alert(`Invoice ${invoice.invoiceNumber} sent to ${client.email}.`);
  }

  function recordPaymentForInvoice(invoiceNumberValue, amount = null) {
    const invoice = invoices().find((entry) => entry.invoiceNumber === invoiceNumberValue);
    if (!invoice) return null;
    const due = amount === null ? balanceDue(invoice) : Number(amount || 0);
    if (!Number.isFinite(due) || due === 0) return null;
    const payment = {
      id: crypto.randomUUID(),
      date: today(),
      clientId: invoice.clientId,
      invoiceNumber: invoice.invoiceNumber,
      amount: due,
      method: "Bank transfer",
      reference: `Invoice ${invoice.invoiceNumber}`,
      notes: "Marked paid from invoice workflow"
    };
    savePayments([payment, ...payments()]);
    const newStatus = balanceDue(invoice) - due <= 0.005 ? "Paid" : "Part paid";
    updateInvoice(invoice.invoiceNumber, { status: newStatus, paidAt: newStatus === "Paid" ? new Date().toISOString() : invoice.paidAt });
    return payment;
  }

  function ensureStyles() {
    if (document.querySelector("#invoiceWorkflowFixStyles")) return;
    const style = document.createElement("style");
    style.id = "invoiceWorkflowFixStyles";
    style.textContent = `
      .invoice-created-dialog { border: 0; border-radius: 10px; box-shadow: 0 24px 80px rgba(0,0,0,.22); max-width: min(560px, calc(100vw - 24px)); padding: 0; width: 560px; }
      .invoice-created-dialog::backdrop { background: rgba(10,31,34,.38); }
      .invoice-created-card { background: #fff; border-radius: 10px; overflow: hidden; }
      .invoice-created-head { background: #145c58; color: #fff; padding: 18px 20px; }
      .invoice-created-head h2 { font-size: 20px; margin: 0; }
      .invoice-created-body { display: grid; gap: 10px; padding: 16px 20px; }
      .invoice-created-line { align-items: center; border-bottom: 1px solid var(--line,#d9e0e1); display: flex; justify-content: space-between; padding: 8px 0; }
      .invoice-created-actions { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0 20px 20px; }
      .invoice-created-actions button { min-height: 38px; width: 100%; }
      .invoice-workflow-badge { background: #e8f3f1; border-radius: 999px; color: #145c58; display: inline-flex; font-size: 12px; font-weight: 800; padding: 4px 8px; }
      .invoice-row-actions [data-send-stored-invoice], .invoice-row-actions [data-mark-invoice-paid-workflow] { border-radius: 7px !important; min-height: 34px; padding: 7px 10px !important; white-space: nowrap !important; }
      @media (max-width: 620px) { .invoice-created-actions { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function showCreatedDialog(invoice) {
    ensureStyles();
    let dialog = document.querySelector("#invoiceCreatedDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "invoiceCreatedDialog";
      dialog.className = "invoice-created-dialog";
      dialog.innerHTML = `<div class="invoice-created-card"><div class="invoice-created-head"><h2>Invoice created</h2></div><div class="invoice-created-body" id="invoiceCreatedBody"></div><div class="invoice-created-actions"><button class="primary" id="sendCreatedInvoiceBtn" type="button">Send invoice</button><button class="secondary" id="payCreatedInvoiceBtn" type="button">Mark paid</button><button class="secondary" id="viewCreatedInvoiceBtn" type="button">View in accounting</button><button class="ghost" id="closeCreatedInvoiceBtn" type="button">Close</button></div></div>`;
      document.body.appendChild(dialog);
      dialog.querySelector("#closeCreatedInvoiceBtn")?.addEventListener("click", () => dialog.close());
      dialog.querySelector("#viewCreatedInvoiceBtn")?.addEventListener("click", () => { dialog.close(); location.hash = "#accounting"; refreshAccounting(); });
      dialog.querySelector("#sendCreatedInvoiceBtn")?.addEventListener("click", async () => {
        const button = dialog.querySelector("#sendCreatedInvoiceBtn");
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "Sending...";
        try { await sendInvoice(dialog.dataset.invoiceNumber); dialog.close(); }
        catch (error) { alert(`Could not send invoice: ${error.message || "Please check email setup."}`); }
        finally { button.disabled = false; button.textContent = oldText; }
      });
      dialog.querySelector("#payCreatedInvoiceBtn")?.addEventListener("click", () => {
        recordPaymentForInvoice(dialog.dataset.invoiceNumber);
        dialog.close();
      });
    }
    dialog.dataset.invoiceNumber = invoice.invoiceNumber;
    dialog.querySelector("#invoiceCreatedBody").innerHTML = `<div class="invoice-created-line"><span>Invoice</span><strong>${escapeHtml(invoice.invoiceNumber)}</strong></div><div class="invoice-created-line"><span>Status</span><strong><span class="invoice-workflow-badge">${escapeHtml(invoice.status)}</span></strong></div><div class="invoice-created-line"><span>Total</span><strong>${moneyText(invoice.total)}</strong></div><p class="meta">The invoice is now stored in Accounting. You can send it now, leave it unpaid, or record the payment when the client pays.</p>`;
    dialog.showModal();
  }

  function enhanceInvoiceTableActions() {
    document.querySelectorAll(".invoice-row-actions").forEach((actions) => {
      const viewButton = actions.querySelector("[data-view-live-invoice]");
      if (!viewButton) return;
      const number = viewButton.dataset.viewLiveInvoice;
      if (!actions.querySelector("[data-send-stored-invoice]")) {
        const send = document.createElement("button");
        send.className = "secondary";
        send.type = "button";
        send.dataset.sendStoredInvoice = number;
        send.textContent = "Send";
        actions.insertBefore(send, actions.firstChild);
      }
      const oldPaid = actions.querySelector("[data-mark-invoice-paid]");
      if (oldPaid && !actions.querySelector("[data-mark-invoice-paid-workflow]")) {
        oldPaid.dataset.markInvoicePaidWorkflow = oldPaid.dataset.markInvoicePaid;
        oldPaid.textContent = "Mark paid";
      }
    });
  }

  document.addEventListener("click", (event) => {
    const createButton = event.target.closest?.("[data-invoice-quote]");
    if (!createButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const invoice = createInvoice(createButton.dataset.invoiceQuote, "Unpaid");
    if (invoice) showCreatedDialog(invoice);
  }, true);

  document.addEventListener("click", async (event) => {
    const sendButton = event.target.closest?.("[data-send-stored-invoice]");
    const paidButton = event.target.closest?.("[data-mark-invoice-paid-workflow]");
    if (sendButton) {
      event.preventDefault();
      event.stopPropagation();
      const oldText = sendButton.textContent;
      sendButton.disabled = true;
      sendButton.textContent = "Sending...";
      try { await sendInvoice(sendButton.dataset.sendStoredInvoice); }
      catch (error) { alert(`Could not send invoice: ${error.message || "Please check email setup."}`); }
      finally { sendButton.disabled = false; sendButton.textContent = oldText; }
    }
    if (paidButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const payment = recordPaymentForInvoice(paidButton.dataset.markInvoicePaidWorkflow);
      if (payment) alert(`Payment recorded for ${paidButton.dataset.markInvoicePaidWorkflow}.`);
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#sendPreviewConfirm")?.dataset.kind === "Invoice") {
      const quoteId = event.target.closest("#sendPreviewConfirm").dataset.quote;
      createInvoice(quoteId, "Sent");
    }
    setTimeout(enhanceInvoiceTableActions, 250);
  }, true);

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithInvoiceWorkflow() { oldRenderAccounting(); setTimeout(enhanceInvoiceTableActions, 0); };

  ensureStyles();
  setInterval(enhanceInvoiceTableActions, 1200);
  setTimeout(enhanceInvoiceTableActions, 500);

  window.wesetCreateStoredInvoice = createInvoice;
  window.wesetRecordInvoicePayment = recordPaymentForInvoice;
})();
