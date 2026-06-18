(() => {
  const style = document.createElement("style");
  style.textContent = `
    .connection-error-banner {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      box-shadow: 0 14px 36px rgba(23, 37, 42, 0.14);
      color: #7c2d12;
      display: grid;
      gap: 8px;
      left: 50%;
      max-width: min(680px, calc(100vw - 24px));
      padding: 12px 14px;
      position: fixed;
      top: 12px;
      transform: translateX(-50%);
      width: 680px;
      z-index: 9999;
    }
    .connection-error-banner strong {
      color: #431407;
      display: block;
    }
    .connection-error-banner p {
      margin: 0;
    }
    .connection-error-banner button {
      justify-self: end;
      min-height: 30px;
      padding: 0 10px;
    }
  `;
  document.head.appendChild(style);

  function userActionFor(message) {
    const text = String(message || "").toLowerCase();
    if (text.includes("jwt expired") || text.includes("login expired") || text.includes("refresh")) return "Please log out, refresh the page, and sign in again.";
    if (text.includes("failed to fetch") || text.includes("network") || text.includes("connection")) return "Please check your internet connection, then try again.";
    if (text.includes("row-level security") || text.includes("policy") || text.includes("permission")) return "Please check the Supabase table RLS policy for this action.";
    if (text.includes("edge function") || text.includes("email") || text.includes("resend")) return "Please check the Supabase Edge Function logs and Resend settings.";
    return "Please try again. If it repeats, send this message to Codex.";
  }

  function showConnectionError(title, error, details = "") {
    const message = String(error?.message || error || "Unknown connection problem.");
    let banner = document.querySelector("#connectionErrorBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "connectionErrorBanner";
      banner.className = "connection-error-banner";
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<div><strong>${title}</strong><p>${message}</p><p>${details || userActionFor(message)}</p></div><button class="secondary" type="button">Close</button>`;
    banner.querySelector("button")?.addEventListener("click", () => banner.remove(), { once: true });
  }

  window.wesetShowConnectionError = showConnectionError;

  const oldSbShowError = typeof sbShowError === "function" ? sbShowError : null;
  if (oldSbShowError) {
    sbShowError = function sbShowErrorWithBanner(error) {
      showConnectionError("Supabase connection problem", error);
      oldSbShowError(error);
    };
  }

  const oldSbRequest = typeof sbRequest === "function" ? sbRequest : null;
  if (oldSbRequest) {
    sbRequest = async function sbRequestWithVisibleErrors(path, options = {}) {
      try {
        return await oldSbRequest(path, options);
      } catch (error) {
        showConnectionError("Supabase connection problem", error, `Request: ${path}`);
        throw error;
      }
    };
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const response = await originalFetch(input, init);
      const url = typeof input === "string" ? input : input?.url || "";
      if (!response.ok && (url.includes("supabase.co") || url.includes("postcodes.io"))) {
        const clone = response.clone();
        const data = await clone.json().catch(() => ({}));
        const message = data.error_description || data.message || data.msg || `${response.status} ${response.statusText}`;
        showConnectionError(url.includes("functions/v1") ? "Email sender problem" : "Supabase connection problem", message);
      }
      return response;
    } catch (error) {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("supabase.co") || url.includes("postcodes.io")) showConnectionError("Connection problem", error);
      throw error;
    }
  };
})();
