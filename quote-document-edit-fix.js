(() => {
  const storeKey = "weset.quote.document.details";
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const style = document.createElement("style");
  style.textContent = `
    .doc-edit-button { background:#dfe9ec !important; color:#1d2528 !important; }
    .doc-edit-dialog { border:0; border-radius:8px; max-width:min(1040px, calc(100vw - 18px)); padding:0; width:min(1040px, calc(100vw - 18px)); }
    .doc-edit-card { background:#fff; border-radius:8px; display:grid; max-height:92dvh; overflow:hidden; }
    .doc-edit-head, .doc-edit-actions { align-items:center; background:#fff; display:flex; gap:10px; justify-content:space-between; padding:14px 16px; }
    .doc-edit-head { border-bottom:1px solid var(--line,#d9e0e1); }
    .doc-edit-head h2 { font-size:18px; margin:0; }
    .doc-edit-head p { color:var(--muted,#687478); margin:4px 0 0; }
    .doc-edit-body { display:grid; gap:14px; max-height:calc(92dvh - 132px); overflow:auto; padding:16px; }
    .doc-edit-grid { display:grid; gap:12px; grid-template-columns:repeat(2,minmax(0,1fr)); }
    .doc-edit-lines { display:grid; gap:10px; }
    .doc-edit-line { background:#f8fbfa; border:1px solid var(--line,#d9e0e1); border-radius:8px; display:grid; gap:10px; grid-template-columns:1.2fr 1.6fr .45fr .65fr .75fr; padding:10px; }
    .doc-edit-line label { min-width:0; }
    .doc-edit-line textarea { min-height:70px !important; }
    .doc-edit-actions { border-top:1px solid var(--line,#d9e0e1); flex-wrap:wrap; }
    .doc-edit-actions button { min-height:36px; }
    @media (max-width:760px) {
      .doc-edit-dialog { border-radius:0; height:100dvh; max-height:100dvh; max-width:100vw; width:100vw; }
      .doc-edit-card { border-radius:0; height:100dvh; max-height:100dvh; }
      .doc-edit-body { max-height:calc(100dvh - 150px); padding:12px; }
      .doc-edit-grid, .doc-edit-line { grid-template-columns:1fr; }
      .doc-edit-actions { display:grid; grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(style);

  function store() {
    try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { return {}; }
  }

  function saveStore(data) {
    localStorage.setItem(storeKey, JSON.stringify(data));
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

  function getClientSafe(quote) {
    return typeof getClient === "function" ? getClient(quote.clientId) : { company: "Client", contact: "", email: "" };
  }

  function quoteItemsSafe(quote) {
    if (typeof quoteItems === "function") return quoteItems(quote);
    return quote.items || [];
  }

  function moneyValue(value) {
    return Number(String(value ?? 0).replace(/[^0-9.-]/g, "")) || 0;
  }

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value || 0);
  }

  function totalsForRows(rows, quote) {
    const base = typeof window.wesetQuoteTotals === "function" ? window.wesetQuoteTotals(quote) : { vatEnabled: true, vatRate: 20 };
    const subtotal = rows.reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.rate || 0), 0);
    const vatRate = Number(base.vatRate || 0);
    const vatAmount = base.vatEnabled ? subtotal * vatRate / 100 : 0;
    return { ...base, subtotal, vatRate, vatAmount, total: subtotal + vatAmount };
  }

  function defaultRows(quote) {
    return quoteItemsSafe(quote).map((item, index) => {
      const qty = Number(item.quantity || 1);
      const rate = Number(item.unitCost || 0);
      return {
        index: index + 1,
        product: item.name || "Services",
        description: item.documentDescription || item.description || item.notes || quote.notes || `Office setup for ${quote.premises || "client site"}`,
        qty,
        rate,
        amount: qty * rate,
        vat: ""
      };
    });
  }

  function baseDetails(kind, quote) {
    const client = getClientSafe(quote);
    const rows = defaultRows(quote);
    const totals = totalsForRows(rows, quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    return {
      kind,
      quoteId: quote.id,
      reference,
      quoteRef: quoteRef(quote),
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: quote.requiredDate || "",
      billTo: [client.company || client.contact || "Client", client.contact || "", client.email || ""].filter(Boolean).join("\n"),
      shipTo: [client.company || client.contact || "Client", quote.premises || ""].filter(Boolean).join("\n"),
      rows,
      subtotal: totals.subtotal,
      vatLabel: `Includes VAT @ ${totals.vatEnabled ? totals.vatRate : 0}%`,
      vatAmount: totals.vatAmount,
      total: totals.total
    };
  }

  function detailsFor(kind, quote) {
    const saved = store()[quote.id] || {};
    const base = baseDetails(kind, quote);
    const rows = Array.isArray(saved.rows) && saved.rows.length ? saved.rows.map((row, index) => ({ ...row, index: index + 1, qty: Number(row.qty || 1), rate: Number(row.rate || 0), amount: Number(row.qty || 1) * Number(row.rate || 0) })) : base.rows;
    const totals = totalsForRows(rows, quote);
    return { ...base, ...saved, kind, quoteId: quote.id, rows, subtotal: totals.subtotal, vatAmount: totals.vatAmount, total: totals.total, vatLabel: saved.vatLabel || base.vatLabel };
  }

  async function syncToSupabase(id, details) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    try {
      const key = `quote_document_${id}`;
      const rows = await sbRequest(`app_settings?key=eq.${encodeURIComponent(key)}&select=id`);
      const body = { key, value: details };
      if (rows?.length) await sbRequest(`app_settings?key=eq.${encodeURIComponent(key)}`, { method: "PATCH", body });
      else await sbRequest("app_settings", { method: "POST", body });
    } catch {
      // Keep the local save even if Supabase settings are not available yet.
    }
  }

  async function loadFromSupabase(id) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    try {
      const key = `quote_document_${id}`;
      const rows = await sbRequest(`app_settings?key=eq.${encodeURIComponent(key)}&select=value`);
      if (rows?.[0]?.value) {
        const all = store();
        all[id] = rows[0].value;
        saveStore(all);
      }
    } catch {}
  }

  function saveDetails(id, details) {
    const all = store();
    all[id] = details;
    saveStore(all);
    syncToSupabase(id, details);
  }

  function ensureDialog() {
    let dialog = document.querySelector("#quoteDocumentEditDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "quoteDocumentEditDialog";
    dialog.className = "doc-edit-dialog";
    dialog.innerHTML = `<form class="doc-edit-card" id="quoteDocumentEditForm" method="dialog">
      <div class="doc-edit-head"><div><h2>Edit document details</h2><p>These details are used on the quote/invoice preview, email and PDF.</p></div><button class="icon-btn" id="closeQuoteDocumentEdit" type="button" aria-label="Close">x</button></div>
      <div class="doc-edit-body">
        <div class="doc-edit-grid">
          <label>Reference<input id="docReference" required></label>
          <label>Due date<input id="docDueDate" type="date"></label>
          <label>Bill to<textarea id="docBillTo" rows="4"></textarea></label>
          <label>Ship to<textarea id="docShipTo" rows="4"></textarea></label>
        </div>
        <section><div class="panel-head compact"><h3>Lines</h3><button class="secondary" id="addDocLine" type="button">Add line</button></div><div class="doc-edit-lines" id="docEditLines"></div></section>
      </div>
      <div class="doc-edit-actions"><button class="secondary" type="button" id="resetDocDetails">Reset from quote</button><button class="primary" type="submit">Save document details</button></div>
    </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#closeQuoteDocumentEdit")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("#addDocLine")?.addEventListener("click", () => addLineRow());
    dialog.querySelector("#resetDocDetails")?.addEventListener("click", resetCurrentDialog);
    dialog.querySelector("#quoteDocumentEditForm")?.addEventListener("submit", saveFromDialog);
    return dialog;
  }

  function lineRow(row = {}) {
    const id = crypto.randomUUID();
    return `<div class="doc-edit-line" data-doc-line="${id}">
      <label>Product/service<input data-doc-product value="${esc(row.product || "")}" required></label>
      <label>Description<textarea data-doc-description rows="3">${esc(row.description || "")}</textarea></label>
      <label>Qty<input data-doc-qty type="number" min="0" step="1" value="${Number(row.qty || 1)}"></label>
      <label>Rate<input data-doc-rate type="number" min="0" step="0.01" value="${Number(row.rate || 0)}"></label>
      <label>VAT<input data-doc-vat value="${esc(row.vat || "")}" placeholder="20% S"></label>
      <button class="ghost danger" data-remove-doc-line="${id}" type="button">Delete line</button>
    </div>`;
  }

  function renderLines(rows) {
    const container = document.querySelector("#docEditLines");
    if (!container) return;
    container.innerHTML = (rows || []).map(lineRow).join("");
    container.querySelectorAll("[data-remove-doc-line]").forEach((button) => button.addEventListener("click", () => button.closest("[data-doc-line]")?.remove()));
  }

  function addLineRow(row = { product: "Services", description: "", qty: 1, rate: 0, vat: "" }) {
    const container = document.querySelector("#docEditLines");
    if (!container) return;
    container.insertAdjacentHTML("beforeend", lineRow(row));
    container.querySelectorAll("[data-remove-doc-line]").forEach((button) => button.onclick = () => button.closest("[data-doc-line]")?.remove());
  }

  let currentQuoteId = "";
  let currentKind = "Quote";

  async function openEditor(kind, id) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote) return;
    await loadFromSupabase(id);
    currentQuoteId = id;
    currentKind = kind || "Quote";
    const details = detailsFor(currentKind, quote);
    const dialog = ensureDialog();
    dialog.querySelector("#docReference").value = details.reference || "";
    dialog.querySelector("#docDueDate").value = details.dueDate || "";
    dialog.querySelector("#docBillTo").value = details.billTo || "";
    dialog.querySelector("#docShipTo").value = details.shipTo || "";
    renderLines(details.rows);
    dialog.showModal();
  }

  function readDialogDetails() {
    const rows = [...document.querySelectorAll("#docEditLines [data-doc-line]")].map((line, index) => {
      const qty = Number(line.querySelector("[data-doc-qty]").value || 0);
      const rate = Number(line.querySelector("[data-doc-rate]").value || 0);
      return {
        index: index + 1,
        product: line.querySelector("[data-doc-product]").value.trim(),
        description: line.querySelector("[data-doc-description]").value.trim(),
        qty,
        rate,
        amount: qty * rate,
        vat: line.querySelector("[data-doc-vat]").value.trim()
      };
    });
    return {
      reference: document.querySelector("#docReference").value.trim(),
      dueDate: document.querySelector("#docDueDate").value,
      billTo: document.querySelector("#docBillTo").value.trim(),
      shipTo: document.querySelector("#docShipTo").value.trim(),
      rows
    };
  }

  function saveFromDialog(event) {
    event.preventDefault();
    const quote = (state.quotes || []).find((entry) => entry.id === currentQuoteId);
    if (!quote) return;
    const next = { ...detailsFor(currentKind, quote), ...readDialogDetails() };
    saveDetails(currentQuoteId, next);
    ensureDialog().close();
    if (typeof render === "function") render();
    alert("Document details saved. The next preview and send will use these amended details.");
  }

  function resetCurrentDialog() {
    const quote = (state.quotes || []).find((entry) => entry.id === currentQuoteId);
    if (!quote) return;
    const all = store();
    delete all[currentQuoteId];
    saveStore(all);
    const details = baseDetails(currentKind, quote);
    document.querySelector("#docReference").value = details.reference;
    document.querySelector("#docDueDate").value = details.dueDate;
    document.querySelector("#docBillTo").value = details.billTo;
    document.querySelector("#docShipTo").value = details.shipTo;
    renderLines(details.rows);
  }

  function addButtons() {
    document.querySelectorAll("[data-send-in-app], [data-send-invoice]").forEach((button) => {
      const id = button.dataset.sendInApp || button.dataset.sendInvoice;
      if (!id || button.parentElement?.querySelector(`[data-edit-document="${CSS.escape(id)}"]`)) return;
      const edit = document.createElement("button");
      edit.className = "secondary doc-edit-button";
      edit.type = "button";
      edit.dataset.editDocument = id;
      edit.dataset.documentKind = button.dataset.sendInvoice ? "Invoice" : "Quote";
      edit.textContent = button.dataset.sendInvoice ? "Edit invoice details" : "Edit quote details";
      button.insertAdjacentElement("beforebegin", edit);
    });
  }

  function companyDetails() {
    if (typeof window.wesetGetCompanyDetails === "function") return window.wesetGetCompanyDetails();
    return window.wesetCompanyDetails || { name: "WeSet", address1: "", address2: "", vat: "", email: "", phone: "", terms: "Net 15", logoUrl: "assets/weset-logo-live.jpg" };
  }

  function documentHtml(kind, quote) {
    const company = companyDetails();
    const d = detailsFor(kind, quote);
    const rows = d.rows || [];
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2528;background:#ffffff;max-width:900px;margin:0 auto;padding:0;">
      <div style="display:grid;grid-template-columns:1.15fr .85fr;gap:24px;padding:42px 48px 22px;align-items:start;"><div><h1 style="color:#0d6f9f;font-size:20px;letter-spacing:2px;margin:0 0 8px;">${esc(kind.toUpperCase())}</h1><p style="font-size:12px;line-height:1.45;margin:0;"><strong>${esc(company.name)}</strong><br>${esc(company.address1)}<br>${esc(company.address2)}<br>${esc(company.vat)}</p></div><div style="display:grid;gap:10px;justify-items:end;"><p style="font-size:12px;line-height:1.45;margin:0;text-align:left;width:100%;max-width:250px;">${esc(company.email)}<br>${esc(company.phone)}</p><div style="background:#eeeeee;border-radius:2px;padding:12px 18px;width:260px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.12);"><img src="${esc(company.logoUrl || "assets/weset-logo-live.jpg")}" alt="WeSet" style="display:block;width:100%;height:auto;"></div></div></div>
      <div style="background:#eaf3fb;padding:22px 48px 28px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-bottom:34px;"><div><h2 style="font-size:12px;margin:0 0 6px;">Bill to</h2><p style="font-size:13px;line-height:1.45;margin:0;white-space:pre-line;">${esc(d.billTo)}</p></div><div><h2 style="font-size:12px;margin:0 0 6px;">Ship to</h2><p style="font-size:13px;line-height:1.45;margin:0;white-space:pre-line;">${esc(d.shipTo)}</p></div></div><div style="border-top:1px dashed #ccd7df;padding-top:24px;max-width:280px;"><h2 style="font-size:13px;margin:0 0 8px;">${esc(kind)} details</h2><p style="font-size:13px;line-height:1.55;margin:0;">${esc(kind)} no.: ${esc(d.reference)}<br>Terms: ${esc(company.terms || "Net 15")}<br>${esc(kind)} date: ${esc(d.issueDate)}<br>Due date: ${esc(d.dueDate || d.issueDate)}</p></div></div>
      <div style="padding:30px 48px 34px;"><table style="border-collapse:collapse;width:100%;font-size:12px;"><thead><tr><th style="padding:10px 8px;text-align:left;width:30px;">#</th><th style="padding:10px 8px;text-align:left;width:27%;">Product or service</th><th style="padding:10px 8px;text-align:left;">Description</th><th style="padding:10px 8px;text-align:right;width:55px;">Qty</th><th style="padding:10px 8px;text-align:right;width:85px;">Rate</th><th style="padding:10px 8px;text-align:right;width:95px;">Amount</th><th style="padding:10px 8px;text-align:right;width:75px;">VAT</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td style="border-top:1px solid #e2e6e8;padding:13px 8px;vertical-align:top;">${index + 1}.</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;vertical-align:top;font-weight:700;line-height:1.45;">${esc(row.product)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;vertical-align:top;line-height:1.45;">${esc(row.description)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${Number(row.qty || 0)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${moneyText(row.rate)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${moneyText(Number(row.qty || 0) * Number(row.rate || 0))}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${esc(row.vat || d.vatLabel.replace("Includes VAT @ ", ""))}</td></tr>`).join("")}</tbody></table><div style="display:grid;grid-template-columns:1fr 270px;gap:28px;margin-top:18px;align-items:start;"><div></div><div style="font-size:13px;"><div style="display:flex;justify-content:space-between;border-top:1px solid #e2e6e8;padding:10px 0;"><span>Subtotal</span><span>${moneyText(d.subtotal)}</span></div><div style="display:flex;justify-content:space-between;border-top:1px solid #e2e6e8;padding:10px 0;"><span>${esc(d.vatLabel)}</span><span>${moneyText(d.vatAmount)}</span></div><div style="display:flex;justify-content:space-between;border-top:1px solid #d2d9dd;padding:16px 0 0;font-size:16px;font-weight:800;"><span>Total</span><span>${moneyText(d.total)}</span></div></div></div></div>
    </div>`;
  }

  function structuredText(kind, quote) {
    const company = companyDetails();
    const d = detailsFor(kind, quote);
    return [`DOC_TYPE: ${kind}`, `REFERENCE: ${d.reference}`, `QUOTE_REF: ${d.quoteRef}`, `DATE: ${d.issueDate}`, `DUE_DATE: ${d.dueDate || ""}`, `FROM_COMPANY: ${company.name || ""}`, `FROM_ADDRESS1: ${company.address1 || ""}`, `FROM_ADDRESS2: ${company.address2 || ""}`, `FROM_VAT: ${company.vat || ""}`, `FROM_EMAIL: ${company.email || ""}`, `FROM_PHONE: ${company.phone || ""}`, `TERMS: ${company.terms || "Net 15"}`, `CLIENT_COMPANY: ${(d.billTo || "").split("\n")[0] || "Client"}`, `CLIENT_CONTACT: ${(d.billTo || "").split("\n")[1] || ""}`, `CLIENT_EMAIL: ${(d.billTo || "").split("\n")[2] || ""}`, `SHIP_TO: ${d.shipTo || ""}`, ...d.rows.map((row) => `ITEM: ${row.product} | DESC: ${row.description} | QTY: ${row.qty} | RATE: ${moneyText(row.rate)} | AMOUNT: ${moneyText(Number(row.qty || 0) * Number(row.rate || 0))} | VAT: ${row.vat || d.vatLabel.replace("Includes VAT @ ", "")}`), `SUBTOTAL: ${moneyText(d.subtotal)}`, `VAT_LABEL: ${d.vatLabel}`, `VAT_AMOUNT: ${moneyText(d.vatAmount)}`, `TOTAL: ${moneyText(d.total)}`, "", `Hello ${(d.billTo || "").split("\n")[1] || ""},`, `Your ${kind.toLowerCase()} ${d.reference} is ready. The PDF is attached.`, "Kind regards,", company.name || "WeSet"].join("\n");
  }

  function wrapPayloads() {
    window.wesetQuoteInvoiceHtml = (quote) => documentHtml("Quote", quote);
    window.wesetQuoteEmailPayload = (quote) => {
      const client = getClientSafe(quote);
      const d = detailsFor("Quote", quote);
      const html = typeof window.wesetGetCompanyDetails === "function" ? null : "";
      return { to: client.email || "", subject: `Quote ${d.reference}`, text: structuredText("Quote", quote), html: (typeof window.wesetBuildEmailHtml === "function" ? window.wesetBuildEmailHtml("Quote", quote) : undefined) || undefined, reference: d.reference, invoiceHtml: documentHtml("Quote", quote) };
    };
    window.wesetInvoiceEmailPayload = (quote) => {
      const client = getClientSafe(quote);
      const d = detailsFor("Invoice", quote);
      return { to: client.email || "", subject: `Invoice ${d.reference}`, text: structuredText("Invoice", quote), html: undefined, reference: d.reference, invoiceHtml: documentHtml("Invoice", quote) };
    };
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-edit-document]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openEditor(button.dataset.documentKind || "Quote", button.dataset.editDocument);
  }, true);

  const oldRender = typeof render === "function" ? render : null;
  if (oldRender) render = function renderWithDocEditButtons() { oldRender(); addButtons(); };
  const oldRenderQuotes = typeof renderQuotes === "function" ? renderQuotes : null;
  if (oldRenderQuotes) renderQuotes = function renderQuotesWithDocEditButtons() { oldRenderQuotes(); addButtons(); };
  const oldRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (oldRenderDashboard) renderDashboard = function renderDashboardWithDocEditButtons() { oldRenderDashboard(); addButtons(); };

  window.wesetGetQuoteDocumentDetails = detailsFor;
  window.wesetOpenQuoteDocumentEditor = openEditor;
  wrapPayloads();
  addButtons();
})();
