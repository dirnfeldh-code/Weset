(() => {
  let lastPointerAt = 0;
  let heavyRefreshAllowedUntil = 0;

  function accountingIsOpen() {
    const view = document.querySelector("#accountingView");
    return location.hash === "#accounting" || view?.classList.contains("is-visible");
  }

  function rememberPointer(event) {
    lastPointerAt = Date.now();
    if (event.target?.closest?.("#businessChainRefresh, #refreshAccountingReportsBtn, #applyAccountingReportsBtn, [data-export-report]")) {
      heavyRefreshAllowedUntil = Date.now() + 1800;
    }
  }

  function recentPointer() {
    return Date.now() - lastPointerAt < 1600;
  }

  function heavyRefreshAllowed() {
    return Date.now() < heavyRefreshAllowedUntil;
  }

  function preserveScroll(work) {
    const x = window.scrollX;
    const y = window.scrollY;
    const active = document.activeElement;
    const result = work();
    requestAnimationFrame(() => {
      window.scrollTo(x, y);
      if (active && document.contains(active) && typeof active.focus === "function") {
        try { active.focus({ preventScroll: true }); } catch {}
      }
    });
    return result;
  }

  function softAccountingUpdate() {
    if (typeof window.wesetRepairBusinessChain === "function") {
      try { window.wesetRepairBusinessChain(); } catch {}
    }
  }

  document.addEventListener("pointerdown", rememberPointer, true);
  document.addEventListener("click", rememberPointer, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" || event.key === "Enter" || event.key === " ") lastPointerAt = Date.now();
  }, true);

  const originalRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (originalRenderAccounting) {
    renderAccounting = function renderAccountingWithoutJump(...args) {
      if (accountingIsOpen() && recentPointer() && !heavyRefreshAllowed()) {
        softAccountingUpdate();
        return undefined;
      }
      return preserveScroll(() => originalRenderAccounting.apply(this, args));
    };
  }

  const originalRefreshReports = typeof window.wesetRefreshAccountingReports === "function" ? window.wesetRefreshAccountingReports : null;
  if (originalRefreshReports) {
    window.wesetRefreshAccountingReports = function refreshReportsWithoutJump(...args) {
      if (accountingIsOpen() && recentPointer() && !heavyRefreshAllowed()) return Promise.resolve(false);
      return preserveScroll(() => originalRefreshReports.apply(this, args));
    };
  }

  const originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function scrollIntoViewWithoutAccountingJump(...args) {
    if (accountingIsOpen() && recentPointer() && !this.closest?.("dialog")) return undefined;
    return originalScrollIntoView.apply(this, args);
  };

  window.wesetAllowAccountingRefresh = () => {
    heavyRefreshAllowedUntil = Date.now() + 1800;
    if (typeof renderAccounting === "function") renderAccounting();
  };
})();
