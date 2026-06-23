(() => {
  const paymentStoreKey = "weset.client.payments";
  const invoiceStoreKey = "weset.invoices";
  const expenseVatStoreKey = "weset.expense.vat.records";
  const vatPaymentStoreKey = "weset.vat.payments";
  let paymentSaveNotice = "";

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

  function numberText(value) {
    return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateValue(value) {
    return String(value || "").slice(0, 10);
  }

  function dateText(value) {
    const raw = dateValue(value);
    if (!raw) return "No date";
    if (typeof formatDate === "function") return formatDate(raw);
    if (typeof date === "function") return date(raw);
    return raw;
  }

  function clientById(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || { company: "Client", contact: "" };
  }

  function invoiceRows() {
    return readJson(invoiceStoreKey, []).map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || invoice.id || "Invoice",
      quoteId: invoice.quoteId || invoice.quote_id || "",
      clientId: invoice.clientId || invoice.client_id || "",
      status: invoice.status || "Created",
      subtotal: Number(invoice.subtotal || 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      html: invoice.html || invoice.invoice_html || "",
      createdAt: invoice.createdAt || invoice.created_at || "",
      sentAt: invoice.sentAt || invoice.sent_at || "",
      paidAt: invoice.paidAt || invoice.paid_at || ""
    }));
  }

  function displayInvoiceNumber(invoice) {
    const current = invoice.invoiceNumber || invoice.invoice_number || invoice.id || "";
    const quoteId = invoice.quoteId || invoice.quote_id || "";
    const looksRaw = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(current || "")) || /^INV-[0-9a-f-]{20,}$/i.test(String(current || ""));
    if (looksRaw && quoteId && typeof window.wesetInvoiceReferenceForQuote === "function") return window.wesetInvoiceReferenceForQuote(quoteId);
    return current || "Invoice";
  }

  function saveInvoiceRows(invoices) {
    writeJson(invoiceStoreKey, invoices);
  }

  function payments() {
    return readJson(paymentStoreKey, []).map((payment) => ({
      id: payment.id || crypto.randomUUID(),
      date: payment.date || payment.payment_date || today(),
      clientId: payment.clientId || payment.client_id || "",
      invoiceNumber: payment.invoiceNumber || payment.invoice_number || "",
      amount: Number(payment.amount || 0),
      method: payment.method || "Bank transfer",
      reference: payment.reference || "",
      notes: payment.notes || ""
    }));
  }

  function savePayments(rows) {
    writeJson(paymentStoreKey, rows);
  }

  function invoicePaidAmount(invoiceNumber) {
    return payments().filter((payment) => payment.invoiceNumber === invoiceNumber).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function invoiceBalance(invoice) {
    return Number(invoice.total || 0) - invoicePaidAmount(invoice.invoiceNumber);
  }

  function saveLocalInvoiceStatus(invoiceNumber, status) {
    const invoices = invoiceRows().map((invoice) => invoice.invoiceNumber === invoiceNumber ? { ...invoice, status, paidAt: status === "Paid" ? new Date().toISOString() : invoice.paidAt } : invoice);
    saveInvoiceRows(invoices);
  }

  async function patchSupabaseInvoiceStatus(invoiceNumber, status) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}`, { method: "PATCH", body: { status } });
  }

  async function savePaymentToSupabase(payment) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return { saved: false, reason: "not signed in" };
    try {
      await sbRequest("client_payments", {
        method: "POST",
        body: {
          payment_date: payment.date,
          client_id: payment.clientId || null,
          invoice_number: payment.invoiceNumber || null,
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference,
          notes: payment.notes
        }
      });
      return { saved: true };
    } catch (error) {
      return { saved: false, reason: error.message || "create the client_payments table in Supabase" };
    }
  }

  function ensureStyles() {
    if (document.querySelector("#clientPaymentsFixStyles")) return;
    const style = document.createElement("style");
    style.id = "clientPaymentsFixStyles";
    style.textContent = `
      .client-payments-panel { margin-top: 14px; }
      .client-payment-form { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(130px, 1fr)); }
      .client-payment-form label { min-width: 0; }
      .client-payment-form input, .client-payment-form select { min-width: 0; width: 100%; }
      .client-payment-form .span-2 { grid-column: span 2; }
      .client-payment-form .span-4 { grid-column: 1 / -1; }
      .payment-summary-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 12px 0; }
      .payment-card { background: #f8fbfa; border: 1px solid var(--line, #d9e0e1); border-radius: 8px; display: grid; gap: 4px; min-height: 68px; padding: 10px; }
      .payment-card span { color: var(--muted, #687478); font-size: 12px; font-weight: 800; }
      .payment-card strong { align-self: end; font-size: 18px; line-height: 1.15; overflow-wrap: anywhere; }
      .payment-card.is-good { background: #e4f2ed; border-color: rgba(57, 181, 74, .3); }
      .payment-card.is-warn { background: #fff7ed; border-color: #fed7aa; }
      .client-payment-note { background: #eef5f4; border: 1px solid #d9e0e1; border-radius: 8px; color: #145c58; display: none; font-weight: 700; line-height: 1.35; margin-top: 10px; padding: 9px 10px; }
      .client-payment-note.is-visible { display: block; }
      .client-payment-note.is-warn { background: #fff7ed; border-color: #fed7aa; color: #7c2d12; }
      .payment-row-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
      .payment-row-actions button, .invoice-row-actions [data-record-invoice-payment] { border-radius: 7px !important; min-height: 34px; padding: 7px 10px !important; white-space: nowrap !important; }
      @media (max-width: 900px) { .client-payment-form { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 620px) { .client-payment-form { grid-template-columns: 1fr; } .client-payment-form .span-2, .client-payment-form .span-4 { grid-column: 1; } .payment-row-actions { justify-content: flex-start; } }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting || document.querySelector("#clientPaymentsPanel")) return;
    const panel = document.createElement("section");
    panel.className = "panel client-payments-panel";
    panel.id = "clientPaymentsPanel";
    panel.innerHTML = `
      <div class="panel-head"><div><h2>Client payments</h2><p class="meta">Record money received from clients and link it to an invoice when possible.</p></div><button class="secondary" id="exportClientPaymentsBtn" type="button">Export payments</button></div>
      <form class="client-payment-form" id="clientPaymentForm">
        <label>Date<input id="clientPaymentDate" type="date" required></label>
        <label>Client<select id="clientPaymentClient"></select></label>
        <label class="span-2">Invoice<select id="clientPaymentInvoice"></select></label>
        <label>Amount received<input id="clientPaymentAmount" type="number" step="0.01" required placeholder="0.00"></label>
        <label>Method<select id="clientPaymentMethod"><option>Bank transfer</option><option>Card</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
        <label class="span-2">Reference<input id="clientPaymentReference" placeholder="Bank ref, receipt, note"></label>
        <label class="span-4">Notes<input id="clientPaymentNotes" placeholder="Optional payment note"></label>
        <button class="primary span-4" type="submit">Record payment</button>
      </form>
      <div class="client-payment-note" id="clientPaymentNotice"></div>
      <div class="payment-summary-grid" id="clientPaymentSummary"></div>
      <div class="report-table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th><th></th></tr></thead><tbody id="clientPaymentsTable"></tbody></table></div>
    `;
    const reports = document.querySelector("#accountingReportsPanel");
    if (reports) reports.insertAdjacentElement("afterend", panel);
    else accounting.appendChild(panel);
    document.querySelector("#clientPaymentDate").value = today();
    document.querySelector("#clientPaymentForm")?.addEventListener("submit", recordPayment);
    document.querySelector("#clientPaymentInvoice")?.addEventListener("change", fillPaymentFromInvoice);
    document.querySelector("#clientPaymentClient")?.addEventListener("change", renderPaymentInvoiceOptions);
    document.querySelector("#exportClientPaymentsBtn")?.addEventListener("click", exportPayments);
  }

  function renderPaymentClientOptions() {
    const select = document.querySelector("#clientPaymentClient");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Choose client</option>` + (state.clients || []).map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.company || client.contact || client.email || "Client")}</option>`).join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function renderPaymentInvoiceOptions() {
    const select = document.querySelector("#clientPaymentInvoice");
    if (!select) return;
    const clientId = document.querySelector("#clientPaymentClient")?.value || "";
    const current = select.value;
    const invoices = invoiceRows().filter((invoice) => !clientId || invoice.clientId === clientId);
    select.innerHTML = `<option value="">No invoice / general payment</option>` + invoices.map((invoice) => {
      const balance = invoiceBalance(invoice);
      const label = `${displayInvoiceNumber(invoice)} - ${moneyText(balance)} outstanding`;
      return `<option value="${escapeHtml(invoice.invoiceNumber)}" data-client="${escapeHtml(invoice.clientId)}" data-balance="${Number(balance || 0)}">${escapeHtml(label)}</option>`;
    }).join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function fillPaymentFromInvoice() {
    const select = document.querySelector("#clientPaymentInvoice");
    const selected = select?.selectedOptions?.[0];
    if (!selected || !selected.value) return;
    const clientId = selected.dataset.client || "";
    const balance = Number(selected.dataset.balance || 0);
    if (clientId) document.querySelector("#clientPaymentClient").value = clientId;
    if (Number.isFinite(balance)) document.querySelector("#clientPaymentAmount").value = balance.toFixed(2);
  }

  function prefillFromInvoice(invoiceNumber) {
    const invoice = invoiceRows().find((entry) => entry.invoiceNumber === invoiceNumber);
    if (!invoice) return;
    ensurePanel();
    document.querySelector("[data-accounting-section='actions']")?.click();
    renderPaymentClientOptions();
    document.querySelector("#clientPaymentClient").value = invoice.clientId || "";
    renderPaymentInvoiceOptions();
    document.querySelector("#clientPaymentInvoice").value = invoice.invoiceNumber;
    document.querySelector("#clientPaymentAmount").value = Math.max(0, invoiceBalance(invoice)).toFixed(2);
    document.querySelector("#clientPaymentDate").value = today();
    document.querySelector("#clientPaymentsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function recordPayment(event) {
    event.preventDefault();
    const payment = {
      id: crypto.randomUUID(),
      date: document.querySelector("#clientPaymentDate").value || today(),
      clientId: document.querySelector("#clientPaymentClient").value || "",
      invoiceNumber: document.querySelector("#clientPaymentInvoice").value || "",
      amount: Number(document.querySelector("#clientPaymentAmount").value || 0),
      method: document.querySelector("#clientPaymentMethod").value || "Bank transfer",
      reference: document.querySelector("#clientPaymentReference").value.trim(),
      notes: document.querySelector("#clientPaymentNotes").value.trim()
    };
    if (!payment.clientId && !payment.invoiceNumber) return showPaymentNotice("Choose a client or invoice before recording the payment.", true);
    if (!Number.isFinite(payment.amount) || payment.amount === 0) return showPaymentNotice("Enter the amount received. Use a negative amount only for a refund or correction.", true);
    savePayments([payment, ...payments()]);
    const invoice = invoiceRows().find((entry) => entry.invoiceNumber === payment.invoiceNumber);
    if (invoice && invoiceBalance(invoice) <= 0.005) {
      saveLocalInvoiceStatus(invoice.invoiceNumber, "Paid");
      patchSupabaseInvoiceStatus(invoice.invoiceNumber, "Paid").catch(() => {});
    }
    const supabase = await savePaymentToSupabase(payment);
    paymentSaveNotice = supabase.saved ? "Payment saved in the app and Supabase." : `Payment saved in the app. Supabase did not save it yet: ${supabase.reason}.`;
    document.querySelector("#clientPaymentForm")?.reset();
    document.querySelector("#clientPaymentDate").value = today();
    renderPayments();
    if (typeof renderAccounting === "function") setTimeout(renderAccounting, 0);
  }

  function deletePayment(id) {
    if (!confirm("Delete this payment record?")) return;
    savePayments(payments().filter((payment) => payment.id !== id));
    paymentSaveNotice = "Payment deleted in this app.";
    renderPayments();
    if (typeof renderAccounting === "function") setTimeout(renderAccounting, 0);
  }

  function showPaymentNotice(message, warn = false) {
    const notice = document.querySelector("#clientPaymentNotice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("is-visible", Boolean(message));
    notice.classList.toggle("is-warn", Boolean(warn));
  }

  function paymentTotals() {
    const rows = payments();
    const totalReceived = rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const invoices = invoiceRows().filter((invoice) => invoice.status !== "Cancelled");
    const invoiceTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const allocated = rows.filter((payment) => payment.invoiceNumber).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, invoiceBalance(invoice)), 0);
    return { totalReceived, invoiceTotal, allocated, outstanding };
  }

  function renderPaymentSummary() {
    const node = document.querySelector("#clientPaymentSummary");
    if (!node) return;
    const totals = paymentTotals();
    node.innerHTML = [["Client payments", totals.totalReceived, "is-good"], ["Allocated to invoices", totals.allocated], ["Invoice value", totals.invoiceTotal], ["Outstanding", totals.outstanding, totals.outstanding > 0 ? "is-warn" : "is-good"]]
      .map(([label, value, className]) => `<article class="payment-card ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></article>`).join("");
  }

  function renderPaymentTable() {
    const tbody = document.querySelector("#clientPaymentsTable");
    if (!tbody) return;
    tbody.innerHTML = payments().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((payment) => {
      const client = clientById(payment.clientId);
      const invoice = invoiceRows().find((entry) => entry.invoiceNumber === payment.invoiceNumber);
      return `<tr><td>${dateText(payment.date)}</td><td>${escapeHtml(client.company || client.contact || "Client")}</td><td>${escapeHtml(invoice ? displayInvoiceNumber(invoice) : payment.invoiceNumber || "General")}</td><td>${escapeHtml(payment.method)}</td><td>${escapeHtml(payment.reference || payment.notes || "")}</td><td><strong>${moneyText(payment.amount)}</strong></td><td><div class="payment-row-actions"><button class="ghost danger" data-delete-client-payment="${escapeHtml(payment.id)}" type="button">Delete</button></div></td></tr>`;
    }).join("") || `<tr><td colspan="7"><div class="empty">No client payments recorded yet.</div></td></tr>`;
  }

  function enhanceInvoiceRows() {
    document.querySelectorAll(".invoice-row-actions").forEach((actions) => {
      const viewButton = actions.querySelector("[data-view-live-invoice]");
      if (!viewButton || actions.querySelector("[data-record-invoice-payment]")) return;
      const button = document.createElement("button");
      button.className = "secondary";
      button.type = "button";
      button.dataset.recordInvoicePayment = viewButton.dataset.viewLiveInvoice || "";
      button.textContent = "Payment";
      actions.insertBefore(button, actions.firstChild);
    });
  }

  function renderPayments() {
    ensureStyles();
    ensurePanel();
    renderPaymentClientOptions();
    renderPaymentInvoiceOptions();
    renderPaymentSummary();
    renderPaymentTable();
    enhanceInvoiceRows();
    showPaymentNotice(paymentSaveNotice, /did not save|choose|enter/i.test(paymentSaveNotice));
  }

  function reportFilters() {
    return {
      from: document.querySelector("#reportFromDate")?.value || "",
      to: document.querySelector("#reportToDate")?.value || "",
      category: document.querySelector("#reportCategoryFilter")?.value || "all"
    };
  }

  function inReportPeriod(value, filters) {
    const raw = dateValue(value);
    if (!raw) return true;
    if (filters.from && raw < filters.from) return false;
    if (filters.to && raw > filters.to) return false;
    return true;
  }

  function paymentReportTotals() {
    const filters = reportFilters();
    const invoices = invoiceRows().filter((invoice) => invoice.status !== "Cancelled" && (!filters.category || ["all", "Sales", "VAT"].includes(filters.category)));
    const periodPayments = payments().filter((payment) => inReportPeriod(payment.date, filters));
    const allPayments = payments();
    const cashReceived = periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total || 0) - allPayments.filter((payment) => payment.invoiceNumber === invoice.invoiceNumber).reduce((paid, payment) => paid + Number(payment.amount || 0), 0)), 0);
    return { cashReceived, outstanding };
  }

  function enhanceReportsWithPayments() {
    const totals = paymentReportTotals();
    const summary = document.querySelector("#accountingReportSummary");
    if (summary && !summary.querySelector("[data-payment-card='cash']")) {
      summary.insertAdjacentHTML("beforeend", `<article class="report-mini-card is-total" data-payment-card="cash"><span>Cash received</span><strong>${moneyText(totals.cashReceived)}</strong></article><article class="report-mini-card ${totals.outstanding > 0 ? "is-total" : ""}" data-payment-card="ar"><span>Outstanding invoices</span><strong>${moneyText(totals.outstanding)}</strong></article>`);
    } else if (summary) {
      const cash = summary.querySelector("[data-payment-card='cash'] strong");
      const ar = summary.querySelector("[data-payment-card='ar'] strong");
      if (cash) cash.textContent = moneyText(totals.cashReceived);
      if (ar) ar.textContent = moneyText(totals.outstanding);
    }
    const balance = document.querySelector("#balanceSheetReport");
    if (balance) {
      const cashLine = [...balance.querySelectorAll(".report-line span")].find((span) => span.textContent === "Cash from paid invoices")?.parentElement;
      const arLine = [...balance.querySelectorAll(".report-line span")].find((span) => span.textContent === "Accounts receivable")?.parentElement;
      if (cashLine?.querySelector("strong")) cashLine.querySelector("strong").textContent = moneyText(totals.cashReceived);
      if (arLine?.querySelector("strong")) arLine.querySelector("strong").textContent = moneyText(totals.outstanding);
    }
  }

  function exportPayments() {
    downloadCsv(`weset-client-payments-${today()}.csv`, [["Date", "Client", "Invoice", "Method", "Reference", "Notes", "Amount"], ...payments().map((payment) => [payment.date, clientById(payment.clientId).company || "Client", payment.invoiceNumber || "General", payment.method, payment.reference, payment.notes, numberText(payment.amount)])]);
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function refresh() {
    renderPayments();
    enhanceReportsWithPayments();
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithClientPayments() { oldRenderAccounting(); setTimeout(refresh, 0); };

  document.addEventListener("click", (event) => {
    const recordButton = event.target.closest?.("[data-record-invoice-payment]");
    const deleteButton = event.target.closest?.("[data-delete-client-payment]");
    if (recordButton) { event.preventDefault(); prefillFromInvoice(recordButton.dataset.recordInvoicePayment); }
    if (deleteButton) { event.preventDefault(); deletePayment(deleteButton.dataset.deleteClientPayment); }
    setTimeout(refresh, 250);
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("#reportFromDate, #reportToDate, #reportCategoryFilter")) setTimeout(enhanceReportsWithPayments, 50);
  }, true);

  setInterval(() => { enhanceInvoiceRows(); enhanceReportsWithPayments(); }, 1500);
  refresh();
})();
