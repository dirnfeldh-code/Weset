(() => {
  const fullPermissions = () => {
    if (typeof views !== "undefined" && Array.isArray(views)) return [...views];
    if (typeof allViews !== "undefined" && Array.isArray(allViews)) return [...allViews];
    return ["dashboard", "clients", "quotes", "items", "installations", "accounting", "users"];
  };

  function readSavedSession() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "{}");
    } catch {
      return {};
    }
  }

  function writeSavedSession(session) {
    try {
      localStorage.setItem(sessionKey, JSON.stringify(session));
    } catch {}
  }

  function saveStateIfPossible() {
    try {
      if (typeof saveState === "function") saveState();
    } catch {}
  }

  function normalEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function sessionHasLogin(session) {
    return Boolean(session?.accessToken && session?.refreshToken);
  }

  function ensureSessionUser() {
    if (typeof state === "undefined" || typeof sessionKey === "undefined") return null;
    const session = readSavedSession();
    if (!sessionHasLogin(session)) return null;

    const email = normalEmail(session.email || session.user?.email);
    const id = session.id || session.user?.id || email || "supabase-user";
    if (!id && !email) return null;

    if (!Array.isArray(state.users)) state.users = [];
    const existing = state.users.find((user) => {
      const sameId = String(user.id || "") === String(id || "");
      const sameEmail = email && normalEmail(user.email) === email;
      return sameId || sameEmail;
    });

    const restored = {
      id: existing?.id || id,
      email: existing?.email || email,
      name: existing?.name || session.name || email || "Signed in user",
      role: existing?.role || "Owner",
      permissions: Array.isArray(existing?.permissions) && existing.permissions.length ? existing.permissions : fullPermissions(),
      active: existing?.active !== false
    };

    state.users = [
      restored,
      ...state.users.filter((user) => {
        const sameId = String(user.id || "") === String(restored.id || "");
        const sameEmail = restored.email && normalEmail(user.email) === normalEmail(restored.email);
        return !sameId && !sameEmail;
      })
    ];

    writeSavedSession({
      ...session,
      id: restored.id,
      email: restored.email,
      name: restored.name,
      keptOnReloadAt: new Date().toISOString()
    });
    saveStateIfPossible();
    return restored;
  }

  const originalSbLoadAll = typeof sbLoadAll === "function" ? sbLoadAll : null;
  if (originalSbLoadAll) {
    sbLoadAll = async function sbLoadAllKeepingSession(...args) {
      const result = await originalSbLoadAll.apply(this, args);
      ensureSessionUser();
      return result;
    };
  }

  const originalCurrentSession = typeof currentSession === "function" ? currentSession : null;
  if (originalCurrentSession) {
    currentSession = function currentSessionKeepingUser() {
      const session = readSavedSession();
      if (sessionHasLogin(session)) {
        const user = ensureSessionUser();
        if (user) return { ...session, id: user.id, email: user.email, name: user.name, user };
      }
      return originalCurrentSession();
    };
  }

  const originalUpdateAuthView = typeof updateAuthView === "function" ? updateAuthView : null;
  if (originalUpdateAuthView) {
    updateAuthView = function updateAuthViewKeepingSession(...args) {
      ensureSessionUser();
      return originalUpdateAuthView.apply(this, args);
    };
  }

  const originalRender = typeof render === "function" ? render : null;
  if (originalRender) {
    render = function renderKeepingSession(...args) {
      ensureSessionUser();
      return originalRender.apply(this, args);
    };
  }

  window.wesetKeepSession = ensureSessionUser;
  ensureSessionUser();
  setTimeout(() => {
    ensureSessionUser();
    if (typeof updateAuthView === "function") updateAuthView();
    if (typeof render === "function") render();
  }, 250);
})();

