(() => {
  function ensureStyles() {
    if (document.querySelector("#buttonTableCardFixStyles")) return;
    const style = document.createElement("style");
    style.id = "buttonTableCardFixStyles";
    style.textContent = `
      @media (max-width: 760px) {
        #clientsTable, #clientsTable tbody,
        #usersTable, #usersTable tbody,
        #liveInvoicesTable, #liveInvoicesTable tbody,
        #expensesTable, #expensesTable tbody,
        #salesTable, #salesTable tbody,
        #monthlyAccounts, #monthlyAccounts tbody {
          display: block !important;
          width: 100% !important;
        }
        #clientsTable tr, #usersTable tr, #liveInvoicesTable tr, #expensesTable tr, #salesTable tr, #monthlyAccounts tr {
          display: grid !important;
          gap: 8px !important;
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
          gap: 8px !important;
          grid-template-columns: repeat(auto-fit, minmax(108px, 1fr)) !important;
          min-width: 0 !important;
          width: 100% !important;
        }
        #clientsTable .client-row-actions .card-actions, #usersTable .user-row-actions .card-actions,
        #liveInvoicesTable .invoice-row-actions, #expensesTable td:last-child .button-polish-row {
          display: grid !important;
          gap: 8px !important;
          grid-column: 1 / -1 !important;
          grid-template-columns: repeat(auto-fit, minmax(108px, 1fr)) !important;
          width: 100% !important;
        }
        #clientsTable button, #usersTable button, #liveInvoicesTable button, #expensesTable button, #salesTable button, #monthlyAccounts button {
          box-sizing: border-box !important;
          justify-content: center !important;
          min-height: 36px !important;
          min-width: 88px !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
          white-space: nowrap !important;
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
