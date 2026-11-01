const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const context = {
  Live: {active: true, csrf: 'session-a', user: {id: 1, role: 'super_admin'}},
  current: 'students', render() {},
  escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char])),
  heading: (title, description, actions = '') => title + description + actions,
  panel: (title, body) => title + body,
  localStorage: new Proxy({}, {get() { throw new Error('Student records must not use browser storage'); }})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../students.js'), 'utf8')+'\nglobalThis.students = Students;', context);
const students = context.students;
const rows = [
  {id:1, student_code:'TEST_01', full_name:'<script>student</script>', branch_id:1, branch_name:'North', grade_level:'10', status:'active', version:1},
  {id:2, student_code:'TEST_02', full_name:'شاگرد آزمایشی', branch_id:'2', branch_name:'South', grade_level:'11', status:'inactive', version:1},
  {id:3, student_code:'TEST_03', full_name:'Graduate', branch_id:1, branch_name:'North', grade_level:'12', status:'graduated', version:2}
];
const branches = [{id:1, name:'<North>'}, {id:2, name:'South'}];
const fixtureRequest = async endpoint => endpoint === 'students.php' ? {students: rows, limit: 1000} : {branches};
(async () => {
  context.Live.request = fixtureRequest;
  await students.load();
  assert.equal(students.filteredRows().length, 3);
  students.search = '  شاگرد  '; assert.equal(students.filteredRows()[0].id, 2);
  students.search = '11'; assert.equal(students.filteredRows()[0].id, 2);
  students.branch = '1'; assert.equal(students.filteredRows().length, 0);
  students.search = ''; students.status = 'graduated'; assert.equal(students.filteredRows()[0].id, 3);
  students.status = 'all'; students.branch = 'all';
  const html = students.view();
  assert.ok(html.includes('&lt;script&gt;student&lt;/script&gt;'));
  assert.ok(!html.includes('<script>student</script>'));
  assert.ok(html.includes('&lt;North&gt;'));
  assert.ok(html.includes('studentsAdd') && html.includes('data-student-edit'));
  assert.ok(html.includes('3 of 3 loaded students') && html.includes('Up to 1000'));
  for (const role of ['zone_admin', 'branch_admin']) {
    context.Live.user.role = role;
    assert.equal(students.canRead(), true);
    assert.equal(students.canWrite(), false);
    assert.ok(!students.view().includes('studentsAdd'));
    assert.ok(!students.table().includes('data-student-edit'));
  }
  context.Live.user.role = 'department_user';
  assert.equal(students.canRead(), false);
  assert.ok(!students.view().includes('TEST_01'));
  context.Live.user.role = 'super_admin';
  context.Live.request = async () => { throw new Error('Service unavailable'); };
  await students.load();
  assert.equal(students.rows.length, 0);
  assert.ok(students.view().includes('Service unavailable') && students.view().includes('studentsRefresh'));
  context.Live.request = async () => ({});
  await students.load();
  assert.ok(students.error.includes('Invalid student directory response'));
  context.Live.request = fixtureRequest; await students.load();
  assert.equal(students.error, ''); assert.equal(students.rows.length, 3);

  // An old session's delayed response must never replace a new account's directory.
  let finishOld;
  context.Live.request = endpoint => endpoint === 'students.php' ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve({branches});
  const oldLoad = students.load();
  students.reset(); context.Live.user = {id:2, role:'branch_admin'}; context.Live.csrf = 'session-b';
  context.Live.request = async endpoint => endpoint === 'students.php' ? {students:[rows[1]], limit:1000} : {branches:[branches[1]]};
  await students.load(); finishOld({students:rows, limit:1000}); await oldLoad;
  assert.equal(students.rows.length, 1); assert.equal(students.rows[0].id, 2);

  let closeCalled = false;
  students.dialog = {close() {closeCalled = true;}};
  students.reset();
  assert.equal(closeCalled, true); assert.equal(students.rows.length, 0); assert.equal(students.branches.length, 0);
  context.Live.showLogin = () => { context.Live.active = false; students.reset(); };
  context.Live.request = async () => { throw Object.assign(new Error('Session expired'), {status:401}); };
  await students.load();
  assert.equal(context.Live.active, false); assert.equal(students.rows.length, 0);
  assert.equal(students.loading, false);
  console.log('PASS: student filters, Unicode/HTML escaping, role gates, retry, invalid responses, session reset and delayed-response isolation');
})().catch(error => { console.error(error); process.exit(1); });
