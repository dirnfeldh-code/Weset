(() => {
  function setLoginMessage(message, type = "error") {
    const target = document.querySelector("#loginError");
    if (!target) return;
    target.textContent = message;
    target.style.color = type === "ok" ? "#157a5b" : "";
  }

  function friendlyLoginError(error) {
    const text = String(error?.message || "").toLowerCase();
    if (text.includes("invalid login") || text.includes("invalid credentials")) {
      return "Supabase says the email or password is wrong. Check the exact password, or set a new password manually in Supabase Authentication > Users.";
    }
    if (text.includes("email not confirmed") || text.includes("not confirmed")) {
      return "This Supabase user exists, but the email is not confirmed. In Supabase Authentication > Users, open the user and confirm it.";
    }
    if (text.includes("rate limit")) {
      return "Supabase is rate-limiting this action. Wait a little, or set the password manually in Supabase Authentication > Users.";
    }
    if (text.includes("failed to fetch") || text.includes("network")) {
      return "The app could not reach Supabase. Check your internet connection and Supabase project status.";
    }
    return `Supabase could not sign in: ${error?.message || "Check the email, password, and confirmation status."}`;
  }

  async function signInWithSupabase(email, password) {
    const response = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: sbAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Supabase login failed.");
    return data;
  }

  function addLoginFix() {
    const oldForm = document.querySelector("#loginForm");
    if (!oldForm) return;
    const form = oldForm.cloneNode(true);
    oldForm.replaceWith(form);
    window.wesetLoginFix = true;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
      const password = document.querySelector("#loginPassword").value;
      setLoginMessage("Signing in with Supabase...");
      try {
        const auth = await signInWithSupabase(email, password);
        const user = {
          id: auth.user?.id || email,
          email,
          name: auth.user?.user_metadata?.name || email,
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          loggedInAt: new Date().toISOString()
        };
        localStorage.setItem(sessionKey, JSON.stringify(user));
        if (typeof sbLoadAll === "function") await sbLoadAll().catch(() => {});
        if (Array.isArray(state?.users) && !state.users.some((entry) => entry.email === email)) {
          state.users = [{
            id: user.id,
            email,
            name: user.name,
            role: "Owner",
            permissions: typeof allViews !== "undefined" ? [...allViews] : ["dashboard"],
            active: true
          }, ...state.users];
          if (typeof saveState === "function") saveState();
        }
        setLoginMessage("");
        if (typeof updateAuthView === "function") updateAuthView();
        if (typeof render === "function") render();
      } catch (error) {
        setLoginMessage(friendlyLoginError(error));
      }
    });
  }

  addLoginFix();
})();
