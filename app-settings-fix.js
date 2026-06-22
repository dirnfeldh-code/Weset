(() => {
  const storageKey = "weset.company.details";
  const defaults = {
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    name: "Easy office set up ltd",
    address1: "130 clapton common",
    address2: "London, London E5 9AG",
    vat: "VAT Registration No. 497601164",
    email: "accounts@weset.co.uk",
    phone: "+447380907868",
    terms: "Net 15",
    logoUrl: "assets/weset-logo-live.jpg"
  };

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readDetails() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; }
    catch { return { ...defaults }; }
  }

  function saveDetails(details) {
    const clean = { ...defaults, ...details };
    localStorage.setItem(storageKey, JSON.stringify(clean));
    window.wesetCompanyDetails = clean;
    return clean;
  }

  async function saveSupabase(details) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") {
      return { saved: false, reason: "Supabase is not connected yet" };
    }
    try {
      const rows = await sbRequest("app_settings?key=eq.company_profile&select=id,key,value");
      const body = { key: "company_profile", value: details };
      if (rows?.length) await sbRequest("app_settings?key=eq.company_profile", { method: "PATCH", body });
      else await sbRequest("app_settings", { method: "POST", body });
      return { saved: true };
    } catch (error) {
      return { saved: false, reason: error.message || "Create the app_settings table in Supabase first" };
    }
  }

  async function loadSupabase() {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    try {
      const rows = await sbRequest("app_settings?key=eq.company_profile&select=value");
      if (rows?.[0]?.value) saveDetails(rows[0].value);
    } catch {}
  }

  function ensureStyles() {
    if (document.querySelector("#appSettingsStyles")) return;
    const style = document.createElement("style");
    style.id = "appSettingsStyles";
    style.textContent = `
      .app-settings-button {
        white-space: nowrap !important;
      }
      .topbar .header-icon-tools {
        align-items: center;
        display: flex;
        gap: 8px;
        margin-right: 12px;
      }
      .topbar > .header-title-wrap {
        min-width: 0;
      }
      .topbar .app-icon-action {
        align-items: center !important;
        border-radius: 8px !important;
        display: inline-flex !important;
        height: 38px !important;
        justify-content: center !important;
        min-height: 38px !important;
        min-width: 38px !important;
        padding: 0 !important;
        width: 38px !important;
      }
      .topbar .app-icon-action svg {
        display: block;
        height: 18px;
        width: 18px;
      }
      .topbar .app-icon-action .button-text {
        border: 0;
        clip: rect(0 0 0 0);
        height: 1px;
        margin: -1px;
        overflow: hidden;
        padding: 0;
        position: absolute;
        white-space: nowrap;
        width: 1px;
      }
      .app-settings-dialog {
        border: 0;
        border-radius: 8px;
        box-shadow: 0 24px 70px rgba(18, 35, 39, .24);
        max-height: min(94dvh, 860px);
        max-width: min(860px, calc(100vw - 24px));
        padding: 0;
        width: min(860px, calc(100vw - 24px));
      }
      .app-settings-dialog::backdrop { background: rgba(13, 25, 28, .42); }
      .app-settings-card { background: #fff; display: grid; max-height: min(94dvh, 860px); overflow: hidden; }
      .app-settings-head,
      .app-settings-actions {
        align-items: center;
        background: #fff;
        display: flex;
        gap: 10px;
        justify-content: space-between;
        padding: 14px 16px;
      }
      .app-settings-head { border-bottom: 1px solid var(--line, #d9e0e1); }
      .app-settings-head h2 { font-size: 18px; margin: 0; }
      .app-settings-head p { color: var(--muted, #687478); margin: 4px 0 0; }
      .app-settings-body { display: grid; gap: 16px; overflow: auto; padding: 16px; }
      .app-settings-section { border: 1px solid var(--line, #d9e0e1); border-radius: 8px; display: grid; gap: 12px; padding: 12px; }
      .app-settings-section h3 { font-size: 14px; margin: 0; }
      .app-settings-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .app-settings-grid label { min-width: 0; }
      .app-settings-grid input { width: 100%; }
      .app-settings-grid .span-2 { grid-column: 1 / -1; }
      .app-settings-status { color: #145c58; font-size: 13px; font-weight: 800; margin: 0; }
      .app-settings-status.is-warn { color: #7c2d12; }
      .app-settings-actions { border-top: 1px solid var(--line, #d9e0e1); flex-wrap: wrap; }
      @media (max-width: 720px) {
        .topbar .header-icon-tools {
          align-self: flex-start;
          margin: 0 0 8px;
        }
        .app-settings-grid { grid-template-columns: 1fr; }
        .app-settings-grid .span-2 { grid-column: 1; }
        .app-settings-actions { align-items: stretch; display: grid; grid-template-columns: 1fr; }
        .app-settings-actions button { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function field(name, label, value, attrs = "", wide = false) {
    return `<label class="${wide ? "span-2" : ""}">${esc(label)}<input id="appSetting_${esc(name)}" ${attrs} value="${esc(value)}"></label>`;
  }

  function dialogHtml(details) {
    return `<div class="app-settings-card">
      <div class="app-settings-head">
        <div><h2>Settings</h2><p>Owner and company details used across the app, quotes, invoices, emails and PDFs.</p></div>
        <button class="icon-btn" id="closeAppSettingsBtn" type="button" aria-label="Close">x</button>
      </div>
      <form id="appSettingsForm">
        <div class="app-settings-body">
          <section class="app-settings-section">
            <h3>App owner</h3>
            <div class="app-settings-grid">
              ${field("ownerName", "Owner name", details.ownerName)}
              ${field("ownerEmail", "Owner email", details.ownerEmail, 'type="email"')}
              ${field("ownerPhone", "Owner phone", details.ownerPhone)}
            </div>
          </section>
          <section class="app-settings-section">
            <h3>Company details</h3>
            <div class="app-settings-grid">
              ${field("name", "Company name", details.name, "required")}
              ${field("email", "Accounts email", details.email, 'type="email" required')}
              ${field("phone", "Company phone", details.phone)}
              ${field("terms", "Payment terms", details.terms)}
              ${field("address1", "Address line 1", details.address1)}
              ${field("address2", "Address line 2", details.address2)}
              ${field("vat", "VAT / registration details", details.vat, "", true)}
              ${field("logoUrl", "Logo URL", details.logoUrl, "", true)}
            </div>
          </section>
          <p class="app-settings-status" id="appSettingsStatus">Ready to save.</p>
        </div>
        <div class="app-settings-actions">
          <button class="secondary" id="cancelAppSettingsBtn" type="button">Cancel</button>
          <button class="primary" type="submit">Save settings</button>
        </div>
      </form>
    </div>`;
  }

  function ensureDialog() {
    if (document.querySelector("#appSettingsDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "appSettingsDialog";
    dialog.className = "app-settings-dialog";
    document.body.appendChild(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeSettings();
    });
  }

  function refreshAccountingCompanyPanel(details) {
    const map = {
      companyName: details.name,
      companyEmail: details.email,
      companyPhone: details.phone,
      companyTerms: details.terms,
      companyAddress1: details.address1,
      companyAddress2: details.address2,
      companyVat: details.vat,
      companyLogoUrl: details.logoUrl
    };
    Object.entries(map).forEach(([id, value]) => {
      const input = document.querySelector(`#${id}`);
      if (input) input.value = value || "";
    });
    const status = document.querySelector("#companySettingsStatus");
    if (status) {
      status.textContent = "Saved from Settings";
      status.className = "badge Complete";
    }
  }

  function openSettings() {
    ensureStyles();
    ensureDialog();
    const dialog = document.querySelector("#appSettingsDialog");
    const details = readDetails();
    dialog.innerHTML = dialogHtml(details);
    dialog.querySelector("#closeAppSettingsBtn")?.addEventListener("click", closeSettings);
    dialog.querySelector("#cancelAppSettingsBtn")?.addEventListener("click", closeSettings);
    dialog.querySelector("#appSettingsForm")?.addEventListener("submit", saveFromSettings);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeSettings() {
    const dialog = document.querySelector("#appSettingsDialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  async function saveFromSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("#appSettingsStatus");
    const value = (name) => form.querySelector(`#appSetting_${name}`)?.value.trim() || "";
    const details = saveDetails({
      ownerName: value("ownerName"),
      ownerEmail: value("ownerEmail"),
      ownerPhone: value("ownerPhone"),
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      terms: value("terms"),
      address1: value("address1"),
      address2: value("address2"),
      vat: value("vat"),
      logoUrl: value("logoUrl") || defaults.logoUrl
    });
    refreshAccountingCompanyPanel(details);
    if (status) {
      status.textContent = "Saved in this app. Syncing to Supabase...";
      status.classList.remove("is-warn");
    }
    const supabase = await saveSupabase(details);
    if (status) {
      status.textContent = supabase.saved ? "Saved to Supabase." : `Saved in this app. Supabase did not save yet: ${supabase.reason}.`;
      status.classList.toggle("is-warn", !supabase.saved);
    }
    if (typeof renderAccounting === "function") setTimeout(renderAccounting, 80);
  }

  function ensureButton() {
    const actions = document.querySelector(".top-actions");
    const topbar = document.querySelector(".topbar");
    if (!actions || !topbar) return;

    const title = topbar.firstElementChild;
    if (title && !title.classList.contains("header-title-wrap")) title.classList.add("header-title-wrap");

    let tools = document.querySelector(".header-icon-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "header-icon-tools";
      topbar.insertBefore(tools, title || topbar.firstChild);
    }

    let settings = document.querySelector("#appSettingsBtn");
    if (!settings) {
      settings = document.createElement("button");
      settings.id = "appSettingsBtn";
      settings.type = "button";
      settings.addEventListener("click", openSettings);
    }
    settings.className = "secondary app-settings-button app-icon-action";
    settings.setAttribute("aria-label", "Settings");
    settings.setAttribute("title", "Settings");
    settings.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5L10 21.5h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><span class="button-text">Settings</span>`;
    tools.appendChild(settings);

    const logout = document.querySelector("#logoutBtn");
    if (logout) {
      logout.className = "secondary app-icon-action";
      logout.setAttribute("aria-label", "Log out");
      logout.setAttribute("title", "Log out");
      logout.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 5H5.8A1.8 1.8 0 0 0 4 6.8v10.4A1.8 1.8 0 0 0 5.8 19H10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="button-text">Log out</span>`;
      tools.appendChild(logout);
    }
  }

  function install() {
    ensureStyles();
    ensureDialog();
    ensureButton();
    loadSupabase();
    window.wesetOpenSettings = openSettings;
    const oldRender = typeof render === "function" ? render : null;
    if (oldRender && !window.wesetAppSettingsWrappedRender) {
      window.wesetAppSettingsWrappedRender = true;
      render = function renderWithAppSettings(...args) {
        const result = oldRender.apply(this, args);
        setTimeout(ensureButton, 0);
        return result;
      };
    }
  }

  install();
})();
