(() => {
  const STORE_KEYS = {
    quotes: "weset.quotes",
    invoices: "weset.invoices"
  };

  const readList = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  };

  const normalizeStatus = (value) => String(value || "Draft").toLowerCase();

  const quoteById = (id) => readList(STORE_KEYS.quotes).find((quote) => String(quote.id) === String(id));

  const invoiceForQuote = (id) => {
    return readList(STORE_KEYS.invoices).find((invoice) => String(invoice.quote_id || invoice.quoteId) === String(id));
  };

  const setButtonState = (button, disabled, text, title) => {
    if (button.disabled !== disabled) button.disabled = disabled;
    if (text && button.textContent.trim() !== text) button.textContent = text;
    if ((button.title || "") !== (title || "")) button.title = title || "";
  };

  const enforceInvoiceStage = () => {
    document.querySelectorAll("[data-stage-invoice-quote]").forEach((button) => {
      const quoteId = button.dataset.stageInvoiceQuote;
      const quote = quoteById(quoteId);
      const invoice = invoiceForQuote(quoteId);
      if (!quote) return;

      if (invoice) {
        setButtonState(button, false, "Open invoice", "Open and amend this invoice.");
        return;
      }

      if (normalizeStatus(quote.status) !== "accepted") {
        setButtonState(button, true, "Create invoice", "Mark the quote accepted before creating an invoice.");
        return;
      }

      setButtonState(button, false, "Create invoice", "");
    });

    document.querySelectorAll("[data-status]").forEach((button) => {
      const action = button.dataset.status || "";
      const parts = action.split(":");
      if (parts.length < 2) return;
      const [quoteId, status] = parts;
      const hasInvoice = !!invoiceForQuote(quoteId);
      const normalized = normalizeStatus(status);

      if (normalized === "sent") {
        button.remove();
        return;
      }

      if (hasInvoice && ["accepted", "declined"].includes(normalized)) {
        button.remove();
      }
    });
  };

  const blockEarlyInvoiceCreation = (event) => {
    const button = event.target.closest?.("[data-stage-invoice-quote]");
    if (!button) return;

    const quoteId = button.dataset.stageInvoiceQuote;
    const quote = quoteById(quoteId);
    const invoice = invoiceForQuote(quoteId);
    if (!quote || invoice || normalizeStatus(quote.status) === "accepted") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    enforceInvoiceStage();
    alert("Mark the quote as accepted before creating an invoice. Until then it stays as quote pipeline only, not real income in your reports.");
  };

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(enforceInvoiceStage, 80);
    };
  })();

  window.addEventListener("click", blockEarlyInvoiceCreation, true);
  window.addEventListener("storage", schedule);
  document.addEventListener("click", schedule, true);

  const start = () => {
    enforceInvoiceStage();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-stage-invoice-quote", "data-status", "disabled", "title"]
    });
    setInterval(enforceInvoiceStage, 2500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
