(() => {
  function clearIdleTimers() {
    const highestId = window.setInterval(() => {}, 60000);
    for (let id = 1; id <= highestId; id += 1) window.clearInterval(id);
    window.clearInterval(highestId);
    document.body?.setAttribute("data-weset-idle-timers-cleared", "true");
  }

  function refreshAfterUserAction() {
    if (typeof window.wesetRefreshAccountingReports === "function") {
      try { window.wesetRefreshAccountingReports(); } catch {}
    }
  }

  document.addEventListener("click", () => setTimeout(refreshAfterUserAction, 250), true);
  document.addEventListener("submit", () => setTimeout(refreshAfterUserAction, 500), true);
  document.addEventListener("change", () => setTimeout(refreshAfterUserAction, 250), true);

  window.setTimeout(clearIdleTimers, 3200);
  window.setTimeout(clearIdleTimers, 7000);
})();
