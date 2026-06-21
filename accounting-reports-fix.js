(() => {
  const invoiceStoreKey = "weset.invoices";
  const expenseVatStoreKey = "weset.expense.vat.records";
  const vatPaymentStoreKey = "weset.vat.payments";
  const reportState = { invoices: [], source: "app", error: "" };

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

  function quoteRefFromInvoice(invoice) {
    const quote = (state.quotes || []).find((entry) => String(entry.id) === String(invoice.quoteId));
    if (quote?.id) return quote.id;
    return invoice.quoteId || "No quote";
  }

  function getClientSafe(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || { company: "Client", contact: "", email: "" };
  }

  function normalizeInvoice(row) {
    if (!row) return null;
    return {
      id: row.id || row.invoiceNumber || row.invoice_number || crypto.randomUUID(),
      invoiceNumber: row.invoiceNumber || row.invoice_number || row.id || "Invoice",
      quoteId: row.quoteId || row.quote_id || "",
      clientId: row.clientId || row.client_id || "",
      status: row.status || "Created",
      subtotal: Number(row.subtotal || 0),
      vatEnabled: Boolean(row.vatEnabled ?? row.vat_enabled),
      vatRate: Number(row.vatRate ?? row.vat_rate ?? 0),
      vatAmount: Number(row.vatAmount ?? row.vat_amount ?? 0),
      total: Number(row.total || 0),
      html: row.html || row.invoice_html || "",
      createdAt: row.createdAt || row.created_at || "",
      sentAt: row.sentAt || row.sent_at || "",
      paidAt: row.paidAt || row.paid_at || ""
    };
  }

  function localInvoices() {
    return readJson(invoiceStoreKey, []).map(normalizeInvoice).filter(Boolean);
  }

  function saveLocalInvoice(invoice) {
    const invoices = localInvoices().filter((entry) => entry.invoiceNumber !== invoice.invoiceNumber);
    invoices.unshift(invoice);
    writeJson(invoiceStoreKey, invoices);
  }

  function mergeInvoices(localRows, supabaseRows) {
    const map = new Map();
    [...localRows, ...supabaseRows].forEach((invoice) => {
      if (!invoice) return;
      const key = invoice.invoiceNumber || invoice.id;
      map.set(key, { ...(map.get(key) || {}), ...invoice });
    });
    return [...map.values()].sort((a, b) => String(b.sentAt || b.createdAt || "").localeCompare(String(a.sentAt || a.createdAt || "")));
  }

  async function loadInvoices() {
    const localRows = localInvoices();
    reportState.invoices = localRows;
    reportState.source = "app";
    reportState.error = "";
    renderReportsOnly();
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    try {
      const rows = await sbRequest("invoices?select=*&order=created_at.desc");
      const remoteRows = (rows || []).map(normalizeInvoice).filter(Boolean);
      reportState.invoices = mergeInvoices(localRows, remoteRows);
      reportState.source = "Supabase";
      reportState.error = "";
      renderReportsOnly();
    } catch (error) {
      reportState.source = "app";
      reportState.error = error.message || "Could not load invoices from Supabase.";
      renderReportsOnly();
    }
  }

  function expenseVatRecord(expense) {
    return readJson(expenseVatStoreKey, {})[expense.id] || {};
  }

  function expenseVatAmount(expense) {
    const record = expenseVatRecord(expense);
    if (!record.enabled) return 0;
    const amount = Number(expense.amount || 0);
    const rate = Number(record.rate || 20);
    return rate ? amount * rate / (100 + rate) : 0;
  }

  function vatPayments() {
    return readJson(vatPaymentStoreKey, []);
  }

  function allCategories() {
    const categories = new Set(["Sales", "VAT"]);
    (state.expenses || []).forEach((expense) => { if (expense.category) categories.add(expense.category); });
    return [...categories].sort((a, b) => a.localeCompare(b));
  }

  function currentFilters() {
    return {
      from: document.querySelector("#reportFromDate")?.value || "",
      to: document.querySelector("#reportToDate")?.value || "",
      category: document.querySelector("#reportCategoryFilter")?.value || "all"
    };
  }

  function inPeriod(value, filters) {
    const raw = dateValue(value);
    if (!raw) return true;
    if (filters.from && raw < filters.from) return false;
    if (filters.to && raw > filters.to) return false;
    return true;
  }

  function invoiceDate(invoice) {
    return invoice.paidAt || invoice.sentAt || invoice.createdAt || "";
  }

  function filteredInvoices(filters = currentFilters()) {
    if (filters.category && !["all", "Sales", "VAT"].includes(filters.category)) return [];
    return reportState.invoices.filter((invoice) => inPeriod(invoiceDate(invoice), filters));
  }

  function filteredExpenses(filters = currentFilters()) {
    return (state.expenses || []).filter((expense) => {
      if (!inPeriod(expense.date, filters)) return false;
      if (filters.category === "Sales") return false;
      if (filters.category === "VAT") return expenseVatAmount(expense) !== 0;
      if (filters.category && filters.category !== "all" && expense.category !== filters.category) return false;
      return true;
    });
  }

  function reportTotals(filters = currentFilters()) {
    const invoices = filteredInvoices(filters).filter((invoice) => invoice.status !== "Cancelled");
    const expenses = filteredExpenses(filters);
    const salesSubtotal = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0);
    const salesVat = invoices.reduce((sum, invoice) => sum + Number(invoice.vatAmount || 0), 0);
    const salesTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const expenseGross = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const expenseVat = expenses.reduce((sum, expense) => sum + expenseVatAmount(expense), 0);
    const expenseNet = expenseGross - expenseVat;
    const paidVat = vatPayments().filter((payment) => inPeriod(payment.date, filters)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const netVatDue = salesVat - expenseVat - paidVat;
    const unpaidInvoices = invoices.filter((invoice) => !["Paid", "Cancelled"].includes(invoice.status));
    const accountsReceivable = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const paidInvoices = invoices.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const netProfit = salesSubtotal - expenseNet;
    return { invoices, expenses, salesSubtotal, salesVat, salesTotal, expenseGross, expenseVat, expenseNet, paidVat, netVatDue, accountsReceivable, paidInvoices, netProfit };
  }

  function ensureStyles() {
    if (document.querySelector("#accountingReportsFixStyles")) return;
    const style = document.createElement("style");
    style.id = "accountingReportsFixStyles";
    style.textContent = `
      .accounting-live-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-top: 14px; }
      .accounting-report-panel { min-width: 0; }
      .accounting-report-controls { align-items: end; display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(130px, 1fr)); }
      .accounting-report-controls button { min-height: 40px; }
      .report-summary-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-top: 12px; }
      .report-mini-card { background: #f8fbfa; border: 1px solid var(--line, #d9e0e1); border-radius: 8px; padding: 10px; }
      .report-mini-card span { color: var(--muted, #687478); display: block; font-size: 12px; font-weight: 800; }
      .report-mini-card strong { display: block; font-size: 18px; margin-top: 4px; overflow-wrap: anywhere; }
      .report-mini-card.is-total { background: #e4f2ed; border-color: rgba(57, 181, 74, 0.3); }
      .report-table-wrap { overflow: auto; width: 100%; }
      .report-table-wrap table { min-width: 760px; }
      .invoice-status-cell { align-items: center; display: flex; gap: 8px; flex-wrap: wrap; }
      .invoice-row-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
      .invoice-row-actions button { min-width: 72px; white-space: nowrap !important; }
      .accounting-report-note { background: #eef5f4; border: 1px solid #d9e0e1; border-radius: 8px; color: #145c58; font-weight: 700; margin-top: 10px; padding: 9px 10px; }
      .accounting-report-note.is-warn { background: #fff7ed; border-color: #fed7aa; color: #7c2d12; }
      .report-line-list { display: grid; gap: 8px; margin-top: 10px; }
      .report-line { align-items: center; border-bottom: 1px solid var(--line, #d9e0e1); display: flex; gap: 12px; justify-content: space-between; padding: 8px 0; }
      .report-line strong { text-align: right; }
      .report-line.is-total { border-bottom: 0; font-size: 17px; font-weight: 900; }
      .report-dialog { border: 0; border-radius: 10px; box-shadow: 0 24px 80px rgba(0,0,0,.22); max-width: min(920px, calc(100vw - 28px)); width: 920px; }
      .report-dialog::backdrop { background: rgba(10, 31, 34, .38); }
      .report-dialog-body { max-height: min(72vh, 760px); overflow: auto; }
      @media (max-width: 900px) { .accounting-report-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 620px) { .accounting-report-controls { grid-template-columns: 1fr; } .invoice-row-actions { justify-content: flex-start; } }
    `;
    document.head.appendChild(style);
  }

  function ensureShell() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting || document.querySelector("#accountingReportsPanel")) return;
    const section = document.createElement("section");
    section.className = "panel accounting-report-panel";
    section.id = "accountingReportsPanel";
    section.innerHTML = `
      <div class="panel-head"><div><h2>Live accounting reports</h2><p class="meta">Invoices, VAT, profit and balance sheet from the app data and Supabase when connected.</p></div><button class="secondary" id="refreshAccountingReportsBtn" type="button">Refresh</button></div>
      <div class="accounting-report-controls">
        <label>From<input id="reportFromDate" type="date"></label>
        <label>To<input id="reportToDate" type="date"></label>
        <label>Category<select id="reportCategoryFilter"></select></label>
        <button class="secondary" id="applyAccountingReportsBtn" type="button">Apply filters</button>
      </div>
      <div id="accountingReportSource" class="accounting-report-note"></div>
      <div class="report-summary-grid" id="accountingReportSummary"></div>
      <div class="accounting-live-grid">
        <section class="panel"><div class="panel-head"><h2>Invoices sent out</h2><button class="secondary" data-export-report="invoices" type="button">Export invoices</button></div><div class="report-table-wrap"><table><thead><tr><th>Invoice</th><th>Client</th><th>Quote</th><th>Date</th><th>Status</th><th>Subtotal</th><th>VAT</th><th>Total</th><th></th></tr></thead><tbody id="liveInvoicesTable"></tbody></table></div></section>
        <section class="panel"><div class="panel-head"><h2>Profit & loss</h2><button class="secondary" data-export-report="pl" type="button">Export P&L</button></div><div id="profitLossReport" class="report-line-list"></div></section>
        <section class="panel"><div class="panel-head"><h2>Balance sheet</h2><button class="secondary" data-export-report="balance" type="button">Export balance sheet</button></div><div id="balanceSheetReport" class="report-line-list"></div></section>
        <section class="panel"><div class="panel-head"><h2>VAT report</h2><button class="secondary" data-export-report="vat" type="button">Export VAT</button></div><div id="liveVatReport" class="report-line-list"></div></section>
      </div>
    `;
    accounting.appendChild(section);
    if (!document.querySelector("#invoicePreviewDialog")) {
      const dialog = document.createElement("dialog");
      dialog.id = "invoicePreviewDialog";
      dialog.className = "report-dialog";
      dialog.innerHTML = `<div class="panel-head"><h2 id="invoicePreviewTitle">Invoice</h2><button class="ghost" id="closeInvoicePreviewDialog" type="button">Close</button></div><div class="report-dialog-body" id="invoicePreviewBody"></div>`;
      document.body.appendChild(dialog);
      document.querySelector("#closeInvoicePreviewDialog")?.addEventListener("click", () => dialog.close());
    }
    document.querySelector("#refreshAccountingReportsBtn")?.addEventListener("click", loadInvoices);
    document.querySelector("#applyAccountingReportsBtn")?.addEventListener("click", renderReportsOnly);
    ["#reportFromDate", "#reportToDate", "#reportCategoryFilter"].forEach((selector) => document.querySelector(selector)?.addEventListener("change", renderReportsOnly));
  }

  function populateCategoryFilter() {
    const select = document.querySelector("#reportCategoryFilter");
    if (!select) return;
    const current = select.value || "all";
    const options = [`<option value="all">All categories</option>`, ...allCategories().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)];
    select.innerHTML = options.join("");
    select.value = [...select.options].some((option) => option.value === current) ? current : "all";
  }

  function renderSummary(totals) {
    const summary = document.querySelector("#accountingReportSummary");
    if (!summary) return;
    summary.innerHTML = [
      ["Invoice sales", totals.salesSubtotal],
      ["VAT collected", totals.salesVat],
      ["VAT on expenses", totals.expenseVat],
      ["Expenses net", totals.expenseNet],
      ["Profit", totals.netProfit, "is-total"],
      ["VAT still due", totals.netVatDue, totals.netVatDue > 0 ? "is-total" : ""]
    ].map(([label, value, className]) => `<article class="report-mini-card ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></article>`).join("");
  }

  function renderInvoiceTable(invoices) {
    const tbody = document.querySelector("#liveInvoicesTable");
    if (!tbody) return;
    tbody.innerHTML = invoices.map((invoice) => {
      const client = getClientSafe(invoice.clientId);
      return `<tr><td><strong>${escapeHtml(invoice.invoiceNumber)}</strong></td><td>${escapeHtml(client.company || client.contact || "Client")}</td><td>${escapeHtml(quoteRefFromInvoice(invoice))}</td><td>${dateText(invoiceDate(invoice))}</td><td><div class="invoice-status-cell"><span class="badge ${escapeHtml(String(invoice.status).replaceAll(" ", "-"))}">${escapeHtml(invoice.status)}</span></div></td><td>${moneyText(invoice.subtotal)}</td><td>${moneyText(invoice.vatAmount)}</td><td><strong>${moneyText(invoice.total)}</strong></td><td><div class="invoice-row-actions"><button class="secondary" data-view-live-invoice="${escapeHtml(invoice.invoiceNumber)}" type="button">View</button><button class="secondary" data-mark-invoice-paid="${escapeHtml(invoice.invoiceNumber)}" type="button">Paid</button></div></td></tr>`;
    }).join("") || `<tr><td colspan="9"><div class="empty">No invoices found for this period yet.</div></td></tr>`;
  }

  function renderProfitLoss(totals) {
    const node = document.querySelector("#profitLossReport");
    if (!node) return;
    node.innerHTML = [
      ["Sales before VAT", totals.salesSubtotal],
      ["Expense VAT removed", -totals.expenseVat],
      ["Expenses before VAT", -totals.expenseNet],
      ["Net profit / loss", totals.netProfit, "is-total"]
    ].map(([label, value, className]) => `<div class="report-line ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></div>`).join("");
  }

  function renderBalanceSheet(totals) {
    const node = document.querySelector("#balanceSheetReport");
    if (!node) return;
    const vatLiability = Math.max(0, totals.netVatDue);
    const vatAsset = Math.max(0, -totals.netVatDue);
    const totalAssets = totals.accountsReceivable + totals.paidInvoices + vatAsset;
    const totalLiabilities = vatLiability;
    const equity = totalAssets - totalLiabilities;
    node.innerHTML = [
      ["Cash from paid invoices", totals.paidInvoices],
      ["Accounts receivable", totals.accountsReceivable],
      ["VAT reclaimable / credit", vatAsset],
      ["Total assets", totalAssets, "is-total"],
      ["VAT payable", -vatLiability],
      ["Simple equity position", equity, "is-total"]
    ].map(([label, value, className]) => `<div class="report-line ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></div>`).join("") + `<p class="meta">Simple management balance sheet from app records. Your accountant can adjust this later for bank, payroll, loans, depreciation and year-end journals.</p>`;
  }

  function renderVatReport(totals) {
    const node = document.querySelector("#liveVatReport");
    if (!node) return;
    node.innerHTML = [
      ["Output VAT on invoices", totals.salesVat],
      ["Input VAT on VAT-marked expenses", -totals.expenseVat],
      ["VAT payments / adjustments", -totals.paidVat],
      [totals.netVatDue < 0 ? "VAT credit" : "VAT to pay", totals.netVatDue, "is-total"]
    ].map(([label, value, className]) => `<div class="report-line ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></div>`).join("");
  }

  function renderSourceNote() {
    const note = document.querySelector("#accountingReportSource");
    if (!note) return;
    note.classList.toggle("is-warn", Boolean(reportState.error));
    note.textContent = reportState.error
      ? `Using app invoices only. Supabase could not load invoices: ${reportState.error}`
      : `Using ${reportState.source === "Supabase" ? "Supabase and app" : "app"} invoice records. Refresh after sending a new invoice.`;
  }

  function renderReportsOnly() {
    ensureStyles();
    ensureShell();
    populateCategoryFilter();
    const filters = currentFilters();
    const totals = reportTotals(filters);
    renderSourceNote();
    renderSummary(totals);
    renderInvoiceTable(totals.invoices);
    renderProfitLoss(totals);
    renderBalanceSheet(totals);
    renderVatReport(totals);
  }

  async function markInvoicePaid(invoiceNumber) {
    const invoice = reportState.invoices.find((entry) => entry.invoiceNumber === invoiceNumber);
    if (!invoice) return;
    const paidAt = new Date().toISOString();
    const updated = { ...invoice, status: "Paid", paidAt };
    saveLocalInvoice(updated);
    reportState.invoices = mergeInvoices(reportState.invoices.filter((entry) => entry.invoiceNumber !== invoiceNumber), [updated]);
    renderReportsOnly();
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return alert("Marked as paid in the app. Sign in to Supabase if you also want this saved to Supabase.");
    try {
      await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}`, { method: "PATCH", body: { status: "Paid", paid_at: paidAt } });
      alert(`${invoiceNumber} marked as paid in the app and Supabase.`);
    } catch (error) {
      alert(`Marked as paid in the app, but Supabase did not save it yet: ${error.message || "check the invoices table."}`);
    }
  }

  function viewInvoice(invoiceNumber) {
    const invoice = reportState.invoices.find((entry) => entry.invoiceNumber === invoiceNumber);
    if (!invoice) return;
    const dialog = document.querySelector("#invoicePreviewDialog");
    const title = document.querySelector("#invoicePreviewTitle");
    const body = document.querySelector("#invoicePreviewBody");
    if (!dialog || !body || !title) return;
    title.textContent = invoice.invoiceNumber;
    body.innerHTML = invoice.html || `<div class="empty">No designed invoice preview was stored for this invoice.</div>`;
    dialog.showModal();
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
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

  function exportReport(type) {
    const filters = currentFilters();
    const totals = reportTotals(filters);
    const stamp = new Date().toISOString().slice(0, 10);
    if (type === "invoices") {
      downloadCsv(`weset-invoices-${stamp}.csv`, [["Invoice", "Client", "Quote", "Date", "Status", "Subtotal", "VAT", "Total"], ...totals.invoices.map((invoice) => [invoice.invoiceNumber, getClientSafe(invoice.clientId).company || "Client", quoteRefFromInvoice(invoice), dateValue(invoiceDate(invoice)), invoice.status, numberText(invoice.subtotal), numberText(invoice.vatAmount), numberText(invoice.total)])]);
      return;
    }
    if (type === "pl") {
      downloadCsv(`weset-profit-loss-${stamp}.csv`, [["Line", "Amount"], ["Sales before VAT", numberText(totals.salesSubtotal)], ["Expenses before VAT", numberText(totals.expenseNet)], ["Net profit / loss", numberText(totals.netProfit)]]);
      return;
    }
    if (type === "balance") {
      const vatLiability = Math.max(0, totals.netVatDue);
      const vatAsset = Math.max(0, -totals.netVatDue);
      downloadCsv(`weset-balance-sheet-${stamp}.csv`, [["Line", "Amount"], ["Cash from paid invoices", numberText(totals.paidInvoices)], ["Accounts receivable", numberText(totals.accountsReceivable)], ["VAT reclaimable / credit", numberText(vatAsset)], ["VAT payable", numberText(vatLiability)], ["Simple equity position", numberText(totals.paidInvoices + totals.accountsReceivable + vatAsset - vatLiability)]]);
      return;
    }
    downloadCsv(`weset-vat-report-${stamp}.csv`, [["Line", "Amount"], ["Output VAT on invoices", numberText(totals.salesVat)], ["Input VAT on expenses", numberText(totals.expenseVat)], ["VAT payments / adjustments", numberText(totals.paidVat)], ["VAT due / credit", numberText(totals.netVatDue)]]);
  }

  function install() {
    ensureStyles();
    ensureShell();
    const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
    if (oldRenderAccounting) renderAccounting = function renderAccountingWithReports() { oldRenderAccounting(); renderReportsOnly(); };
    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest?.("[data-view-live-invoice]");
      const paidButton = event.target.closest?.("[data-mark-invoice-paid]");
      const exportButton = event.target.closest?.("[data-export-report]");
      if (viewButton) { event.preventDefault(); viewInvoice(viewButton.dataset.viewLiveInvoice); }
      if (paidButton) { event.preventDefault(); markInvoicePaid(paidButton.dataset.markInvoicePaid); }
      if (exportButton) { event.preventDefault(); exportReport(exportButton.dataset.exportReport); }
    }, true);
    renderReportsOnly();
    loadInvoices();
  }

  window.wesetRefreshAccountingReports = loadInvoices;
  install();
})();
