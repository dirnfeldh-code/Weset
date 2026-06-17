(() => {
  let editingQuoteId = "";
  let formHome = null;
  let formNext = null;
  let placeholder = null;

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

  function formatPostcodeSafe(value) {
    if (typeof formatPostcode === "function") return formatPostcode(value);
    const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return compact.length <= 3 ? compact : `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }

  function validPostcodeSafe(value) {
    if (typeof isUkPostcode === "function") return isUkPostcode(value);
    return /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/i.test(formatPostcodeSafe(value));
  }

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function splitAddress(text) {
    const value = String(text || "");
    const postcodeMatch = value.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    const postcode = postcodeMatch ? formatPostcodeSafe(postcodeMatch[0]) : "";
    const withoutPostcode = postcodeMatch ? value.replace(postcodeMatch[0], "") : value;
    const parts = withoutPostcode.split(",").map((part) => part.trim()).filter(Boolean);
    return {
      line1: parts[0] || "",
      line2: parts.length > 2 ? parts.slice(1, -1).join(", ") : "",
      city: parts.length > 1 ? parts[parts.length - 1] : "",
      postcode
    };
  }

  function setMessage(message, type = "is-warn", focusField = null) {
    const status = document.querySelector("#addressStatus");
    if (status) {
      status.textContent = message;
      status.className = `address-status ${type}`.trim();
    }
    if (focusField?.focus) focusField.focus();
  }

  function setSaveButton(text) {
    const button = els.quoteForm?.querySelector('button[type="submit"]');
    if (button) button.textContent = text;
  }

  function ensureDialog() {
    let dialog = document.querySelector("#quoteAmendDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "quoteAmendDialog";
    dialog.innerHTML = `<div class="dialog-card wide quote-amend-card">
      <div class="panel-head">
        <div>
          <h2 id="quoteAmendTitle">Amend quote</h2>
          <p class="meta">Change the quote here without using the create quote panel.</p>
        </div>
        <button class="icon-btn" id="closeQuoteAmendDialog" type="button" aria-label="Close">x</button>
      </div>
      <div id="quoteAmendFormSlot"></div>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#closeQuoteAmendDialog")?.addEventListener("click", () => closeEditor(true));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeEditor(true);
    });
    return dialog;
  }

  function moveFormToDialog() {
    const form = els.quoteForm;
    const dialog = ensureDialog();
    const slot = dialog.querySelector("#quoteAmendFormSlot");
    if (!form || !slot) return dialog;
    if (!formHome) {
      formHome = form.parentNode;
      formNext = form.nextSibling;
      placeholder = document.createComment("quote form returns here");
      formHome.insertBefore(placeholder, formNext);
    }
    slot.appendChild(form);
    return dialog;
  }

  function returnFormHome() {
    const form = els.quoteForm;
    if (!form || !formHome) return;
    formHome.insertBefore(form, placeholder || formNext);
    placeholder?.remove();
    formHome = null;
    formNext = null;
    placeholder = null;
  }

  function quoteAddress() {
    const fields = setupAddressFields();
    if (typeof updateAddressPreview === "function") updateAddressPreview(fields);
    fields.postcode.value = formatPostcodeSafe(fields.postcode.value);
    return {
      setup_address_line1: fields.line1.value.trim(),
      setup_address_line2: fields.line2.value.trim(),
      setup_city: fields.city.value.trim(),
      setup_postcode: fields.postcode.value.trim()
    };
  }

  function validate() {
    const fields = setupAddressFields();
    const address = quoteAddress();
    if (!els.quoteClient?.value || !isUuid(els.quoteClient.value)) {
      setMessage("Choose a real Supabase client before saving the quote.", "is-warn", els.quoteClient);
      return false;
    }
    if (!selectedQuoteItems?.length) {
      setMessage("Add at least one item before saving the quote.", "is-warn");
      return false;
    }
    if (!address.setup_address_line1) {
      setMessage("Add the setup building number and street before saving the quote.", "is-warn", fields.line1);
      return false;
    }
    if (!address.setup_city) {
      setMessage("Add the setup town or city before saving the quote.", "is-warn", fields.city);
      return false;
    }
    if (!validPostcodeSafe(address.setup_postcode)) {
      setMessage("Add a valid UK setup postcode before saving, for example N16 6JA.", "is-warn", fields.postcode);
      return false;
    }
    return true;
  }

  function fillForm(quote) {
    if (els.quoteClient) els.quoteClient.value = quote.clientId || "";
    const rooms = document.querySelector("#roomCount");
    const workstations = document.querySelector("#workstations");
    const requiredDate = document.querySelector("#requiredDate");
    const notes = document.querySelector("#quoteNotes");
    if (rooms) rooms.value = quote.rooms || 1;
    if (workstations) workstations.value = quote.workstations || 1;
    if (requiredDate) requiredDate.value = quote.requiredDate || "";
    if (notes) notes.value = quote.notes || "";

    const address = splitAddress(quote.premises);
    document.querySelector("#addressLine1").value = address.line1;
    document.querySelector("#addressLine2").value = address.line2;
    document.querySelector("#addressCity").value = address.city;
    document.querySelector("#addressPostcode").value = address.postcode;
    if (typeof updateAddressPreview === "function") updateAddressPreview(setupAddressFields());

    selectedQuoteItems = (quote.items || []).map((item) => ({ ...item }));
    if (typeof renderSelectedItems === "function") renderSelectedItems();
  }

  function openEditor(id) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote) return;
    editingQuoteId = id;
    if (typeof switchView === "function") switchView("quotes");
    const dialog = moveFormToDialog();
    const title = dialog.querySelector("#quoteAmendTitle");
    if (title) title.textContent = `Amend ${quoteRef(quote)}`;
    fillForm(quote);
    setSaveButton("Update quote request");
    setMessage(`Amending ${quoteRef(quote)}. Save to update this quote.`, "is-ok");
    dialog.showModal();
  }

  function closeEditor(resetForm = false) {
    const dialog = document.querySelector("#quoteAmendDialog");
    if (dialog?.open) dialog.close();
    editingQuoteId = "";
    setSaveButton("Save quote request");
    returnFormHome();
    if (resetForm && typeof resetQuoteForm === "function") resetQuoteForm();
  }

  async function saveEditor(event) {
    if (!editingQuoteId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (typeof sbIsConnected === "function" && !sbIsConnected()) {
      alert("Please log in first. Quotes can be changed only when the app is connected to Supabase.");
      return;
    }
    if (!validate()) return;

    const existing = (state.quotes || []).find((entry) => entry.id === editingQuoteId);
    if (!existing) return;
    const address = quoteAddress();
    const costs = quoteCosts({ items: selectedQuoteItems });
    const body = {
      client_id: els.quoteClient.value,
      room_count: Number(document.querySelector("#roomCount").value || 1),
      workstations: Number(document.querySelector("#workstations").value || 1),
      required_date: document.querySelector("#requiredDate").value || null,
      setup_address_line1: address.setup_address_line1,
      setup_address_line2: address.setup_address_line2,
      setup_city: address.setup_city,
      setup_postcode: address.setup_postcode,
      notes: document.querySelector("#quoteNotes").value.trim(),
      supply_total: costs.supply,
      services_total: costs.services,
      total: costs.total
    };

    const [savedQuote] = await sbRequest(`quotes?id=eq.${editingQuoteId}`, { method: "PATCH", body });
    await sbRequest(`quote_items?quote_id=eq.${editingQuoteId}`, { method: "DELETE" });
    const rows = selectedQuoteItems.map((item) => ({
      quote_id: editingQuoteId,
      item_id: isUuid(item.id) ? item.id : null,
      item_name: item.name,
      quantity: Number(item.quantity || 1),
      unit_cost: Number(item.unitCost || 0),
      total: Number(item.quantity || 1) * Number(item.unitCost || 0)
    }));
    const savedItems = rows.length ? await sbRequest("quote_items", { method: "POST", body: rows }) : [];
    const updated = typeof sbQuoteFromRow === "function"
      ? sbQuoteFromRow(savedQuote, savedItems)
      : {
          ...existing,
          clientId: body.client_id,
          rooms: body.room_count,
          workstations: body.workstations,
          requiredDate: body.required_date || "",
          premises: [body.setup_address_line1, body.setup_address_line2, body.setup_city, body.setup_postcode].filter(Boolean).join(", "),
          notes: body.notes,
          items: selectedQuoteItems.map((item) => ({ ...item }))
        };
    updated.status = existing.status || updated.status;
    updated.installStatus = existing.installStatus || updated.installStatus;
    updated.installDate = existing.installDate || updated.installDate;
    state.quotes = (state.quotes || []).map((quote) => quote.id === editingQuoteId ? updated : quote);
    if (typeof saveState === "function") saveState();
    closeEditor(true);
    if (typeof render === "function") render();
    alert("Quote amended and saved.");
  }

  window.addEventListener("click", (event) => {
    const editButton = event.target.closest?.("[data-edit-quote]");
    const clearButton = event.target.closest?.("#resetQuoteFormBtn");
    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openEditor(editButton.dataset.editQuote);
    }
    if (clearButton && editingQuoteId) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      closeEditor(true);
    }
  }, true);

  window.addEventListener("submit", (event) => {
    if (event.target?.matches?.("#quoteForm") && editingQuoteId) {
      saveEditor(event).catch((error) => alert(`Could not amend quote: ${error.message || "Please try again."}`));
    }
  }, true);
})();
