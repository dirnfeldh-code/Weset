(() => {
  const statuses = ["Draft", "Sent", "Accepted", "Declined"];
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const style = document.createElement("style");
  style.textContent = `
    .quote-status-board {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(4, minmax(230px, 1fr));
    }
    .quote-status-column {
      background: #f8fafb;
      border: 1px solid var(--line, #d9e0e1);
      border-radius: 8px;
      min-height: 170px;
      padding: 10px;
    }
    .quote-status-column.is-Sent {
      border-color: rgba(20, 92, 88, 0.32);
    }
    .quote-status-column.is-Accepted {
      border-color: rgba(57, 181, 74, 0.42);
    }
    .quote-status-head {
      align-items: center;
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .quote-status-head h3 {
      margin: 0;
    }
    .quote-status-count {
      background: #e8f3f1;
      border-radius: 999px;
      color: #145c58;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 8px;
    }
    .quote-status-column .quote-card {
      margin-bottom: 10px;
    }
    .quote-status-column .quote-card:last-child {
      margin-bottom: 0;
    }
    .quote-status-column .empty {
      box-shadow: none;
      padding: 12px;
    }
    .status-move-button.is-current {
      background: #145c58 !important;
      color: #fff !important;
    }
    @media (max-width: 1100px) {
      .quote-status-board {
        grid-template-columns: repeat(2, minmax(230px, 1fr));
      }
    }
    @media (max-width: 620px) {
      .quote-status-board {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);

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

  function card(quote) {
    const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { total: 0 };
    const items = typeof quoteItems === "function" ? quoteItems(quote) : (quote.items || []);
    const actionButtons = statuses
      .filter((status) => status !== "Draft")
      .map((status) => `<button class="ghost status-move-button ${quote.status === status ? "is-current" : ""}" data-status="${escapeHtml(quote.id)}:${status}" type="button">${quote.status === status ? status : `Mark ${status.toLowerCase()}`}</button>`)
      .join("");
    return `<article class="quote-card" data-quote-card="${escapeHtml(quote.id)}">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(clientTitle(client))}</h3>
          <p class="meta">Quote ${escapeHtml(quoteRef(quote))} | ${quote.workstations} workstations, ${quote.rooms} rooms<br>${escapeHtml(quote.premises)}</p>
        </div>
        <span class="badge ${classText(quote.status)}">${escapeHtml(quote.status)}</span>
      </div>
      <p class="meta">${items.slice(0, 4).map((item) => `${item.quantity}x ${escapeHtml(item.name)}`).join(", ")}</p>
      <p class="meta">Required ${dateText(quote.requiredDate)} | Total ${moneyText(costs.total)}</p>
      <div class="card-actions">
        <button class="primary send-in-app-button" data-send-in-app="${escapeHtml(quote.id)}" type="button">Send from app</button>
        <button class="secondary" data-edit-quote="${escapeHtml(quote.id)}" type="button">Edit</button>
        <button class="ghost danger" data-delete-quote="${escapeHtml(quote.id)}" type="button">Delete</button>
        <button class="secondary" data-send-quote="${escapeHtml(quote.id)}" type="button">Prepare email</button>
        ${actionButtons}
      </div>
    </article>`;
  }

  function renderColumns() {
    const filter = els.quoteStatusFilter?.value || "all";
    const query = els.searchInput?.value?.trim().toLowerCase() || "";
    const visibleStatuses = filter === "all" ? statuses : statuses.filter((status) => status === filter);
    const quotes = (state.quotes || []).filter((quote) => {
      if (filter !== "all" && quote.status !== filter) return false;
      if (!query) return true;
      const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
      return `${Object.values(quote).join(" ")} ${Object.values(client).join(" ")}`.toLowerCase().includes(query);
    });
    els.quoteList.innerHTML = `<div class="quote-status-board">
      ${visibleStatuses.map((status) => {
        const columnQuotes = quotes.filter((quote) => (quote.status || "Draft") === status);
        return `<section class="quote-status-column is-${escapeHtml(status)}">
          <div class="quote-status-head"><h3>${escapeHtml(status)}</h3><span class="quote-status-count">${columnQuotes.length}</span></div>
          ${columnQuotes.map(card).join("") || `<div class="empty">No ${escapeHtml(status.toLowerCase())} quotes.</div>`}
        </section>`;
      }).join("")}
    </div>`;
  }

  async function moveStatus(id, status) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote || quote.status === status) return;
    quote.status = status;
    if (typeof renderQuotes === "function" && renderQuotes !== renderColumns) renderQuotes();
    else renderColumns();
    try {
      if (typeof updateQuote === "function") await updateQuote(id, { status });
    } catch (error) {
      alert(`Could not update quote status: ${error.message || "Please try again."}`);
    } finally {
      if (typeof renderQuotes === "function" && renderQuotes !== renderColumns) renderQuotes();
      else renderColumns();
      if (typeof renderDashboard === "function") renderDashboard();
      if (typeof saveState === "function") saveState();
    }
  }

  document.addEventListener("click", (event) => {
    const statusButton = event.target.closest?.("[data-status]");
    if (!statusButton) return;
    const [id, status] = String(statusButton.dataset.status || "").split(":");
    if (!id || !status) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    moveStatus(id, status);
  }, true);

  if (typeof renderQuoteCard === "function") renderQuoteCard = card;
  if (typeof renderQuotes === "function") renderQuotes = renderColumns;
  renderColumns();
})();

