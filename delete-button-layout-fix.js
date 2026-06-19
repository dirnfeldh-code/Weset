(() => {
  const style = document.createElement("style");
  style.textContent = `
    button.danger,
    .danger,
    [data-delete-item],
    [data-delete-client],
    [data-delete-quote],
    [data-delete-expense],
    [data-delete-invoice],
    [data-remove-item] {
      align-items: center !important;
      border: 1px solid rgba(162, 65, 58, 0.18) !important;
      border-radius: 6px !important;
      color: #a2413a !important;
      display: inline-flex !important;
      flex: 0 0 auto !important;
      font-size: 13px !important;
      justify-content: center !important;
      line-height: 1 !important;
      min-height: 34px !important;
      min-width: 72px !important;
      overflow: hidden !important;
      padding: 0 10px !important;
      text-align: center !important;
      white-space: nowrap !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
    }

    button.danger:hover,
    [data-delete-item]:hover,
    [data-delete-client]:hover,
    [data-delete-quote]:hover,
    [data-delete-expense]:hover,
    [data-delete-invoice]:hover {
      background: #f8e7e4 !important;
    }

    .item-catalog-actions,
    .quote-record-actions,
    .card-actions,
    td:last-child {
      align-items: center !important;
    }

    #itemsView .item-catalog-actions {
      display: flex !important;
      flex-wrap: nowrap !important;
      gap: 8px !important;
      justify-content: flex-end !important;
    }

    #itemsView .item-catalog-actions button {
      width: auto !important;
    }

    #itemsView [data-edit-item],
    #itemsView [data-delete-item] {
      min-width: 78px !important;
    }

    .selected-item [data-remove-item] {
      border-radius: 50% !important;
      height: 34px !important;
      min-width: 34px !important;
      padding: 0 !important;
      width: 34px !important;
    }

    td [data-delete-expense] {
      min-width: 74px !important;
    }

    @media (max-width: 760px) {
      #itemsView .item-catalog-actions {
        justify-content: stretch !important;
      }

      #itemsView .item-catalog-actions button {
        flex: 1 1 0 !important;
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
