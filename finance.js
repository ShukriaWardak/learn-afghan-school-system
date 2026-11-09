"use strict";
// Sample AFN cashbook. Authorization and money calculations belong to PHP/MySQL.
const Finance = {
  data:null,error:"",loading:false,sequence:0,dialog:null,
  filters:{from:"",to:"",type:"all",branch:"all",search:""},
  member(){return Live.active && Live.user?.role==="department_user" && String(Live.user?.department_code||"").toUpperCase()==="FINANCE";},
  canRead(){return Live.active && (Live.user?.role==="super_admin" || this.member());},
  canWrite(){return this.member() && this.data?.permissions?.can_add===true && this.data?.permissions?.can_edit===true;},
  reset(){
    ++this.sequence;this.data=null;this.error="";this.loading=false;
    this.filters={from:"",to:"",type:"all",branch:"all",search:""};this.closeDialog();
  },
  closeDialog(){
    const dialog=this.dialog;this.dialog=null;dialog?.close();dialog?.remove();
  },
  money(value){
    const match=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
    return match?match[1]+match[2].replace(/\B(?=(\d{3})+(?!\d))/g,",")+"."+(match[3]||"").padEnd(2,"0")+" AFN":"—";
  },
  today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");},
  async load(page=1){
    const seq=++this.sequence,uid=Live.user?.id,csrf=Live.csrf;
    const session=()=>seq===this.sequence && Live.active && Live.user?.id===uid && Live.csrf===csrf;
    this.closeDialog();this.data=null;this.error="";this.loading=true;
    if(!this.canRead()){this.loading=false;render();return;}
    render();
    try{
      const query=new URLSearchParams({...this.filters,page:String(page)});
      const data=await Live.request("finance.php?"+query);
      if(!session())return;
      if(!Array.isArray(data.entries)||!Array.isArray(data.branches)||!data.categories?.income||!data.categories?.expense||!data.payment_methods||!data.totals||data.currency!=="AFN")
        throw new Error("Invalid finance response. Refresh and try again.");
      this.data=data;
    }catch(error){
      if(!session())return;
      if(error.status===401){Live.showLogin();return;}
      this.error=error.message;
    }finally{if(session()){this.loading=false;if(current==="finance")render();}}
  },
  table(){
    if(!this.data.entries.length)return '<div class="empty">No finance records match these filters. Add an income or expense to begin.</div>';
    const categories={...this.data.categories.income,...this.data.categories.expense};
    return '<div class="table-wrap"><table id="financeTable"><thead><tr><th>Reference / date</th><th>Type / category</th><th>Payer or payee</th><th>Office / branch</th><th>Amount</th><th>Description / receipt</th><th>Last edited by</th>'+(this.canWrite()?'<th>Action</th>':'')+'</tr></thead><tbody>'
      +this.data.entries.map(row=>'<tr><td><b>FN-'+Number(row.id)+'</b><br>'+escapeHtml(row.entry_date)+'</td><td>'+escapeHtml(row.entry_type==='income'?'Income':'Expense')+'<br><small>'+escapeHtml(categories[row.category]||row.category)+'</small></td>'
        +'<td dir="auto">'+escapeHtml(row.counterparty)+'</td><td>'+escapeHtml(row.branch_name||"Central office")+'</td><td class="finance-money">'+this.money(row.amount)+'</td>'
        +'<td class="finance-note" dir="auto">'+escapeHtml(row.description)+(row.receipt_reference?'<br><small>Receipt: '+escapeHtml(row.receipt_reference)+'</small>':'')+(row.notes?'<details><summary>Notes</summary><div>'+escapeHtml(row.notes)+'</div></details>':'')+'</td>'
        +'<td>'+escapeHtml(row.updated_by_name||"Former account")+'<br><small>'+escapeHtml(row.updated_at)+'</small><br><small>Created by '+escapeHtml(row.created_by_name||"Former account")+'</small></td>'
        +(this.canWrite()?'<td><button class="ghost-btn" data-finance-edit="'+Number(row.id)+'">Edit</button></td>':'')+'</tr>').join("")+'</tbody></table></div>';
  },
  view(){return '<div class="finance-page">'+this.content()+'</div>';},
  content(){
    if(!this.canRead())return heading("Finance & Accounting","Your account does not have access to finance records.");
    const refresh='<button class="ghost-btn" id="financeRefresh">Refresh finance</button>';
    if(this.loading)return heading("Finance & Accounting","Loading the AFN cashbook…")+'<p role="status">Please wait…</p>';
    if(this.error)return heading("Finance & Accounting","Finance could not be loaded.",refresh)+'<div class="note" role="alert">'+escapeHtml(this.error)+'</div>';
    if(!this.data)return heading("Finance & Accounting","Sample income and expense register in Afghanis.",refresh);
    const d=this.data,filter=this.filters;
    const controls='<form id="financeFilters" class="toolbar"><label>From<input class="field" name="from" type="date" min="2000-01-01" max="2099-12-31" value="'+escapeHtml(filter.from)+'"></label>'
      +'<label>To<input class="field" name="to" type="date" min="2000-01-01" max="2099-12-31" value="'+escapeHtml(filter.to)+'"></label>'
      +'<label>Type<select class="field" name="type">'+[['all','All types'],['income','Income'],['expense','Expense']].map(([value,label])=>'<option value="'+value+'" '+(filter.type===value?'selected':'')+'>'+label+'</option>').join("")+'</select></label>'
      +'<label>Office / branch<select class="field" name="branch"><option value="all">All assigned offices</option>'+(d.permissions.can_use_central_office?'<option value="central" '+(filter.branch==='central'?'selected':'')+'>Central office</option>':'')+d.branches.map(branch=>'<option value="'+Number(branch.id)+'" '+(filter.branch===String(branch.id)?'selected':'')+'>'+escapeHtml(branch.code+' — '+branch.name)+'</option>').join('')+'</select></label>'
      +'<label>Search<input class="field" name="search" type="search" maxlength="100" value="'+escapeHtml(filter.search)+'" placeholder="Payer, description or receipt"></label><button class="ghost-btn" type="submit">Apply filters</button><button class="ghost-btn" type="button" id="financeClear">Clear filters</button></form>';
    return heading("Finance & Accounting","Sample form for review · Currency: Afghani (AFN).",'<div class="toolbar">'+(this.canWrite()?'<button class="primary-btn" id="financeAdd">+ Add income / expense</button>':'')+refresh+'</div>')
      +'<div class="note">'+(this.canWrite()?'Finance members can add and edit. Every change records the editor and correction reason.':this.member()?'No offices are available for your Finance assignment. Ask your administrator to review the assignment.':'Super administrator access: read only. Finance members add and edit records.')+' Active finance accounts: '+Number(d.active_team_members)+'. Planned team: 5.</div>'
      +'<div class="metrics finance-metrics">'+metric("Recorded income",this.money(d.totals.income),"↗","Matching filters")+metric("Recorded expenses",this.money(d.totals.expense),"↘","Matching filters")+metric("Income minus expenses",this.money(d.totals.net),"↔","Matching filters · opening balances excluded")+'</div>'
      +panel("Income and expense records",controls+'<p id="financeCount" role="status">'+d.total+' matching records · Page '+d.page+' of '+d.pages+'</p>'+this.table()
        +'<div class="toolbar finance-pagination"><button class="ghost-btn" id="financePrevious" '+(d.page<=1?'disabled':'')+'>Previous</button><button class="ghost-btn" id="financeNext" '+(d.page>=d.pages?'disabled':'')+'>Next</button></div>')
      +'<p class="muted">This sample register is ready for form review. Totals show recorded entries, rather than a verified bank or cash balance. Categories and fields can be finalized with your finance team.</p>';
  },
  bind(){
    const on=(selector,handler)=>{const e=document.querySelector(selector);if(e)e.onclick=handler;};
    on("#financeRefresh",()=>this.load(this.data?.page||1));on("#financeAdd",()=>this.openForm());
    on("#financePrevious",()=>this.load(this.data.page-1));on("#financeNext",()=>this.load(this.data.page+1));
    on("#financeClear",()=>{this.filters={from:"",to:"",type:"all",branch:"all",search:""};this.load();});
    const filters=document.querySelector("#financeFilters");
    if(filters)filters.onsubmit=event=>{event.preventDefault();this.filters=Object.fromEntries(new FormData(filters));this.load();};
    document.querySelectorAll("[data-finance-edit]").forEach(button=>button.onclick=()=>{
      const row=this.data.entries.find(item=>Number(item.id)===Number(button.dataset.financeEdit));if(row)this.openForm(row);
    });
  },
  openForm(row=null){
    if(!this.canWrite()||this.dialog)return;
    const seq=this.sequence,uid=Live.user.id,csrf=Live.csrf;
    const session=()=>seq===this.sequence && this.canWrite() && Live.user.id===uid && Live.csrf===csrf;
    const requestKey=row?null:crypto.randomUUID();
    const dialog=document.createElement("dialog");dialog.className="modal finance-modal";dialog.setAttribute("aria-labelledby","financeFormTitle");
    const input=(name,label,value="",extra="")=>'<label>'+label+'<input class="field" name="'+name+'" value="'+escapeHtml(value)+'" '+extra+'></label>';
    const select=(name,label,options,value)=>'<label>'+label+'<select class="field" name="'+name+'">'+Object.entries(options).map(([key,text])=>'<option value="'+escapeHtml(key)+'" '+(String(value)===key?'selected':'')+'>'+escapeHtml(text)+'</option>').join("")+'</select></label>';
    const area=(name,label,value="",max=500,required=false)=>'<label class="finance-wide">'+label+'<textarea class="field" name="'+name+'" rows="3" maxlength="'+max+'" dir="auto" '+(required?'required':'')+'>'+escapeHtml(value)+'</textarea></label>';
    const type=row?.entry_type||"expense";
    const branches={...(this.data.permissions.can_use_central_office?{"":"Central office"}:{}),...Object.fromEntries(this.data.branches.map(b=>[String(b.id),b.code+' — '+b.name]))};
    dialog.innerHTML='<form><h2 id="financeFormTitle">'+(row?'Edit FN-'+Number(row.id):'Add income / expense')+'</h2><p class="muted">Sample finance form · Afghanis (AFN)</p><div class="form-grid">'
      +input("entry_date","Date",row?.entry_date||this.today(),'type="date" min="2000-01-01" max="2099-12-31" required')
      +select("entry_type","Transaction type",{income:"Income",expense:"Expense"},type)
      +select("category","Category",this.data.categories[type],row?.category||Object.keys(this.data.categories[type])[0])
      +input("amount","Amount (AFN)",row?.amount||"",'inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" maxlength="15" placeholder="e.g. 1250.50" required')
      +input("currency","Currency","AFN",'readonly')+select("branch_id","Office / branch",branches,row?.branch_id??"")
      +input("counterparty","Payer / payee",row?.counterparty||"",'maxlength="180" dir="auto" required')
      +select("payment_method","Payment method",this.data.payment_methods,row?.payment_method||"cash")
      +input("receipt_reference","Receipt / voucher reference (optional)",row?.receipt_reference||"",'maxlength="80" dir="auto"')
      +area("description","Description",row?.description||"",500,true)+area("notes","Additional notes (optional)",row?.notes||"")
      +(row?area("correction_reason","Reason for this edit","",250,true):"")+'</div>'
      +'<p class="auth-error" id="financeFormError" role="alert" aria-live="polite"></p><button type="button" id="financeReload" class="ghost-btn" hidden>Close and refresh records</button>'
      +'<div class="modal-actions"><button type="button" id="financeCancel" class="ghost-btn">Cancel</button><button type="submit" class="primary-btn">Save finance record</button></div></form>';
    this.dialog=dialog;document.body.append(dialog);
    dialog.onclose=()=>{dialog.remove();if(this.dialog===dialog)this.dialog=null;};
    const form=dialog.querySelector("form"),errorBox=dialog.querySelector("#financeFormError"),reload=dialog.querySelector("#financeReload");
    let saving=false,conflict=false;
    form.elements.namedItem("entry_type").onchange=event=>{
      form.elements.namedItem("category").innerHTML=Object.entries(this.data.categories[event.target.value]).map(([key,label])=>'<option value="'+escapeHtml(key)+'">'+escapeHtml(label)+'</option>').join("");
    };
    dialog.querySelector("#financeCancel").onclick=()=>this.closeDialog();
    reload.onclick=()=>{this.closeDialog();this.load();};
    dialog.oncancel=event=>{if(saving)event.preventDefault();};
    dialog.showModal();
    form.onsubmit=async event=>{
      event.preventDefault();if(saving||conflict||!session())return;
      const body=Object.fromEntries(new FormData(form));
      body.branch_id=body.branch_id===""?null:Number(body.branch_id);
      if(row){body.id=Number(row.id);body.version=Number(row.version);}else body.request_key=requestKey;
      const controls=[...form.querySelectorAll("input,select,textarea,button")];
      saving=true;errorBox.textContent="";reload.hidden=true;controls.forEach(control=>control.disabled=true);
      try{
        await Live.request("finance_save.php",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf},body:JSON.stringify(body)});
        if(!session())return;
        this.closeDialog();toast("Finance record saved and audit logged");await this.load();
      }catch(error){
        if(!session())return;
        if(error.status===401){Live.showLogin();return;}
        conflict=[403,404,409].includes(error.status);errorBox.textContent=error.message;reload.hidden=!conflict;
      }finally{
        saving=false;controls.forEach(control=>control.disabled=false);
        if(conflict)form.querySelector('[type="submit"]').disabled=true;
      }
    };
  }
};
