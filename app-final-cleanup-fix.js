(() => {
  const sessionKeyName = typeof sessionKey !== "undefined" ? sessionKey : "we-set-session";

  function hasSession() {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKeyName) || "null");
      return Boolean(session?.accessToken || session?.id || session?.email);
    } catch (_) {
      return false;
    }
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

  function cleanupQuoteActions() {
    document.querySelectorAll("[data-send-quote], .stage-hidden").forEach((button) => {
      if (/prepare email/i.test(button.textContent || "")) button.remove();
    });
    document.querySelectorAll("[data-status]").forEach((button) => {
      const status = String(button.dataset.status || "").split(":").pop()?.toLowerCase();
      if (status === "sent") button.remove();
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
    cleanupUserActions();
    cleanupItemActions();
    cleanupAccountingActions();
    cleanupDialogHeaders();
    if (typeof window.wesetCleanQuoteReferences === "function") window.wesetCleanQuoteReferences();
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

  const observer = new MutationObserver(schedule);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-status", "data-record-invoice-payment", "data-mark-invoice-paid"] });
  setTimeout(runCleanup, 250);
  setTimeout(runCleanup, 1200);
  setInterval(runCleanup, 3500);
})();
