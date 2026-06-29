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
    .send-preview-dialog { border:0 !important; border-radius:8px !important; max-height:min(96dvh,calc(100vh - 16px)) !important; max-width:min(1160px,calc(100vw - 16px)) !important; padding:0 !important; width:min(1160px,calc(100vw - 16px)) !important; }
    .send-preview-card { background:#fff; border-radius:8px; display:grid; max-height:min(96dvh,calc(100vh - 16px)); overflow:hidden; }
    .send-preview-head,.send-preview-actions { align-items:center; background:#fff; display:flex; gap:10px; justify-content:space-between; padding:14px 16px; }
    .send-preview-head { border-bottom:1px solid var(--line,#d9e0e1); }
    .send-preview-head h2 { font-size:18px; margin:0; }
    .send-preview-head p { color:var(--muted,#687478); margin:4px 0 0; }
    .send-preview-body { display:grid; gap:14px; grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr); max-height:calc(96dvh - 138px); overflow:auto; padding:16px; }
    .send-preview-panel { border:1px solid var(--line,#d9e0e1); border-radius:8px; display:grid; gap:10px; min-width:0; overflow:hidden; }
    .send-preview-panel h3 { background:#f8fbfa; border-bottom:1px solid var(--line,#d9e0e1); font-size:14px; margin:0; padding:10px 12px; }
    .send-preview-meta { display:grid; gap:8px; padding:12px; }
    .send-preview-meta div { display:grid; gap:3px; }
    .send-preview-meta span { color:var(--muted,#687478); font-size:11px; font-weight:800; text-transform:uppercase; }
    .send-preview-meta strong,.send-preview-meta p { margin:0; overflow-wrap:anywhere; }
    .send-preview-email,.send-preview-attachment { background:#eef5f4; max-height:58dvh; overflow:auto; padding:12px; }
    .send-preview-email-frame,.send-preview-attachment-frame { background:#fff; border:1px solid #d9e0e1; border-radius:8px; box-shadow:0 8px 22px rgba(18,35,39,.08); margin:0 auto; max-width:760px; overflow:hidden; }
    .send-preview-warning { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; color:#7c2d12; font-weight:700; margin:0; padding:10px 12px; }
    .send-preview-actions { border-top:1px solid var(--line,#d9e0e1); flex-wrap:wrap; }
    .send-preview-actions button { min-height:36px; }
    .send-preview-confirm[disabled] { cursor:wait !important; opacity:.72 !important; }
    @media (max-width:760px) {
      .send-preview-dialog { border-radius:0 !important; height:100dvh !important; max-height:100dvh !important; max-width:100vw !important; width:100vw !important; }
      .send-preview-card { border-radius:0; height:100dvh; max-height:100dvh; }
      .send-preview-body { grid-template-columns:1fr; max-height:calc(100dvh - 152px); padding:12px; }
      .send-preview-email,.send-preview-attachment { max-height:none; }
      .send-preview-actions { align-items:stretch; display:grid; grid-template-columns:1fr; }
      .send-preview-actions button { width:100%; }
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

  function getQuote(id) {
    return (state.quotes || []).find((entry) => entry.id === id);
  }

  function getClientSafe(quote) {
    return (state.clients || []).find((client) => client.id === quote?.clientId)
      || (typeof getClient === "function" ? getClient(quote?.clientId) : null)
      || { company: "Client", contact: "", email: "" };
  }

  function moneyText(value) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function companyDetails() {
    if (typeof window.wesetGetCompanyDetails === "function") return window.wesetGetCompanyDetails();
    return window.wesetCompanyDetails || { name: "WeSet", address1: "", address2: "", vat: "", email: "", phone: "", terms: "Net 15" };
  }

  function quoteDetails(kind, quote) {
    const saved = typeof window.wesetGetQuoteDocumentDetails === "function"
      ? window.wesetGetQuoteDocumentDetails(kind, quote)
      : null;
    let rows = Array.isArray(saved?.rows) ? saved.rows.filter((row) => row?.product || Number(row?.rate || 0)) : [];
    if (!rows.length) {
      rows = (Array.isArray(quote?.items) ? quote.items : []).map((item) => ({
        product: item.name || "Item or service",
        description: item.documentDescription || item.description || item.notes || quote.notes || quote.premises || "",
        qty: Number(item.quantity || 1),
        rate: Number(item.unitCost || 0),
        vat: ""
      }));
    }

    const vat = typeof window.wesetQuoteTotals === "function" ? window.wesetQuoteTotals(quote) : {};
    const storedSubtotal = Number(quote?.supplyTotal || 0) + Number(quote?.servicesTotal || 0) || Number(quote?.storedTotal || 0);
    if (!rows.length && storedSubtotal) {
      rows = [{
        product: "Quoted office setup",
        description: quote.notes || `Office setup for ${quote.premises || "client site"}`,
        qty: 1,
        rate: storedSubtotal,
        vat: ""
      }];
    }

    const subtotal = rows.reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.rate || 0), 0);
    const vatEnabled = saved ? !/^includes vat @ 0%$/i.test(String(saved.vatLabel || "")) : Boolean(vat.vatEnabled);
    const vatRate = Number(vat.vatRate || String(saved?.vatLabel || "").match(/[\d.]+/)?.[0] || 0);
    const vatAmount = saved?.vatAmount != null ? Number(saved.vatAmount || 0) : (vatEnabled ? subtotal * vatRate / 100 : 0);
    const reference = saved?.reference || (kind === "Invoice" ? `INV-${quoteRef(quote).replace(/^Q-?/i, "")}` : quoteRef(quote));
    return {
      reference,
      issueDate: saved?.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: saved?.dueDate || quote.requiredDate || "",
      billTo: saved?.billTo || "",
      shipTo: saved?.shipTo || quote.premises || "",
      rows,
      subtotal,
      vatRate,
      vatAmount,
      total: subtotal + vatAmount,
      vatLabel: saved?.vatLabel || `VAT @ ${vatEnabled ? vatRate : 0}%`
    };
  }

  function structuredText(kind, quote, details, client) {
    const company = companyDetails();
    const billTo = String(details.billTo || "").split("\n");
    return [
      `DOC_TYPE: ${kind}`,
      `REFERENCE: ${details.reference}`,
      `QUOTE_REF: ${quoteRef(quote)}`,
      `DATE: ${details.issueDate}`,
      `DUE_DATE: ${details.dueDate}`,
      `FROM_COMPANY: ${company.name || "WeSet"}`,
      `FROM_ADDRESS1: ${company.address1 || ""}`,
      `FROM_ADDRESS2: ${company.address2 || ""}`,
      `FROM_VAT: ${company.vat || ""}`,
      `FROM_EMAIL: ${company.email || ""}`,
      `FROM_PHONE: ${company.phone || ""}`,
      `TERMS: ${company.terms || "Net 15"}`,
      `CLIENT_COMPANY: ${billTo[0] || client.company || client.contact || "Client"}`,
      `CLIENT_CONTACT: ${billTo[1] || client.contact || ""}`,
      `CLIENT_EMAIL: ${billTo[2] || client.email || ""}`,
      `SHIP_TO: ${String(details.shipTo || "").replace(/\n/g, ", ")}`,
      ...details.rows.map((row) => `ITEM: ${row.product || "Item or service"} | DESC: ${row.description || ""} | QTY: ${Number(row.qty || 1)} | RATE: ${moneyText(row.rate)} | AMOUNT: ${moneyText(Number(row.qty || 1) * Number(row.rate || 0))} | VAT: ${row.vat || details.vatLabel}`),
      `SUBTOTAL: ${moneyText(details.subtotal)}`,
      `VAT_LABEL: ${details.vatLabel}`,
      `VAT_AMOUNT: ${moneyText(details.vatAmount)}`,
      `TOTAL: ${moneyText(details.total)}`,
      "",
      `Hello ${client.contact || ""},`,
      `Your ${kind.toLowerCase()} ${details.reference} is ready. The PDF is attached.`,
      "Kind regards,",
      company.name || "WeSet"
    ].join("\n");
  }

  function documentHtml(kind, quote, details, client) {
    const company = companyDetails();
    const rows = details.rows.map((row, index) => `<tr>
      <td>${index + 1}</td><td><strong>${escapeHtml(row.product || "Item or service")}</strong></td>
      <td>${escapeHtml(row.description || "")}</td><td style="text-align:right">${Number(row.qty || 1)}</td>
      <td style="text-align:right">${moneyText(row.rate)}</td><td style="text-align:right">${moneyText(Number(row.qty || 1) * Number(row.rate || 0))}</td>
      <td style="text-align:right">${escapeHtml(row.vat || details.vatLabel)}</td>
    </tr>`).join("");
    return `<div style="background:#fff;color:#1d2528;font-family:Arial,Helvetica,sans-serif;margin:0 auto;max-width:900px;padding:36px 42px;">
      <div style="display:flex;justify-content:space-between;gap:24px;"><div><h1 style="color:#0d6f9f;font-size:22px;margin:0 0 10px;">${escapeHtml(kind.toUpperCase())}</h1><strong>${escapeHtml(company.name || "WeSet")}</strong><p>${escapeHtml(company.address1 || "")}<br>${escapeHtml(company.address2 || "")}<br>${escapeHtml(company.vat || "")}</p></div><div><strong>${escapeHtml(details.reference)}</strong><p>${escapeHtml(company.email || "")}<br>${escapeHtml(company.phone || "")}</p></div></div>
      <div style="background:#eaf3fb;display:grid;gap:24px;grid-template-columns:1fr 1fr;margin:20px -42px;padding:22px 42px;"><div><strong>Bill to</strong><p>${escapeHtml(client.company || client.contact || "Client")}<br>${escapeHtml(client.contact || "")}<br>${escapeHtml(client.email || "")}</p></div><div><strong>Ship to</strong><p>${escapeHtml(String(details.shipTo || "")).replace(/\n/g, "<br>")}</p></div></div>
      <table style="border-collapse:collapse;font-size:12px;width:100%;"><thead><tr><th>#</th><th>Product or service</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th>VAT</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-left:auto;margin-top:20px;width:280px;"><p style="display:flex;justify-content:space-between;"><span>Subtotal</span><strong>${moneyText(details.subtotal)}</strong></p><p style="display:flex;justify-content:space-between;"><span>${escapeHtml(details.vatLabel)}</span><strong>${moneyText(details.vatAmount)}</strong></p><p style="border-top:1px solid #ccd5d8;display:flex;font-size:17px;justify-content:space-between;padding-top:12px;"><strong>Total</strong><strong>${moneyText(details.total)}</strong></p></div>
    </div>`;
  }

  function fallbackPayload(kind, quote) {
    const client = getClientSafe(quote);
    const details = quoteDetails(kind, quote);
    const reference = details.reference;
    const html = `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;"><div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #d9e0e1;overflow:hidden;"><div style="background:#145c58;color:#fff;padding:24px 28px;"><div style="display:inline-block;background:#fff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;">WeSet</div><h1 style="margin:18px 0 0;font-size:26px;">${escapeHtml(kind)} ${escapeHtml(reference)}</h1></div><div style="padding:24px 28px;"><p>Hello ${escapeHtml(client.contact || "")},</p><p>Your WeSet ${kind.toLowerCase()} is ready. The PDF is attached.</p><p>Kind regards,<br><strong>WeSet</strong></p></div></div></div>`;
    const text = structuredText(kind, quote, details, client);
    return { to: client.email || "", subject: `WeSet ${kind.toLowerCase()} ${reference}`, text, html, reference, invoiceHtml: documentHtml(kind, quote, details, client) };
  }

  function payloadFor(kind, quote) {
    const complete = fallbackPayload(kind, quote);
    const generated = kind === "Invoice" && typeof window.wesetInvoiceEmailPayload === "function"
      ? window.wesetInvoiceEmailPayload(quote)
      : kind === "Quote" && typeof window.wesetQuoteEmailPayload === "function"
        ? window.wesetQuoteEmailPayload(quote)
        : null;
    if (!generated) return complete;
    const hasItems = /^ITEM:/im.test(String(generated.text || ""));
    return {
      ...complete,
      ...generated,
      text: hasItems ? generated.text : complete.text,
      invoiceHtml: generated.invoiceHtml || complete.invoiceHtml
    };
  }

  function token() {
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
      <div class="send-preview-head"><div><h2 id="sendPreviewTitle">Preview before sending</h2><p id="sendPreviewSub">Check what the client will receive.</p></div><button class="icon-btn" id="sendPreviewClose" type="button" aria-label="Close">x</button></div>
      <div class="send-preview-body">
        <section class="send-preview-panel"><h3>Email details</h3><div class="send-preview-meta" id="sendPreviewMeta"></div></section>
        <section class="send-preview-panel"><h3>Email design preview</h3><div class="send-preview-email"><div class="send-preview-email-frame" id="sendPreviewEmail"></div></div></section>
        <section class="send-preview-panel" style="grid-column:1 / -1;"><h3>Attached PDF preview</h3><div class="send-preview-attachment"><div class="send-preview-attachment-frame" id="sendPreviewAttachment"></div></div></section>
      </div>
      <div class="send-preview-actions"><button class="secondary" id="sendPreviewCancel" type="button">Go back</button><button class="primary send-preview-confirm" id="sendPreviewConfirm" type="button">Confirm & send</button></div>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#sendPreviewClose")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("#sendPreviewCancel")?.addEventListener("click", () => dialog.close());
    return dialog;
  }

  function openPreview(kind, id) {
    const quote = getQuote(id);
    if (!quote) return;
    const client = getClientSafe(quote);
    const payload = payloadFor(kind, quote);
    if (!/^ITEM:/im.test(String(payload.text || ""))) throw new Error("This quote has no saved items or prices. Edit the quote and add at least one item before sending it.");
    const dialog = ensureDialog();
    dialog.querySelector("#sendPreviewTitle").textContent = kind === "Invoice" ? "Preview invoice email" : "Preview quote email";
    dialog.querySelector("#sendPreviewSub").textContent = "This is what the client will receive before you confirm sending.";
    dialog.querySelector("#sendPreviewMeta").innerHTML = `${!payload.to ? `<p class="send-preview-warning">This client has no email address saved. Add the email before sending.</p>` : ""}
      <div><span>To</span><strong>${escapeHtml(payload.to || "Missing client email")}</strong></div>
      <div><span>Client</span><strong>${escapeHtml(client.company || client.contact || "Client")}</strong></div>
      <div><span>Subject</span><strong>${escapeHtml(payload.subject || "")}</strong></div>
      <div><span>Reference</span><strong>${escapeHtml(payload.reference || quoteRef(quote))}</strong></div>
      <div><span>Attachment</span><p>${kind === "Invoice" ? "Designed invoice PDF" : "Designed quote PDF"}</p></div>`;
    dialog.querySelector("#sendPreviewEmail").innerHTML = payload.html || "";
    dialog.querySelector("#sendPreviewAttachment").innerHTML = payload.invoiceHtml || payload.html || "";
    const confirm = dialog.querySelector("#sendPreviewConfirm");
    confirm.textContent = kind === "Invoice" ? "Confirm & send invoice" : "Confirm & send quote";
    confirm.dataset.kind = kind;
    confirm.dataset.quote = id;
    confirm.disabled = !payload.to;
    dialog.showModal();
  }

  async function send(kind, id, button) {
    const quote = getQuote(id);
    if (!quote) throw new Error("Quote was not found in the app.");
    const payload = payloadFor(kind, quote);
    if (!payload.to) throw new Error("This client does not have an email address saved.");
    const auth = token();
    if (!auth) throw new Error("The email sender is missing the Supabase anon token. Refresh the app and try again.");
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
      body: JSON.stringify({ quoteId: quote.id, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
    if (typeof updateQuote === "function") await updateQuote(quote.id, { status: "Sent" });
    alert(`${kind} email sent to ${payload.to}.`);
  }

  window.addEventListener("click", (event) => {
    const quoteButton = event.target.closest?.("[data-send-in-app]");
    const invoiceButton = event.target.closest?.("[data-send-invoice]");
    if (!quoteButton && !invoiceButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openPreview(invoiceButton ? "Invoice" : "Quote", invoiceButton?.dataset.sendInvoice || quoteButton?.dataset.sendInApp);
  }, true);

  document.addEventListener("click", async (event) => {
    const confirm = event.target.closest?.("#sendPreviewConfirm");
    if (!confirm) return;
    event.preventDefault();
    const dialog = document.querySelector("#sendPreviewDialog");
    const oldText = confirm.textContent;
    confirm.disabled = true;
    confirm.textContent = confirm.dataset.kind === "Invoice" ? "Sending invoice..." : "Sending quote...";
    try {
      await send(confirm.dataset.kind || "Quote", confirm.dataset.quote, confirm);
      dialog?.close();
      if (typeof render === "function") render();
    } catch (error) {
      alert(`Could not send yet: ${error.message || "Please check the email setup and try again."}`);
    } finally {
      confirm.disabled = false;
      confirm.textContent = oldText;
    }
  });

  window.wesetOpenSendPreview = (type, id) => openPreview(type === "invoice" ? "Invoice" : "Quote", id);
})();

