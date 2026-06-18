(() => {
  const refreshSkewSeconds = 90;
  let refreshPromise = null;

  function showError(title, error, details = "") {
    if (typeof window.wesetShowConnectionError === "function") window.wesetShowConnectionError(title, error, details);
    else alert(`${title}: ${error?.message || error || "Unknown error"}`);
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "{}");
    } catch {
      return {};
    }
  }

  function saveSessionPatch(patch) {
    const current = readSession();
    localStorage.setItem(sessionKey, JSON.stringify({ ...current, ...patch }));
  }

  function jwtPayload(token) {
    try {
      const part = String(token || "").split(".")[1];
      if (!part) return {};
      const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  function tokenNeedsRefresh() {
    const session = readSession();
    if (!session.accessToken || !session.refreshToken) return false;
    const exp = Number(jwtPayload(session.accessToken).exp || 0);
    if (!exp) return false;
    return exp - Math.floor(Date.now() / 1000) < refreshSkewSeconds;
  }

  async function refreshSession(force = false) {
    const session = readSession();
    if (!session.refreshToken || typeof sbUrl === "undefined" || typeof sbAnonKey === "undefined") {
      if (force) showError("Supabase login problem", "No refresh token is available. Please sign in again.");
      return false;
    }
    if (!force && !tokenNeedsRefresh()) return true;
    if (refreshPromise) return refreshPromise;

    refreshPromise = fetch(`${sbUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: sbAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: session.refreshToken })
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Could not refresh Supabase login.");
        saveSessionPatch({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || session.refreshToken,
          refreshedAt: new Date().toISOString()
        });
        return true;
      })
      .catch((error) => {
        console.warn("Supabase session refresh failed", error);
        showError("Supabase login expired", error, "Please log out, refresh the page, and sign in again.");
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function isJwtExpiredError(error) {
    return String(error?.message || error || "").toLowerCase().includes("jwt expired");
  }

  const oldSbRequest = typeof sbRequest === "function" ? sbRequest : null;
  if (oldSbRequest) {
    sbRequest = async function sbRequestWithRefresh(path, options = {}) {
      await refreshSession(false);
      try {
        return await oldSbRequest(path, options);
      } catch (error) {
        if (!isJwtExpiredError(error)) throw error;
        showError("Supabase login expired", error, "The app will try to refresh your login once now.");
        const refreshed = await refreshSession(true);
        if (!refreshed) throw error;
        return oldSbRequest(path, options);
      }
    };
  }

  const oldSbIsConnected = typeof sbIsConnected === "function" ? sbIsConnected : null;
  if (oldSbIsConnected) {
    sbIsConnected = function sbIsConnectedWithRefresh() {
      const session = readSession();
      return Boolean(session.accessToken && session.refreshToken);
    };
  }

  window.wesetRefreshSupabaseSession = () => refreshSession(true);
  setTimeout(() => refreshSession(false), 600);
})();
