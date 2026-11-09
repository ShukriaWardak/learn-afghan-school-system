// Run only after the disposable integration fixtures and API tests.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
if (process.env.LEARN_INTEGRATION_TEST !== '1') throw new Error('Use only with the disposable CI fixture');
const base = 'http://127.0.0.1:8099/';
const password = 'Disposable-test-password-2026';
const waitFor = async predicate => {
  for (let i=0; i<60; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve,100)); }
  throw new Error('Browser condition timed out');
};
const contrast = (foreground, background) => {
  const luminance = color => {
    const values = color.match(/[\d.]+/g).slice(0,3).map(Number).map(value => {
      const channel=value/255; return channel <= 0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4;
    });
    return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
  };
  const a=luminance(foreground), b=luminance(background);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
};
(async () => {
  for (let i=0; i<40; i++) {
    try { await fetch(base+'backend/api/csrf.php'); break; }
    catch { await new Promise(resolve => setTimeout(resolve,250)); }
  }
  const browser = await chromium.launch({headless:true});
  const errors = [];
  const login = async (page, username) => {
    await page.goto(base+'index.html');
    await page.locator('#loginForm').waitFor();
    // The new split login must remain readable, keyboard-friendly and usable.
    await page.getByRole('heading',{name:'Welcome back'}).waitFor();
    assert.equal(await page.locator('#authScreen.auth-login-page').count(),1);
    assert.equal(await page.locator('.login-visual').count(),1);
    assert.equal(await page.locator('.login-panel').count(),1);
    assert.ok(await page.locator('.login-brand').evaluate(async image => {
      try { await image.decode(); return image.naturalWidth > 0; } catch { return false; }
    }), 'Brand logo loads');
    for (const selector of ['.login-panel h1','.login-form label','.login-subtitle','.login-disclaimer','#loginError','#loginUser','#loginPassword']) {
      const colors = await page.locator(selector).first().evaluate(element => ({
        foreground:getComputedStyle(element).color,
        background:getComputedStyle(element.tagName === 'INPUT' ? element : element.closest('.login-panel')).backgroundColor
      }));
      assert.ok(contrast(colors.foreground,colors.background)>=4.5,'Readable contrast for '+selector);
    }
    await page.locator('#loginUser').fill(username);
    await page.locator('#loginPassword').fill(password);
    const visibility = page.locator('#togglePassword');
    await visibility.click();
    assert.equal(await page.locator('#loginPassword').getAttribute('type'),'text');
    assert.equal(await visibility.getAttribute('aria-pressed'),'true');
    await visibility.click();
    assert.equal(await page.locator('#loginPassword').getAttribute('type'),'password');
    await page.locator('#submitLogin').click();
    await page.locator('#authScreen').waitFor({state:'detached'});
  };
  const directory = async page => {
    await page.locator('[data-page="students"]').click();
    await page.locator('#studentsCount').waitFor();
  };
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/backend/api/session.php', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Database is not configured.'})}),{times:1});
    await page.goto(base+'index.html');
    await page.getByRole('heading',{name:'Server setup required'}).waitFor();
    const setupColors = await page.locator('.auth-card h2').evaluate(element => ({foreground:getComputedStyle(element).color,background:getComputedStyle(element.closest('.auth-card')).backgroundColor}));
    assert.ok(contrast(setupColors.foreground,setupColors.background)>=4.5);
    await page.getByRole('link',{name:'Check local setup'}).click();
    await page.getByRole('heading',{name:'Check your setup'}).waitFor();
    assert.equal(await page.locator('[data-status="pass"]').count(),16);
    assert.equal(await page.locator('[data-status="fail"]').count(),0);
    await login(page,'test_super'); await directory(page);
    assert.match(await page.locator('#studentsCount').textContent(), /3 of 3/);
    await page.locator('#studentsSearch').fill('ST_002');
    await page.locator('#studentsStatus').selectOption('inactive');
    await page.locator('#studentsBranch').selectOption('2');
    assert.equal(await page.locator('#studentsTable tbody tr').count(),1);
    await page.locator('#studentsBranch').selectOption('1');
    assert.match(await page.locator('#studentsTable').textContent(), /No students match/);
    await page.locator('#studentsSearch').fill('');
    await page.locator('#studentsStatus').selectOption('all');
    await page.locator('#studentsBranch').selectOption('all');

    let studentPosts = 0;
    page.on('request', request => { if (request.url().endsWith('/student_save.php')) studentPosts++; });
    await page.locator('#studentsAdd').click();
    const dialog = page.locator('dialog');
    await dialog.getByRole('button',{name:'Save to database'}).click();
    assert.equal(studentPosts,0); // Native required-field validation blocks an empty form.
    await dialog.locator('[name="student_code"]').fill('ST_UI_01');
    await dialog.locator('[name="full_name"]').fill('<img src=x onerror="window.studentXss=true">');
    await dialog.locator('[name="grade_level"]').fill('10');
    await dialog.locator('[name="branch_id"]').selectOption('1');
    await dialog.getByRole('button',{name:'Save to database'}).click();
    await dialog.waitFor({state:'detached'});
    await waitFor(async () => /4 of 4/.test(await page.locator('#studentsCount').textContent()));
    assert.equal(await page.locator('#studentsTable img').count(),0);
    assert.equal(await page.evaluate(() => window.studentXss),undefined);
    await page.reload();
    await waitFor(async () => (await page.locator('.environment').textContent()).includes('AUTHENTICATED'));
    await directory(page);
    const row = page.locator('#studentsTable tbody tr').filter({hasText:'ST_UI_01'});
    assert.equal(await row.count(),1);

    await row.getByRole('button',{name:'Edit',exact:true}).click();
    assert.equal(await dialog.locator('[name="student_code"]').count(),0);
    await dialog.locator('[name="grade_level"]').fill('11');
    await dialog.locator('[name="status"]').selectOption('graduated');
    // Simulate another administrator saving after this form was opened.
    const concurrentStatus = await page.evaluate(async () => {
      const row = Students.rows.find(item => item.student_code === 'ST_UI_01');
      const response = await fetch('backend/api/student_save.php', {
        method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':Live.csrf},
        body:JSON.stringify({id:Number(row.id),version:Number(row.version),full_name:'Concurrent Test Student',branch_id:1,grade_level:'12',status:'active'})
      });
      return response.status;
    });
    assert.equal(concurrentStatus,200);
    await dialog.getByRole('button',{name:'Save to database'}).click();
    await waitFor(async () => (await dialog.locator('#studentFormError').textContent()).includes('changed'));
    assert.equal(await dialog.locator('[name="grade_level"]').inputValue(),'11');
    await dialog.locator('#studentReload').click(); await dialog.waitFor({state:'detached'});
    await waitFor(async () => (await page.locator('#studentsTable').textContent()).includes('Concurrent Test Student'));
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    await dialog.locator('[name="full_name"]').fill('Browser Test Student');
    await dialog.locator('[name="grade_level"]').fill('11');
    await dialog.locator('[name="status"]').selectOption('graduated');
    await dialog.getByRole('button',{name:'Save to database'}).click();
    await dialog.waitFor({state:'detached'});
    await waitFor(async () => (await page.locator('#studentsTable').textContent()).includes('Browser Test Student'));
    assert.match(await row.textContent(),/graduated/);
    await row.getByRole('button',{name:'Edit',exact:true}).click();
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'detached'});

    // A refresh after expiry must remove the old directory and show sign-in.
    await page.evaluate(() => fetch('backend/api/logout.php',{method:'POST',headers:{'X-CSRF-Token':Live.csrf}}));
    await page.locator('#studentsRefresh').click(); await page.locator('#loginForm').waitFor();
    assert.equal(await page.evaluate(() => Students.rows.length),0);
    assert.equal(await page.evaluate(() => Students.branches.length),0);
    assert.equal(await page.locator('dialog').count(),0);
    assert.equal(await page.locator('#main').textContent(),'');
    await context.close();

    for (const username of ['test_zone','test_branch','test_department']) {
      const scopedContext = await browser.newContext(); const scopedPage = await scopedContext.newPage();
      scopedPage.on('pageerror', error => errors.push(error.message));
      await login(scopedPage,username);
      await scopedPage.locator('[data-page="students"]').click();
      if (username === 'test_department') {
        await scopedPage.getByText('Your account does not have access to the student directory.').waitFor();
        assert.equal(await scopedPage.locator('#studentsTable').count(),0);
      } else {
        await scopedPage.locator('#studentsCount').waitFor();
        assert.equal(await scopedPage.locator('#studentsAdd').count(),0);
        assert.equal(await scopedPage.locator('[data-student-edit]').count(),0);
        assert.ok(!(await scopedPage.locator('#studentsTable').textContent()).includes('ST_002'));
      }
      await scopedContext.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: setup page, sign-in text contrast, filtering, required fields, escaped names, create/reload/edit, conflict recovery, dialog keyboard access, session expiry and role-limited UI');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exit(1);});
