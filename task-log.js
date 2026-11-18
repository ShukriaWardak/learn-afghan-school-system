"use strict";
const TaskLog = {
 rows: [], loading: false, error: "", sequence: 0, more: false,
 reset() { this.sequence++; this.rows=[]; this.error=""; this.loading=false; this.more=false; document.querySelector("#taskModal")?.remove(); },
 async load() {
  if (!Live.active) return;
  const seq=++this.sequence, uid=Live.user.id, csrf=Live.csrf;
  const valid=()=>this.sequence===seq && Live.active && Live.user?.id===uid && Live.csrf===csrf && current==="tasks";
  this.loading=true; this.error=""; render();
  try { const data=await Live.request("tasks.php"); if(!valid())return; if(!Array.isArray(data.tasks))throw new Error('Invalid task log response'); this.rows=data.tasks; this.more=data.has_more===true; }
  catch(e) { if(!valid())return; if(e.status===401){Live.showLogin();return;} this.rows=[];this.error=e.message; }
  if(valid()){this.loading=false;render();}
 },
 view() {
  const h=escapeHtml;
  const labels={not_started:"Not Started",in_progress:"In Progress",completed:"Completed"};
  return heading("Task Log","Add and update your own tasks. Coordinators can view tasks within their assigned scope.")
   +panel("Daily tasks",'<div class="toolbar"><button class="primary-btn" id="taskAdd">+ Add task</button><button class="ghost-btn" id="taskRefresh">Refresh</button><label>Search <input class="field" id="taskSearch" type="search" placeholder="Title, person or branch"></label><label>Status <select class="field" id="taskStatus"><option value="">All statuses</option>'+Object.entries(labels).map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label></div>'
   +(this.error?'<p role="alert">'+h(this.error)+'</p>':'')
   +(this.loading?'<p role="status">Loading tasks…</p>':'')
   +(this.more?'<p>Showing the latest 500 authorized tasks. Search filters this displayed list.</p>':'')
   +'<div class="table-wrap"><table><thead><tr><th>Date / deadline</th><th>Task / notes</th><th>Owner / branch</th><th>Status</th><th>Action</th></tr></thead><tbody>'+this.rows.map(t=>'<tr data-task-row data-status="'+h(t.status)+'"><td>'+h(t.task_date)+'<br><small>Due: '+h(t.due_date||'—')+'</small></td><td><strong>'+h(t.title)+'</strong><p style="white-space:pre-wrap">'+h(t.description)+'</p><p style="white-space:pre-wrap">'+h(t.progress_notes)+'</p></td><td>'+h(t.owner_name)+'<br><small>'+h(t.branch_name||'Unassigned')+'</small></td><td>'+h(labels[t.status]||t.status)+'</td><td>'+(t.can_edit?'<button class="ghost-btn" data-task-edit="'+t.id+'">Edit</button>':'View only')+'</td></tr>').join('')+'</tbody></table></div><p id="taskEmpty" '+(this.rows.length?'hidden':'')+'>No tasks to display.</p>');
 },
 bind() {
  document.querySelector('#taskAdd').onclick=()=>this.edit();
  document.querySelector('#taskRefresh').onclick=()=>{this.reset();this.load();};
  document.querySelectorAll('[data-task-edit]').forEach(b=>b.onclick=()=>this.edit(this.rows.find(t=>t.id===Number(b.dataset.taskEdit))));
  const filter=()=>{
   const q=document.querySelector('#taskSearch').value.toLowerCase(), status=document.querySelector('#taskStatus').value;let count=0;
   document.querySelectorAll('[data-task-row]').forEach(row=>{row.hidden=!(row.textContent.toLowerCase().includes(q)&&(!status||row.dataset.status===status));if(!row.hidden)count++;});
   document.querySelector('#taskEmpty').hidden=count>0;
  };
  document.querySelector('#taskSearch').oninput=filter;document.querySelector('#taskStatus').onchange=filter;
 },
 edit(task=null) {
  if(!Live.active || (task&&!task.can_edit))return;
  const seq=this.sequence,uid=Live.user.id,csrf=Live.csrf;
  const valid=()=>Live.active&&Live.user?.id===uid&&Live.csrf===csrf&&this.sequence===seq&&current==='tasks';
  const now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const layer=document.createElement('div');layer.id='taskModal';layer.className='modal-overlay';
  layer.innerHTML='<form class="modal" role="dialog" aria-modal="true" aria-labelledby="taskTitle" style="max-height:90vh;overflow-y:auto"><h2 id="taskTitle">'+(task?'Edit task':'Add task')+'</h2><div class="form-grid"><label>Task date<input class="field" name="task_date" type="date" required></label><label>Deadline (optional)<input class="field" name="due_date" type="date"></label><label>Title<input class="field" name="title" maxlength="180" required></label><label>Status<select class="field" name="status"><option value="not_started">Not Started</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></label><label>Description<textarea class="field" name="description" maxlength="2000" style="width:100%"></textarea></label><label>Progress notes<textarea class="field" name="progress_notes" maxlength="2000" style="width:100%"></textarea></label></div><p role="alert" id="taskError"></p><div class="modal-actions"><button type="button" class="ghost-btn" id="taskCancel">Cancel</button><button type="submit" class="primary-btn">Save task</button></div></form>';
  document.body.append(layer);const form=layer.querySelector('form');
  const values=task||{task_date:today,due_date:'',title:'',description:'',status:'not_started',progress_notes:''};
  for(const key of ['task_date','due_date','title','description','status','progress_notes'])form.elements.namedItem(key).value=values[key]||'';
  let saving=false;
  const close=()=>{if(!saving){layer.remove();document.querySelector('#taskAdd')?.focus();}};
  layer.querySelector('#taskCancel').onclick=close;
  layer.onkeydown=e=>{
   if(e.key==='Escape'){e.preventDefault();close();}
   if(e.key==='Tab'){const focus=[...form.querySelectorAll('input,select,textarea,button')].filter(x=>!x.disabled);const first=focus[0],last=focus.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  };
  form.elements.namedItem('title').focus();
  form.onsubmit=async e=>{
   e.preventDefault();if(saving||!valid())return;
   const body=Object.fromEntries(new FormData(form));if(task){body.id=task.id;body.version=task.version;}
   saving=true;const button=form.querySelector('[type=submit]');button.disabled=true;
   try {await Live.request('task_save.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});if(!valid())return;layer.remove();await this.load();}
   catch(err){if(!valid())return;if(err.status===401){Live.showLogin();return;}layer.querySelector('#taskError').textContent=err.message;}
   finally{saving=false;button.disabled=false;}
  };
 }
};
