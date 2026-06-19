(() => {
  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value || 0);
  }

  function allowNegativeInputs() {
    [
      "#expenseAmount",
      "#vatPaymentAmount",
      "#quoteVatRate",
      "#itemUnitCost"
    ].forEach((selector) => document.querySelector(selector)?.removeAttribute("min"));

    document.querySelectorAll("[data-item-cost]").forEach((input) => input.removeAttribute("min"));
  }

  function signedQuoteCosts(quote) {
    const items = quote?.items || [];
    const supply = items
      .filter((item) => item.category !== "Services")
      .reduce((sum, item) => sum + toNumber(item.quantity || 1) * toNumber(item.unitCost), 0);
    const services = items
      .filter((item) => item.category === "Services")
      .reduce((sum, item) => sum + toNumber(item.quantity || 1) * toNumber(item.unitCost), 0);
    return { supply, services, total: supply + services };
  }

  if (typeof quoteCosts === "function") quoteCosts = signedQuoteCosts;

  if (typeof updateSelectedItemsFromInputs === "function") {
    updateSelectedItemsFromInputs = function updateSelectedItemsWithNegatives(event) {
      const id = event.target.dataset.itemQuantity || event.target.dataset.itemCost;
      if (!id) return;
      selectedQuoteItems = selectedQuoteItems.map((item) => item.id === id ? {
        ...item,
        quantity: event.target.dataset.itemQuantity ? toNumber(event.target.value || 0) : item.quantity,
        unitCost: event.target.dataset.itemCost ? toNumber(event.target.value || 0) : item.unitCost
      } : item);
      renderSelectedItems();
    };
  }

  if (typeof renderSelectedItems === "function") {
    const oldRenderSelectedItems = renderSelectedItems;
    renderSelectedItems = function renderSelectedItemsAllowingNegatives() {
      oldRenderSelectedItems();
      allowNegativeInputs();
    };
  }

  if (typeof renderAccounting === "function") {
    const oldRenderAccounting = renderAccounting;
    renderAccounting = function renderAccountingAllowingNegatives() {
      oldRenderAccounting();
      allowNegativeInputs();
      if (typeof renderVatSummary === "function") renderVatSummary();
    };
  }

  window.wesetSignedQuoteCosts = signedQuoteCosts;

  document.addEventListener("input", (event) => {
    if (event.target?.matches?.("#expenseAmount, #vatPaymentAmount, #quoteVatRate, [data-item-cost], #itemUnitCost")) {
      event.target.removeAttribute("min");
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target?.matches?.("#vatPaymentForm")) {
      const amountInput = document.querySelector("#vatPaymentAmount");
      if (amountInput) amountInput.removeAttribute("min");
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .is-negative-money {
      color: #a2413a !important;
    }
    .is-positive-money {
      color: #145c58 !important;
    }
  `;
  document.head.appendChild(style);

  function markNegativeMoney() {
    document.querySelectorAll(".vat-summary-row strong, .account-line strong, .breakdown-row strong, td strong, .metric strong").forEach((node) => {
      const text = node.textContent || "";
      const negative = text.includes("-") || text.includes("(£");
      node.classList.toggle("is-negative-money", negative);
      node.classList.toggle("is-positive-money", !negative && /£|%/.test(text));
    });
  }

  const observer = new MutationObserver(() => markNegativeMoney());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  allowNegativeInputs();
  markNegativeMoney();
})();
