(() => {
  const invoiceStoreKey = "weset.invoices";
  const quoteSendStoreKey = "weset.quote.sends";
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";
  let tidyQueued = false;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function quoteById(id) {
    return (state.quotes || []).find((quote) => String(quote.id) === String(id));
  }

  function clientById(id) {
    if (typeof getClient === "function") return getClient(id);
    return (state.clients || []).find((client) => String(client.id) === String(id)) || { company: "Client", contact: "", email: "" };
  }

  function clientName(client) {
    return String(client?.company || client?.contact || client?.email || "Client").trim() || "Client";
  }

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => String(entry.id) === raw);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function moneyText(value) {
    const amount = Number(value || 0);
    if (typeof formatMoney === "function") return formatMoney(amount);
    if (typeof money === "function") return money(amount);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(amount);
  }

  function dateText(value) {
    const raw = String(value || "").slice(0, 10);
    if (!raw) return "No date";
    if (typeof date === "function") return date(raw);
    return raw;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(days) {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return value.toISOString().slice(0, 10);
  }

  function totalsForQuote(quote) {
    if (typeof window.wesetQuoteTotals === "function") return window.wesetQuoteTotals(quote);
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { total: 0 };
    return { subtotal: Number(costs.total || 0), vatEnabled: false, vatRate: 0, vatAmount: 0, total: Number(costs.total || 0) };
  }

  function quoteItemsSafe(quote) {
    if (typeof quoteItems === "function") return quoteItems(quote);
    return quote.items || [];
  }

  function invoiceNumber(quote) {
    const existing = invoiceForQuote(quote.id);
    if (existing?.invoiceNumber) return existing.invoiceNumber;
    return `INV-${quoteRef(quote).replace(/^Q-?/i, "")}`;
  }

  function normalizeInvoice(invoice) {
    return {
      ...invoice,
      invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || invoice.id || "Invoice",
      quoteId: invoice.quoteId || invoice.quote_id || "",
      clientId: invoice.clientId || invoice.client_id || "",
      status: invoice.status || "Unpaid",
      subtotal: Number(invoice.subtotal || 0),
      vatEnabled: Boolean(invoice.vatEnabled ?? invoice.vat_enabled),
      vatRate: Number(invoice.vatRate ?? invoice.vat_rate ?? 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      createdAt: invoice.createdAt || invoice.created_at || "",
      sentAt: invoice.sentAt || invoice.sent_at || "",
      dueDate: invoice.dueDate || invoice.due_date || "",
      terms: invoice.terms || "Net 15",
      notes: invoice.notes || "",
      html: invoice.html || invoice.invoice_html || ""
    };
  }

  function invoices() {
    return readJson(invoiceStoreKey, []).map(normalizeInvoice);
  }

  function invoiceForQuote(quoteId) {
    return invoices().find((invoice) => String(invoice.quoteId) === String(quoteId));
  }

  function token() {
    if (typeof sbAnonKey !== "undefined" && sbAnonKey) return sbAnonKey;
    try { return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || ""; } catch { return ""; }
  }

  function ensureStyles() {
    if (document.querySelector("#quoteStageWorkflowStyles")) return;
    const style = document.createElement("style");
    style.id = "quoteStageWorkflowStyles";
    style.textContent = `
      .stage-actions { background: #f8fbfa; border: 1px solid var(--line,#d9e0e1); border-radius: 8px; display: grid; gap: 8px; margin-top: 10px; padding: 10px; }
      .stage-action-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .stage-action-row button { border-radius: 7px !important; min-height: 36px !important; padding: 8px 11px !important; white-space: nowrap !important; }
      .stage-note { color: var(--muted,#687478); font-size: 12px; font-weight: 700; line-height: 1.35; margin: 0; }
      .stage-hidden { display: none !important; }
      .stage-dialog { border: 0; border-radius: 10px; box-shadow: 0 24px 80px rgba(0,0,0,.22); max-height: min(96dvh, calc(100vh - 12px)); max-width: min(1080px, calc(100vw - 12px)); padding: 0; width: min(1080px, calc(100vw - 12px)); }
      .stage-dialog::backdrop { background: rgba(10,31,34,.38); }
      .stage-dialog-card { background: #fff; border-radius: 10px; display: grid; max-height: min(96dvh, calc(100vh - 12px)); overflow: hidden; }
      .stage-dialog-head, .stage-dialog-actions { align-items: center; background: #fff; display: flex; gap: 10px; justify-content: space-between; padding: 14px 16px; }
      .stage-dialog-head { border-bottom: 1px solid var(--line,#d9e0e1); }
      .stage-dialog-head h2 { font-size: 18px; margin: 0; }
      .stage-dialog-head p { color: var(--muted,#687478); margin: 4px 0 0; }
      .stage-dialog-body { display: grid; gap: 14px; grid-template-columns: minmax(0,.86fr) minmax(0,1.14fr); max-height: calc(96dvh - 136px); overflow: auto; padding: 16px; }
      .stage-dialog-panel { border: 1px solid var(--line,#d9e0e1); border-radius: 8px; display: grid; gap: 10px; min-width: 0; padding: 12px; }
      .stage-form-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0,1fr)); }
      .stage-form-grid .span-2 { grid-column: 1 / -1; }
      .stage-form-grid input, .stage-form-grid textarea, .stage-form-grid select { width: 100%; }
      .stage-form-grid textarea { min-height: 90px; resize: vertical; }
      .stage-preview { background: #eef5f4; border-radius: 8px; max-height: 60dvh; overflow: auto; padding: 12px; }
      .stage-preview-inner { background: #fff; border: 1px solid #d9e0e1; border-radius: 8px; box-shadow: 0 8px 22px rgba(18,35,39,.08); margin: 0 auto; max-width: 760px; overflow: hidden; }
      .stage-dialog-actions { border-top: 1px solid var(--line,#d9e0e1); flex-wrap: wrap; }
      .stage-dialog-actions button { min-height: 38px; }
      .stage-warning { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; color: #7c2d12; font-weight: 700; padding: 9px 10px; }
      @media (max-width: 760px) { .stage-dialog { border-radius: 0; height: 100dvh; max-height: 100dvh; max-width: 100vw; width: 100vw; } .stage-dialog-card { border-radius: 0; height: 100dvh; max-height: 100dvh; } .stage-dialog-body, .stage-form-grid { grid-template-columns: 1fr; } .stage-dialog-actions { align-items: stretch; display: grid; } .stage-dialog-actions button, .stage-action-row button { width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  function invoiceHtml(quote, invoice, email = "") {
    const client = clientById(invoice.clientId || quote.clientId);
    const items = quoteItemsSafe(quote);
    return `<div style="background:#fff;color:#1d2528;font-family:Arial,Helvetica,sans-serif;line-height:1.45;padding:26px;">
      <div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:1px solid #d9e0e1;padding-bottom:18px;">
        <div><h1 style="color:#145c58;margin:0 0 10px;font-size:28px;">INVOICE</h1><strong>WeSet</strong><br>accounts@weset.co.uk<br>+447380907868</div>
        <img src="https://dirnfeldh-code.github.io/Weset/assets/weset-logo-live.jpg" alt="WeSet" style="max-width:230px;background:#eef5f4;border-radius:6px;padding:6px;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#e8f3f1;margin:18px -26px 18px;padding:18px 26px;">
        <div><strong>Bill to</strong><br>${esc(clientName(client))}<br>${esc(email || client.email || "")}<br>${esc(quote.premises || "")}</div>
        <div><strong>Invoice details</strong><br>Invoice no: ${esc(invoice.invoiceNumber)}<br>Quote: ${esc(quoteRef(quote))}<br>Terms: ${esc(invoice.terms || "Net 15")}<br>Invoice date: ${esc(dateText(invoice.createdAt || today()))}<br>Due date: ${esc(dateText(invoice.dueDate || ""))}</div>
      </div>
      ${invoice.notes ? `<p><strong>Notes:</strong> ${esc(invoice.notes)}</p>` : ""}
      <table style="border-collapse:collapse;width:100%;"><thead><tr><th style="border-bottom:1px solid #d9e0e1;text-align:left;padding:9px;">#</th><th style="border-bottom:1px solid #d9e0e1;text-align:left;padding:9px;">Product or service</th><th style="border-bottom:1px solid #d9e0e1;text-align:left;padding:9px;">Description</th><th style="border-bottom:1px solid #d9e0e1;text-align:right;padding:9px;">Qty</th><th style="border-bottom:1px solid #d9e0e1;text-align:right;padding:9px;">Rate</th><th style="border-bottom:1px solid #d9e0e1;text-align:right;padding:9px;">Amount</th><th style="border-bottom:1px solid #d9e0e1;text-align:right;padding:9px;">VAT</th></tr></thead><tbody>
        ${items.map((item, index) => `<tr><td style="border-bottom:1px solid #e5ecec;padding:9px;">${index + 1}</td><td style="border-bottom:1px solid #e5ecec;padding:9px;"><strong>${esc(item.name)}</strong></td><td style="border-bottom:1px solid #e5ecec;padding:9px;">${esc(item.description || quote.premises || "")}</td><td style="border-bottom:1px solid #e5ecec;padding:9px;text-align:right;">${Number(item.quantity || 1)}</td><td style="border-bottom:1px solid #e5ecec;padding:9px;text-align:right;">${moneyText(item.unitCost || 0)}</td><td style="border-bottom:1px solid #e5ecec;padding:9px;text-align:right;">${moneyText(Number(item.quantity || 1) * Number(item.unitCost || 0))}</td><td style="border-bottom:1px solid #e5ecec;padding:9px;text-align:right;">${invoice.vatEnabled ? `${invoice.vatRate}%` : "0%"}</td></tr>`).join("")}
      </tbody></table>
      <div style="display:grid;gap:8px;justify-content:end;margin-top:20px;"><div style="display:grid;grid-template-columns:170px 130px;gap:18px;"><span>Subtotal</span><strong style="text-align:right;">${moneyText(invoice.subtotal)}</strong></div><div style="display:grid;grid-template-columns:170px 130px;gap:18px;"><span>VAT</span><strong style="text-align:right;">${moneyText(invoice.vatAmount)}</strong></div><div style="display:grid;grid-template-columns:170px 130px;gap:18px;border-top:1px solid #d9e0e1;padding-top:10px;font-size:20px;"><strong>Total</strong><strong style="text-align:right;">${moneyText(invoice.total)}</strong></div></div>
    </div>`;
  }

  function buildInvoiceFromForm(quote, form) {
    const totals = totalsForQuote(quote);
    return normalizeInvoice({
      id: form.invoiceNumber,
      invoiceNumber: form.invoiceNumber,
      quoteId: quote.id,
      clientId: quote.clientId,
      status: form.status || "Unpaid",
      subtotal: Number(totals.subtotal || 0),
      vatEnabled: Boolean(totals.vatEnabled),
      vatRate: Number(totals.vatRate || 0),
      vatAmount: Number(totals.vatAmount || 0),
      total: Number(totals.total || 0),
      createdAt: form.invoiceDate || today(),
      dueDate: form.dueDate || "",
      terms: form.terms || "Net 15",
      notes: form.notes || ""
    });
  }

  async function saveInvoiceToSupabase(invoice) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return { saved: false, reason: "not connected" };
    const body = {
      quote_id: invoice.quoteId,
      client_id: invoice.clientId,
      invoice_number: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: invoice.subtotal,
      vat_enabled: invoice.vatEnabled,
      vat_rate: invoice.vatRate,
      vat_amount: invoice.vatAmount,
      total: invoice.total,
      invoice_html: invoice.html,
      sent_at: invoice.sentAt || null
    };
    try {
      const existing = await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(invoice.invoiceNumber)}&select=id`);
      if (existing?.length) await sbRequest(`invoices?invoice_number=eq.${encodeURIComponent(invoice.invoiceNumber)}`, { method: "PATCH", body });
      else await sbRequest("invoices", { method: "POST", body });
      return { saved: true };
    } catch (error) {
      return { saved: false, reason: error.message || "Supabase invoice save failed" };
    }
  }

  async function persistInvoice(quote, invoice, email = "", markSent = false) {
    const next = { ...invoice, status: markSent ? "Sent" : (invoice.status || "Unpaid"), sentAt: markSent ? new Date().toISOString() : invoice.sentAt };
    next.html = invoiceHtml(quote, next, email);
    const rows = invoices().filter((entry) => entry.invoiceNumber !== next.invoiceNumber && String(entry.quoteId) !== String(quote.id));
    rows.unshift(next);
    writeJson(invoiceStoreKey, rows);
    await saveInvoiceToSupabase(next);
    if (quote.status !== "Accepted" && typeof updateQuote === "function") updateQuote(quote.id, { status: "Accepted" });
    if (typeof window.wesetRepairBusinessChain === "function") window.wesetRepairBusinessChain();
    if (typeof window.wesetRefreshAccountingReports === "function") window.wesetRefreshAccountingReports();
    if (typeof render === "function") render();
    return next;
  }

  function recordQuoteSend(quote, email) {
    const rows = readJson(quoteSendStoreKey, []);
    rows.unshift({ id: crypto.randomUUID(), quoteId: quote.id, clientId: quote.clientId, sentAt: new Date().toISOString(), to: email, total: Number(totalsForQuote(quote).total || 0) });
    writeJson(quoteSendStoreKey, rows.slice(0, 500));
  }

  async function sendPayload(payload) {
    const auth = token();
    if (!auth) throw new Error("Email sender is missing the Supabase token. Refresh and sign in again.");
    const response = await fetch(edgeFunctionUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
    return data;
  }

  function quoteEmailHtml(quote, email) {
    const client = clientById(quote.clientId);
    const totals = totalsForQuote(quote);
    const pdf = typeof window.wesetQuoteInvoiceHtml === "function" ? window.wesetQuoteInvoiceHtml(quote) : invoiceHtml(quote, buildInvoiceFromForm(quote, { invoiceNumber: quoteRef(quote), invoiceDate: today(), dueDate: "", terms: "Quote", notes: "" }), email);
    const html = `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;"><div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #d9e0e1;border-radius:8px;overflow:hidden;"><div style="background:#145c58;color:#fff;padding:22px 26px;"><img src="https://dirnfeldh-code.github.io/Weset/assets/weset-logo-live.jpg" alt="WeSet" style="display:block;max-width:190px;background:#fff;border-radius:6px;padding:4px;margin-bottom:16px;"><h1 style="margin:0;">Quote ${esc(quoteRef(quote))}</h1></div><div style="padding:24px 26px;"><p>Hello ${esc(client.contact || "")},</p><p>Please find your WeSet quote attached.</p><p><strong>Total quoted:</strong> ${moneyText(totals.total)}</p><p>Kind regards,<br>WeSet</p></div></div></div>`;
    return { html, pdf };
  }

  function ensureSendQuoteDialog() {
    let dialog = document.querySelector("#stageSendQuoteDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "stageSendQuoteDialog";
    dialog.className = "stage-dialog";
    dialog.innerHTML = `<div class="stage-dialog-card"><div class="stage-dialog-head"><div><h2>Send quote</h2><p>Check the real quote data and choose the email address.</p></div><button class="icon-btn" data-stage-close type="button" aria-label="Close">x</button></div><div class="stage-dialog-body"><section class="stage-dialog-panel"><div class="stage-form-grid"><label class="span-2">Send to email<input id="stageQuoteEmail" type="email"></label><label class="span-2">Subject<input id="stageQuoteSubject"></label><label class="span-2">Message<textarea id="stageQuoteMessage"></textarea></label></div><div class="stage-warning" id="stageQuoteWarning" hidden></div></section><section class="stage-dialog-panel"><strong>Quote preview</strong><div class="stage-preview"><div class="stage-preview-inner" id="stageQuotePreview"></div></div></section></div><div class="stage-dialog-actions"><button class="secondary" data-stage-close type="button">Cancel</button><button class="primary" id="stageQuoteSendBtn" type="button">Send quote</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll("[data-stage-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
    dialog.querySelector("#stageQuoteEmail")?.addEventListener("input", updateQuotePreview);
    dialog.querySelector("#stageQuoteMessage")?.addEventListener("input", updateQuotePreview);
    dialog.querySelector("#stageQuoteSubject")?.addEventListener("input", updateQuotePreview);
    dialog.querySelector("#stageQuoteSendBtn")?.addEventListener("click", sendCurrentQuote);
    return dialog;
  }

  function openSendQuote(id) {
    const quote = quoteById(id);
    if (!quote) return;
    const client = clientById(quote.clientId);
    const dialog = ensureSendQuoteDialog();
    dialog.dataset.quoteId = quote.id;
    dialog.querySelector("#stageQuoteEmail").value = client.email || "";
    dialog.querySelector("#stageQuoteSubject").value = `WeSet quote ${quoteRef(quote)}`;
    dialog.querySelector("#stageQuoteMessage").value = `Hello ${client.contact || ""},\n\nPlease find your WeSet quote attached.\n\nKind regards,\nWeSet`;
    updateQuotePreview();
    dialog.showModal();
  }

  function updateQuotePreview() {
    const dialog = document.querySelector("#stageSendQuoteDialog");
    if (!dialog) return;
    const quote = quoteById(dialog.dataset.quoteId);
    if (!quote) return;
    const email = dialog.querySelector("#stageQuoteEmail")?.value.trim() || "";
    const parts = quoteEmailHtml(quote, email);
    dialog.querySelector("#stageQuotePreview").innerHTML = parts.pdf;
    const warning = dialog.querySelector("#stageQuoteWarning");
    warning.hidden = Boolean(email);
    warning.textContent = email ? "" : "Add the client email before sending.";
  }

  async function sendCurrentQuote() {
    const dialog = document.querySelector("#stageSendQuoteDialog");
    const quote = quoteById(dialog?.dataset.quoteId);
    if (!quote) return;
    const email = dialog.querySelector("#stageQuoteEmail")?.value.trim() || "";
    if (!email) return alert("Add the email address before sending the quote.");
    const subject = dialog.querySelector("#stageQuoteSubject")?.value.trim() || `WeSet quote ${quoteRef(quote)}`;
    const message = dialog.querySelector("#stageQuoteMessage")?.value.trim() || "Please find your quote attached.";
    const parts = quoteEmailHtml(quote, email);
    const button = dialog.querySelector("#stageQuoteSendBtn");
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "Sending...";
    try {
      await sendPayload({ quoteId: quote.id, to: email, subject, text: message, html: parts.html, reference: quoteRef(quote), invoiceHtml: parts.pdf });
      recordQuoteSend(quote, email);
      if (typeof updateQuote === "function") updateQuote(quote.id, { status: "Sent" });
      dialog.close();
      alert(`Quote ${quoteRef(quote)} sent to ${email}.`);
    } catch (error) {
      alert(`Could not send quote yet: ${error.message || "Please check the email setup."}`);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function ensureInvoiceDialog() {
    let dialog = document.querySelector("#stageInvoiceDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "stageInvoiceDialog";
    dialog.className = "stage-dialog";
    dialog.innerHTML = `<div class="stage-dialog-card"><div class="stage-dialog-head"><div><h2>Create invoice</h2><p>Enter the real invoice details before it appears in reports.</p></div><button class="icon-btn" data-stage-close type="button" aria-label="Close">x</button></div><div class="stage-dialog-body"><section class="stage-dialog-panel"><div class="stage-form-grid"><label>Invoice number<input id="stageInvoiceNumber"></label><label>Invoice date<input id="stageInvoiceDate" type="date"></label><label>Due date<input id="stageInvoiceDueDate" type="date"></label><label>Terms<select id="stageInvoiceTerms"><option>Net 7</option><option selected>Net 15</option><option>Net 30</option><option>Due on receipt</option></select></label><label class="span-2">Send to email<input id="stageInvoiceEmail" type="email"></label><label class="span-2">Invoice notes<textarea id="stageInvoiceNotes"></textarea></label></div><div class="stage-warning" id="stageInvoiceWarning" hidden></div></section><section class="stage-dialog-panel"><strong>Invoice preview</strong><div class="stage-preview"><div class="stage-preview-inner" id="stageInvoicePreview"></div></div></section></div><div class="stage-dialog-actions"><button class="secondary" data-stage-close type="button">Cancel</button><button class="secondary" id="stageInvoiceSaveBtn" type="button">Save</button><button class="secondary" id="stageInvoicePrintBtn" type="button">Save and print PDF</button><button class="primary" id="stageInvoiceSendBtn" type="button">Save and send</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll("[data-stage-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
    ["#stageInvoiceNumber", "#stageInvoiceDate", "#stageInvoiceDueDate", "#stageInvoiceTerms", "#stageInvoiceEmail", "#stageInvoiceNotes"].forEach((selector) => dialog.querySelector(selector)?.addEventListener("input", updateInvoicePreview));
    dialog.querySelector("#stageInvoiceSaveBtn")?.addEventListener("click", () => saveCurrentInvoice("save"));
    dialog.querySelector("#stageInvoicePrintBtn")?.addEventListener("click", () => saveCurrentInvoice("print"));
    dialog.querySelector("#stageInvoiceSendBtn")?.addEventListener("click", () => saveCurrentInvoice("send"));
    return dialog;
  }

  function openInvoice(id) {
    const quote = quoteById(id);
    if (!quote) return;
    const client = clientById(quote.clientId);
    const existing = invoiceForQuote(quote.id);
    const dialog = ensureInvoiceDialog();
    dialog.dataset.quoteId = quote.id;
    dialog.querySelector("#stageInvoiceNumber").value = existing?.invoiceNumber || invoiceNumber(quote);
    dialog.querySelector("#stageInvoiceDate").value = String(existing?.createdAt || today()).slice(0, 10);
    dialog.querySelector("#stageInvoiceDueDate").value = existing?.dueDate || addDays(15);
    dialog.querySelector("#stageInvoiceTerms").value = existing?.terms || "Net 15";
    dialog.querySelector("#stageInvoiceEmail").value = client.email || "";
    dialog.querySelector("#stageInvoiceNotes").value = existing?.notes || "";
    updateInvoicePreview();
    dialog.showModal();
  }

  function currentInvoiceForm(dialog) {
    return {
      invoiceNumber: dialog.querySelector("#stageInvoiceNumber")?.value.trim() || "",
      invoiceDate: dialog.querySelector("#stageInvoiceDate")?.value || today(),
      dueDate: dialog.querySelector("#stageInvoiceDueDate")?.value || "",
      terms: dialog.querySelector("#stageInvoiceTerms")?.value || "Net 15",
      email: dialog.querySelector("#stageInvoiceEmail")?.value.trim() || "",
      notes: dialog.querySelector("#stageInvoiceNotes")?.value.trim() || ""
    };
  }

  function updateInvoicePreview() {
    const dialog = document.querySelector("#stageInvoiceDialog");
    if (!dialog) return;
    const quote = quoteById(dialog.dataset.quoteId);
    if (!quote) return;
    const form = currentInvoiceForm(dialog);
    const invoice = buildInvoiceFromForm(quote, form);
    invoice.html = invoiceHtml(quote, invoice, form.email);
    dialog.querySelector("#stageInvoicePreview").innerHTML = invoice.html;
    const warning = dialog.querySelector("#stageInvoiceWarning");
    warning.hidden = Boolean(form.invoiceNumber);
    warning.textContent = form.invoiceNumber ? "" : "Add an invoice number before saving.";
  }

  async function saveCurrentInvoice(mode) {
    const dialog = document.querySelector("#stageInvoiceDialog");
    const quote = quoteById(dialog?.dataset.quoteId);
    if (!quote) return;
    const form = currentInvoiceForm(dialog);
    if (!form.invoiceNumber) return alert("Add an invoice number before saving.");
    if (mode === "send" && !form.email) return alert("Add the email address before sending the invoice.");
    const invoice = buildInvoiceFromForm(quote, form);
    const button = mode === "send" ? dialog.querySelector("#stageInvoiceSendBtn") : mode === "print" ? dialog.querySelector("#stageInvoicePrintBtn") : dialog.querySelector("#stageInvoiceSaveBtn");
    const old = button.textContent;
    button.disabled = true;
    button.textContent = mode === "send" ? "Saving and sending..." : "Saving...";
    try {
      const saved = await persistInvoice(quote, invoice, form.email, mode === "send");
      if (mode === "send") {
        await sendPayload({ quoteId: quote.id, to: form.email, subject: `WeSet invoice ${saved.invoiceNumber}`, text: `Please find invoice ${saved.invoiceNumber} attached. Total due: ${moneyText(saved.total)}`, html: saved.html, reference: saved.invoiceNumber, invoiceHtml: saved.html });
        alert(`Invoice ${saved.invoiceNumber} saved and sent to ${form.email}.`);
      } else if (mode === "print") {
        alert(`Invoice ${saved.invoiceNumber} saved. The print window will open now.`);
        setTimeout(() => window.print(), 250);
      } else {
        alert(`Invoice ${saved.invoiceNumber} saved.`);
      }
      dialog.close();
    } catch (error) {
      alert(`Could not save invoice yet: ${error.message || "Please try again."}`);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function replaceButtons() {
    document.querySelectorAll("[data-send-in-app]").forEach((button) => {
      button.dataset.stageSendQuote = button.dataset.sendInApp;
      button.removeAttribute("data-send-in-app");
      button.textContent = "Send quote";
      button.classList.add("primary");
    });
    document.querySelectorAll("[data-send-quote]").forEach((button) => {
      button.classList.add("stage-hidden");
      button.removeAttribute("data-send-quote");
    });
    document.querySelectorAll("[data-invoice-quote]").forEach((button) => {
      button.dataset.stageInvoiceQuote = button.dataset.invoiceQuote;
      button.removeAttribute("data-invoice-quote");
      const quote = quoteById(button.dataset.stageInvoiceQuote);
      button.textContent = invoiceForQuote(button.dataset.stageInvoiceQuote) ? "Open invoice" : "Create invoice";
      button.disabled = quote && !["Accepted", "Sent"].includes(quote.status || "Draft") && !invoiceForQuote(quote.id);
      if (button.disabled) button.title = "Mark the quote accepted before creating the invoice.";
    });
    document.querySelectorAll("[data-status]").forEach((button) => {
      const [quoteId, status] = String(button.dataset.status || "").split(":");
      const quote = quoteById(quoteId);
      const hasInvoice = Boolean(invoiceForQuote(quoteId));
      if (status === "Sent") button.remove();
      if (hasInvoice && ["Accepted", "Declined"].includes(status)) button.remove();
      if (status === "Accepted") button.textContent = "Mark accepted";
      if (status === "Declined") button.textContent = "Decline";
      if (quote?.status === status) button.remove();
    });
    document.querySelectorAll(".quote-card").forEach((card) => {
      if (card.querySelector(".stage-note")) return;
      const invoiceButton = card.querySelector("[data-stage-invoice-quote]");
      const quote = quoteById(invoiceButton?.dataset.stageInvoiceQuote || "");
      if (!quote) return;
      const note = document.createElement("p");
      note.className = "stage-note";
      note.textContent = invoiceForQuote(quote.id)
        ? "This quote has an invoice. Accepted/declined buttons are closed for this quote."
        : "Quote totals stay in pipeline only. Reports start when you create the real invoice.";
      (card.querySelector(".quote-record-actions") || card.querySelector(".card-actions") || card).appendChild(note);
    });
  }

  function scheduleTidy(delay = 0) {
    if (tidyQueued) return;
    tidyQueued = true;
    setTimeout(() => {
      tidyQueued = false;
      ensureStyles();
      replaceButtons();
    }, delay);
  }

  document.addEventListener("click", (event) => {
    const sendQuote = event.target.closest?.("[data-stage-send-quote]");
    const invoice = event.target.closest?.("[data-stage-invoice-quote]");
    if (sendQuote) {
      event.preventDefault();
      event.stopPropagation();
      openSendQuote(sendQuote.dataset.stageSendQuote);
    }
    if (invoice) {
      event.preventDefault();
      event.stopPropagation();
      const quote = quoteById(invoice.dataset.stageInvoiceQuote);
      if (quote && !["Accepted", "Sent"].includes(quote.status || "Draft") && !invoiceForQuote(quote.id)) {
        alert("Mark the quote accepted before creating an invoice. A quote is only pipeline until it is accepted.");
        return;
      }
      openInvoice(invoice.dataset.stageInvoiceQuote);
    }
    scheduleTidy(250);
  }, true);

  const oldRender = typeof render === "function" ? render : null;
  if (oldRender) render = function renderWithQuoteStages(...args) { const result = oldRender.apply(this, args); scheduleTidy(0); return result; };
  const oldRenderQuotes = typeof renderQuotes === "function" ? renderQuotes : null;
  if (oldRenderQuotes) renderQuotes = function renderQuotesWithQuoteStages(...args) { const result = oldRenderQuotes.apply(this, args); scheduleTidy(0); return result; };
  const observer = new MutationObserver(() => scheduleTidy(100));
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleTidy(500);
})();
