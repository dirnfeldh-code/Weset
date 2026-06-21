(() => {
  function ensureStyles() {
    if (document.querySelector("#paymentVisibilityFixStyles")) return;
    const style = document.createElement("style");
    style.id = "paymentVisibilityFixStyles";
    style.textContent = `
      #accountingActionsSection #clientPaymentsPanel { display: block !important; }
      #accountingActionsSection #clientPaymentForm { display: grid !important; }
      #accountingActionsSection #clientPaymentSummary { display: grid !important; }
      #accountingActionsSection #clientPaymentsTable { display: table-row-group !important; }
      #accountingActionsSection .client-payments-panel { margin-top: 0 !important; }
      .payment-restore-shortcut { align-items: center; background: #eef5f4; border: 1px solid #d9e0e1; border-radius: 8px; display: flex; gap: 10px; justify-content: space-between; margin: 0 0 12px; padding: 10px 12px; }
      .payment-restore-shortcut strong { color: #145c58; }
      @media (max-width: 680px) { .payment-restore-shortcut { align-items: stretch; flex-direction: column; } }
    `;
    document.head.appendChild(style);
  }

  function showAccountingSection(section) {
    document.querySelectorAll("[data-accounting-section]").forEach((button) => button.classList.toggle("is-active", button.dataset.accountingSection === section));
    document.querySelectorAll("[data-accounting-section-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.accountingSectionPanel === section));
  }

  function movePaymentsToActions() {
    ensureStyles();
    const actions = document.querySelector("#accountingActionsSection");
    const panel = document.querySelector("#clientPaymentsPanel");
    if (actions && panel && panel.parentElement !== actions) actions.appendChild(panel);
    const form = document.querySelector("#clientPaymentForm");
    const table = document.querySelector("#clientPaymentsTable");
    if (form) form.style.display = "grid";
    if (table) table.style.display = "table-row-group";
  }

  function addRecordsShortcut() {
    const records = document.querySelector("#accountingRecordsSection");
    if (!records || document.querySelector("#paymentRestoreShortcut")) return;
    const shortcut = document.createElement("div");
    shortcut.id = "paymentRestoreShortcut";
    shortcut.className = "payment-restore-shortcut";
    shortcut.innerHTML = `<strong>Need to record a payment?</strong><button class="secondary" type="button">Open payment form</button>`;
    records.prepend(shortcut);
    shortcut.querySelector("button")?.addEventListener("click", () => {
      showAccountingSection("actions");
      setTimeout(() => document.querySelector("#clientPaymentsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    });
  }

  function repair() {
    movePaymentsToActions();
    addRecordsShortcut();
  }

  document.addEventListener("click", () => setTimeout(repair, 120), true);
  document.addEventListener("submit", () => setTimeout(repair, 250), true);
  window.addEventListener("hashchange", () => setTimeout(repair, 250));
  setTimeout(repair, 250);
  setTimeout(repair, 1000);
  setTimeout(repair, 2500);
})();
