// Run only against the disposable integration fixture.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawnSync,execFileSync}=require('node:child_process');
if(process.env.LEARN_INTEGRATION_TEST!=='1') throw new Error('Use only with the disposable CI fixture');
const root=path.join(__dirname,'..');
const env={...process.env,LEARN_TEST_CONFIG_PATH:path.join(root,'backend/config.local.php')};
delete env.LEARN_RESET_USERNAME;delete env.LEARN_RESET_PASSWORD;
const oldPassword='Disposable-reset-old-2026';
const newPassword='Disposable-reset-new-2026';
const php=code=>execFileSync('php',['-r',`
  if(getenv('LEARN_INTEGRATION_TEST')!=='1') exit(1);
  $c=require getenv('LEARN_TEST_CONFIG_PATH');
  if($c['database']!=='learn_afghan'||$c['password']!==getenv('MYSQL_TEST_PASSWORD')) exit(1);
  $p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname=learn_afghan',$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
  $h=$p->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
  if(!$h||!password_verify('Disposable-test-password-2026',$h)) exit(1);
  ${code}
`],{env,encoding:'utf8'});
const run=(username,password,args=[])=>{
  const childEnv={...env};
  if(username!==undefined)childEnv.LEARN_RESET_USERNAME=username;
  if(password!==undefined)childEnv.LEARN_RESET_PASSWORD=password;
  const r=spawnSync('php',[path.join(root,'reset-local-login.php'),...args],{env:childEnv,encoding:'utf8'});
  if(r.error)throw r.error;
  for(const secret of [oldPassword,newPassword,env.MYSQL_TEST_PASSWORD,password].filter(Boolean)) assert.ok(!(r.stdout+r.stderr).includes(secret),'No credentials in command output');
  return r;
};
const snapshot=()=>php(`echo json_encode($p->query("SELECT * FROM users ORDER BY id")->fetchAll());`);
let cookie='';let token='';
const request=async(route,body)=>{
  const headers={Cookie:cookie};
  if(body!==undefined){headers['Content-Type']='application/json';headers['X-CSRF-Token']=token;}
  const r=await fetch('http://127.0.0.1:8099/backend/api/'+route,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
  const setCookie=r.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
  return {status:r.status,body:await r.json()};
};
(async()=>{
  php(`$s=$p->prepare("INSERT INTO users(username,display_name,password_hash,role,branch_id,active) VALUES(?,?,?,'branch_admin',1,?)");
    foreach(['reset_one'=>1,'reset_other'=>1,'reset_inactive'=>0] as $name=>$active) $s->execute([$name,$name,password_hash('${oldPassword}',PASSWORD_DEFAULT),$active]);`);
  const before=snapshot();
  const list=run(undefined,undefined,['--list']);
  assert.equal(list.status,0);assert.match(list.stdout,/reset_one.*branch_admin.*active/);
  assert.match(list.stdout,/reset_inactive.*inactive/);assert.ok(!list.stdout.includes('$2y$'));
  assert.equal(run().status,1);
  assert.equal(run('reset_one','short').status,1);
  assert.equal(run('reset_one','x'.repeat(73)).status,1);
  assert.match(run('no_such_user',newPassword).stderr,/No account matches/);
  assert.match(run("' OR 1=1 --",newPassword).stderr,/No account matches/);
  assert.match(run('reset_inactive',newPassword).stderr,/inactive/);
  assert.equal(snapshot(),before);
  assert.equal((await fetch('http://127.0.0.1:8099/reset-local-login.php')).status,404);
  assert.equal((await fetch('http://127.0.0.1:8099/reset-local-login.php',{method:'POST'})).status,404);
  assert.equal(snapshot(),before);
  const success=run('reset_one',newPassword);
  assert.equal(success.status,0,success.stderr);assert.match(success.stdout,/Password reset for the selected account/);
  const after=JSON.parse(snapshot());const original=JSON.parse(before);
  for(let i=0;i<original.length;i++){
    if(original[i].username==='reset_one'){
      assert.notEqual(after[i].password_hash,original[i].password_hash);
      assert.deepEqual({...after[i],password_hash:original[i].password_hash},original[i]);
    }else assert.deepEqual(after[i],original[i]);
  }
  assert.equal(php(`$s=$p->prepare("SELECT password_hash FROM users WHERE username='reset_one'");$s->execute();$h=$s->fetchColumn();echo json_encode([password_verify('${newPassword}',$h),password_verify('${oldPassword}',$h)]);`),'[true,false]');
  const events=JSON.parse(php(`echo json_encode($p->query("SELECT actor_user_id,details_json FROM audit_events WHERE action='password_reset_local_cli'")->fetchAll());`));
  assert.equal(events.length,1);assert.equal(events[0].actor_user_id,null);assert.deepEqual(JSON.parse(events[0].details_json),{source:'local_cli'});
  const committed=snapshot();
  php(`$p->exec("CREATE TRIGGER reset_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Disposable audit failure'");`);
  try{assert.equal(run('reset_one','Disposable-not-applied-2026').status,1);assert.equal(snapshot(),committed);}
  finally{php(`$p->exec('DROP TRIGGER reset_audit_failure');`);}
  token=(await request('csrf.php')).body.csrf_token;
  assert.equal((await request('login.php',{username:'reset_one',password:oldPassword})).status,401);
  const loggedIn=await request('login.php',{username:'reset_one',password:newPassword});
  assert.equal(loggedIn.status,200);assert.equal(loggedIn.body.user.role,'branch_admin');assert.equal(Number(loggedIn.body.user.branch_id),1);
  assert.ok(!('password_hash' in loggedIn.body.user));
  token=loggedIn.body.csrf_token;assert.equal((await request('logout.php',{})).status,200);
  console.log('PASS: CLI account listing, targeted password recovery, old-password rejection/new-password sign-in, unchanged scopes/accounts, inactive/missing-account refusal, HTTP denial, credential redaction and audit rollback');
})().catch(error=>{console.error(error);process.exit(1);});
