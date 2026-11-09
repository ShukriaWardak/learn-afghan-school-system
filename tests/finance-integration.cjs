const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Disposable CI fixtures only');
const base='http://127.0.0.1:8099/backend/api/';
class Client{
  cookie='';csrf='';user=null;
  async request(endpoint,body,expected=200,options={}){
    const headers={Cookie:this.cookie,...options.headers};
    if(body!==undefined){headers['Content-Type']='application/json';if(options.csrf!==false)headers['X-CSRF-Token']=this.csrf;}
    const response=await fetch(base+endpoint,{method:options.method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body)});
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    const text=await response.text();assert.equal(response.status,expected,endpoint+': '+text);return JSON.parse(text);
  }
  async login(username){
    this.csrf=(await this.request('csrf.php')).csrf_token;
    const data=await this.request('login.php',{username,password:'Disposable-test-password-2026'});this.csrf=data.csrf_token;this.user=data.user;
  }
}
const db=path.join(__dirname,'finance-test-db.php');
const fixture=sql=>execFileSync('php',['-r','$p=require $argv[1];$p->exec($argv[2]);','--',db,sql],{encoding:'utf8'});
const query=sql=>JSON.parse(execFileSync('php',['-r','$p=require $argv[1];echo json_encode($p->query($argv[2])->fetchAll(),JSON_THROW_ON_ERROR);','--',db,sql],{encoding:'utf8'}));
const payload=overrides=>({entry_date:'2026-03-15',entry_type:'expense',category:'supplies',amount:'1250.50',currency:'AFN',branch_id:null,
  counterparty:'Disposable vendor',payment_method:'cash',receipt_reference:'FINANCE_API',description:'Synthetic supplies',notes:'',request_key:randomUUID(),...overrides});
