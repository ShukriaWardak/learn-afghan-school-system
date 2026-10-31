const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
if (process.env.LEARN_INTEGRATION_TEST !== '1') throw new Error('Use only with the disposable CI fixture');
const base = 'http://127.0.0.1:8099/backend/api/';
class Client {
  cookie = ''; token = '';
  async request(endpoint, body, expected = 200, csrf = true) {
    const headers = {Cookie:this.cookie};
    if (body !== undefined) { headers['Content-Type']='application/json'; if (csrf) headers['X-CSRF-Token']=this.token; }
    const response = await fetch(base+endpoint, {method:body === undefined ? 'GET' : 'POST', headers, body:body === undefined ? undefined : JSON.stringify(body)});
    const cookie = response.headers.get('set-cookie'); if (cookie) this.cookie=cookie.split(';')[0];
    const raw = await response.text();
    assert.equal(response.status, expected, `${endpoint}: ${raw}`);
    return JSON.parse(raw);
  }
  async login(username) {
    this.token = (await this.request('csrf.php')).csrf_token;
    this.token = (await this.request('login.php', {username, password:'Disposable-test-password-2026'})).csrf_token;
  }
}
const fault = mode => execFileSync('php', [path.join(__dirname, 'fail-student-audit.php'), mode]);
(async () => {
  const anon = new Client(); await anon.request('students.php', undefined, 401);
  const admin = new Client(); await admin.login('test_super');
  const auditCount = async () => (await admin.request('audit.php')).events.filter(event => event.entity_type === 'student').length;
  const initialAudit = await auditCount();
  const data = {student_code:'ST_001', full_name:'شاگرد آزمایشی', branch_id:1, grade_level:'10', status:'active'};
  await admin.request('student_save.php', data, 403, false);
  const first = (await admin.request('student_save.php', data, 201)).id;
  await admin.request('student_save.php', {...data, student_code:'st_001'}, 409);
  const second = (await admin.request('student_save.php', {...data, student_code:'ST_002', branch_id:2, status:'inactive'}, 201)).id;
  const third = (await admin.request('student_save.php', {...data, student_code:'ST_003', branch_id:3}, 201)).id;
  const update = {...data, id:first, version:1, full_name:'Updated Test Student', status:'graduated'};
  delete update.student_code;
  await admin.request('student_save.php', update);
  await admin.request('student_save.php', {...update, full_name:'Stale change'}, 409);
  for (const invalid of [
    {full_name:''}, {full_name:' '}, {full_name:'x\ny'}, {full_name:'ش'.repeat(181)}, {full_name:42},
    {grade_level:' '}, {grade_level:'g'.repeat(41)}, {status:'deleted'},
    {branch_id:'1'}, {branch_id:0}, {branch_id:999999},
    {student_code:'X'}, {student_code:'X'.repeat(46)}, {student_code:'BAD CODE'}
  ]) await admin.request('student_save.php', {...data, student_code:'BAD_TEST', ...invalid}, 400);
  await admin.request('student_save.php', {...update, version:0}, 400);
  await admin.request('student_save.php', {...update, version:'2'}, 400);
  await admin.request('student_save.php', {...update, id:999999}, 404);
  const all = (await admin.request('students.php')).students;
  assert.equal(all.length, 3);
  assert.equal(all.find(row => Number(row.id) === first).status, 'graduated');
  assert.equal(Number(all.find(row => Number(row.id) === first).version), 2);
  assert.ok(all.every(row => !('password_hash' in row) && !('created_by' in row)));
  for (const [username, ids] of [['test_zone',[first,third]], ['test_branch',[first]]]) {
    const client = new Client(); await client.login(username);
    const scoped = (await client.request('students.php')).students;
    assert.deepEqual(scoped.map(row => Number(row.id)).sort(), [...ids].sort());
    assert.ok(!scoped.some(row => Number(row.id) === second));
    await client.request('student_save.php', {...data, student_code:'DENIED'}, 403);
    await client.request('student_save.php', {...update, id:second, version:1}, 403);
  }
  const denied = new Client(); await denied.login('test_department');
  await denied.request('students.php', undefined, 403);
  await denied.request('student_save.php', data, 403);
  assert.equal(await auditCount(), initialAudit+4);

  // If the audit insert fails, creation AND editing must both roll back completely.
  fault('enable');
  try {
    await admin.request('student_save.php', {...data, student_code:'ROLLBACK_CREATE'}, 500);
    await admin.request('student_save.php', {...update, version:2, full_name:'Must roll back'}, 500);
    assert.deepEqual((await admin.request('students.php')).students, all);
    assert.equal(await auditCount(), initialAudit+4);
  } finally { fault('disable'); }
  await admin.request('student_save.php', {...update, version:2, branch_id:2});
  assert.equal(await auditCount(), initialAudit+5);
  const branch = new Client(); await branch.login('test_branch');
  assert.equal((await branch.request('students.php')).students.length, 0);
  const freshSession = new Client(); await freshSession.login('test_super');
  const persisted = (await freshSession.request('students.php')).students.find(row => Number(row.id) === first);
  assert.equal(persisted.branch_id, 2); assert.equal(persisted.version, 3);
  await admin.request('logout.php', {});
  await admin.request('students.php', undefined, 401);
  console.log('PASS: student persistence, validation, CSRF, zone/branch scopes, reassignment, stale edits, transactional audit rollback and logout');
})().catch(error => { console.error(error); process.exit(1); });
