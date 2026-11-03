// Disposable CI fixtures only. The diagnostic page itself performs no writes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
if (process.env.LEARN_INTEGRATION_TEST !== '1') throw new Error('Use only with the disposable CI fixture');
const root = path.join(__dirname,'..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(),'learn-setup-check-'));
const script = path.join(sandbox,'check-setup.php');
const config = path.join(sandbox,'backend/config.local.php');
const sourceConfig = path.join(root,'backend/config.local.php');
const env = {...process.env, LEARN_TEST_CONFIG_PATH:sourceConfig};
fs.mkdirSync(path.dirname(config));
fs.copyFileSync(path.join(root,'check-setup.php'),script);
const run = (args = []) => {
  const raw = execFileSync('php',[...args,script],{env,encoding:'utf8'});
  assert.ok(!raw.includes(process.env.MYSQL_TEST_PASSWORD));
  assert.ok(!raw.includes('SENSITIVE_UNEXPECTED_OUTPUT'));
  return JSON.parse(raw);
};
const check = (result,id) => result.checks.find(item => item.id === id);
// Use node:http so the custom Host header is sent unchanged on every Node version.
const untrustedHostStatus = () => new Promise((resolve,reject) => {
  const request = http.get('http://127.0.0.1:8099/check-setup.php',{headers:{Host:'untrusted.example'}},response => {
    response.resume();
    response.on('end',() => resolve(response.statusCode));
    response.on('error',reject);
  });
  request.on('error',reject);
  request.setTimeout(5000,() => request.destroy(new Error('Host check timed out')));
});
const php = code => execFileSync('php',['-r',code],{env,encoding:'utf8'});
const snapshot = () => php(`
  $c=require getenv('LEARN_TEST_CONFIG_PATH');
  $p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname=learn_afghan',$c['username'],$c['password']);
  $counts=[];
  foreach(['zones','branches','departments','users','audit_events','login_attempts','personnel','students','student_attendance','personnel_attendance'] as $t) $counts[$t]=(int)$p->query('SELECT COUNT(*) FROM '.$t)->fetchColumn();
  echo json_encode($counts);
`);
const mutateFixture = sql => execFileSync('php',['-r',`
  if(getenv('LEARN_INTEGRATION_TEST')!=='1') exit(1);
  $c=require getenv('LEARN_TEST_CONFIG_PATH');
  if($c['database']!=='learn_afghan'||$c['password']!==getenv('MYSQL_TEST_PASSWORD')) exit(1);
  $p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname=learn_afghan',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $h=$p->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
  if(!$h||!password_verify('Disposable-test-password-2026',$h)) exit(1);
  $p->exec($argv[1]);
`,'--',sql],{env,encoding:'utf8'});
let temporaryDatabaseCreated = false;
(async () => {
  try {
    const before = snapshot();
    let result = run();
    assert.equal(check(result,'config').status,'fail');
    assert.match(check(result,'config').detail,/Missing backend\/config.local.php/);
    assert.equal(check(result,'connection').status,'waiting');
    fs.writeFileSync(config,'<?php return 123;');
    assert.equal(check(run(),'config').status,'fail');
    fs.writeFileSync(config,'<?php return [');
    assert.equal(check(run(),'config').status,'fail');
    fs.copyFileSync(sourceConfig,config);
    result = run();
    assert.equal(result.ready,true);
    assert.equal(result.checks.length,15);
    assert.ok(result.checks.every(item => item.status === 'pass'));
    const validSource = fs.readFileSync(config,'utf8');
    fs.writeFileSync(config,validSource.replace('<?php',"<?php echo 'SENSITIVE_UNEXPECTED_OUTPUT';"));
    assert.equal(run().ready,true);
    fs.copyFileSync(sourceConfig,config);
    assert.equal(check(run(['-n']),'driver').status,'fail');

    fs.writeFileSync(config,"<?php $c=require getenv('LEARN_TEST_CONFIG_PATH'); $c['port']='invalid'; return $c;");
    assert.equal(check(run(),'config').status,'fail');
    fs.writeFileSync(config,"<?php $c=require getenv('LEARN_TEST_CONFIG_PATH'); $c['database']='learn_setup_absent_ci'; return $c;");
    result = run();
    assert.equal(check(result,'connection').status,'fail');
    assert.match(check(result,'connection').detail,/does not exist/);
    assert.ok(!JSON.stringify(result).includes('learn_setup_absent_ci'));

    mutateFixture('CREATE DATABASE learn_setup_check_ci');
    temporaryDatabaseCreated = true;
    fs.writeFileSync(config,"<?php $c=require getenv('LEARN_TEST_CONFIG_PATH'); $c['database']='learn_setup_check_ci'; return $c;");
    result = run();
    assert.equal(check(result,'connection').status,'pass');
    assert.equal(result.checks.filter(item => item.id.startsWith('table:') && item.status === 'fail').length,10);
    mutateFixture('CREATE TABLE learn_setup_check_ci.users(id INT PRIMARY KEY)');
    result = run();
    assert.match(check(result,'table:users').detail,/Columns missing/);
    assert.equal(check(result,'admin').status,'waiting');
    mutateFixture('DROP TABLE learn_setup_check_ci.users; CREATE TABLE learn_setup_check_ci.users LIKE learn_afghan.users');
    assert.match(check(run(),'admin').detail,/has not been created/);
    mutateFixture("INSERT INTO learn_setup_check_ci.users SELECT * FROM learn_afghan.users WHERE username='test_super'; UPDATE learn_setup_check_ci.users SET active=0");
    assert.match(check(run(),'admin').detail,/none is active/);
    mutateFixture('UPDATE learn_setup_check_ci.users SET active=1');
    assert.equal(check(run(),'admin').status,'pass');
    assert.equal(snapshot(),before);

    const response = await fetch('http://127.0.0.1:8099/check-setup.php');
    assert.equal(response.status,200);
    const html = await response.text();
    assert.ok(html.includes('Basic setup checks passed'));
    assert.ok(!html.includes(process.env.MYSQL_TEST_PASSWORD));
    assert.equal((html.match(/data-status="pass"/g)||[]).length,15);
    assert.equal((await fetch('http://127.0.0.1:8099/check-setup.php',{method:'POST'})).status,405);
    assert.equal(await untrustedHostStatus(),403);
    assert.equal(snapshot(),before);
    console.log('PASS: local setup checks, missing/malformed config, driver failure, connection errors, missing/old schema, admin states, credential redaction and read-only HTTP/CLI behavior');
  } finally {
    if (temporaryDatabaseCreated) mutateFixture('DROP DATABASE learn_setup_check_ci');
    fs.rmSync(sandbox,{recursive:true,force:true});
  }
})().catch(error => {console.error(error);process.exit(1);});
