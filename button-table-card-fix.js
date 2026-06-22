(() => {
  function ensureStyles() {
    if (document.querySelector("#buttonTableCardFixStyles")) return;
    const style = document.createElement("style");
    style.id = "buttonTableCardFixStyles";
    style.textContent = `
      @media (max-width: 760px) {
        .table-wrap {
          overflow-x: visible !important;
        }
        .table-wrap table, .table-wrap thead, .table-wrap tbody, .table-wrap tr, .table-wrap th, .table-wrap td,
        #clientsTable, #clientsTable tbody,
        #usersTable, #usersTable tbody,
        #liveInvoicesTable, #liveInvoicesTable tbody,
        #expensesTable, #expensesTable tbody,
        #salesTable, #salesTable tbody,
        #monthlyAccounts, #monthlyAccounts tbody {
          box-sizing: border-box !important;
          display: block !important;
          width: 100% !important;
        }
        .table-wrap thead {
          display: none !important;
        }
        .table-wrap tr, #clientsTable tr, #usersTable tr, #liveInvoicesTable tr, #expensesTable tr, #salesTable tr, #monthlyAccounts tr {
          border: 1px solid var(--line, #d9e0e1) !important;
          border-radius: 8px !important;
          display: grid !important;
          gap: 8px !important;
          grid-template-columns: minmax(0, 1fr) !important;
          margin: 0 0 10px !important;
          padding: 10px !important;
          width: 100% !important;
        }
        .table-wrap td, #clientsTable td, #usersTable td, #liveInvoicesTable td, #expensesTable td, #salesTable td, #monthlyAccounts td {
          border: 0 !important;
          box-sizing: border-box !important;
          display: block !important;
          min-width: 0 !important;
          padding: 4px 0 !important;
          width: 100% !important;
        }
        .table-wrap td:last-child,
        #clientsTable td:last-child, #usersTable td:last-child, #liveInvoicesTable td:last-child, #expensesTable td:last-child, #salesTable td:last-child, #monthlyAccounts td:last-child,
        #clientsTable .client-row-actions, #usersTable .user-row-actions {
          display: grid !important;
          gap: 8px !important;
          grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)) !important;
          min-width: 0 !important;
          width: 100% !important;
        }
        .table-wrap .card-actions,
        #clientsTable .client-row-actions .card-actions, #usersTable .user-row-actions .card-actions,
        #liveInvoicesTable .invoice-row-actions, #expensesTable td:last-child .button-polish-row {
          display: grid !important;
          gap: 8px !important;
          grid-column: 1 / -1 !important;
          grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)) !important;
          width: 100% !important;
        }
        .table-wrap button,
        #clientsTable button, #usersTable button, #liveInvoicesTable button, #expensesTable button, #salesTable button, #monthlyAccounts button {
          box-sizing: border-box !important;
          justify-content: center !important;
          min-height: 36px !important;
          min-width: 0 !important;
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
