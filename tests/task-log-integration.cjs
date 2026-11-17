const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Disposable CI fixtures only');
const base='http://127.0.0.1:8099/backend/api/';
// Add only synthetic accounts to the already verified disposable fixture.
execFileSync('php',['-r',`
 $c=require $argv[1];
 if(getenv('LEARN_INTEGRATION_TEST')!=='1'||$c['database']!=='learn_afghan'||$c['password']!==getenv('MYSQL_TEST_PASSWORD'))exit(1);
 $p=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname='.$c['database'],$c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $h=$p->query("SELECT password_hash FROM users WHERE username='test_super'")->fetchColumn();
 if(!$h||!password_verify('Disposable-test-password-2026',$h))exit(1);
 $s=$p->prepare('INSERT INTO users(username,display_name,password_hash,role,branch_id) VALUES(?,?,?, ?,?)');
 foreach([['task_one',1],['task_two',2],['task_three',3]] as [$name,$branch])$s->execute([$name,$name,password_hash('Disposable-test-password-2026',PASSWORD_DEFAULT),'department_user',$branch]);
`,'--',path.join(__dirname,'../backend/config.local.php')]);
class Client{
 cookie='';token='';
 async request(endpoint,body,expected=200,csrf=true){
  const headers={Cookie:this.cookie};if(body!==undefined){headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=this.token;}
  const res=await fetch(base+endpoint,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
  const cookie=res.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
  const text=await res.text();assert.equal(res.status,expected,endpoint+': '+text);return JSON.parse(text);
 }
 async login(username){this.token=(await this.request('csrf.php')).csrf_token;this.token=(await this.request('login.php',{username,password:'Disposable-test-password-2026'})).csrf_token;}
}
(async()=>{
 const anon=new Client();await anon.request('tasks.php',undefined,401);
 const one=new Client(),two=new Client(),three=new Client(),admin=new Client(),zone=new Client(),branch=new Client();
 for(const [c,name]of [[one,'task_one'],[two,'task_two'],[three,'task_three'],[admin,'test_super'],[zone,'test_zone'],[branch,'test_branch']])await c.login(name);
 const body={title:'Synthetic <task>',task_date:'2026-11-17',due_date:'2026-11-18',status:'not_started',description:'شرح آزمایشی',progress_notes:''};
 await one.request('task_save.php',body,403,false);
 const first=(await one.request('task_save.php',{...body,owner_user_id:1},201)).id;
 const second=(await two.request('task_save.php',body,201)).id;
 const third=(await three.request('task_save.php',body,201)).id;
 const ids=async c=>(await c.request('tasks.php')).tasks.map(t=>t.id).sort((a,b)=>a-b);
 assert.deepEqual(await ids(one),[first]);assert.deepEqual(await ids(two),[second]);assert.deepEqual(await ids(branch),[first]);assert.deepEqual(await ids(zone),[first,third]);assert.deepEqual(await ids(admin),[first,second,third]);
 const own=(await one.request('tasks.php')).tasks[0];assert.equal(own.can_edit,true);assert.notEqual(own.owner_user_id,1);
 assert.ok((await admin.request('tasks.php')).tasks.every(t=>!t.can_edit&&!('password_hash'in t)));
 await two.request('task_save.php',{...body,id:first,version:1},404);await admin.request('task_save.php',{...body,id:first,version:1},404);
 await one.request('task_save.php',{...body,id:first,version:1,status:'completed'});
 await one.request('task_save.php',{...body,id:first,version:1},409);
 assert.equal((await one.request('tasks.php')).tasks[0].status,'completed');
 for(const bad of [{task_date:'2026-02-30'},{due_date:'2026-11-16'},{title:''},{status:'deleted'},{progress_notes:42},{description:'x'.repeat(2001)}])await one.request('task_save.php',{...body,...bad},400);
 const events=(await admin.request('audit.php')).events.filter(e=>e.entity_type==='task');assert.equal(events.length,4);
 await one.request('logout.php',{});await one.request('tasks.php',undefined,401);
 console.log('PASS: task persistence, forged owner ignored, CSRF, branch/zone scope, cross-owner denial, stale edits, validation, audit and logout');
})().catch(e=>{console.error(e);process.exit(1)});
