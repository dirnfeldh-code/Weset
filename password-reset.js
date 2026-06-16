(() => {
  const liveUrl = "https://dirnfeldh-code.github.io/Weset/";

  function setLoginMessage(message, type = "error") {
    const target = document.querySelector("#loginError");
    if (!target) return;
    target.textContent = message;
    target.style.color = type === "ok" ? "#157a5b" : "";
  }

  function recoveryErrorFromUrl() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const error = params.get("error_description") || params.get("error");
    return error ? error.replaceAll("+", " ") : "";
  }

  async function requestPasswordReset(email) {
    const response = await fetch(`${sbUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(liveUrl)}`, {
      method: "POST",
      headers: {
        apikey: sbAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Could not send the reset email.");
    return data;
  }

  async function updatePassword(accessToken, password) {
    const response = await fetch(`${sbUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: sbAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Could not update the password.");
    return data;
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
    const form = document.querySelector("#loginForm");
    if (!form || form.dataset.loginFix === "true") return;
    form.dataset.loginFix = "true";
    window.wesetLoginFix = true;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
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
    }, true);
  }

  function addResetRequestButton() {
    const loginButton = document.querySelector("#loginForm button[type='submit']");
    if (!loginButton || document.querySelector("#resetPasswordBtn")) return;
    loginButton.insertAdjacentHTML("afterend", `<button class="secondary full" id="resetPasswordBtn" type="button">Reset password</button>`);
    document.querySelector("#resetPasswordBtn").addEventListener("click", async () => {
      const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
      if (!email) {
        setLoginMessage("Enter your email first, then press Reset password.");
        document.querySelector("#loginEmail").focus();
        return;
      }
      setLoginMessage("Sending password reset email...");
      try {
        await requestPasswordReset(email);
        setLoginMessage("Password reset email sent. Open the newest email from Supabase and use that link.", "ok");
      } catch (error) {
        const text = String(error.message || "");
        if (text.toLowerCase().includes("rate limit")) {
          setLoginMessage("Supabase has blocked more reset emails for a short time. Wait, or set the password manually in Supabase Authentication > Users.");
        } else {
          setLoginMessage(`Could not send reset email: ${text}`);
        }
      }
    });
  }

  function showNewPasswordForm(accessToken) {
    const loginCard = document.querySelector("#loginForm");
    if (!loginCard || document.querySelector("#newPasswordPanel")) return;
    loginCard.querySelectorAll("label, button, .meta").forEach((node) => {
      if (node.id !== "newPasswordPanel") node.style.display = "none";
    });
    loginCard.querySelector("h1").textContent = "Set new password";
    loginCard.insertAdjacentHTML("beforeend", `
      <section id="newPasswordPanel">
        <label>
          New password
          <input id="newPassword" type="password" minlength="6" autocomplete="new-password" required>
        </label>
        <label>
          Confirm password
          <input id="confirmPassword" type="password" minlength="6" autocomplete="new-password" required>
        </label>
        <button class="primary" id="saveNewPasswordBtn" type="button">Save new password</button>
      </section>
    `);
    document.querySelector("#saveNewPasswordBtn").addEventListener("click", async () => {
      const password = document.querySelector("#newPassword").value;
      const confirm = document.querySelector("#confirmPassword").value;
      if (password.length < 6) {
        setLoginMessage("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirm) {
        setLoginMessage("The two passwords do not match.");
        return;
      }
      setLoginMessage("Saving new password...");
      try {
        await updatePassword(accessToken, password);
        history.replaceState(null, "", liveUrl);
        setLoginMessage("Password changed. Sign in with your new password.", "ok");
        location.reload();
      } catch (error) {
        setLoginMessage(`Could not change password: ${error.message || "The link may have expired."}`);
      }
    });
  }

  function handleRecoveryLanding() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const error = recoveryErrorFromUrl();
    if (error) {
      setLoginMessage(`Password reset link problem: ${error}. Send a new reset email from this page.`);
      return;
    }
    const accessToken = params.get("access_token");
    const type = params.get("type");
    if (accessToken && type === "recovery") {
      showNewPasswordForm(accessToken);
    }
  }

  addLoginFix();
  addResetRequestButton();
  handleRecoveryLanding();
})();
