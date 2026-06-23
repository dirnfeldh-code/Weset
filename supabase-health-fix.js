(() => {
  function setLoginMessage(message, type = "error") {
    const target = document.querySelector("#loginError");
    if (!target) return;
    target.textContent = message;
    target.style.color = type === "ok" ? "#157a5b" : "";
  }

  async function checkSupabaseHealth() {
    if (typeof sbUrl === "undefined" || typeof sbAnonKey === "undefined") {
      setLoginMessage("The app is missing the Supabase connection settings. Ask Codex to check supabase-bridge.js.");
      return;
    }

    setLoginMessage("Checking Supabase connection...", "ok");
    try {
      const response = await fetch(`${sbUrl}/auth/v1/settings`, {
        method: "GET",
        headers: { apikey: sbAnonKey }
      });
      if (response.ok) {
        setLoginMessage("Supabase is reachable. If sign in still fails, the problem is the email, password, email confirmation, or user setup.", "ok");
        return;
      }
      const data = await response.json().catch(() => ({}));
      const detail = data.message || data.msg || `${response.status} ${response.statusText}`;
      setLoginMessage(`Supabase answered, but not successfully: ${detail}. Check the Supabase URL and anon key in the app.`);
    } catch (error) {
      setLoginMessage(`This browser cannot reach Supabase now: ${error.message || error}. Check internet, VPN, firewall, or try the live GitHub link.`);
    }
  }

  function addHealthButton() {
    const loginButton = document.querySelector("#loginForm button[type='submit']");
    if (!loginButton || document.querySelector("#checkSupabaseBtn")) return;
    loginButton.insertAdjacentHTML("afterend", `<button class="secondary full" id="checkSupabaseBtn" type="button">Check Supabase</button>`);
    document.querySelector("#checkSupabaseBtn").addEventListener("click", checkSupabaseHealth);
  }

  addHealthButton();
  document.addEventListener("DOMContentLoaded", addHealthButton);
})();
