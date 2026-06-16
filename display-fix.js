(() => {
  const safeText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const displayClientName = (client) => {
    const name = client?.company || client?.contact || client?.email || "";
    return String(name).trim() || "Client";
  };

  const readableClient = (id) => {
    const match = (state.clients || []).find((client) => client.id === id);
    return match || { id, company: "Client", contact: "", email: "", site: "", phone: "", notes: "" };
  };

  function installDisplayFix() {
    const quickQuoteBtn = document.querySelector("#quickQuoteBtn");
    if (quickQuoteBtn) quickQuoteBtn.textContent = "New quote";

    if (typeof getClient === "function") {
      getClient = readableClient;
    }

    if (typeof renderClientSelect === "function") {
      renderClientSelect = function fixedRenderClientSelect() {
        els.quoteClient.innerHTML = (state.clients || []).map((client) => {
          const label = displayClientName(client);
          return `<option value="${safeText(client.id)}">${safeText(label)}</option>`;
        }).join("");
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
        els.clientsTable.innerHTML = rows || `<tr><td colspan="6">${empty("No clients match your search.")}</td></tr>`;
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

    if (typeof renderNextAction === "function") {
      renderNextAction = function fixedRenderNextAction() {
        els.nextAction.textContent = "Create new quote";
      };
    }

    if (typeof renderInstallCard === "function") {
      renderInstallCard = function fixedRenderInstallCard(quote) {
        const client = readableClient(quote.clientId);
        return `<article class="install-card">
          <div class="card-top">
            <div><h3>${safeText(displayClientName(client))}</h3><p class="meta">Quote ${safeText(quote.id)} | ${quote.installDate ? formatDate(quote.installDate) : "Date needed"}</p></div>
            <span class="badge ${className(quote.installStatus)}">${safeText(quote.installStatus)}</span>
          </div>
          <p class="meta">${safeText(quote.premises)}</p>
          <div class="card-actions">
            <button class="secondary" data-install="${safeText(quote.id)}:Scheduled" type="button">Schedule</button>
            <button class="ghost" data-install="${safeText(quote.id)}:In progress" type="button">Start</button>
            <button class="ghost" data-install="${safeText(quote.id)}:Complete" type="button">Complete</button>
          </div>
        </article>`;
      };
    }

    if (typeof render === "function") render();
  }

  installDisplayFix();
})();
