(() => {
  const safeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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
