(() => {
  const expandedClass = "weset-expanded-window";
  const bodyLockedClass = "weset-window-expanded-open";

  function ensureStyles() {
    if (document.querySelector("#expandWindowFixStyles")) return;
    const style = document.createElement("style");
    style.id = "expandWindowFixStyles";
    style.textContent = `
      body.${bodyLockedClass} { overflow: hidden; }
      .weset-expand-btn { align-items: center; background: #edf2f3; border: 0; border-radius: 6px; color: #145c58; cursor: pointer; display: inline-flex; font: inherit; font-size: 12px; font-weight: 800; justify-content: center; min-height: 32px; padding: 0 10px; white-space: nowrap; }
      .panel-head .weset-expand-btn { margin-left: auto; }
      .weset-expandable-window { min-width: 0; }
      .weset-expandable-window > .table-wrap, .weset-expandable-window .report-table-wrap, .weset-expandable-window .catalog-list, .weset-expandable-window .list, .weset-expandable-window .timeline, .weset-expandable-window .install-board, .weset-expandable-window .selected-items { max-height: min(62vh, 720px); overflow: auto; }
      .${expandedClass} { background: #fff !important; border-radius: 0 !important; bottom: 0 !important; box-shadow: 0 24px 90px rgba(0,0,0,.28) !important; display: block !important; left: 0 !important; margin: 0 !important; max-height: none !important; max-width: none !important; overflow: auto !important; padding: 18px !important; position: fixed !important; right: 0 !important; top: 0 !important; transform: none !important; width: 100vw !important; z-index: 9998 !important; }
      .${expandedClass} > .table-wrap, .${expandedClass} .report-table-wrap, .${expandedClass} .catalog-list, .${expandedClass} .list, .${expandedClass} .timeline, .${expandedClass} .install-board, .${expandedClass} .selected-items { max-height: calc(100vh - 140px) !important; overflow: auto !important; }
      .${expandedClass} table { min-width: 900px; }
      dialog.${expandedClass} { border: 0 !important; height: 100vh !important; max-height: 100vh !important; max-width: 100vw !important; padding: 0 !important; width: 100vw !important; }
      dialog.${expandedClass} .dialog-card, dialog.${expandedClass} .client-history-card, dialog.${expandedClass} .invoice-created-card { border-radius: 0 !important; height: 100vh !important; max-height: 100vh !important; max-width: 100vw !important; overflow: auto !important; width: 100vw !important; }
      .weset-expanded-toolbar { align-items: center; background: #145c58; color: #fff; display: none; gap: 10px; justify-content: space-between; margin: -18px -18px 16px; padding: 10px 14px; position: sticky; top: -18px; z-index: 2; }
      .${expandedClass} > .weset-expanded-toolbar { display: flex; }
      .weset-expanded-toolbar strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .weset-expanded-toolbar button { background: #fff; color: #145c58; min-height: 34px; }
      @media (max-width: 640px) { .weset-expand-btn { min-height: 34px; padding: 0 8px; } .${expandedClass} { padding: 12px !important; } .weset-expanded-toolbar { margin: -12px -12px 12px; top: -12px; } }
    `;
    document.head.appendChild(style);
  }

  function titleFor(node) {
    return node.querySelector("h1,h2,h3")?.textContent?.trim() || node.getAttribute("aria-label") || "Window";
  }

  function closeExpanded() {
    document.querySelectorAll(`.${expandedClass}`).forEach((node) => {
      node.classList.remove(expandedClass);
      node.querySelector(":scope > .weset-expanded-toolbar")?.remove();
      node.querySelectorAll(":scope .weset-expand-btn").forEach((button) => button.textContent = "Expand");
    });
    document.body.classList.remove(bodyLockedClass);
  }

  function openExpanded(node) {
    closeExpanded();
    node.classList.add(expandedClass);
    document.body.classList.add(bodyLockedClass);
    if (!node.querySelector(":scope > .weset-expanded-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.className = "weset-expanded-toolbar";
      toolbar.innerHTML = `<strong>${titleFor(node)}</strong><button type="button">Close full view</button>`;
      toolbar.querySelector("button")?.addEventListener("click", closeExpanded);
      node.prepend(toolbar);
    }
    node.querySelectorAll(":scope .weset-expand-btn").forEach((button) => button.textContent = "Close full view");
  }

  function toggleExpanded(node) {
    if (node.classList.contains(expandedClass)) closeExpanded();
    else openExpanded(node);
  }

  function addButtonToPanel(panel) {
    if (!panel || panel.dataset.expandReady === "1") return;
    const head = panel.querySelector(":scope > .panel-head") || panel.querySelector(".panel-head");
    if (!head) return;
    panel.classList.add("weset-expandable-window");
    panel.dataset.expandReady = "1";
    const button = document.createElement("button");
    button.className = "weset-expand-btn";
    button.type = "button";
    button.textContent = "Expand";
    button.title = "Show this whole window full screen";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleExpanded(panel);
    });
    head.appendChild(button);
  }

  function addButtonToDialog(dialog) {
    if (!dialog || dialog.dataset.expandReady === "1") return;
    const head = dialog.querySelector(".panel-head");
    if (!head) return;
    dialog.dataset.expandReady = "1";
    const button = document.createElement("button");
    button.className = "weset-expand-btn";
    button.type = "button";
    button.textContent = "Expand";
    button.title = "Show this window full screen";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleExpanded(dialog);
    });
    const closeButton = head.querySelector(".icon-btn, .ghost, button[aria-label='Close']");
    if (closeButton) head.insertBefore(button, closeButton);
    else head.appendChild(button);
  }

  function install() {
    ensureStyles();
    document.querySelectorAll(".panel").forEach(addButtonToPanel);
    document.querySelectorAll("dialog").forEach(addButtonToDialog);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(`.${expandedClass}`)) closeExpanded();
  });

  const observer = new MutationObserver(() => {
    if (window.requestIdleCallback) requestIdleCallback(install, { timeout: 500 });
    else setTimeout(install, 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(install, 250);
  setTimeout(install, 1200);
})();
