(() => {
  const invoiceStoreKey = "weset.invoices";
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const style = document.createElement("style");
  style.textContent = `
    .invoice-send-button {
      background: #145c58 !important;
      color: #fff !important;
    }
    .invoice-send-button[disabled],
    .invoice-save-button[disabled] {
      cursor: wait !important;
      opacity: 0.72 !important;
    }
    .invoice-notice {
      background: #e8f3f1;
      border: 1px solid rgba(20, 92, 88, 0.22);
      border-radius: 8px;
      color: #1d3f3d;
      font-size: 14px;
      margin: 10px 0;
      padding: 10px 12px;
    }
    .invoice-notice.is-warn {
      background: #fff7ed;
      border-color: #fed7aa;
      color: #7c2d12;
    }
    .quote-card .quote-record-actions {
      background: #f8fafb !important;
      border: 1px solid var(--line, #d9e0e1) !important;
      border-radius: 8px !important;
      display: grid !important;
      gap: 10px !important;
      padding: 10px !important;
    }
    .quote-action-panel {
      display: grid;
      gap: 10px;
      width: 100%;
    }
    .quote-action-group {
      align-items: stretch;
      display: grid;
      gap: 8px;
    }
    .quote-action-label {
      color: var(--muted, #687478);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .quote-action-row {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .quote-action-row > button,
    .quote-action-row > a.as-link {
      min-height: 38px;
      width: 100%;
    }
    .quote-action-group.is-primary .quote-action-row {
      grid-template-columns: 1fr;
    }
    .quote-action-group.is-tools .quote-action-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .quote-card .quote-status-actions {
      background: #fff !important;
      border: 1px solid var(--line, #d9e0e1) !important;
      border-radius: 8px !important;
      display: grid !important;
      gap: 8px !important;
      grid-template-columns: 1fr !important;
      margin-top: 10px !important;
      padding: 10px !important;
    }
    .quote-card .quote-status-actions::before {
      color: var(--muted, #687478);
      content: "Move status";
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .quote-card .quote-status-actions button {
      width: 100%;
    }
    .quote-card .ghost.danger {
      color: #a2413a !important;
    }
    button.status-live-current,
    button.is-current,
    .status-move-button.is-current {
      background: #145c58 !important;
      border-color: #145c58 !important;
      color: #fff !important;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16) !important;
    }
    button.status-live-current::after {
      content: " current";
      font-size: 11px;
      font-weight: 700;
      opacity: 0.8;
    }
    @media (min-width: 760px) {
      .quote-action-panel {
        grid-template-columns: 1.2fr 1fr;
      }
      .quote-action-group.is-tools {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 620px) {
      .quote-action-row,
      .quote-action-group.is-tools .quote-action-row {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value || 0);
  }

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function invoiceNumber(quote) {
    return `INV-${quoteRef(quote).replace(/^Q-?/i, "")}`;
  }

  function sessionToken() {
    try { return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || ""; } catch { return ""; }
  }

  function invoiceStore() {
    try { return JSON.parse(localStorage.getItem(invoiceStoreKey) || "[]"); } catch { return []; }
  }

  function saveInvoiceStore(invoices) {
    localStorage.setItem(invoiceStoreKey, JSON.stringify(invoices));
  }

  function getQuote(id) {
    return (state.quotes || []).find((entry) => entry.id === id);
  }

  function getClientSafe(quote) {
    return typeof getClient === "function" ? getClient(quote.clientId) : { company: "Client", contact: "", email: "" };
  }

  function totalsForQuote(quote) {
    if (typeof window.wesetQuoteTotals === "function") return window.wesetQuoteTotals(quote);
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { total: 0 };
    return { subtotal: costs.total || 0, vatEnabled: false, vatRate: 0, vatAmount: 0, total: costs.total || 0 };
  }

  function invoiceHtmlForQuote(quote) {
    if (typeof window.wesetQuoteInvoiceHtml === "function") return window.wesetQuoteInvoiceHtml(quote);
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    return `<div><h1>Invoice ${escapeHtml(invoiceNumber(quote))}</h1><p>${escapeHtml(client.company || client.contact || "Client")}</p><p>Total due: ${moneyText(totals.total)}</p></div>`;
  }

  function invoiceRecord(quote, status = "Created") {
    const totals = totalsForQuote(quote);
    return {
      id: invoiceNumber(quote),
      invoiceNumber: invoiceNumber(quote),
      quoteId: quote.id,
      clientId: quote.clientId,
      status,
      subtotal: Number(totals.subtotal || 0),
      vatEnabled: Boolean(totals.vatEnabled),
      vatRate: Number(totals.vatRate || 0),
      vatAmount: Number(totals.vatAmount || 0),
      total: Number(totals.total || 0),
      html: invoiceHtmlForQuote(quote),
      createdAt: new Date().toISOString(),
      sentAt: status === "Sent" ? new Date().toISOString() : ""
    };
  }

  async function saveInvoiceToSupabase(record) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return { saved: false, reason: "not connected" };
    try {
      const body = {
        quote_id: record.quoteId,
        client_id: record.clientId,
        invoice_number: record.invoiceNumber,
        status: record.status,
        subtotal: record.subtotal,
        vat_enabled: record.vatEnabled,
        vat_rate: record.vatRate,
        vat_amount: record.vatAmount,
        total: record.total,
        invoice_html: record.html,
        sent_at: record.sentAt || null
      };
      const existing = await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(record.invoiceNumber)}&select=id`);
      if (existing?.length) {
        await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(record.invoiceNumber)}`, { method: "PATCH", body });
      } else {
        await sbRequest("invoices", { method: "POST", body });
      }
      return { saved: true };
    } catch (error) {
      console.warn("Invoice could not be saved to Supabase", error);
      return { saved: false, reason: error.message || "Supabase invoices table is not ready" };
    }
  }

  async function createInvoice(id, options = {}) {
    const quote = getQuote(id);
    if (!quote) return null;
    const record = invoiceRecord(quote, options.status || "Created");
    const invoices = invoiceStore().filter((entry) => entry.invoiceNumber !== record.invoiceNumber);
    invoices.unshift(record);
    saveInvoiceStore(invoices);
    const supabase = await saveInvoiceToSupabase(record);
    return { record, supabase };
  }

  function emailHtml(quote, record) {
    const client = getClientSafe(quote);
    return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e0e1;">
        <div style="background:#145c58;color:#ffffff;padding:22px 26px;">
          <img src="https://dirnfeldh-code.github.io/Weset/assets/weset-logo-live.jpg" alt="WeSet" style="display:block;max-width:190px;background:#ffffff;border-radius:6px;padding:4px;margin-bottom:16px;">
          <h1 style="margin:0;font-size:26px;">Invoice ${escapeHtml(record.invoiceNumber)}</h1>
          <p style="margin:8px 0 0;">For ${escapeHtml(client.company || client.contact || "your office setup")}</p>
        </div>
        <div style="padding:24px 26px;">
          <p>Hello ${escapeHtml(client.contact || "")},</p>
          <p>Your WeSet invoice is ready. The invoice is attached and the total due is shown below.</p>
          <div style="background:#e8f3f1;border-radius:8px;padding:16px;margin:18px 0;">
            <p style="margin:0 0 6px;"><strong>Quote:</strong> ${escapeHtml(quoteRef(quote))}</p>
            <p style="margin:0 0 6px;"><strong>Setup address:</strong> ${escapeHtml(quote.premises || "")}</p>
            <p style="margin:0;"><strong>Total due:</strong> ${moneyText(record.total)}</p>
          </div>
          <p>Kind regards,<br>WeSet</p>
        </div>
      </div>
    </div>`;
  }

  function emailText(quote, record) {
    const client = getClientSafe(quote);
    return `Hello ${client.contact || ""},\n\nYour WeSet invoice ${record.invoiceNumber} is ready.\n\nQuote: ${quoteRef(quote)}\nSetup address: ${quote.premises || ""}\nSubtotal: ${moneyText(record.subtotal)}\nVAT: ${moneyText(record.vatAmount)}\nTotal due: ${moneyText(record.total)}\n\nThe invoice is attached.\n\nKind regards,\nWeSet`;
  }

  async function sendInvoice(id, button = null) {
    const quote = getQuote(id);
    if (!quote) return;
    const client = getClientSafe(quote);
    if (!client.email) return alert("This client does not have an email address saved. Add the client email first, then send the invoice.");
    const token = sessionToken();
    if (!token) return alert("Please log in first. Sending invoice from the app needs your Supabase login session.");

    const oldText = button?.textContent || "Send invoice";
    if (button) { button.disabled = true; button.textContent = "Sending invoice..."; }
    try {
      const { record, supabase } = await createInvoice(id, { status: "Sent" });
      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quoteId: quote.id,
          to: client.email,
          subject: `WeSet invoice ${record.invoiceNumber}`,
          text: emailText(quote, record),
          html: emailHtml(quote, record),
          reference: record.invoiceNumber,
          invoiceHtml: record.html
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "Invoice email sender is not configured yet.");
      if (typeof updateQuote === "function") await updateQuote(quote.id, { status: "Sent" });
      const suffix = supabase.saved ? " It was also saved to Supabase." : " It was saved in the app; create the invoices table in Supabase to store invoice records there too.";
      alert(`Invoice ${record.invoiceNumber} sent to ${client.email}.${suffix}`);
    } catch (error) {
      alert(`Could not send invoice yet: ${error.message || "Please check the email setup and try again."}`);
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText; }
    }
  }

  async function saveInvoiceOnly(id, button = null) {
    const oldText = button?.textContent || "Save invoice";
    if (button) { button.disabled = true; button.textContent = "Saving..."; }
    try {
      const result = await createInvoice(id, { status: "Created" });
      if (!result) return;
      const message = result.supabase.saved
        ? `Invoice ${result.record.invoiceNumber} created and saved to Supabase.`
        : `Invoice ${result.record.invoiceNumber} created in the app. Supabase did not save it yet: ${result.supabase.reason || "create the invoices table first."}`;
      alert(message);
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText; }
    }
  }

  function enhanceInvoiceDialog(id) {
    const dialog = document.querySelector("#invoiceDialog");
    if (!dialog || dialog.dataset.invoiceEnhanced === id) return;
    dialog.dataset.invoiceEnhanced = id;
    const preview = dialog.querySelector("#invoicePreview");
    if (preview && !dialog.querySelector(".invoice-notice")) {
      preview.insertAdjacentHTML("beforebegin", `<div class="invoice-notice">Create the invoice first, then send it straight from the app. The email will include the designed WeSet message and an invoice attachment.</div>`);
    }
    const actions = dialog.querySelector(".dialog-actions");
    if (!actions) return;
    if (!actions.querySelector("[data-save-invoice]")) {
      actions.insertAdjacentHTML("afterbegin", `<button class="secondary invoice-save-button" data-save-invoice="${escapeHtml(id)}" type="button">Create invoice</button><button class="primary invoice-send-button" data-send-invoice="${escapeHtml(id)}" type="button">Create & send invoice</button>`);
    } else {
      actions.querySelector("[data-save-invoice]").dataset.saveInvoice = id;
      actions.querySelector("[data-send-invoice]").dataset.sendInvoice = id;
    }
  }

  function addInvoiceButtons() {
    document.querySelectorAll("[data-invoice-quote]").forEach((button) => {
      const id = button.dataset.invoiceQuote;
      if (!id || button.parentElement?.querySelector(`[data-send-invoice="${CSS.escape(id)}"]`)) return;
      const sendButton = document.createElement("button");
      sendButton.className = "primary invoice-send-button";
      sendButton.dataset.sendInvoice = id;
      sendButton.type = "button";
      sendButton.textContent = "Send invoice";
      button.insertAdjacentElement("afterend", sendButton);
    });
  }

  function makeActionGroup(label, className, buttons) {
    const group = document.createElement("div");
    group.className = `quote-action-group ${className}`.trim();
    const labelNode = document.createElement("div");
    labelNode.className = "quote-action-label";
    labelNode.textContent = label;
    const row = document.createElement("div");
    row.className = "quote-action-row";
    buttons.filter(Boolean).forEach((button) => row.appendChild(button));
    group.append(labelNode, row);
    return group;
  }

  function organizeQuoteActions() {
    document.querySelectorAll(".quote-record-actions").forEach((actions) => {
      const sendQuote = actions.querySelector("[data-send-in-app]");
      const prepareEmail = actions.querySelector("[data-send-quote]");
      const createInvoiceButton = actions.querySelector("[data-invoice-quote]");
      const sendInvoiceButton = actions.querySelector("[data-send-invoice]");
      const editButton = actions.querySelector("[data-edit-quote]");
      const deleteButton = actions.querySelector("[data-delete-quote]");
      if (!sendQuote && !prepareEmail && !createInvoiceButton && !sendInvoiceButton && !editButton && !deleteButton) return;

      const panel = document.createElement("div");
      panel.className = "quote-action-panel";
      if (sendQuote || prepareEmail) panel.appendChild(makeActionGroup("Quote email", "is-primary", [sendQuote, prepareEmail]));
      if (createInvoiceButton || sendInvoiceButton) panel.appendChild(makeActionGroup("Invoice", "is-primary", [createInvoiceButton, sendInvoiceButton]));
      if (editButton || deleteButton) panel.appendChild(makeActionGroup("Manage", "is-tools", [editButton, deleteButton]));
      actions.replaceChildren(panel);
    });
  }

  function statusFromDataset(button) {
    const raw = button.dataset.status || button.dataset.install || "";
    const parts = raw.split(":");
    if (parts.length < 2) return null;
    return { id: parts[0], status: parts.slice(1).join(":") };
  }

  function highlightStatusButtons() {
    document.querySelectorAll("[data-status], [data-install]").forEach((button) => {
      const info = statusFromDataset(button);
      if (!info) return;
      const quote = getQuote(info.id);
      const currentStatus = button.dataset.install ? quote?.installStatus : quote?.status;
      const isCurrent = currentStatus === info.status;
      button.classList.toggle("status-live-current", Boolean(isCurrent));
      button.setAttribute("aria-pressed", isCurrent ? "true" : "false");
    });
  }

  function refreshQuoteUi() {
    addInvoiceButtons();
    organizeQuoteActions();
    highlightStatusButtons();
  }

  const oldRenderQuotes = typeof renderQuotes === "function" ? renderQuotes : null;
  if (oldRenderQuotes) renderQuotes = function renderQuotesWithInvoices() { oldRenderQuotes(); refreshQuoteUi(); };
  const oldRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (oldRenderDashboard) renderDashboard = function renderDashboardWithInvoices() { oldRenderDashboard(); refreshQuoteUi(); };
  const oldRenderInstallations = typeof renderInstallations === "function" ? renderInstallations : null;
  if (oldRenderInstallations) renderInstallations = function renderInstallationsWithStatusHighlight() { oldRenderInstallations(); highlightStatusButtons(); };

  document.addEventListener("click", (event) => {
    const invoicePreview = event.target.closest?.("[data-invoice-quote]");
    const saveButton = event.target.closest?.("[data-save-invoice]");
    const sendButton = event.target.closest?.("[data-send-invoice]");
    const statusButton = event.target.closest?.("[data-status], [data-install]");
    if (statusButton) setTimeout(highlightStatusButtons, 120);
    if (invoicePreview) {
      setTimeout(() => enhanceInvoiceDialog(invoicePreview.dataset.invoiceQuote), 0);
      return;
    }
    if (saveButton) {
      event.preventDefault();
      event.stopPropagation();
      saveInvoiceOnly(saveButton.dataset.saveInvoice, saveButton);
      return;
    }
    if (sendButton) {
      event.preventDefault();
      event.stopPropagation();
      sendInvoice(sendButton.dataset.sendInvoice, sendButton);
    }
  }, true);

  window.wesetCreateInvoice = createInvoice;
  window.wesetSendInvoice = sendInvoice;
  window.wesetHighlightStatusButtons = highlightStatusButtons;

  refreshQuoteUi();
})();
