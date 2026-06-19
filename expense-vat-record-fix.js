(() => {
  const storeKey = "weset.expense.vat.records";
  const defaultRate = 20;
  let editingExpenseId = "";

  function readStore() {
    try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { return {}; }
  }

  function writeStore(records) {
    localStorage.setItem(storeKey, JSON.stringify(records));
  }

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value || 0);
  }

  function expenseById(id) {
    return (state.expenses || []).find((expense) => String(expense.id) === String(id));
  }

  function expenseVat(id) {
    const stored = readStore()[id] || {};
    return { enabled: Boolean(stored.enabled), rate: Number(stored.rate ?? defaultRate) };
  }

  function saveExpenseVat(id, settings) {
    if (!id) return;
    const records = readStore();
    records[id] = { enabled: Boolean(settings.enabled), rate: Number(settings.rate || defaultRate) };
    writeStore(records);
  }

  function vatAmountForExpense(expense) {
    const vat = expenseVat(expense.id);
    if (!vat.enabled) return 0;
    const amount = Number(expense.amount || 0);
    const rate = Number(vat.rate || 0);
    return rate ? amount * rate / (100 + rate) : 0;
  }

  function ensureStyles() {
    if (document.querySelector("#expenseVatRecordStyles")) return;
    const style = document.createElement("style");
    style.id = "expenseVatRecordStyles";
    style.textContent = `
      .expense-vat-controls { align-items: end; background: #f8fbfa; border: 1px solid var(--line, #d9e0e1); border-radius: 8px; display: grid; gap: 10px; grid-column: 1 / -1; grid-template-columns: minmax(160px, .7fr) minmax(120px, .45fr) minmax(0, 1fr); padding: 10px; }
      .expense-vat-controls .check-row { min-height: 40px; }
      .expense-vat-preview { color: #145c58; font-size: 13px; font-weight: 800; margin: 0; }
      .expense-vat-button { min-width: 94px !important; white-space: nowrap !important; }
      .expense-vat-button.is-on { background: #145c58 !important; color: #fff !important; }
      .expense-vat-note { color: #687478; display: block; font-size: 12px; margin-top: 4px; }
      @media (max-width: 760px) { .expense-vat-controls { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function currentFormVat() {
    return {
      enabled: Boolean(document.querySelector("#expenseVatEnabled")?.checked),
      rate: Number(document.querySelector("#expenseVatRate")?.value || defaultRate)
    };
  }

  function updateExpenseVatPreview() {
    const preview = document.querySelector("#expenseVatPreview");
    if (!preview) return;
    const amount = Number(document.querySelector("#expenseAmount")?.value || 0);
    const vat = currentFormVat();
    const vatAmount = vat.enabled && vat.rate ? amount * vat.rate / (100 + vat.rate) : 0;
    preview.textContent = vat.enabled ? `VAT recorded: ${moneyText(vatAmount)}` : "No VAT will be recorded for this expense.";
  }

  function ensureExpenseVatControls() {
    if (!els.expenseForm || document.querySelector("#expenseVatControls")) return;
    const notesLabel = document.querySelector("#expenseNotes")?.closest("label");
    const controls = document.createElement("section");
    controls.className = "expense-vat-controls";
    controls.id = "expenseVatControls";
    controls.innerHTML = `<label class="check-row"><input id="expenseVatEnabled" type="checkbox"> This expense has VAT</label><label>VAT rate %<input id="expenseVatRate" step="0.1" type="number" value="20"></label><p class="expense-vat-preview" id="expenseVatPreview">No VAT will be recorded for this expense.</p>`;
    if (notesLabel) notesLabel.insertAdjacentElement("beforebegin", controls);
    else els.expenseForm.appendChild(controls);
    controls.addEventListener("input", updateExpenseVatPreview, true);
    controls.addEventListener("change", updateExpenseVatPreview, true);
    document.querySelector("#expenseAmount")?.addEventListener("input", updateExpenseVatPreview, true);
    updateExpenseVatPreview();
  }

  function setFormExpenseVat(settings = {}) {
    ensureExpenseVatControls();
    const enabled = document.querySelector("#expenseVatEnabled");
    const rate = document.querySelector("#expenseVatRate");
    if (enabled) enabled.checked = Boolean(settings.enabled);
    if (rate) rate.value = Number(settings.rate ?? defaultRate);
    updateExpenseVatPreview();
  }

  function latestMatchingExpense(snapshot) {
    const expenses = state.expenses || [];
    return expenses.find((expense) => String(expense.date || "") === String(snapshot.date || "") && String(expense.payee || "") === String(snapshot.payee || "") && Number(expense.amount || 0) === Number(snapshot.amount || 0)) || expenses[0];
  }

  function captureExpenseSnapshot() {
    return {
      date: document.querySelector("#expenseDate")?.value || "",
      payee: document.querySelector("#expensePayee")?.value.trim() || "",
      amount: Number(document.querySelector("#expenseAmount")?.value || 0),
      vat: currentFormVat()
    };
  }

  function enhanceExpenseRows() {
    document.querySelectorAll("[data-edit-expense]").forEach((editButton) => {
      const id = editButton.dataset.editExpense;
      const actions = editButton.closest(".expense-row-actions");
      if (!id || !actions || actions.querySelector(`[data-toggle-expense-vat="${CSS.escape(id)}"]`)) return;
      const expense = expenseById(id);
      const vat = expenseVat(id);
      const button = document.createElement("button");
      button.className = `secondary expense-vat-button ${vat.enabled ? "is-on" : ""}`;
      button.dataset.toggleExpenseVat = id;
      button.type = "button";
      button.textContent = vat.enabled ? "VAT Yes" : "VAT No";
      button.title = vat.enabled && expense ? `VAT ${vat.rate}%: ${moneyText(vatAmountForExpense(expense))}` : "No VAT recorded for this expense";
      editButton.insertAdjacentElement("afterend", button);
      const payeeCell = actions.closest("tr")?.children?.[2];
      if (payeeCell && vat.enabled && !payeeCell.querySelector(".expense-vat-note")) payeeCell.insertAdjacentHTML("beforeend", `<span class="expense-vat-note">VAT ${vat.rate}% recorded: ${moneyText(vatAmountForExpense(expense))}</span>`);
    });
  }

  function toggleExpenseVat(id) {
    const expense = expenseById(id);
    if (!expense) return;
    const current = expenseVat(id);
    if (current.enabled) {
      saveExpenseVat(id, { enabled: false, rate: current.rate });
    } else {
      const input = prompt("VAT rate for this expense", String(current.rate || defaultRate));
      if (input === null) return;
      const rate = Number(input || defaultRate);
      saveExpenseVat(id, { enabled: true, rate: Number.isFinite(rate) ? rate : defaultRate });
    }
    if (typeof renderAccounting === "function") renderAccounting();
  }

  function expenseVatTotal() {
    return (state.expenses || []).reduce((sum, expense) => sum + vatAmountForExpense(expense), 0);
  }

  function invoiceVatTotal() {
    const invoices = (() => { try { return JSON.parse(localStorage.getItem("weset.invoices") || "[]"); } catch { return []; } })();
    const sentInvoices = invoices.filter((invoice) => invoice.status === "Sent" || invoice.sentAt);
    if (sentInvoices.length) return sentInvoices.reduce((sum, invoice) => sum + Number(invoice.vatAmount || 0), 0);
    return (state.quotes || []).filter((quote) => ["Sent", "Accepted"].includes(quote.status || "")).reduce((sum, quote) => {
      if (typeof window.wesetQuoteTotals === "function") return sum + Number(window.wesetQuoteTotals(quote).vatAmount || 0);
      return sum;
    }, 0);
  }

  function vatPayments() {
    try { return JSON.parse(localStorage.getItem("weset.vat.payments") || "[]"); } catch { return []; }
  }

  function renderExplicitVatSummary() {
    const list = document.querySelector("#vatSummaryList");
    const paymentList = document.querySelector("#vatPaymentList");
    if (!list || !paymentList) return;
    const salesVat = invoiceVatTotal();
    const inputVat = expenseVatTotal();
    const netDue = salesVat - inputVat;
    const paid = vatPayments().reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const remaining = netDue - paid;
    const remainingLabel = remaining < 0 ? "VAT credit / overpaid" : "Remaining VAT to pay";
    list.innerHTML = `<div class="vat-summary-row"><span>VAT collected on sales</span><strong>${moneyText(salesVat)}</strong></div><div class="vat-summary-row"><span>VAT recorded on expenses</span><strong>${moneyText(inputVat)}</strong></div><div class="vat-summary-row"><span>Net VAT position</span><strong>${moneyText(netDue)}</strong></div><div class="vat-summary-row"><span>VAT payments / adjustments</span><strong>${moneyText(paid)}</strong></div><div class="vat-summary-row ${remaining < 0 ? "is-credit" : remaining > 0 ? "is-warning" : "is-total"}"><span>${remainingLabel}</span><strong>${moneyText(remaining)}</strong></div><p class="meta">Expense VAT is counted only when you mark that expense as VAT Yes.</p>`;
  }

  function install() {
    ensureStyles();
    ensureExpenseVatControls();
    enhanceExpenseRows();
    renderExplicitVatSummary();
    const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
    if (oldRenderAccounting) renderAccounting = function renderAccountingWithExplicitExpenseVat() { oldRenderAccounting(); ensureExpenseVatControls(); enhanceExpenseRows(); renderExplicitVatSummary(); };
    try { window.renderVatSummary = renderExplicitVatSummary; renderVatSummary = renderExplicitVatSummary; } catch { window.renderVatSummary = renderExplicitVatSummary; }
  }

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest?.("[data-edit-expense]");
    const toggleButton = event.target.closest?.("[data-toggle-expense-vat]");
    if (editButton) {
      editingExpenseId = editButton.dataset.editExpense || "";
      setTimeout(() => setFormExpenseVat(expenseVat(editingExpenseId)), 0);
    }
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleExpenseVat(toggleButton.dataset.toggleExpenseVat);
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (!event.target?.matches?.("#expenseForm")) return;
    const snapshot = captureExpenseSnapshot();
    const submittedEditId = editingExpenseId;
    setTimeout(() => {
      const expense = submittedEditId ? expenseById(submittedEditId) : latestMatchingExpense(snapshot);
      if (expense?.id) saveExpenseVat(expense.id, snapshot.vat);
      editingExpenseId = "";
      setFormExpenseVat({ enabled: false, rate: defaultRate });
      enhanceExpenseRows();
      renderExplicitVatSummary();
    }, 1000);
  }, true);

  document.addEventListener("input", (event) => {
    if (event.target?.matches?.("#expenseAmount, #expenseVatEnabled, #expenseVatRate")) updateExpenseVatPreview();
  }, true);

  install();
})();
