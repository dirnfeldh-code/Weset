(() => {
  const invoiceStoreKey = "weset.invoices";
  let syncing = false;

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeInvoice(row) {
    if (!row) return null;
    return {
      ...row,
      id: row.id || row.invoiceNumber || row.invoice_number || "",
      invoiceNumber: row.invoiceNumber || row.invoice_number || row.id || "Invoice",
      quoteId: row.quoteId || row.quote_id || "",
      clientId: row.clientId || row.client_id || "",
      status: row.status || "Unpaid",
      subtotal: Number(row.subtotal || 0),
      vatEnabled: Boolean(row.vatEnabled ?? row.vat_enabled),
      vatRate: Number(row.vatRate ?? row.vat_rate ?? 0),
      vatAmount: Number(row.vatAmount ?? row.vat_amount ?? 0),
      total: Number(row.total || 0),
      html: row.html || row.invoice_html || "",
      createdAt: row.createdAt || row.created_at || "",
      sentAt: row.sentAt || row.sent_at || "",
      paidAt: row.paidAt || row.paid_at || "",
      dueDate: row.dueDate || row.due_date || "",
      terms: row.terms || "Net 15",
      notes: row.notes || ""
    };
  }

  function mergeInvoices(localRows, remoteRows) {
    const map = new Map();
    [...localRows, ...remoteRows].map(normalizeInvoice).filter(Boolean).forEach((invoice) => {
      const key = invoice.invoiceNumber || invoice.id;
      const existing = map.get(key) || {};
      map.set(key, { ...existing, ...invoice, html: invoice.html || existing.html || "" });
    });
    return [...map.values()].sort((a, b) => String(b.sentAt || b.createdAt || "").localeCompare(String(a.sentAt || a.createdAt || "")));
  }

  async function syncInvoicesToChain() {
    if (syncing) return;
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    syncing = true;
    try {
      const remote = await sbRequest("invoices?select=*&order=created_at.desc");
      const merged = mergeInvoices(readJson(invoiceStoreKey, []), remote || []);
      writeJson(invoiceStoreKey, merged);
      if (typeof window.wesetRepairBusinessChain === "function") window.wesetRepairBusinessChain();
      else if (typeof renderAccounting === "function") setTimeout(renderAccounting, 120);
      if (typeof window.wesetCleanQuoteReferences === "function") setTimeout(window.wesetCleanQuoteReferences, 180);
    } catch (error) {
      console.warn("Could not sync invoices into business chain", error);
    } finally {
      syncing = false;
    }
  }

  window.wesetSyncInvoicesToChain = syncInvoicesToChain;
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-send-stored-invoice], [data-stage-invoice-quote], [data-record-invoice-payment], [data-mark-invoice-paid]")) return;
    setTimeout(syncInvoicesToChain, 800);
    setTimeout(syncInvoicesToChain, 2200);
  }, true);
  setTimeout(syncInvoicesToChain, 1200);
  setInterval(syncInvoicesToChain, 15000);
})();
