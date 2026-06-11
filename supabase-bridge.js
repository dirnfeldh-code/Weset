const sbUrl = "https://xonmwexosjogdgmahrvr.supabase.co";
const sbAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvbm13ZXhvc2pvZ2RnbWFocnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNzkwMTksImV4cCI6MjA5Njc1NTAxOX0.nl3EMw10udFg4MRUAQ5Qspe5ZJGx2boB3uu7Bi_7mGM";

function sbSession() {
  try {
    const saved = localStorage.getItem(sessionKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function sbIsConnected() {
  return Boolean(sbSession()?.accessToken);
}

async function sbAuth(email, password) {
  const response = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: sbAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Supabase login failed.");
  return data;
}

async function sbRequest(path, options = {}) {
  const token = sbSession()?.accessToken || sbAnonKey;
  const response = await fetch(`${sbUrl}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: sbAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.hint || "Supabase request failed.");
  }
  if (response.status === 204) return null;
  return response.json();
}

async function sbLogin(event) {
  event.preventDefault();
  const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
  const password = document.querySelector("#loginPassword").value;
  els.loginError.textContent = "Signing in with Supabase...";
  try {
    const auth = await sbAuth(email, password);
    const user = {
      id: auth.user?.id || email,
      email,
      name: auth.user?.user_metadata?.name || email,
      role: "Owner",
      permissions: typeof views !== "undefined" ? views : allViews,
      active: true
    };
    state.users = typeof mergeUsers === "function" ? mergeUsers([user, ...(state.users || []).filter((item) => item.email !== email)]) : [user];
    saveState();
    localStorage.setItem(sessionKey, JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      loggedInAt: new Date().toISOString()
    }));
    await sbLoadAll();
    els.loginError.textContent = "";
    updateAuthView();
    render();
  } catch (error) {
    console.warn(error);
    els.loginError.textContent = "Create this email/password in Supabase Authentication first, then sign in again.";
  }
}

async function sbLoadAll() {
  if (!sbIsConnected()) return;
  const [clients, items, quotes, quoteItems, expenses, appUsers] = await Promise.all([
    sbRequest("clients?select=*&order=created_at.asc"),
    sbRequest("items?select=*&order=created_at.asc"),
    sbRequest("quotes?select=*&order=created_at.desc"),
    sbRequest("quote_items?select=*&order=created_at.asc"),
    sbRequest("expenses?select=*&order=expense_date.desc"),
    sbRequest("app_users?select=*&order=created_at.asc")
  ]);
  state.clients = clients.map(sbClientFromRow);
  state.catalog = typeof mergeCatalog === "function" ? mergeCatalog(items.map(sbItemFromRow)) : items.map(sbItemFromRow);
  state.expenses = expenses.map(sbExpenseFromRow);
  state.users = typeof mergeUsers === "function" ? mergeUsers(appUsers.map(sbUserFromRow)) : appUsers.map(sbUserFromRow);
  state.quotes = quotes.map((quote) => sbQuoteFromRow(quote, quoteItems.filter((item) => item.quote_id === quote.id)));
  saveState();
}

function sbClientFromRow(row) {
  return {
    id: row.id,
    company: row.company_name || "",
    contact: row.contact_name || "",
    email: row.email || "",
    phone: row.phone || "",
    site: [row.address_line1, row.address_line2, row.city, row.postcode].filter(Boolean).join(", "),
    notes: row.notes || ""
  };
}

function sbItemFromRow(row) {
  return {
    id: row.id,
    name: row.name || "",
    category: row.category || "Custom",
    unitCost: Number(row.unit_cost || 0),
    unit: row.unit || "each",
    defaultQuantity: Number(row.default_quantity || 1),
    supplier: row.supplier || "",
    code: row.product_code || "",
    leadTime: row.lead_time || "",
    description: row.description || ""
  };
}

function sbQuoteFromRow(row, itemRows) {
  return {
    id: row.id,
    clientId: row.client_id,
    premises: [row.setup_address_line1, row.setup_address_line2, row.setup_city, row.setup_postcode].filter(Boolean).join(", "),
    rooms: Number(row.room_count || 1),
    workstations: Number(row.workstations || 1),
    requiredDate: row.required_date || "",
    items: itemRows.map(sbQuoteItemFromRow),
    notes: row.notes || "",
    status: row.status || "Draft",
    installStatus: "Not scheduled",
    installDate: ""
  };
}

function sbQuoteItemFromRow(row) {
  return {
    id: row.item_id || row.id,
    name: row.item_name || "Item",
    category: "Custom",
    unitCost: Number(row.unit_cost || 0),
    unit: "each",
    quantity: Number(row.quantity || 1)
  };
}

function sbExpenseFromRow(row) {
  return {
    id: row.id,
    date: row.expense_date || "",
    category: row.category || "",
    payee: row.payee || "",
    amount: Number(row.amount || 0),
    notes: row.notes || ""
  };
}

function sbUserFromRow(row) {
  return {
    id: row.id,
    name: row.full_name || row.email || "User",
    email: row.email || "",
    role: row.role || "Staff",
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    active: row.active !== false
  };
}

function sbCurrentAddress(fields) {
  return {
    address_line1: fields.line1.value.trim(),
    address_line2: fields.line2.value.trim(),
    city: fields.city.value.trim(),
    postcode: fields.postcode.value.trim()
  };
}

async function sbSaveClient(event) {
  event.preventDefault();
  updateAddressPreview(clientAddressFields());
  if (!isUkPostcode(els.clientAddressPostcode.value)) {
    alert("Please enter the company postcode in a format like N16 6JA.");
    els.clientAddressPostcode.focus();
    return;
  }
  const address = sbCurrentAddress(clientAddressFields());
  const [saved] = await sbRequest("clients", {
    method: "POST",
    body: {
      company_name: document.querySelector("#clientCompany").value.trim(),
      contact_name: document.querySelector("#clientContact").value.trim(),
      email: document.querySelector("#clientEmail").value.trim(),
      phone: document.querySelector("#clientPhone").value.trim(),
      ...address,
      notes: document.querySelector("#clientNotes").value.trim()
    }
  });
  state.clients.push(sbClientFromRow(saved));
  saveState();
  els.clientForm.reset();
  updateAddressPreview(clientAddressFields());
  els.clientDialog.close();
  render();
}

async function sbSaveItem(event) {
  event.preventDefault();
  const [saved] = await sbRequest("items", {
    method: "POST",
    body: {
      name: document.querySelector("#itemName").value.trim(),
      category: document.querySelector("#itemCategory").value,
      unit_cost: Number(document.querySelector("#itemUnitCost").value),
      unit: document.querySelector("#itemUnit").value,
      default_quantity: Number(document.querySelector("#itemDefaultQuantity").value),
      supplier: document.querySelector("#itemSupplier").value.trim(),
      product_code: document.querySelector("#itemCode").value.trim(),
      lead_time: document.querySelector("#itemLeadTime").value.trim(),
      description: document.querySelector("#itemDescription").value.trim()
    }
  });
  const item = sbItemFromRow(saved);
  state.catalog.push(item);
  if (document.querySelector("#addItemToCurrentQuote").checked) selectedQuoteItems.push({ ...item, quantity: item.defaultQuantity });
  saveState();
  els.itemForm.reset();
  els.itemDialog.close();
  render();
}

async function sbSaveQuote(event) {
  event.preventDefault();
  updateAddressPreview(setupAddressFields());
  if (!selectedQuoteItems.length) return alert("Add at least one item or service to the quote.");
  if (!isUkPostcode(els.addressPostcode.value)) {
    alert("Please enter a UK postcode in a format like N16 6JA.");
    els.addressPostcode.focus();
    return;
  }
  const costs = quoteCosts({ items: selectedQuoteItems });
  const address = sbCurrentAddress(setupAddressFields());
  const [savedQuote] = await sbRequest("quotes", {
    method: "POST",
    body: {
      client_id: els.quoteClient.value,
      status: "Draft",
      room_count: Number(document.querySelector("#roomCount").value),
      workstations: Number(document.querySelector("#workstations").value),
      required_date: document.querySelector("#requiredDate").value || null,
      setup_address_line1: address.address_line1,
      setup_address_line2: address.address_line2,
      setup_city: address.city,
      setup_postcode: address.postcode,
      notes: document.querySelector("#quoteNotes").value.trim(),
      supply_total: costs.supply,
      services_total: costs.services,
      total: costs.total
    }
  });
  const rows = selectedQuoteItems.map((item) => ({
    quote_id: savedQuote.id,
    item_id: sbIsUuid(item.id) ? item.id : null,
    item_name: item.name,
    quantity: Number(item.quantity || 1),
    unit_cost: Number(item.unitCost || 0),
    total: Number(item.quantity || 1) * Number(item.unitCost || 0)
  }));
  const savedItems = await sbRequest("quote_items", { method: "POST", body: rows });
  state.quotes.unshift(sbQuoteFromRow(savedQuote, savedItems));
  saveState();
  resetQuoteForm();
  render();
}

async function sbSaveExpense(event) {
  event.preventDefault();
  const [saved] = await sbRequest("expenses", {
    method: "POST",
    body: {
      expense_date: els.expenseDate.value,
      category: els.expenseCategory.value,
      payee: els.expensePayee.value.trim(),
      amount: Number(els.expenseAmount.value),
      notes: els.expenseNotes.value.trim()
    }
  });
  state.expenses.unshift(sbExpenseFromRow(saved));
  saveState();
  els.expenseForm.reset();
  els.expenseDate.value = todayPlus(0);
  renderAccounting();
}

async function sbDeleteExpense(event) {
  const id = event.target.dataset.deleteExpense;
  if (!id) return;
  if (sbIsUuid(id)) await sbRequest(`expenses?id=eq.${id}`, { method: "DELETE" });
  state.expenses = state.expenses.filter((expense) => expense.id !== id);
  saveState();
  renderAccounting();
}

async function sbUpdateQuote(id, patch) {
  if (sbIsConnected() && sbIsUuid(id) && patch.status) {
    await sbRequest(`quotes?id=eq.${id}`, { method: "PATCH", body: { status: patch.status } });
  }
  state.quotes = state.quotes.map((quote) => quote.id === id ? { ...quote, ...patch } : quote);
  saveState();
  render();
}

function sbIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function sbReplaceHandlers() {
  if (typeof login === "function") els.loginForm.removeEventListener("submit", login);
  if (typeof handleLogin === "function") els.loginForm.removeEventListener("submit", handleLogin);
  if (typeof saveClient === "function") els.clientForm.removeEventListener("submit", saveClient);
  if (typeof saveQuote === "function") els.quoteForm.removeEventListener("submit", saveQuote);
  if (typeof saveItem === "function") els.itemForm.removeEventListener("submit", saveItem);
  if (typeof saveExpense === "function") els.expenseForm?.removeEventListener("submit", saveExpense);
  if (typeof deleteExpense === "function") els.expensesTable?.removeEventListener("click", deleteExpense);

  els.loginForm.addEventListener("submit", sbLogin);
  els.clientForm.addEventListener("submit", (event) => sbIsConnected() ? sbSaveClient(event).catch(sbShowError) : undefined);
  els.quoteForm.addEventListener("submit", (event) => sbIsConnected() ? sbSaveQuote(event).catch(sbShowError) : undefined);
  els.itemForm.addEventListener("submit", (event) => sbIsConnected() ? sbSaveItem(event).catch(sbShowError) : undefined);
  els.expenseForm?.addEventListener("submit", (event) => sbIsConnected() ? sbSaveExpense(event).catch(sbShowError) : undefined);
  els.expensesTable?.addEventListener("click", (event) => sbIsConnected() ? sbDeleteExpense(event).catch(sbShowError) : undefined);

  if (typeof updateQuote === "function") updateQuote = sbUpdateQuote;
}

function sbShowError(error) {
  console.warn(error);
  alert(`Supabase could not save this yet: ${error.message}`);
}

sbReplaceHandlers();
sbLoadAll().then(render).catch((error) => console.warn(error));
