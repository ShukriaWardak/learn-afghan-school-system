const assert=require('node:assert/strict');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Use disposable CI fixtures only');
const base='http://127.0.0.1:8099/backend/api/';
class Client{
 cookie='';csrf='';
 async request(endpoint,body,expected=200,withCsrf=true){
  const headers={Cookie:this.cookie};
  if(body!==undefined){
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
 async login(username){
  this.csrf=(await this.request('csrf.php')).csrf_token;
  this.csrf=(await this.request('login.php',{username,password:'Disposable-test-password-2026'})).csrf_token;
 }
}
(async()=>{
 const date='2026-03-02';
 const anonymous=new Client();
 await anonymous.request('personnel_attendance.php?kind=teacher&date='+date,undefined,401);
 const admin=new Client();await admin.login('test_super');
 const departments=(await admin.request('departments.php')).departments;
 assert.ok(departments.length>0,'Personnel integration fixture supplies a department');
 const department=Number(departments[0].id);
 const createPerson=async(code,kind,branch_id)=>{
  const result=await admin.request('personnel_save.php',{code,full_name:'Synthetic '+code,kind,branch_id,department_id:department,job_title:'Test '+kind,status:'active'},201);
  return Number(result.id);
 };
 const teacher1=await createPerson('PAT_T1','teacher',1);
 const teacher2=await createPerson('PAT_T2','teacher',2);
 const staff1=await createPerson('PAT_S1','staff',1);
 const valid={personnel_id:teacher1,kind:'teacher',attendance_date:date,status:'present'};
 await admin.request('personnel_attendance.php?kind=teacher&date=2026-02-30',undefined,400);
 await admin.request('personnel_attendance.php?kind=other&date='+date,undefined,400);
 await admin.request('personnel_attendance.php?kind=teacher',undefined,400);
 await admin.request('personnel_attendance_save.php',valid,403,false);
 await admin.request('personnel_attendance_save.php',{...valid,attendance_date:'2026-02-30'},400);
 await admin.request('personnel_attendance_save.php',{...valid,kind:'other'},400);
 await admin.request('personnel_attendance_save.php',{...valid,status:'not-present'},400);
 await admin.request('personnel_attendance_save.php',{...valid,personnel_id:'1'},400);
 await admin.request('personnel_attendance_save.php',{...valid,personnel_id:987654},400);
 await admin.request('personnel_attendance_save.php',{...valid,kind:'staff'},400);
 const teacherRecord=Number((await admin.request('personnel_attendance_save.php',valid,201)).id);
 await admin.request('personnel_attendance_save.php',valid,409);
 const teacherRecord2=Number((await admin.request('personnel_attendance_save.php',{...valid,personnel_id:teacher2,status:'late'},201)).id);
 const staffRecord=Number((await admin.request('personnel_attendance_save.php',{...valid,personnel_id:staff1,kind:'staff',status:'absent'},201)).id);
 assert.ok(staffRecord>0);
 const teachers=(await admin.request('personnel_attendance.php?kind=teacher&date='+date)).attendance;
 assert.equal(teachers.length,2);
 assert.deepEqual(teachers.map(x=>x.status).sort(),['late','present']);
 assert.ok(teachers.every(x=>!('password_hash' in x)&&!('recorded_by' in x)));
 assert.equal((await admin.request('personnel_attendance.php?kind=staff&date='+date)).attendance.length,1);
 await admin.request('personnel_attendance_save.php',{...valid,id:teacherRecord,version:1,status:'excused'},200);
 await admin.request('personnel_attendance_save.php',{...valid,id:teacherRecord,version:1,status:'late'},409);
 await admin.request('personnel_attendance_save.php',{...valid,id:teacherRecord,version:2,attendance_date:'2026-03-03'},400);
 await admin.request('personnel_attendance_save.php',{...valid,id:teacherRecord,version:2,personnel_id:teacher2},400);
 await admin.request('personnel_attendance_save.php',{...valid,id:888888,version:1},404);
 let changed=(await admin.request('personnel_attendance.php?kind=teacher&date='+date)).attendance;
 assert.equal(changed.find(r=>Number(r.id)===teacherRecord).status,'excused');
 assert.equal(Number(changed.find(r=>Number(r.id)===teacherRecord).version),2);
 const zone=new Client();await zone.login('test_zone');
 assert.deepEqual((await zone.request('personnel_attendance.php?kind=teacher&date='+date)).attendance.map(r=>Number(r.id)),[teacherRecord]);
 assert.equal((await zone.request('personnel_attendance.php?kind=staff&date='+date)).attendance.length,1);
 await zone.request('personnel_attendance_save.php',valid,403);
 const branch=new Client();await branch.login('test_branch');
 assert.deepEqual((await branch.request('personnel_attendance.php?kind=teacher&date='+date)).attendance.map(r=>Number(r.id)),[teacherRecord]);
 await branch.request('personnel_attendance_save.php',valid,403);
 const departmentUser=new Client();await departmentUser.login('test_department');
 await departmentUser.request('personnel_attendance.php?kind=teacher&date='+date,undefined,403);
 await departmentUser.request('personnel_attendance_save.php',valid,403);
 assert.equal((await admin.request('personnel_attendance.php?kind=staff&date=2026-03-01')).attendance.length,0);
 const audit=(await admin.request('audit.php')).events.filter(e=>e.entity_type==='personnel_attendance');
 assert.equal(audit.filter(e=>e.action==='personnel_attendance.create').length,3);
 assert.equal(audit.filter(e=>e.action==='personnel_attendance.update').length,1);
 await admin.request('logout.php',{});
 await admin.request('personnel_attendance.php?kind=teacher&date='+date,undefined,401);
 console.log('PASS: personnel attendance validation, uniqueness, CSRF, status editing, role scoping, audits and logout');
})().catch(error=>{console.error(error);process.exit(1);});
