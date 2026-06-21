(() => {
  const invoiceStoreKey = "weset.invoices";
  let lastInvoiceSnapshot = localStorage.getItem(invoiceStoreKey) || "[]";
  let invoiceNotice = "";

  function invoiceCount() {
    try { return JSON.parse(localStorage.getItem(invoiceStoreKey) || "[]").length; } catch { return 0; }
  }

  function showInvoiceRecognitionNotice(message) {
    invoiceNotice = message || invoiceNotice;
    const panel = document.querySelector("#accountingReportsPanel");
    if (!panel || !invoiceNotice) return;
    let note = document.querySelector("#invoiceRecognitionNotice");
    if (!note) {
      note = document.createElement("div");
      note.id = "invoiceRecognitionNotice";
      note.className = "accounting-report-note";
      const source = document.querySelector("#accountingReportSource");
      if (source) source.insertAdjacentElement("afterend", note);
      else panel.insertAdjacentElement("afterbegin", note);
    }
    note.textContent = invoiceNotice;
  }

  function refreshAccountingInvoices(message = "Invoice records refreshed. New invoices are now available for reports and client payments.") {
    const before = invoiceCount();
    if (typeof window.wesetRefreshAccountingReports === "function") {
      window.wesetRefreshAccountingReports();
    }
    if (typeof renderAccounting === "function") {
      setTimeout(() => {
        renderAccounting();
        showInvoiceRecognitionNotice(message);
      }, 150);
    } else {
      showInvoiceRecognitionNotice(message);
    }
    setTimeout(() => {
      const after = invoiceCount();
      if (after >= before) showInvoiceRecognitionNotice(message);
    }, 400);
  }

  function checkInvoiceStorage() {
    const current = localStorage.getItem(invoiceStoreKey) || "[]";
    if (current === lastInvoiceSnapshot) return;
    lastInvoiceSnapshot = current;
    refreshAccountingInvoices();
  }

  function watchInvoiceButtons() {
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.("[data-send-invoice], [data-save-invoice]")) return;
      setTimeout(checkInvoiceStorage, 500);
      setTimeout(checkInvoiceStorage, 1500);
      setTimeout(checkInvoiceStorage, 3000);
    }, true);
  }

  function wrapInvoiceApi() {
    if (typeof window.wesetCreateInvoice === "function" && !window.wesetCreateInvoice.__recognitionWrapped) {
      const originalCreate = window.wesetCreateInvoice;
      const wrappedCreate = async function createInvoiceAndRefresh(...args) {
        const result = await originalCreate.apply(this, args);
        lastInvoiceSnapshot = localStorage.getItem(invoiceStoreKey) || "[]";
        refreshAccountingInvoices(`Invoice ${result?.record?.invoiceNumber || ""} is now recorded in invoices, reports and client payments.`.trim());
        return result;
      };
      wrappedCreate.__recognitionWrapped = true;
      window.wesetCreateInvoice = wrappedCreate;
    }
    if (typeof window.wesetSendInvoice === "function" && !window.wesetSendInvoice.__recognitionWrapped) {
      const originalSend = window.wesetSendInvoice;
      const wrappedSend = async function sendInvoiceAndRefresh(...args) {
        const result = await originalSend.apply(this, args);
        lastInvoiceSnapshot = localStorage.getItem(invoiceStoreKey) || "[]";
        refreshAccountingInvoices("Invoice send finished. Invoice records refreshed for accounting and payments.");
        return result;
      };
      wrappedSend.__recognitionWrapped = true;
      window.wesetSendInvoice = wrappedSend;
    }
  }

  window.wesetRefreshInvoiceRecognition = refreshAccountingInvoices;
  watchInvoiceButtons();
  wrapInvoiceApi();
  setInterval(() => { wrapInvoiceApi(); checkInvoiceStorage(); }, 1200);
  setTimeout(() => refreshAccountingInvoices("Invoice records are connected to accounting and client payments."), 800);
})();
