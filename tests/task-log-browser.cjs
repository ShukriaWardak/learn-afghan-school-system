// Browser behavior uses synthetic API responses; real permissions are covered by the integration suite.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.LEARN_CHROMIUM_PATH?{executablePath:process.env.LEARN_CHROMIUM_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const rows=[];let uid=1;
  await page.route('**/backend/api/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);let body={};
   if(name==='session.php')body={authenticated:true,user:{id:uid,username:'synthetic',display_name:'Synthetic Tester',role:'super_admin'},csrf_token:'synthetic-token'};
   else if(name==='zones.php')body={zones:[]};else if(name==='branches.php')body={branches:[]};
   else if(name==='tasks.php')body={tasks:rows,has_more:false};
   else if(name==='task_save.php'){
    const data=route.request().postDataJSON();assert.equal(route.request().headers()['x-csrf-token'],'synthetic-token');
    if(data.id)Object.assign(rows.find(r=>r.id===data.id),data,{version:2});
    else rows.push({...data,id:1,version:1,owner_name:'Synthetic Tester',branch_name:null,can_edit:true});
    body={saved:true,id:1};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('http://127.0.0.1:8099/index.html');
  await page.waitForFunction(()=>document.querySelector('.environment')?.textContent.includes('AUTHENTICATED')); 
  await page.locator('[data-page="tasks"]').click();
  await page.locator('#taskAdd').click();await page.locator('[name=title]').fill('<script>synthetic</script>');
  await page.locator('[name=description]').fill('شرح آزمایشی');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await page.locator('[data-task-edit="1"]').waitFor();
  assert.ok((await page.locator('#main').innerText()).includes('<script>synthetic</script>'));
  assert.equal(await page.locator('#main script').count(),0);
  await page.locator('[data-task-edit="1"]').click();await page.locator('[name=status]').selectOption('completed');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  await page.locator('#taskModal').waitFor({state:'detached'});
  await page.locator('#taskStatus').selectOption('not_started');assert.equal(await page.locator('[data-task-row]:visible').count(),0);
  await page.locator('#taskStatus').selectOption('completed');assert.equal(await page.locator('[data-task-row]:visible').count(),1);
  await page.locator('#taskAdd').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#taskModal').count(),0);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#taskAdd').click();assert.ok(await page.getByRole('button',{name:'Save task',exact:true}).isVisible());
  await page.keyboard.press('Escape');await page.reload();
  // Refresh keeps the server's task; no localStorage is used for task persistence.
  await page.locator('#menu').click();await page.locator('[data-page="tasks"]').click();
  await page.locator('[data-task-edit="1"]').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: task navigation, form create/edit, escaped Unicode content, status filtering, keyboard close, mobile form and reload');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
