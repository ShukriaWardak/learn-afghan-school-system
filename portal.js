"use strict";
(() => {
  const get = (id) => document.getElementById(id);
  const apiBase = "backend/api/";
  let csrfToken = "";
  let branches = [];
  let zones = [];
  let departments = [];
  let currentUser = null;

  async function apiRequest(path, options = {}) {
    const response = await fetch(apiBase + path, {
      ...options,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body && typeof body.error === "string" ? body.error : "Server error (" + response.status + ")");
      error.status = response.status;
      throw error;
    }
    if (!body || typeof body !== "object") throw new Error("Unexpected server response");
    return body;
  }

  function message(id, text, error = false) {
    const element = get(id);
    element.textContent = text;
    element.classList.toggle("error", error);
    element.classList.toggle("success", !error && Boolean(text));
  }

  async function getCsrf() {
    const result = await apiRequest("csrf.php");
    if (typeof result.csrf_token !== "string") throw new Error("Invalid session token");
    csrfToken = result.csrf_token;
  }

  function showLogin() {
    branches = [];
    zones = [];
    departments = [];
    currentUser = null;
    get("management-section").hidden = true;
    get("department-section").hidden = true;
    get("audit-section").hidden = true;
    get("branch-rows").replaceChildren();
    get("login-view").hidden = false;
    get("app-view").hidden = true;
    get("password").value = "";
    get("username").focus();
  }

  function showPortal(user) {
    currentUser = user;
    get("management-section").hidden = user.role !== "super_admin";
    get("department-section").hidden = user.role !== "super_admin";
    get("audit-section").hidden = user.role !== "super_admin";
    get("login-view").hidden = true;
    get("app-view").hidden = false;
    const name = String(user.display_name || user.username || "Account");
    const role = String(user.role || "").replaceAll("_", " ");
    get("account-label").textContent = "Signed in as " + name + " (" + role + ")";
    message("login-message", "");
  }

  function renderBranches() {
    const q = get("branch-search").value.trim().toLowerCase();
    const zone = get("zone-filter").value;
    const visible = branches.filter((b) => {
      const fields = [b.code, b.name, b.location, b.zone_name].map((v) => String(v || "").toLowerCase());
      return (!zone || b.zone_code === zone) && (!q || fields.some((v) => v.includes(q)));
    });
    const tbody = get("branch-rows");
    tbody.replaceChildren();
    for (const branch of visible) {
      const tr = document.createElement("tr");
      for (const value of [branch.code, branch.name, branch.zone_name, branch.location || "—", branch.status]) {
        const td = document.createElement("td");
        td.textContent = String(value ?? "—");
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    message("branches-message", visible.length ? "" : (branches.length ? "No branches match the filters." : "No branch records have been entered or assigned to your account yet."));
  }

  function updateZoneOptions() {
    const select = get("zone-filter");
    select.replaceChildren();
    const all = new Option("All visible zones", "");
    select.add(all);
    const zones = [...new Map(branches.map((b) => [String(b.zone_code), String(b.zone_name)])).entries()].sort();
    for (const [code, name] of zones) select.add(new Option(name, code));
    get("zone-total").textContent = String(zones.length);
    get("branch-total").textContent = String(branches.length);
  }

  async function loadBranches() {
    message("branches-message", "Loading authorized records...");
    get("refresh-button").disabled = true;
    try {
      const result = await apiRequest("branches.php");
      if (!Array.isArray(result.branches)) throw new Error("Invalid branch response");
      branches = result.branches;
      updateZoneOptions();
      renderBranches();
      if (currentUser?.role === "super_admin") populateBranchEditor();
    } catch (error) {
      branches = [];
      updateZoneOptions();
      get("branch-rows").replaceChildren();
      message("branches-message", error.status === 403 ? "This account is not authorized to view the branch directory." : error.message, true);
      if (error.status === 401) {
        await getCsrf();
        showLogin();
        message("login-message", "Your session expired. Please sign in again.", true);
      }
    } finally {
      get("refresh-button").disabled = false;
    }
  }

  /** Management form options come only from authorized database responses. */
  async function loadZones() {
    if (currentUser?.role !== "super_admin") return;
    message("zone-message", "Loading approved zones...");
    try {
      const result = await apiRequest("zones.php");
      if (!Array.isArray(result.zones)) throw new Error("Unexpected zones response");
      zones = result.zones;
      const select = get("branch-zone");
      const previous = select.value;
      select.replaceChildren(new Option("Select an approved zone", ""));
      for (const zone of zones) {
        select.add(new Option(String(zone.code) + " — " + String(zone.name), String(zone.id)));
      }
      if (zones.some((z) => String(z.id) === previous)) select.value = previous;
      else select.value = "";
      if (zones.length === 0) {
        message("zone-message", "No approved zones yet. Add a confirmed zone before creating a branch.");
      } else {
        message("zone-message", "");
      }
      fillBranchEditor();
    } catch (error) {
      zones = [];
      get("branch-zone").replaceChildren(new Option("Zones unavailable", ""));
      message("zone-message", error.message, true);
    }
  }

  function populateBranchEditor() {
    const select = get("branch-record");
    const selected = select.value;
    select.replaceChildren(new Option("Create a new branch", ""));
    for (const branch of branches) {
      select.add(new Option(
        String(branch.code) + " — " + String(branch.name),
        String(branch.id)
      ));
    }
    select.value = branches.some((b) => String(b.id) === selected) ? selected : "";
    fillBranchEditor();
  }

  function fillBranchEditor() {
    const selected = get("branch-record").value;
    const branch = branches.find((b) => String(b.id) === selected);
    get("branch-code").value = branch ? String(branch.code) : "";
    get("branch-name").value = branch ? String(branch.name) : "";
    get("branch-location").value = branch ? String(branch.location || "") : "";
    get("branch-status").value = branch ? String(branch.status) : "pending";
    get("branch-zone").value = branch && zones.some((z) => String(z.id) === String(branch.zone_id))
      ? String(branch.zone_id) : "";
    get("branch-save-button").textContent = branch ? "Save changes" : "Create branch";
    message("branch-save-message", "");
  }

  function writeOptions(data) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify(data)
    };
  }

  get("zone-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentUser?.role !== "super_admin") return;
    const button = get("zone-save-button");
    button.disabled = true;
    message("zone-message", "Saving zone...");
    try {
      const code = get("zone-code").value.trim();
      const name = get("zone-name").value.trim();
      await apiRequest("zones.php", writeOptions({ code, name }));
      get("zone-form").reset();
      await loadZones();
      await loadAudit();
      message("zone-message", "Zone saved in MySQL and audited.");
    } catch (error) {
      message("zone-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  get("branch-record").addEventListener("change", fillBranchEditor);

  get("branch-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentUser?.role !== "super_admin") return;
    const button = get("branch-save-button");
    button.disabled = true;
    message("branch-save-message", "Saving branch...");
    try {
      const existingId = get("branch-record").value;
      const data = {
        action: existingId ? "update" : "create",
        zone_id: Number(get("branch-zone").value),
        code: get("branch-code").value.trim(),
        name: get("branch-name").value.trim(),
        location: get("branch-location").value.trim(),
        status: get("branch-status").value
      };
      if (existingId) data.id = Number(existingId);
      const result = await apiRequest("branch_save.php", writeOptions(data));
      await loadBranches();
      get("branch-record").value = String(result.branch.id);
      fillBranchEditor();
      await loadAudit();
      message("branch-save-message", "Branch saved in MySQL and audited.");
    } catch (error) {
      message("branch-save-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  function renderDepartments() {
    const tbody = get("departments-rows");
    tbody.replaceChildren();
    for (const item of departments) {
      const tr = document.createElement("tr");
      for (const value of [item.code, item.name, item.parent_id || "—"]) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    message("departments-message", departments.length ? "" : "No approved departments have been recorded.");
  }

  function populateDepartmentEditor() {
    const select = get("department-record");
    const selected = select.value;
    select.replaceChildren(new Option("Create new department", ""));
    for (const item of departments) {
      select.add(new Option(String(item.code) + " — " + String(item.name), String(item.id)));
    }
    select.value = departments.some((d) => String(d.id) === selected) ? selected : "";
    fillDepartmentEditor();
  }

  function fillDepartmentEditor() {
    const item = departments.find((d) => String(d.id) === get("department-record").value);
    get("department-code").value = item ? String(item.code) : "";
    get("department-name").value = item ? String(item.name) : "";
    get("department-save-button").textContent = item ? "Save department changes" : "Create department";
    message("department-save-message", "");
  }

  async function loadDepartments() {
    if (currentUser?.role !== "super_admin") return;
    const button = get("departments-refresh-button");
    button.disabled = true;
    message("departments-message", "Loading...");
    try {
      const result = await apiRequest("departments.php");
      if (!Array.isArray(result.departments)) throw new Error("Unexpected department response");
      departments = result.departments;
      renderDepartments();
      populateDepartmentEditor();
    } catch (error) {
      departments = [];
      get("departments-rows").replaceChildren();
      message("departments-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function loadAudit() {
    if (currentUser?.role !== "super_admin") return;
    const button = get("audit-refresh-button");
    button.disabled = true;
    message("audit-message", "Loading recent changes...");
    try {
      const result = await apiRequest("audit.php");
      if (!Array.isArray(result.events)) throw new Error("Unexpected audit response");
      const tbody = get("audit-rows");
      tbody.replaceChildren();
      for (const entry of result.events) {
        const tr = document.createElement("tr");
        for (const value of [entry.created_at, entry.actor_name, entry.action, entry.entity_type, entry.entity_id]) {
          const td = document.createElement("td");
          td.textContent = String(value ?? "—");
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      message("audit-message", result.events.length ? "" : "No organizational changes have been recorded.");
    } catch (error) {
      get("audit-rows").replaceChildren();
      message("audit-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  get("department-record").addEventListener("change", fillDepartmentEditor);
  get("departments-refresh-button").addEventListener("click", loadDepartments);
  get("audit-refresh-button").addEventListener("click", loadAudit);

  get("department-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentUser?.role !== "super_admin") return;
    const button = get("department-save-button");
    button.disabled = true;
    message("department-save-message", "Saving...");
    try {
      const selectedId = get("department-record").value;
      const data = {
        action: selectedId ? "update" : "create",
        code: get("department-code").value.trim(),
        name: get("department-name").value.trim()
      };
      if (selectedId) data.id = Number(selectedId);
      const result = await apiRequest("departments.php", writeOptions(data));
      await loadDepartments();
      get("department-record").value = String(result.department.id);
      fillDepartmentEditor();
      await loadAudit();
      message("department-save-message", "Department saved and logged in MySQL.");
    } catch (error) {
      message("department-save-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  get("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = get("login-button");
    button.disabled = true;
    message("login-message", "Signing in...");
    try {
      if (!csrfToken) await getCsrf();
      const result = await apiRequest("login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          username: get("username").value.trim(),
          password: get("password").value
        })
      });
      csrfToken = String(result.csrf_token || "");
      if (!result.user || !csrfToken) throw new Error("Unexpected sign-in response");
      showPortal(result.user);
      await loadBranches();
      if (currentUser?.role === "super_admin") {
        await loadZones();
        await loadDepartments();
        await loadAudit();
      }
    } catch (error) {
      message("login-message", error.message, true);
    } finally {
      get("password").value = "";
      button.disabled = false;
    }
  });

  get("logout-button").addEventListener("click", async () => {
    const button = get("logout-button");
    button.disabled = true;
    try {
      await apiRequest("logout.php", { method: "POST", headers: { "X-CSRF-Token": csrfToken } });
      csrfToken = "";
      showLogin();
      await getCsrf();
      message("login-message", "Signed out.", false);
    } catch (error) {
      message("branches-message", error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  get("refresh-button").addEventListener("click", loadBranches);
  get("branch-search").addEventListener("input", renderBranches);
  get("zone-filter").addEventListener("change", renderBranches);

  (async () => {
    message("login-message", "Checking the server...");
    try {
      const result = await apiRequest("session.php");
      if (!result.user) throw new Error("Unexpected session response");
      csrfToken = String(result.csrf_token || "");
      showPortal(result.user);
      await loadBranches();
      if (currentUser?.role === "super_admin") {
        await loadZones();
        await loadDepartments();
        await loadAudit();
      }
    } catch (error) {
      showLogin();
      if (error.status === 401) {
        try {
          await getCsrf();
          message("login-message", "");
        } catch (csrfError) {
          message("login-message", csrfError.message, true);
        }
      } else {
        message("login-message", "Could not check your session: " + error.message, true);
      }
    }
  })();
})();
