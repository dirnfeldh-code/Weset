(() => {
  const expandedClass = "weset-expanded-window";
  const bodyLockedClass = "weset-window-expanded-open";
  const backdropClass = "weset-expanded-backdrop";

  function ensureStyles() {
    if (document.querySelector("#expandWindowFixStyles")) return;
    const style = document.createElement("style");
    style.id = "expandWindowFixStyles";
    style.textContent = `
      body.${bodyLockedClass} { overflow: hidden; }
      .${backdropClass} { background: rgba(17, 34, 38, .42); bottom: 0; left: 0; position: fixed; right: 0; top: 0; z-index: 9996; }
      .weset-expand-btn { align-items: center; background: #edf2f3; border: 0; border-radius: 6px; color: #145c58; cursor: pointer; display: inline-flex; font: inherit; font-size: 12px; font-weight: 800; justify-content: center; min-height: 32px; padding: 0 10px; white-space: nowrap; }
      .weset-expand-btn:hover { background: #dfe9ea; }
      .panel-head .weset-expand-btn { margin-left: auto; }
      .weset-expandable-window { min-width: 0; }
      .weset-expandable-window > .table-wrap, .weset-expandable-window .report-table-wrap, .weset-expandable-window .catalog-list, .weset-expandable-window .list, .weset-expandable-window .timeline, .weset-expandable-window .install-board, .weset-expandable-window .selected-items { max-height: min(62vh, 720px); overflow: auto; }
      .${expandedClass} { background: #fff !important; border: 1px solid #d8e2e3 !important; border-radius: 10px !important; bottom: 18px !important; box-shadow: 0 24px 90px rgba(0,0,0,.24) !important; display: block !important; left: max(18px, calc((100vw - 1280px) / 2)) !important; margin: 0 !important; max-height: calc(100vh - 36px) !important; max-width: 1280px !important; overflow: auto !important; padding: 18px !important; position: fixed !important; right: max(18px, calc((100vw - 1280px) / 2)) !important; top: 18px !important; transform: none !important; width: auto !important; z-index: 9997 !important; }
      .${expandedClass} > .table-wrap, .${expandedClass} .report-table-wrap, .${expandedClass} .catalog-list, .${expandedClass} .list, .${expandedClass} .timeline, .${expandedClass} .install-board, .${expandedClass} .selected-items { max-height: calc(100vh - 150px) !important; overflow: auto !important; }
      .${expandedClass} table { min-width: 900px; }
      dialog.${expandedClass} { border: 0 !important; height: auto !important; max-height: calc(100vh - 36px) !important; max-width: 1280px !important; padding: 0 !important; width: calc(100vw - 36px) !important; }
      dialog.${expandedClass} .dialog-card, dialog.${expandedClass} .client-history-card, dialog.${expandedClass} .invoice-created-card { border-radius: 10px !important; max-height: calc(100vh - 36px) !important; max-width: 1280px !important; overflow: auto !important; width: 100% !important; }
      .weset-expanded-toolbar { align-items: center; background: #145c58; border-radius: 8px; color: #fff; display: none; gap: 10px; justify-content: space-between; margin: 0 0 14px; padding: 10px 12px; position: sticky; top: 0; z-index: 2; }
      .${expandedClass} > .weset-expanded-toolbar { display: flex; }
      .weset-expanded-toolbar strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .weset-expanded-toolbar button { background: #fff; color: #145c58; min-height: 34px; }
      @media (max-width: 720px) {
        .weset-expand-btn { min-height: 34px; padding: 0 8px; }
        .${expandedClass} { border-radius: 8px !important; bottom: 10px !important; left: 10px !important; max-height: calc(100vh - 20px) !important; padding: 12px !important; right: 10px !important; top: 10px !important; }
        dialog.${expandedClass} { max-height: calc(100vh - 20px) !important; width: calc(100vw - 20px) !important; }
        dialog.${expandedClass} .dialog-card, dialog.${expandedClass} .client-history-card, dialog.${expandedClass} .invoice-created-card { max-height: calc(100vh - 20px) !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function titleFor(node) {
    return node.querySelector("h1,h2,h3")?.textContent?.trim() || node.getAttribute("aria-label") || "Details";
  }

  function ensureBackdrop() {
    let backdrop = document.querySelector(`.${backdropClass}`);
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.className = backdropClass;
    backdrop.addEventListener("click", closeExpanded);
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function closeExpanded() {
    document.querySelectorAll(`.${expandedClass}`).forEach((node) => {
      node.classList.remove(expandedClass);
      node.querySelector(":scope > .weset-expanded-toolbar")?.remove();
      node.querySelectorAll(":scope .weset-expand-btn").forEach((button) => button.textContent = "Expand");
    });
    document.querySelector(`.${backdropClass}`)?.remove();
    document.body.classList.remove(bodyLockedClass);
  }

  function openExpanded(node) {
    closeExpanded();
    ensureBackdrop();
    node.classList.add(expandedClass);
    document.body.classList.add(bodyLockedClass);
    if (!node.querySelector(":scope > .weset-expanded-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.className = "weset-expanded-toolbar";
      toolbar.innerHTML = `<strong>${titleFor(node)}</strong><button type="button">Close expanded view</button>`;
      toolbar.querySelector("button")?.addEventListener("click", closeExpanded);
      node.prepend(toolbar);
    }
    node.querySelectorAll(":scope .weset-expand-btn").forEach((button) => button.textContent = "Close expanded view");
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
    button.title = "Expand this area inside the app";
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
    button.title = "Expand this window inside the app";
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
