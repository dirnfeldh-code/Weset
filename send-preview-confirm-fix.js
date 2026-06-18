(() => {
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const style = document.createElement("style");
  style.textContent = `
    .send-preview-dialog {
      border: 0 !important;
      border-radius: 8px !important;
      max-height: min(96dvh, calc(100vh - 16px)) !important;
      max-width: min(1160px, calc(100vw - 16px)) !important;
      padding: 0 !important;
      width: min(1160px, calc(100vw - 16px)) !important;
    }
    .send-preview-card {
      background: #fff;
      border-radius: 8px;
      display: grid;
      gap: 0;
      max-height: min(96dvh, calc(100vh - 16px));
      overflow: hidden;
    }
    .send-preview-head,
    .send-preview-actions {
      align-items: center;
      background: #fff;
      display: flex;
      gap: 10px;
      justify-content: space-between;
      padding: 14px 16px;
    }
    .send-preview-head {
      border-bottom: 1px solid var(--line, #d9e0e1);
    }
    .send-preview-head h2 {
      font-size: 18px;
      margin: 0;
    }
    .send-preview-head p {
      color: var(--muted, #687478);
      margin: 4px 0 0;
    }
    .send-preview-body {
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
      max-height: calc(96dvh - 138px);
      overflow: auto;
      padding: 16px;
    }
    .send-preview-panel {
      border: 1px solid var(--line, #d9e0e1);
      border-radius: 8px;
      display: grid;
      gap: 10px;
      min-width: 0;
      overflow: hidden;
    }
    .send-preview-panel h3 {
      background: #f8fbfa;
      border-bottom: 1px solid var(--line, #d9e0e1);
      font-size: 14px;
      margin: 0;
      padding: 10px 12px;
    }
    .send-preview-meta {
      display: grid;
      gap: 8px;
      padding: 12px;
    }
    .send-preview-meta div {
      display: grid;
      gap: 3px;
    }
    .send-preview-meta span {
      color: var(--muted, #687478);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .send-preview-meta strong,
    .send-preview-meta p {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .send-preview-email,
    .send-preview-attachment {
      background: #eef5f4;
      max-height: 58dvh;
      overflow: auto;
      padding: 12px;
    }
    .send-preview-email-frame,
    .send-preview-attachment-frame {
      background: #fff;
      border: 1px solid #d9e0e1;
      border-radius: 8px;
      box-shadow: 0 8px 22px rgba(18, 35, 39, 0.08);
      margin: 0 auto;
      max-width: 760px;
      overflow: hidden;
    }
    .send-preview-attachment-frame {
      padding: 0;
    }
    .send-preview-text {
      background: #fff;
      border: 1px solid #d9e0e1;
      border-radius: 8px;
      color: #1d2528;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
      margin: 0;
      padding: 14px;
      white-space: pre-wrap;
    }
    .send-preview-warning {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      color: #7c2d12;
      font-weight: 700;
      margin: 0;
      padding: 10px 12px;
    }
    .send-preview-actions {
      border-top: 1px solid var(--line, #d9e0e1);
      flex-wrap: wrap;
    }
    .send-preview-actions button {
      min-height: 36px;
    }
    .send-preview-confirm[disabled] {
      cursor: wait !important;
      opacity: 0.72 !important;
    }
    @media (max-width: 760px) {
      .send-preview-dialog {
        border-radius: 0 !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        max-width: 100vw !important;
        width: 100vw !important;
      }
      .send-preview-card {
        border-radius: 0;
        height: 100dvh;
        max-height: 100dvh;
      }
      .send-preview-body {
        grid-template-columns: 1fr;
        max-height: calc(100dvh - 152px);
        padding: 12px;
      }
      .send-preview-email,
      .send-preview-attachment {
        max-height: none;
      }
      .send-preview-actions {
        align-items: stretch;
        display: grid;
        grid-template-columns: 1fr;
      }
      .send-preview-actions button {
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

  function invoiceNumber(quote) {
    return `INV-${quoteRef(quote).replace(/^Q-?/i, "")}`;
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

  function quoteItemsSafe(quote) {
    if (typeof quoteItems === "function") return quoteItems(quote);
    return quote.items || [];
  }

  function fallbackQuoteEmailPayload(quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const items = quoteItemsSafe(quote);
    const lines = items.map((item) => `- ${item.quantity || 1} x ${item.name || "Item"} at ${moneyText(item.unitCost || 0)}`).join("\n");
    const reference = quoteRef(quote);
    const text = `Hello ${client.contact || ""},\n\nThank you for asking WeSet to quote for your office setup.\n\nQuote reference: ${reference}\nSetup address: ${quote.premises || ""}\nRequired date: ${dateText(quote.requiredDate)}\n\nItems:\n${lines || "Items listed in the quote."}\n\nSubtotal: ${moneyText(totals.subtotal)}\nVAT: ${moneyText(totals.vatAmount)}\nTotal estimate: ${moneyText(totals.total)}\n\nKind regards,\nWeSet`;
    return { to: client.email || "", subject: `WeSet quote ${reference}`, text, html: "", reference };
  }

  function quoteEmailPayload(quote) {
    const client = getClientSafe(quote);
    const payload = typeof window.wesetQuoteEmailPayload === "function" ? window.wesetQuoteEmailPayload(quote) : fallbackQuoteEmailPayload(quote);
    return { ...payload, to: payload.to || client.email || "" };
  }

  function attachmentHtml(quote) {
    if (typeof window.wesetQuoteInvoiceHtml === "function") return window.wesetQuoteInvoiceHtml(quote);
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    return `<div style="font-family:Arial,Helvetica,sans-serif;padding:24px;color:#1d2528;"><h1>${escapeHtml(quoteRef(quote))}</h1><p>${escapeHtml(client.company || client.contact || "Client")}</p><p>Total: ${moneyText(totals.total)}</p></div>`;
  }

  function designedQuoteEmail(quote, payload) {
    if (payload.html) return payload.html;
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e0e1;">
        <div style="background:#145c58;color:#ffffff;padding:22px 26px;">
          <img src="https://dirnfeldh-code.github.io/Weset/assets/weset-logo-live.jpg" alt="WeSet" style="display:block;max-width:190px;background:#ffffff;border-radius:6px;padding:4px;margin-bottom:16px;">
          <h1 style="margin:0;font-size:26px;">Quote ${escapeHtml(quoteRef(quote))}</h1>
          <p style="margin:8px 0 0;">For ${escapeHtml(client.company || client.contact || "your office setup")}</p>
        </div>
        <div style="padding:24px 26px;">
          <p>Hello ${escapeHtml(client.contact || "")},</p>
          <p>Your WeSet quote is ready. The detailed PDF-style attachment is included with this email.</p>
          <div style="background:#e8f3f1;border-radius:8px;padding:16px;margin:18px 0;">
            <p style="margin:0 0 6px;"><strong>Setup address:</strong> ${escapeHtml(quote.premises || "")}</p>
            <p style="margin:0 0 6px;"><strong>Required date:</strong> ${escapeHtml(dateText(quote.requiredDate))}</p>
            <p style="margin:0;"><strong>Total estimate:</strong> ${moneyText(totals.total)}</p>
          </div>
          <p>Kind regards,<br>WeSet</p>
        </div>
      </div>
    </div>`;
  }

  function invoiceRecord(quote) {
    const totals = totalsForQuote(quote);
    return {
      invoiceNumber: invoiceNumber(quote),
      subtotal: Number(totals.subtotal || 0),
      vatEnabled: Boolean(totals.vatEnabled),
      vatRate: Number(totals.vatRate || 0),
      vatAmount: Number(totals.vatAmount || 0),
      total: Number(totals.total || 0),
      html: attachmentHtml(quote)
    };
  }

  function invoiceEmailPayload(quote) {
    const client = getClientSafe(quote);
    const record = invoiceRecord(quote);
    const html = `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
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
    const text = `Hello ${client.contact || ""},\n\nYour WeSet invoice ${record.invoiceNumber} is ready.\n\nQuote: ${quoteRef(quote)}\nSetup address: ${quote.premises || ""}\nSubtotal: ${moneyText(record.subtotal)}\nVAT: ${moneyText(record.vatAmount)}\nTotal due: ${moneyText(record.total)}\n\nThe invoice is attached.\n\nKind regards,\nWeSet`;
    return { to: client.email || "", subject: `WeSet invoice ${record.invoiceNumber}`, text, html, reference: record.invoiceNumber, invoiceHtml: record.html };
  }

  function functionToken() {
    if (typeof sbAnonKey !== "undefined" && sbAnonKey) return sbAnonKey;
    try { return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || ""; } catch { return ""; }
  }

  function ensureDialog() {
    let dialog = document.querySelector("#sendPreviewDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "sendPreviewDialog";
    dialog.className = "send-preview-dialog";
    dialog.innerHTML = `<div class="send-preview-card">
      <div class="send-preview-head">
        <div><h2 id="sendPreviewTitle">Preview before sending</h2><p id="sendPreviewSub">Check what the client will receive.</p></div>
        <button class="icon-btn" id="sendPreviewClose" type="button" aria-label="Close">x</button>
      </div>
      <div class="send-preview-body">
        <section class="send-preview-panel"><h3>Email details</h3><div class="send-preview-meta" id="sendPreviewMeta"></div></section>
        <section class="send-preview-panel"><h3>Email design preview</h3><div class="send-preview-email"><div class="send-preview-email-frame" id="sendPreviewEmail"></div></div></section>
        <section class="send-preview-panel" style="grid-column:1 / -1;"><h3>Attached PDF preview</h3><div class="send-preview-attachment"><div class="send-preview-attachment-frame" id="sendPreviewAttachment"></div></div></section>
      </div>
      <div class="send-preview-actions">
        <button class="secondary" id="sendPreviewCancel" type="button">Go back</button>
        <button class="primary send-preview-confirm" id="sendPreviewConfirm" type="button">Confirm & send</button>
      </div>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#sendPreviewClose")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("#sendPreviewCancel")?.addEventListener("click", () => dialog.close());
    return dialog;
  }

  function fillPreview(type, quote, payload) {
    const dialog = ensureDialog();
    const client = getClientSafe(quote);
    const isInvoice = type === "invoice";
    const title = isInvoice ? "Preview invoice email" : "Preview quote email";
    const sub = isInvoice ? "This is the invoice email and attachment before it goes to the client." : "This is the quote email and attachment before it goes to the client.";
    dialog.querySelector("#sendPreviewTitle").textContent = title;
    dialog.querySelector("#sendPreviewSub").textContent = sub;
    dialog.querySelector("#sendPreviewMeta").innerHTML = `${!payload.to ? `<p class="send-preview-warning">This client has no email address saved. Add the email before sending.</p>` : ""}
      <div><span>To</span><strong>${escapeHtml(payload.to || "Missing client email")}</strong></div>
      <div><span>Client</span><strong>${escapeHtml(client.company || client.contact || "Client")}</strong></div>
      <div><span>Subject</span><strong>${escapeHtml(payload.subject || "")}</strong></div>
      <div><span>Reference</span><strong>${escapeHtml(payload.reference || quoteRef(quote))}</strong></div>
      <div><span>What will be attached</span><p>${isInvoice ? "Designed invoice PDF" : "Designed quote PDF"}</p></div>`;
    const html = payload.html || `<pre class="send-preview-text">${escapeHtml(payload.text || "")}</pre>`;
    dialog.querySelector("#sendPreviewEmail").innerHTML = html;
    dialog.querySelector("#sendPreviewAttachment").innerHTML = payload.invoiceHtml || attachmentHtml(quote);
    const confirm = dialog.querySelector("#sendPreviewConfirm");
    confirm.textContent = isInvoice ? "Confirm & send invoice" : "Confirm & send quote";
    confirm.dataset.previewType = type;
    confirm.dataset.previewQuote = quote.id;
    confirm.disabled = !payload.to;
    return dialog;
  }

  async function sendQuoteAfterPreview(id, button = null) {
    const quote = getQuote(id);
    if (!quote) return;
    const rawPayload = quoteEmailPayload(quote);
    const payload = { ...rawPayload, html: designedQuoteEmail(quote, rawPayload), invoiceHtml: attachmentHtml(quote) };
    const token = functionToken();
    if (!token) throw new Error("The email sender is missing the Supabase anon token. Refresh the app and try again.");
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quoteId: quote.id, to: payload.to, subject: payload.subject, text: payload.text, html: payload.html, reference: payload.reference, invoiceHtml: payload.invoiceHtml })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
    if (typeof updateQuote === "function") await updateQuote(quote.id, { status: "Sent" });
  }

  async function confirmAndSend(dialog) {
    const confirm = dialog.querySelector("#sendPreviewConfirm");
    const type = confirm.dataset.previewType;
    const id = confirm.dataset.previewQuote;
    const oldText = confirm.textContent;
    confirm.disabled = true;
    confirm.textContent = type === "invoice" ? "Sending invoice..." : "Sending quote...";
    try {
      if (type === "invoice" && typeof window.wesetSendInvoice === "function") {
        await window.wesetSendInvoice(id, confirm);
      } else {
        await sendQuoteAfterPreview(id, confirm);
        const quote = getQuote(id);
        const client = quote ? getClientSafe(quote) : {};
        alert(`Quote email sent to ${client.email || "the client"}.`);
      }
      dialog.close();
      if (typeof render === "function") render();
    } catch (error) {
      alert(`Could not send yet: ${error.message || "Please check the email setup and try again."}`);
    } finally {
      confirm.disabled = false;
      confirm.textContent = oldText;
    }
  }

  function openPreview(type, id) {
    const quote = getQuote(id);
    if (!quote) return;
    const quotePayload = type === "invoice" ? invoiceEmailPayload(quote) : quoteEmailPayload(quote);
    const payload = type === "invoice"
      ? quotePayload
      : { ...quotePayload, html: designedQuoteEmail(quote, quotePayload), invoiceHtml: attachmentHtml(quote) };
    const dialog = fillPreview(type, quote, payload);
    dialog.showModal();
  }

  window.addEventListener("click", (event) => {
    const quoteButton = event.target.closest?.("[data-send-in-app]");
    const invoiceButton = event.target.closest?.("[data-send-invoice]");
    if (!quoteButton && !invoiceButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const type = invoiceButton ? "invoice" : "quote";
    const id = invoiceButton?.dataset.sendInvoice || quoteButton?.dataset.sendInApp;
    openPreview(type, id);
  }, true);

  document.addEventListener("click", (event) => {
    const confirm = event.target.closest?.("#sendPreviewConfirm");
    if (!confirm) return;
    event.preventDefault();
    const dialog = document.querySelector("#sendPreviewDialog");
    if (dialog) confirmAndSend(dialog);
  });

  window.wesetOpenSendPreview = openPreview;
})();
