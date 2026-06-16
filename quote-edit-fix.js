(() => {
  let editingQuoteId = "";

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
  }

  function dateText(value) {
    if (typeof formatDate === "function") return formatDate(value);
    if (typeof date === "function") return date(value);
    return value || "No date";
  }

  function classText(value) {
    if (typeof className === "function") return className(value);
    if (typeof cls === "function") return cls(value);
    return String(value || "").replaceAll(" ", "-");
  }

  function clientTitle(client) {
    return String(client?.company || client?.contact || client?.email || "Client").trim() || "Client";
  }

  function formatPostcodeSafe(value) {
    if (typeof formatPostcode === "function") return formatPostcode(value);
    const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return compact.length <= 3 ? compact : `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }

  function validPostcodeSafe(value) {
    if (typeof isUkPostcode === "function") return isUkPostcode(value);
    return /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/i.test(formatPostcodeSafe(value));
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

  function setQuoteMessage(message, type = "is-warn", focusField = null) {
    const status = document.querySelector("#addressStatus");
    if (status) {
      status.textContent = message;
      status.className = `address-status ${type}`.trim();
    }
    if (focusField?.focus) focusField.focus();
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

  function validateQuoteEdit() {
    const fields = setupAddressFields();
    const address = quoteAddress();
    if (!els.quoteClient?.value) {
      setQuoteMessage("Choose a client before saving the quote.", "is-warn", els.quoteClient);
      return false;
    }
    if (!isUuid(els.quoteClient.value)) {
      setQuoteMessage("Choose a real Supabase client before saving the quote.", "is-warn", els.quoteClient);
      return false;
    }
    if (!selectedQuoteItems?.length) {
      setQuoteMessage("Add at least one item before saving the quote.", "is-warn");
      return false;
    }
    if (!address.setup_address_line1) {
      setQuoteMessage("Add the setup building number and street before saving the quote.", "is-warn", fields.line1);
      return false;
    }
    if (!address.setup_city) {
      setQuoteMessage("Add the setup town or city before saving the quote.", "is-warn", fields.city);
      return false;
    }
    if (!validPostcodeSafe(address.setup_postcode)) {
      setQuoteMessage("Add a valid UK setup postcode before saving, for example N16 6JA.", "is-warn", fields.postcode);
      return false;
    }
    return true;
  }

  function setSaveButtonText(text) {
    const button = els.quoteForm?.querySelector('button[type="submit"]');
    if (button) button.textContent = text;
  }

  function resetEditingState() {
    editingQuoteId = "";
    setSaveButtonText("Save quote request");
  }

  function openQuoteEditor(id) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote) return;
    editingQuoteId = id;
    if (typeof switchView === "function") switchView("quotes");

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
    setSaveButtonText("Update quote request");
    setQuoteMessage(`Editing ${quoteRef(quote)}. Save to update this quote.`, "is-ok");
    els.quoteForm?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveEditedQuote(event) {
    if (!editingQuoteId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (typeof sbIsConnected === "function" && !sbIsConnected()) {
      alert("Please log in first. Quotes can be changed only when the app is connected to Supabase.");
      return;
    }
    if (!validateQuoteEdit()) return;

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
    const itemRows = selectedQuoteItems.map((item) => ({
      quote_id: editingQuoteId,
      item_id: isUuid(item.id) ? item.id : null,
      item_name: item.name,
      quantity: Number(item.quantity || 1),
      unit_cost: Number(item.unitCost || 0),
      total: Number(item.quantity || 1) * Number(item.unitCost || 0)
    }));
    const savedItems = itemRows.length ? await sbRequest("quote_items", { method: "POST", body: itemRows }) : [];
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
    resetEditingState();
    if (typeof resetQuoteForm === "function") resetQuoteForm();
    if (typeof render === "function") render();
    setQuoteMessage("Quote updated and saved to Supabase.", "is-ok");
  }

  async function deleteQuote(id) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote) return;
    if (!confirm(`Delete ${quoteRef(quote)}? This will remove the quote and its quote items.`)) return;
    if (typeof sbIsConnected === "function" && sbIsConnected() && isUuid(id)) {
      await sbRequest(`quote_items?quote_id=eq.${id}`, { method: "DELETE" });
      await sbRequest(`quotes?id=eq.${id}`, { method: "DELETE" });
    }
    state.quotes = (state.quotes || []).filter((entry) => entry.id !== id);
    if (editingQuoteId === id) resetEditingState();
    if (typeof saveState === "function") saveState();
    if (typeof render === "function") render();
  }

  function quoteCard(quote) {
    const client = getClient(quote.clientId);
    const costs = quoteCosts(quote);
    const items = quoteItems(quote);
    return `<article class="quote-card"><div class="card-top"><div><h3>${escapeHtml(clientTitle(client))}</h3><p class="meta">Quote ${escapeHtml(quoteRef(quote))} | ${quote.workstations} workstations, ${quote.rooms} rooms<br>${escapeHtml(quote.premises)}</p></div><span class="badge ${classText(quote.status)}">${escapeHtml(quote.status)}</span></div><p class="meta">${items.slice(0, 4).map((item) => `${item.quantity}x ${escapeHtml(item.name)}`).join(", ")}</p><p class="meta">Required ${dateText(quote.requiredDate)} | Total ${moneyText(costs.total)}</p><div class="card-actions"><button class="secondary" data-edit-quote="${escapeHtml(quote.id)}" type="button">Edit</button><button class="ghost danger" data-delete-quote="${escapeHtml(quote.id)}" type="button">Delete</button><button class="secondary" data-send-quote="${escapeHtml(quote.id)}" type="button">Prepare email</button><button class="ghost" data-status="${escapeHtml(quote.id)}:Sent" type="button">Mark sent</button><button class="ghost" data-status="${escapeHtml(quote.id)}:Accepted" type="button">Accept</button><button class="ghost" data-status="${escapeHtml(quote.id)}:Declined" type="button">Decline</button></div></article>`;
  }

  document.addEventListener("submit", (event) => {
    if (event.target?.matches?.("#quoteForm") && editingQuoteId) {
      saveEditedQuote(event).catch((error) => alert(`Could not update quote: ${error.message || "Please try again."}`));
    }
  }, true);

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest?.("[data-edit-quote]");
    const deleteButton = event.target.closest?.("[data-delete-quote]");
    const clearButton = event.target.closest?.("#resetQuoteFormBtn");
    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      openQuoteEditor(editButton.dataset.editQuote);
    }
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      deleteQuote(deleteButton.dataset.deleteQuote).catch((error) => alert(`Could not delete quote: ${error.message || "Please try again."}`));
    }
    if (clearButton) resetEditingState();
  }, true);

  if (typeof renderQuoteCard === "function") renderQuoteCard = quoteCard;
  if (typeof renderQuotes === "function") renderQuotes();
  if (typeof renderDashboard === "function") renderDashboard();
})();
