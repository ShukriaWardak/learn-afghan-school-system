"use strict";
/* Authenticated admin integration. The existing localStorage prototype is a separate, labelled demo. */
const Live = {
  active: false, user: null, csrf: null, zones: [],
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
    root.innerHTML=html;
  },
  showError(message) {
    this.showScreen('<section class="auth-card" role="alert"><h1>LEARN Afghan</h1><h2>Server setup required</h2><p>'+escapeHtml(message)+'</p><p>The connected database must be configured and available. No demonstration records have been loaded as live records.</p><button type="button" class="ghost-btn" id="retryServer">Retry connection</button></section>');
    document.querySelector("#retryServer").onclick=()=>this.init();
  },
  showLogin() {
    this.active=false;
    this.showScreen('<form class="auth-card" id="loginForm" autocomplete="on"><div class="auth-logo">▤</div><span class="eyebrow">LEARN AFGHAN · CENTRAL DATABASE</span><h1>Sign in</h1><p class="muted">Use your approved administrative account. Demo data is not used for authentication.</p><label for="loginUser">Username</label><input class="field" id="loginUser" name="username" autocomplete="username" maxlength="100" required><label for="loginPassword">Password</label><input class="field" id="loginPassword" type="password" name="password" autocomplete="current-password" required><p id="loginError" class="auth-error" role="alert" aria-live="polite"></p><button type="submit" class="primary-btn" id="submitLogin">Sign in securely</button><small>This system is in development. Do not use it with real confidential records until deployment is approved.</small></form>');
    document.querySelector("#loginForm").onsubmit=async e=>{
      e.preventDefault();
      const form=e.currentTarget, btn=document.querySelector("#submitLogin");
      const message=document.querySelector("#loginError");
      btn.disabled=true; message.textContent="";
      try {
        const token=await this.request("csrf.php");
        const credentials={username:form.username.value.trim(),password:form.password.value};
        const response=await this.request("login.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":token.csrf_token},body:JSON.stringify(credentials)});
        form.password.value="";
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
    current="overview";render();
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
      +'<div class="note">Signed in as '+label+'. The staff, financial, safeguarding, approval and backup modules are NOT live yet. Do not enter sensitive records until security testing and organizational approval are complete.</div>';
  },
  zonesView() {
    return heading("Zones","Only zones authorized for your account are shown.")
      +panel("Database zones",this.zones.length?'<div class="zones">'+this.zones.map(z=>
        '<div class="zone"><div class="zone-title">'+escapeHtml(z.name)+'</div><small>'+escapeHtml(z.code)+'</small><div class="zone-stat">'+state.branches.filter(b=>b.zone_id===z.id).length+' branches</div></div>').join("")+'</div>':
        '<div class="empty">No zones assigned or entered in the database.</div>');
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
