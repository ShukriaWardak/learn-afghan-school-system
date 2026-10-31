"use strict";
// Authenticated student directory. Student records never use browser storage.
const Students = {
  rows: [], branches: [], loading: false, error: "", search: "", status: "all", branch: "all",
  limit: 1000, sequence: 0, dialog: null,
  canRead() {
    return Live.active && ["super_admin", "zone_admin", "branch_admin"].includes(Live.user?.role);
  },
  canWrite() { return Live.active && Live.user?.role === "super_admin"; },
  reset() {
    ++this.sequence;
    this.rows = []; this.branches = []; this.loading = false; this.error = "";
    this.search = ""; this.status = "all"; this.branch = "all";
    this.dialog?.close(); this.dialog = null;
  },
  async load() {
    const sequence = ++this.sequence, userId = Live.user?.id, csrf = Live.csrf;
    const sessionIsCurrent = () => sequence === this.sequence && Live.active && Live.user?.id === userId && Live.csrf === csrf;
    this.rows = []; this.branches = []; this.error = ""; this.loading = true;
    if (!this.canRead()) { this.loading = false; render(); return; }
    render();
    try {
      const [data, directory] = await Promise.all([Live.request("students.php"), Live.request("branches.php")]);
      if (!sessionIsCurrent()) return;
      if (!Array.isArray(data.students) || !Array.isArray(directory.branches)) throw new Error("Invalid student directory response. Refresh and try again.");
      this.rows = data.students;
      this.branches = directory.branches;
      this.limit = Number(data.limit) || 1000;
      if (!this.branches.some(b => String(b.id) === this.branch)) this.branch = "all";
    } catch (error) {
      if (!sessionIsCurrent()) return;
      if (error.status === 401) { Live.showLogin(); return; }
      this.error = error.message;
    } finally {
      if (sessionIsCurrent()) { this.loading = false; if (current === "students") render(); }
    }
  },
  filteredRows() {
    const query = this.search.trim().toLocaleLowerCase();
    return this.rows.filter(row => (this.status === "all" || row.status === this.status)
      && (this.branch === "all" || String(row.branch_id) === this.branch)
      && [row.student_code, row.full_name, row.branch_name, row.grade_level].some(value => String(value ?? "").toLocaleLowerCase().includes(query)));
  },
  table() {
    const rows = this.filteredRows(), edit = this.canWrite();
    if (!rows.length) return '<div class="empty">'+(this.rows.length ? "No students match these filters." : "No students are registered in your authorized scope.")+'</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Student code</th><th>Full name</th><th>Branch</th><th>Grade / level</th><th>Status</th>'+(edit ? '<th>Action</th>' : "")+'</tr></thead><tbody>'+rows.map(row => '<tr>'
      +[row.student_code, row.full_name, row.branch_name, row.grade_level, row.status].map(value => '<td>'+escapeHtml(value)+'</td>').join("")
      +(edit ? '<td><button class="ghost-btn" data-student-edit="'+Number(row.id)+'">Edit</button></td>' : "")+'</tr>').join("")+'</tbody></table></div>';
  },
  view() {
    if (!this.canRead()) return heading("Students", "Your account does not have access to the student directory.");
    if (this.loading) return heading("Students", "Loading authorized student records…")+'<p role="status">Please wait…</p>';
    const refresh = '<button class="ghost-btn" id="studentsRefresh">Refresh students</button>';
    if (this.error) return heading("Students", "The student directory could not be loaded.", refresh)+'<div class="note" role="alert">'+escapeHtml(this.error)+'</div>';
    const add = this.canWrite() ? '<button class="primary-btn" id="studentsAdd">+ Register student</button>' : "";
    const options = ["active", "inactive", "graduated"].map(value => '<option value="'+value+'" '+(this.status === value ? "selected" : "")+'>'+value[0].toUpperCase()+value.slice(1)+'</option>').join("");
    const branches = this.branches.map(b => '<option value="'+Number(b.id)+'" '+(this.branch === String(b.id) ? "selected" : "")+'>'+escapeHtml(b.name)+'</option>').join("");
    return heading("Students", "Students within your assigned scope. Only super administrators can register or edit records.", '<div class="toolbar">'+add+refresh+'</div>')
      +panel("Student directory", '<div class="toolbar"><label>Search<input id="studentsSearch" class="search" type="search" placeholder="Code, name, branch or grade" value="'+escapeHtml(this.search)+'"></label><label>Status<select id="studentsStatus" class="select"><option value="all">All statuses</option>'+options+'</select></label><label>Branch<select id="studentsBranch" class="select"><option value="all">All accessible branches</option>'+branches+'</select></label></div>'
      +'<p id="studentsCount" role="status" aria-live="polite">'+this.filteredRows().length+' of '+this.rows.length+' loaded students</p><div id="studentsTable">'+this.table()+'</div><p class="muted">Up to '+this.limit+' authorized records are loaded. Filters apply to these loaded records.</p>');
  },
  bind() {
    const get = id => document.querySelector("#"+id);
    if (get("studentsRefresh")) get("studentsRefresh").onclick = () => this.load();
    if (get("studentsAdd")) get("studentsAdd").onclick = () => this.openForm();
    if (get("studentsSearch")) get("studentsSearch").oninput = event => { this.search = event.target.value; this.updateTable(); };
    if (get("studentsStatus")) get("studentsStatus").onchange = event => { this.status = event.target.value; this.updateTable(); };
    if (get("studentsBranch")) get("studentsBranch").onchange = event => { this.branch = event.target.value; this.updateTable(); };
    document.querySelectorAll("[data-student-edit]").forEach(button => {
      button.onclick = () => { const row = this.rows.find(item => Number(item.id) === Number(button.dataset.studentEdit)); if (row) this.openForm(row); };
    });
  },
  updateTable() {
    document.querySelector("#studentsTable").innerHTML = this.table();
    document.querySelector("#studentsCount").textContent = this.filteredRows().length+' of '+this.rows.length+' loaded students';
    this.bind();
  },
  openForm(row = null) {
    if (!this.canWrite() || this.dialog) return;
    if (!this.branches.length) { toast("Create a branch before registering a student."); return; }
    const userId = Live.user.id, csrf = Live.csrf, sequence = this.sequence;
    const dialog = document.createElement("dialog");
    dialog.className = "modal"; dialog.setAttribute("aria-labelledby", "studentFormTitle");
    const input = (name, label, value, max, extra = "") => '<label>'+label+'<input class="field" name="'+name+'" value="'+escapeHtml(value ?? "")+'" maxlength="'+max+'" required '+extra+'></label>';
    const code = row ? '<p>Student code: <strong>'+escapeHtml(row.student_code)+'</strong> (fixed)</p>' : input("student_code", "Unique student code", "", 45, 'pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,44}" title="2–45 letters, numbers, underscores or hyphens"');
    const branches = this.branches.map(b => '<option value="'+Number(b.id)+'" '+(Number(row?.branch_id) === Number(b.id) ? "selected" : "")+'>'+escapeHtml(b.name)+'</option>').join("");
    const statuses = ["active", "inactive", "graduated"].map(value => '<option value="'+value+'" '+((row?.status || "active") === value ? "selected" : "")+'>'+value[0].toUpperCase()+value.slice(1)+'</option>').join("");
    dialog.innerHTML = '<form><h2 id="studentFormTitle">'+(row ? "Edit student" : "Register student")+'</h2>'+code+'<div class="form-grid">'
      +input("full_name", "Full name", row?.full_name, 180, 'dir="auto"')+'<label>Branch<select class="field" name="branch_id" required><option value="">Select a branch</option>'+branches+'</select></label>'
      +input("grade_level", "Grade / level", row?.grade_level, 40)+'<label>Status<select class="field" name="status">'+statuses+'</select></label></div>'
      +'<p id="studentFormError" class="auth-error" role="alert" aria-live="polite"></p><button type="button" class="ghost-btn" id="studentReload" hidden>Close and refresh latest records</button><div class="modal-actions"><button type="button" class="ghost-btn" id="studentCancel">Cancel</button><button type="submit" class="primary-btn">Save to database</button></div></form>';
    this.dialog = dialog;
    document.body.append(dialog);
    dialog.onclose = () => { dialog.remove(); if (this.dialog === dialog) this.dialog = null; };
    const form = dialog.querySelector("form"), cancel = dialog.querySelector("#studentCancel"), message = dialog.querySelector("#studentFormError"), reload = dialog.querySelector("#studentReload");
    let saving = false;
    cancel.onclick = () => dialog.close();
    dialog.oncancel = event => { if (saving) event.preventDefault(); };
    reload.onclick = () => { dialog.close(); this.load(); };
    dialog.showModal();
    form.onsubmit = async event => {
      event.preventDefault();
      if (saving || !this.canWrite() || Live.user.id !== userId || Live.csrf !== csrf || this.sequence !== sequence) return;
      const body = Object.fromEntries(new FormData(form));
      body.full_name = body.full_name.trim(); body.grade_level = body.grade_level.trim(); body.branch_id = Number(body.branch_id);
      if (row) { body.id = Number(row.id); body.version = Number(row.version); }
      else body.student_code = body.student_code.trim();
      saving = true; message.textContent = ""; reload.hidden = true;
      const controls = [...form.querySelectorAll("input,select,button")]; controls.forEach(control => control.disabled = true);
      const sessionIsCurrent = () => this.canWrite() && Live.user.id === userId && Live.csrf === csrf && this.sequence === sequence;
      try {
        await Live.request("student_save.php", {method: "POST", headers: {"Content-Type": "application/json", "X-CSRF-Token": csrf}, body: JSON.stringify(body)});
        if (!sessionIsCurrent()) return;
        dialog.close(); toast("Student saved and audit logged"); await this.load();
      } catch (error) {
        if (!sessionIsCurrent()) return;
        if (error.status === 401) { Live.showLogin(); return; }
        message.textContent = error.message;
        reload.hidden = ![404, 409].includes(error.status);
      } finally { saving = false; controls.forEach(control => control.disabled = false); }
    };
  }
};
