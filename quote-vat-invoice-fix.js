(() => {
  const vatStoreKey = "weset.quote.vat.settings";
  const defaultVatRate = 20;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const style = document.createElement("style");
  style.textContent = `
    .vat-panel {
      background: #f8fafb;
      border: 1px solid var(--line, #d9e0e1);
      border-radius: 8px;
      display: grid;
      gap: 10px;
      grid-column: 1 / -1;
      padding: 12px;
    }
    .vat-panel .check-row {
      justify-content: flex-start;
    }
    .vat-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: 160px minmax(0, 1fr);
    }
    .vat-summary {
      background: #fff;
      border: 1px solid var(--line, #d9e0e1);
      border-radius: 8px;
      display: grid;
      gap: 6px;
      padding: 10px;
    }
    .vat-line {
      align-items: center;
      display: flex;
      justify-content: space-between;
    }
    .vat-line.total {
      border-top: 1px solid var(--line, #d9e0e1);
      font-size: 18px;
      font-weight: 800;
      margin-top: 4px;
      padding-top: 8px;
    }
    .quote-card .quote-money-lines {
      background: #f8fafb;
      border: 1px solid var(--line, #d9e0e1);
      border-radius: 8px;
      display: grid;
      gap: 4px;
      margin: 10px 0;
      padding: 8px;
    }
    .quote-card .quote-money-lines div {
      display: flex;
      justify-content: space-between;
    }
    .quote-status-actions,
    .quote-record-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .quote-status-actions {
      border-top: 1px solid var(--line, #d9e0e1);
      padding-top: 10px;
    }
    .quote-record-actions {
      background: #f8fafb;
      border-radius: 8px;
      padding: 8px;
    }
    .status-move-button.is-current,
    .badge.is-current-status {
      background: #145c58 !important;
      color: #fff !important;
    }
    .invoice-preview {
      background: #fff;
      color: #1d2528;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
      padding: 24px;
    }
    .invoice-preview .invoice-head {
      align-items: center;
      background: #145c58;
      color: #fff;
      display: flex;
      justify-content: space-between;
      margin: -24px -24px 24px;
      padding: 20px 24px;
    }
    .invoice-preview .invoice-head img {
      background: #fff;
      border-radius: 6px;
      max-width: 210px;
      padding: 4px;
      width: 42%;
    }
    .invoice-preview table {
      border-collapse: collapse;
      margin-top: 18px;
      width: 100%;
    }
    .invoice-preview th,
    .invoice-preview td {
      border-bottom: 1px solid #d9e0e1;
      padding: 8px;
      text-align: left;
    }
    .invoice-preview th {
      background: #e8f3f1;
    }
    .invoice-preview .invoice-totals {
      display: grid;
      gap: 6px;
      justify-content: end;
      margin-top: 16px;
    }
    .invoice-preview .invoice-totals div {
      display: grid;
      gap: 18px;
      grid-template-columns: 150px 130px;
    }
    @media (max-width: 620px) {
      .vat-grid,
      .invoice-preview .invoice-totals div {
        grid-template-columns: 1fr;
      }
      .quote-status-actions,
      .quote-record-actions {
        flex-direction: column;
      }
      .quote-status-actions > *,
      .quote-record-actions > * {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value || 0);
  }

  function dateText(value) {
    if (typeof formatDate === "function") return formatDate(value);
    if (typeof date === "function") return date(value);
    return value || "No date";
  }

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function classText(value) {
    if (typeof className === "function") return className(value);
    if (typeof cls === "function") return cls(value);
    return String(value || "").replaceAll(" ", "-");
  }

  function clientTitle(client) {
    return String(client?.company || client?.contact || client?.email || "Client").trim() || "Client";
  }

  function vatSettings() {
    try {
      return JSON.parse(localStorage.getItem(vatStoreKey) || "{}");
    } catch {
      return {};
    }
  }

  function saveVatSettings(settings) {
    localStorage.setItem(vatStoreKey, JSON.stringify(settings));
  }

  function currentFormVat() {
    return {
      enabled: Boolean(document.querySelector("#quoteVatEnabled")?.checked),
      rate: Math.max(0, Number(document.querySelector("#quoteVatRate")?.value || defaultVatRate))
    };
  }

  function setFormVat(settings) {
    const enabled = document.querySelector("#quoteVatEnabled");
    const rate = document.querySelector("#quoteVatRate");
    if (enabled) enabled.checked = settings?.enabled !== false;
    if (rate) rate.value = Number(settings?.rate ?? defaultVatRate);
  }

  function quoteVat(quote) {
    const settings = vatSettings()[quote?.id] || {};
    const enabled = settings.enabled !== undefined ? settings.enabled : true;
    const rate = Number(settings.rate ?? defaultVatRate);
    return { enabled, rate };
  }

  function calcTotals(quote, overrideVat = null) {
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { supply: 0, services: 0, total: 0 };
    const vat = overrideVat || quoteVat(quote);
    const subtotal = Number(costs.total || 0);
    const vatAmount = vat.enabled ? subtotal * Number(vat.rate || 0) / 100 : 0;
    return { supply: costs.supply || 0, services: costs.services || 0, subtotal, vatRate: Number(vat.rate || 0), vatEnabled: vat.enabled, vatAmount, total: subtotal + vatAmount };
  }

  function ensureVatControls() {
    if (document.querySelector("#quoteVatPanel") || !els.quoteForm) return;
    const notes = document.querySelector("#quoteNotes")?.closest("label");
    const panel = document.createElement("section");
    panel.className = "vat-panel";
    panel.id = "quoteVatPanel";
    panel.innerHTML = `<div class="panel-head compact"><div><h3>VAT</h3><p class="meta">Choose if this quote should include VAT.</p></div></div>
      <div class="vat-grid">
        <label class="check-row"><input id="quoteVatEnabled" type="checkbox" checked> Add VAT</label>
        <label>VAT rate %<input id="quoteVatRate" min="0" step="0.1" type="number" value="20"></label>
      </div>
      <div class="vat-summary" id="quoteVatSummary"></div>`;
    if (notes) notes.insertAdjacentElement("beforebegin", panel);
    else els.quoteForm.appendChild(panel);
    panel.addEventListener("input", updateVatSummary, true);
    panel.addEventListener("change", updateVatSummary, true);
  }

  function updateVatSummary() {
    const quote = { items: selectedQuoteItems || [] };
    const totals = calcTotals(quote, currentFormVat());
    const summary = document.querySelector("#quoteVatSummary");
    if (summary) {
      summary.innerHTML = `<div class="vat-line"><span>Subtotal</span><strong>${moneyText(totals.subtotal)}</strong></div>
        <div class="vat-line"><span>VAT ${totals.vatEnabled ? `${totals.vatRate}%` : "not added"}</span><strong>${moneyText(totals.vatAmount)}</strong></div>
        <div class="vat-line total"><span>Total</span><strong>${moneyText(totals.total)}</strong></div>`;
    }
    const preview = document.querySelector("#quoteTotalPreview");
    if (preview) preview.textContent = `Total ${moneyText(totals.total)}`;
  }

  const oldRenderSelectedItems = typeof renderSelectedItems === "function" ? renderSelectedItems : null;
  if (oldRenderSelectedItems) {
    renderSelectedItems = function renderSelectedItemsWithVat() {
      oldRenderSelectedItems();
      ensureVatControls();
      updateVatSummary();
    };
  }

  function applyVatToLatestQuote() {
    if (!state.quotes?.length) return;
    const quote = state.quotes[0];
    const all = vatSettings();
    all[quote.id] = currentFormVat();
    saveVatSettings(all);
  }

  document.addEventListener("submit", (event) => {
    if (!event.target?.matches?.("#quoteForm")) return;
    setTimeout(applyVatToLatestQuote, 900);
  }, false);

  function quoteCard(quote) {
    const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
    const totals = calcTotals(quote);
    const items = typeof quoteItems === "function" ? quoteItems(quote) : (quote.items || []);
    const statusButtons = ["Accepted", "Declined"].map((status) => `<button class="ghost status-move-button ${quote.status === status ? "is-current" : ""}" data-status="${escapeHtml(quote.id)}:${status}" type="button">${quote.status === status ? status : status === "Accepted" ? "Mark accepted" : "Decline"}</button>`).join("");
    return `<article class="quote-card" data-quote-card="${escapeHtml(quote.id)}">
      <div class="card-top">
        <div><h3>${escapeHtml(clientTitle(client))}</h3><p class="meta">Quote ${escapeHtml(quoteRef(quote))} | ${quote.workstations} workstations, ${quote.rooms} rooms<br>${escapeHtml(quote.premises)}</p></div>
        <span class="badge ${classText(quote.status)} is-current-status">${escapeHtml(quote.status || "Draft")}</span>
      </div>
      <p class="meta">${items.slice(0, 4).map((item) => `${item.quantity}x ${escapeHtml(item.name)}`).join(", ")}</p>
      <div class="quote-money-lines">
        <div><span>Subtotal</span><strong>${moneyText(totals.subtotal)}</strong></div>
        <div><span>VAT ${totals.vatEnabled ? `${totals.vatRate}%` : "not added"}</span><strong>${moneyText(totals.vatAmount)}</strong></div>
        <div><span>Total</span><strong>${moneyText(totals.total)}</strong></div>
      </div>
      <p class="meta">Required ${dateText(quote.requiredDate)}</p>
      <div class="quote-record-actions">
        <button class="primary send-in-app-button" data-stage-send-quote="${escapeHtml(quote.id)}" type="button">Send quote</button>
        <button class="secondary" data-stage-invoice-quote="${escapeHtml(quote.id)}" type="button">Create invoice</button>
        <button class="secondary" data-edit-quote="${escapeHtml(quote.id)}" type="button">Edit quote</button>
        <button class="ghost danger" data-delete-quote="${escapeHtml(quote.id)}" type="button">Delete</button>
      </div>
      <div class="quote-status-actions">${statusButtons}</div>
    </article>`;
  }

  function renderColumns() {
    const statuses = ["Draft", "Sent", "Accepted", "Declined"];
    const filter = els.quoteStatusFilter?.value || "all";
    const query = els.searchInput?.value?.trim().toLowerCase() || "";
    const visibleStatuses = filter === "all" ? statuses : statuses.filter((status) => status === filter);
    const quotes = (state.quotes || []).filter((quote) => {
      if (filter !== "all" && quote.status !== filter) return false;
      if (!query) return true;
      const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
      return `${Object.values(quote).join(" ")} ${Object.values(client).join(" ")}`.toLowerCase().includes(query);
    });
    els.quoteList.innerHTML = `<div class="quote-status-board">${visibleStatuses.map((status) => {
      const columnQuotes = quotes.filter((quote) => (quote.status || "Draft") === status);
      return `<section class="quote-status-column is-${escapeHtml(status)}"><div class="quote-status-head"><h3>${escapeHtml(status)}</h3><span class="quote-status-count">${columnQuotes.length}</span></div>${columnQuotes.map(quoteCard).join("") || `<div class="empty">No ${escapeHtml(status.toLowerCase())} quotes.</div>`}</section>`;
    }).join("")}</div>`;
  }

  function invoiceHtml(quote) {
    const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
    const totals = calcTotals(quote);
    const items = typeof quoteItems === "function" ? quoteItems(quote) : (quote.items || []);
    return `<div class="invoice-preview"><div class="invoice-head"><img src="assets/weset-logo-live.jpg" alt="WeSet"><div><h1>Invoice</h1><p>${escapeHtml(quoteRef(quote))}</p></div></div>
      <p><strong>To:</strong> ${escapeHtml(clientTitle(client))}<br>${escapeHtml(client.email || "")}<br>${escapeHtml(quote.premises || "")}</p>
      <p><strong>Date:</strong> ${dateText(new Date().toISOString().slice(0, 10))}<br><strong>Quote reference:</strong> ${escapeHtml(quoteRef(quote))}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${Number(item.quantity || 1)}</td><td>${moneyText(item.unitCost || 0)}</td><td>${moneyText(Number(item.quantity || 1) * Number(item.unitCost || 0))}</td></tr>`).join("")}</tbody></table>
      <div class="invoice-totals"><div><span>Subtotal</span><strong>${moneyText(totals.subtotal)}</strong></div><div><span>VAT ${totals.vatEnabled ? `${totals.vatRate}%` : "not added"}</span><strong>${moneyText(totals.vatAmount)}</strong></div><div><span>Total due</span><strong>${moneyText(totals.total)}</strong></div></div>
      <p>Thank you for choosing WeSet.</p></div>`;
  }

  function ensureInvoiceDialog() {
    let dialog = document.querySelector("#invoiceDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "invoiceDialog";
    dialog.innerHTML = `<div class="dialog-card email-dialog"><div class="panel-head"><h2>Invoice preview</h2><button class="icon-btn" id="closeInvoiceDialog" type="button" aria-label="Close">x</button></div><div id="invoicePreview"></div><div class="dialog-actions"><button class="primary" id="printInvoiceBtn" type="button">Print / save PDF</button><button class="secondary" id="copyInvoiceBtn" type="button">Copy invoice text</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#closeInvoiceDialog")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("#printInvoiceBtn")?.addEventListener("click", () => window.print());
    dialog.querySelector("#copyInvoiceBtn")?.addEventListener("click", () => navigator.clipboard?.writeText(dialog.querySelector("#invoicePreview")?.innerText || ""));
    return dialog;
  }

  function showInvoice(id) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote) return;
    const dialog = ensureInvoiceDialog();
    dialog.querySelector("#invoicePreview").innerHTML = invoiceHtml(quote);
    dialog.showModal();
  }

  function quoteEmailPayload(quote) {
    const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
    const totals = calcTotals(quote);
    const html = invoiceHtml(quote);
    const text = `Hello ${client.contact || ""},\n\nPlease find your WeSet quote/invoice ${quoteRef(quote)}.\n\nSubtotal: ${moneyText(totals.subtotal)}\nVAT: ${moneyText(totals.vatAmount)}\nTotal: ${moneyText(totals.total)}\n\nKind regards,\nWeSet`;
    return { to: client.email || "", subject: `WeSet quote ${quoteRef(quote)}`, text, html, reference: quoteRef(quote) };
  }

  window.wesetQuoteEmailPayload = quoteEmailPayload;
  window.wesetQuoteInvoiceHtml = invoiceHtml;
  window.wesetQuoteTotals = calcTotals;

  document.addEventListener("click", (event) => {
    const invoice = event.target.closest?.("[data-invoice-quote]");
    if (invoice) {
      event.preventDefault();
      event.stopPropagation();
      showInvoice(invoice.dataset.invoiceQuote);
    }
  }, true);

  if (typeof renderQuoteCard === "function") renderQuoteCard = quoteCard;
  if (typeof renderQuotes === "function") renderQuotes = renderColumns;
  ensureVatControls();
  updateVatSummary();
  renderColumns();
})();

