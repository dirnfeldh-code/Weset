(() => {
  function ensureStyles() {
    if (document.querySelector("#buttonPolishFixStyles")) return;
    const style = document.createElement("style");
    style.id = "buttonPolishFixStyles";
    style.textContent = `
      button, .button, .primary, .secondary, .ghost, .icon-btn {
        box-sizing: border-box !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
        text-align: center !important;
        white-space: normal !important;
      }
      .topbar-actions button, .panel-head button, .card-actions button, .quote-record-actions button,
      .invoice-row-actions button, .stage-action-row button, .catalog-item .card-actions button,
      #clientsTable button, #expensesTable button, #usersTable button {
        font-size: 13px !important;
        line-height: 1.15 !important;
        min-height: 34px !important;
        padding: 7px 10px !important;
      }
      .icon-btn { aspect-ratio: 1 / 1; min-width: 34px !important; width: 34px !important; }
      .card-actions, .quote-record-actions, .invoice-row-actions, .stage-action-row, .catalog-item .card-actions {
        align-items: center !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 7px !important;
      }
      .card-actions button, .quote-record-actions button, .stage-action-row button, .catalog-item .card-actions button {
        flex: 0 1 auto !important;
      }
      .invoice-row-actions { justify-content: flex-start !important; min-width: 0 !important; }
      .invoice-row-actions button { flex: 0 1 auto !important; }
      #clientsTable td:last-child, #usersTable td:last-child, #expensesTable td:last-child,
      #liveInvoicesTable td:last-child { min-width: 170px !important; }
      #clientsTable td:last-child > *, #usersTable td:last-child > *, #expensesTable td:last-child > *,
      #liveInvoicesTable td:last-child > * { display: flex; flex-wrap: wrap; gap: 6px; }
      .quote-card .stage-note { line-height: 1.35 !important; }
      .weset-expand-btn { font-size: 12px !important; min-width: 64px !important; white-space: nowrap !important; }
      @media (max-width: 760px) {
        .card-actions, .quote-record-actions, .stage-action-row, .catalog-item .card-actions, .invoice-row-actions {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
        }
        .card-actions button, .quote-record-actions button, .stage-action-row button, .catalog-item .card-actions button, .invoice-row-actions button {
          width: 100% !important;
        }
        .topbar-actions {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
        }
        .topbar-actions button, .topbar-actions input { width: 100% !important; }
        .panel-head { gap: 8px !important; }
        .panel-head > button, .panel-head > .weset-expand-btn { align-self: flex-start !important; width: auto !important; }
        #clientsTable, #clientsTable thead, #clientsTable tbody, #clientsTable tr, #clientsTable th, #clientsTable td,
        #usersTable, #usersTable thead, #usersTable tbody, #usersTable tr, #usersTable th, #usersTable td {
          display: block !important;
          width: 100% !important;
        }
        #clientsTable thead, #usersTable thead { display: none !important; }
        #clientsTable tr, #usersTable tr {
          border: 1px solid var(--line,#d9e0e1) !important;
          border-radius: 8px !important;
          margin: 0 0 10px !important;
          padding: 10px !important;
        }
        #clientsTable td, #usersTable td {
          border: 0 !important;
          padding: 5px 0 !important;
        }
        #clientsTable td:last-child, #usersTable td:last-child { min-width: 0 !important; }
        #clientsTable td:last-child, #usersTable td:last-child { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 7px !important; }
        #clientsTable td:last-child button, #usersTable td:last-child button { width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const labels = [
    ["Find from postcode", "Find postcode"],
    ["Check Google Maps", "Check maps"],
    ["Save quote request", "Save quote"],
    ["Create quote request", "New quote"],
    ["Create new item", "New item"],
    ["Open payment form", "Record payment"],
    ["Open client chain", "Client history"],
    ["Mark accepted", "Accept"],
    ["Create invoice", "Invoice"],
    ["Open invoice", "Invoice"],
    ["Send invoice", "Send"],
    ["View invoice", "View"],
    ["Edit quote", "Edit"],
    ["Edit user", "Edit"]
  ];

  function polishLabels() {
    document.querySelectorAll("button").forEach((button) => {
      const current = button.textContent.trim().replace(/\s+/g, " ");
      const match = labels.find(([from]) => current === from);
      if (match) button.textContent = match[1];
      if (button.dataset.stageSendQuote) button.textContent = "Send quote";
      if (button.dataset.recordInvoicePayment) button.textContent = "Payment";
      if (button.dataset.deleteQuote || button.dataset.deleteItem || button.dataset.deleteClient || button.dataset.deleteUser) button.textContent = "Delete";
      if (button.dataset.editItem || button.dataset.editClient || button.dataset.editExpense || button.dataset.editUser) button.textContent = "Edit";
      if (button.dataset.clientHistory) button.textContent = "History";
    });
  }

  function groupLooseActionButtons() {
    document.querySelectorAll("#clientsTable td:last-child, #usersTable td:last-child, #expensesTable td:last-child").forEach((cell) => {
      if (cell.querySelector(":scope > .button-polish-row")) return;
      const buttons = [...cell.children].filter((child) => child.tagName === "BUTTON");
      if (buttons.length < 2) return;
      const row = document.createElement("div");
      row.className = "button-polish-row";
      buttons[0].before(row);
      buttons.forEach((button) => row.appendChild(button));
    });
  }

  function run() {
    ensureStyles();
    polishLabels();
    groupLooseActionButtons();
  }

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(run, 80);
    };
  })();

  document.addEventListener("click", () => setTimeout(run, 150), true);
  document.addEventListener("input", schedule, true);
  window.addEventListener("hashchange", () => setTimeout(run, 200));
  const observer = new MutationObserver(schedule);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  setTimeout(run, 250);
  setTimeout(run, 1200);
  setInterval(run, 4000);
})();
