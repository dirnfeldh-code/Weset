(() => {
  const invoiceStoreKey = "weset.invoices";
  const paymentStoreKey = "weset.client.payments";
  const setupClientFlag = "weset.addClientFromQuote";

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function moneyText(value) {
    const amount = Number(value || 0);
    if (typeof formatMoney === "function") return formatMoney(amount);
    if (typeof money === "function") return money(amount);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(amount);
  }

  function dateText(value) {
    if (!value) return "No date";
    if (typeof date === "function") return date(String(value).slice(0, 10));
    return String(value).slice(0, 10);
  }

  function quoteTotal(quote) {
    if (typeof quoteCosts === "function") return Number(quoteCosts(quote).total || 0);
    return (quote.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || item.unit_cost || 0), 0);
  }

  function getClientSafe(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id));
  }

  function ensureStyles() {
    if (document.querySelector("#clientQuoteWorkflowStyles")) return;
    const style = document.createElement("style");
    style.id = "clientQuoteWorkflowStyles";
    style.textContent = `
      .dashboard-quick-actions { align-items: center; background: #ffffff; border: 1px solid var(--line,#d9e0e1); border-radius: 8px; box-shadow: var(--shadow,0 18px 50px rgba(23,37,42,.08)); display: flex; gap: 12px; justify-content: space-between; margin: 0 0 18px; padding: 14px 16px; }
      .dashboard-quick-actions strong { display: block; font-size: 16px; }
      .dashboard-quick-actions .meta { margin-top: 3px; }
      .client-select-actions { align-items: end; display: grid; gap: 8px; grid-template-columns: minmax(0,1fr) auto; }
      .quote-field-note { color: var(--muted,#687478); font-size: 12px; font-weight: 600; margin: -2px 0 0; }
      .client-history-dialog { border: 0; border-radius: 10px; box-shadow: 0 24px 80px rgba(0,0,0,.22); max-height: calc(100vh - 18px); max-width: min(1180px, calc(100vw - 18px)); padding: 0; width: min(1180px, calc(100vw - 18px)); }
      .client-history-dialog::backdrop { background: rgba(10,31,34,.38); }
      .client-history-card { background: #fff; display: grid; gap: 14px; max-height: calc(100vh - 18px); overflow: auto; padding: 18px; }
      .client-history-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0,1fr)); }
      .client-history-stat { background: #f8fafb; border: 1px solid var(--line,#d9e0e1); border-radius: 8px; padding: 12px; }
      .client-history-stat span { color: var(--muted,#687478); display: block; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .client-history-stat strong { display: block; font-size: 20px; margin-top: 6px; }
      .client-history-section { border: 1px solid var(--line,#d9e0e1); border-radius: 8px; overflow: hidden; }
      .client-history-section h3 { background: #f8fafb; border-bottom: 1px solid var(--line,#d9e0e1); margin: 0; padding: 10px 12px; }
      .client-history-table { border-collapse: collapse; width: 100%; }
      .client-history-table th, .client-history-table td { border-bottom: 1px solid var(--line,#d9e0e1); padding: 10px; text-align: left; vertical-align: top; }
      .client-history-table th { color: var(--muted,#687478); font-size: 12px; text-transform: uppercase; }
      .client-row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .client-row-actions button { min-height: 32px; padding: 6px 10px; }
      @media (max-width: 760px) { .dashboard-quick-actions, .client-select-actions { align-items: stretch; grid-template-columns: 1fr; flex-direction: column; } .client-history-grid { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 520px) { .client-history-grid { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function openQuotesForClient(clientId = "") {
    if (typeof switchView === "function") switchView("quotes");
    setTimeout(() => {
      const select = document.querySelector("#quoteClient");
      if (select && clientId) {
        select.value = clientId;
        if (typeof getClient === "function" && typeof fillAddressFromText === "function") fillAddressFromText(getClient(clientId).site || "");
      }
      document.querySelector("#quoteForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function addDashboardQuoteButton() {
    const dashboard = document.querySelector("#dashboardView");
    const metrics = document.querySelector("#metrics");
    if (!dashboard || !metrics || document.querySelector("#dashboardCreateQuoteAction")) return;
    const action = document.createElement("div");
    action.id = "dashboardCreateQuoteAction";
    action.className = "dashboard-quick-actions";
    action.innerHTML = `<div><strong>Create a new quote</strong><p class="meta">Start a quote from the dashboard, choose the client, add items, then save it to the quote pipeline.</p></div><button class="primary" id="dashboardNewQuoteBtn" type="button">Create quote</button>`;
    metrics.insertAdjacentElement("afterend", action);
    action.querySelector("#dashboardNewQuoteBtn")?.addEventListener("click", () => openQuotesForClient());
  }

  function improveQuoteClientSelector() {
    const select = document.querySelector("#quoteClient");
    if (!select || select.closest(".client-select-actions")) return;
    const label = select.closest("label");
    if (!label) return;
    const wrapper = document.createElement("div");
    wrapper.className = "client-select-actions";
    label.parentNode.insertBefore(wrapper, label);
    wrapper.appendChild(label);
    const button = document.createElement("button");
    button.className = "secondary";
    button.id = "quoteAddClientBtn";
    button.type = "button";
    button.textContent = "Add client";
    wrapper.appendChild(button);
    button.addEventListener("click", () => {
      sessionStorage.setItem(setupClientFlag, "1");
      if (typeof openClientDialog === "function") openClientDialog();
      else document.querySelector("#newClientBtn")?.click();
    });
  }

  function renameAreaCount() {
    const input = document.querySelector("#roomCount");
    const label = input?.closest("label");
    if (!input || !label || label.dataset.areaLabelFixed === "1") return;
    const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = "Areas or rooms to set up";
    else label.insertBefore(document.createTextNode("Areas or rooms to set up"), input);
    const note = document.createElement("p");
    note.className = "quote-field-note";
    note.textContent = "This records how many separate rooms, areas, or zones the setup covers.";
    input.insertAdjacentElement("afterend", note);
    label.dataset.areaLabelFixed = "1";
  }

  function selectNewestClientAfterSave() {
    const form = document.querySelector("#clientForm");
    if (!form || form.dataset.quoteClientHooked === "1") return;
    form.dataset.quoteClientHooked = "1";
    form.addEventListener("submit", () => {
      if (sessionStorage.getItem(setupClientFlag) !== "1") return;
      setTimeout(() => {
        sessionStorage.removeItem(setupClientFlag);
        if (typeof switchView === "function") switchView("quotes");
        const select = document.querySelector("#quoteClient");
        const newest = (state.clients || [])[state.clients.length - 1];
        if (select && newest?.id) {
          if (![...select.options].some((option) => option.value === newest.id) && typeof renderClientSelect === "function") renderClientSelect();
          select.value = newest.id;
          if (typeof fillAddressFromText === "function") fillAddressFromText(newest.site || "");
        }
      }, 650);
    }, true);
  }

  function clientInvoices(clientId) {
    const quotes = (state.quotes || []).filter((quote) => String(quote.clientId) === String(clientId));
    const quoteIds = new Set(quotes.map((quote) => String(quote.id)));
    return readJson(invoiceStoreKey, []).filter((invoice) => String(invoice.clientId || invoice.client_id) === String(clientId) || quoteIds.has(String(invoice.quoteId || invoice.quote_id)));
  }

  function clientPayments(clientId) {
    const invoiceNumbers = new Set(clientInvoices(clientId).map((invoice) => invoice.invoiceNumber || invoice.invoice_number || invoice.id));
    return readJson(paymentStoreKey, []).filter((payment) => String(payment.clientId || payment.client_id) === String(clientId) || invoiceNumbers.has(payment.invoiceNumber || payment.invoice_number));
  }

  function statusBadge(status) {
    const cls = String(status || "").replaceAll(" ", "-");
    return `<span class="badge ${esc(cls)}">${esc(status || "Unknown")}</span>`;
  }

  function openClientHistory(clientId) {
    const client = getClientSafe(clientId);
    if (!client) return alert("Client was not found.");
    const quotes = (state.quotes || []).filter((quote) => String(quote.clientId) === String(clientId));
    const invoices = clientInvoices(clientId);
    const payments = clientPayments(clientId);
    const accepted = quotes.filter((quote) => quote.status === "Accepted").length;
    const pending = quotes.filter((quote) => ["Draft", "Sent"].includes(quote.status)).length;
    const scheduled = quotes.filter((quote) => ["Scheduled", "In progress"].includes(quote.installStatus)).length;
    const sentInvoices = invoices.filter((invoice) => ["Sent", "Paid", "Part paid"].includes(invoice.status)).length;
    let dialog = document.querySelector("#clientHistoryDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "clientHistoryDialog";
      dialog.className = "client-history-dialog";
      dialog.innerHTML = `<div class="client-history-card"><div class="panel-head"><div><h2 id="clientHistoryTitle">Client history</h2><p class="meta" id="clientHistoryMeta"></p></div><button class="icon-btn" id="closeClientHistoryBtn" type="button" aria-label="Close">x</button></div><div id="clientHistoryBody"></div></div>`;
      document.body.appendChild(dialog);
      dialog.querySelector("#closeClientHistoryBtn")?.addEventListener("click", () => dialog.close());
    }
    dialog.querySelector("#clientHistoryTitle").textContent = client.company || "Client history";
    dialog.querySelector("#clientHistoryMeta").textContent = [client.contact, client.email, client.phone, client.site].filter(Boolean).join(" | ");
    dialog.querySelector("#clientHistoryBody").innerHTML = `
      <div class="client-history-grid">
        <div class="client-history-stat"><span>Pending quotes</span><strong>${pending}</strong></div>
        <div class="client-history-stat"><span>Accepted quotes</span><strong>${accepted}</strong></div>
        <div class="client-history-stat"><span>Scheduled setups</span><strong>${scheduled}</strong></div>
        <div class="client-history-stat"><span>Payments received</span><strong>${moneyText(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))}</strong></div>
      </div>
      <section class="client-history-section"><h3>Quotes and setup work</h3><div class="table-wrap"><table class="client-history-table"><thead><tr><th>Quote</th><th>Status</th><th>Setup</th><th>Required</th><th>Total</th></tr></thead><tbody>${quotes.map((quote) => `<tr><td>${esc(quote.id)}</td><td>${statusBadge(quote.status)}</td><td>${statusBadge(quote.installStatus || "Not scheduled")}<p class="meta">${esc(quote.premises || "No setup address")}</p></td><td>${dateText(quote.requiredDate)}</td><td><strong>${moneyText(quoteTotal(quote))}</strong></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty">No quotes for this client yet.</div></td></tr>`}</tbody></table></div></section>
      <section class="client-history-section"><h3>Invoices</h3><div class="table-wrap"><table class="client-history-table"><thead><tr><th>Invoice</th><th>Status</th><th>Quote</th><th>Created</th><th>Total</th></tr></thead><tbody>${invoices.map((invoice) => `<tr><td>${esc(invoice.invoiceNumber || invoice.invoice_number || invoice.id)}</td><td>${statusBadge(invoice.status)}</td><td>${esc(invoice.quoteId || invoice.quote_id || "")}</td><td>${dateText(invoice.createdAt || invoice.created_at)}</td><td><strong>${moneyText(invoice.total)}</strong></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty">No invoices created for this client yet.</div></td></tr>`}</tbody></table></div></section>
      <section class="client-history-section"><h3>Payments</h3><div class="table-wrap"><table class="client-history-table"><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>${payments.map((payment) => `<tr><td>${dateText(payment.date)}</td><td>${esc(payment.invoiceNumber || payment.invoice_number || "")}</td><td>${esc(payment.method || "")}</td><td>${esc(payment.reference || payment.notes || "")}</td><td><strong>${moneyText(payment.amount)}</strong></td></tr>`).join("") || `<tr><td colspan="5"><div class="empty">No payments recorded for this client yet.</div></td></tr>`}</tbody></table></div></section>
      <div class="dialog-actions"><button class="primary" data-history-new-quote="${esc(clientId)}" type="button">Create quote for this client</button></div>
    `;
    dialog.querySelector("[data-history-new-quote]")?.addEventListener("click", () => { dialog.close(); openQuotesForClient(clientId); });
    dialog.showModal();
  }

  function addClientHistoryButtons() {
    document.querySelectorAll("[data-new-quote]").forEach((quoteButton) => {
      const clientId = quoteButton.dataset.newQuote;
      const cell = quoteButton.closest("td") || quoteButton.parentElement;
      if (!cell || cell.querySelector(`[data-client-history="${CSS.escape(clientId)}"]`)) return;
      cell.classList.add("client-row-actions");
      const history = document.createElement("button");
      history.className = "ghost";
      history.type = "button";
      history.dataset.clientHistory = clientId;
      history.textContent = "History";
      cell.appendChild(history);
    });
  }

  document.addEventListener("click", (event) => {
    const historyButton = event.target.closest?.("[data-client-history]");
    if (historyButton) {
      event.preventDefault();
      event.stopPropagation();
      openClientHistory(historyButton.dataset.clientHistory);
    }
  }, true);

  const oldRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (oldRenderDashboard) renderDashboard = function renderDashboardWithQuoteAction() { oldRenderDashboard(); addDashboardQuoteButton(); };

  const oldRenderClients = typeof renderClients === "function" ? renderClients : null;
  if (oldRenderClients) renderClients = function renderClientsWithHistory() { oldRenderClients(); addClientHistoryButtons(); };

  ensureStyles();
  setInterval(() => {
    addDashboardQuoteButton();
    improveQuoteClientSelector();
    renameAreaCount();
    selectNewestClientAfterSave();
    addClientHistoryButtons();
  }, 1000);
  setTimeout(() => {
    addDashboardQuoteButton();
    improveQuoteClientSelector();
    renameAreaCount();
    selectNewestClientAfterSave();
    addClientHistoryButtons();
  }, 250);

  window.wesetOpenClientHistory = openClientHistory;
})();
