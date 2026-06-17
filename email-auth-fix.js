(() => {
  const originalFetch = window.fetch.bind(window);
  const emailFunctionPath = "/functions/v1/send-quote-email";

  function stableEmailToken() {
    if (typeof sbAnonKey !== "undefined" && sbAnonKey) return sbAnonKey;
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || "";
    } catch {
      return "";
    }
  }

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes(emailFunctionPath)) {
      const token = stableEmailToken();
      const headers = new Headers(init.headers || {});
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", headers.get("Content-Type") || "application/json");
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
})();
