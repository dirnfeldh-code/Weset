(() => {
  const sectionIds = ["records", "actions", "reports"];
  let organizeQueued = false;
  let lastQuoteSelectSignature = "";

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function ensureStyles() {
    if (document.querySelector("#accountingWorkspaceFixStyles")) return;
    const style = document.createElement("style");
    style.id = "accountingWorkspaceFixStyles";
    style.textContent = `
      .accounting-workspace { display: grid; gap: 14px; margin-top: 16px; }
      .accounting-workspace-nav { align-items: center; background: #fff; border: 1px solid var(--line,#d9e0e1); border-radius: 8px; box-shadow: var(--shadow,0 18px 50px rgba(23,37,42,.08)); display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; }
      .accounting-workspace-nav button { background: #edf2f3; color: var(--ink,#1d2528); min-height: 36px; }
      .accounting-workspace-nav button.is-active { background: var(--blue,#145c58); color: #fff; }
      .accounting-workspace-note { color: var(--muted,#687478); font-size: 13px; font-weight: 700; margin-left: auto; }
      .accounting-workspace-section { display: none; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); }
      .accounting-workspace-section.is-active { display: grid; }
      .accounting-workspace-section > .panel, .accounting-workspace-section > .accounting-tools-grid, .accounting-workspace-section > .accounting-grid { margin: 0 !important; min-width: 0; }
      .accounting-workspace-section .panel { align-self: start; }
      .accounting-create-invoice-panel .form-grid { align-items: end; }
      .accounting-create-invoice-panel .meta { margin-top: 8px; }
      .accounting-workspace-empty { background: #fff; border: 1px dashed var(--line,#d9e0e1); border-radius: 8px; color: var(--muted,#687478); padding: 18px; text-align: center; }
      #accountingRecordsSection #clientPaymentForm, #accountingRecordsSection #expenseForm { display: none !important; }
      #accountingActionsSection #clientPaymentsTable, #accountingActionsSection #clientPaymentSummary { display: none !important; }
      @media (max-width: 760px) { .accounting-workspace-note { margin-left: 0; width: 100%; } .accounting-workspace-section { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function ensureShell() {
    const accounting = document.querySelector("#accountingView");
    if (!accounting) return null;
    let shell = document.querySelector("#accountingWorkspaceShell");
    if (shell) return shell;
    shell = document.createElement("div");
    shell.id = "accountingWorkspaceShell";
    shell.className = "accounting-workspace";
    shell.innerHTML = `
      <div class="accounting-workspace-nav" role="tablist" aria-label="Accounting sections">
        <button class="is-active" data-accounting-section="records" type="button">Records</button>
        <button data-accounting-section="actions" type="button">Create / record</button>
        <button data-accounting-section="reports" type="button">Reports</button>
        <span class="accounting-workspace-note">Records are what already happened. Create / record is where you add new things. Reports are for totals and exports.</span>
      </div>
      <section class="accounting-workspace-section is-active" id="accountingRecordsSection" data-accounting-section-panel="records"></section>
      <section class="accounting-workspace-section" id="accountingActionsSection" data-accounting-section-panel="actions"></section>
      <section class="accounting-workspace-section" id="accountingReportsSection" data-accounting-section-panel="reports"></section>
    `;
    const metrics = document.querySelector("#accountingMetrics");
    if (metrics) metrics.insertAdjacentElement("afterend", shell);
    else accounting.prepend(shell);
    shell.addEventListener("click", (event) => {
      const button = event.target.closest("[data-accounting-section]");
      if (!button) return;
      switchSection(button.dataset.accountingSection);
    });
    return shell;
  }

  function switchSection(section) {
    if (!sectionIds.includes(section)) return;
    document.querySelectorAll("[data-accounting-section]").forEach((button) => button.classList.toggle("is-active", button.dataset.accountingSection === section));
    document.querySelectorAll("[data-accounting-section-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.accountingSectionPanel === section));
  }

  function panelFor(selector) {
    const node = document.querySelector(selector);
    return node?.closest(".panel") || null;
  }

  function appendUnique(container, node) {
    if (!container || !node || node.parentElement === container) return;
    if (node.id && container.querySelector(`#${CSS.escape(node.id)}`)) return;
    container.appendChild(node);
  }

  function ensureCreateInvoicePanel(container) {
    if (!container || document.querySelector("#accountingCreateInvoicePanel")) return;
    const panel = document.createElement("section");
    panel.className = "panel accounting-create-invoice-panel";
    panel.id = "accountingCreateInvoicePanel";
    panel.innerHTML = `
      <div class="panel-head"><div><h2>Create invoice from quote</h2><p class="meta">Choose an accepted or draft quote, create a real invoice record, then send it or record payment.</p></div></div>
      <div class="form-grid">
        <label class="span-2">Quote<select id="accountingInvoiceQuoteSelect"></select></label>
        <button class="primary span-2" id="accountingCreateInvoiceBtn" type="button">Create invoice</button>
      </div>
      <p class="meta" id="accountingCreateInvoiceNote">Invoices created here are stored in Accounting and linked back to the client and quote.</p>
    `;
    container.prepend(panel);
    panel.querySelector("#accountingCreateInvoiceBtn")?.addEventListener("click", createInvoiceFromAccounting);
    populateInvoiceQuoteSelect();
  }

  function quoteLabel(quote) {
    const client = typeof getClient === "function" ? getClient(quote.clientId) : (state.clients || []).find((entry) => entry.id === quote.clientId);
    const total = typeof quoteCosts === "function" ? quoteCosts(quote).total : (quote.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
    const amount = typeof formatMoney === "function" ? formatMoney(total) : typeof money === "function" ? money(total) : total;
    return `${quote.id} - ${client?.company || "Client"} - ${quote.status || "Draft"} - ${amount}`;
  }

  function populateInvoiceQuoteSelect() {
    const select = document.querySelector("#accountingInvoiceQuoteSelect");
    if (!select) return;
    const quotes = [...(state.quotes || [])].sort((a, b) => String(b.requiredDate || b.id).localeCompare(String(a.requiredDate || a.id)));
    const signature = quotes.map((quote) => `${quote.id}:${quote.status}:${quote.clientId}:${quote.requiredDate || ""}`).join("|");
    if (signature === lastQuoteSelectSignature && select.options.length) return;
    const current = select.value;
    select.innerHTML = quotes.map((quote) => `<option value="${esc(quote.id)}">${esc(quoteLabel(quote))}</option>`).join("") || `<option value="">No quotes available</option>`;
    if ([...select.options].some((option) => option.value === current)) select.value = current;
    lastQuoteSelectSignature = signature;
  }

  function createInvoiceFromAccounting() {
    const select = document.querySelector("#accountingInvoiceQuoteSelect");
    const quoteId = select?.value || "";
    const note = document.querySelector("#accountingCreateInvoiceNote");
    if (!quoteId) {
      if (note) note.textContent = "Create or choose a quote before creating an invoice.";
      return;
    }
    if (typeof window.wesetCreateStoredInvoice === "function") {
      const invoice = window.wesetCreateStoredInvoice(quoteId, "Unpaid");
      if (note) note.textContent = invoice ? `Invoice ${invoice.invoiceNumber} created. Open Records to view it or send it from the invoice row.` : "Could not create invoice from that quote.";
      if (typeof window.wesetRefreshAccountingReports === "function") window.wesetRefreshAccountingReports();
      scheduleOrganize();
      return;
    }
    if (note) note.textContent = "Invoice creator is still loading. Refresh the app and try again.";
  }

  function splitReportPanel(records, reports) {
    const reportPanel = document.querySelector("#accountingReportsPanel");
    if (!reportPanel) return;
    const liveGrid = reportPanel.querySelector(".accounting-live-grid");
    if (!liveGrid) {
      appendUnique(reports, reportPanel);
      return;
    }
    [...liveGrid.children].forEach((child) => {
      const heading = child.querySelector("h2")?.textContent?.trim().toLowerCase() || "";
      if (heading.includes("invoices")) appendUnique(records, child);
      else appendUnique(reports, child);
    });
    appendUnique(reports, reportPanel);
  }

  function organize() {
    ensureStyles();
    const shell = ensureShell();
    if (!shell) return;
    const records = document.querySelector("#accountingRecordsSection");
    const actions = document.querySelector("#accountingActionsSection");
    const reports = document.querySelector("#accountingReportsSection");
    ensureCreateInvoicePanel(actions);
    populateInvoiceQuoteSelect();

    appendUnique(actions, panelFor("#expenseForm"));
    appendUnique(actions, panelFor("#clientPaymentForm"));
    appendUnique(actions, document.querySelector("#expenseCategoryManager"));

    splitReportPanel(records, reports);

    appendUnique(records, panelFor("#salesTable"));
    appendUnique(records, panelFor("#expensesTable"));
    appendUnique(records, document.querySelector("#clientPaymentsPanel"));

    appendUnique(reports, panelFor("#accountsSummary"));
    appendUnique(reports, panelFor("#expenseBreakdown"));
    appendUnique(reports, panelFor("#monthlyAccounts"));
    appendUnique(reports, document.querySelector("#vatSummaryPanel"));

    [records, actions, reports].forEach((container) => {
      if (!container) return;
      const empty = container.querySelector(".accounting-workspace-empty");
      const hasContent = [...container.children].some((child) => !child.classList.contains("accounting-workspace-empty"));
      if (!hasContent && !empty) container.insertAdjacentHTML("beforeend", `<div class="accounting-workspace-empty">This area will fill when the accounting tools finish loading.</div>`);
      if (hasContent) empty?.remove();
    });
  }

  function scheduleOrganize(delay = 0) {
    if (organizeQueued) return;
    organizeQueued = true;
    setTimeout(() => {
      organizeQueued = false;
      const run = () => organize();
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
      else run();
    }, delay);
  }

  const oldRenderAccounting = typeof renderAccounting === "function" ? renderAccounting : null;
  if (oldRenderAccounting) renderAccounting = function renderAccountingWithWorkspace() {
    oldRenderAccounting();
    scheduleOrganize();
  };

  document.addEventListener("click", () => scheduleOrganize(150), true);
  document.addEventListener("submit", () => scheduleOrganize(350), true);
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("#accountingInvoiceQuoteSelect, #reportFromDate, #reportToDate, #reportCategoryFilter")) return;
    scheduleOrganize(120);
  }, true);
  window.addEventListener("hashchange", () => scheduleOrganize(250));
  scheduleOrganize(250);
})();
