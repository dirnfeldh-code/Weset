(() => {
  const SESSION_KEY = typeof sessionKey !== "undefined" ? sessionKey : "we-set-session";
  let verificationPromise = null;
  let verifiedToken = "";

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function hasSupabaseCredentials(session = readSession()) {
    return Boolean(session.accessToken && session.refreshToken);
  }

  function installStyles() {
    if (document.querySelector("#wesetSupabaseAuthGuardStyles")) return;
    const style = document.createElement("style");
    style.id = "wesetSupabaseAuthGuardStyles";
    style.textContent = `
      body:not(.weset-auth-verified) .app-shell,
      body.weset-auth-checking .app-shell,
      body.weset-auth-required .app-shell {
        display: none !important;
      }
      body.weset-auth-required #loginScreen {
        display: flex !important;
      }
    `;
    document.head.appendChild(style);
  }

  function setMessage(message, ok = false) {
    const target = document.querySelector("#loginError");
    if (!target) return;
    target.textContent = message;
    target.style.color = ok ? "#157a5b" : "";
  }

  function lockApp(message = "Sign in with your Supabase email and password to continue.", clearSession = false) {
    if (clearSession) {
      try { localStorage.removeItem(SESSION_KEY); } catch {}
    }
    verifiedToken = "";
    window.wesetSupabaseAuthVerified = false;
    document.body.classList.remove("weset-auth-checking", "weset-auth-verified", "weset-logged-in");
    document.body.classList.add("weset-auth-required", "weset-logged-out");
    const login = document.querySelector("#loginScreen");
    login?.classList.remove("is-hidden", "cleanup-hidden");
    login?.removeAttribute("aria-hidden");
    setMessage(message);
  }

  function unlockApp() {
    window.wesetSupabaseAuthVerified = true;
    document.body.classList.remove("weset-auth-checking", "weset-auth-required", "weset-logged-out");
    document.body.classList.add("weset-auth-verified", "weset-logged-in");
    const login = document.querySelector("#loginScreen");
    login?.classList.add("is-hidden");
    login?.setAttribute("aria-hidden", "true");
    setMessage("");
  }

  async function requestSupabaseUser(token) {
    const response = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: {
        apikey: sbAnonKey,
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.msg || data.message || "Supabase rejected this session.");
    }
    return response.json();
  }

  async function verifySession(force = false) {
    const session = readSession();
    if (!hasSupabaseCredentials(session)) {
      lockApp("Sign in with your Supabase email and password to continue.", true);
      return false;
    }
    if (!force && verifiedToken === session.accessToken && window.wesetSupabaseAuthVerified) return true;
    if (verificationPromise) return verificationPromise;

    document.body.classList.add("weset-auth-checking");
    verificationPromise = (async () => {
      let current = session;
      try {
        const user = await requestSupabaseUser(current.accessToken);
        verifiedToken = current.accessToken;
        unlockApp();
        return user;
      } catch {
        if (typeof window.wesetRefreshSupabaseSession === "function") {
          const refreshed = await window.wesetRefreshSupabaseSession();
          current = readSession();
          if (refreshed && hasSupabaseCredentials(current)) {
            try {
              const user = await requestSupabaseUser(current.accessToken);
              verifiedToken = current.accessToken;
              unlockApp();
              return user;
            } catch {}
          }
        }
        lockApp("Your Supabase session is invalid or expired. Please sign in again.", true);
        return false;
      } finally {
        verificationPromise = null;
      }
    })();
    return verificationPromise;
  }

  installStyles();
  if (!hasSupabaseCredentials()) lockApp(undefined, true);
  else document.body.classList.add("weset-auth-checking");

  const originalUpdateAuthView = typeof updateAuthView === "function" ? updateAuthView : null;
  if (originalUpdateAuthView) {
    updateAuthView = function updateAuthViewWithSupabaseGuard(...args) {
      const session = readSession();
      if (!hasSupabaseCredentials(session)) {
        lockApp(undefined, true);
        return;
      }
      if (verifiedToken === session.accessToken && window.wesetSupabaseAuthVerified) {
        const result = originalUpdateAuthView.apply(this, args);
        unlockApp();
        return result;
      }
      verifySession().then((valid) => {
        if (!valid) return;
        originalUpdateAuthView.apply(this, args);
        unlockApp();
      });
    };
  }

  document.addEventListener("submit", (event) => {
    if (event.target?.id !== "loginForm") return;
    setTimeout(() => verifySession(true).then((valid) => {
      if (valid && typeof updateAuthView === "function") updateAuthView();
    }), 350);
  }, true);

  window.wesetVerifySupabaseSession = () => verifySession(true);
  setTimeout(() => verifySession(), 0);
})();

