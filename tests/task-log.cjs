const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={Live:{active:true,user:{id:1},csrf:'one'},current:'tasks',render(){},document:{querySelector(){return null;}},
 escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),heading:()=>'',panel:(t,b)=>b};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../task-log.js'),'utf8')+'\nglobalThis.tasks=TaskLog',context);
const tasks=context.tasks,row={id:1,task_date:'2026-11-17',title:'<script>alert(1)</script>',owner_name:'<owner>',status:'in_progress',can_edit:true};
(async()=>{
 context.Live.request=async()=>({tasks:[row],has_more:false});await tasks.load();
 assert.equal(tasks.rows.length,1);assert.ok(tasks.view().includes('&lt;script&gt;'));assert.ok(!tasks.view().includes('<script>'));assert.ok(tasks.view().includes('data-task-edit="1"'));
 tasks.rows=[{...row,can_edit:false}];assert.ok(!tasks.view().includes('data-task-edit'));
 context.Live.request=async()=>({});await tasks.load();assert.match(tasks.error,/Invalid task log/);
 let finish;context.Live.request=()=>new Promise(r=>finish=r);const old=tasks.load();tasks.reset();context.Live.user.id=2;context.Live.csrf='two';
 context.Live.request=async()=>({tasks:[],has_more:false});await tasks.load();finish({tasks:[row]});await old;assert.equal(tasks.rows.length,0);
 context.Live.showLogin=()=>{context.Live.active=false;tasks.reset();};context.Live.request=async()=>{throw Object.assign(new Error('Expired'),{status:401});};await tasks.load();assert.equal(context.Live.active,false);assert.equal(tasks.rows.length,0);
 console.log('PASS: task escaping, owner-only edit controls, malformed responses, stale session isolation and expired-session cleanup');
})().catch(e=>{console.error(e);process.exit(1)});
