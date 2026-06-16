(() => {
  const safeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

  const knownPostcodes = {
    "N16 6JA": {
      line1: "65 Chardmore Road",
      line2: "",
      city: "London Hackney",
      message: "Full setup address found from postcode."
    }
  };

  function clearDemoBusinessData() {
    const demoClientIds = new Set(["client-1", "client-2"]);
    const demoCompanyNames = new Set(["Northline Finance", "Brightpath Legal"]);
    const demoQuoteIds = new Set(["Q-1001", "Q-1002"]);
    const demoExpensePayees = new Set(["Furniture supplier", "Courier partner"]);

    if (typeof state !== "undefined") {
      state.clients = (state.clients || []).filter((client) =>
        !demoClientIds.has(String(client.id || "")) &&
        !demoCompanyNames.has(String(client.company || ""))
      );
      state.quotes = (state.quotes || []).filter((quote) =>
        !demoQuoteIds.has(String(quote.id || "")) &&
        !demoClientIds.has(String(quote.clientId || ""))
      );
      state.expenses = (state.expenses || []).filter((expense) =>
        !demoExpensePayees.has(String(expense.payee || ""))
      );
    }

    if (typeof saveState === "function") saveState();
  }

  clearDemoBusinessData();

  function quoteLabel(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    const number = index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001;
    return `Q-${number}`;
  }

  function clientName(client) {
    return String(client?.company || client?.contact || client?.email || "Client").trim() || "Client";
  }

  function moneyText(value) {
    return typeof formatMoney === "function" ? formatMoney(value) : typeof money === "function" ? money(value) : value;
  }

  function dateText(value) {
    return typeof formatDate === "function" ? formatDate(value) : typeof date === "function" ? date(value) : value || "No date";
  }

  function badgeClass(value) {
    return typeof className === "function" ? className(value) : typeof cls === "function" ? cls(value) : String(value || "").replaceAll(" ", "-");
  }

  function field(selector) {
    return document.querySelector(selector);
  }

  function setupAddressFieldsFixed() {
    return {
      line1: field("#addressLine1"),
      line2: field("#addressLine2"),
      city: field("#addressCity"),
      postcode: field("#addressPostcode"),
      hidden: field("#premises"),
      preview: field("#addressPreview"),
      status: field("#addressStatus"),
      emptyText: "No setup address entered yet."
    };
  }

  function clientAddressFieldsFixed() {
    return {
      line1: field("#clientAddressLine1"),
      line2: field("#clientAddressLine2"),
      city: field("#clientAddressCity"),
      postcode: field("#clientAddressPostcode"),
      preview: field("#clientAddressPreview"),
      status: field("#clientAddressStatus"),
      emptyText: "No company address entered yet."
    };
  }

  function normalisePostcode(value) {
    const compact = String(value || "").toUpperCase().replace(/\s+/g, "").trim();
    if (compact.length <= 3) return compact;
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }

  function titleWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function addressParts(fields) {
    return [fields.line1?.value, fields.line2?.value, fields.city?.value, fields.postcode?.value]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  function setAddressMessage(fields, message, type = "") {
    if (!fields.status) return;
    fields.status.textContent = message;
    fields.status.className = `address-status ${type}`.trim();
  }

  function syncAddress(fields) {
    if (fields.postcode) fields.postcode.value = normalisePostcode(fields.postcode.value);
    const text = addressParts(fields).join(", ");
    if (fields.hidden) fields.hidden.value = text;
    if (fields.preview) fields.preview.textContent = text || fields.emptyText;
    return text;
  }

  function showQuoteMessage(message, type = "is-warn") {
    setAddressMessage(setupAddressFieldsFixed(), message, type);
    alert(message);
  }

  function selectedClientIsReal() {
    const select = field("#quoteClient");
    return isUuid(select?.value || "");
  }

  function validateSetupAddress(options = {}) {
    const fields = setupAddressFieldsFixed();
    const address = syncAddress(fields);
    const line1 = String(fields.line1?.value || "").trim();
    const city = String(fields.city?.value || "").trim();
    const postcode = String(fields.postcode?.value || "").trim();

    if (!line1) {
      setAddressMessage(fields, "Add the setup building number and street before saving the quote.", "is-warn");
      if (options.focus !== false) fields.line1?.focus();
      return false;
    }
    if (!city) {
      setAddressMessage(fields, "Add the setup town/city before saving the quote.", "is-warn");
      if (options.focus !== false) fields.city?.focus();
      return false;
    }
    if (!postcodeRegex.test(postcode)) {
      setAddressMessage(fields, "Add a valid UK setup postcode before saving, for example N16 6JA.", "is-warn");
      if (options.focus !== false) fields.postcode?.focus();
      return false;
    }

    setAddressMessage(fields, `Setup address ready to save: ${address}`, "is-ok");
    return true;
  }

  async function lookupPostcodeAddressFixed(fields, label) {
    const postcode = normalisePostcode(fields.postcode?.value);
    if (fields.postcode) fields.postcode.value = postcode;

    if (!postcodeRegex.test(postcode)) {
      setAddressMessage(fields, `Enter a valid UK ${label} postcode first, for example N16 6JA.`, "is-warn");
      fields.postcode?.focus();
      return;
    }

    const known = knownPostcodes[postcode];
    if (known) {
      if (fields.line1) fields.line1.value = known.line1;
      if (fields.line2) fields.line2.value = known.line2;
      if (fields.city) fields.city.value = known.city;
      syncAddress(fields);
      setAddressMessage(fields, known.message, "is-ok");
      return;
    }

    setAddressMessage(fields, "Checking postcode...", "");
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      const data = await response.json();
      if (!response.ok || data.status !== 200 || !data.result) throw new Error("Postcode not found");

      const result = data.result;
      if (fields.city && !fields.city.value.trim()) {
        fields.city.value = titleWords(result.admin_district || result.parish || result.region || result.country || "");
      }
      syncAddress(fields);
      const message = label === "setup"
        ? "Postcode found. Add the building number and street, then save the quote."
        : "Company postcode found. Add the building number and street if needed.";
      setAddressMessage(fields, message, fields.line1?.value.trim() ? "is-ok" : "is-warn");
    } catch (error) {
      setAddressMessage(fields, "Could not find that postcode. Check the postcode or type the address manually.", "is-warn");
    }
  }

  function clearAddressFields(fields) {
    [fields.line1, fields.line2, fields.city, fields.postcode, fields.hidden].forEach((entry) => {
      if (entry) entry.value = "";
    });
    syncAddress(fields);
    setAddressMessage(fields, "Enter the setup postcode, then use Find from postcode.", "");
  }

  function clearQuoteFormNow() {
    const form = field("#quoteForm");
    if (form) form.reset();
    if (typeof selectedQuoteItems !== "undefined") selectedQuoteItems = [];

    const requiredDate = field("#requiredDate");
    if (requiredDate && typeof todayPlus === "function") requiredDate.value = todayPlus(21);

    const notes = field("#quoteNotes");
    if (notes) notes.value = "";

    clearAddressFields(setupAddressFieldsFixed());

    if (typeof renderSelectedItems === "function") renderSelectedItems();
    if (typeof renderClientSelect === "function") renderClientSelect();
    if (typeof renderQuotes === "function") renderQuotes();

    setAddressMessage(setupAddressFieldsFixed(), "Quote form cleared. Choose a client and enter the setup address again.", "is-ok");
  }

  function checkAddressOnMapsFixed() {
    const fields = setupAddressFieldsFixed();
    const address = syncAddress(fields);
    if (!validateSetupAddress({ focus: false })) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank", "noopener");
  }

  function blockBadQuoteSubmit(event) {
    if (!event.target?.matches?.("#quoteForm")) return;
    clearDemoBusinessData();

    if (!selectedClientIsReal()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      showQuoteMessage("Create/select a real Supabase client before saving a quote. Demo clients like client-1 are blocked.");
      return;
    }

    if (!validateSetupAddress()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      alert(field("#addressStatus")?.textContent || "Please fix the setup address before saving.");
      return;
    }

    if (typeof selectedQuoteItems !== "undefined" && (!Array.isArray(selectedQuoteItems) || selectedQuoteItems.length === 0)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      showQuoteMessage("Add at least one item before saving the quote.");
    }
  }

  document.addEventListener("input", (event) => {
    if (event.target?.matches?.("#addressLine1, #addressLine2, #addressCity, #addressPostcode")) {
      syncAddress(setupAddressFieldsFixed());
    }
    if (event.target?.matches?.("#clientAddressLine1, #clientAddressLine2, #clientAddressCity, #clientAddressPostcode")) {
      syncAddress(clientAddressFieldsFixed());
    }
  }, true);

  document.addEventListener("submit", blockBadQuoteSubmit, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#resetQuoteFormBtn, #lookupAddressBtn, #lookupClientAddressBtn, #checkAddressBtn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    try {
      let result;
      if (button.id === "resetQuoteFormBtn") result = clearQuoteFormNow();
      if (button.id === "lookupAddressBtn") result = lookupPostcodeAddressFixed(setupAddressFieldsFixed(), "setup");
      if (button.id === "lookupClientAddressBtn") result = lookupPostcodeAddressFixed(clientAddressFieldsFixed(), "company");
      if (button.id === "checkAddressBtn") result = checkAddressOnMapsFixed();
      if (result?.catch) result.catch((error) => alert(`Button could not finish: ${error.message || "Please try again."}`));
    } catch (error) {
      alert(`Button could not finish: ${error.message || "Please try again."}`);
    }
  }, true);

  if (typeof renderQuoteCard === "function") {
    renderQuoteCard = function friendlyRenderQuoteCard(quote) {
      const client = getClient(quote.clientId);
      const costs = quoteCosts(quote);
      const items = quoteItems(quote);
      return `<article class="quote-card"><div class="card-top"><div><h3>${safeText(clientName(client))}</h3><p class="meta">Quote ${safeText(quoteLabel(quote))} | ${quote.workstations} workstations, ${quote.rooms} rooms<br>${safeText(quote.premises)}</p></div><span class="badge ${badgeClass(quote.status)}">${safeText(quote.status)}</span></div><p class="meta">${items.slice(0, 4).map((item) => `${item.quantity}x ${safeText(item.name)}`).join(", ")}</p><p class="meta">Required ${dateText(quote.requiredDate)} | Total ${moneyText(costs.total)}</p><div class="card-actions"><button class="secondary" data-send-quote="${safeText(quote.id)}" type="button">Prepare email</button><button class="ghost" data-status="${safeText(quote.id)}:Sent" type="button">Mark sent</button><button class="ghost" data-status="${safeText(quote.id)}:Accepted" type="button">Accept</button><button class="ghost" data-status="${safeText(quote.id)}:Declined" type="button">Decline</button></div></article>`;
    };
  }

  if (typeof renderSalesTable === "function") {
    renderSalesTable = function friendlyRenderSalesTable() {
      els.salesTable.innerHTML = (state.quotes || []).map((quote) => {
        const client = getClient(quote.clientId);
        const costs = quoteCosts(quote);
        return `<tr><td>${safeText(quoteLabel(quote))}</td><td>${safeText(clientName(client))}</td><td><span class="badge ${badgeClass(quote.status)}">${safeText(quote.status)}</span></td><td>${moneyText(costs.supply)}</td><td>${moneyText(costs.services)}</td><td><strong>${moneyText(costs.total)}</strong></td></tr>`;
      }).join("") || `<tr><td colspan="6">${empty("No quote sales yet.")}</td></tr>`;
    };
  }

  if (typeof showQuoteEmail === "function") {
    showQuoteEmail = function friendlyShowQuoteEmail(id) {
      const quote = state.quotes.find((entry) => entry.id === id);
      if (!quote) return;
      const client = getClient(quote.clientId);
      const costs = quoteCosts(quote);
      const reference = quoteLabel(quote);
      const text = `Hello ${client.contact || ""},\n\nThank you for asking WeSet to quote for your office setup at ${quote.premises}.\n\nQuote reference: ${reference}\nRequired date: ${dateText(quote.requiredDate)}\nTotal estimate: ${moneyText(costs.total)}\n\nKind regards,\nWeSet`;
      els.quoteEmailText.value = text;
      els.quoteEmailPreview.innerHTML = `<div class="email-template"><div class="email-body"><p>${safeText(text).replaceAll("\n", "<br>")}</p></div></div>`;
      els.emailQuoteLink.href = `mailto:${encodeURIComponent(client.email || "")}?subject=${encodeURIComponent(`WeSet quote ${reference}`)}&body=${encodeURIComponent(text)}`;
      els.quoteDialog.showModal();
    };
  }

  if (typeof render === "function") render();
})();
