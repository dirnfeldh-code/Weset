(() => {
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const style = document.createElement("style");
  style.textContent = `
    .doc-edit-line select[data-doc-product] {
      min-height: 38px !important;
      width: 100% !important;
    }
    .doc-edit-line .doc-product-custom {
      display: none;
      margin-top: 6px;
    }
    .doc-edit-line.is-custom-product .doc-product-custom {
      display: block;
    }
  `;
  document.head.appendChild(style);

  function catalogItems() {
    return Array.isArray(state?.catalog) ? state.catalog : [];
  }

  function normalise(value) {
    return String(value || "").trim().toLowerCase();
  }

  function optionHtml(selectedName = "") {
    const selected = normalise(selectedName);
    const items = catalogItems();
    const hasSelected = items.some((item) => normalise(item.name) === selected);
    return `<option value="">Choose item</option>${items.map((item) => `<option value="${esc(item.name)}" data-item-id="${esc(item.id)}" ${normalise(item.name) === selected ? "selected" : ""}>${esc(item.name)} - ${esc(item.category || "Item")}</option>`).join("")}<option value="__custom" ${selected && !hasSelected ? "selected" : ""}>Custom line</option>`;
  }

  function findItemByName(name) {
    return catalogItems().find((item) => normalise(item.name) === normalise(name));
  }

  function lineControls(line) {
    return {
      product: line.querySelector("[data-doc-product]"),
      description: line.querySelector("[data-doc-description]"),
      qty: line.querySelector("[data-doc-qty]"),
      rate: line.querySelector("[data-doc-rate]"),
      vat: line.querySelector("[data-doc-vat]")
    };
  }

  function applyItemToLine(line, item) {
    const controls = lineControls(line);
    if (!item || !controls.product) return;
    controls.description.value = item.description || item.notes || "";
    controls.rate.value = Number(item.unitCost || 0);
    if (!Number(controls.qty.value || 0)) controls.qty.value = Number(item.defaultQuantity || 1);
    if (!controls.vat.value) controls.vat.value = "20% S";
  }

  function enhanceLine(line) {
    if (!line || line.dataset.dropdownEnhanced === "true") return;
    const controls = lineControls(line);
    if (!controls.product) return;
    const oldValue = controls.product.value || "";
    const select = document.createElement("select");
    select.dataset.docProduct = "";
    select.required = true;
    select.innerHTML = optionHtml(oldValue);

    const custom = document.createElement("input");
    custom.className = "doc-product-custom";
    custom.placeholder = "Custom product or service";
    custom.value = findItemByName(oldValue) ? "" : oldValue;

    controls.product.replaceWith(select);
    select.insertAdjacentElement("afterend", custom);
    line.dataset.dropdownEnhanced = "true";

    const syncCustom = () => {
      const isCustom = select.value === "__custom";
      line.classList.toggle("is-custom-product", isCustom);
      if (isCustom) {
        select.dataset.customValue = custom.value.trim();
      } else {
        delete select.dataset.customValue;
      }
    };

    select.addEventListener("change", () => {
      if (select.value === "__custom") {
        syncCustom();
        custom.focus();
        return;
      }
      const item = findItemByName(select.value);
      applyItemToLine(line, item);
      syncCustom();
    });

    custom.addEventListener("input", () => {
      select.dataset.customValue = custom.value.trim();
    });

    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    Object.defineProperty(select, "value", {
      get() {
        return select.dataset.customValue || descriptor.get.call(select);
      },
      set(next) {
        const item = findItemByName(next);
        if (item) {
          descriptor.set.call(select, item.name);
          custom.value = "";
          delete select.dataset.customValue;
        } else if (next) {
          descriptor.set.call(select, "__custom");
          custom.value = next;
          select.dataset.customValue = next;
        } else {
          descriptor.set.call(select, "");
          custom.value = "";
          delete select.dataset.customValue;
        }
        syncCustom();
      }
    });

    select.value = oldValue;
    syncCustom();
  }

  function enhanceEditor() {
    document.querySelectorAll("#docEditLines [data-doc-line]").forEach(enhanceLine);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-edit-document], #addDocLine, #resetDocDetails")) {
      setTimeout(enhanceEditor, 60);
      setTimeout(enhanceEditor, 250);
    }
  }, true);

  const oldOpen = window.wesetOpenQuoteDocumentEditor;
  if (typeof oldOpen === "function") {
    window.wesetOpenQuoteDocumentEditor = async (...args) => {
      const result = await oldOpen(...args);
      enhanceEditor();
      setTimeout(enhanceEditor, 100);
      return result;
    };
  }

  const observer = new MutationObserver(() => enhanceEditor());
  observer.observe(document.body, { childList: true, subtree: true });
  enhanceEditor();
})();
