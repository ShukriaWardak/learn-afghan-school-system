const assert = require('node:assert/strict');
const base='http://127.0.0.1:8099/backend/api/';
class Client {
  cookie=''; token='';
  async request(path,body,expected=200,csrf=true) {
    const headers={Cookie:this.cookie};
    if(body!==undefined) {headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=this.token;}
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
    const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
    const raw=await response.text();
    assert.equal(response.status,expected,`${path}: ${raw}`);
    return JSON.parse(raw);
  }
  async login(username) {
    this.token=(await this.request('csrf.php')).csrf_token;
    const result=await this.request('login.php',{username,password:'Disposable-test-password-2026'});
    this.token=result.csrf_token;
  }
}
(async()=>{
  for(let i=0;i<40;i++){try{await fetch(base+'csrf.php');break;}catch{await new Promise(r=>setTimeout(r,250));}}
  const anon=new Client();await anon.request('departments.php',undefined,401);await anon.request('personnel.php?kind=teacher',undefined,401);
  const admin=new Client();await admin.login('test_super');
  await admin.request('department_save.php',{code:'ED',name:'Education'},403,false);
  const dept=(await admin.request('department_save.php',{code:'ED',name:'Education'},201)).id;
  await admin.request('department_save.php',{code:'ed',name:'Duplicate'},409);
  await admin.request('department_save.php',{id:dept,name:'Education & Curriculum'});
  assert.equal((await admin.request('departments.php')).departments[0].name,'Education & Curriculum');
  const data={code:'T_01',full_name:'Test Teacher',kind:'teacher',branch_id:1,department_id:dept,job_title:'Teacher',status:'active'};
  const id=(await admin.request('personnel_save.php',data,201)).id;
  await admin.request('personnel_save.php',data,409);
  await admin.request('personnel_save.php',{...data,code:'INVALID',full_name:' '},400);
  await admin.request('personnel_save.php',{...data,code:'INVALID',branch_id:999999},400);
  await admin.request('personnel_save.php',{...data,code:'INVALID',department_id:'1'},400);
  await admin.request('personnel_save.php',{...data,code:'INVALID',status:'deleted'},400);
  await admin.request('personnel_save.php',{...data,code:'T_02',branch_id:2},201);
  await admin.request('personnel_save.php',{...data,code:'S_01',kind:'staff'},201);
  await admin.request('personnel_save.php',{...data,id,version:1,status:'inactive'});
  await admin.request('personnel_save.php',{...data,id,version:1},409);
  const rows=(await admin.request('personnel.php?kind=teacher')).personnel;
  assert.equal(rows.length,2);assert.equal(rows.find(r=>Number(r.id)===id).status,'inactive');assert.equal(Number(rows.find(r=>Number(r.id)===id).version),2);
  assert.equal((await admin.request('personnel.php?kind=staff')).personnel.length,1);
  await admin.request('personnel.php?kind=other',undefined,400);
  for(const user of ['test_zone','test_branch']) {
    const client=new Client();await client.login(user);
    const scoped=(await client.request('personnel.php?kind=teacher')).personnel;
    assert.equal(scoped.length,1);assert.equal(Number(scoped[0].branch_id),1);
    await client.request('personnel_save.php',{...data,id,version:2},403);
    await client.request('department_save.php',{code:'NO',name:'No'},403);
    await client.request('departments.php',undefined,403);
    await client.request('branch_admins.php',undefined,403);
  }
  const denied=new Client();await denied.login('test_department');await denied.request('personnel.php?kind=teacher',undefined,403);
  const admins=(await admin.request('branch_admins.php')).admins;assert.equal(admins.length,1);assert.equal(admins[0].username,'test_branch');assert.ok(!('password_hash' in admins[0]));
  const audit=(await admin.request('audit.php')).events;
  assert.equal(audit.filter(row=>row.entity_type==='personnel').length,4);
  assert.equal(audit.filter(row=>row.entity_type==='department').length,2);
  await admin.request('logout.php',{});await admin.request('personnel.php?kind=teacher',undefined,401);
  console.log('PASS: persisted CRUD, invalid/duplicate records, stale edits, role scope, CSRF, audit counts and logout');
})().catch(error=>{console.error(error);process.exit(1);});
