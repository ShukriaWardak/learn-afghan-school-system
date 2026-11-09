"use strict";
// Pending branch activation only. No browser storage or new account permissions.
const Approvals = {
  rows:[],decisions:[],loading:false,error:"",search:"",truncated:false,limit:200,sequence:0,dialog:null,
  canRead(){return Live.active && Live.user?.role==="super_admin";},
  reset(){
    ++this.sequence;this.rows=[];this.decisions=[];this.error="";this.loading=false;
    this.search="";this.truncated=false;
    const dialog=this.dialog;this.dialog=null;
    dialog?.close();dialog?.remove();
  },
  async load(){
    const seq=++this.sequence,uid=Live.user?.id,csrf=Live.csrf;
    const currentSession=()=>seq===this.sequence && Live.active && Live.user?.id===uid && Live.csrf===csrf;
    this.rows=[];this.decisions=[];this.error="";this.loading=true;this.truncated=false;
    if(!this.canRead()){this.loading=false;render();return;}
    render();
    try{
      const data=await Live.request("approvals.php");
      if(!currentSession())return;
      if(!Array.isArray(data.approvals)||!Array.isArray(data.decisions))throw new Error("Invalid approvals response. Refresh and try again.");
      this.rows=data.approvals;this.decisions=data.decisions;
      this.limit=Number(data.limit)||200;this.truncated=Boolean(data.truncated);
    }catch(error){
      if(!currentSession())return;
      if(error.status===401){Live.showLogin();return;}
      this.error=error.message;
    }finally{
      if(currentSession()){this.loading=false;if(current==="approvals")render();}
    }
  },
  filteredRows(){
    const query=this.search.trim().toLocaleLowerCase();
    return this.rows.filter(row=>[row.code,row.name,row.zone_name,row.location].some(value=>String(value??"").toLocaleLowerCase().includes(query)));
  },
  table(){
    const rows=this.filteredRows();
    if(!rows.length)return '<div class="empty">'+(this.rows.length?'No pending branches match this search.':'No branches are waiting for review.')+'</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Code</th><th>Branch</th><th>Zone</th><th>Location</th><th>Submitted</th><th>Decision</th></tr></thead><tbody>'
      +rows.map(row=>'<tr>'+[row.code,row.name,row.zone_name,row.location||"—",row.created_at].map(v=>'<td>'+escapeHtml(v)+'</td>').join("")
        +'<td>'+(this.canRead()?'<button class="ghost-btn" data-approval-id="'+Number(row.id)+'" data-decision="approve">Approve</button> <button class="ghost-btn" data-approval-id="'+Number(row.id)+'" data-decision="reject">Reject</button>':"")+'</td></tr>').join("")+'</tbody></table></div>';
  },
  history(){
    if(!this.decisions.length)return '<div class="empty">No branch approval decisions recorded yet.</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Branch</th><th>Decision</th><th>Note</th><th>Reviewed by</th><th>Time</th></tr></thead><tbody>'
      +this.decisions.map(row=>'<tr>'+[row.branch_code+' — '+row.branch_name,row.decision==='approve'?'Approved':'Rejected',row.note||"—",row.reviewer||"—",row.created_at].map((value,index)=>'<td'+(index===2?' class="approval-note" dir="auto"':'')+'>'+escapeHtml(value)+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
  },
  view(){
    if(!this.canRead())return heading("Approvals","Your account does not have access to branch approvals.");
    const refresh='<button class="ghost-btn" id="approvalsRefresh">Refresh approvals</button>';
    if(this.loading)return heading("Approvals","Loading pending branches…")+'<p role="status">Please wait…</p>';
    if(this.error)return heading("Approvals","The approvals queue could not be loaded.",refresh)+'<div class="note" role="alert">'+escapeHtml(this.error)+'</div>';
    return heading("Approvals","Review pending branch activation. Approving sets a branch active; rejecting sets it inactive.",refresh)
      +panel("Pending branches",'<div class="toolbar"><label>Search pending branches<input class="search" type="search" id="approvalsSearch" value="'+escapeHtml(this.search)+'" placeholder="Code, branch, zone or location"></label></div>'
        +'<p id="approvalsCount" role="status" aria-live="polite">'+this.filteredRows().length+' of '+this.rows.length+' loaded pending branches</p>'
        +(this.truncated?'<div class="note" role="status">The first '+this.limit+' pending branches are shown. Refresh after decisions to load the next branches.</div>':"")
        +'<div id="approvalsTable">'+this.table()+'</div>')
      +panel("Recent branch decisions",'<p class="muted">Latest 50 decisions, including review notes. Other departmental approval workflows are still planned.</p>'+this.history());
  },
  bind(){
    const refresh=document.querySelector("#approvalsRefresh");if(refresh)refresh.onclick=()=>this.load();
    const search=document.querySelector("#approvalsSearch");if(search)search.oninput=event=>{this.search=event.target.value;this.updateTable();};
    document.querySelectorAll("[data-approval-id]").forEach(button=>button.onclick=()=>{
      const row=this.rows.find(item=>Number(item.id)===Number(button.dataset.approvalId));
      if(row)this.openReview(row,button.dataset.decision);
    });
  },
  updateTable(){
    document.querySelector("#approvalsTable").innerHTML=this.table();
    document.querySelector("#approvalsCount").textContent=this.filteredRows().length+' of '+this.rows.length+' loaded pending branches';
    this.bind();
  },
  openReview(row,decision){
    if(!this.canRead()||this.dialog||!["approve","reject"].includes(decision))return;
    const uid=Live.user.id,csrf=Live.csrf,seq=this.sequence;
    const dialog=document.createElement("dialog");dialog.className="modal";dialog.setAttribute("aria-labelledby","approvalDialogTitle");
    const rejecting=decision==="reject",label=rejecting?'rejection':'approval';
    dialog.innerHTML='<form><h2 id="approvalDialogTitle">'+(rejecting?'Reject':'Approve')+' branch</h2>'
      +'<p><strong>'+escapeHtml(row.code)+' — '+escapeHtml(row.name)+'</strong></p>'
      +'<p>Zone: '+escapeHtml(row.zone_name)+'<br>Location: '+escapeHtml(row.location||"—")+'</p>'
      +'<label>Review note'+(rejecting?' (required)':' (optional)')+'<textarea class="field" name="note" rows="4" maxlength="500" dir="auto" '+(rejecting?'required':'')+'></textarea></label>'
      +'<p class="auth-error" id="approvalError" role="alert" aria-live="polite"></p>'
      +'<button type="button" class="ghost-btn" id="approvalReload" hidden>Close and refresh latest branches</button>'
      +'<div class="modal-actions"><button type="button" class="ghost-btn" id="approvalCancel">Cancel</button><button type="submit" class="primary-btn">Confirm '+label+'</button></div></form>';
    this.dialog=dialog;document.body.append(dialog);
    dialog.onclose=()=>{dialog.remove();if(this.dialog===dialog)this.dialog=null;};
    const form=dialog.querySelector("form"),errorBox=dialog.querySelector("#approvalError"),reload=dialog.querySelector("#approvalReload");
    let saving=false,conflict=false;
    dialog.querySelector("#approvalCancel").onclick=()=>dialog.close();
    dialog.oncancel=event=>{if(saving)event.preventDefault();};
    reload.onclick=()=>{dialog.close();this.load();};
    dialog.showModal();
    form.onsubmit=async event=>{
      event.preventDefault();
      const sessionIsCurrent=()=>this.canRead() && Live.user.id===uid && Live.csrf===csrf && this.sequence===seq;
      if(saving||conflict||!sessionIsCurrent())return;
      const note=form.elements.namedItem("note").value.trim();
      const controls=[...form.querySelectorAll("textarea,button")];
      saving=true;errorBox.textContent="";reload.hidden=true;controls.forEach(control=>control.disabled=true);
      try{
        const response=await Live.request("approval_decide.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:JSON.stringify({branch_id:Number(row.id),decision,review_version:row.review_version,note})});
        if(!sessionIsCurrent())return;
        const branch=state.branches.find(item=>Number(item.id)===Number(row.id));
        if(branch)Object.assign(branch,{name:row.name,zone_id:Number(row.zone_id),zone:row.zone_name,location:row.location||"",status:response.status==="active"?'Active':'Inactive'});
        dialog.close();toast(rejecting?'Branch rejected and audit logged':'Branch approved and audit logged');
        await this.load();
      }catch(error){
        if(!sessionIsCurrent())return;
        if(error.status===401){Live.showLogin();return;}
        conflict=[404,409].includes(error.status);errorBox.textContent=error.message;reload.hidden=!conflict;
      }finally{
        saving=false;controls.forEach(control=>control.disabled=false);
        if(conflict)form.querySelector('[type="submit"]').disabled=true;
      }
    };
  }
};
