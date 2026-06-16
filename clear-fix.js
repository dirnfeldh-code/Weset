(() => {
  function field(selector) {
    return document.querySelector(selector);
  }

  function clearValue(selector) {
    const input = field(selector);
    if (input) input.value = "";
  }

  function setStatus(message, type = "is-ok") {
    const status = field("#addressStatus");
    if (status) {
      status.textContent = message;
      status.className = `address-status ${type}`.trim();
    }
  }

  function clearSelectedClient() {
    const select = field("#quoteClient");
    if (!select) return;
    select.selectedIndex = -1;
    select.value = "";
  }

  function clearQuoteFormHard() {
    const form = field("#quoteForm");
    if (form) form.reset();

    clearSelectedClient();
    [
      "#roomCount",
      "#workstations",
      "#requiredDate",
      "#addressLine1",
      "#addressLine2",
      "#addressCity",
      "#addressPostcode",
      "#premises",
      "#quoteNotes"
    ].forEach(clearValue);

    if (typeof selectedQuoteItems !== "undefined") selectedQuoteItems = [];

    const preview = field("#addressPreview");
    if (preview) preview.textContent = "No setup address entered yet.";
    setStatus("Quote form cleared. Choose a client, enter the setup address, and add items again.");

    if (typeof renderSelectedItems === "function") renderSelectedItems();
    const total = field("#quoteTotalPreview");
    if (total) total.textContent = "Total £0";
  }

  function handleClearClick(event) {
    const button = event.target.closest?.("#resetQuoteFormBtn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    clearQuoteFormHard();
    setTimeout(clearQuoteFormHard, 0);
    setTimeout(clearQuoteFormHard, 60);
  }

  document.addEventListener("click", handleClearClick, true);

  if (typeof resetQuoteForm === "function") {
    resetQuoteForm = clearQuoteFormHard;
  }

  window.wesetClearQuoteForm = clearQuoteFormHard;
})();
