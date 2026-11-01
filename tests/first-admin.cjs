// This test creates only its own disposable CI database.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync,spawn,execFileSync}=require('node:child_process');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Disposable CI fixture required');
const root=path.join(__dirname,'..');
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'learn-first-admin-'));
const config=path.join(sandbox,'config.php');
const source=path.join(root,'backend/config.local.php');
const password='Disposable-first-admin-2026';
const env={...process.env,LEARN_TEST_CONFIG_PATH:source,LEARN_FIRST_ADMIN_CONFIG:config,
  LEARN_FIRST_ADMIN_USERNAME:'test_created_super',LEARN_FIRST_ADMIN_NAME:'Test Created Super',LEARN_FIRST_ADMIN_PASSWORD:password};
const prelude=`
  if(getenv('LEARN_INTEGRATION_TEST')!=='1')exit(1);
  $c=require getenv('LEARN_TEST_CONFIG_PATH');
  if($c['database']!=='learn_afghan'||$c['password']!==getenv('MYSQL_TEST_PASSWORD'))exit(1);
  $p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname=learn_afghan',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  $h=$p->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
  if(!$h||!password_verify('Disposable-test-password-2026',$h))exit(1);
`;
const php=code=>execFileSync('php',['-r',prelude+code],{env,encoding:'utf8'});
const safeOutput=r=>{
  assert.ok(!(r.stdout+r.stderr).includes(password));assert.ok(!(r.stdout+r.stderr).includes(env.MYSQL_TEST_PASSWORD));
  assert.ok(!(r.stdout+r.stderr).includes('$2y$'));return r;
};
const run=extra=>{
  const r=spawnSync('php',[path.join(root,'backend/cli/first_admin.php')],{env:{...env,...extra},encoding:'utf8'});
  if(r.error)throw r.error;return safeOutput(r);
};
const state=()=>php(`echo json_encode([$p->query('SELECT * FROM learn_first_admin_ci.users ORDER BY id')->fetchAll(),$p->query('SELECT * FROM learn_first_admin_ci.audit_events ORDER BY id')->fetchAll()]);`);
const concurrent=extra=>new Promise((resolve,reject)=>{
  const child=spawn('php',[path.join(root,'backend/cli/first_admin.php')],{env:{...env,...extra}});
  let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
  child.on('error',reject);child.on('close',status=>resolve(safeOutput({status,stdout,stderr})));
});
let created=false;let copied=false;
(async()=>{
  try {
    php(`$p->exec('CREATE DATABASE learn_first_admin_ci');`);created=true;
    php(`foreach(['users','audit_events'] as $t)$p->exec('CREATE TABLE learn_first_admin_ci.'.$t.' LIKE learn_afghan.'.$t);
      $c['database']='learn_first_admin_ci';file_put_contents(getenv('LEARN_FIRST_ADMIN_CONFIG'),'<?php return '.var_export($c,true).';');`);
    const empty=state();
    assert.equal(run({LEARN_FIRST_ADMIN_PASSWORD:'short'}).status,1);
    assert.equal(run({LEARN_FIRST_ADMIN_CONFIG:path.join(sandbox,'absent.php')}).status,1);
    assert.equal(state(),empty);
    php(`$p->exec("CREATE TRIGGER learn_first_admin_ci.first_admin_audit_failure BEFORE INSERT ON learn_first_admin_ci.audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Disposable audit failure'");`);
    try {assert.equal(run().status,1);assert.equal(state(),empty);}
    finally {php(`$p->exec('DROP TRIGGER learn_first_admin_ci.first_admin_audit_failure');`);}
    let result=run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/First super administrator created/);
    let [users,events]=JSON.parse(state());assert.equal(users.length,1);assert.equal(events.length,1);
    assert.equal(users[0].role,'super_admin');assert.equal(Number(users[0].active),1);assert.equal(users[0].zone_id,null);assert.equal(users[0].branch_id,null);
    assert.equal(events[0].actor_user_id,null);assert.equal(events[0].action,'first_admin_created_cli');
    assert.deepEqual(JSON.parse(events[0].details_json),{source:'local_cli'});
    assert.equal(php(`$h=$p->query('SELECT password_hash FROM learn_first_admin_ci.users')->fetchColumn();echo password_verify(getenv('LEARN_FIRST_ADMIN_PASSWORD'),$h)?'valid':'invalid';`),'valid');
    const before=state();result=run();assert.equal(result.status,0);assert.match(result.stdout,/already ready/);assert.equal(state(),before);
    assert.equal(run({LEARN_FIRST_ADMIN_PASSWORD:'Different-disposable-pass-2026'}).status,1);assert.equal(state(),before);
    assert.equal(run({LEARN_FIRST_ADMIN_USERNAME:'test_another_super'}).status,1);assert.equal(state(),before);
    php(`$p->exec('UPDATE learn_first_admin_ci.users SET active=0');`);const inactive=state();assert.equal(run().status,1);assert.equal(state(),inactive);
    php(`$p->exec('UPDATE learn_first_admin_ci.users SET active=1');`);
    // Use the created hash against the real app's login endpoint, then remove the copy.
    php(`$p->exec('INSERT INTO learn_afghan.users(username,display_name,password_hash,role,active) SELECT username,display_name,password_hash,role,active FROM learn_first_admin_ci.users');`);copied=true;
    const csrfResponse=await fetch('http://127.0.0.1:8099/backend/api/csrf.php');
    const cookie=csrfResponse.headers.get('set-cookie').split(';')[0];const csrf=(await csrfResponse.json()).csrf_token;
    const login=await fetch('http://127.0.0.1:8099/backend/api/login.php',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({username:env.LEARN_FIRST_ADMIN_USERNAME,password})});
    assert.equal(login.status,200);const data=await login.json();assert.equal(data.user.role,'super_admin');assert.ok(!('password_hash' in data.user));
    const signedCookie=login.headers.get('set-cookie').split(';')[0];
    const logout=await fetch('http://127.0.0.1:8099/backend/api/logout.php',{method:'POST',headers:{Cookie:signedCookie,'Content-Type':'application/json','X-CSRF-Token':data.csrf_token},body:'{}'});assert.equal(logout.status,200);
    php(`$p->exec("DELETE FROM learn_afghan.users WHERE username='test_created_super'");`);copied=false;
    php(`$p->exec('DELETE FROM learn_first_admin_ci.audit_events');$p->exec('DELETE FROM learn_first_admin_ci.users');
      $s=$p->prepare("INSERT INTO learn_first_admin_ci.users(username,display_name,password_hash,role) VALUES(?,?,?,'branch_admin')");$s->execute([getenv('LEARN_FIRST_ADMIN_USERNAME'),'Test existing branch admin',password_hash(getenv('LEARN_FIRST_ADMIN_PASSWORD'),PASSWORD_DEFAULT)]);`);
    const scoped=state();assert.equal(run().status,1);assert.equal(state(),scoped);
    php(`$p->exec('DELETE FROM learn_first_admin_ci.users');`);
    const results=await Promise.all([concurrent(),concurrent({LEARN_FIRST_ADMIN_USERNAME:'test_parallel_super'})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[0,1]);
    [users,events]=JSON.parse(state());assert.equal(users.length,1);assert.equal(events.length,1);
    assert.equal((await fetch('http://127.0.0.1:8099/backend/cli/first_admin.php')).status,404);
    console.log('PASS: first-admin creation and real super-admin login, hashed credentials, existing-account guards, idempotent reruns, inactive/scoped-account refusal, audited rollback, concurrent enrollment and HTTP denial');
  } finally {
    if(copied)php(`$p->exec("DELETE FROM learn_afghan.users WHERE username='test_created_super'");`);
    if(created)php(`$p->exec('DROP DATABASE learn_first_admin_ci');`);
    fs.rmSync(sandbox,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
