(() => {
  let editingItemId = "";

  const clean = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
  const connected = () => typeof sbIsConnected === "function" ? sbIsConnected() : Boolean(JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken);

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

  function showLocalOnlyMessage() {
    alert("This change was made on this device only. Sign in to Supabase first if you want item changes saved in the database.");
  }

  function renderItemRows() {
    const query = els.searchInput.value.trim().toLowerCase();
    const items = (state.catalog || []).filter((item) => !query || Object.values(item).join(" ").toLowerCase().includes(query));
    els.catalogList.innerHTML = items.map((item) => `<article class="catalog-item">
      <div>
        <h3>${clean(item.name)}</h3>
        <p class="meta">${clean(item.description)}<br>${clean(item.supplier)} | ${clean(item.code)} | ${clean(item.leadTime)}</p>
        <div class="card-actions">
          <button class="secondary" data-edit-item="${clean(item.id)}" type="button">Edit</button>
          <button class="ghost danger" data-delete-item="${clean(item.id)}" type="button">Delete</button>
        </div>
      </div>
      <div><span class="badge ${className(item.category)}">${clean(item.category)}</span><strong>${formatMoney(item.unitCost)}</strong><p class="meta">${clean(item.unit)}</p></div>
    </article>`).join("") || empty("No items match your search.");
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
    const localItem = itemFromForm(editingItemId);
    let savedItem = localItem;

    if (connected() && typeof sbRequest === "function") {
      const body = rowFromItem(localItem);
      if (editingItemId && isUuid(editingItemId)) {
        const [row] = await sbRequest(`items?id=eq.${editingItemId}`, { method: "PATCH", body });
        savedItem = itemFromRow(row);
      } else {
        const [row] = await sbRequest("items", { method: "POST", body });
        savedItem = itemFromRow(row);
      }
    } else {
      showLocalOnlyMessage();
    }

    state.catalog = editingItemId
      ? (state.catalog || []).map((item) => item.id === editingItemId ? savedItem : item)
      : [...(state.catalog || []), savedItem];
    if (document.querySelector("#addItemToCurrentQuote").checked) selectedQuoteItems.push({ ...savedItem, quantity: savedItem.defaultQuantity || 1 });
    editingItemId = "";
    saveState();
    els.itemForm.reset();
    els.itemDialog.close();
    render();
  }

  async function deleteItem(id) {
    const item = (state.catalog || []).find((entry) => entry.id === id);
    if (!item) return;
    if (!confirm(`Delete ${item.name}?`)) return;
    if (connected() && typeof sbRequest === "function" && isUuid(id)) {
      await sbRequest(`quote_items?item_id=eq.${id}`, { method: "PATCH", body: { item_id: null } });
      await sbRequest(`items?id=eq.${id}`, { method: "DELETE" });
    } else if (!connected()) {
      showLocalOnlyMessage();
    }
    state.catalog = (state.catalog || []).filter((entry) => entry.id !== id);
    selectedQuoteItems = selectedQuoteItems.filter((entry) => entry.id !== id);
    saveState();
    render();
  }

  function installItemFix() {
    if (!els?.catalogList || !els?.itemForm) return;
    if (typeof renderItems === "function") renderItems = renderItemRows;
    if (typeof openItemDialog === "function") openItemDialog = openNewItem;

    const cleanForm = els.itemForm.cloneNode(true);
    els.itemForm.replaceWith(cleanForm);
    els.itemForm = cleanForm;
    els.itemForm.addEventListener("submit", (event) => saveItem(event).catch((error) => alert(`Could not save item: ${error.message || "Please check Supabase and try again."}`)));

    const cleanList = els.catalogList.cloneNode(true);
    els.catalogList.replaceWith(cleanList);
    els.catalogList = cleanList;
    els.catalogList.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-item]");
      const deleteButton = event.target.closest("[data-delete-item]");
      if (editButton) openItemEditor(editButton.dataset.editItem);
      if (deleteButton) deleteItem(deleteButton.dataset.deleteItem).catch((error) => alert(`Could not delete item: ${error.message || "Please check Supabase and try again."}`));
    });

    renderItems();
  }

  installItemFix();
})();
