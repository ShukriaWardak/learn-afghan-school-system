const assert=require('node:assert/strict');
const {chromium}=require('playwright');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Disposable CI fixtures only');
const base='http://127.0.0.1:8099/';
const wait=async(fn)=>{for(let i=0;i<80;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Report UI timed out');};
const signIn=async(page,username)=>{
 await page.goto(base+'index.html');
 await page.locator('#loginForm').waitFor();
 await page.locator('#loginUser').fill(username);
 await page.locator('#loginPassword').fill('Disposable-test-password-2026');
 await page.locator('#submitLogin').click();
 await page.locator('#authScreen').waitFor({state:'detached'});
};
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[];
 try {
  const adminContext=await browser.newContext({acceptDownloads:true});
  const page=await adminContext.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await signIn(page,'test_super');
  await page.locator('[data-page="reports"]').click();
  await page.locator('#reportDate').waitFor();
  await page.locator('#reportDate').fill('2026-03-02');
  await wait(async()=>await page.locator('#reportCount').count()>0);
  assert.match(await page.locator('#main').textContent(),/Reports & Export/);
  assert.match(await page.locator('#main').textContent(),/Recorded attendance/);
  assert.match(await page.locator('#main').textContent(),/Branch summary/);
  assert.ok(await page.locator('#reportDownload').isEnabled());
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#reportDownload').click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'learn-afghan-branch-summary-2026-03-02.csv');
  const body=await page.evaluate(async()=>{
    const r=await fetch('backend/api/reports_summary.php?date=2026-03-02',{cache:'no-store'});
    return await r.json();
  });
  assert.ok(body.totals.students>=3);
  assert.ok(body.branches.length>0);
  await page.locator('#reportDate').fill('2026-03-03');
  await wait(async()=> (await page.locator('#main').textContent()).includes('2026-03-03'));
  await adminContext.close();

  const scopeContext=await browser.newContext();
  const scopePage=await scopeContext.newPage();
  scopePage.on('pageerror',error=>errors.push(error.message));
  await signIn(scopePage,'test_branch');
  await scopePage.locator('[data-page="reports"]').click();
  await scopePage.locator('#reportCount').waitFor();
  assert.equal(await scopePage.locator('#main tbody').last().locator('tr').count(),1);
  const branchReport=await scopePage.evaluate(async()=>{
    const day='2026-03-02';
    const r=await fetch('backend/api/reports_summary.php?date='+day);
    return await r.json();
  });
  assert.equal(branchReport.totals.branches,1);
  assert.ok(branchReport.branches.every(b=>b.id===1));
  await scopeContext.close();

  const departmentContext=await browser.newContext();
  const department=await departmentContext.newPage();
  await signIn(department,'test_department');
  await department.locator('[data-page="reports"]').click();
  assert.match(await department.locator('#main').textContent(),/does not have access/);
  await departmentContext.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: reporting dashboard, date changes, aggregate export, authorized scope and denied account UI');
 }finally {await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
