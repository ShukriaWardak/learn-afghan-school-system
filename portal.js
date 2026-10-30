"use strict";
(() => {
  const get = (id) => document.getElementById(id);
  const apiBase = "backend/api/";
  let csrfToken = "";
  let branches = [];

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
    get("branch-rows").replaceChildren();
    get("login-view").hidden = false;
    get("app-view").hidden = true;
    get("password").value = "";
    get("username").focus();
  }

  function showPortal(user) {
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
