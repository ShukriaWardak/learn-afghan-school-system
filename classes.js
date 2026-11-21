"use strict";
const Classes = {
  generation: 0, rows: [], editable: false, message: "Loading classes…",
  reset() {
    this.generation++;
    this.rows = [];
    this.editable = false;
    this.message = "Loading classes…";
  },
  async load() {
    const generation = ++this.generation;
    const token = Live.csrf;
    const currentRequest = () => this.generation === generation && current === "classes" && Live.active && Live.csrf === token;
    try {
      const data = await Live.request("classes.php");
      if (!currentRequest()) return;
      if (!Array.isArray(data.classes)) throw new Error("Invalid class list response.");
      this.rows = data.classes;
      this.editable = data.can_edit === true;
      this.message = data.has_more ? "Showing the first 500 classes." : this.rows.length ? "" : "No classes yet.";
    } catch (error) {
      if (!currentRequest()) return;
      if (error.status === 401) { Live.showLogin(); return; }
      this.rows = [];
      this.editable = false;
      this.message = error.message;
    }
    if (currentRequest()) render();
  },
  view() {
    const h = escapeHtml;
    const rows = this.rows.map((row, i) => "<tr><td>"+h(row.branch_name)+"</td><td>"+h(row.academic_year)+"</td><td>"+h(row.grade_level)+"</td><td>"+h(row.section)+"</td><td>"+(Number(row.active) ? "Active" : "Inactive")+"</td>"+(this.editable ? '<td><button type="button" class="ghost-btn" data-class-edit="'+i+'">Edit</button></td>' : "")+"</tr>").join("");
    return heading("Classes","Manage class sections by branch, academic year and grade.")
      + panel("Class register", '<p role="status">'+h(this.message)+'</p>'
      + (this.editable ? '<button type="button" class="primary-btn" id="classAdd">Add class</button><div id="classEditor"></div>' : '')
      + '<div class="table-wrap"><table><thead><tr><th>Branch</th><th>Start year</th><th>Grade</th><th>Section</th><th>Status</th>'
      + (this.editable ? '<th>Action</th>' : '') + '</tr></thead><tbody>'+rows+'</tbody></table></div>');
  },
  bind() {
    if (!this.editable) return;
    document.querySelector("#classAdd").onclick = () => this.edit();
    document.querySelectorAll("[data-class-edit]").forEach(button => {
      button.onclick = () => this.edit(this.rows[Number(button.dataset.classEdit)]);
    });
  },
  edit(row) {
    const root = document.querySelector("#classEditor");
    const h = escapeHtml;
    const options = state.branches.map(branch => '<option value="'+h(branch.id)+'">'+h(branch.name)+'</option>').join("");
    root.innerHTML = '<form class="form-grid" aria-label="Class details"><label>Branch <select name="branch_id" class="field" required><option value="">Select branch</option>'+options+'</select></label><label>Academic start year <input name="academic_year" class="field" type="number" min="2000" max="2100" required></label><label>Grade <input name="grade_level" class="field" type="number" min="1" max="12" required></label><label>Section <input name="section" class="field" maxlength="40" required></label><label><input name="active" type="checkbox" checked> Active</label><div><button type="submit" class="primary-btn">Save class</button> <button type="button" class="ghost-btn" id="classCancel">Cancel</button></div><p role="alert"></p></form>';
    const form = root.querySelector("form");
    const field = name => form.elements.namedItem(name);
    if (row) {
      for (const key of ["branch_id","academic_year","grade_level","section"]) field(key).value = row[key];
      field("active").checked = Number(row.active) === 1;
    }
    const token = Live.csrf, generation = this.generation;
    const stillHere = () => form.isConnected && Live.active && Live.csrf === token && generation === this.generation;
    const buttons = [...form.querySelectorAll("button")];
    const add = document.querySelector("#classAdd");
    const switchers = [add, ...document.querySelectorAll("[data-class-edit]")];
    form.querySelector("#classCancel").onclick = () => { root.replaceChildren(); add.focus(); };
    field("branch_id").focus();
    form.onsubmit = async event => {
      event.preventDefault();
      if (!stillHere() || buttons[0].disabled) return;
      const body = Object.fromEntries(new FormData(form));
      for (const key of ["branch_id","academic_year","grade_level"]) body[key] = Number(body[key]);
      body.active = field("active").checked;
      if (row) { body.id = Number(row.id); body.version = Number(row.version); }
      const errorBox = form.querySelector('[role="alert"]');
      errorBox.textContent = "";
      for (const button of [...buttons,...switchers]) button.disabled = true;
      try {
        await Live.request("classes.php", {method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":token},body:JSON.stringify(body)});
        if (stillHere()) { await this.load(); document.querySelector("#classAdd")?.focus(); }
      } catch (error) {
        if (stillHere()) {
          if (error.status === 401) Live.showLogin();
          else errorBox.textContent = error.message;
        }
      } finally {
        for (const button of [...buttons,...switchers]) button.disabled = false;
      }
    };
  }
};
