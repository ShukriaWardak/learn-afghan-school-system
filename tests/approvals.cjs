const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const context={
  Live:{active:true,user:{id:1,role:'super_admin'},csrf:'first-session'},
  current:'approvals',render(){},
  escapeHtml:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  heading:(title,description,actions='')=>title+description+actions,panel:(title,body)=>title+body,
  localStorage:new Proxy({},{get(){throw new Error('Approvals must not use browser storage');}})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../approvals.js'),'utf8')+'\nglobalThis.approvals=Approvals;',context);
const approvals=context.approvals;
const rows=[{id:1,code:'REVIEW_01',name:'<img src=x>',zone_name:'North',location:'Kabul',created_at:'2026-01-01'},
  {id:2,code:'REVIEW_02',name:'شعبه آزمایشی',zone_name:'South',location:null,created_at:'2026-01-02'}];
const decisions=[{id:1,branch_code:'OLD',branch_name:'Old branch',decision:'reject',note:'<script>note</script>',reviewer:'Reviewer',created_at:'2026-01-01'}];
const fixture=async()=>({approvals:rows,decisions,limit:200,truncated:false});
(async()=>{
  context.Live.request=fixture;await approvals.load();
  assert.equal(approvals.filteredRows().length,2);
  approvals.search='  north ';assert.equal(approvals.filteredRows()[0].id,1);
  approvals.search='آزمایشی';assert.equal(approvals.filteredRows()[0].id,2);
  approvals.search='';let html=approvals.view();
  assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('&lt;script&gt;note&lt;/script&gt;'));
  assert.ok(html.includes('data-approval-id="1"'));assert.ok(html.includes('data-decision="reject"'));
  approvals.truncated=true;assert.ok(approvals.view().includes('The first 200 pending branches'));approvals.truncated=false;
  for(const role of ['zone_admin','branch_admin','department_user']){
    context.Live.user.role=role;await approvals.load();assert.equal(approvals.rows.length,0);
    assert.equal(approvals.decisions.length,0);assert.ok(approvals.view().includes('does not have access'));
  }
  context.Live.user.role='super_admin';
  context.Live.request=async()=>{throw new Error('Service unavailable');};await approvals.load();
  assert.ok(approvals.view().includes('Service unavailable'));assert.equal(approvals.rows.length,0);
  context.Live.request=async()=>({});await approvals.load();assert.match(approvals.error,/Invalid approvals response/);
  let finishOld;context.Live.request=()=>new Promise(resolve=>finishOld=resolve);
  const old=approvals.load();approvals.reset();context.Live.user={id:2,role:'super_admin'};context.Live.csrf='second-session';
  context.Live.request=async()=>({approvals:[rows[1]],decisions:[],limit:200,truncated:false});await approvals.load();
  finishOld({approvals:rows,decisions,limit:200,truncated:false});await old;
  assert.equal(approvals.rows.length,1);assert.equal(approvals.rows[0].id,2);assert.equal(approvals.decisions.length,0);
  // Closing a native dialog queues its close event; reset must remove it immediately.
  let closed=false,removed=false;
  approvals.dialog={close(){closed=true;},remove(){removed=true;}};
  approvals.reset();assert.ok(closed);assert.ok(removed,'Review details removed before the queued close event');
  assert.equal(approvals.dialog,null);assert.equal(approvals.rows.length,0);assert.equal(approvals.decisions.length,0);
  context.Live.showLogin=()=>{context.Live.active=false;approvals.reset();};
  context.Live.request=async()=>{throw Object.assign(new Error('Expired'),{status:401});};await approvals.load();
  assert.equal(context.Live.active,false);assert.equal(approvals.loading,false);
  console.log('PASS: approval search, Unicode/HTML escaping, role gates, queue limits, error retry, immediate dialog cleanup and session/delayed-response isolation');
})().catch(error=>{console.error(error);process.exit(1);});