(async()=>{
  const anonymous=new Client();await anonymous.request('finance.php',undefined,401);
  anonymous.csrf=(await anonymous.request('csrf.php')).csrf_token;await anonymous.request('finance_save.php',payload(),401);
  const admin=new Client();await admin.login('test_super');
  const team=[];for(let i=1;i<=5;i++){const c=new Client();await c.login('test_finance_'+i);assert.equal(c.user.department_code,'FINANCE');team.push(c);}
  const finance=team[0],initial=await finance.request('finance.php');
  assert.equal(initial.active_team_members,5);assert.equal(initial.total,0);assert.equal(initial.currency,'AFN');
  assert.deepEqual(initial.permissions,{can_add:true,can_edit:true,can_delete:false,can_use_central_office:true});
  assert.equal((await admin.request('finance.php')).permissions.can_edit,false);await admin.request('finance_save.php',payload(),403);
  for(const username of ['test_zone','test_branch','test_department']){
    const denied=new Client();await denied.login(username);await denied.request('finance.php',undefined,403);await denied.request('finance_save.php',payload(),403);
  }
  await finance.request('finance.php',{},405);await finance.request('finance_save.php',undefined,405);
  await finance.request('finance_save.php',undefined,405,{method:'DELETE'});
  await finance.request('finance_save.php',payload(),403,{csrf:false});
  await finance.request('finance_save.php',payload(),403,{headers:{Origin:'https://untrusted.example'}});
  for(const bad of [
    {amount:12.5},{amount:'0'},{amount:'-1'},{amount:'1.001'},{amount:'1e3'},{amount:'1,000'},{amount:'01.00'},{amount:'1000000000000'},
    {currency:'USD'},{entry_date:'2026-02-30'},{entry_date:'1999-12-31'},{category:'donation'}, {entry_type:'transfer'},
    {counterparty:' '},{description:'x'.repeat(501)},{notes:'bad\u0000note'},{branch_id:'1'},{request_key:'bad'},{payment_method:'other'}
  ])await finance.request('finance_save.php',payload(bad),400);
  await finance.request('finance_save.php',payload({branch_id:99999999}),400);
  for(const endpoint of ['finance.php?from=2026-02-30','finance.php?from=2026-04-01&to=2026-03-01','finance.php?type=transfer','finance.php?page=0','finance.php?search[]=bad','finance.php?branch[]=1','finance.php?branch=-1'])
    await finance.request(endpoint,undefined,400);
  // Each of the five distinct members can create, and a colleague can edit an entry.
  const created=[];
  for(let i=0;i<team.length;i++)created.push(await team[i].request('finance_save.php',payload({amount:(i+1)+'.01',receipt_reference:'TEAM_TEST_'+i}),201));
  let row=(await finance.request('finance.php?search=TEAM_TEST_0')).entries[0];
  const update={...row,id:row.id,version:row.version,amount:'2.50',correction_reason:'Corrected by a second finance member'};
  await team[1].request('finance_save.php',update);await team[2].request('finance_save.php',update,409);
  row=(await finance.request('finance.php?search=TEAM_TEST_0')).entries[0];assert.equal(row.amount,'2.50');assert.equal(row.version,2);assert.equal(row.updated_by_name,'Disposable Finance 2');
  await finance.request('finance_save.php',{...update,version:2,correction_reason:' '},400);
  await finance.request('finance_save.php',{...update,version:2,id:99999999},404);
  const details=query("SELECT actor_user_id,details_json FROM audit_events WHERE action='finance.update' AND entity_id='"+row.id+"'");
  assert.equal(details.length,1);assert.equal(Number(details[0].actor_user_id),team[1].user.id);
  const change=JSON.parse(details[0].details_json);assert.equal(change.before.amount,'1.01');assert.equal(change.after.amount,'2.50');assert.equal(change.correction_reason,update.correction_reason);
  for(const amount of ['0.1','0.20'])await finance.request('finance_save.php',payload({entry_type:'income',category:'donation',amount,receipt_reference:'EXACT_SMALL'}),201);
  assert.deepEqual((await finance.request('finance.php?search=EXACT_SMALL')).totals,{income:'0.30',expense:'0.00',net:'0.30'});
  for(let i=0;i<2;i++)await finance.request('finance_save.php',payload({entry_type:'income',category:'grant',amount:'999999999999.99',receipt_reference:'EXACT_LARGE'}),201);
  assert.equal((await finance.request('finance.php?search=EXACT_LARGE')).totals.income,'1999999999999.98');
  assert.equal((await finance.request('finance.php?type=expense&search=EXACT_LARGE')).total,0);
  assert.equal((await finance.request('finance.php?from=2026-03-16')).total,0);
  const unicode=payload({counterparty:'د آزموینې پلورونکی',description:'نمونه\n<script>literal</script>',notes:'یادداشت\nدوهمه کرښه',receipt_reference:'LITERAL_%_TEST'});
  const saved=await finance.request('finance_save.php',unicode,201);
  const retry=await finance.request('finance_save.php',unicode);assert.equal(retry.id,saved.id);assert.equal(retry.replayed,true);
  await finance.request('finance_save.php',{...unicode,amount:'50.00'},409);await team[1].request('finance_save.php',unicode,409);
  const persisted=(await finance.request('finance.php?search='+encodeURIComponent('LITERAL_%_TEST'))).entries;
  assert.equal(persisted.length,1);assert.equal(persisted[0].notes,unicode.notes);assert.equal(persisted[0].description,unicode.description);
  assert.equal(query("SELECT id FROM audit_events WHERE action='finance.create' AND entity_id='"+saved.id+"'").length,1);
  // A lost response can be retried, but no entry may survive a failed audit write.
  const rollback=payload({receipt_reference:'ROLLBACK_TEST'});
  fixture("CREATE TRIGGER finance_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Disposable finance audit failure'");
  try{
    await finance.request('finance_save.php',rollback,500);assert.equal((await finance.request('finance.php?search=ROLLBACK_TEST')).total,0);
    await finance.request('finance_save.php',{...update,version:2,amount:'99.00'},500);
    assert.equal((await finance.request('finance.php?search=TEAM_TEST_0')).entries[0].amount,'2.50');
  }finally{fixture('DROP TRIGGER finance_audit_failure');}
  await finance.request('finance_save.php',rollback,201);
  // Permissions are read from MySQL on every request, including a live session.
  fixture("UPDATE users SET department_id=NULL WHERE username='test_finance_5'");
  try{await team[4].request('finance.php',undefined,403);await team[4].request('finance_save.php',payload(),403);}
  finally{fixture("UPDATE users SET department_id=(SELECT id FROM departments WHERE code='FINANCE') WHERE username='test_finance_5'");}
  fixture("UPDATE users SET active=0 WHERE username='test_finance_4'");
  try{await team[3].request('finance_save.php',payload(),401);}finally{fixture("UPDATE users SET active=1 WHERE username='test_finance_4'");}
  await team[3].login('test_finance_4'); // Inactivation correctly invalidated the old session.
  // Full server-side pagination and totals, using synthetic fixture rows only.
  const values=Array.from({length:55},()=>"('2026-02-01','expense','supplies',1.00,'AFN','Pagination vendor','cash','PAGINATION_TEST','Disposable pagination entry','"+randomUUID()+"','"+'a'.repeat(64)+"')").join(',');
  fixture('INSERT INTO finance_entries(entry_date,entry_type,category,amount,currency,counterparty,payment_method,receipt_reference,description,request_key,request_hash) VALUES '+values);
  const first=await finance.request('finance.php?search=PAGINATION_TEST'),second=await finance.request('finance.php?search=PAGINATION_TEST&page=2');
  assert.equal(first.total,55);assert.equal(first.entries.length,50);assert.equal(second.entries.length,5);assert.equal(first.pages,2);assert.equal(first.totals.expense,'55.00');
  assert.ok(!first.entries.some(a=>second.entries.some(b=>a.id===b.id)));
  assert.equal((await finance.request('finance.php?search=PAGINATION_TEST&page=999')).page,2);
  // Existing zone/branch assignments narrow Finance access, including sums and retries.
  const scopeRows=[];
  for(const data of [
    {branch_id:null,amount:'300.00',entry_type:'income',category:'donation'},
    {branch_id:1,amount:'10.10',entry_type:'income',category:'donation'},
    {branch_id:2,amount:'5.05'},
    {branch_id:3,amount:'2.02'}
  ])scopeRows.push(await finance.request('finance_save.php',payload({...data,receipt_reference:'SCOPE_TEST'}),201));
  fixture("UPDATE users SET zone_id=1 WHERE username='test_finance_4'; UPDATE users SET branch_id=1 WHERE username='test_finance_5'");
  try{
    const zone=await team[3].request('finance.php?search=SCOPE_TEST');
    assert.deepEqual(zone.entries.map(r=>r.branch_id).sort(),[1,3]);assert.equal(zone.permissions.can_use_central_office,false);
    assert.deepEqual(zone.totals,{income:'10.10',expense:'2.02',net:'8.08'});
    assert.deepEqual(zone.branches.map(b=>Number(b.id)).sort(),[1,3]);
    const branch=await team[4].request('finance.php?search=SCOPE_TEST');assert.equal(branch.total,1);assert.equal(branch.entries[0].branch_id,1);
    assert.equal((await team[4].request('finance.php?branch=2')).total,0);assert.equal((await team[3].request('finance.php?branch=central')).total,0);
    await team[4].request('finance_save.php',payload(),403);await team[3].request('finance_save.php',payload({branch_id:2}),400);
    await team[4].request('finance_save.php',{...payload({branch_id:1}),id:scopeRows[2].id,version:1,correction_reason:'Must not read or move another scope'},404);
    const scopedPayload=payload({branch_id:1,receipt_reference:'SCOPED_RETRY'});
    const scoped=await team[4].request('finance_save.php',scopedPayload,201);
    await finance.request('finance_save.php',{...scopedPayload,id:scoped.id,version:1,branch_id:2,correction_reason:'Move to another assigned office'});
    await team[4].request('finance_save.php',scopedPayload,409);
    fixture("UPDATE users SET zone_id=2 WHERE username='test_finance_5'");
    const inconsistent=await team[4].request('finance.php');assert.equal(inconsistent.total,0);assert.equal(inconsistent.permissions.can_add,false);
  }finally{fixture("UPDATE users SET zone_id=NULL,branch_id=NULL WHERE username IN ('test_finance_4','test_finance_5')");}
  await finance.request('branch_create.php',{code:'DENIED',name:'Denied',zone_id:1},403);
  await finance.request('audit.php',undefined,403);
  await finance.request('logout.php',{});await finance.request('finance.php',undefined,401);
  console.log('PASS: five finance accounts, AFN precision, role/CSRF/origin guards, scoped rows/branches/totals/writes, persistence, stale edits, retry protection, audit rollback, membership revocation and pagination');
})().catch(error=>{console.error(error);process.exit(1);});
