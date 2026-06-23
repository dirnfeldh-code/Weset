(() => {
  function ensureStyles() {
    if (document.querySelector("#buttonPolishFinalFixStyles")) return;
    const style = document.createElement("style");
    style.id = "buttonPolishFinalFixStyles";
    style.textContent = `
      .button-polish-row {
        align-items: center !important;
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 7px !important;
        width: 100% !important;
      }
      .button-polish-row button { flex: 0 1 auto !important; min-width: 72px !important; }
      @media (max-width: 760px) {
        .button-polish-row {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .button-polish-row button { min-width: 0 !important; width: 100% !important; }
        #liveInvoicesTable, #liveInvoicesTable thead, #liveInvoicesTable tbody, #liveInvoicesTable tr, #liveInvoicesTable th, #liveInvoicesTable td,
        #expensesTable, #expensesTable thead, #expensesTable tbody, #expensesTable tr, #expensesTable th, #expensesTable td,
        #salesTable, #salesTable thead, #salesTable tbody, #salesTable tr, #salesTable th, #salesTable td,
        #monthlyAccounts, #monthlyAccounts thead, #monthlyAccounts tbody, #monthlyAccounts tr, #monthlyAccounts th, #monthlyAccounts td {
          display: block !important;
          width: 100% !important;
        }
        #liveInvoicesTable thead, #expensesTable thead, #salesTable thead, #monthlyAccounts thead { display: none !important; }
        #liveInvoicesTable tr, #expensesTable tr, #salesTable tr, #monthlyAccounts tr {
          border: 1px solid var(--line,#d9e0e1) !important;
          border-radius: 8px !important;
          margin: 0 0 10px !important;
          padding: 10px !important;
        }
        #liveInvoicesTable td, #expensesTable td, #salesTable td, #monthlyAccounts td {
          border: 0 !important;
          padding: 5px 0 !important;
        }
        #liveInvoicesTable td:last-child, #expensesTable td:last-child, #salesTable td:last-child, #monthlyAccounts td:last-child {
          min-width: 0 !important;
        }
        #liveInvoicesTable .invoice-row-actions, #expensesTable td:last-child, #salesTable td:last-child, #monthlyAccounts td:last-child {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 7px !important;
          width: 100% !important;
        }
        #liveInvoicesTable .invoice-row-actions button, #expensesTable td:last-child button, #salesTable td:last-child button, #monthlyAccounts td:last-child button {
          min-width: 0 !important;
          width: 100% !important;
        }
        #clientsTable td:last-child .button-polish-row, #usersTable td:last-child .button-polish-row {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
        }
        #clientsTable td:last-child .button-polish-row button, #usersTable td:last-child .button-polish-row button {
          min-width: 0 !important;
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function wrapActionCell(cell) {
    if (!cell || cell.querySelector(":scope > .button-polish-row")) return;
    const buttons = [...cell.children].filter((child) => child.tagName === "BUTTON");
    if (buttons.length < 2) return;
    const row = document.createElement("div");
    row.className = "button-polish-row";
    buttons[0].before(row);
    buttons.forEach((button) => row.appendChild(button));
  }

  function normalizeButtons() {
    document.querySelectorAll("#clientsTable td:last-child, #usersTable td:last-child, #expensesTable td:last-child, #salesTable td:last-child, #monthlyAccounts td:last-child").forEach(wrapActionCell);
    document.querySelectorAll("#liveInvoicesTable .invoice-row-actions button, #expensesTable td:last-child button, #clientsTable td:last-child button, #usersTable td:last-child button").forEach((button) => {
      button.style.minWidth = "0";
    });
  }

  function run() {
    ensureStyles();
    normalizeButtons();
  }

  const schedule = (() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(run, 80);
    };
  })();

  document.addEventListener("click", () => setTimeout(run, 120), true);
  window.addEventListener("hashchange", () => setTimeout(run, 180));
  const observer = new MutationObserver(schedule);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(run, 250);
  setTimeout(run, 1200);
})();
