const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Use disposable CI fixtures only');
const base='http://127.0.0.1:8099/backend/api/';
class Client{
  cookie='';csrf='';
  async request(endpoint,body,expected=200,options={}){
    const headers={Cookie:this.cookie,...options.headers};
    if(body!==undefined){headers['Content-Type']='application/json';if(options.csrf!==false)headers['X-CSRF-Token']=this.csrf;}
    const response=await fetch(base+endpoint,{method:options.method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body)});
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    const text=await response.text();assert.equal(response.status,expected,endpoint+': '+text);return JSON.parse(text);
  }
  async login(username){this.csrf=(await this.request('csrf.php')).csrf_token;this.csrf=(await this.request('login.php',{username,password:'Disposable-test-password-2026'})).csrf_token;}
}
const fixture=sql=>execFileSync('php',['-r',`
  if(getenv('LEARN_INTEGRATION_TEST')!=='1')exit(1);
  $c=require $argv[1];if($c['database']!=='learn_afghan'||$c['password']!==getenv('MYSQL_TEST_PASSWORD'))exit(1);
  $p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname=learn_afghan',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $h=$p->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
  if(!$h||!password_verify('Disposable-test-password-2026',$h))exit(1);
  $p->exec($argv[2]);
`,'--',path.join(__dirname,'../backend/config.local.php'),sql],{encoding:'utf8'});
(async()=>{
  const anonymous=new Client();await anonymous.request('approvals.php',undefined,401);
  anonymous.csrf=(await anonymous.request('csrf.php')).csrf_token;
  await anonymous.request('approval_decide.php',{branch_id:1,decision:'approve',review_version:'a'.repeat(64)},401);
  const admin=new Client();await admin.login('test_super');
  await admin.request('approval_decide.php',undefined,405);
  await admin.request('approvals.php',{},405);
  const create=async(code,name)=>Number((await admin.request('branch_create.php',{code,name,zone_id:1,location:'Test location'},201)).id);
  const id=await create('REVIEW_API_01','Test branch for review');
  const getRow=async(branchId)=>(await admin.request('approvals.php')).approvals.find(r=>r.id===branchId);
  let row=await getRow(id);assert.ok(row);assert.match(row.review_version,/^[a-f0-9]{64}$/);
  const payload={branch_id:id,decision:'approve',review_version:row.review_version,note:'Reviewed in disposable test'};
  await admin.request('approval_decide.php',payload,403,{csrf:false});
  await admin.request('approval_decide.php',payload,403,{headers:{Origin:'https://untrusted.example'}});
  for(const bad of [{...payload,branch_id:String(id)},{...payload,decision:'delete'},{...payload,review_version:'bad'},
    {...payload,note:{}},{...payload,note:'x'.repeat(501)},{...payload,note:'bad\u0000note'},
    {...payload,decision:'reject',note:' '}])await admin.request('approval_decide.php',bad,400);
  await admin.request('approval_decide.php',{...payload,branch_id:999999999},404);
  for(const username of ['test_zone','test_branch','test_department']){
    const client=new Client();await client.login(username);await client.request('approvals.php',undefined,403);
    await client.request('approval_decide.php',payload,403);
  }
  await admin.request('branch_update.php',{id,zone_id:1,name:'Changed while review open',location:'Test location',status:'pending'});
  await admin.request('approval_decide.php',payload,409);
  row=await getRow(id);assert.notEqual(row.review_version,payload.review_version);
  const result=await admin.request('approval_decide.php',{...payload,review_version:row.review_version});assert.equal(result.status,'active');
  assert.equal(await getRow(id),undefined);
  const branches=(await admin.request('branches.php')).branches;assert.equal(branches.find(b=>Number(b.id)===id).status,'active');
  await admin.request('approval_decide.php',{...payload,review_version:row.review_version},409);
  let history=(await admin.request('approvals.php')).decisions.filter(d=>d.branch_id===id);
  assert.equal(history.length,1);assert.equal(history[0].decision,'approve');assert.equal(history[0].note,payload.note);
  const rejected=await create('REVIEW_API_02','Test rejected branch');const rejectRow=await getRow(rejected);
  const note='اطلاعات شعبه تکمیل شود\n<script>test</script>';
  assert.equal((await admin.request('approval_decide.php',{branch_id:rejected,decision:'reject',review_version:rejectRow.review_version,note})).status,'inactive');
  history=(await admin.request('approvals.php')).decisions.filter(d=>d.branch_id===rejected);
  assert.equal(history.length,1);assert.equal(history[0].note,note);assert.equal(history[0].decision,'reject');
  const rollbackId=await create('REVIEW_API_03','Test audit rollback');const rollbackRow=await getRow(rollbackId);
  fixture("CREATE TRIGGER approval_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Disposable approval audit failure'");
  try{
    await admin.request('approval_decide.php',{branch_id:rollbackId,decision:'approve',review_version:rollbackRow.review_version},500);
    assert.equal((await getRow(rollbackId)).review_version,rollbackRow.review_version);
    assert.ok(!(await admin.request('approvals.php')).decisions.some(d=>d.branch_id===rollbackId));
  }finally{fixture('DROP TRIGGER approval_audit_failure');}
  const second=new Client();await second.login('test_super');
  const statuses=await Promise.all([admin,second].map(async client=>{
    const response=await fetch(base+'approval_decide.php',{method:'POST',headers:{Cookie:client.cookie,'Content-Type':'application/json','X-CSRF-Token':client.csrf},body:JSON.stringify({branch_id:rollbackId,decision:'approve',review_version:rollbackRow.review_version})});return response.status;
  }));assert.deepEqual(statuses.sort(),[200,409]);
  assert.equal((await admin.request('approvals.php')).decisions.filter(d=>d.branch_id===rollbackId).length,1);
  const values=Array.from({length:205},(_,i)=>`(1,'REVIEW_LIMIT_${i}','Disposable queue limit ${i}','pending')`).join(',');
  fixture('INSERT INTO branches(zone_id,code,name,status) VALUES '+values);
  try{
    const capped=await admin.request('approvals.php');assert.equal(capped.approvals.length,200);assert.equal(capped.truncated,true);
    assert.ok(capped.approvals.every(b=>b.status==='pending'));
    const report=await admin.request('reports_summary.php?date=2026-03-02');assert.equal(report.branches_truncated,true);
    await admin.request('reports_export.php?date=2026-03-02',undefined,409);
  }finally{fixture("DELETE FROM branches WHERE code LIKE 'REVIEW_LIMIT_%'");}
  await admin.request('logout.php',{});await admin.request('approvals.php',undefined,401);
  console.log('PASS: branch approve/reject persistence, decision notes/history, validation, role/CSRF/origin guards, stale review rejection, replay protection, audit rollback, queue limits and logout');
})().catch(error=>{console.error(error);process.exit(1);});
