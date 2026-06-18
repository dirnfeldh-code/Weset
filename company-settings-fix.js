(() => {
  const storageKey = "weset.company.details";
  const defaults = {
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

  function readLocal() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; }
    catch { return { ...defaults }; }
  }

  function saveLocal(details) {
    const clean = { ...defaults, ...details };
    localStorage.setItem(storageKey, JSON.stringify(clean));
    window.wesetCompanyDetails = clean;
    return clean;
  }

  async function saveSupabase(details) {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return { saved: false, reason: "Supabase is not connected" };
    try {
      const rows = await sbRequest("app_settings?key=eq.company_profile&select=id,key,value");
      const body = { key: "company_profile", value: details };
      if (rows?.length) await sbRequest("app_settings?key=eq.company_profile", { method: "PATCH", body });
      else await sbRequest("app_settings", { method: "POST", body });
      return { saved: true };
    } catch (error) {
      return { saved: false, reason: error.message || "Create the app_settings table in Supabase to sync these details" };
    }
  }

  async function loadSupabase() {
    if (typeof sbIsConnected !== "function" || !sbIsConnected() || typeof sbRequest !== "function") return;
    try {
      const rows = await sbRequest("app_settings?key=eq.company_profile&select=value");
      if (rows?.[0]?.value) saveLocal(rows[0].value);
    } catch {
      // Local settings still work if the Supabase settings table is not ready.
    }
  }

  function details() {
    return { ...defaults, ...(window.wesetCompanyDetails || readLocal()) };
  }

  function ensurePanel() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting || document.querySelector("#companySettingsPanel")) return;
    const current = details();
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.id = "companySettingsPanel";
    panel.innerHTML = `<div class="panel-head"><h2>Company details</h2><span class="badge Complete" id="companySettingsStatus">Used on quotes and invoices</span></div>
      <form id="companySettingsForm" class="form-grid">
        <label>Company name<input id="companyName" value="${esc(current.name)}" required></label>
        <label>Accounts email<input id="companyEmail" type="email" value="${esc(current.email)}" required></label>
        <label>Phone number<input id="companyPhone" value="${esc(current.phone)}"></label>
        <label>Payment terms<input id="companyTerms" value="${esc(current.terms)}" placeholder="Net 15"></label>
        <label>Address line 1<input id="companyAddress1" value="${esc(current.address1)}"></label>
        <label>Address line 2<input id="companyAddress2" value="${esc(current.address2)}"></label>
        <label>VAT / registration details<input id="companyVat" value="${esc(current.vat)}"></label>
        <label>Logo URL<input id="companyLogoUrl" value="${esc(current.logoUrl)}" placeholder="assets/weset-logo-live.jpg"></label>
        <button class="primary span-2" type="submit">Save company details</button>
      </form>`;
    const firstLowerGrid = accounting.querySelector(".accounting-grid.lower");
    if (firstLowerGrid) firstLowerGrid.insertAdjacentElement("beforebegin", panel);
    else accounting.appendChild(panel);
    panel.querySelector("#companySettingsForm")?.addEventListener("submit", saveFromForm);
  }

  async function saveFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector("#companySettingsStatus");
    const next = saveLocal({
      name: form.querySelector("#companyName").value.trim(),
      email: form.querySelector("#companyEmail").value.trim(),
      phone: form.querySelector("#companyPhone").value.trim(),
      terms: form.querySelector("#companyTerms").value.trim(),
      address1: form.querySelector("#companyAddress1").value.trim(),
      address2: form.querySelector("#companyAddress2").value.trim(),
      vat: form.querySelector("#companyVat").value.trim(),
      logoUrl: form.querySelector("#companyLogoUrl").value.trim() || defaults.logoUrl
    });
    if (status) status.textContent = "Saved in app";
    const supabase = await saveSupabase(next);
    if (status) {
      status.textContent = supabase.saved ? "Saved to Supabase" : "Saved in app";
      status.className = `badge ${supabase.saved ? "Complete" : "Scheduled"}`;
    }
    alert(supabase.saved ? "Company details saved and synced to Supabase." : `Company details saved in the app. ${supabase.reason}`);
  }

  function install() {
    window.wesetCompanyDetails = readLocal();
    window.wesetGetCompanyDetails = details;
    ensurePanel();
    loadSupabase().then(() => ensurePanel());
    const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
    if (oldRenderAccounting) renderAccounting = function renderAccountingWithCompanySettings() { oldRenderAccounting(); ensurePanel(); };
  }

  install();
})();
