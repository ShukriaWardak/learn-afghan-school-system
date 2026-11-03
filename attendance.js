"use strict";
// Connected student attendance screen. Never stores private records in localStorage.
const Attendance = {
  records: [], students: [], date: (() => {
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  })(),
  error:"", loading:false, sequence:0, dialog:null,
  canRead() {return Live.active && ["super_admin","zone_admin","branch_admin"].includes(Live.user?.role);},
  canWrite() {return Live.active && Live.user?.role==="super_admin";},
  reset() {
    ++this.sequence;this.records=[];this.students=[];this.error="";this.loading=false;
    this.dialog?.close();this.dialog=null;
  },
  async load() {
    const sequence=++this.sequence, userId=Live.user?.id, csrf=Live.csrf;
    const currentSession=()=>sequence===this.sequence && Live.active && Live.user?.id===userId && Live.csrf===csrf;
    this.records=[];this.students=[];this.error="";this.loading=true;
    if(!this.canRead()){this.loading=false;render();return;}
    render();
    try {
      const requests=[Live.request("attendance.php?date="+encodeURIComponent(this.date))];
      if(this.canWrite())requests.push(Live.request("students.php"));
      const [attendance,students]=await Promise.all(requests);
      if(!currentSession())return;
      if(!Array.isArray(attendance.attendance) || (students && !Array.isArray(students.students)))throw new Error("Unexpected attendance response");
      this.records=attendance.attendance;
      this.students=students?.students || [];
    } catch(error) {
      if(!currentSession())return;
      if(error.status===401){Live.showLogin();return;}
      this.error=error.message;
    } finally {
      if(currentSession()){this.loading=false;if(current==="attendance")render();}
    }
  },
  view() {
    if(!this.canRead())return heading("Student Attendance","Your role cannot access attendance records.");
    const refresh='<button id="attendanceRefresh" class="ghost-btn">Refresh attendance</button>';
    if(this.loading)return heading("Student Attendance","Loading authorized records…")+'<p role="status">Please wait…</p>';
    if(this.error)return heading("Student Attendance","Could not load attendance.",refresh)+'<div class="note" role="alert">'+escapeHtml(this.error)+'</div>';
    const counts={present:0,absent:0,late:0,excused:0};
    this.records.forEach(row=>{if(Object.prototype.hasOwnProperty.call(counts,row.status))counts[row.status]++;});
    const actions='<div class="toolbar">'+(this.canWrite()?'<button id="attendanceAdd" class="primary-btn">+ Record attendance</button>':"")+refresh+'</div>';
    const rows=this.records.map(row=>'<tr>'
      +[row.student_code,row.full_name,row.branch_name,row.grade_level,row.attendance_date,row.status].map(val=>'<td>'+escapeHtml(val)+'</td>').join("")
      +(this.canWrite()?'<td><button class="ghost-btn" data-attendance-edit="'+Number(row.id)+'">Edit</button></td>':"")+'</tr>').join("");
    return heading("Student Attendance","Daily records for students in your authorized scope. Super administrators can record or correct entries.",actions)
      +'<div class="toolbar"><label>Attendance date <input id="attendanceDate" type="date" class="field" value="'+escapeHtml(this.date)+'" required></label></div>'
      +'<div class="metrics">'+metric("Recorded",this.records.length,"▤","Selected day")
      +metric("Present",counts.present,"✓","Recorded entries")
      +metric("Absent",counts.absent,"○","Recorded entries")
      +metric("Late / excused",counts.late+counts.excused,"◷","Recorded entries")+'</div>'
      +panel("Daily attendance",'<p id="attendanceCount" role="status">'+this.records.length+' records for '+escapeHtml(this.date)+'</p>'
      +(rows?'<div class="table-wrap"><table><thead><tr><th>Student code</th><th>Full name</th><th>Branch</th><th>Grade</th><th>Date</th><th>Status</th>'+(this.canWrite()?'<th>Action</th>':"")+'</tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">No attendance recorded for this date.</div>')
      +'<p class="muted">Only recorded entries are displayed; a missing entry does not mean absence. Up to 1,000 records per date are loaded.</p>');
  },
  bind() {
    const date=document.querySelector("#attendanceDate");
    if(date)date.onchange=event=>{
      const next=event.target.value;
      if(/^\d{4}-\d{2}-\d{2}$/.test(next)){this.date=next;this.load();}
    };
    const refresh=document.querySelector("#attendanceRefresh");
    if(refresh)refresh.onclick=()=>this.load();
    const add=document.querySelector("#attendanceAdd");
    if(add)add.onclick=()=>this.openForm();
    document.querySelectorAll("[data-attendance-edit]").forEach(button=>{
      button.onclick=()=>{
        const row=this.records.find(item=>Number(item.id)===Number(button.dataset.attendanceEdit));
        if(row)this.openForm(row);
      };
    });
  },
  openForm(row=null) {
    if(!this.canWrite() || this.dialog)return;
    if(!row && !this.students.some(student=>student.status==="active")) {
      toast("Register an active test student before recording attendance.");return;
    }
    const sessionId=Live.user.id, csrf=Live.csrf, sequence=this.sequence;
    const dialog=document.createElement("dialog");
    dialog.className="modal";dialog.setAttribute("aria-labelledby","attendanceFormTitle");
    const selected=row?Number(row.student_id):null;
    const choices=this.students.filter(s=>s.status==="active").map(s=>'<option value="'+Number(s.id)+'"'+(Number(s.id)===selected?' selected':'')+'>'+escapeHtml(s.student_code+" — "+s.full_name+" ("+s.branch_name+")")+'</option>').join("");
    const studentInput=row
      ?'<p>Student: <strong>'+escapeHtml(row.student_code+" — "+row.full_name)+'</strong></p>'
      :'<label>Student<select class="field" name="student_id" required><option value="">Choose student</option>'+choices+'</select></label>';
    const opts=["present","absent","late","excused"].map(s=>'<option value="'+s+'"'+((row?.status||"present")===s?' selected':'')+'>'+s[0].toUpperCase()+s.slice(1)+'</option>').join("");
    dialog.innerHTML='<form><h2 id="attendanceFormTitle">'+(row?"Correct attendance":"Record attendance")+'</h2>'
      +'<p class="muted">Date: '+escapeHtml(row?.attendance_date||this.date)+'</p>'
      +'<div class="form-grid">'+studentInput+'<label>Status<select name="status" class="field" required>'+opts+'</select></label></div>'
      +'<p id="attendanceFormError" class="auth-error" role="alert" aria-live="polite"></p>'
      +'<button type="button" id="attendanceReload" class="ghost-btn" hidden>Close and refresh latest records</button>'
      +'<div class="modal-actions"><button id="attendanceCancel" type="button" class="ghost-btn">Cancel</button>'
      +'<button class="primary-btn" type="submit">Save attendance</button></div></form>';
    this.dialog=dialog;document.body.append(dialog);
    dialog.onclose=()=>{dialog.remove();if(this.dialog===dialog)this.dialog=null;};
    const form=dialog.querySelector("form"),message=dialog.querySelector("#attendanceFormError"),reload=dialog.querySelector("#attendanceReload");
    let saving=false;
    dialog.querySelector("#attendanceCancel").onclick=()=>dialog.close();
    dialog.oncancel=e=>{if(saving)e.preventDefault();};
    reload.onclick=()=>{dialog.close();this.load();};
    dialog.showModal();
    form.onsubmit=async e=>{
      e.preventDefault();
      if(saving || !this.canWrite() || Live.user.id!==sessionId || Live.csrf!==csrf || this.sequence!==sequence)return;
      const data=new FormData(form);
      const body={student_id:row?Number(row.student_id):Number(data.get("student_id")),
        attendance_date:row?.attendance_date||this.date,status:data.get("status")};
      if(row){body.id=Number(row.id);body.version=Number(row.version);}
      const controls=[...form.querySelectorAll("select,button")];
      saving=true;message.textContent="";reload.hidden=true;controls.forEach(c=>c.disabled=true);
      const isCurrent=()=>this.canWrite()&&Live.user.id===sessionId&&Live.csrf===csrf&&this.sequence===sequence;
      try {
        await Live.request("attendance_save.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:JSON.stringify(body)});
        if(!isCurrent())return;
        dialog.close();toast("Attendance saved and audit logged");await this.load();
      } catch(error) {
        if(!isCurrent())return;
        if(error.status===401){Live.showLogin();return;}
        message.textContent=error.message;reload.hidden=![404,409].includes(error.status);
      } finally{saving=false;controls.forEach(c=>c.disabled=false);}
    };
  }
};
