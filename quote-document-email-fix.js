(() => {
  const esc = (value) => String(value ?? "")
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

  function companyDetails() {
    if (typeof window.wesetGetCompanyDetails === "function") return window.wesetGetCompanyDetails();
    return window.wesetCompanyDetails || { name: "WeSet", email: "", phone: "", terms: "Net 15" };
  }

  function detailsFor(kind, quote) {
    if (typeof window.wesetGetQuoteDocumentDetails === "function") return window.wesetGetQuoteDocumentDetails(kind, quote);
    return { reference: kind === "Invoice" ? invoiceNumber(quote) : quoteRef(quote), total: 0, billTo: "", shipTo: "" };
  }

  function emailHtml(kind, quote) {
    const company = companyDetails();
    const client = getClientSafe(quote);
    const details = detailsFor(kind, quote);
    return `<div style="margin:0;background:#eef5f4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2528;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e0e1;">
        <div style="background:#145c58;color:#ffffff;padding:24px 28px;">
          <div style="display:inline-block;background:#ffffff;color:#145c58;border-radius:6px;padding:8px 12px;font-size:24px;font-weight:800;line-height:1;">WeSet</div>
          <h1 style="font-size:26px;line-height:1.2;margin:18px 0 0;">${esc(kind)} ${esc(details.reference)}</h1>
          <p style="margin:8px 0 0;color:#dce8ea;">Office setup, quoted clearly.</p>
        </div>
        <div style="padding:24px 28px;font-size:15px;line-height:1.6;">
          <p style="margin-top:0;">Hello ${esc(client.contact || "")},</p>
          <p>${kind === "Invoice" ? "Your invoice is ready. The professional PDF invoice is attached." : "Your quote is ready. The professional PDF quote is attached."}</p>
          <div style="background:#e8f3f1;border-radius:8px;margin:18px 0;padding:16px;">
            <p style="margin:0 0 6px;"><strong>Reference:</strong> ${esc(details.reference)}</p>
            <p style="margin:0 0 6px;"><strong>Ship to:</strong> ${esc((details.shipTo || "").replace(/\n/g, ", "))}</p>
            <p style="margin:0;"><strong>Total:</strong> ${moneyText(details.total || 0)}</p>
          </div>
          <p style="margin-bottom:0;">Kind regards,<br><strong>${esc(company.name || "WeSet")}</strong></p>
        </div>
      </div>
    </div>`;
  }

  function structuredText(kind, quote) {
    const company = companyDetails();
    const client = getClientSafe(quote);
    const details = detailsFor(kind, quote);
    const billLines = String(details.billTo || "").split("\n");
    return [
      `DOC_TYPE: ${kind}`,
      `REFERENCE: ${details.reference}`,
      `QUOTE_REF: ${details.quoteRef || quoteRef(quote)}`,
      `DATE: ${details.issueDate || new Date().toISOString().slice(0, 10)}`,
      `DUE_DATE: ${details.dueDate || ""}`,
      `FROM_COMPANY: ${company.name || ""}`,
      `FROM_ADDRESS1: ${company.address1 || ""}`,
      `FROM_ADDRESS2: ${company.address2 || ""}`,
      `FROM_VAT: ${company.vat || ""}`,
      `FROM_EMAIL: ${company.email || ""}`,
      `FROM_PHONE: ${company.phone || ""}`,
      `TERMS: ${company.terms || "Net 15"}`,
      `CLIENT_COMPANY: ${billLines[0] || client.company || "Client"}`,
      `CLIENT_CONTACT: ${billLines[1] || client.contact || ""}`,
      `CLIENT_EMAIL: ${billLines[2] || client.email || ""}`,
      `SHIP_TO: ${details.shipTo || ""}`,
      ...(details.rows || []).map((row) => `ITEM: ${row.product} | DESC: ${row.description} | QTY: ${row.qty} | RATE: ${moneyText(row.rate)} | AMOUNT: ${moneyText(Number(row.qty || 0) * Number(row.rate || 0))} | VAT: ${row.vat || String(details.vatLabel || "").replace("Includes VAT @ ", "")}`),
      `SUBTOTAL: ${moneyText(details.subtotal || 0)}`,
      `VAT_LABEL: ${details.vatLabel || "VAT"}`,
      `VAT_AMOUNT: ${moneyText(details.vatAmount || 0)}`,
      `TOTAL: ${moneyText(details.total || 0)}`,
      "",
      `Hello ${client.contact || ""},`,
      `Your ${kind.toLowerCase()} ${details.reference} is ready. The PDF is attached.`,
      "Kind regards,",
      company.name || "WeSet"
    ].join("\n");
  }

  window.wesetQuoteEmailPayload = (quote) => {
    const client = getClientSafe(quote);
    const details = detailsFor("Quote", quote);
    return { to: client.email || "", subject: `Quote ${details.reference}`, text: structuredText("Quote", quote), html: emailHtml("Quote", quote), reference: details.reference, invoiceHtml: typeof window.wesetQuoteInvoiceHtml === "function" ? window.wesetQuoteInvoiceHtml(quote) : "" };
  };

  window.wesetInvoiceEmailPayload = (quote) => {
    const client = getClientSafe(quote);
    const details = detailsFor("Invoice", quote);
    return { to: client.email || "", subject: `Invoice ${details.reference}`, text: structuredText("Invoice", quote), html: emailHtml("Invoice", quote), reference: details.reference, invoiceHtml: typeof window.wesetQuoteInvoiceHtml === "function" ? window.wesetQuoteInvoiceHtml(quote) : "" };
  };
})();
