(() => {
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

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

  function getClientSafe(quote) {
    return typeof getClient === "function" ? getClient(quote.clientId) : { company: "Client", contact: "", email: "" };
  }

  function quoteItemsSafe(quote) {
    if (typeof quoteItems === "function") return quoteItems(quote);
    return quote.items || [];
  }

  function totalsForQuote(quote) {
    if (typeof window.wesetQuoteTotals === "function") return window.wesetQuoteTotals(quote);
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { total: 0 };
    return { subtotal: costs.total || 0, vatEnabled: false, vatRate: 0, vatAmount: 0, total: costs.total || 0 };
  }

  function brandBlock(kind, reference) {
    return `<div style="background:#145c58;color:#ffffff;padding:26px 30px;">
      <div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div>
      <h1 style="margin:18px 0 0;font-size:28px;line-height:1.15;">${escapeHtml(kind)} ${escapeHtml(reference)}</h1>
      <p style="margin:8px 0 0;color:#dce8ea;">Office setup, quoted clearly.</p>
    </div>`;
  }

  function documentHtml(kind, quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const items = quoteItemsSafe(quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    const date = new Date().toISOString().slice(0, 10);
    const dueLabel = kind === "Invoice" ? "Amount due" : "Quote total";
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2528;background:#ffffff;padding:0;">
      ${brandBlock(kind, reference)}
      <div style="padding:30px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px;">
          <div style="border:1px solid #d9e0e1;border-radius:8px;padding:16px;min-height:132px;">
            <h2 style="font-size:12px;letter-spacing:0;text-transform:uppercase;margin:0 0 10px;color:#687478;">From</h2>
            <p style="margin:0;line-height:1.55;"><strong style="font-size:16px;">WeSet</strong><br>Office Setup Consultancy<br>London, United Kingdom<br>quotes@weset.co.uk</p>
          </div>
          <div style="border:1px solid #d9e0e1;border-radius:8px;padding:16px;min-height:132px;">
            <h2 style="font-size:12px;letter-spacing:0;text-transform:uppercase;margin:0 0 10px;color:#687478;">Bill to</h2>
            <p style="margin:0;line-height:1.55;"><strong style="font-size:16px;">${escapeHtml(client.company || client.contact || "Client")}</strong><br>${escapeHtml(client.contact || "")}<br>${escapeHtml(client.email || "")}<br>${escapeHtml(quote.premises || "")}</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px;">
          <div style="background:#f8fbfa;border:1px solid #d9e0e1;border-radius:8px;padding:12px;"><span style="display:block;color:#687478;font-size:12px;font-weight:700;">Reference</span><strong>${escapeHtml(reference)}</strong></div>
          <div style="background:#f8fbfa;border:1px solid #d9e0e1;border-radius:8px;padding:12px;"><span style="display:block;color:#687478;font-size:12px;font-weight:700;">Date</span><strong>${escapeHtml(date)}</strong></div>
          <div style="background:#e8f3f1;border:1px solid #d9e0e1;border-radius:8px;padding:12px;"><span style="display:block;color:#687478;font-size:12px;font-weight:700;">${dueLabel}</span><strong>${moneyText(totals.total)}</strong></div>
        </div>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:20px;">
          <thead><tr style="background:#145c58;color:#ffffff;"><th style="padding:11px;text-align:left;">Description</th><th style="padding:11px;text-align:right;width:70px;">Qty</th><th style="padding:11px;text-align:right;width:110px;">Unit price</th><th style="padding:11px;text-align:right;width:120px;">Amount</th></tr></thead>
          <tbody>${items.map((item, index) => {
            const qty = Number(item.quantity || 1);
            const unit = Number(item.unitCost || 0);
            return `<tr style="background:${index % 2 ? "#ffffff" : "#f8fbfa"};"><td style="border-bottom:1px solid #d9e0e1;padding:11px;">${escapeHtml(item.name || "Item")}</td><td style="border-bottom:1px solid #d9e0e1;padding:11px;text-align:right;">${qty}</td><td style="border-bottom:1px solid #d9e0e1;padding:11px;text-align:right;">${moneyText(unit)}</td><td style="border-bottom:1px solid #d9e0e1;padding:11px;text-align:right;font-weight:700;">${moneyText(qty * unit)}</td></tr>`;
          }).join("") || `<tr><td colspan="4" style="border-bottom:1px solid #d9e0e1;padding:11px;">Office setup services</td></tr>`}</tbody>
        </table>
        <div style="display:grid;justify-content:end;margin-left:auto;max-width:330px;gap:9px;">
          <div style="display:flex;justify-content:space-between;gap:34px;"><span>Subtotal</span><strong>${moneyText(totals.subtotal)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:34px;"><span>VAT ${totals.vatEnabled ? `${totals.vatRate}%` : "not added"}</span><strong>${moneyText(totals.vatAmount)}</strong></div>
          <div style="background:#145c58;color:#ffffff;border-radius:8px;display:flex;justify-content:space-between;gap:34px;padding:13px 14px;font-size:17px;"><span>${kind === "Invoice" ? "Total due" : "Total"}</span><strong>${moneyText(totals.total)}</strong></div>
        </div>
        <p style="border-top:1px solid #d9e0e1;color:#687478;font-size:12px;margin:26px 0 0;padding-top:14px;">Thank you for choosing WeSet. Please contact us with any questions about this ${kind.toLowerCase()}.</p>
      </div>
    </div>`;
  }

  function designedEmail(kind, quote, options = {}) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const reference = options.reference || (kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote));
    return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e0e1;">
        ${brandBlock(kind, reference)}
        <div style="padding:24px 28px;font-size:15px;line-height:1.6;">
          <p style="margin-top:0;">Hello ${escapeHtml(client.contact || "")},</p>
          <p>${kind === "Invoice" ? "Your WeSet invoice is ready. The professional PDF invoice is attached." : "Your WeSet quote is ready. The professional PDF quote is attached."}</p>
          <div style="background:#e8f3f1;border-radius:8px;margin:18px 0;padding:16px;"><p style="margin:0 0 6px;"><strong>Reference:</strong> ${escapeHtml(reference)}</p><p style="margin:0 0 6px;"><strong>Setup address:</strong> ${escapeHtml(quote.premises || "")}</p><p style="margin:0;"><strong>Total:</strong> ${moneyText(totals.total)}</p></div>
          <p style="margin-bottom:0;">Kind regards,<br><strong>WeSet</strong></p>
        </div>
      </div>
    </div>`;
  }

  function structuredText(kind, quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const items = quoteItemsSafe(quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    const lines = [
      `DOC_TYPE: ${kind}`,
      `REFERENCE: ${reference}`,
      `QUOTE_REF: ${quoteRef(quote)}`,
      `DATE: ${new Date().toISOString().slice(0, 10)}`,
      `FROM_COMPANY: WeSet`,
      `FROM_DETAILS: Office Setup Consultancy | London, United Kingdom | quotes@weset.co.uk`,
      `CLIENT_COMPANY: ${client.company || client.contact || "Client"}`,
      `CLIENT_CONTACT: ${client.contact || ""}`,
      `CLIENT_EMAIL: ${client.email || ""}`,
      `SETUP_ADDRESS: ${quote.premises || ""}`,
      ...items.map((item) => {
        const qty = Number(item.quantity || 1);
        const unit = Number(item.unitCost || 0);
        return `ITEM: ${item.name || "Item"} | QTY: ${qty} | UNIT: ${moneyText(unit)} | AMOUNT: ${moneyText(qty * unit)}`;
      }),
      `SUBTOTAL: ${moneyText(totals.subtotal)}`,
      `VAT_LABEL: VAT ${totals.vatEnabled ? `${totals.vatRate}%` : "not added"}`,
      `VAT_AMOUNT: ${moneyText(totals.vatAmount)}`,
      `TOTAL: ${moneyText(totals.total)}`,
      "",
      `Hello ${client.contact || ""},`,
      `Your WeSet ${kind.toLowerCase()} ${reference} is ready. The PDF is attached.`,
      "Kind regards,",
      "WeSet"
    ];
    return lines.join("\n");
  }

  window.wesetQuoteInvoiceHtml = (quote) => documentHtml("Quote", quote);
  window.wesetQuoteEmailPayload = (quote) => {
    const client = getClientSafe(quote);
    const reference = quoteRef(quote);
    return { to: client.email || "", subject: `WeSet quote ${reference}`, text: structuredText("Quote", quote), html: designedEmail("Quote", quote, { reference }), reference, invoiceHtml: documentHtml("Quote", quote) };
  };
  window.wesetInvoiceEmailPayload = (quote) => {
    const client = getClientSafe(quote);
    const reference = invoiceNumber(quote);
    return { to: client.email || "", subject: `WeSet invoice ${reference}`, text: structuredText("Invoice", quote), html: designedEmail("Invoice", quote, { reference }), reference, invoiceHtml: documentHtml("Invoice", quote) };
  };

  function functionToken() {
    if (typeof sbAnonKey !== "undefined" && sbAnonKey) return sbAnonKey;
    try { return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || ""; } catch { return ""; }
  }

  window.wesetSendCleanEmail = async (kind, quoteId) => {
    const quote = (state.quotes || []).find((entry) => entry.id === quoteId);
    if (!quote) throw new Error("Quote was not found in the app.");
    const payload = kind === "Invoice" && typeof window.wesetInvoiceEmailPayload === "function" ? window.wesetInvoiceEmailPayload(quote) : window.wesetQuoteEmailPayload(quote);
    if (!payload.to) throw new Error("This client does not have an email address saved.");
    const token = functionToken();
    if (!token) throw new Error("The email sender is missing the Supabase anon token. Refresh the app and try again.");
    const response = await fetch(edgeFunctionUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ quoteId: quote.id, ...payload }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
    if (typeof updateQuote === "function") await updateQuote(quote.id, { status: "Sent" });
    return data;
  };
})();
