(() => {
  const sessionKeyName = typeof sessionKey !== "undefined" ? sessionKey : "we-set-session";
  const invoiceStoreKey = "weset.invoices";

  function hasSession() {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKeyName) || "null");
      return Boolean(session?.accessToken || session?.id || session?.email);
    } catch (_) {
      return false;
    }
  }

  function readJson(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }

  function invoiceForQuote(quoteId) {
    return readJson(invoiceStoreKey, []).find((invoice) => String(invoice.quoteId || invoice.quote_id) === String(quoteId));
  }

  function ensureStyles() {
    if (document.querySelector("#appFinalCleanupStyles")) return;
    const style = document.createElement("style");
    style.id = "appFinalCleanupStyles";
    style.textContent = `
      .app-shell { min-width: 0; }
      .panel, .quote-card, .catalog-item, .install-card { overflow: hidden; }
      .panel-head { align-items: flex-start; gap: 12px; }
      .panel-head > div { min-width: 0; }
      .panel-head h2, .panel-head h3, .quote-card h3, .catalog-item h3 { overflow-wrap: anywhere; }
      .card-actions, .invoice-row-actions, .quote-record-actions, .stage-action-row { align-items: center; display: flex; flex-wrap: wrap; gap: 7px; }
      .card-actions button, .invoice-row-actions button, .quote-record-actions button, .stage-action-row button { border-radius: 7px !important; min-height: 34px !important; padding: 7px 10px !important; width: auto !important; }
      .ghost.danger, button.danger { border-color: #f0c4c4 !important; color: #9b1c1c !important; }
      .ghost.danger:hover, button.danger:hover { background: #fff1f1 !important; }
      .table-wrap, .report-table-wrap { overflow: auto; width: 100%; }
      table { table-layout: auto; }
      td, th { vertical-align: top; }
      td:last-child, th:last-child { min-width: 150px; }
      .badge { max-width: 100%; overflow-wrap: anywhere; white-space: normal; }
      .cleanup-hidden { display: none !important; }
      .clean-muted-action { opacity: .82; }
      .clean-primary-action { background: #145c58 !important; color: #fff !important; }
      .invoice-row-actions [data-record-invoice-payment] { font-weight: 800; }
      #businessChainRefresh { display: none !important; }
      #loginScreen.is-hidden, #loginScreen.cleanup-hidden { display: none !important; }
      .view.is-visible { min-width: 0; }
      @media (max-width: 760px) {
        .topbar, .panel-head { align-items: stretch; flex-direction: column; }
        .topbar-actions, .card-actions, .invoice-row-actions, .quote-record-actions { display: grid; grid-template-columns: 1fr; width: 100%; }
        .topbar-actions button, .card-actions button, .invoice-row-actions button, .quote-record-actions button { width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanupLoginOverlay() {
    const login = document.querySelector("#loginScreen");
    if (!login || !hasSession()) return;
    login.classList.add("is-hidden", "cleanup-hidden");
    const error = document.querySelector("#loginError");
    if (error && /defaultCatalog is not defined/i.test(error.textContent || "")) error.textContent = "";
  }

  function cleanupInvoiceActions() {
    document.querySelectorAll(".invoice-row-actions, td:last-child").forEach((container) => {
      const paymentButtons = [...container.querySelectorAll("[data-record-invoice-payment], [data-mark-invoice-paid], [data-mark-invoice-paid-workflow]")];
      const seen = new Set();
      paymentButtons.forEach((button) => {
        const invoice = button.dataset.recordInvoicePayment || button.dataset.markInvoicePaid || button.dataset.markInvoicePaidWorkflow || "";
        if (!invoice) return;
        button.removeAttribute("data-mark-invoice-paid");
        button.removeAttribute("data-mark-invoice-paid-workflow");
        button.dataset.recordInvoicePayment = invoice;
        button.textContent = "Record payment";
        button.classList.add("secondary");
        if (seen.has(invoice)) button.remove();
        seen.add(invoice);
      });

      const sendButtons = [...container.querySelectorAll("[data-send-stored-invoice]")];
      const sent = new Set();
      sendButtons.forEach((button) => {
        const invoice = button.dataset.sendStoredInvoice || "";
        button.textContent = "Send invoice";
        button.classList.add("secondary");
        if (sent.has(invoice)) button.remove();
        sent.add(invoice);
      });

      const viewButtons = [...container.querySelectorAll("[data-view-live-invoice]")];
      const viewed = new Set();
      viewButtons.forEach((button) => {
        const invoice = button.dataset.viewLiveInvoice || "";
        button.textContent = "View invoice";
        button.classList.add("secondary");
        if (viewed.has(invoice)) button.remove();
        viewed.add(invoice);
      });
    });
  }

  function normalizeOldQuoteButtons() {
    document.querySelectorAll("[data-send-in-app]").forEach((button) => {
      button.dataset.stageSendQuote = button.dataset.sendInApp;
      button.removeAttribute("data-send-in-app");
      button.textContent = "Send quote";
      button.classList.add("clean-primary-action");
    });

    document.querySelectorAll("[data-invoice-quote]").forEach((button) => {
      const quoteId = button.dataset.invoiceQuote;
      button.dataset.stageInvoiceQuote = quoteId;
      button.removeAttribute("data-invoice-quote");
      button.textContent = invoiceForQuote(quoteId) ? "Open invoice" : "Create invoice";
      button.classList.add("secondary");
    });

    document.querySelectorAll("[data-send-invoice]").forEach((button) => button.remove());
    document.querySelectorAll('[data-edit-document][data-document-kind="Invoice"]').forEach((button) => button.remove());

    document.querySelectorAll("[data-edit-document][data-document-kind='Quote'], [data-edit-document][data-document-kind=Quote]").forEach((button) => {
      button.textContent = "Edit quote";
      button.classList.add("secondary");
      const quoteId = button.dataset.editDocument;
      document.querySelectorAll(`[data-edit-quote="${CSS.escape(quoteId)}"]`).forEach((oldButton) => oldButton.remove());
    });
  }

  function cleanupQuoteActions() {
    normalizeOldQuoteButtons();
    document.querySelectorAll("[data-send-quote], .stage-hidden").forEach((button) => {
      if (/prepare email/i.test(button.textContent || "")) button.remove();
    });
    document.querySelectorAll("[data-status]").forEach((button) => {
      const [quoteId, rawStatus] = String(button.dataset.status || "").split(":");
      const status = String(rawStatus || "").toLowerCase();
      if (status === "sent") button.remove();
      if (invoiceForQuote(quoteId) && ["accepted", "declined"].includes(status)) button.remove();
      if (status === "accepted") button.textContent = "Mark accepted";
      if (status === "declined") button.textContent = "Decline";
    });
    document.querySelectorAll("[data-stage-send-quote]").forEach((button) => {
      button.textContent = "Send quote";
      button.classList.add("clean-primary-action");
    });
    document.querySelectorAll("[data-stage-invoice-quote]").forEach((button) => {
      if (/open invoice/i.test(button.textContent || "")) button.textContent = "Open invoice";
      else button.textContent = "Create invoice";
    });
  }

  function cleanupPendingQuoteActions() {
    document.querySelectorAll("#pendingQuotes .quote-card").forEach((card) => {
      card.querySelector(".quote-record-actions")?.remove();
      card.querySelectorAll("button").forEach((button) => {
        const status = String(button.dataset.status || "").split(":").pop()?.toLowerCase() || "";
        if (status === "accepted") {
          button.textContent = "Accept";
          button.classList.add("primary");
          return;
        }
        if (status === "declined") {
          button.textContent = "Decline";
          button.classList.add("secondary");
          return;
        }
        button.remove();
      });
      card.querySelectorAll(".stage-note, .clean-action-note, .quote-action-panel").forEach((node) => node.remove());
    });
  }

  function cleanupUserActions() {
    document.querySelectorAll('[data-delete-user="owner"], [data-delete-user="info@weset.co.uk"]').forEach((button) => button.remove());
    document.querySelectorAll("#usersTable [data-delete-user]").forEach((button) => {
      button.textContent = "Delete user";
      button.classList.add("danger");
    });
    document.querySelectorAll("#usersTable [data-edit-user]").forEach((button) => {
      button.textContent = "Edit user";
    });
  }

  function cleanupItemActions() {
    document.querySelectorAll("[data-edit-item]").forEach((button) => {
      button.textContent = "Edit";
      button.classList.add("secondary");
    });
    document.querySelectorAll("[data-delete-item]").forEach((button) => {
      button.textContent = "Delete";
      button.classList.add("danger");
    });
  }

  function cleanupAccountingActions() {
    const refresh = document.querySelector("#businessChainRefresh");
    if (refresh) refresh.remove();
    const openClient = document.querySelector("#businessChainOpenClient");
    if (openClient && /no clients yet/i.test(document.querySelector("#businessChainClientSelect")?.textContent || "")) openClient.classList.add("cleanup-hidden");
    document.querySelectorAll("[data-export-report]").forEach((button) => {
      button.classList.add("secondary");
    });
  }

  function cleanupDialogHeaders() {
    document.querySelectorAll("dialog .panel-head, dialog .stage-dialog-head").forEach((head) => {
      const expand = head.querySelector(".weset-expand-btn");
      const close = head.querySelector("button[aria-label='Close'], .icon-btn");
      if (expand && close && expand.nextElementSibling !== close) head.insertBefore(expand, close);
    });
  }

  function runCleanup() {
    ensureStyles();
    cleanupLoginOverlay();
    cleanupInvoiceActions();
    cleanupQuoteActions();
    cleanupPendingQuoteActions();
    cleanupUserActions();
    cleanupItemActions();
    cleanupAccountingActions();
    cleanupDialogHeaders();
    if (typeof window.wesetCleanQuoteReferences === "function") window.wesetCleanQuoteReferences();
  }

  const cleanupObserverOptions = { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-status", "data-record-invoice-payment", "data-mark-invoice-paid", "data-send-in-app", "data-invoice-quote"] };
  let cleanupObserver = null;
  let cleanupRunning = false;
  function runCleanupNow() {
    if (cleanupRunning) return;
    cleanupRunning = true;
    cleanupObserver?.disconnect();
    try {
      runCleanup();
    } finally {
      cleanupRunning = false;
      if (document.body && cleanupObserver) cleanupObserver.observe(document.body, cleanupObserverOptions);
    }
  }

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(runCleanup, 120);
    };
  })();

  document.addEventListener("click", () => setTimeout(runCleanup, 180), true);
  document.addEventListener("input", schedule, true);
  window.addEventListener("hashchange", () => setTimeout(runCleanup, 250));
  window.addEventListener("storage", schedule);

  cleanupObserver = new MutationObserver(runCleanupNow);
  if (document.body) cleanupObserver.observe(document.body, cleanupObserverOptions);
  runCleanupNow();
  setTimeout(runCleanupNow, 1200);
})();

