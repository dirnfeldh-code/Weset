(() => {
  const safeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

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

  function showQuoteMessage(message) {
    const status = document.querySelector("#addressStatus");
    if (status) {
      status.textContent = message;
      status.className = "address-status is-warn";
    }
    alert(message);
  }

  function selectedClientIsReal() {
    const select = document.querySelector("#quoteClient");
    const clientId = select?.value || "";
    return isUuid(clientId);
  }

  function blockDemoClientQuote(event) {
    if (!event.target?.matches?.("#quoteForm")) return;
    if (selectedClientIsReal()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showQuoteMessage("This quote is using demo browser data instead of a real Supabase client. Go to Clients, create/select a real client, then create the quote again.");
  }

  document.addEventListener("submit", blockDemoClientQuote, true);

  function clearQuoteFormNow() {
    const form = document.querySelector("#quoteForm");
    if (form) form.reset();

    if (typeof selectedQuoteItems !== "undefined") {
      const defaults = ["desk", "task-chair", "onsite-setup"];
      selectedQuoteItems = defaults
        .map((id) => (state.catalog || []).find((item) => item.id === id || item.code === id.toUpperCase()))
        .filter(Boolean)
        .map((item) => ({ ...item, quantity: item.id === "onsite-setup" || item.code === "ONSITE-SETUP" ? 3 : 24 }));
    }

    const requiredDate = document.querySelector("#requiredDate");
    if (requiredDate && typeof todayPlus === "function") requiredDate.value = todayPlus(21);

    ["#addressLine1", "#addressLine2", "#addressCity", "#addressPostcode", "#premises", "#quoteNotes"].forEach((selector) => {
      const field = document.querySelector(selector);
      if (field) field.value = "";
    });

    const preview = document.querySelector("#addressPreview");
    if (preview) preview.textContent = "No setup address entered yet.";
    const status = document.querySelector("#addressStatus");
    if (status) {
      status.textContent = "Enter the setup postcode, then use Find from postcode.";
      status.className = "address-status";
    }

    if (typeof renderSelectedItems === "function") renderSelectedItems();
    if (typeof renderCatalogSelect === "function") renderCatalogSelect();
  }

  function runQuoteAddressButton(id) {
    if (id === "resetQuoteFormBtn") return clearQuoteFormNow();
    if (id === "lookupAddressBtn" && typeof lookupPostcodeAddress === "function" && typeof setupAddressFields === "function") return lookupPostcodeAddress(setupAddressFields(), "setup");
    if (id === "lookupClientAddressBtn" && typeof lookupPostcodeAddress === "function" && typeof clientAddressFields === "function") return lookupPostcodeAddress(clientAddressFields(), "company");
    if (id === "checkAddressBtn" && typeof checkAddressOnGoogleMaps === "function") return checkAddressOnGoogleMaps();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#resetQuoteFormBtn, #lookupAddressBtn, #lookupClientAddressBtn, #checkAddressBtn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const result = runQuoteAddressButton(button.id);
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
      return `<article class="quote-card">
        <div class="card-top">
          <div><h3>${safeText(clientName(client))}</h3><p class="meta">Quote ${safeText(quoteLabel(quote))} | ${quote.workstations} workstations, ${quote.rooms} rooms<br>${safeText(quote.premises)}</p></div>
          <span class="badge ${badgeClass(quote.status)}">${safeText(quote.status)}</span>
        </div>
        <p class="meta">${items.slice(0, 4).map((item) => `${item.quantity}x ${safeText(item.name)}`).join(", ")}</p>
        <p class="meta">Required ${dateText(quote.requiredDate)} | Total ${moneyText(costs.total)}</p>
        <div class="card-actions">
          <button class="secondary" data-send-quote="${safeText(quote.id)}" type="button">Prepare email</button>
          <button class="ghost" data-status="${safeText(quote.id)}:Sent" type="button">Mark sent</button>
          <button class="ghost" data-status="${safeText(quote.id)}:Accepted" type="button">Accept</button>
          <button class="ghost" data-status="${safeText(quote.id)}:Declined" type="button">Decline</button>
        </div>
      </article>`;
    };
  }

  if (typeof renderInstallCard === "function") {
    renderInstallCard = function friendlyRenderInstallCard(quote) {
      const client = getClient(quote.clientId);
      return `<article class="install-card"><div class="card-top"><div><h3>${safeText(clientName(client))}</h3><p class="meta">${safeText(quoteLabel(quote))} | ${quote.installDate ? dateText(quote.installDate) : "Date needed"}</p></div><span class="badge ${badgeClass(quote.installStatus)}">${safeText(quote.installStatus)}</span></div><p class="meta">${safeText(quote.premises)}</p><div class="card-actions"><button class="secondary" data-install="${safeText(quote.id)}:Scheduled" type="button">Schedule</button><button class="ghost" data-install="${safeText(quote.id)}:In progress" type="button">Start</button><button class="ghost" data-install="${safeText(quote.id)}:Complete" type="button">Complete</button></div></article>`;
    };
  }

  if (typeof renderSalesTable === "function") {
    renderSalesTable = function friendlyRenderSalesTable() {
      els.salesTable.innerHTML = state.quotes.map((quote) => {
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
