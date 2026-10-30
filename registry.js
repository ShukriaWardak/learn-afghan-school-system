"use strict";
// Connected department and personnel directories. No records are stored in localStorage.
const Registry = {
  pages: ["departments", "teachers", "staff", "admins"],
  rows: [], departments: [], loading: false, error: "", search: "", status: "all", page: "", sequence: 0,
  canRead(page) {
    return Live.active && (Live.user.role === "super_admin" ||
      (["teachers", "staff"].includes(page) && ["zone_admin", "branch_admin"].includes(Live.user.role)));
  },
  async load(page) {
    const sequence = ++this.sequence;
    this.page = page; this.rows = []; this.departments = []; this.error = "";
    this.search = ""; this.status = "all"; this.loading = true;
    render();
    if (!this.canRead(page)) { this.loading = false; render(); return; }
    const userId = Live.user.id;
    const endpoint = page === "departments" ? "departments.php" : page === "admins" ? "branch_admins.php" : "personnel.php?kind=" + (page === "teachers" ? "teacher" : "staff");
    try {
      const [data, departments] = await Promise.all([
        Live.request(endpoint),
        Live.user.role === "super_admin" && ["teachers", "staff"].includes(page) ? Live.request("departments.php") : Promise.resolve({departments: []})
      ]);
      if (sequence !== this.sequence || !Live.active || Live.user.id !== userId) return;
      this.rows = data.departments || data.admins || data.personnel || [];
      this.departments = departments.departments;
    } catch (error) {
      if (sequence !== this.sequence) return;
      if (error.status === 401) { Live.showLogin(); return; }
      this.error = error.message;
    } finally {
      if (sequence === this.sequence) { this.loading = false; if (Live.active && current === page) render(); }
    }
  },
  filteredRows() {
    const query = this.search.toLocaleLowerCase();
    return this.rows.filter(row => {
      const status = this.page === "admins" ? (Number(row.active) === 1 ? "active" : "inactive") : row.status;
      return (this.status === "all" || status === this.status) &&
        [row.code, row.name, row.full_name, row.display_name, row.username, row.branch_name, row.department_name, row.job_title, row.zone_name].some(value => String(value ?? "").toLocaleLowerCase().includes(query));
    });
  },
  table() {
    const rows = this.filteredRows();
    if (!rows.length) return '<div class="empty">No records match these filters.</div>';
    const department = this.page === "departments", admins = this.page === "admins";
    const mayEdit = Live.user.role === "super_admin" && !admins;
    const headers = department ? ["Code", "Department", "Parent"] : admins ? ["Name", "Username", "Branch", "Zone", "Status"] : ["Code", "Name", "Branch", "Department", "Job title", "Status"];
    if (mayEdit) headers.push("Action");
    return '<div class="table-wrap"><table><thead><tr>' + headers.map(h => '<th>'+h+'</th>').join("") + '</tr></thead><tbody>' + rows.map(row => {
      const values = department ? [row.code, row.name, row.parent_name || "—"] : admins ? [row.display_name, row.username, row.branch_name || "Not assigned", row.zone_name || "—", Number(row.active) === 1 ? "Active" : "Inactive"] : [row.code, row.full_name, row.branch_name, row.department_name, row.job_title, row.status];
      return '<tr>' + values.map(value => '<td>'+escapeHtml(value)+'</td>').join("") + (mayEdit ? '<td><button class="ghost-btn" data-registry-edit="'+Number(row.id)+'">Edit</button></td>' : "") + '</tr>';
    }).join("") + '</tbody></table></div>';
  },
  view(page) {
    const title = titleOf(page);
    if (!this.canRead(page)) return heading(title, "Your account does not have access to this directory.");
    if (this.page !== page || this.loading) return heading(title, "Loading database records…");
    const refresh = '<button class="ghost-btn" id="registryRefresh">Refresh directory</button>';
    if (this.error) return heading(title, "The directory could not be loaded.", refresh) + '<div class="note" role="alert">'+escapeHtml(this.error)+'</div>';
    const department = page === "departments", admins = page === "admins";
    const mayCreate = Live.user.role === "super_admin" && !admins;
    const button = (mayCreate ? '<button class="primary-btn" id="registryAdd">+ Add '+(department ? "department" : page === "teachers" ? "teacher" : "staff member")+'</button>' : "") + refresh;
    const description = department ? "Approved department codes and names. Existing parent assignments are preserved." : admins ? "Read-only branch administrator accounts, including inactive accounts. First 1,000 records." : "Personnel records within your authorized scope. First 1,000 records per directory; these records do not create sign-in accounts.";
    return heading(title, description, '<div class="toolbar">'+button+'</div>') + panel("Database directory", '<div class="toolbar"><label>Search<input class="search" id="registrySearch" placeholder="Search loaded records" value="'+escapeHtml(this.search)+'"></label>' + (!department ? '<label>Status<select class="select" id="registryStatus"><option value="all">All statuses</option><option value="active" '+(this.status === "active" ? "selected" : "")+'>Active</option><option value="inactive" '+(this.status === "inactive" ? "selected" : "")+'>Inactive</option></select></label>' : "") + '</div><p class="muted" id="registryCount">'+this.filteredRows().length+' of '+this.rows.length+' loaded records</p><div id="registryTable">'+this.table()+'</div>');
  },
  bind() {
    const refresh = document.querySelector("#registryRefresh");
    if (refresh) refresh.onclick = () => this.load(current);
    const add = document.querySelector("#registryAdd");
    if (add) add.onclick = () => this.openForm();
    const search = document.querySelector("#registrySearch");
    if (search) search.oninput = e => { this.search = e.target.value; this.updateTable(); };
    const status = document.querySelector("#registryStatus");
    if (status) status.onchange = e => { this.status = e.target.value; this.updateTable(); };
    document.querySelectorAll("[data-registry-edit]").forEach(button => button.onclick = () => this.openForm(this.rows.find(row => Number(row.id) === Number(button.dataset.registryEdit))));
  },
  updateTable() {
    document.querySelector("#registryTable").innerHTML = this.table();
    document.querySelector("#registryCount").textContent = this.filteredRows().length+' of '+this.rows.length+' loaded records';
    this.bind();
  },
  openForm(row = null) {
    if (!Live.active || Live.user.role !== "super_admin" || this.page === "admins") return;
    const page = this.page, department = page === "departments";
    if (!department && (!Live.zones.length || !state.branches.length || !this.departments.length)) { toast("Create a zone, branch and department before adding personnel."); return; }
    const dialog = document.createElement("dialog");
    dialog.className = "modal";
    dialog.setAttribute("aria-labelledby", "registryFormTitle");
    const input = (name, label, value, max, extra="") => '<label>'+label+'<input class="field" name="'+name+'" value="'+escapeHtml(value || "")+'" maxlength="'+max+'" required '+extra+'></label>';
    const select = (name, label, rows, selected) => '<label>'+label+'<select class="field" name="'+name+'" required>'+rows.map(item => '<option value="'+Number(item.id)+'" '+(Number(selected) === Number(item.id) ? "selected" : "")+'>'+escapeHtml(item.name)+'</option>').join("")+'</select></label>';
    const fields = (row ? '<p>Code: '+escapeHtml(row.code)+' (fixed)</p>' : input("code", "Unique code", "", 45, 'pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,44}"')) + input(department ? "name" : "full_name", department ? "Department name" : "Full name", row?.name || row?.full_name, 180) + (department ? "" : select("branch_id", "Branch", state.branches, row?.branch_id) + select("department_id", "Department", this.departments, row?.department_id) + input("job_title", "Job title", row?.job_title, 180) + '<label>Status<select class="field" name="status"><option value="active">Active</option><option value="inactive" '+(row?.status === "inactive" ? "selected" : "")+'>Inactive</option></select></label>');
    dialog.innerHTML = '<form><h2 id="registryFormTitle">'+(row ? "Edit" : "Add")+' '+(department ? "department" : page === "teachers" ? "teacher" : "staff member")+'</h2><div class="form-grid">'+fields+'</div><p class="auth-error" role="alert" id="registryFormError"></p><div class="modal-actions"><button type="button" class="ghost-btn" id="registryCancel">Cancel</button><button type="submit" class="primary-btn">Save to database</button></div></form>';
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    dialog.querySelector("#registryCancel").onclick = () => dialog.close();
    dialog.showModal();
    dialog.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget, submit = form.querySelector('[type="submit"]'), message = form.querySelector("#registryFormError");
      const body = Object.fromEntries(new FormData(form));
      if (row) body.id = Number(row.id);
      if (!department) {
        body.branch_id = Number(body.branch_id); body.department_id = Number(body.department_id);
        if (row) body.version = Number(row.version); else body.kind = page === "teachers" ? "teacher" : "staff";
      }
      submit.disabled = true; message.textContent = "";
      try {
        await Live.request(department ? "department_save.php" : "personnel_save.php", {method: "POST", headers: {"Content-Type": "application/json", "X-CSRF-Token": Live.csrf}, body: JSON.stringify(body)});
        dialog.close(); toast("Record saved and audit logged"); await this.load(page);
      } catch (error) { message.textContent = error.message; submit.disabled = false; }
    };
  }
};
