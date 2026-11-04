const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Use disposable GitHub CI fixtures only.');
const base='http://127.0.0.1:8099/backend/api/';
class Client{
 cookie='';csrf='';
 async raw(endpoint,options={}){
  const response=await fetch(base+endpoint,{headers:{Cookie:this.cookie},...options});
  const cookie=response.headers.get('set-cookie');
  if(cookie)this.cookie=cookie.split(';')[0];
  return response;
 }
 async get(endpoint,expected=200){
  const response=await this.raw(endpoint);
  const body=await response.text();
  assert.equal(response.status,expected,endpoint+': '+body);
  return JSON.parse(body);
 }
 async login(username){
  this.csrf=(await this.get('csrf.php')).csrf_token;
  const response=await this.raw('login.php',{
   method:'POST',headers:{Cookie:this.cookie,'Content-Type':'application/json','X-CSRF-Token':this.csrf},
   body:JSON.stringify({username,password:'Disposable-test-password-2026'})
  });
  const text=await response.text();
  assert.equal(response.status,200,text);
  this.csrf=JSON.parse(text).csrf_token;
 }
}
const sumStatuses=(rows,field='status')=>rows.reduce((sum,row)=>({...sum,[row[field]]:(sum[row[field]]||0)+1}),{});
(async()=>{
 const day='2026-03-02',query='?date='+day;
 const anonymous=new Client();
 await anonymous.get('reports_summary.php'+query,401);
 await anonymous.get('reports_export.php'+query,401);
 const admin=new Client();await admin.login('test_super');
 for(const invalid of ['2026-02-30','0000-01-01','abc','2026-3-02','2026-03-02%27%20OR%201%3D1']){
  await admin.get('reports_summary.php?date='+invalid,400);
  await admin.get('reports_export.php?date='+invalid,400);
 }
 await admin.get('reports_summary.php',400);
 const report=await admin.get('reports_summary.php'+query);
 assert.equal(report.date,day);
 assert.equal(report.scope,'super_admin');
 assert.equal(report.branches_truncated,false);
 assert.equal(report.branch_limit,200);
 const branches=(await admin.get('branches.php')).branches;
 const students=(await admin.get('students.php')).students;
 const teachers=(await admin.get('personnel.php?kind=teacher')).personnel;
 const staff=(await admin.get('personnel.php?kind=staff')).personnel;
 assert.deepEqual(report.totals,{
  zones:new Set(branches.map(b=>Number(b.zone_id))).size,
  branches:branches.length,students:students.length,teachers:teachers.length,staff:staff.length
 });
 assert.deepEqual(report.student_status,{
  active:students.filter(s=>s.status==='active').length,
  inactive:students.filter(s=>s.status==='inactive').length,
  graduated:students.filter(s=>s.status==='graduated').length
 });
 const currentStudentAttendance=(await admin.get('attendance.php'+query)).attendance;
 const currentTeacherAttendance=(await admin.get('personnel_attendance.php?kind=teacher&date='+day)).attendance;
 const currentStaffAttendance=(await admin.get('personnel_attendance.php?kind=staff&date='+day)).attendance;
 for(const [kind,records] of [['students',currentStudentAttendance],['teachers',currentTeacherAttendance],['staff',currentStaffAttendance]]){
  assert.equal(Object.values(report.attendance[kind]).reduce((a,b)=>a+b,0),records.length);
  for(const status of ['present','absent','late','excused']){
   assert.equal(report.attendance[kind][status],records.filter(r=>r.status===status).length);
  }
 }
 assert.equal(report.branches.length,branches.length);
 for(const b of report.branches){
  assert.equal(b.students,students.filter(s=>Number(s.branch_id)===b.id).length);
  assert.equal(b.teachers,teachers.filter(s=>Number(s.branch_id)===b.id).length);
  assert.equal(b.staff,staff.filter(s=>Number(s.branch_id)===b.id).length);
 }
 const exportResponse=await admin.raw('reports_export.php'+query);
 assert.equal(exportResponse.status,200);
 assert.match(exportResponse.headers.get('content-type'),/text\/csv/);
 assert.match(exportResponse.headers.get('content-disposition'),/attachment/);
 assert.match(exportResponse.headers.get('cache-control'),/no-store/);
 // Fetch's text decoder consumes the UTF-8 BOM; inspect the downloaded bytes.
 const csvBytes=Buffer.from(await exportResponse.arrayBuffer());
 assert.deepEqual([...csvBytes.subarray(0,3)],[0xEF,0xBB,0xBF]);
 const csv=csvBytes.toString('utf8');
 assert.match(csv,/Student attendance recorded,Personnel attendance recorded,Date/);
 assert.equal(csv.trim().split('\n').length,branches.length+1);
 const testCsv=execFileSync('php',['-r',
  "require '"+path.join(__dirname,'../backend/reporting.php').replaceAll('\\','\\\\')+"';echo json_encode(['='=>safeCsvCell('=1+1'),'plus'=>safeCsvCell(' +1'),'at'=>safeCsvCell('@CMD'),'tab'=>safeCsvCell(\"\\t-EXCEL\"),'safe'=>safeCsvCell('School'), 'newline'=>safeCsvCell(\"one\\ntwo\")]);"
 ],{encoding:'utf8'});
 assert.deepEqual(JSON.parse(testCsv),{'=':"'=1+1",plus:"' +1",at:"'@CMD",tab:"' -EXCEL",safe:'School',newline:'one two'});
 for(const [username,mode] of [['test_zone','zone_admin'],['test_branch','branch_admin']]){
  const client=new Client();await client.login(username);
  const scoped=await client.get('reports_summary.php'+query);
  assert.equal(scoped.scope,mode);
  const accessible=(await client.get('branches.php')).branches;
  const allowed=new Set(accessible.map(b=>Number(b.id)));
  assert.equal(scoped.totals.branches,accessible.length);
  assert.ok(scoped.branches.every(b=>allowed.has(b.id)));
  assert.ok(scoped.branches.every(b=>!('full_name' in b)&&!('student_code' in b)));
  const scopedCsv=await client.raw('reports_export.php'+query);
  assert.equal(scopedCsv.status,200);
  const text=await scopedCsv.text();
  assert.equal(text.trim().split('\n').length,accessible.length+1);
  assert.ok(!text.includes('Test Teacher')); // no private records in CSV
 }
 const denied=new Client();await denied.login('test_department');
 await denied.get('reports_summary.php'+query,403);
 await denied.get('reports_export.php'+query,403);
 await admin.raw('logout.php',{method:'POST',headers:{Cookie:admin.cookie,'X-CSRF-Token':admin.csrf}});
 await admin.get('reports_summary.php'+query,401);
 console.log('PASS: report summary totals/status, attendance date, scope isolation, export CSV, formula neutralization and logout');
})().catch(err=>{console.error(err);process.exit(1);});
