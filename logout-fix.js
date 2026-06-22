(() => {
  const SESSION_KEY = typeof sessionKey !== "undefined" ? sessionKey : "we-set-session";

  function clearAuthStorage() {
    try {
      localStorage.removeItem(SESSION_KEY);
      Object.keys(localStorage).forEach((key) => {
        const lower = key.toLowerCase();
        if (lower.includes("supabase") || lower.startsWith("sb-") || lower.includes("auth-token")) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
  }

  function hasSavedLogin() {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      return Boolean(saved?.accessToken || saved?.refreshToken || saved?.email || saved?.id);
    } catch {
      return false;
    }
  }

  function setLoggedOutView(message = "") {
    const login = document.querySelector("#loginScreen");
    const shell = document.querySelector(".app-shell");
    const error = document.querySelector("#loginError");

    document.body.classList.add("weset-logged-out");
    document.body.classList.remove("weset-logged-in");
    login?.classList.remove("is-hidden", "cleanup-hidden");
    if (shell) shell.style.display = "none";
    if (error && message) {
      error.textContent = message;
      error.style.color = "#157a5b";
    }
  }

  function setLoggedInView() {
    const shell = document.querySelector(".app-shell");
    document.body.classList.add("weset-logged-in");
    document.body.classList.remove("weset-logged-out");
    if (shell) shell.style.display = "";
  }

  function syncAuthView() {
    if (hasSavedLogin()) setLoggedInView();
    else setLoggedOutView();
  }

  function logout(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
    clearAuthStorage();
    setLoggedOutView("You have been logged out.");
  }

  function installLogoutHandler() {
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#logoutBtn");
      if (!button) return;
      logout(event);
    }, true);
  }

  const originalUpdateAuthView = typeof updateAuthView === "function" ? updateAuthView : null;
  if (originalUpdateAuthView && !window.wesetLogoutFixWrapped) {
    window.wesetLogoutFixWrapped = true;
    updateAuthView = function updateAuthViewWithLogoutGuard(...args) {
      const result = originalUpdateAuthView.apply(this, args);
      setTimeout(syncAuthView, 0);
      return result;
    };
  }

  window.wesetLogout = logout;
  installLogoutHandler();
  setTimeout(syncAuthView, 100);
  setTimeout(syncAuthView, 800);
})();