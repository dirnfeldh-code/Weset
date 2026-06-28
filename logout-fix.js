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
      return Boolean(saved?.accessToken && saved?.refreshToken);
    } catch {
      return false;
    }
  }

  function ensureLogoutStyles() {
    if (document.querySelector("#wesetLogoutFixStyles")) return;
    const style = document.createElement("style");
    style.id = "wesetLogoutFixStyles";
    style.textContent = `
      body.weset-logged-out .app-shell,
      body.weset-logged-out #logoutBtn {
        display: none !important;
      }
      body.weset-logged-out #loginScreen {
        display: flex !important;
      }
    `;
    document.head.appendChild(style);
  }

  function setLoggedOutView(message = "") {
    const login = document.querySelector("#loginScreen");
    const shell = document.querySelector(".app-shell");
    const error = document.querySelector("#loginError");

    ensureLogoutStyles();
    document.body.classList.add("weset-logged-out");
    document.body.classList.remove("weset-logged-in");
    login?.classList.remove("is-hidden", "cleanup-hidden");
    login?.removeAttribute("aria-hidden");
    if (shell) {
      shell.style.display = "none";
      shell.setAttribute("aria-hidden", "true");
    }
    if (error && message) {
      error.textContent = message;
      error.style.color = "#157a5b";
    }
  }

  function setLoggedInView() {
    const login = document.querySelector("#loginScreen");
    const shell = document.querySelector(".app-shell");
    document.body.classList.add("weset-logged-in");
    document.body.classList.remove("weset-logged-out");
    login?.setAttribute("aria-hidden", "true");
    if (shell) {
      shell.style.display = "";
      shell.removeAttribute("aria-hidden");
    }
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

