(() => {
  let editingUserId = "";

  const html = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));

  function userFromRow(row) {
    return {
      id: row.id,
      name: row.full_name || row.email || "User",
      email: row.email || "",
      role: row.role || "Staff",
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      active: row.active !== false
    };
  }

  function currentUserRows() {
    return Array.isArray(state?.users) ? state.users : [];
  }

  function renderUserRows() {
    const table = els.usersTable;
    if (!table) return;
    const headerRow = table.closest("table")?.querySelector("thead tr");
    if (headerRow && !headerRow.querySelector("[data-user-actions-head]")) {
      headerRow.insertAdjacentHTML("beforeend", `<th data-user-actions-head>Actions</th>`);
    }
    table.innerHTML = currentUserRows().map((user) => `<tr>
      <td><strong>${html(user.name)}</strong><p class="meta">${html(user.email)}</p></td>
      <td>${html(user.role)}</td>
      <td>${(user.permissions || []).map(viewLabel).join(", ")}</td>
      <td><span class="badge ${user.active ? "Accepted" : "Declined"}">${user.active ? "Active" : "Inactive"}</span></td>
      <td>
        <div class="card-actions">
          <button class="secondary" data-edit-user="${html(user.id)}" type="button">Edit</button>
          <button class="ghost danger" data-delete-user="${html(user.id)}" type="button">Delete</button>
        </div>
      </td>
    </tr>`).join("") || `<tr><td colspan="5"><div class="empty">No app users saved in Supabase yet.</div></td></tr>`;
  }

  function openNewUser() {
    editingUserId = "";
    els.userForm.reset();
    els.userDialog.querySelector("h2").textContent = "Create user";
    document.querySelector("#userEmail").readOnly = false;
    document.querySelector("#userPassword").required = true;
    document.querySelector("#userPassword").placeholder = "";
    els.userDialog.showModal();
  }

  function openUserEditor(id) {
    const user = currentUserRows().find((entry) => entry.id === id);
    if (!user) return;
    editingUserId = id;
    els.userForm.reset();
    els.userDialog.querySelector("h2").textContent = "Edit user";
    document.querySelector("#userName").value = user.name || "";
    document.querySelector("#userEmail").value = user.email || "";
    document.querySelector("#userEmail").readOnly = true;
    document.querySelector("#userPassword").value = "";
    document.querySelector("#userPassword").required = false;
    document.querySelector("#userPassword").placeholder = "Change password in Supabase Authentication";
    document.querySelector("#userRole").value = user.role || "Staff";
    document.querySelectorAll("input[name='userPermission']").forEach((input) => {
      input.checked = (user.permissions || []).includes(input.value);
    });
    document.querySelector("#userActive").checked = user.active !== false;
    els.userDialog.showModal();
  }

  function bodyFromForm() {
    const permissions = [...document.querySelectorAll("input[name='userPermission']:checked")].map((input) => input.value);
    if (!permissions.length) throw new Error("Choose at least one page this user can see.");
    const full_name = document.querySelector("#userName").value.trim();
    const email = document.querySelector("#userEmail").value.trim().toLowerCase();
    if (!full_name) throw new Error("Add the user's full name.");
    if (!email) throw new Error("Add the user's email address.");
    return {
      full_name,
      email,
      role: document.querySelector("#userRole").value,
      permissions,
      active: document.querySelector("#userActive").checked
    };
  }

  async function saveUserToSupabase(event) {
    event.preventDefault();
    if (typeof sbRequireSignedIn === "function" && !sbRequireSignedIn(event)) return;
    try {
      const body = bodyFromForm();
      let saved;
      if (editingUserId) {
        const path = isUuid(editingUserId)
          ? `app_users?id=eq.${editingUserId}`
          : `app_users?email=eq.${encodeURIComponent(body.email)}`;
        [saved] = await sbRequest(path, { method: "PATCH", body });
      } else {
        [saved] = await sbRequest("app_users", { method: "POST", body });
        if (document.querySelector("#userPassword").value) {
          alert("App access was saved. For login, create or update the password in Supabase Authentication > Users.");
        }
      }
      const user = userFromRow(saved || { id: editingUserId || crypto.randomUUID(), ...body });
      state.users = [user, ...currentUserRows().filter((entry) => entry.id !== user.id && entry.email !== user.email)];
      saveState();
      editingUserId = "";
      els.userForm.reset();
      els.userDialog.close();
      renderUserRows();
    } catch (error) {
      alert(`Could not save this user: ${error.message || "Please check Supabase and try again."}`);
    }
  }

  async function deleteUser(id) {
    const user = currentUserRows().find((entry) => entry.id === id);
    if (!user) return;
    if (!confirm(`Delete ${user.email} from app access? This will not delete the Supabase Auth login.`)) return;
    if (isUuid(id)) {
      await sbRequest(`app_users?id=eq.${id}`, { method: "DELETE" });
    } else {
      await sbRequest(`app_users?email=eq.${encodeURIComponent(user.email)}`, { method: "DELETE" });
    }
    state.users = currentUserRows().filter((entry) => entry.id !== id);
    saveState();
    renderUserRows();
  }

  function replaceButton(id, onClick) {
    const button = document.querySelector(id);
    if (!button) return null;
    const clone = button.cloneNode(true);
    button.replaceWith(clone);
    clone.addEventListener("click", onClick);
    return clone;
  }

  function installUserFix() {
    if (!els?.usersTable || !els?.userForm) return;
    if (typeof renderUsers === "function") renderUsers = renderUserRows;
    if (typeof openUserDialog === "function") openUserDialog = openNewUser;
    const cleanForm = els.userForm.cloneNode(true);
    els.userForm.replaceWith(cleanForm);
    els.userForm = cleanForm;
    els.userForm.addEventListener("submit", saveUserToSupabase);
    replaceButton("#newUserBtn", openNewUser);
    replaceButton("#closeUserDialog", () => els.userDialog.close());
    els.usersTable.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-user]");
      const deleteButton = event.target.closest("[data-delete-user]");
      if (editButton) openUserEditor(editButton.dataset.editUser);
      if (deleteButton) deleteUser(deleteButton.dataset.deleteUser).catch((error) => alert(`Could not delete this user: ${error.message || "Please check Supabase and try again."}`));
    });
    renderUserRows();
  }

  installUserFix();
})();
