(() => {
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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

  function brandBlock(kind, reference, clientName) {
    return `<div style="background:#145c58;color:#ffffff;padding:24px 28px;">
      <div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;letter-spacing:0;line-height:1;">WeSet</div>
      <h1 style="margin:18px 0 0;font-size:26px;line-height:1.2;">${escapeHtml(kind)} ${escapeHtml(reference)}</h1>
      <p style="margin:8px 0 0;color:#dce8ea;">For ${escapeHtml(clientName || "your office setup")}</p>
    </div>`;
  }

  function designedEmail(kind, quote, options = {}) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const reference = options.reference || (kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote));
    const totalLabel = kind === "Invoice" ? "Total due" : "Total estimate";
    return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e0e1;">
        ${brandBlock(kind, reference, client.company || client.contact)}
        <div style="padding:24px 28px;font-size:15px;line-height:1.6;">
          <p style="margin-top:0;">Hello ${escapeHtml(client.contact || "")},</p>
          <p>${kind === "Invoice" ? "Your WeSet invoice is ready. The invoice PDF is attached to this email." : "Your WeSet quote is ready. The quote PDF is attached to this email."}</p>
          <div style="background:#e8f3f1;border-radius:8px;margin:18px 0;padding:16px;">
            <p style="margin:0 0 6px;"><strong>Setup address:</strong> ${escapeHtml(quote.premises || "")}</p>
            <p style="margin:0 0 6px;"><strong>Required date:</strong> ${escapeHtml(dateText(quote.requiredDate))}</p>
            <p style="margin:0;"><strong>${totalLabel}:</strong> ${moneyText(totals.total)}</p>
          </div>
          <p style="margin-bottom:0;">Kind regards,<br><strong>WeSet</strong></p>
        </div>
      </div>
    </div>`;
  }

  function documentHtml(kind, quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const items = quoteItemsSafe(quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2528;background:#ffffff;padding:0;">
      ${brandBlock(kind, reference, client.company || client.contact)}
      <div style="padding:26px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px;">
          <div style="background:#f8fbfa;border:1px solid #d9e0e1;border-radius:8px;padding:14px;">
            <h2 style="font-size:14px;margin:0 0 8px;color:#145c58;">Client</h2>
            <p style="margin:0;"><strong>${escapeHtml(client.company || client.contact || "Client")}</strong><br>${escapeHtml(client.email || "")}<br>${escapeHtml(quote.premises || "")}</p>
          </div>
          <div style="background:#e8f3f1;border:1px solid #d9e0e1;border-radius:8px;padding:14px;">
            <h2 style="font-size:14px;margin:0 0 8px;color:#145c58;">Details</h2>
            <p style="margin:0;"><strong>Reference:</strong> ${escapeHtml(reference)}<br><strong>Quote:</strong> ${escapeHtml(quoteRef(quote))}<br><strong>Date:</strong> ${escapeHtml(new Date().toISOString().slice(0, 10))}</p>
          </div>
        </div>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead><tr style="background:#145c58;color:#ffffff;"><th style="padding:10px;text-align:left;">Item</th><th style="padding:10px;text-align:right;">Qty</th><th style="padding:10px;text-align:right;">Unit</th><th style="padding:10px;text-align:right;">Total</th></tr></thead>
          <tbody>${items.map((item) => {
            const qty = Number(item.quantity || 1);
            const unit = Number(item.unitCost || 0);
            return `<tr><td style="border-bottom:1px solid #d9e0e1;padding:10px;">${escapeHtml(item.name || "Item")}</td><td style="border-bottom:1px solid #d9e0e1;padding:10px;text-align:right;">${qty}</td><td style="border-bottom:1px solid #d9e0e1;padding:10px;text-align:right;">${moneyText(unit)}</td><td style="border-bottom:1px solid #d9e0e1;padding:10px;text-align:right;">${moneyText(qty * unit)}</td></tr>`;
          }).join("")}</tbody>
        </table>
        <div style="margin-left:auto;margin-top:18px;max-width:280px;display:grid;gap:8px;">
          <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><strong>${moneyText(totals.subtotal)}</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>VAT ${totals.vatEnabled ? `${totals.vatRate}%` : "not added"}</span><strong>${moneyText(totals.vatAmount)}</strong></div>
          <div style="background:#145c58;color:#ffffff;border-radius:8px;display:flex;justify-content:space-between;padding:12px;"><span>Total</span><strong>${moneyText(totals.total)}</strong></div>
        </div>
      </div>
    </div>`;
  }

  function textFor(kind, quote) {
    const client = getClientSafe(quote);
    const totals = totalsForQuote(quote);
    const reference = kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote);
    return `Hello ${client.contact || ""},\n\nYour WeSet ${kind.toLowerCase()} ${reference} is ready.\n\nSetup address: ${quote.premises || ""}\nSubtotal: ${moneyText(totals.subtotal)}\nVAT: ${moneyText(totals.vatAmount)}\nTotal: ${moneyText(totals.total)}\n\nThe PDF is attached.\n\nKind regards,\nWeSet`;
  }

  window.wesetQuoteInvoiceHtml = (quote) => documentHtml("Quote", quote);
  window.wesetQuoteEmailPayload = (quote) => {
    const client = getClientSafe(quote);
    const reference = quoteRef(quote);
    return {
      to: client.email || "",
      subject: `WeSet quote ${reference}`,
      text: textFor("Quote", quote),
      html: designedEmail("Quote", quote, { reference }),
      reference,
      invoiceHtml: documentHtml("Quote", quote)
    };
  };

  window.wesetInvoiceEmailPayload = (quote) => {
    const client = getClientSafe(quote);
    const reference = invoiceNumber(quote);
    return {
      to: client.email || "",
      subject: `WeSet invoice ${reference}`,
      text: textFor("Invoice", quote),
      html: designedEmail("Invoice", quote, { reference }),
      reference,
      invoiceHtml: documentHtml("Invoice", quote)
    };
  };

  function functionToken() {
    if (typeof sbAnonKey !== "undefined" && sbAnonKey) return sbAnonKey;
    try { return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || ""; } catch { return ""; }
  }

  window.wesetSendCleanEmail = async (kind, quoteId) => {
    const quote = (state.quotes || []).find((entry) => entry.id === quoteId);
    if (!quote) throw new Error("Quote was not found in the app.");
    const payload = kind === "Invoice" && typeof window.wesetInvoiceEmailPayload === "function"
      ? window.wesetInvoiceEmailPayload(quote)
      : window.wesetQuoteEmailPayload(quote);
    if (!payload.to) throw new Error("This client does not have an email address saved.");
    const token = functionToken();
    if (!token) throw new Error("The email sender is missing the Supabase anon token. Refresh the app and try again.");
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quoteId: quote.id, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
    if (typeof updateQuote === "function") await updateQuote(quote.id, { status: "Sent" });
    return data;
  };
})();
