const assert=require('node:assert/strict');
const {chromium}=require('playwright');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Disposable CI fixtures only');
const base='http://127.0.0.1:8099/';
const wait=async(check)=>{for(let i=0;i<80;i++){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw new Error('Approvals UI timed out');};
const login=async(page,username)=>{
  await page.goto(base+'index.html');await page.locator('#loginForm').waitFor();
  await page.locator('#loginUser').fill(username);await page.locator('#loginPassword').fill('Disposable-test-password-2026');
  await page.locator('#submitLogin').click();await page.locator('#authScreen').waitFor({state:'detached'});
};
const create=async(page,code,name)=>page.evaluate(async({code,name})=>{
  const response=await fetch('backend/api/branch_create.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':Live.csrf},body:JSON.stringify({code,name,zone_id:1,location:'Browser fixture'})});
  if(response.status!==201)throw new Error('Could not create browser fixture');
  const data=await response.json();await Live.refresh();return Number(data.id);
},{code,name});
(async()=>{
  const browser=await chromium.launch({headless:true}),errors=[];
  try{
    const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await login(page,'test_super');
    const id=await create(page,'REVIEW_UI_01','<img src=x onerror="window.reviewXss=true">');
    await page.locator('[data-page="approvals"]').click();await page.locator('#approvalsCount').waitFor();
    await page.locator('#approvalsSearch').fill('REVIEW_UI_01');assert.equal(await page.locator('#approvalsTable tbody tr').count(),1);
    assert.equal(await page.locator('#approvalsTable img').count(),0);assert.equal(await page.evaluate(()=>window.reviewXss),undefined);
    let posts=0;page.on('request',request=>{if(request.url().endsWith('/approval_decide.php'))posts++;});
    await page.locator('#approvalsTable').getByRole('button',{name:'Reject',exact:true}).click();
    const dialog=page.locator('dialog');await dialog.getByRole('button',{name:'Confirm rejection'}).click();assert.equal(posts,0);
    await dialog.locator('[name="note"]').fill('Keep my review note');
    assert.equal(await page.evaluate(async id=>{
      const r=await fetch('backend/api/branch_update.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':Live.csrf},body:JSON.stringify({id,name:'Updated Review Branch',zone_id:1,location:'Browser fixture',status:'pending'})});return r.status;
    },id),200);
    await dialog.getByRole('button',{name:'Confirm rejection'}).click();
    await wait(async()=>(await dialog.locator('#approvalError').textContent()).includes('changed'));
    assert.equal(await dialog.locator('[name="note"]').inputValue(),'Keep my review note');
    assert.ok(await dialog.getByRole('button',{name:'Confirm rejection'}).isDisabled());
    await dialog.locator('#approvalReload').click();await dialog.waitFor({state:'detached'});
    await wait(async()=>(await page.locator('#approvalsTable').textContent()).includes('Updated Review Branch'));
    await page.locator('#approvalsTable').getByRole('button',{name:'Approve',exact:true}).click();
    await dialog.locator('[name="note"]').fill('Ready <script>safe note</script>');
    await dialog.getByRole('button',{name:'Confirm approval'}).click();await dialog.waitFor({state:'detached'});
    await wait(async()=>(await page.locator('#approvalsTable').textContent()).includes('No pending branches match'));
    assert.match(await page.locator('#main').textContent(),/Ready <script>safe note<\/script>/);
    assert.equal(await page.locator('#main script').count(),0);
    await page.locator('[data-page="branches"]').click();
    const branch=page.locator('#branchTable tbody tr').filter({hasText:'REVIEW_UI_01'});
    assert.match(await branch.textContent(),/Active/);assert.match(await branch.textContent(),/Updated Review Branch/);
    await page.reload();await page.locator('[data-page="approvals"]').click();await page.locator('#approvalsCount').waitFor();
    assert.match(await page.locator('#main').textContent(),/REVIEW_UI_01/);
    await create(page,'REVIEW_UI_02','Browser rejected branch');await page.locator('#approvalsRefresh').click();await page.locator('#approvalsCount').waitFor();
    await page.locator('#approvalsSearch').fill('REVIEW_UI_02');
    await page.locator('#approvalsTable').getByRole('button',{name:'Reject',exact:true}).click();
    await dialog.locator('[name="note"]').fill('نیاز به تکمیل اطلاعات\nبررسی دوباره');
    await dialog.getByRole('button',{name:'Confirm rejection'}).click();await dialog.waitFor({state:'detached'});
    await wait(async()=>(await page.locator('#main').textContent()).includes('نیاز به تکمیل اطلاعات'));
    assert.match(await page.locator('#main').textContent(),/نیاز به تکمیل اطلاعات\nبررسی دوباره/);
    assert.match(await page.locator('#main').textContent(),/Rejected/);
    await create(page,'REVIEW_UI_03','Browser expired review');await page.locator('#approvalsRefresh').click();await page.locator('#approvalsCount').waitFor();
    await page.locator('#approvalsSearch').fill('REVIEW_UI_03');await page.locator('#approvalsTable').getByRole('button',{name:'Approve',exact:true}).click();
    await page.evaluate(async()=>{
      await fetch('backend/api/logout.php',{method:'POST',headers:{'X-CSRF-Token':Live.csrf}});
      await Approvals.load();
    });
    await page.locator('#loginForm').waitFor();assert.equal(await page.locator('dialog').count(),0);
    assert.equal(await page.evaluate(()=>Approvals.rows.length),0);assert.equal(await page.evaluate(()=>Approvals.decisions.length),0);
    await context.close();
    for(const username of ['test_zone','test_branch','test_department']){
      const limited=await browser.newContext(),limitedPage=await limited.newPage();limitedPage.on('pageerror',error=>errors.push(error.message));
      await login(limitedPage,username);await limitedPage.locator('[data-page="approvals"]').click();
      assert.match(await limitedPage.locator('#main').textContent(),/does not have access/);
      assert.equal(await limitedPage.locator('[data-approval-id]').count(),0);await limited.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: approval queue/search, escaped branch names/notes, required rejection reason, stale-form recovery, approve/reject persistence, branch status refresh, session cleanup and denied-role UI');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
