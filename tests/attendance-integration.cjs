const assert = require('node:assert/strict');
if (process.env.LEARN_INTEGRATION_TEST !== '1') throw new Error('Disposable CI database only');
const base='http://127.0.0.1:8099/backend/api/';
class Client {
  cookie='';csrf='';
  async request(endpoint,body,expected=200,withCsrf=true) {
    const headers={Cookie:this.cookie};
    if(body!==undefined) {
      headers['Content-Type']='application/json';
      if(withCsrf)headers['X-CSRF-Token']=this.csrf;
    }
    const response=await fetch(base+endpoint,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
    const cookie=response.headers.get('set-cookie');
    if(cookie)this.cookie=cookie.split(';')[0];
    const raw=await response.text();
    assert.equal(response.status,expected,endpoint+': '+raw);
    return JSON.parse(raw);
  }
  async login(username) {
    this.csrf=(await this.request('csrf.php')).csrf_token;
    this.csrf=(await this.request('login.php',{username,password:'Disposable-test-password-2026'})).csrf_token;
  }
}
(async()=>{
  const day='2026-03-01',badDay='2026-02-30';
  const anonymous=new Client();
  await anonymous.request('attendance.php?date='+day,undefined,401);
  const admin=new Client();await admin.login('test_super');
  const createStudent=async(code,branch)=> (await admin.request('student_save.php',{
    student_code:code,full_name:'Test Attendance '+code,branch_id:branch,grade_level:'10',status:'active'
  },201)).id;
  const a=await createStudent('AT_T1',1);
  const b=await createStudent('AT_T2',2);
  await admin.request('attendance.php?date='+badDay,undefined,400);
  await admin.request('attendance.php',undefined,400);
  const data={student_id:a,attendance_date:day,status:'present'};
  await admin.request('attendance_save.php',data,403,false);
  await admin.request('attendance_save.php',{...data,attendance_date:badDay},400);
  await admin.request('attendance_save.php',{...data,status:'unknown'},400);
  await admin.request('attendance_save.php',{...data,student_id:999999},400);
  await admin.request('attendance_save.php',{...data,student_id:'1'},400);
  const created=(await admin.request('attendance_save.php',data,201)).id;
  await admin.request('attendance_save.php',data,409);
  const created2=(await admin.request('attendance_save.php',{...data,student_id:b,status:'absent'},201)).id;
  const rows=(await admin.request('attendance.php?date='+day)).attendance;
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>x.status).sort(),['absent','present']);
  assert.ok(rows.every(x=>!('recorded_by' in x)&&!('password_hash' in x)));
  await admin.request('attendance_save.php',{...data,id:created,version:1,status:'late'},200);
  await admin.request('attendance_save.php',{...data,id:created,version:1,status:'excused'},409);
  await admin.request('attendance_save.php',{...data,id:created,version:2,attendance_date:'2026-03-02'},400);
  await admin.request('attendance_save.php',{...data,id:created,version:2,student_id:b},400);
  await admin.request('attendance_save.php',{...data,id:999999,version:1},404);
  const now=(await admin.request('attendance.php?date='+day)).attendance;
  assert.equal(now.find(x=>Number(x.id)===created).status,'late');
  assert.equal(Number(now.find(x=>Number(x.id)===created).version),2);
  const zone=new Client();await zone.login('test_zone');
  const zoneRows=(await zone.request('attendance.php?date='+day)).attendance;
  assert.deepEqual(zoneRows.map(x=>Number(x.id)),[created]);
  await zone.request('attendance_save.php',data,403);
  const branch=new Client();await branch.login('test_branch');
  assert.deepEqual((await branch.request('attendance.php?date='+day)).attendance.map(x=>Number(x.id)),[created]);
  await branch.request('attendance_save.php',data,403);
  const blocked=new Client();await blocked.login('test_department');
  await blocked.request('attendance.php?date='+day,undefined,403);
  await blocked.request('attendance_save.php',data,403);
  const audit=(await admin.request('audit.php')).events.filter(x=>x.entity_type==='attendance');
  assert.equal(audit.filter(x=>x.action==='attendance.create').length,2);
  assert.equal(audit.filter(x=>x.action==='attendance.update').length,1);
  const empty=(await admin.request('attendance.php?date=2026-03-03')).attendance;
  assert.equal(empty.length,0);
  await admin.request('logout.php',{});
  await admin.request('attendance.php?date='+day,undefined,401);
  console.log('PASS: attendance date/status validation, CSRF, uniqueness, audited create/update, conflict checks, scope limits and logout');
})().catch(error=>{console.error(error);process.exit(1);});
