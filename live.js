"use strict";
/* Authenticated admin integration. The existing localStorage prototype is a separate, labelled demo. */
const Live = {
  active: false, user: null, csrf: null, zones: [], users: [], events: [], pageLoading: false, pageError: "",
  async request(path, options={}) {
    const response=await fetch("backend/api/"+path, {credentials:"same-origin",cache:"no-store",...options});
    let data={};
    try { data=await response.json(); } catch {}
    if (!response.ok) {
      const error=new Error(data.error || "Request failed ("+response.status+")");
      error.status=response.status;
      throw error;
    }
    return data;
  },
  demo() {
    document.documentElement.classList.remove("app-loading","auth-required");
    const environment=document.querySelector(".environment");
    if (environment) environment.textContent="● DEMO · LOCAL DATA ONLY";
  },
  showScreen(html) {
    document.documentElement.classList.remove("app-loading");
    document.documentElement.classList.add("auth-required");
    let root=document.querySelector("#authScreen");
    if (!root) { root=document.createElement("div");root.id="authScreen";document.body.append(root); }
    root.className="";
    root.innerHTML=html;
  },
  showError(message) {
    this.showScreen('<section class="auth-card" role="alert"><h1>LEARN Afghan</h1><h2>Server setup required</h2><p>'+escapeHtml(message)+'</p><p>The connected database must be configured and available. No demonstration records have been loaded as live records.</p><p><a class="setup-link" href="check-setup.php">Check local setup</a></p><button type="button" class="ghost-btn" id="retryServer">Retry connection</button></section>');
    document.querySelector("#retryServer").onclick=()=>this.init();
  },
  showLogin() {
    Students.reset();Attendance.reset();PersonnelAttendance.reset();Reports.reset();Approvals.reset();Finance.reset();
    this.active=false;this.user=null;this.csrf=null;this.users=[];this.events=[];
    document.querySelector("#main").replaceChildren();
    this.showScreen(`<div class="login-shell">
      <aside class="login-visual" aria-label="LEARN Afghan education">
        <div class="login-visual-photo" aria-hidden="true"></div>
        <div class="login-visual-copy">
          <span class="login-accent" aria-hidden="true"></span>
          <h2>Education continues.</h2>
          <p>LEARN Afghan · School Management System</p>
        </div>
      </aside>
      <section class="login-panel">
        <div class="login-panel-content">
          <img class="login-brand" src="assets/learn-afghan-logo.svg" width="170" height="170" alt="LEARN Afghan logo">
          <h1 id="loginTitle">Welcome back</h1>
          <p class="login-subtitle">Sign in to your LEARN Afghan account.</p>
          <form class="login-form" id="loginForm" autocomplete="on" aria-labelledby="loginTitle">
            <label for="loginUser">Username</label>
            <div class="login-input-wrap">
              <input class="login-field" id="loginUser" name="username" type="text" placeholder="Enter your username" autocomplete="username" maxlength="100" autocapitalize="none" spellcheck="false" required>
              <svg class="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
            </div>
            <label for="loginPassword">Password</label>
            <div class="login-input-wrap has-toggle">
              <input class="login-field" id="loginPassword" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required>
              <button class="login-visibility" id="togglePassword" type="button" aria-label="Show password" aria-pressed="false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>
              </button>
            </div>
            <p id="loginError" class="auth-error" role="alert" aria-live="polite"></p>
            <button type="submit" class="login-submit" id="submitLogin">Sign in securely
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg>
            </button>
            <p class="login-trust"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4.5 5v6c0 5.2 3 8.6 7.5 11 4.5-2.4 7.5-5.8 7.5-11V5L12 2Z"/></svg>Authorized staff access only.</p>
            <p class="login-meta">Need help? <a class="setup-link" href="check-setup.php">Check local setup</a></p>
            <small class="login-disclaimer">Development environment. Do not enter real confidential records until deployment is approved.</small>
          </form>
        </div>
      </section>
    </div>`);
    document.querySelector("#authScreen").classList.add("auth-login-page");
    const passwordField=document.querySelector("#loginPassword");
    const passwordToggle=document.querySelector("#togglePassword");
    passwordToggle.onclick=()=>{
      const visible=passwordField.type==="password";
      passwordField.type=visible?"text":"password";
      passwordToggle.setAttribute("aria-pressed",String(visible));
      passwordToggle.setAttribute("aria-label",visible?"Hide password":"Show password");
    };
    document.querySelector("#loginForm").onsubmit=async e=>{
      e.preventDefault();
      const form=e.currentTarget, btn=document.querySelector("#submitLogin");
      const message=document.querySelector("#loginError");
      btn.disabled=true; message.textContent="";
      try {
        const token=await this.request("csrf.php");
        const credentials={username:form.elements.namedItem("username").value.trim(),password:form.elements.namedItem("password").value};
        const response=await this.request("login.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":token.csrf_token},body:JSON.stringify(credentials)});
        form.elements.namedItem("password").value="";
        this.user=response.user;
        this.csrf=response.csrf_token;
        this.active=true;
        await this.refresh();
        this.enter();
      } catch (error) {
        message.textContent=error.status===401?"Incorrect username or password.":error.message;
        this.active=false;
      } finally {btn.disabled=false;}
    };
  },
  async init() {
    if (location.protocol==="file:") {this.demo();return;}
    try {
      const response=await fetch("backend/api/session.php",{credentials:"same-origin",cache:"no-store"});
      if (response.status===404) {this.demo();return;}
      if (response.status===401) {this.showLogin();return;}
      if (!response.ok) {
        let message="The backend is unavailable.";
        try {message=(await response.json()).error || message;} catch {}
        this.showError(message);return;
      }
      const data=await response.json();
      if (!data.authenticated||!data.user||!data.csrf_token) throw new Error("Invalid session response");
      this.user=data.user;
      this.csrf=data.csrf_token;
      this.active=true;
      await this.refresh();
      this.enter();
    } catch(error) {
      this.showError(error.message||"Cannot connect to the backend");
    }
  },
  async refresh() {
    const results=await Promise.allSettled([this.request("zones.php"),this.request("branches.php")]);
    const unwrap=(result,key)=>{
      if (result.status==="fulfilled") return result.value[key]||[];
      if (result.reason.status===403) return [];
      throw result.reason;
    };
    this.zones=unwrap(results[0],"zones").map(z=>({id:Number(z.id),code:z.code,name:z.name}));
    state.branches=unwrap(results[1],"branches").map(b=>({
      id:Number(b.id),code:b.code,name:b.name,
      zone_id:Number(b.zone_id),zone:b.zone_name,
      location:b.location||"",admin:b.admin_name||"Not assigned",
      status:b.status==="active"?"Active":b.status==="inactive"?"Inactive":"Pending setup"
    }));
    state.activity=[];
  },
  enter() {
    Students.reset();Attendance.reset();PersonnelAttendance.reset();Reports.reset();Approvals.reset();Finance.reset();
    document.querySelector("#authScreen")?.remove();
    document.documentElement.classList.remove("app-loading","auth-required");
    const display=this.user.display_name||this.user.username;
    document.querySelector(".environment").textContent="● AUTHENTICATED · SERVER DATA";
    document.querySelector(".tenant .pill").textContent="LIVE";
    document.querySelector(".brand small").textContent="Central Database · "+this.user.role.replaceAll("_"," ");
    document.querySelector(".side-bottom strong").textContent=display;
    document.querySelector(".side-bottom small").textContent=this.user.role.replaceAll("_"," ");
    document.querySelector(".top-avatar").textContent=display.slice(0,2).toUpperCase();
    document.querySelector("footer").textContent="LEARN Afghan Central Database · Authenticated development environment · Production approval pending";
    const btn=document.querySelector("#logout");
    btn.hidden=false; btn.onclick=()=>this.logout();
    current=Finance.member()?"finance":"overview";render();if(current==="finance")Finance.load();
  },
  async logout() {
    try {
      await this.request("logout.php",{method:"POST",headers:{"X-CSRF-Token":this.csrf}});
      this.user=null;this.csrf=null;this.zones=[];this.active=false;
      state=structuredClone(defaults);
      document.querySelector("#logout").hidden=true;
      this.showLogin();
    } catch(error) {toast("Sign-out failed: "+error.message);}
  },

  async loadPage(page) {
    if (!this.active || this.user.role!=="super_admin" || !["users","audit"].includes(page)) return;
    this.pageLoading=true;this.pageError="";render();
    try {
      const response=await this.request(page+".php");
      if (page==="users") this.users=response.users||[];
      else this.events=response.events||[];
    } catch(error) {this.pageError=error.message;}
    this.pageLoading=false;
    if (current===page) render();
  },
  usersView() {
    if (this.user.role!=="super_admin")return heading("Users & Permissions","Your role does not permit reading the user directory.")+'<div class="note">Access restricted.</div>';
    const caption='<p class="muted">Read-only account directory · first 200 accounts. Passwords and password hashes are never returned.</p>';
    if (this.pageLoading)return heading("Users & Permissions","Authorized server records")+panel("Accounts",'<div class="empty">Loading accounts…</div>');
    if (this.pageError)return heading("Users & Permissions","Authorized server records")+'<div class="note">'+escapeHtml(this.pageError)+'</div>';
    const rows=this.users.map(u=>'<tr><td>'+escapeHtml(u.display_name)+'</td><td>'+escapeHtml(u.username)+'</td><td>'+escapeHtml(u.role.replaceAll("_"," "))+'</td><td>'+escapeHtml(u.zone_name||"—")+'</td><td>'+escapeHtml(u.branch_name||"—")+'</td><td>'+escapeHtml(u.department_name||"—")+'</td><td>'+statusBadge(Number(u.active)===1?"Active":"Inactive")+'</td></tr>').join("");
    return heading("Users & Permissions","Authorized server records")+panel("Account directory",caption+(rows?'<div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Zone</th><th>Branch</th><th>Department</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">No accounts are configured.</div>'));
  },
  auditView() {
    if (this.user.role!=="super_admin")return heading("Audit History","Your role does not permit reading the audit history.")+'<div class="note">Access restricted.</div>';
    if (this.pageLoading)return heading("Audit History","Recent server-side actions")+panel("Recent events",'<div class="empty">Loading audit events…</div>');
    if (this.pageError)return heading("Audit History","Recent server-side actions")+'<div class="note">'+escapeHtml(this.pageError)+'</div>';
    const rows=this.events.map(a=>'<tr><td>'+escapeHtml(a.created_at)+'</td><td>'+escapeHtml(a.actor||"System")+'</td><td>'+escapeHtml(a.action)+'</td><td>'+escapeHtml(a.entity_type)+'</td><td>'+escapeHtml(a.entity_id||"—")+'</td></tr>').join("");
    return heading("Audit History","Last 100 server-side events. Login-attempt logs are stored separately. Change details are intentionally excluded from this UI.")
      +panel("Audit event history",rows?'<div class="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Record ID</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">No audit events have been written yet.</div>');
  },
  reportsView() {
    const rows=state.branches;
    const count=status=>rows.filter(b=>b.status===status).length;
    const summaries=this.zones.map(zone=>{
      const branches=rows.filter(b=>b.zone_id===zone.id);
      return '<tr><td>'+escapeHtml(zone.code)+'</td><td>'+escapeHtml(zone.name)+'</td><td>'+branches.length+'</td><td>'+branches.filter(b=>b.status==="Active").length+'</td><td>'+branches.filter(b=>b.status==="Inactive").length+'</td><td>'+branches.filter(b=>b.status==="Pending setup").length+'</td></tr>';
    }).join("");
    return heading("Reports & Export","Branch report from the records loaded for your signed-in account. Reload the page to retrieve newer changes.")
      +'<div class="metrics">'+metric("Accessible branches",rows.length,"▦","Authorized records")
      +metric("Active",count("Active"),"●","Database status")
      +metric("Inactive",count("Inactive"),"○","Database status")
      +metric("Pending setup",count("Pending setup"),"◷","Database status")+'</div>'
      +panel("Branches by zone",summaries?'<div class="table-wrap"><table><thead><tr><th>Code</th><th>Zone</th><th>Total</th><th>Active</th><th>Inactive</th><th>Pending</th></tr></thead><tbody>'+summaries+'</tbody></table></div>':'<div class="empty">No authorized zones are available.</div>')
      +panel("Export branch records",'<p>Download all '+rows.length+' accessible branch records as CSV. For a filtered export, open Branches and apply search or zone filters.</p><div class="toolbar"><button class="primary-btn" id="exportBranches">Download authorized branch CSV</button><button class="ghost-btn" data-go="branches">Filter in Branches</button></div><p class="muted">CSV includes code, branch, zone, admin and status. Excel workbook and PDF exports are not implemented.</p>');
  },
  overview() {
    const rows=state.branches;
    const assigned=rows.filter(x=>x.admin!=="Not assigned").length;
    const active=rows.filter(x=>x.status==="Active").length;
    const label=escapeHtml(this.user.display_name||this.user.username);
    return heading("Overview","Live data scoped to your authenticated role: "+escapeHtml(this.user.role.replaceAll("_"," ")))
      +'<div class="metrics">'+metric("Accessible zones",this.zones.length,"◎","Authorized scope")
      +metric("Accessible branches",rows.length,"▦","From database")
      +metric("Active branches",active,"●","Verified records")
      +metric("Assigned branch admins",assigned,"♙","Active accounts")+'</div>'
      +panel("Branch directory",rows.length?branchesTable(rows.slice(0,8)):'<div class="empty">No authorized branches are available. Ask an administrator to confirm zones and branch records.</div>','<button class="link-btn" data-go="branches">View branches →</button>')
      +'<div class="note">Signed in as '+label+'. Teacher, staff and student directories are available in the sidebar. Financial, safeguarding, approval and backup modules are NOT live yet. Do not enter sensitive records until security testing and organizational approval are complete.</div>';
  },
  zonesView() {
    return heading("Zones","Only zones authorized for your account are shown.",this.user.role==="super_admin"?'<button class="primary-btn" id="addZone">+ Add approved zone</button>':"")
      +panel("Database zones",this.zones.length?'<div class="zones">'+this.zones.map(z=>
        '<div class="zone"><div class="zone-title">'+escapeHtml(z.name)+'</div><small>'+escapeHtml(z.code)+'</small><div class="zone-stat">'+state.branches.filter(b=>b.zone_id===z.id).length+' branches</div></div>').join("")+'</div>':
        '<div class="empty">No zones assigned or entered in the database.</div>');
  },

  openCreateModal(kind) {
    if (!this.active||this.user.role!=="super_admin") {toast("Only super administrators can create records.");return;}
    if (kind==="branch" && !this.zones.length) {toast("Create an approved zone first.");return;}
    if (!["zone","branch"].includes(kind))return;
    const branch=kind==="branch",layer=document.createElement("div");
    layer.className="modal-overlay";
    const inputs=branch?'<label>Zone<select id="createZoneId" class="field">'+this.zones.map(z=>'<option value="'+z.id+'">'+escapeHtml(z.name)+'</option>').join("")+'</select></label><label>Location (optional)<input id="createLocation" class="field" maxlength="250"></label>':"";
    layer.innerHTML='<form class="modal" id="createRecord"><h2>Create approved '+kind+'</h2><p class="muted">Only enter official organization-approved information. Creation will be recorded in server audit history.</p><div class="form-grid"><label>Code<input class="field" id="createCode" pattern="[a-zA-Z0-9_-]{2,30}" maxlength="30" required placeholder="'+(branch?"BR_01":"ZONE_01")+'"></label><label>Name<input class="field" id="createName" maxlength="'+(branch?180:150)+'" required></label>'+inputs+'</div><p class="auth-error" id="createError" role="alert"></p><div class="modal-actions"><button type="button" id="cancelCreate" class="ghost-btn">Cancel</button><button class="primary-btn" id="confirmCreate" type="submit">Create '+kind+'</button></div></form>';
    document.body.append(layer);
    const get=id=>layer.querySelector("#"+id);
    get("cancelCreate").onclick=()=>layer.remove();
    layer.onclick=e=>{if(e.target===layer)layer.remove();};
    get("createRecord").onsubmit=async e=>{
      e.preventDefault();
      const button=get("confirmCreate");button.disabled=true;get("createError").textContent="";
      const body={code:get("createCode").value.trim(),name:get("createName").value.trim()};
      if (branch) {body.zone_id=Number(get("createZoneId").value);body.location=get("createLocation").value.trim()||null;}
      try {
        await this.request(kind+"_create.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":this.csrf},body:JSON.stringify(body)});
        await this.refresh();
        layer.remove();render();toast("Approved "+kind+" created and audit logged");
      } catch(error) {get("createError").textContent=error.message;button.disabled=false;}
    };
  },
  openBranchModal() {
    if (this.user.role!=="super_admin") {toast("Only super administrators can edit branch records.");return;}
    if (!state.branches.length) {toast("There are no branches to edit. First import approved organizational data.");return;}
    const layer=document.createElement("div");
    layer.className="modal-overlay";
    layer.innerHTML='<form class="modal" id="liveBranchForm"><h2>Edit database branch</h2><p class="muted">Authorized changes are saved on the server and recorded in the audit history.</p><div class="form-grid"><label>Branch<select class="field" id="liveEditId">'+state.branches.map(b=>'<option value="'+b.id+'">'+escapeHtml(b.code+" — "+b.name)+'</option>').join("")+'</select></label><label>Zone<select class="field" id="liveEditZone">'+this.zones.map(z=>'<option value="'+z.id+'">'+escapeHtml(z.name)+'</option>').join("")+'</select></label><label>Branch name<input class="field" id="liveEditName" maxlength="180" required></label><label>Location (optional)<input class="field" id="liveEditLocation" maxlength="250"></label><label>Status<select class="field" id="liveEditStatus"><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><p class="auth-error" role="alert" id="editError"></p><div class="modal-actions"><button type="button" class="ghost-btn" id="liveCancel">Cancel</button><button type="submit" class="primary-btn" id="liveSave">Save to database</button></div></form>';
    document.body.append(layer);
    const get=id=>layer.querySelector("#"+id);
    const fill=()=>{
      const b=state.branches.find(x=>x.id===Number(get("liveEditId").value));
      get("liveEditName").value=b.name;
      get("liveEditLocation").value=b.location;
      get("liveEditZone").value=String(b.zone_id);
      get("liveEditStatus").value=b.status==="Active"?"active":b.status==="Inactive"?"inactive":"pending";
    };
    get("liveEditId").onchange=fill;fill();
    get("liveCancel").onclick=()=>layer.remove();
    layer.onclick=e=>{if(e.target===layer)layer.remove();};
    get("liveBranchForm").onsubmit=async e=>{
      e.preventDefault();get("editError").textContent="";
      const btn=get("liveSave");btn.disabled=true;
      try {
        const body={id:Number(get("liveEditId").value),zone_id:Number(get("liveEditZone").value),name:get("liveEditName").value.trim(),location:get("liveEditLocation").value.trim()||null,status:get("liveEditStatus").value};
        await this.request("branch_update.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":this.csrf},body:JSON.stringify(body)});
        await this.refresh();
        layer.remove();render();toast("Branch saved to database (audit logged)");
      } catch(error) {get("editError").textContent=error.message;btn.disabled=false;}
    };
  }
};

