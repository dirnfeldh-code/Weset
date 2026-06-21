(() => {
  const invoiceStoreKey = "weset.invoices";
  const paymentStoreKey = "weset.client.payments";
  let cleanupQueued = false;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function invoiceNumberOf(invoice) {
    return invoice.invoiceNumber || invoice.invoice_number || invoice.id || "";
  }

  function quoteIdOf(invoice) {
    return invoice.quoteId || invoice.quote_id || "";
  }

  function clientIdOf(invoice) {
    return invoice.clientId || invoice.client_id || "";
  }

  function paymentInvoice(payment) {
    return payment.invoiceNumber || payment.invoice_number || "";
  }

  function normalizeInvoice(invoice) {
    const number = invoiceNumberOf(invoice);
    return {
      ...invoice,
      id: invoice.id || number,
      invoiceNumber: number,
      quoteId: quoteIdOf(invoice),
      clientId: clientIdOf(invoice),
      status: invoice.status || "Unpaid",
      subtotal: Number(invoice.subtotal || 0),
      vatEnabled: Boolean(invoice.vatEnabled ?? invoice.vat_enabled),
      vatRate: Number(invoice.vatRate ?? invoice.vat_rate ?? 0),
      vatAmount: Number(invoice.vatAmount ?? invoice.vat_amount ?? 0),
      total: Number(invoice.total || 0),
      html: invoice.html || invoice.invoice_html || "",
      createdAt: invoice.createdAt || invoice.created_at || "",
      sentAt: invoice.sentAt || invoice.sent_at || "",
      paidAt: invoice.paidAt || invoice.paid_at || ""
    };
  }

  function normalizePayment(payment) {
    return {
      ...payment,
      id: payment.id || crypto.randomUUID(),
      date: payment.date || payment.payment_date || new Date().toISOString().slice(0, 10),
      clientId: payment.clientId || payment.client_id || "",
      invoiceNumber: paymentInvoice(payment),
      amount: Number(payment.amount || 0),
      method: payment.method || "Bank transfer",
      reference: payment.reference || "",
      notes: payment.notes || ""
    };
  }

  function statusRank(status) {
    return { Cancelled: 5, Paid: 4, "Part paid": 3, Sent: 2, Unpaid: 1, Created: 1, Draft: 0 }[status] ?? 1;
  }

  function mergeInvoice(a, b) {
    const first = normalizeInvoice(a);
    const second = normalizeInvoice(b);
    const status = statusRank(second.status) >= statusRank(first.status) ? second.status : first.status;
    return {
      ...first,
      ...second,
      status,
      html: second.html || first.html,
      createdAt: first.createdAt || second.createdAt,
      sentAt: second.sentAt || first.sentAt,
      paidAt: second.paidAt || first.paidAt,
      subtotal: Number(second.subtotal || first.subtotal || 0),
      vatAmount: Number(second.vatAmount || first.vatAmount || 0),
      total: Number(second.total || first.total || 0)
    };
  }

  function uniqueInvoices() {
    const map = new Map();
    readJson(invoiceStoreKey, []).map(normalizeInvoice).filter((invoice) => invoice.invoiceNumber).forEach((invoice) => {
      map.set(invoice.invoiceNumber, map.has(invoice.invoiceNumber) ? mergeInvoice(map.get(invoice.invoiceNumber), invoice) : invoice);
    });
    return [...map.values()];
  }

  function uniquePayments() {
    const seenIds = new Set();
    const seenAuto = new Set();
    const rows = [];
    readJson(paymentStoreKey, []).map(normalizePayment).forEach((payment) => {
      if (seenIds.has(payment.id)) return;
      seenIds.add(payment.id);
      const autoKey = [payment.invoiceNumber, payment.date, Number(payment.amount || 0).toFixed(2), payment.method, payment.reference, payment.notes].join("|");
      const looksAutoDuplicate = payment.invoiceNumber && /marked paid from invoice workflow/i.test(payment.notes || "");
      if (looksAutoDuplicate && seenAuto.has(autoKey)) return;
      if (looksAutoDuplicate) seenAuto.add(autoKey);
      rows.push(payment);
    });
    return rows;
  }

  function paymentsForInvoice(invoiceNumber) {
    return uniquePayments().filter((payment) => payment.invoiceNumber === invoiceNumber).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function statusFromChain(invoice) {
    if (invoice.status === "Cancelled") return invoice.status;
    const total = Number(invoice.total || 0);
    const paid = paymentsForInvoice(invoice.invoiceNumber);
    if (total && paid >= total - 0.005) return "Paid";
    if (paid > 0) return "Part paid";
    if (invoice.sentAt || invoice.status === "Sent") return "Sent";
    return invoice.status === "Created" ? "Unpaid" : invoice.status || "Unpaid";
  }

  function repairStoredChain() {
    const invoices = uniqueInvoices().map((invoice) => {
      const status = statusFromChain(invoice);
      return { ...invoice, status, paidAt: status === "Paid" ? (invoice.paidAt || new Date().toISOString()) : invoice.paidAt };
    });
    const payments = uniquePayments();
    writeJson(invoiceStoreKey, invoices);
    writeJson(paymentStoreKey, payments);
  }

  function invoiceByNumber(number) {
    return uniqueInvoices().find((invoice) => invoice.invoiceNumber === number);
  }

  function invoiceStatus(number) {
    const invoice = invoiceByNumber(number);
    return invoice ? statusFromChain(invoice) : "";
  }

  function cleanInvoiceButtons() {
    document.querySelectorAll(".invoice-row-actions").forEach((actions) => {
      const viewButton = actions.querySelector("[data-view-live-invoice]");
      const number = viewButton?.dataset.viewLiveInvoice || actions.querySelector("[data-record-invoice-payment]")?.dataset.recordInvoicePayment || actions.querySelector("[data-send-stored-invoice]")?.dataset.sendStoredInvoice || "";
      if (!number) return;
      const status = invoiceStatus(number);
      actions.querySelectorAll("[data-mark-invoice-paid], [data-mark-invoice-paid-workflow]").forEach((button) => button.remove());
      const send = actions.querySelector("[data-send-stored-invoice]");
      const payment = actions.querySelector("[data-record-invoice-payment]");
      if (send && ["Sent", "Part paid", "Paid", "Cancelled"].includes(status)) send.remove();
      if (payment) {
        payment.textContent = status === "Part paid" ? "Add payment" : "Record payment";
        if (["Paid", "Cancelled"].includes(status)) payment.remove();
      }
      if (viewButton) viewButton.textContent = "View";
      actions.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("danger", /delete|cancel/i.test(button.textContent));
        button.style.whiteSpace = "nowrap";
      });
    });
  }

  function cleanQuoteButtons() {
    document.querySelectorAll(".quote-card").forEach((card) => {
      const badge = card.querySelector(".badge")?.textContent?.trim() || "";
      card.querySelectorAll("[data-status]").forEach((button) => {
        const status = button.dataset.status?.split(":")[1] || "";
        if (status === badge) button.remove();
        if (badge === "Accepted" && ["Sent", "Declined"].includes(status)) button.remove();
        if (badge === "Declined" && ["Sent", "Accepted"].includes(status)) button.remove();
      });
    });
  }

  function exposeDebug() {
    window.wesetChainCheck = function wesetChainCheck() {
      const invoices = uniqueInvoices();
      const payments = uniquePayments();
      return {
        invoices: invoices.length,
        payments: payments.length,
        unpaidInvoices: invoices.filter((invoice) => statusFromChain(invoice) !== "Paid").length,
        invoiceNumbers: invoices.map((invoice) => invoice.invoiceNumber)
      };
    };
  }

  function cleanup() {
    repairStoredChain();
    cleanInvoiceButtons();
    cleanQuoteButtons();
    exposeDebug();
  }

  function scheduleCleanup(delay = 0) {
    if (cleanupQueued) return;
    cleanupQueued = true;
    setTimeout(() => {
      cleanupQueued = false;
      cleanup();
    }, delay);
  }

  document.addEventListener("click", () => scheduleCleanup(250), true);
  document.addEventListener("submit", () => scheduleCleanup(450), true);
  document.addEventListener("change", () => scheduleCleanup(250), true);
  window.addEventListener("storage", () => scheduleCleanup(50));
  setTimeout(cleanup, 600);
  setTimeout(cleanup, 1800);
})();
