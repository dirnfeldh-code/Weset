(() => {
  const invoiceStoreKey = "weset.invoices";
  const expenseVatStoreKey = "weset.expense.vat.records";
  const vatPaymentStoreKey = "weset.vat.payments";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
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

  function invoiceRows() {
    return readJson(invoiceStoreKey, []).map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || invoice.id || "Invoice",
      quoteId: invoice.quoteId || invoice.quote_id || "",
      clientId: invoice.clientId || invoice.client_id || "",
      status: invoice.status || "Created",
      subtotal: Number(invoice.subtotal || 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      createdAt: invoice.createdAt || invoice.created_at || "",
      sentAt: invoice.sentAt || invoice.sent_at || "",
      paidAt: invoice.paidAt || invoice.paid_at || ""
    }));
  }

  function expenseVatRecord(expense) {
    return readJson(expenseVatStoreKey, {})[expense.id] || {};
  }

  function expenseVatAmount(expense) {
    const record = expenseVatRecord(expense);
    if (!record.enabled) return 0;
    const rate = Number(record.rate || 20);
    return Number(expense.amount || 0) * rate / 100;
  }

  function invoiceDate(invoice) {
    return String(invoice.paidAt || invoice.sentAt || invoice.createdAt || "").slice(0, 10);
  }

  function inPeriod(value, filters) {
    const raw = String(value || "").slice(0, 10);
    if (!raw) return true;
    if (filters.from && raw < filters.from) return false;
    if (filters.to && raw > filters.to) return false;
    return true;
  }

  function filters() {
    return {
      from: document.querySelector("#reportFromDate")?.value || "",
      to: document.querySelector("#reportToDate")?.value || "",
      category: document.querySelector("#reportCategoryFilter")?.value || "all"
    };
  }

  function filteredInvoices(current = filters()) {
    if (current.category && !["all", "Sales", "VAT"].includes(current.category)) return [];
    return invoiceRows().filter((invoice) => invoice.status !== "Cancelled" && inPeriod(invoiceDate(invoice), current));
  }

  function filteredExpenses(current = filters()) {
    return (state.expenses || []).filter((expense) => {
      if (!inPeriod(expense.date, current)) return false;
      if (current.category === "Sales") return false;
      if (current.category === "VAT") return expenseVatAmount(expense) !== 0;
      if (current.category && current.category !== "all" && expense.category !== current.category) return false;
      return true;
    });
  }

  function vatPayments(current = filters()) {
    return readJson(vatPaymentStoreKey, []).filter((payment) => inPeriod(payment.date, current));
  }

  function totals(current = filters()) {
    const invoices = filteredInvoices(current);
    const expenses = filteredExpenses(current);
    const salesSubtotal = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0);
    const salesVat = invoices.reduce((sum, invoice) => sum + Number(invoice.vatAmount || 0), 0);
    const expenseNet = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const expenseVat = expenses.reduce((sum, expense) => sum + expenseVatAmount(expense), 0);
    const paidVat = vatPayments(current).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const netVatDue = salesVat - expenseVat - paidVat;
    const paidInvoices = invoices.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const accountsReceivable = invoices.filter((invoice) => !["Paid", "Cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const netProfit = salesSubtotal - expenseNet;
    return { invoices, expenses, salesSubtotal, salesVat, expenseNet, expenseVat, paidVat, netVatDue, paidInvoices, accountsReceivable, netProfit };
  }

  function updateExpenseVatPreview() {
    const preview = document.querySelector("#expenseVatPreview");
    if (!preview) return;
    const enabled = Boolean(document.querySelector("#expenseVatEnabled")?.checked);
    const amount = Number(document.querySelector("#expenseAmount")?.value || 0);
    const rate = Number(document.querySelector("#expenseVatRate")?.value || 20);
    const vatAmount = enabled ? amount * rate / 100 : 0;
    preview.textContent = enabled ? `VAT recorded: ${moneyText(vatAmount)} (${rate}% of ${moneyText(amount)})` : "No VAT will be recorded for this expense.";
  }

  function updateExpenseVatNotes() {
    document.querySelectorAll(".expense-vat-note").forEach((note) => note.remove());
    document.querySelectorAll("[data-toggle-expense-vat]").forEach((button) => {
      const id = button.dataset.toggleExpenseVat;
      const expense = (state.expenses || []).find((entry) => String(entry.id) === String(id));
      if (!expense) return;
      const record = expenseVatRecord(expense);
      if (!record.enabled) return;
      const payeeCell = button.closest("tr")?.children?.[2];
      if (payeeCell) payeeCell.insertAdjacentHTML("beforeend", `<span class="expense-vat-note">VAT ${Number(record.rate || 20)}% recorded: ${moneyText(expenseVatAmount(expense))}</span>`);
      button.title = `VAT ${Number(record.rate || 20)}%: ${moneyText(expenseVatAmount(expense))}`;
    });
  }

  function renderVatSummary() {
    const list = document.querySelector("#vatSummaryList");
    if (!list) return;
    const all = totals({ from: "", to: "", category: "all" });
    const remainingLabel = all.netVatDue < 0 ? "VAT credit / overpaid" : "Remaining VAT to pay";
    list.innerHTML = `<div class="vat-summary-row"><span>VAT collected on sales</span><strong>${moneyText(all.salesVat)}</strong></div><div class="vat-summary-row"><span>VAT recorded on expenses</span><strong>${moneyText(all.expenseVat)}</strong></div><div class="vat-summary-row"><span>Net VAT position</span><strong>${moneyText(all.salesVat - all.expenseVat)}</strong></div><div class="vat-summary-row"><span>VAT payments / adjustments</span><strong>${moneyText(all.paidVat)}</strong></div><div class="vat-summary-row ${all.netVatDue < 0 ? "is-credit" : all.netVatDue > 0 ? "is-warning" : "is-total"}"><span>${remainingLabel}</span><strong>${moneyText(all.netVatDue)}</strong></div><p class="meta">Expense VAT is calculated as amount before VAT x VAT rate. Example: ${moneyText(5000)} at 20% = ${moneyText(1000)} VAT.</p>`;
  }

  function renderReports() {
    const current = filters();
    const all = totals(current);
    const summary = document.querySelector("#accountingReportSummary");
    if (summary) {
      summary.innerHTML = [["Invoice sales", all.salesSubtotal], ["VAT collected", all.salesVat], ["VAT on expenses", all.expenseVat], ["Expenses net", all.expenseNet], ["Profit", all.netProfit, "is-total"], ["VAT still due", all.netVatDue, all.netVatDue > 0 ? "is-total" : ""]]
        .map(([label, value, className]) => `<article class="report-mini-card ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></article>`).join("");
    }
    const pl = document.querySelector("#profitLossReport");
    if (pl) {
      pl.innerHTML = [["Sales before VAT", all.salesSubtotal], ["Expenses before VAT", -all.expenseNet], ["Net profit / loss", all.netProfit, "is-total"]]
        .map(([label, value, className]) => `<div class="report-line ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></div>`).join("");
    }
    const balance = document.querySelector("#balanceSheetReport");
    if (balance) {
      const vatLiability = Math.max(0, all.netVatDue);
      const vatAsset = Math.max(0, -all.netVatDue);
      const totalAssets = all.paidInvoices + all.accountsReceivable + vatAsset;
      const equity = totalAssets - vatLiability;
      balance.innerHTML = [["Cash from paid invoices", all.paidInvoices], ["Accounts receivable", all.accountsReceivable], ["VAT reclaimable / credit", vatAsset], ["Total assets", totalAssets, "is-total"], ["VAT payable", -vatLiability], ["Simple equity position", equity, "is-total"]]
        .map(([label, value, className]) => `<div class="report-line ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></div>`).join("") + `<p class="meta">Simple management balance sheet from app records.</p>`;
    }
    const vat = document.querySelector("#liveVatReport");
    if (vat) {
      vat.innerHTML = [["Output VAT on invoices", all.salesVat], ["Input VAT on VAT-marked expenses", -all.expenseVat], ["VAT payments / adjustments", -all.paidVat], [all.netVatDue < 0 ? "VAT credit" : "VAT to pay", all.netVatDue, "is-total"]]
        .map(([label, value, className]) => `<div class="report-line ${className || ""}"><span>${escapeHtml(label)}</span><strong>${moneyText(value)}</strong></div>`).join("");
    }
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

  function exportCorrectReport(type) {
    const all = totals(filters());
    const stamp = new Date().toISOString().slice(0, 10);
    if (type === "pl") return downloadCsv(`weset-profit-loss-${stamp}.csv`, [["Line", "Amount"], ["Sales before VAT", numberText(all.salesSubtotal)], ["Expenses before VAT", numberText(all.expenseNet)], ["Net profit / loss", numberText(all.netProfit)]]);
    if (type === "balance") {
      const vatLiability = Math.max(0, all.netVatDue);
      const vatAsset = Math.max(0, -all.netVatDue);
      return downloadCsv(`weset-balance-sheet-${stamp}.csv`, [["Line", "Amount"], ["Cash from paid invoices", numberText(all.paidInvoices)], ["Accounts receivable", numberText(all.accountsReceivable)], ["VAT reclaimable / credit", numberText(vatAsset)], ["VAT payable", numberText(vatLiability)], ["Simple equity position", numberText(all.paidInvoices + all.accountsReceivable + vatAsset - vatLiability)]]);
    }
    if (type === "vat") return downloadCsv(`weset-vat-report-${stamp}.csv`, [["Line", "Amount"], ["Output VAT on invoices", numberText(all.salesVat)], ["Input VAT on expenses", numberText(all.expenseVat)], ["VAT payments / adjustments", numberText(all.paidVat)], ["VAT due / credit", numberText(all.netVatDue)]]);
  }

  function refresh() {
    updateExpenseVatPreview();
    updateExpenseVatNotes();
    renderVatSummary();
    renderReports();
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithCorrectVat() { oldRenderAccounting(); setTimeout(refresh, 0); };

  document.addEventListener("input", (event) => {
    if (event.target?.matches?.("#expenseAmount, #expenseVatEnabled, #expenseVatRate, #reportFromDate, #reportToDate, #reportCategoryFilter")) setTimeout(refresh, 0);
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("#expenseAmount, #expenseVatEnabled, #expenseVatRate, #reportFromDate, #reportToDate, #reportCategoryFilter")) setTimeout(refresh, 0);
  }, true);

  document.addEventListener("click", (event) => {
    const exportButton = event.target.closest?.("[data-export-report]");
    if (exportButton && ["pl", "balance", "vat"].includes(exportButton.dataset.exportReport)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportCorrectReport(exportButton.dataset.exportReport);
      return;
    }
    if (event.target.closest?.("[data-toggle-expense-vat], [data-delete-expense], [data-mark-invoice-paid], #applyAccountingReportsBtn, #refreshAccountingReportsBtn")) setTimeout(refresh, 250);
  }, true);

  setInterval(refresh, 1500);
  refresh();
})();
