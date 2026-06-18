(() => {
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";
  const company = {
    name: "Easy office set up ltd",
    address1: "130 clapton common",
    address2: "London, London E5 9AG",
    vat: "VAT Registration No. 497601164",
    email: "accounts@weset.co.uk",
    phone: "+447380907868"
  };
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

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

  function itemDescription(item, quote) {
    return item.description || item.notes || quote.notes || `Office setup for ${quote.premises || "client site"}`;
  }

  function itemRows(quote) {
    return quoteItemsSafe(quote).map((item, index) => {
      const qty = Number(item.quantity || 1);
      const rate = Number(item.unitCost || 0);
      return {
        index: index + 1,
        product: item.name || "Services",
        description: itemDescription(item, quote),
        qty,
        rate,
        amount: qty * rate
      };
    });
  }

  function safeDate(value) {
    return value || new Date().toISOString().slice(0, 10);
  }

  function documentHtml(kind, quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const rows = itemRows(quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    const date = safeDate(quote.createdAt?.slice?.(0, 10));
    const dueDate = safeDate(quote.requiredDate || quote.dueDate);
    const title = kind.toUpperCase();
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2528;background:#ffffff;max-width:900px;margin:0 auto;padding:0;">
      <div style="display:grid;grid-template-columns:1.15fr .85fr;gap:24px;padding:42px 48px 22px;align-items:start;">
        <div>
          <h1 style="color:#0d6f9f;font-size:20px;letter-spacing:2px;margin:0 0 8px;">${escapeHtml(title)}</h1>
          <p style="font-size:12px;line-height:1.45;margin:0;"><strong>${escapeHtml(company.name)}</strong><br>${escapeHtml(company.address1)}<br>${escapeHtml(company.address2)}<br>${escapeHtml(company.vat)}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr;gap:10px;justify-items:end;">
          <p style="font-size:12px;line-height:1.45;margin:0;text-align:left;width:100%;max-width:250px;">${escapeHtml(company.email)}<br>${escapeHtml(company.phone)}</p>
          <div style="background:#eeeeee;border-radius:2px;padding:12px 18px;width:260px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.12);">
            <img src="assets/weset-logo-live.jpg" alt="WeSet" style="display:block;width:100%;height:auto;">
          </div>
        </div>
      </div>
      <div style="background:#eaf3fb;padding:22px 48px 28px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-bottom:34px;">
          <div><h2 style="font-size:12px;margin:0 0 6px;">Bill to</h2><p style="font-size:13px;line-height:1.45;margin:0;">${escapeHtml(client.company || client.contact || "Client")}<br>${escapeHtml(client.contact || "")}<br>${escapeHtml(client.email || "")}</p></div>
          <div><h2 style="font-size:12px;margin:0 0 6px;">Ship to</h2><p style="font-size:13px;line-height:1.45;margin:0;">${escapeHtml(client.company || client.contact || "Client")}<br>${escapeHtml(quote.premises || "")}</p></div>
        </div>
        <div style="border-top:1px dashed #ccd7df;padding-top:24px;max-width:280px;">
          <h2 style="font-size:13px;margin:0 0 8px;">${escapeHtml(kind)} details</h2>
          <p style="font-size:13px;line-height:1.55;margin:0;">${escapeHtml(kind)} no.: ${escapeHtml(reference)}<br>Terms: Net 15<br>${escapeHtml(kind)} date: ${escapeHtml(date)}<br>Due date: ${escapeHtml(dueDate)}</p>
        </div>
      </div>
      <div style="padding:30px 48px 34px;">
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead><tr><th style="padding:10px 8px;text-align:left;width:30px;">#</th><th style="padding:10px 8px;text-align:left;width:27%;">Product or service</th><th style="padding:10px 8px;text-align:left;">Description</th><th style="padding:10px 8px;text-align:right;width:55px;">Qty</th><th style="padding:10px 8px;text-align:right;width:85px;">Rate</th><th style="padding:10px 8px;text-align:right;width:95px;">Amount</th><th style="padding:10px 8px;text-align:right;width:75px;">VAT</th></tr></thead>
          <tbody>${rows.map((row) => `<tr><td style="border-top:1px solid #e2e6e8;padding:13px 8px;vertical-align:top;">${row.index}.</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;vertical-align:top;font-weight:700;line-height:1.45;">${escapeHtml(row.product)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;vertical-align:top;line-height:1.45;">${escapeHtml(row.description)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${row.qty}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${moneyText(row.rate)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${moneyText(row.amount)}</td><td style="border-top:1px solid #e2e6e8;padding:13px 8px;text-align:right;vertical-align:top;">${totals.vatEnabled ? `${totals.vatRate}% S` : "No VAT"}</td></tr>`).join("") || `<tr><td colspan="7" style="border-top:1px solid #e2e6e8;padding:13px 8px;">Office setup services</td></tr>`}</tbody>
        </table>
        <div style="display:grid;grid-template-columns:1fr 270px;gap:28px;margin-top:18px;align-items:start;">
          <div></div>
          <div style="font-size:13px;">
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e6e8;padding:10px 0;"><span>Subtotal</span><span>${moneyText(totals.subtotal)}</span></div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e6e8;padding:10px 0;"><span>Includes VAT @ ${totals.vatEnabled ? totals.vatRate : 0}%</span><span>${moneyText(totals.vatAmount)}</span></div>
            <div style="display:flex;justify-content:space-between;border-top:1px solid #d2d9dd;padding:16px 0 0;font-size:16px;font-weight:800;"><span>Total</span><span>${moneyText(totals.total)}</span></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function designedEmail(kind, quote, options = {}) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const reference = options.reference || (kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote));
    return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;"><div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e0e1;"><div style="background:#145c58;color:#ffffff;padding:24px 28px;"><div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div><h1 style="font-size:26px;line-height:1.2;margin:18px 0 0;">${escapeHtml(kind)} ${escapeHtml(reference)}</h1><p style="margin:8px 0 0;color:#dce8ea;">Office setup, quoted clearly.</p></div><div style="padding:24px 28px;font-size:15px;line-height:1.6;"><p style="margin-top:0;">Hello ${escapeHtml(client.contact || "")},</p><p>${kind === "Invoice" ? "Your WeSet invoice is ready. The professional PDF invoice is attached." : "Your WeSet quote is ready. The professional PDF quote is attached."}</p><div style="background:#e8f3f1;border-radius:8px;margin:18px 0;padding:16px;"><p style="margin:0 0 6px;"><strong>Reference:</strong> ${escapeHtml(reference)}</p><p style="margin:0 0 6px;"><strong>Setup address:</strong> ${escapeHtml(quote.premises || "")}</p><p style="margin:0;"><strong>Total:</strong> ${moneyText(totals.total)}</p></div><p style="margin-bottom:0;">Kind regards,<br><strong>WeSet</strong></p></div></div></div>`;
  }

  function structuredText(kind, quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    return [
      `DOC_TYPE: ${kind}`,
      `REFERENCE: ${reference}`,
      `QUOTE_REF: ${quoteRef(quote)}`,
      `DATE: ${new Date().toISOString().slice(0, 10)}`,
      `DUE_DATE: ${quote.requiredDate || ""}`,
      `FROM_COMPANY: ${company.name}`,
      `FROM_ADDRESS1: ${company.address1}`,
      `FROM_ADDRESS2: ${company.address2}`,
      `FROM_VAT: ${company.vat}`,
      `FROM_EMAIL: ${company.email}`,
      `FROM_PHONE: ${company.phone}`,
      `CLIENT_COMPANY: ${client.company || client.contact || "Client"}`,
      `CLIENT_CONTACT: ${client.contact || ""}`,
      `CLIENT_EMAIL: ${client.email || ""}`,
      `SHIP_TO: ${quote.premises || ""}`,
      ...itemRows(quote).map((row) => `ITEM: ${row.product} | DESC: ${row.description} | QTY: ${row.qty} | RATE: ${moneyText(row.rate)} | AMOUNT: ${moneyText(row.amount)} | VAT: ${totals.vatEnabled ? `${totals.vatRate}% S` : "No VAT"}`),
      `SUBTOTAL: ${moneyText(totals.subtotal)}`,
      `VAT_LABEL: Includes VAT @ ${totals.vatEnabled ? totals.vatRate : 0}%`,
      `VAT_AMOUNT: ${moneyText(totals.vatAmount)}`,
      `TOTAL: ${moneyText(totals.total)}`,
      "",
      `Hello ${client.contact || ""},`,
      `Your WeSet ${kind.toLowerCase()} ${reference} is ready. The PDF is attached.`,
      "Kind regards,",
      "WeSet"
    ].join("\n");
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
