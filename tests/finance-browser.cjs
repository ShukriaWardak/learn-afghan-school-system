// Real browser checks with synthetic, disposable integration fixtures only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
if(process.env.LEARN_INTEGRATION_TEST!=='1')throw new Error('Disposable CI fixtures only');
const base='http://127.0.0.1:8099/';
const fixture=sql=>execFileSync('php',['-r','$p=require $argv[1];$p->exec($argv[2]);','--',path.join(__dirname,'finance-test-db.php'),sql],{encoding:'utf8'});
const ready=page=>page.waitForFunction(()=>Finance.data!==null && !Finance.loading);
const contrast=(foreground,background)=>{
  const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
};
const login=async(page,username)=>{
  await page.goto(base+'index.html');await page.locator('#loginForm').waitFor();
  await page.locator('#loginUser').fill(username);await page.locator('#loginPassword').fill('Disposable-test-password-2026');
  await page.locator('#submitLogin').click();await page.locator('#authScreen').waitFor({state:'detached'});
};
const filter=async(page,search,branch='all')=>{
  const form=page.locator('#financeFilters');await form.locator('[name="search"]').fill(search);
  await form.locator('[name="branch"]').selectOption(branch);await form.getByRole('button',{name:'Apply filters',exact:true}).click();await ready(page);
};
(async()=>{
  const browser=await chromium.launch({headless:true});const errors=[];
  try{
    const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await login(page,'test_finance_1');await ready(page);
    assert.equal(await page.locator('#nav [data-page]').count(),1);
    assert.equal(await page.locator('#nav [data-page="finance"]').count(),1);
    assert.match(await page.locator('#main').textContent(),/Active finance accounts: 5/);
    const headingColors=await page.locator('.finance-page .page-top h1').evaluate(element=>({color:getComputedStyle(element).color,background:getComputedStyle(document.body).backgroundColor}));
    assert.ok(contrast(headingColors.color,headingColors.background)>=4.5,'Finance heading stays readable in the light dashboard');
    const cellColors=await page.locator('#financeTable tbody td').first().evaluate(element=>({color:getComputedStyle(element).color,background:getComputedStyle(element.closest('.panel')).backgroundColor}));
    assert.ok(contrast(cellColors.color,cellColors.background)>=4.5,'Finance records stay readable on the white panel');
    await page.evaluate(()=>go('users'));await ready(page);assert.equal(await page.evaluate(()=>current),'finance');
    let posts=0;page.on('request',request=>{if(request.url().endsWith('/finance_save.php'))posts++;});
    await page.locator('#financeAdd').click();const dialog=page.locator('dialog.finance-modal');
    for(const selector of ['.form-grid label','#financeFormError']){
      const colors=await dialog.locator(selector).first().evaluate(element=>({color:getComputedStyle(element).color,background:getComputedStyle(element.closest('dialog')).backgroundColor}));
      assert.ok(contrast(colors.color,colors.background)>=4.5,'Readable finance label/error contrast');
    }
    await dialog.getByRole('button',{name:'Save finance record',exact:true}).click();assert.equal(posts,0);
    await dialog.locator('[name="entry_date"]').fill('2026-06-15');
    await dialog.locator('[name="amount"]').fill('10.001');
    await dialog.locator('[name="counterparty"]').fill('<img src=x onerror="window.financeXss=true">');
    await dialog.locator('[name="branch_id"]').selectOption('1');
    await dialog.locator('[name="receipt_reference"]').fill('BROWSER_FINANCE_01');
    await dialog.locator('[name="description"]').fill('نمونهٔ آزمایشی\n<script>literal text</script>');
    await dialog.locator('[name="notes"]').fill('یادداشت آزمایشی <note>');
    await dialog.getByRole('button',{name:'Save finance record',exact:true}).click();assert.equal(posts,0);
    await dialog.locator('[name="amount"]').fill('10.05');
    if(process.env.LEARN_FINANCE_SCREENSHOT)await page.screenshot({path:process.env.LEARN_FINANCE_SCREENSHOT,fullPage:true});
    await dialog.getByRole('button',{name:'Save finance record',exact:true}).click();await dialog.waitFor({state:'detached'});await ready(page);
    await filter(page,'BROWSER_FINANCE_01');
    let row=page.locator('#financeTable tbody tr');assert.equal(await row.count(),1);assert.match(await row.textContent(),/10.05 AFN/);
    assert.equal(await page.locator('#financeTable img,#financeTable script').count(),0);assert.equal(await page.evaluate(()=>window.financeXss),undefined);
    assert.match(await row.textContent(),/یادداشت آزمایشی <note>/);assert.match(await row.textContent(),/Created by Disposable Finance 1/);
    await page.reload();await ready(page);await filter(page,'BROWSER_FINANCE_01');row=page.locator('#financeTable tbody tr');
    assert.match(await row.textContent(),/10.05 AFN/);
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    await dialog.locator('[name="entry_type"]').selectOption('income');await dialog.locator('[name="category"]').selectOption('donation');
    await dialog.locator('[name="branch_id"]').selectOption('');await dialog.locator('[name="amount"]').fill('22.30');
    const beforeReason=posts;await dialog.getByRole('button',{name:'Save finance record',exact:true}).click();assert.equal(posts,beforeReason);
    await dialog.locator('[name="correction_reason"]').fill('Synthetic correction after review');
    await dialog.getByRole('button',{name:'Save finance record',exact:true}).click();await dialog.waitFor({state:'detached'});await ready(page);
    assert.match(await row.textContent(),/22.30 AFN/);assert.match(await row.textContent(),/Central office/);
    assert.match(await page.locator('.finance-metrics').textContent(),/22.30 AFN/);
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    await dialog.locator('[name="amount"]').fill('25.00');await dialog.locator('[name="correction_reason"]').fill('Preserve this typed reason');
    assert.equal(await page.evaluate(async()=>{
      const record=Finance.data.entries[0];const r=await fetch('backend/api/finance_save.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':Live.csrf},body:JSON.stringify({...record,amount:'30.00',correction_reason:'Concurrent synthetic edit'})});return r.status;
    }),200);
    await dialog.getByRole('button',{name:'Save finance record',exact:true}).click();
    await dialog.locator('#financeReload').waitFor({state:'visible'});assert.match(await dialog.locator('#financeFormError').textContent(),/changed/);
    assert.equal(await dialog.locator('[name="amount"]').inputValue(),'25.00');assert.equal(await dialog.locator('[name="correction_reason"]').inputValue(),'Preserve this typed reason');
    assert.ok(await dialog.getByRole('button',{name:'Save finance record',exact:true}).isDisabled());
    await dialog.locator('#financeReload').click();await dialog.waitFor({state:'detached'});await ready(page);assert.match(await row.textContent(),/30.00 AFN/);
    await filter(page,'BROWSER_FINANCE_01','1');assert.match(await page.locator('#main').textContent(),/No finance records match/);
    await filter(page,'BROWSER_FINANCE_01','central');assert.equal(await page.locator('#financeTable tbody tr').count(),1);
    await filter(page,'PAGINATION_TEST');assert.equal(await page.locator('#financeTable tbody tr').count(),50);
    await page.locator('#financeNext').click();await page.waitForFunction(()=>Finance.data?.page===2);assert.equal(await page.locator('#financeTable tbody tr').count(),5);
    await page.locator('#financePrevious').click();await page.waitForFunction(()=>Finance.data?.page===1);
    await filter(page,'BROWSER_FINANCE_01');await page.locator('#financeTable').getByRole('button',{name:'Edit',exact:true}).click();
    const navigation=await page.evaluate(()=>{go('finance');return {dialogs:document.querySelectorAll('dialog.finance-modal').length,data:Finance.data};});
    assert.deepEqual(navigation,{dialogs:0,data:null});await ready(page);
    await filter(page,'BROWSER_FINANCE_01');await page.locator('#financeTable').getByRole('button',{name:'Edit',exact:true}).click();
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.locator('#financeTable').getByRole('button',{name:'Edit',exact:true}).click();
    const expired=await page.evaluate(async()=>{
      await fetch('backend/api/logout.php',{method:'POST',headers:{'X-CSRF-Token':Live.csrf}});await Finance.load();
      return {login:Boolean(document.querySelector('#loginForm')),dialogs:document.querySelectorAll('dialog').length,data:Finance.data};
    });assert.deepEqual(expired,{login:true,dialogs:0,data:null});
    assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('BROWSER_FINANCE_01'));await context.close();
    const readonly=await browser.newContext(),admin=await readonly.newPage();admin.on('pageerror',error=>errors.push(error.message));
    await login(admin,'test_super');await admin.locator('[data-page="finance"]').click();await ready(admin);
    assert.equal(await admin.locator('#financeAdd,[data-finance-edit]').count(),0);assert.match(await admin.locator('#main').textContent(),/read only/);
    await admin.locator('[data-page="overview"]').click();
    assert.match(await admin.locator('.ref-data-note').textContent(),/4,545.*81.*25/);
    await admin.locator('[data-page="finance"]').click();await ready(admin);
    assert.equal(await admin.locator('#financeAdd,[data-finance-edit]').count(),0);await readonly.close();
    const mobile=await browser.newContext({viewport:{width:390,height:844}}),phone=await mobile.newPage();
    phone.on('pageerror',error=>errors.push(error.message));
    await login(phone,'test_finance_2');await ready(phone);
    assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Finance page fits the phone viewport');
    await phone.locator('#financeAdd').click();const phoneDialog=phone.locator('dialog.finance-modal');
    const fit=await phoneDialog.evaluate(element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,content:element.scrollWidth,client:element.clientWidth};});
    assert.ok(fit.left>=0&&fit.right<=fit.width&&fit.content<=fit.client,'Finance dialog fits without horizontal overflow');
    await phoneDialog.locator('[name="notes"]').fill('Synthetic mobile note');
    await phoneDialog.getByRole('button',{name:'Cancel',exact:true}).click();await phoneDialog.waitFor({state:'detached'});
    await phone.locator('#menu').click();await phone.locator('#nav [data-page="finance"]').click();await ready(phone);
    assert.equal(await phone.locator('#sidebar').evaluate(element=>element.classList.contains('open')),false);
    await mobile.close();
    fixture("UPDATE users SET branch_id=1 WHERE username='test_finance_3'");
    try{
      const restricted=await browser.newContext(),limited=await restricted.newPage();limited.on('pageerror',error=>errors.push(error.message));
      await login(limited,'test_finance_3');await ready(limited);await limited.locator('#financeAdd').click();
      const branchSelect=limited.locator('dialog [name="branch_id"]');
      assert.equal(await branchSelect.locator('option[value=""]').count(),0);assert.equal(await branchSelect.locator('option').count(),1);assert.equal(await branchSelect.inputValue(),'1');
      await limited.keyboard.press('Escape');await restricted.close();
    }finally{fixture("UPDATE users SET branch_id=NULL WHERE username='test_finance_3'");}
    for(const username of ['test_branch','test_department']){
      const denied=await browser.newContext(),limited=await denied.newPage();limited.on('pageerror',error=>errors.push(error.message));
      await login(limited,username);await limited.locator('[data-page="finance"]').click();await limited.getByText('Your account does not have access to finance records.',{exact:true}).waitFor();
      assert.equal(await limited.locator('#financeTable,#financeAdd').count(),0);await denied.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: Finance landing/navigation, light-dashboard contrast, mobile page/dialog fit, preserved reference totals, form validation, exact AFN display, escaped text, create/reload/edit, required correction reasons, stale-edit recovery, branch filters, pagination, keyboard dialogs, immediate session cleanup and read-only/scoped/denied role UI');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
