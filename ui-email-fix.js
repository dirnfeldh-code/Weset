(() => {
  const edgeFunctionUrl = "https://xonmwexosjogdgmahrvr.supabase.co/functions/v1/send-quote-email";

  const style = document.createElement("style");
  style.textContent = `
    dialog {
      border: 0 !important;
      border-radius: 8px !important;
      margin: auto !important;
      max-height: min(96dvh, calc(100vh - 10px)) !important;
      max-width: min(1180px, calc(100vw - 10px)) !important;
      overflow: hidden !important;
      padding: 0 !important;
      width: min(1180px, calc(100vw - 10px)) !important;
    }
    dialog .dialog-card {
      max-height: min(96dvh, calc(100vh - 10px)) !important;
      overflow: auto !important;
      overscroll-behavior: contain !important;
      padding: 16px !important;
      width: 100% !important;
    }
    dialog .panel-head:first-child {
      background: #fff !important;
      border-bottom: 1px solid var(--line, #d9e0e1) !important;
      margin: -16px -16px 12px !important;
      padding: 12px 16px !important;
      position: sticky !important;
      top: -16px !important;
      z-index: 5 !important;
    }
    dialog .dialog-actions {
      background: #fff !important;
      border-top: 1px solid var(--line, #d9e0e1) !important;
      bottom: -16px !important;
      margin: 8px -16px -16px !important;
      padding: 12px 16px !important;
      position: sticky !important;
      z-index: 4 !important;
    }
    dialog .email-preview {
      max-height: 46dvh !important;
      overflow: auto !important;
    }
    dialog #quoteEmailText {
      min-height: 140px !important;
      max-height: 26dvh !important;
    }
    .direct-email-link,
    .send-in-app-button {
      background: #145c58 !important;
      color: #fff !important;
    }
    .send-in-app-button[disabled] {
      cursor: wait !important;
      opacity: 0.72 !important;
    }
    @media (max-width: 700px) {
      dialog {
        border-radius: 0 !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        max-width: 100vw !important;
        width: 100vw !important;
      }
      dialog .dialog-card,
      dialog .dialog-card.wide,
      dialog .dialog-card.client-dialog-card,
      dialog .dialog-card.email-dialog {
        border-radius: 0 !important;
        grid-template-columns: 1fr !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        width: 100vw !important;
      }
      dialog .dialog-card .form-grid,
      dialog .dialog-card.wide .form-grid,
      dialog .dialog-card.client-dialog-card {
        grid-template-columns: 1fr !important;
      }
      dialog .span-2,
      dialog .dialog-card.client-dialog-card .address-builder,
      dialog .dialog-card.client-dialog-card button[type="submit"] {
        grid-column: 1 / -1 !important;
      }
      dialog .address-grid,
      dialog .permission-grid,
      dialog .selected-item {
        grid-template-columns: 1fr !important;
      }
      dialog .dialog-actions,
      dialog .card-actions {
        align-items: stretch !important;
        flex-direction: column !important;
      }
      dialog .dialog-actions > *,
      dialog .card-actions > * {
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);

  function quoteRef(quote) {
    const raw = String(quote?.id || "");
    if (/^Q-\d+/i.test(raw)) return raw.toUpperCase();
    const quotes = state.quotes || [];
    const index = quotes.findIndex((entry) => entry.id === quote?.id);
    return `Q-${index >= 0 ? 1001 + Math.max(0, quotes.length - 1 - index) : 1001}`;
  }

  function moneyText(value) {
    if (typeof formatMoney === "function") return formatMoney(value);
    if (typeof money === "function") return money(value);
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
  }

  function dateText(value) {
    if (typeof formatDate === "function") return formatDate(value);
    if (typeof date === "function") return date(value);
    return value || "No date";
  }

  function quoteEmail(quote) {
    const client = typeof getClient === "function" ? getClient(quote.clientId) : {};
    const costs = typeof quoteCosts === "function" ? quoteCosts(quote) : { total: 0 };
    const items = typeof quoteItems === "function" ? quoteItems(quote) : (quote.items || []);
    const lines = items.map((item) => `- ${item.quantity || 1} x ${item.name || "Item"} at ${moneyText(item.unitCost || 0)}`).join("\n");
    const reference = quoteRef(quote);
    const subject = `WeSet quote ${reference}`;
    const body = `Hello ${client.contact || ""},\n\nThank you for asking WeSet to quote for your office setup.\n\nQuote reference: ${reference}\nSetup address: ${quote.premises || ""}\nRequired date: ${dateText(quote.requiredDate)}\n\nItems:\n${lines || "Items listed in the quote."}\n\nTotal estimate: ${moneyText(costs.total)}\n\nKind regards,\nWeSet`;
    return { to: client.email || "", subject, body, reference };
  }

  function sessionToken() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "{}").accessToken || "";
    } catch {
      return "";
    }
  }

  async function sendQuoteInApp(id, button = null) {
    const quote = (state.quotes || []).find((entry) => entry.id === id);
    if (!quote) return;
    const email = quoteEmail(quote);
    if (!email.to) {
      alert("This client does not have an email address saved. Add the client email first, then send the quote.");
      return;
    }
    const token = sessionToken();
    if (!token) {
      alert("Please log in first. Sending email from the app needs your Supabase login session.");
      return;
    }

    const oldText = button?.textContent || "Send from app";
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          quoteId: quote.id,
          to: email.to,
          subject: email.subject,
          text: email.body,
          reference: email.reference
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "Email sender is not configured yet.");
      alert(`Quote email sent to ${email.to}.`);
      if (typeof updateQuote === "function") updateQuote(quote.id, { status: "Sent" });
    } catch (error) {
      alert(`Could not send straight from the app yet: ${error.message || "Email service is not configured."}\n\nTo make this work, set up the Supabase Edge Function called send-quote-email with an email provider like Resend or SendGrid.`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  function addDirectEmailButtons() {
    document.querySelectorAll("[data-send-quote]").forEach((button) => {
      const id = button.dataset.sendQuote;
      if (!id || button.parentElement?.querySelector(`[data-send-in-app="${CSS.escape(id)}"]`)) return;
      const sendButton = document.createElement("button");
      sendButton.className = "primary send-in-app-button";
      sendButton.dataset.sendInApp = id;
      sendButton.type = "button";
      sendButton.textContent = "Send from app";
      button.insertAdjacentElement("beforebegin", sendButton);
    });
  }

  function enhanceEmailDialog() {
    const link = document.querySelector("#emailQuoteLink");
    if (!link) return;
    link.textContent = "Open email app";
    link.classList.remove("direct-email-link");
  }

  const oldRenderQuotes = typeof renderQuotes === "function" ? renderQuotes : null;
  if (oldRenderQuotes) {
    renderQuotes = function renderQuotesWithEmail() {
      oldRenderQuotes();
      addDirectEmailButtons();
      enhanceEmailDialog();
    };
  }

  const oldRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
  if (oldRenderDashboard) {
    renderDashboard = function renderDashboardWithEmail() {
      oldRenderDashboard();
      addDirectEmailButtons();
      enhanceEmailDialog();
    };
  }

  document.addEventListener("click", (event) => {
    const sendButton = event.target.closest?.("[data-send-in-app]");
    if (!sendButton) return;
    event.preventDefault();
    event.stopPropagation();
    sendQuoteInApp(sendButton.dataset.sendInApp, sendButton);
  }, true);

  const oldShowQuoteEmail = typeof showQuoteEmail === "function" ? showQuoteEmail : null;
  if (oldShowQuoteEmail) {
    showQuoteEmail = function showQuoteEmailAndEnhance(id) {
      oldShowQuoteEmail(id);
      enhanceEmailDialog();
    };
  }

  if (typeof render === "function") render();
  addDirectEmailButtons();
  enhanceEmailDialog();
})();
