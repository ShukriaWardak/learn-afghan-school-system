"use strict";
// Teacher/Staff attendance; only authenticated server records, never browser storage.
const PersonnelAttendance = {
  rows: [], personnel: [], page: "", date: (() => {
    const day = new Date();
    return [day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
  })(),
  loading:false, error:"", sequence:0, dialog:null,
  kind() { return this.page === "teacher_attendance" ? "teacher" : "staff"; },
  canRead() { return Live.active && ["super_admin","zone_admin","branch_admin"].includes(Live.user?.role); },
  canWrite() { return Live.active && Live.user?.role === "super_admin"; },
  reset() {
    ++this.sequence;this.rows=[];this.personnel=[];this.page="";this.loading=false;this.error="";
    this.dialog?.close();this.dialog=null;
  },
  async load(page) {
    const seq=++this.sequence, id=Live.user?.id, csrf=Live.csrf;
    const active=()=>seq===this.sequence && Live.active && Live.user?.id===id && Live.csrf===csrf;
    this.page=page;this.rows=[];this.personnel=[];this.loading=true;this.error="";
    if(!this.canRead()){this.loading=false;render();return;}
    render();
    try {
      const kind=this.kind();
      const requests=[Live.request("personnel_attendance.php?kind="+kind+"&date="+encodeURIComponent(this.date))];
      if(this.canWrite())requests.push(Live.request("personnel.php?kind="+kind));
      const [entries,personnel]=await Promise.all(requests);
      if(!active())return;
      if(!Array.isArray(entries.attendance) || (personnel && !Array.isArray(personnel.personnel)))
        throw new Error("Unexpected attendance response");
      this.rows=entries.attendance;
      this.personnel=personnel?.personnel||[];
    } catch(error) {
      if(!active())return;
      if(error.status===401){Live.showLogin();return;}
      this.error=error.message;
    } finally {
      if(active()){this.loading=false;if(current===page)render();}
    }
  },
  view(page) {
    const kind=page==="teacher_attendance"?"Teacher":"Staff";
    if(!this.canRead())return heading(kind+" Attendance","Your account cannot access personnel attendance.");
    const refresh='<button type="button" class="ghost-btn" id="personnelAttendanceRefresh">Refresh</button>';
    if(this.loading||this.page!==page)return heading(kind+" Attendance","Loading authorized records…")+'<p role="status">Please wait…</p>';
    if(this.error)return heading(kind+" Attendance","Could not load attendance.",refresh)+'<div role="alert" class="note">'+escapeHtml(this.error)+'</div>';
    const counts={present:0,absent:0,late:0,excused:0};
    for(const entry of this.rows)if(Object.prototype.hasOwnProperty.call(counts,entry.status))counts[entry.status]++;
    const actions='<div class="toolbar">'+(this.canWrite()?'<button type="button" class="primary-btn" id="personnelAttendanceAdd">+ Record attendance</button>':"")+refresh+'</div>';
    const rows=this.rows.map(entry=>'<tr>'
      +[entry.code,entry.full_name,entry.branch_name,entry.department_name,entry.attendance_date,entry.status]
        .map(v=>'<td>'+escapeHtml(v)+'</td>').join("")
      +(this.canWrite()?'<td><button type="button" class="ghost-btn" data-personnel-attendance-edit="'+Number(entry.id)+'">Edit</button></td>':"")
      +'</tr>').join("");
    return heading(kind+" Attendance","Daily "+kind.toLowerCase()+" attendance scoped to your account. Only a super administrator can create or correct entries.",actions)
      +'<div class="toolbar"><label>Date <input id="personnelAttendanceDate" class="field" type="date" required value="'+escapeHtml(this.date)+'"></label></div>'
      +'<div class="metrics">'+metric("Recorded",this.rows.length,"▤","Selected day")
      +metric("Present",counts.present,"✓","Recorded entries")
      +metric("Absent",counts.absent,"○","Recorded entries")
      +metric("Late / excused",counts.late+counts.excused,"◷","Recorded entries")+'</div>'
      +panel(kind+" daily attendance",
        '<p id="personnelAttendanceCount" role="status" aria-live="polite">'+this.rows.length+' records for '+escapeHtml(this.date)+'</p>'
        +(rows?'<div class="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Branch</th><th>Department</th><th>Date</th><th>Status</th>'+(this.canWrite()?'<th>Action</th>':"")+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
          :'<div class="empty">No attendance has been recorded for this day.</div>')
        +'<p class="muted">Missing attendance is not automatically counted as absence. Only the first 1,000 authorized records for this date are shown.</p>');
  },
  bind() {
    const date=document.querySelector("#personnelAttendanceDate");
    if(date)date.onchange=event=>{if(/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)){this.date=event.target.value;this.load(current);}};
    const refresh=document.querySelector("#personnelAttendanceRefresh");
    if(refresh)refresh.onclick=()=>this.load(current);
    const add=document.querySelector("#personnelAttendanceAdd");
    if(add)add.onclick=()=>this.openForm();
    document.querySelectorAll("[data-personnel-attendance-edit]").forEach(button=>{
      button.onclick=()=>{
        const row=this.rows.find(item=>Number(item.id)===Number(button.dataset.personnelAttendanceEdit));
        if(row)this.openForm(row);
      };
    });
  },
  openForm(row=null) {
    if(!this.canWrite()||this.dialog)return;
    const kind=this.kind();
    if(!row && !this.personnel.some(item=>item.status==="active")){
      toast("Create an active test "+kind+" before recording attendance.");return;
    }
    const id=Live.user.id,csrf=Live.csrf,seq=this.sequence,page=this.page;
    const dialog=document.createElement("dialog");
    dialog.className="modal";dialog.setAttribute("aria-labelledby","personnelAttendanceFormTitle");
    const choices=this.personnel.filter(item=>item.status==="active").map(item=>'<option value="'+Number(item.id)+'">'+escapeHtml(item.code+" — "+item.full_name+" ("+item.branch_name+")")+'</option>').join("");
    const personInput=row?'<p>Person: <strong>'+escapeHtml(row.code+" — "+row.full_name)+'</strong></p>'
      :'<label>'+ (kind==="teacher"?"Teacher":"Staff member") +'<select name="personnel_id" class="field" required><option value="">Choose a person</option>'+choices+'</select></label>';
    const choicesStatus=["present","absent","late","excused"].map(status=>'<option value="'+status+'"'+((row?.status||"present")===status?" selected":"")+'>'+status[0].toUpperCase()+status.slice(1)+'</option>').join("");
    dialog.innerHTML='<form><h2 id="personnelAttendanceFormTitle">'+(row?"Correct":"Record")+" "+kind+" attendance"+'</h2>'
      +'<p class="muted">Date: '+escapeHtml(row?.attendance_date||this.date)+'</p>'
      +'<div class="form-grid">'+personInput+'<label>Status<select name="status" class="field" required>'+choicesStatus+'</select></label></div>'
      +'<p class="auth-error" id="personnelAttendanceFormError" role="alert" aria-live="polite"></p>'
      +'<button type="button" class="ghost-btn" id="personnelAttendanceReload" hidden>Close and refresh latest records</button>'
      +'<div class="modal-actions"><button type="button" class="ghost-btn" id="personnelAttendanceCancel">Cancel</button><button type="submit" class="primary-btn">Save attendance</button></div></form>';
    this.dialog=dialog;document.body.append(dialog);
    dialog.onclose=()=>{dialog.remove();if(this.dialog===dialog)this.dialog=null;};
    const form=dialog.querySelector("form"),message=dialog.querySelector("#personnelAttendanceFormError"),reload=dialog.querySelector("#personnelAttendanceReload");
    let saving=false;
    dialog.querySelector("#personnelAttendanceCancel").onclick=()=>dialog.close();
    dialog.oncancel=e=>{if(saving)e.preventDefault();};
    reload.onclick=()=>{dialog.close();this.load(page);};
    dialog.showModal();
    form.onsubmit=async e=>{
      e.preventDefault();
      if(saving||!this.canWrite()||Live.user.id!==id||Live.csrf!==csrf||this.sequence!==seq||this.page!==page)return;
      const fields=new FormData(form);
      const payload={personnel_id:row?Number(row.personnel_id):Number(fields.get("personnel_id")),
        kind,attendance_date:row?.attendance_date||this.date,status:fields.get("status")};
      if(row){payload.id=Number(row.id);payload.version=Number(row.version);}
      const controls=[...form.querySelectorAll("select,button")];
      saving=true;message.textContent="";reload.hidden=true;controls.forEach(c=>c.disabled=true);
      const currentSession=()=>this.canWrite()&&Live.user.id===id&&Live.csrf===csrf&&this.sequence===seq&&this.page===page;
      try {
        await Live.request("personnel_attendance_save.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:JSON.stringify(payload)});
        if(!currentSession())return;
        dialog.close();toast("Attendance saved and audit logged");await this.load(page);
      } catch(error) {
        if(!currentSession())return;
        if(error.status===401){Live.showLogin();return;}
        message.textContent=error.message;reload.hidden=![404,409].includes(error.status);
      } finally {saving=false;controls.forEach(c=>c.disabled=false);}
    };
  }
};
