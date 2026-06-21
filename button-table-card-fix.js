(() => {
  function ensureStyles() {
    if (document.querySelector("#buttonTableCardFixStyles")) return;
    const style = document.createElement("style");
    style.id = "buttonTableCardFixStyles";
    style.textContent = `
      @media (max-width: 760px) {
        #clientsTable tr, #usersTable tr, #liveInvoicesTable tr, #expensesTable tr, #salesTable tr, #monthlyAccounts tr {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          width: 100% !important;
        }
        #clientsTable td, #usersTable td, #liveInvoicesTable td, #expensesTable td, #salesTable td, #monthlyAccounts td {
          box-sizing: border-box !important;
          display: block !important;
          min-width: 0 !important;
          width: 100% !important;
        }
        #clientsTable td:last-child, #usersTable td:last-child, #liveInvoicesTable td:last-child, #expensesTable td:last-child, #salesTable td:last-child, #monthlyAccounts td:last-child,
        #clientsTable .client-row-actions, #usersTable .user-row-actions {
          display: grid !important;
          gap: 7px !important;
          grid-template-columns: minmax(0, 1fr) !important;
          min-width: 0 !important;
          width: 100% !important;
        }
        #clientsTable .client-row-actions .card-actions, #usersTable .user-row-actions .card-actions,
        #liveInvoicesTable .invoice-row-actions, #expensesTable td:last-child .button-polish-row {
          display: grid !important;
          gap: 7px !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
        }
        #clientsTable .client-row-actions > button, #usersTable .user-row-actions > button,
        #clientsTable .client-row-actions .card-actions button, #usersTable .user-row-actions .card-actions button,
        #liveInvoicesTable .invoice-row-actions button, #expensesTable td:last-child button, #salesTable td:last-child button, #monthlyAccounts td:last-child button {
          box-sizing: border-box !important;
          min-width: 0 !important;
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function run() {
    ensureStyles();
  }

  const observer = new MutationObserver(run);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(run, 200);
  setTimeout(run, 1000);
})();
