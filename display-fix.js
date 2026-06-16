(() => {
  const safeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
  let editingItemId = "";

  function session() {
    try { return JSON.parse(localStorage.getItem(sessionKey) || "null"); } catch { return null; }
  }

  function hasSupabaseToken() {
    return Boolean(session()?.accessToken);
  }

  function setLoginNotice(message, ok = false) {
    const target = document.querySelector("#loginError");
    if (!target) return;
    target.textContent = message;
    target.style.color = ok ? "#157a5b" : "";
  }

  function enforceSupabaseConnection() {
    if (!hasSupabaseToken()) {
      els.loginScreen.classList.remove("is-hidden");
      setLoginNotice("Sign in with Supabase to manage live clients, quotes, items, users, and accounting data.");
      return false;
    }
    return true;
  }

  async function refreshSupabaseData() {
    if (!hasSupabaseToken() || typeof sbLoadAll !== "function") return;
    setLoginNotice("Connected to Supabase. Loading live data...", true);
    try {
      await sbLoadAll();
      setLoginNotice("Connected to Supabase.", true);
      if (typeof render === "function") render();
    } catch (error) {
      els.loginScreen.classList.remove("is-hidden");
      setLoginNotice(`Signed in, but Supabase data could not load: ${error.message || "check tables and RLS policies."}`);
    }
  }

  const displayClientName = (client) => {
    const name = client?.company || client?.contact || client?.email || "";
    return String(name).trim() || "Client";
  };

  const readableClient = (id) => {
    const match = (state.clients || []).find((client) => client.id === id);
    return match || { id, company: "Client", contact: "", email: "", site: "", phone: "", notes: "" };
  };

  function itemFromForm(existingId = "") {
    return {
      id: existingId || `item-${crypto.randomUUID()}`,
      name: document.querySelector("#itemName").value.trim(),
      category: document.querySelector("#itemCategory").value,
      unitCost: Number(document.querySelector("#itemUnitCost").value),
      unit: document.querySelector("#itemUnit").value,
      defaultQuantity: Number(document.querySelector("#itemDefaultQuantity").value),
      supplier: document.querySelector("#itemSupplier").value.trim(),
      code: document.querySelector("#itemCode").value.trim(),
      leadTime: document.querySelector("#itemLeadTime").value.trim(),
      description: document.querySelector("#itemDescription").value.trim()
    };
  }

  function rowFromItem(item) {
    return {
      name: item.name,
      category: item.category,
      unit_cost: Number(item.unitCost || 0),
      unit: item.unit || "each",
      default_quantity: Number(item.defaultQuantity || 1),
      supplier: item.supplier || "",
      product_code: item.code || "",
      lead_time: item.leadTime || "",
      description: item.description || ""
    };
  }

  function itemFromRow(row) {
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

  function requireSupabaseForWrite() {
    if (hasSupabaseToken()) return true;
    els.loginScreen.classList.remove("is-hidden");
    setLoginNotice("Please sign in first. Item changes are only saved when Supabase is connected.");
    alert("Please sign in first. Item changes are only saved when Supabase is connected.");
    return false;
  }

  function renderItemRows() {
    const query = els.searchInput.value.trim().toLowerCase();
    const items = (state.catalog || []).filter((item) => !query || Object.values(item).join(" ").toLowerCase().includes(query));
    els.catalogList.innerHTML = items.map((item) => `<article class="catalog-item">
      <div>
        <h3>${safeText(item.name)}</h3>
        <p class="meta">${safeText(item.description)}<br>${safeText(item.supplier)} | ${safeText(item.code)} | ${safeText(item.leadTime)}</p>
        <div class="card-actions">
          <button class="secondary" data-edit-item="${safeText(item.id)}" type="button">Edit</button>
          <button class="ghost danger" data-delete-item="${safeText(item.id)}" type="button">Delete</button>
        </div>
      </div>
      <div><span class="badge ${className(item.category)}">${safeText(item.category)}</span><strong>${formatMoney(item.unitCost)}</strong><p class="meta">${safeText(item.unit)}</p></div>
    </article>`).join("") || empty("No live items found. Sign in to Supabase, then refresh.");
  }

  function openItemEditor(id) {
    const item = (state.catalog || []).find((entry) => entry.id === id);
    if (!item) return;
    editingItemId = id;
    els.itemForm.reset();
    els.itemDialog.querySelector("h2").textContent = "Edit item";
    document.querySelector("#itemName").value = item.name || "";
    document.querySelector("#itemCategory").value = item.category || "Custom";
    document.querySelector("#itemUnitCost").value = Number(item.unitCost || 0);
    document.querySelector("#itemUnit").value = item.unit || "each";
    document.querySelector("#itemDefaultQuantity").value = Number(item.defaultQuantity || 1);
    document.querySelector("#itemSupplier").value = item.supplier || "";
    document.querySelector("#itemCode").value = item.code || "";
    document.querySelector("#itemLeadTime").value = item.leadTime || "";
    document.querySelector("#itemDescription").value = item.description || "";
    document.querySelector("#addItemToCurrentQuote").checked = false;
    els.itemDialog.showModal();
  }

  function openNewItem(addToQuote = false) {
    editingItemId = "";
    els.itemForm.reset();
    els.itemDialog.querySelector("h2").textContent = "Create item";
    document.querySelector("#addItemToCurrentQuote").checked = Boolean(addToQuote);
    els.itemDialog.showModal();
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!requireSupabaseForWrite()) return;
    const item = itemFromForm(editingItemId);
    const body = rowFromItem(item);
    let savedItem;
    if (editingItemId && isUuid(editingItemId)) {
      const [row] = await sbRequest(`items?id=eq.${editingItemId}`, { method: "PATCH", body });
      savedItem = itemFromRow(row);
    } else {
      const [row] = await sbRequest("items", { method: "POST", body });
      savedItem = itemFromRow(row);
    }
    state.catalog = editingItemId
      ? (state.catalog || []).map((entry) => entry.id === editingItemId ? savedItem : entry)
      : [...(state.catalog || []), savedItem];
    if (document.querySelector("#addItemToCurrentQuote").checked) selectedQuoteItems.push({ ...savedItem, quantity: savedItem.defaultQuantity || 1 });
    editingItemId = "";
    saveState();
    els.itemForm.reset();
    els.itemDialog.close();
    render();
  }

  async function deleteItem(id) {
    if (!requireSupabaseForWrite()) return;
    const item = (state.catalog || []).find((entry) => entry.id === id);
    if (!item) return;
    if (!confirm(`Delete ${item.name}?`)) return;
    if (isUuid(id)) {
      await sbRequest(`quote_items?item_id=eq.${id}`, { method: "PATCH", body: { item_id: null } });
      await sbRequest(`items?id=eq.${id}`, { method: "DELETE" });
    }
    state.catalog = (state.catalog || []).filter((entry) => entry.id !== id);
    selectedQuoteItems = selectedQuoteItems.filter((entry) => entry.id !== id);
    saveState();
    render();
  }

  function installDisplayFix() {
    const quickQuoteBtn = document.querySelector("#quickQuoteBtn");
    if (quickQuoteBtn) quickQuoteBtn.textContent = "New quote";

    if (typeof getClient === "function") getClient = readableClient;

    if (typeof renderClientSelect === "function") {
      renderClientSelect = function fixedRenderClientSelect() {
        els.quoteClient.innerHTML = (state.clients || []).map((client) => `<option value="${safeText(client.id)}">${safeText(displayClientName(client))}</option>`).join("");
      };
    }

    if (typeof renderClients === "function") {
      renderClients = function fixedRenderClients() {
        const rows = filteredClients().map((client) => {
          const openWork = state.quotes.filter((quote) => quote.clientId === client.id && quote.installStatus !== "Complete").length;
          return `<tr>
            <td><strong>${safeText(displayClientName(client))}</strong><p class="meta">${safeText(client.notes || "No notes")}</p></td>
            <td>${safeText(client.contact || "No contact name")}<p class="meta">${safeText(client.email || "No email")}</p></td>
            <td>${safeText(client.site || "No address saved")}</td>
            <td>${safeText(client.phone || "No phone")}</td>
            <td>${openWork}</td>
            <td><button class="secondary" data-new-quote="${safeText(client.id)}" type="button">New quote</button></td>
          </tr>`;
        }).join("");
        els.clientsTable.innerHTML = rows || `<tr><td colspan="6">${empty("No live clients found. Sign in to Supabase, then refresh.")}</td></tr>`;
        document.querySelectorAll("[data-new-quote]").forEach((button) => button.addEventListener("click", () => {
          switchView("quotes");
          els.quoteClient.value = button.dataset.newQuote;
          const client = readableClient(button.dataset.newQuote);
          if (client.site) fillAddressFromText(client.site);
        }));
      };
    }

    if (typeof renderQuoteCard === "function") {
      renderQuoteCard = function fixedRenderQuoteCard(quote) {
        const client = readableClient(quote.clientId);
        const costs = quoteCosts(quote);
        const items = quoteItems(quote);
        return `<article class="quote-card">
          <div class="card-top">
            <div><h3>${safeText(displayClientName(client))}</h3><p class="meta">Quote ${safeText(quote.id)} | ${quote.workstations} workstations, ${quote.rooms} rooms<br>${safeText(quote.premises)}</p></div>
            <span class="badge ${className(quote.status)}">${safeText(quote.status)}</span>
          </div>
          <p class="meta">${items.slice(0, 4).map((item) => `${item.quantity}x ${safeText(item.name)}`).join(", ")}</p>
          <p class="meta">Required ${formatDate(quote.requiredDate)} | Total ${formatMoney(costs.total)}</p>
          <div class="card-actions">
            <button class="secondary" data-send-quote="${safeText(quote.id)}" type="button">Prepare email</button>
            <button class="ghost" data-status="${safeText(quote.id)}:Sent" type="button">Mark sent</button>
            <button class="ghost" data-status="${safeText(quote.id)}:Accepted" type="button">Accept</button>
            <button class="ghost" data-status="${safeText(quote.id)}:Declined" type="button">Decline</button>
          </div>
        </article>`;
      };
    }

    if (typeof renderNextAction === "function") renderNextAction = () => { els.nextAction.textContent = "Create new quote"; };
    if (typeof renderItems === "function") renderItems = renderItemRows;
    if (typeof openItemDialog === "function") openItemDialog = openNewItem;

    if (els?.itemForm) {
      const cleanForm = els.itemForm.cloneNode(true);
      els.itemForm.replaceWith(cleanForm);
      els.itemForm = cleanForm;
      els.itemForm.addEventListener("submit", (event) => saveItem(event).catch((error) => alert(`Could not save item: ${error.message || "Please check Supabase and try again."}`)));
    }

    if (els?.catalogList) {
      const cleanList = els.catalogList.cloneNode(true);
      els.catalogList.replaceWith(cleanList);
      els.catalogList = cleanList;
      els.catalogList.addEventListener("click", (event) => {
        const editButton = event.target.closest("[data-edit-item]");
        const deleteButton = event.target.closest("[data-delete-item]");
        if (editButton) openItemEditor(editButton.dataset.editItem);
        if (deleteButton) deleteItem(deleteButton.dataset.deleteItem).catch((error) => alert(`Could not delete item: ${error.message || "Please check Supabase and try again."}`));
      });
    }

    enforceSupabaseConnection();
    refreshSupabaseData();
    if (typeof render === "function") render();
  }

  installDisplayFix();
})();
