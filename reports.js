"use strict";
// Aggregate-only school reporting. The server controls scope and exports; no PII is cached.
const Reports = {
  data:null,error:"",loading:false,downloading:false,sequence:0,
  date:(()=>{
    const now=new Date();
    return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
  })(),
  canRead() {return Live.active && ["super_admin","zone_admin","branch_admin"].includes(Live.user?.role);},
  reset() {++this.sequence;this.data=null;this.error="";this.loading=false;this.downloading=false;},
  async load() {
    const seq=++this.sequence,id=Live.user?.id,csrf=Live.csrf;
    const currentSession=()=>seq===this.sequence && Live.active && Live.user?.id===id && Live.csrf===csrf;
    this.data=null;this.error="";this.loading=true;
    if (!this.canRead()) {this.loading=false;render();return;}
    render();
    try {
      const data=await Live.request("reports_summary.php?date="+encodeURIComponent(this.date));
      if(!currentSession())return;
      if(!data?.totals || !Array.isArray(data.branches) || !data.attendance)throw new Error("Invalid report response");
      this.data=data;
    } catch(error) {
      if(!currentSession())return;
      if(error.status===401){Live.showLogin();return;}
      this.error=error.message;
    } finally {
      if(currentSession()) {this.loading=false;if(current==="reports")render();}
    }
  },
  view() {
    if(!this.canRead())return heading("Reports & Export","Your account does not have access to school reporting.");
    const refresh='<button class="ghost-btn" id="reportRefresh">Refresh report</button>';
    const date='<label>Report date <input class="field" id="reportDate" type="date" required value="'+escapeHtml(this.date)+'"></label>';
    if(this.loading)return heading("Reports & Export","Loading counts from your authorized branches…")+'<p role="status">Please wait…</p>';
    if(this.error)return heading("Reports & Export","Could not load the school report.",refresh)+'<div class="note" role="alert">'+escapeHtml(this.error)+'</div>';
    if(!this.data)return heading("Reports & Export","Select a date to view available data.",refresh);
    const d=this.data;
    const attendanceTypes=[
      ["Students",d.attendance.students],["Teachers",d.attendance.teachers],["Staff",d.attendance.staff]
    ];
    const attendanceRows=attendanceTypes.map(([label,values])=>'<tr>'
      +[label,values.present,values.absent,values.late,values.excused]
        .map(value=>'<td>'+escapeHtml(value)+'</td>').join("")+'</tr>').join("");
    const branches=d.branches.map(b=>'<tr>'
      +[b.zone_name,b.code,b.name,b.status,b.students,b.teachers,b.staff,b.student_attendance,b.personnel_attendance]
        .map(value=>'<td>'+escapeHtml(value)+'</td>').join("")+'</tr>').join("");
    const truncated=d.branches_truncated?'<div class="note" role="status">Only the first '+d.branch_limit+' branches are shown. Export is disabled until a complete report is available.</div>':"";
    return heading("Reports & Export","Read-only aggregate counts from MySQL within your authorized zone/branch scope.")
      +'<div class="toolbar">'+date+refresh+'<button class="primary-btn" id="reportDownload"'
      +(d.branches_truncated?' disabled title="Report exceeds export limit"':'')
      +'>Download branch summary CSV</button></div>'
      +'<div class="metrics">'+metric("Branches",d.totals.branches,"▦","Authorized scope")
      +metric("Students",d.totals.students,"♧","Registered")
      +metric("Teachers",d.totals.teachers,"♙","Personnel registry")
      +metric("Staff",d.totals.staff,"◫","Personnel registry")+'</div>'
      +panel("Student status",'<div class="metrics">'
        +metric("Active",d.student_status.active,"●","Students")
        +metric("Inactive",d.student_status.inactive,"○","Students")
        +metric("Graduated",d.student_status.graduated,"✓","Students")+'</div>')
      +panel("Recorded attendance — "+escapeHtml(d.date),
        '<div class="table-wrap"><table><thead><tr><th>Group</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th></tr></thead><tbody>'+attendanceRows+'</tbody></table></div>'
        +'<p class="muted">These are counts of recorded entries only; missing records are not absences or present days.</p>')
      +panel("Branch summary",'<p id="reportCount" role="status">'+d.branches.length+' of '+d.totals.branches+' accessible branches listed</p>'
        +truncated
        +(branches?'<div class="table-wrap"><table><thead><tr><th>Zone</th><th>Code</th><th>Branch</th><th>Status</th><th>Students</th><th>Teachers</th><th>Staff</th><th>Student attendance</th><th>Personnel attendance</th></tr></thead><tbody>'+branches+'</tbody></table></div>'
          :'<div class="empty">No branches available to this account.</div>')
        +'<p class="muted">CSV exports contain only branch-level aggregates, not individual student or employee records. Data is intended for review, not official reporting.</p>');
  },
  bind() {
    const date=document.querySelector("#reportDate");
    if(date)date.onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){this.date=e.target.value;this.load();}};
    const refresh=document.querySelector("#reportRefresh");
    if(refresh)refresh.onclick=()=>this.load();
    const download=document.querySelector("#reportDownload");
    if(download)download.onclick=()=>this.download();
  },
  async download() {
    if(!this.canRead()||!this.data||this.data.branches_truncated||this.downloading)return;
    const seq=this.sequence,uid=Live.user.id,csrf=Live.csrf;
    const button=document.querySelector("#reportDownload");
    this.downloading=true;if(button)button.disabled=true;
    try {
      const response=await fetch("backend/api/reports_export.php?date="+encodeURIComponent(this.date),{
        method:"GET",credentials:"same-origin",cache:"no-store",headers:{"Accept":"text/csv"}
      });
      if(!response.ok) {
        let body={};try{body=await response.json();}catch{}
        const error=new Error(body.error||"Report download failed ("+response.status+")");error.status=response.status;throw error;
      }
      const blob=await response.blob();
      if(seq!==this.sequence||!Live.active||Live.user?.id!==uid||Live.csrf!==csrf)return;
      const url=URL.createObjectURL(blob);
      try {
        const a=document.createElement("a");
        a.href=url;a.download="learn-afghan-branch-summary-"+this.date+".csv";
        a.click();toast("Authorized aggregate CSV downloaded");
      }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
    }catch(error){
      if(error.status===401){Live.showLogin();return;}
      if(seq===this.sequence&&Live.active)toast(error.message);
    }finally{
      this.downloading=false;
      if(button&&button.isConnected&&seq===this.sequence)button.disabled=false;
    }
  }
};
