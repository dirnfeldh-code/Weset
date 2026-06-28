(() => {
  const VERSION = "20260622-accounting-sync2";
  const keys = {
    company: "weset.company.details",
    invoices: "weset.invoices",
    payments: "weset.client.payments",
    categories: "weset.expense.categories",
    expenseVat: "weset.expense.vat.records",
    vatPayments: "weset.vat.payments"
  };
  const baseCategories = new Set([
    "Supplier purchases",
    "Subcontractors",
    "Delivery",
    "Tools and equipment",
    "Software",
    "Marketing",
    "Travel",
    "Office overheads",
    "Other"
  ]);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const pending = new Set();
  let applyingRemote = false;
  let syncing = false;
  let remoteLoaded = false;
  let lastMessage = "";
  const missingOptionalTables = new Set();

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    applyingRemote = true;
    try { localStorage.setItem(key, JSON.stringify(value)); }
    finally { applyingRemote = false; }
  }

  function isConnected() {
    return typeof sbIsConnected === "function" && sbIsConnected() && typeof sbRequest === "function";
  }

  function notify(message, warn = false) {
    lastMessage = message || "";
    const panel = document.querySelector("#accountingSyncStatus");
    if (panel) {
      panel.textContent = lastMessage || "Accounting sync ready.";
      panel.classList.toggle("is-warn", Boolean(warn));
    }
  }

  function ensureStatusPanel() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting || document.querySelector("#accountingSyncStatus")) return;
    const status = document.createElement("div");
    status.id = "accountingSyncStatus";
    status.className = "accounting-sync-status";
    status.textContent = lastMessage || "Accounting sync ready.";
    accounting.prepend(status);
  }

  function ensureStyles() {
    if (document.querySelector("#accountingSyncStyles")) return;
    const style = document.createElement("style");
    style.id = "accountingSyncStyles";
    style.textContent = `
      .accounting-sync-status {
        background:#e8f3f1;
        border:1px solid rgba(20,92,88,.22);
        border-radius:8px;
        color:#145c58;
        font-size:13px;
        font-weight:800;
        margin:0 0 12px;
        padding:9px 11px;
      }
      .accounting-sync-status.is-warn {
        background:#fff7ed;
        border-color:#fed7aa;
        color:#7c2d12;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeInvoice(row) {
    if (!row) return null;
    return {
      id: row.id || row.invoiceNumber || row.invoice_number || "",
      invoiceNumber: row.invoiceNumber || row.invoice_number || row.id || "Invoice",
      quoteId: row.quoteId || row.quote_id || "",
      clientId: row.clientId || row.client_id || "",
      status: row.status || "Unpaid",
      subtotal: Number(row.subtotal || 0),
      vatEnabled: Boolean(row.vatEnabled ?? row.vat_enabled),
      vatRate: Number(row.vatRate ?? row.vat_rate ?? 0),
      vatAmount: Number(row.vatAmount ?? row.vat_amount ?? 0),
      total: Number(row.total || 0),
      html: row.html || row.invoice_html || "",
      dueDate: row.dueDate || row.due_date || "",
      terms: row.terms || "",
      notes: row.notes || "",
      createdAt: row.createdAt || row.created_at || "",
      sentAt: row.sentAt || row.sent_at || "",
      paidAt: row.paidAt || row.paid_at || ""
    };
  }

  function invoiceBody(invoice) {
    return {
      invoice_number: invoice.invoiceNumber || invoice.invoice_number,
      quote_id: uuidPattern.test(String(invoice.quoteId || invoice.quote_id || "")) ? (invoice.quoteId || invoice.quote_id) : null,
      client_id: uuidPattern.test(String(invoice.clientId || invoice.client_id || "")) ? (invoice.clientId || invoice.client_id) : null,
      status: invoice.status || "Unpaid",
      subtotal: Number(invoice.subtotal || 0),
      vat_enabled: Boolean(invoice.vatEnabled ?? invoice.vat_enabled),
      vat_rate: Number(invoice.vatRate ?? invoice.vat_rate ?? 0),
      vat_amount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      invoice_html: invoice.html || invoice.invoice_html || "",
      due_date: String(invoice.dueDate || invoice.due_date || "").slice(0, 10) || null,
      terms: invoice.terms || null,
      notes: invoice.notes || null,
      sent_at: invoice.sentAt || invoice.sent_at || null,
      paid_at: invoice.paidAt || invoice.paid_at || null
    };
  }

  function normalizePayment(row) {
    if (!row) return null;
    return {
      id: row.id || crypto.randomUUID(),
      date: row.date || row.payment_date || new Date().toISOString().slice(0, 10),
      clientId: row.clientId || row.client_id || "",
      invoiceNumber: row.invoiceNumber || row.invoice_number || "",
      amount: Number(row.amount || 0),
      method: row.method || "Bank transfer",
      reference: row.reference || "",
      notes: row.notes || ""
    };
  }

  function paymentBody(payment) {
    return {
      id: uuidPattern.test(String(payment.id || "")) ? payment.id : undefined,
      payment_date: payment.date || payment.payment_date || new Date().toISOString().slice(0, 10),
      client_id: uuidPattern.test(String(payment.clientId || payment.client_id || "")) ? (payment.clientId || payment.client_id) : null,
      invoice_number: payment.invoiceNumber || payment.invoice_number || null,
      amount: Number(payment.amount || 0),
      method: payment.method || null,
      reference: payment.reference || null,
      notes: payment.notes || null
    };
  }

  function mergeBy(rows, keyFn) {
    const map = new Map();
    rows.filter(Boolean).forEach((row) => {
      const key = keyFn(row);
      if (!key) return;
      map.set(key, { ...(map.get(key) || {}), ...row });
    });
    return [...map.values()];
  }

  function missingTable(error, table) {
    const text = String(error?.message || error || "").toLowerCase();
    return text.includes(`public.${table}`) || (text.includes("schema cache") && text.includes(table));
  }

  async function optionalTableRequest(path, table, fallback = []) {
    try {
      return await sbRequest(path, { silent: true });
    } catch (error) {
      if (!missingTable(error, table)) throw error;
      missingOptionalTables.add(table);
      return fallback;
    }
  }

  async function upsertByQuery(table, query, body) {
    const existing = await sbRequest(`${table}?${query}&select=*`);
    if (existing?.length) return sbRequest(`${table}?${query}`, { method: "PATCH", body });
    return sbRequest(table, { method: "POST", body });
  }

  async function loadRemote() {
    if (!isConnected()) {
      notify("Accounting sync is waiting for Supabase sign-in. Local records still show on this device.", true);
      return;
    }
    missingOptionalTables.clear();
    try {
      const [settings, invoices, payments, categories, expenseVatRows, vatPayments] = await Promise.all([
        sbRequest("app_settings?key=eq.company_profile&select=value"),
        sbRequest("invoices?select=*&order=created_at.desc"),
        sbRequest("client_payments?select=*&order=payment_date.desc"),
        sbRequest("expense_categories?select=name&order=name.asc"),
        optionalTableRequest("expense_vat_records?select=*&order=updated_at.desc", "expense_vat_records"),
        sbRequest("vat_payments?select=*&order=payment_date.desc")
      ]);

      if (settings?.[0]?.value) writeJson(keys.company, settings[0].value);

      const mergedInvoices = mergeBy([
        ...readJson(keys.invoices, []).map(normalizeInvoice),
        ...(invoices || []).map(normalizeInvoice)
      ], (invoice) => invoice.invoiceNumber);
      writeJson(keys.invoices, mergedInvoices);

      const mergedPayments = mergeBy([
        ...readJson(keys.payments, []).map(normalizePayment),
        ...(payments || []).map(normalizePayment)
      ], (payment) => payment.id);
      writeJson(keys.payments, mergedPayments);

      const localCategories = readJson(keys.categories, []);
      const remoteCategories = (categories || []).map((row) => row.name).filter(Boolean);
      writeJson(keys.categories, [...new Set([...localCategories, ...remoteCategories])].filter((name) => !baseCategories.has(name)));

      const vatMap = { ...readJson(keys.expenseVat, {}) };
      (expenseVatRows || []).forEach((row) => {
        if (row.expense_id) vatMap[row.expense_id] = { enabled: Boolean(row.enabled), rate: Number(row.rate || 20) };
      });
      writeJson(keys.expenseVat, vatMap);

      writeJson(keys.vatPayments, (vatPayments || []).map((row) => ({
        id: row.id || crypto.randomUUID(),
        date: row.payment_date || row.date || new Date().toISOString().slice(0, 10),
        amount: Number(row.amount || 0),
        notes: row.notes || ""
      })));

      remoteLoaded = true;
      notify(missingOptionalTables.has("expense_vat_records")
        ? "Accounting is connected. Expense VAT choices remain on this device until the expense_vat_records table is created in Supabase."
        : "Accounting sync connected to Supabase.", missingOptionalTables.size > 0);
      if (typeof renderAccounting === "function") setTimeout(renderAccounting, 80);
    } catch (error) {
      notify(`Accounting sync needs Supabase tables: ${error.message || "run the accounting SQL script."}`, true);
    }
  }

  async function syncCompany() {
    const details = readJson(keys.company, null);
    if (!details) return;
    await upsertByQuery("app_settings", "key=eq.company_profile", { key: "company_profile", value: details });
  }

  async function syncInvoices() {
    const rows = readJson(keys.invoices, []).map(normalizeInvoice).filter((invoice) => invoice?.invoiceNumber);
    for (const invoice of rows) {
      await upsertByQuery("invoices", `invoice_number=eq.${encodeURIComponent(invoice.invoiceNumber)}`, invoiceBody(invoice));
    }
  }

  async function syncPayments() {
    const rows = readJson(keys.payments, []).map(normalizePayment).filter(Boolean);
    if (remoteLoaded) {
      const localIds = new Set(rows.map((payment) => String(payment.id || "")).filter((id) => uuidPattern.test(id)));
      const remoteRows = await sbRequest("client_payments?select=id");
      for (const remote of remoteRows || []) {
        if (remote.id && !localIds.has(String(remote.id))) await sbRequest(`client_payments?id=eq.${encodeURIComponent(remote.id)}`, { method: "DELETE" });
      }
    }
    for (const payment of rows) {
      const body = paymentBody(payment);
      if (body.id) await upsertByQuery("client_payments", `id=eq.${encodeURIComponent(body.id)}`, body);
      else await sbRequest("client_payments", { method: "POST", body });
    }
  }

  async function syncCategories() {
    const categories = readJson(keys.categories, []).filter(Boolean);
    if (remoteLoaded) {
      const localNames = new Set(categories);
      const remoteRows = await sbRequest("expense_categories?select=name");
      for (const remote of remoteRows || []) {
        if (remote.name && !baseCategories.has(remote.name) && !localNames.has(remote.name)) {
          await sbRequest(`expense_categories?name=eq.${encodeURIComponent(remote.name)}`, { method: "DELETE" });
        }
      }
    }
    for (const name of categories) await upsertByQuery("expense_categories", `name=eq.${encodeURIComponent(name)}`, { name });
  }

  async function syncExpenseVat() {
    const records = readJson(keys.expenseVat, {});
    try {
      for (const [expenseId, record] of Object.entries(records)) {
        if (!uuidPattern.test(String(expenseId))) continue;
        await upsertByQuery("expense_vat_records", `expense_id=eq.${encodeURIComponent(expenseId)}`, {
          expense_id: expenseId,
          enabled: Boolean(record?.enabled),
          rate: Number(record?.rate || 20),
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      if (missingTable(error, "expense_vat_records")) {
        throw new Error("The Supabase expense_vat_records table is missing. Run the WeSet expense VAT SQL in Supabase SQL Editor.");
      }
      throw error;
    }
  }

  async function syncVatPayments() {
    const rows = readJson(keys.vatPayments, []);
    if (remoteLoaded) {
      const localIds = new Set(rows.map((payment) => String(payment.id || "")).filter((id) => uuidPattern.test(id)));
      const remoteRows = await sbRequest("vat_payments?select=id");
      for (const remote of remoteRows || []) {
        if (remote.id && !localIds.has(String(remote.id))) await sbRequest(`vat_payments?id=eq.${encodeURIComponent(remote.id)}`, { method: "DELETE" });
      }
    }
    for (const payment of rows) {
      const body = {
        id: uuidPattern.test(String(payment.id || "")) ? payment.id : undefined,
        payment_date: payment.date || payment.payment_date || new Date().toISOString().slice(0, 10),
        amount: Number(payment.amount || 0),
        notes: payment.notes || null
      };
      if (body.id) await upsertByQuery("vat_payments", `id=eq.${encodeURIComponent(body.id)}`, body);
      else await sbRequest("vat_payments", { method: "POST", body });
    }
  }

  async function flush() {
    if (syncing || !pending.size) return;
    if (!isConnected()) {
      notify("Accounting changes saved on this device. Sign in to save them to Supabase.", true);
      return;
    }
    syncing = true;
    const tasks = [...pending];
    pending.clear();
    try {
      if (tasks.includes(keys.company)) await syncCompany();
      if (tasks.includes(keys.invoices)) await syncInvoices();
      if (tasks.includes(keys.payments)) await syncPayments();
      if (tasks.includes(keys.categories)) await syncCategories();
      if (tasks.includes(keys.expenseVat)) await syncExpenseVat();
      if (tasks.includes(keys.vatPayments)) await syncVatPayments();
      notify("Accounting changes saved to Supabase.");
    } catch (error) {
      tasks.forEach((key) => pending.add(key));
      notify(`Accounting saved locally, but Supabase did not save yet: ${error.message || "check the tables."}`, true);
    } finally {
      syncing = false;
    }
  }

  function queue(key) {
    if (applyingRemote || !Object.values(keys).includes(key)) return;
    pending.add(key);
    clearTimeout(window.wesetAccountingSyncTimer);
    window.wesetAccountingSyncTimer = setTimeout(flush, 500);
  }

  function wrapLocalStorage() {
    if (window.wesetAccountingSyncWrappedStorage) return;
    window.wesetAccountingSyncWrappedStorage = true;
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function setItemWithAccountingSync(key, value) {
      const result = original(key, value);
      queue(key);
      return result;
    };
  }

  function refreshUi() {
    ensureStyles();
    ensureStatusPanel();
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting && !window.wesetAccountingSyncWrappedRender) {
    window.wesetAccountingSyncWrappedRender = true;
    renderAccounting = function renderAccountingWithSupabaseSync(...args) {
      const result = oldRenderAccounting.apply(this, args);
      setTimeout(refreshUi, 0);
      return result;
    };
  }

  window.wesetSyncAccountingToSupabase = flush;
  window.wesetLoadAccountingFromSupabase = loadRemote;
  window.wesetAccountingSyncVersion = VERSION;
  wrapLocalStorage();
  refreshUi();
  setTimeout(loadRemote, 1000);
})();

