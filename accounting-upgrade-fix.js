(() => {
  const categoryStoreKey = "weset.expense.categories";
  const vatPaymentStoreKey = "weset.vat.payments";
  const baseCategories = [
    "Supplier purchases",
    "Subcontractors",
    "Delivery",
    "Tools and equipment",
    "Software",
    "Marketing",
    "Travel",
    "Office overheads",
    "Other"
  ];
  let editingExpenseId = "";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value || 0);
  }

  function dateText(value) {
    if (typeof formatDate === "function") return formatDate(value);
    if (typeof date === "function") return date(value);
    return value || "No date";
  }

  function storedCategories() {
    try { return JSON.parse(localStorage.getItem(categoryStoreKey) || "[]"); } catch { return []; }
  }

  function saveCategories(categories) {
    const clean = [...new Set(categories.map((category) => String(category || "").trim()).filter(Boolean))];
    localStorage.setItem(categoryStoreKey, JSON.stringify(clean));
  }

  function allCategories() {
    const fromExpenses = (state.expenses || []).map((expense) => expense.category).filter(Boolean);
    return [...new Set([...baseCategories, ...storedCategories(), ...fromExpenses])].sort((a, b) => a.localeCompare(b));
  }

  function vatPayments() {
    try { return JSON.parse(localStorage.getItem(vatPaymentStoreKey) || "[]"); } catch { return []; }
  }

  function saveVatPayments(payments) {
    localStorage.setItem(vatPaymentStoreKey, JSON.stringify(payments));
  }

  function ensureStyles() {
    if (document.querySelector("#accountingUpgradeStyles")) return;
    const style = document.createElement("style");
    style.id = "accountingUpgradeStyles";
    style.textContent = `
      .accounting-tools-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-top: 14px; }
      .expense-category-list, .vat-payment-list, .vat-summary-list { display: grid; gap: 8px; }
      .expense-category-row, .vat-payment-row, .vat-summary-row { align-items: center; background: #f8fbfa; border: 1px solid var(--line, #d9e0e1); border-radius: 8px; display: flex; gap: 10px; justify-content: space-between; min-width: 0; padding: 9px 10px; }
      .expense-category-row span, .vat-payment-row span, .vat-summary-row span { min-width: 0; overflow-wrap: anywhere; }
      .expense-category-row button, .vat-payment-row button { flex: 0 0 auto; }
      .expense-category-form, .vat-payment-form { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) auto; }
      .vat-payment-form { grid-template-columns: 140px minmax(0, 1fr) auto; }
      .vat-summary-row strong { font-size: 17px; text-align: right; }
      .vat-summary-row.is-total { background: #e4f2ed; border-color: rgba(57, 181, 74, 0.3); }
      .vat-summary-row.is-warning { background: #fff7ed; border-color: #fed7aa; }
      .vat-summary-row.is-credit { background: #e7f1f6; border-color: rgba(20, 92, 88, 0.22); }
      .expense-editing-note { background: #e8f3f1; border: 1px solid rgba(20, 92, 88, 0.24); border-radius: 8px; color: #145c58; display: none; font-weight: 700; padding: 9px 10px; }
      .expense-editing-note.is-visible { display: block; }
      #cancelExpenseEditBtn { display: none; }
      #cancelExpenseEditBtn.is-visible { display: inline-flex; }
      #expensesTable .expense-row-actions { display: flex; gap: 8px; justify-content: flex-end; }
      #expensesTable .expense-row-actions button { min-width: 70px; white-space: nowrap !important; }
      @media (max-width: 760px) { .expense-category-form, .vat-payment-form { grid-template-columns: 1fr; } #expensesTable .expense-row-actions { justify-content: flex-start; } }
    `;
    document.head.appendChild(style);
  }

  function populateExpenseCategories(selected = "") {
    if (!els.expenseCategory) return;
    const current = selected || els.expenseCategory.value || "";
    els.expenseCategory.innerHTML = allCategories().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    if (current && !allCategories().includes(current)) els.expenseCategory.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`);
    if (current) els.expenseCategory.value = current;
    els.expenseAmount?.removeAttribute("min");
  }

  function ensureExpenseEditControls() {
    if (!els.expenseForm || document.querySelector("#expenseEditNote")) return;
    els.expenseForm.insertAdjacentHTML("afterbegin", `<div class="span-2 expense-editing-note" id="expenseEditNote">Editing expense transaction. Save changes or cancel editing.</div>`);
    const submit = els.expenseForm.querySelector("button[type='submit']");
    if (submit) {
      submit.insertAdjacentHTML("beforebegin", `<button class="secondary span-2" id="cancelExpenseEditBtn" type="button">Cancel edit</button>`);
      document.querySelector("#cancelExpenseEditBtn")?.addEventListener("click", cancelExpenseEdit);
    }
  }

  function setExpenseEditMode(on) {
    const note = document.querySelector("#expenseEditNote");
    const cancel = document.querySelector("#cancelExpenseEditBtn");
    const submit = els.expenseForm?.querySelector("button[type='submit']");
    note?.classList.toggle("is-visible", Boolean(on));
    cancel?.classList.toggle("is-visible", Boolean(on));
    if (submit) submit.textContent = on ? "Save expense changes" : "Save expense";
  }

  function cancelExpenseEdit() {
    editingExpenseId = "";
    els.expenseForm?.reset();
    if (els.expenseDate) els.expenseDate.value = typeof todayPlus === "function" ? todayPlus(0) : new Date().toISOString().slice(0, 10);
    populateExpenseCategories();
    setExpenseEditMode(false);
  }

  function editExpense(id) {
    const expense = (state.expenses || []).find((entry) => entry.id === id);
    if (!expense || !els.expenseForm) return;
    editingExpenseId = id;
    populateExpenseCategories(expense.category || "Other");
    els.expenseDate.value = expense.date || "";
    els.expenseCategory.value = expense.category || "Other";
    els.expensePayee.value = expense.payee || "";
    els.expenseAmount.value = Number(expense.amount || 0);
    els.expenseNotes.value = expense.notes || "";
    setExpenseEditMode(true);
    els.expenseForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveEditedExpense(event) {
    if (!editingExpenseId) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const body = { expense_date: els.expenseDate.value, category: els.expenseCategory.value, payee: els.expensePayee.value.trim(), amount: Number(els.expenseAmount.value), notes: els.expenseNotes.value.trim() };
    let saved = { id: editingExpenseId, date: body.expense_date, category: body.category, payee: body.payee, amount: body.amount, notes: body.notes };
    if (typeof sbIsConnected === "function" && sbIsConnected() && typeof sbRequest === "function" && isUuid(editingExpenseId)) {
      const rows = await sbRequest(`expenses?id=eq.${editingExpenseId}`, { method: "PATCH", body });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && typeof sbExpenseFromRow === "function") saved = sbExpenseFromRow(row);
    }
    state.expenses = (state.expenses || []).map((expense) => expense.id === editingExpenseId ? saved : expense);
    saveState();
    cancelExpenseEdit();
    renderAccounting();
    return true;
  }

  function renderExpensesTableWithEdit() {
    if (!els.expensesTable) return;
    els.expensesTable.innerHTML = [...(state.expenses || [])].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((expense) => `<tr><td>${dateText(expense.date)}</td><td>${escapeHtml(expense.category || "Other")}</td><td>${escapeHtml(expense.payee || "")}${expense.notes ? `<p class="meta">${escapeHtml(expense.notes)}</p>` : ""}</td><td><strong>${moneyText(expense.amount || 0)}</strong></td><td><div class="expense-row-actions"><button class="secondary" data-edit-expense="${escapeHtml(expense.id)}" type="button">Edit</button><button class="ghost danger" data-delete-expense="${escapeHtml(expense.id)}" type="button">Delete</button></div></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty">No expenses recorded yet.</div></td></tr>`;
  }

  function categoryIsUsed(category) { return (state.expenses || []).some((expense) => expense.category === category); }

  function ensureCategoryManager() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting || document.querySelector("#expenseCategoryManager")) return;
    const panel = document.createElement("div");
    panel.className = "accounting-tools-grid";
    panel.innerHTML = `<section class="panel" id="expenseCategoryManager"><div class="panel-head"><h2>Expense categories</h2></div><form class="expense-category-form" id="expenseCategoryForm"><input id="newExpenseCategory" placeholder="New category name" aria-label="New expense category"><button class="secondary" type="submit">Add category</button></form><div class="expense-category-list" id="expenseCategoryList"></div></section><section class="panel" id="vatSummaryPanel"><div class="panel-head"><div><h2>VAT summary</h2><p class="meta">Estimated from invoices, quotes and expenses in the app. Negative values are allowed for refunds, credits and corrections.</p></div></div><div class="vat-summary-list" id="vatSummaryList"></div><form class="vat-payment-form" id="vatPaymentForm"><input id="vatPaymentDate" type="date" aria-label="VAT payment date"><input id="vatPaymentAmount" step="0.01" type="number" placeholder="Payment or adjustment" aria-label="VAT payment or adjustment amount"><button class="secondary" type="submit">Record VAT</button></form><div class="vat-payment-list" id="vatPaymentList"></div></section>`;
    accounting.appendChild(panel);
    document.querySelector("#expenseCategoryForm")?.addEventListener("submit", addExpenseCategory);
    document.querySelector("#vatPaymentForm")?.addEventListener("submit", addVatPayment);
    const dateInput = document.querySelector("#vatPaymentDate");
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  }

  function renderCategoryManager() {
    const list = document.querySelector("#expenseCategoryList");
    if (!list) return;
    list.innerHTML = allCategories().map((category) => {
      const used = categoryIsUsed(category);
      const isBase = baseCategories.includes(category);
      const canDelete = !isBase && !used;
      return `<div class="expense-category-row"><span>${escapeHtml(category)}${used ? " <small class='meta'>used</small>" : ""}</span>${canDelete ? `<button class="ghost danger" data-delete-category="${escapeHtml(category)}" type="button">Delete</button>` : `<span class="meta">${isBase ? "Default" : "In use"}</span>`}</div>`;
    }).join("");
  }

  function addExpenseCategory(event) {
    event.preventDefault();
    const input = document.querySelector("#newExpenseCategory");
    const value = input?.value.trim();
    if (!value) return;
    saveCategories([...storedCategories(), value]);
    input.value = "";
    populateExpenseCategories(value);
    renderCategoryManager();
  }

  function deleteExpenseCategory(category) {
    if (categoryIsUsed(category)) return alert("This category is used by an expense. Change that expense first, then delete the category.");
    saveCategories(storedCategories().filter((item) => item !== category));
    populateExpenseCategories();
    renderCategoryManager();
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

  function expenseVatEstimate() {
    return (state.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount || 0) * 20 / 120), 0);
  }

  function renderVatSummary() {
    const list = document.querySelector("#vatSummaryList");
    const paymentList = document.querySelector("#vatPaymentList");
    if (!list || !paymentList) return;
    const salesVat = invoiceVatTotal();
    const inputVat = expenseVatEstimate();
    const netDue = salesVat - inputVat;
    const paid = vatPayments().reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const remaining = netDue - paid;
    const remainingLabel = remaining < 0 ? "VAT credit / overpaid" : "Remaining VAT to pay";
    list.innerHTML = `<div class="vat-summary-row"><span>VAT collected on sales</span><strong>${moneyText(salesVat)}</strong></div><div class="vat-summary-row"><span>Estimated VAT on expenses</span><strong>${moneyText(inputVat)}</strong></div><div class="vat-summary-row"><span>Net VAT position</span><strong>${moneyText(netDue)}</strong></div><div class="vat-summary-row"><span>VAT payments / adjustments</span><strong>${moneyText(paid)}</strong></div><div class="vat-summary-row ${remaining < 0 ? "is-credit" : remaining > 0 ? "is-warning" : "is-total"}"><span>${remainingLabel}</span><strong>${moneyText(remaining)}</strong></div><p class="meta">Use negative expenses, negative VAT payments, or negative quote/invoice lines for refunds, credits and corrections.</p>`;
    paymentList.innerHTML = vatPayments().map((payment) => `<div class="vat-payment-row"><span>${dateText(payment.date)} - ${moneyText(payment.amount)}</span><button class="ghost danger" data-delete-vat-payment="${escapeHtml(payment.id)}" type="button">Delete</button></div>`).join("") || `<div class="empty">No VAT payments or adjustments recorded yet.</div>`;
  }

  function addVatPayment(event) {
    event.preventDefault();
    const dateInput = document.querySelector("#vatPaymentDate");
    const amountInput = document.querySelector("#vatPaymentAmount");
    const amount = Number(amountInput?.value || 0);
    if (!Number.isFinite(amount) || amount === 0) return alert("Enter the VAT payment or adjustment amount. Use a negative number for a refund or correction.");
    saveVatPayments([{ id: crypto.randomUUID(), date: dateInput.value || new Date().toISOString().slice(0, 10), amount }, ...vatPayments()]);
    amountInput.value = "";
    renderVatSummary();
  }

  function deleteVatPayment(id) { saveVatPayments(vatPayments().filter((payment) => payment.id !== id)); renderVatSummary(); }

  function afterAccountingRender() {
    ensureStyles();
    ensureExpenseEditControls();
    ensureCategoryManager();
    populateExpenseCategories();
    renderExpensesTableWithEdit();
    renderCategoryManager();
    renderVatSummary();
    setExpenseEditMode(Boolean(editingExpenseId));
  }

  const oldRenderExpensesTable = typeof renderExpensesTable === "function" ? renderExpensesTable : null;
  if (oldRenderExpensesTable) renderExpensesTable = renderExpensesTableWithEdit;
  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithUpgrade() { oldRenderAccounting(); afterAccountingRender(); };

  document.addEventListener("submit", (event) => {
    if (event.target?.matches?.("#expenseForm") && editingExpenseId) saveEditedExpense(event).catch((error) => alert(`Could not update expense: ${error.message || "Please check Supabase and try again."}`));
  }, true);

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest?.("[data-edit-expense]");
    const deleteCategoryButton = event.target.closest?.("[data-delete-category]");
    const deleteVatPaymentButton = event.target.closest?.("[data-delete-vat-payment]");
    if (editButton) { event.preventDefault(); event.stopPropagation(); editExpense(editButton.dataset.editExpense); }
    if (deleteCategoryButton) { event.preventDefault(); event.stopPropagation(); deleteExpenseCategory(deleteCategoryButton.dataset.deleteCategory); }
    if (deleteVatPaymentButton) { event.preventDefault(); event.stopPropagation(); deleteVatPayment(deleteVatPaymentButton.dataset.deleteVatPayment); }
  }, true);

  window.renderVatSummary = renderVatSummary;
  ensureStyles();
  afterAccountingRender();
})();
