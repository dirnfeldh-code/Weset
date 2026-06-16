(() => {
  if (typeof window.className !== "function") {
    window.className = (value) => typeof cls === "function" ? cls(value) : String(value || "").replaceAll(" ", "-");
  }

  if (typeof window.formatMoney !== "function") {
    window.formatMoney = (value) => typeof money === "function"
      ? money(value)
      : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
  }

  if (typeof window.formatDate !== "function") {
    window.formatDate = (value) => typeof date === "function"
      ? date(value)
      : value
        ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`))
        : "No date";
  }

  function runSafely(action) {
    try {
      const result = action();
      if (result?.catch) result.catch((error) => alert(`This button could not finish: ${error.message || "Please check the form and try again."}`));
    } catch (error) {
      alert(`This button could not finish: ${error.message || "Please check the form and try again."}`);
    }
  }

  function setAddressMessage(fields, message, type = "is-warn") {
    if (!fields?.status) return;
    fields.status.textContent = message;
    fields.status.className = `address-status ${type}`.trim();
  }

  function resetQuoteFormReliable() {
    const form = document.querySelector("#quoteForm");
    if (form) form.reset();
    if (typeof sbResetQuoteForm === "function") sbResetQuoteForm();
    else if (typeof resetQuoteForm === "function") resetQuoteForm();
    if (typeof renderSelectedItems === "function") renderSelectedItems();
    if (typeof updateAddressPreview === "function" && typeof setupAddressFields === "function") updateAddressPreview(setupAddressFields());
    if (typeof render === "function") render();
  }

  function lookupAddressReliable(fields, label) {
    if (!fields) return;
    if (typeof sbLookupPostcodeAddress === "function") return sbLookupPostcodeAddress(fields, label);
    if (typeof lookupPostcodeAddress === "function") return lookupPostcodeAddress(fields, label);
    setAddressMessage(fields, "Address lookup is not ready yet. Refresh and try again.");
  }

  function checkAddressReliable() {
    if (typeof sbCheckSetupAddressOnGoogleMaps === "function") return sbCheckSetupAddressOnGoogleMaps();
    if (typeof checkAddressOnGoogleMaps === "function") return checkAddressOnGoogleMaps();
    const fields = typeof setupAddressFields === "function" ? setupAddressFields() : null;
    setAddressMessage(fields, "Google Maps check is not ready yet. Refresh and try again.");
  }

  const dialogCloseMap = {
    closeClientDialog: "clientDialog",
    closeUserDialog: "userDialog",
    closeItemDialog: "itemDialog",
    closeQuoteDialog: "quoteDialog"
  };

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest?.("#resetQuoteFormBtn, #lookupAddressBtn, #lookupClientAddressBtn, #checkAddressBtn");
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      if (actionButton.id === "resetQuoteFormBtn") runSafely(resetQuoteFormReliable);
      if (actionButton.id === "lookupAddressBtn") runSafely(() => lookupAddressReliable(setupAddressFields(), "setup"));
      if (actionButton.id === "lookupClientAddressBtn") runSafely(() => lookupAddressReliable(clientAddressFields(), "company"));
      if (actionButton.id === "checkAddressBtn") runSafely(checkAddressReliable);
      return;
    }

    const closeButton = event.target.closest?.("#closeClientDialog, #closeUserDialog, #closeItemDialog, #closeQuoteDialog");
    if (closeButton) {
      event.preventDefault();
      event.stopPropagation();
      const dialog = document.getElementById(dialogCloseMap[closeButton.id]);
      if (dialog?.open) dialog.close();
      return;
    }

    const removeButton = event.target.closest?.("#selectedItems [data-remove-item]");
    if (removeButton) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof removeSelectedItem === "function") {
        removeSelectedItem({ target: removeButton });
      }
    }
  }, true);
})();
