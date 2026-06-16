(() => {
  let editingClientId = "";

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function clientTitle(text) {
    const heading = els.clientDialog?.querySelector("h2");
    if (heading) heading.textContent = text;
  }

  function clientSubmitText(text) {
    const button = els.clientForm?.querySelector('button[type="submit"]');
    if (button) button.textContent = text;
  }

  function setClientMessage(message, type = "is-warn", focusField = null) {
    const status = document.querySelector("#clientAddressStatus");
    if (status) {
      status.textContent = message;
      status.className = `address-status ${type}`.trim();
    }
    if (focusField?.focus) focusField.focus();
  }

  function formatClientPostcode(value) {
    if (typeof formatPostcode === "function") return formatPostcode(value);
    const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return compact.length <= 3 ? compact : `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  }

  function validClientPostcode(value) {
    if (typeof isUkPostcode === "function") return isUkPostcode(value);
    return /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/i.test(formatClientPostcode(value));
  }

  function currentClientAddress() {
    const fields = clientAddressFields();
    if (typeof updateAddressPreview === "function") updateAddressPreview(fields);
    fields.postcode.value = formatClientPostcode(fields.postcode.value);
    return {
      address_line1: fields.line1.value.trim(),
      address_line2: fields.line2.value.trim(),
      city: fields.city.value.trim(),
      postcode: fields.postcode.value.trim()
    };
  }

  function validateClientForm() {
    const fields = clientAddressFields();
    const address = currentClientAddress();
    if (!document.querySelector("#clientCompany")?.value.trim()) {
      alert("Enter the company name before saving the client.");
      document.querySelector("#clientCompany")?.focus();
      return false;
    }
    if (!document.querySelector("#clientContact")?.value.trim()) {
      alert("Enter the contact name before saving the client.");
      document.querySelector("#clientContact")?.focus();
      return false;
    }
    if (!validClientPostcode(address.postcode)) {
      setClientMessage("Enter a valid company postcode, for example N16 6JA.", "is-warn", fields.postcode);
      return false;
    }
    if (!address.address_line1) {
      setClientMessage("Enter company address line 1 before saving the client.", "is-warn", fields.line1);
      return false;
    }
    if (!address.city) {
      setClientMessage("Enter the company town or city before saving the client.", "is-warn", fields.city);
      return false;
    }
    setClientMessage("Client address looks ready to save.", "is-ok");
    return true;
  }

  function clientFromRow(row) {
    if (typeof sbClientFromRow === "function") return sbClientFromRow(row);
    return {
      id: row.id,
      company: row.company_name || "",
      contact: row.contact_name || "",
      email: row.email || "",
      phone: row.phone || "",
      site: [row.address_line1, row.address_line2, row.city, row.postcode].filter(Boolean).join(", "),
      notes: row.notes || ""
    };
  }

  function splitAddress(text) {
    const value = String(text || "");
    const postcodeMatch = value.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
    const postcode = postcodeMatch ? formatClientPostcode(postcodeMatch[0]) : "";
    const withoutPostcode = postcodeMatch ? value.replace(postcodeMatch[0], "") : value;
    const parts = withoutPostcode.split(",").map((part) => part.trim()).filter(Boolean);
    return {
      line1: parts[0] || "",
      line2: parts.length > 2 ? parts.slice(1, -1).join(", ") : "",
      city: parts.length > 1 ? parts[parts.length - 1] : "",
      postcode
    };
  }

  function openNewClient() {
    editingClientId = "";
    els.clientForm?.reset();
    clientTitle("Add client");
    clientSubmitText("Save client");
    if (typeof updateAddressPreview === "function") updateAddressPreview(clientAddressFields());
    els.clientDialog?.showModal();
  }

  function openClientEditor(id) {
    const client = (state.clients || []).find((entry) => entry.id === id);
    if (!client) return;
    editingClientId = id;
    els.clientForm?.reset();
    clientTitle("Edit client");
    clientSubmitText("Update client");
    document.querySelector("#clientCompany").value = client.company || "";
    document.querySelector("#clientContact").value = client.contact || "";
    document.querySelector("#clientEmail").value = client.email || "";
    document.querySelector("#clientPhone").value = client.phone || "";
    document.querySelector("#clientNotes").value = client.notes || "";
    const address = splitAddress(client.site);
    document.querySelector("#clientAddressLine1").value = address.line1;
    document.querySelector("#clientAddressLine2").value = address.line2;
    document.querySelector("#clientAddressCity").value = address.city;
    document.querySelector("#clientAddressPostcode").value = address.postcode;
    if (typeof updateAddressPreview === "function") updateAddressPreview(clientAddressFields());
    els.clientDialog?.showModal();
  }

  async function saveClient(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (typeof sbIsConnected === "function" && !sbIsConnected()) {
      alert("Please log in first. Clients can be changed only when the app is connected to Supabase.");
      return;
    }
    if (!validateClientForm()) return;
    const address = currentClientAddress();
    const body = {
      company_name: document.querySelector("#clientCompany").value.trim(),
      contact_name: document.querySelector("#clientContact").value.trim(),
      email: document.querySelector("#clientEmail").value.trim(),
      phone: document.querySelector("#clientPhone").value.trim(),
      ...address,
      notes: document.querySelector("#clientNotes").value.trim()
    };
    const [saved] = editingClientId
      ? await sbRequest(`clients?id=eq.${editingClientId}`, { method: "PATCH", body })
      : await sbRequest("clients", { method: "POST", body });
    const client = clientFromRow(saved);
    state.clients = editingClientId
      ? (state.clients || []).map((entry) => entry.id === client.id ? client : entry)
      : [...(state.clients || []), client];
    editingClientId = "";
    if (typeof saveState === "function") saveState();
    els.clientForm?.reset();
    if (typeof updateAddressPreview === "function") updateAddressPreview(clientAddressFields());
    els.clientDialog?.close();
    if (typeof render === "function") render();
  }

  async function deleteClient(id) {
    const client = (state.clients || []).find((entry) => entry.id === id);
    if (!client) return;
    const linkedQuotes = (state.quotes || []).filter((quote) => quote.clientId === id);
    if (linkedQuotes.length) {
      alert(`This client has ${linkedQuotes.length} quote record(s). Keep the client, or delete those quotes first so the saved quotes do not break.`);
      return;
    }
    if (!confirm(`Delete ${client.company || "this client"}?`)) return;
    if (typeof sbIsConnected === "function" && sbIsConnected() && isUuid(id)) {
      await sbRequest(`clients?id=eq.${id}`, { method: "DELETE" });
    }
    state.clients = (state.clients || []).filter((entry) => entry.id !== id);
    if (typeof saveState === "function") saveState();
    if (typeof render === "function") render();
  }

  function renderClientRows() {
    const clients = typeof filteredClients === "function" ? filteredClients() : (state.clients || []);
    els.clientsTable.innerHTML = clients.map((client) => {
      const openWork = (state.quotes || []).filter((quote) => quote.clientId === client.id && quote.installStatus !== "Complete").length;
      return `<tr>
        <td><strong>${escapeHtml(client.company)}</strong><p class="meta">${escapeHtml(client.notes || "No notes")}</p></td>
        <td>${escapeHtml(client.contact)}<p class="meta">${escapeHtml(client.email)}</p></td>
        <td>${escapeHtml(client.site)}</td>
        <td>${escapeHtml(client.phone)}</td>
        <td>${openWork}</td>
        <td>
          <div class="card-actions">
            <button class="secondary" data-new-quote="${escapeHtml(client.id)}" type="button">Quote</button>
            <button class="ghost" data-edit-client="${escapeHtml(client.id)}" type="button">Edit</button>
            <button class="ghost danger" data-delete-client="${escapeHtml(client.id)}" type="button">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="6"><div class="empty">No clients in Supabase yet.</div></td></tr>`;
  }

  document.addEventListener("submit", (event) => {
    if (event.target?.matches?.("#clientForm")) saveClient(event).catch((error) => alert(`Could not save client: ${error.message || "Please try again."}`));
  }, true);

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest?.("#newClientBtn, #addClientInlineBtn");
    const editButton = event.target.closest?.("[data-edit-client]");
    const deleteButton = event.target.closest?.("[data-delete-client]");
    const quoteButton = event.target.closest?.("[data-new-quote]");

    if (addButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openNewClient();
    }
    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      openClientEditor(editButton.dataset.editClient);
    }
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      deleteClient(deleteButton.dataset.deleteClient).catch((error) => alert(`Could not delete client: ${error.message || "Please try again."}`));
    }
    if (quoteButton) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof switchView === "function") switchView("quotes");
      if (els.quoteClient) els.quoteClient.value = quoteButton.dataset.newQuote;
      if (typeof fillAddressFromText === "function" && typeof getClient === "function") fillAddressFromText(getClient(quoteButton.dataset.newQuote).site);
    }
  }, true);

  if (typeof renderClients === "function") renderClients = renderClientRows;
  if (typeof openClientDialog === "function") openClientDialog = openNewClient;
  if (typeof render === "function") render();
})();
