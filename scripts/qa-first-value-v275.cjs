// Real registration, forms, writes and reopen. Only synthetic localhost accounts.
// NODE_PATH must expose Playwright; start an isolated Satoru server first.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.QA_BASE || 'http://127.0.0.1:51841';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'localhost only');
const out=path.resolve(process.env.QA_OUT || 'work/qa01/final');
const password='Synthetic-QA01-only!';
const run=Date.now().toString(36);
const report={base,run,complete:false,checks:[],errors:[],screenshots:[]};
let browser,active;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await pause(100);}throw Error('readback timeout');}
async function read(page,name){const r=await page.request.get(base+'/api/data/'+name);return r.status()===404?null:await r.json();}
async function later(page){const b=page.locator('[data-action=guide-later]');if(await b.isVisible())await b.click();}
async function shot(page,label){
  await later(page);
  for(const width of [375,1280]){
    await page.setViewportSize({width,height:width===375?812:900});
    await page.locator('.first-value-card').scrollIntoViewIfNeeded();
    await page.evaluate(()=>document.fonts.ready);
    const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(size.scroll<=size.width+1,JSON.stringify({label,...size}));
    const file=label+'-'+width+'.png';await page.screenshot({path:path.join(out,file)});
    report.screenshots.push(file);
  }
}
async function register(locale){
  const context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});
  const page=await context.newPage();active=page;page.setDefaultTimeout(10000);
  page.on('pageerror',e=>report.errors.push({locale,error:e.message}));
  const email='qa01-'+run+'-'+locale+'@example.test';
  await page.goto(base);await page.locator('[data-action=go-register]').first().click();
  const names={ru:'Русский',en:'English',de:'Deutsch',uk:'Українська',es:'Español'};
  await page.getByRole('button',{name:names[locale],exact:false}).click();
  await page.locator('[data-action=registration-language-continue]').click();
  const form=page.locator('#register-form');
  for(const [name,value] of Object.entries({name:'QA '+locale+' '+run,email,password,password2:password}))await form.locator('[name='+name+']').fill(value);
  await form.locator('button[type=submit]').click();await page.locator('#recovery-ok').click();
  await page.locator('[data-action=questionnaire-manual]').waitFor();
  return {page,context,email};
}
async function manual(page,locale){
  await page.locator('[data-action=questionnaire-manual]').click();
  for(const [field,value] of Object.entries({result:'Prepare a short talk',why:'Explain one idea',step:'Write three points',sphere:'Learning'}))await page.locator('[data-questionnaire-manual='+field+']').fill(value);
  await page.locator('[data-action=questionnaire-manual-review]').click();
  const commit=page.locator('[data-action=questionnaire-commit]');
  if(locale==='es'){
    await page.route('**/api/questionnaire/commit',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"qa_unavailable"}'}),{times:1});
    await commit.click();await page.locator('#questionnaire-error').waitFor();
    assert.equal((await read(page,'tasks')).length,0);
    assert.equal((await read(page,'goals'))?.length||0,0);
    report.checks.push('ES: rejected questionnaire write preserves preview and creates no entities');
    await page.route('**/api/questionnaire/commit',async r=>{const response=await r.fetch();assert.equal(response.status(),200);await r.abort('failed');},{times:1});
    await commit.click();await until(async()=>((await read(page,'goals'))||[]).length===1);
    await page.locator('#questionnaire-error').waitFor();
    assert.ok(await page.locator('[data-questionnaire-review=goal-title]').count() || await commit.isVisible());
    report.checks.push('ES: lost response leaves visible retry after server committed');
  }
  await commit.click();await page.locator('.first-value-card[data-first-value-status=first_value_reached]').waitFor();
  assert.equal((await read(page,'goals')).length,1);assert.equal((await read(page,'tasks')).length,1);
  assert.equal((await read(page,'first-value')).evidence.outcomeType,'real_plan_created');
  report.checks.push(locale+': manual goal + task commit, confirmed First Value, no duplicates');
}
async function deferAndChoose(page,route){
  await page.locator('[data-action=questionnaire-defer]').click();await page.locator('.first-value-card').waitFor();
  await shot(page,route+'-empty');
  await page.locator('[data-action=first-value-choose-route][data-route='+route+']').click();
}
async function goalStepLoop(page){
  await page.locator('[data-action=first-value-complete-journey]').click();
  await page.locator('[data-action=toggle-task]').first().click();
  await until(async()=>(await read(page,'tasks'))[0]?.done===true);await later(page);
  await page.reload();await page.locator('[data-action=goto-goal]').first().click();
  await page.getByText('План цели',{exact:true}).click();
  await page.locator('.add-step-form [name=step]').fill('Choose one example');
  await page.locator('.add-step-form button[type=submit]').click();
  await page.locator('[data-action=goal-step-to-day]').first().click();
  await until(async()=>(await read(page,'tasks')).some(t=>t.stepSourceId));
  await page.locator('button[data-action=goal-detail-close]').click();
  await page.locator('[data-action=go-section][data-sec=today]').click();
  const task=(await read(page,'tasks')).find(t=>t.stepSourceId);
  await page.locator('[data-action=toggle-task][data-id="'+task.id+'"]').click();
  await until(async()=>(await read(page,'goals'))[0].steps[0].done===true);
  const before={goals:await read(page,'goals'),tasks:await read(page,'tasks')};
  await page.reload();await page.locator('#main > *').first().waitFor();
  assert.deepEqual({goals:await read(page,'goals'),tasks:await read(page,'tasks')},before);
  await page.locator('[data-action=goto-goal]').first().click();
  await page.locator('#goal-detail-dialog').screenshot({path:path.join(out,'ru-goal-completed.png')});
  report.screenshots.push('ru-goal-completed.png');
  report.checks.push('RU: goal → checklist step → Today quest → completed step; exact goal/task data survives reload');
}
async function reopen(account,locale){
  const before={goals:await read(account.page,'goals'),tasks:await read(account.page,'tasks'),first:await read(account.page,'first-value')};
  await account.context.close();
  const context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});
  const page=await context.newPage();active=page;page.setDefaultTimeout(10000);
  page.on('pageerror',e=>report.errors.push({locale,error:e.message}));
  await page.goto(base);
  await page.locator('#login-form [name=email]').fill(account.email);
  await page.locator('#login-form [name=password]').fill(password);
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('#main > *').first().waitFor();
  assert.deepEqual({goals:await read(page,'goals'),tasks:await read(page,'tasks'),first:await read(page,'first-value')},before);
  assert.ok(!(await page.locator('body').innerText()).includes('30-day'));
  report.checks.push(locale+': new browser context + real password login retains exact goals/tasks/First Value');
  await context.close();
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  browser=await chromium.launch({executablePath:process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    for(const locale of ['ru','en','de','uk','es']){
      const account=await register(locale),page=account.page;
      if(locale==='ru'||locale==='es')await manual(page,locale);
      if(locale==='en'){
        await deferAndChoose(page,'do_now');
        await page.locator('#add-task [name=title]').fill('Write one sentence');await page.locator('#add-task button[type=submit]').click();
        await page.locator('.first-value-card[data-first-value-status=action_ready]').waitFor();
        await page.locator('[data-action=first-value-defer]').click();await page.locator('.first-value-card[data-first-value-status=deferred]').waitFor();
        assert.doesNotMatch(await page.locator('.first-value-card').innerText(),/user_choice|[А-Яа-яЁё]/);
        await shot(page,'en-deferred');await page.locator('[data-action=first-value-resume]').click();
        await page.locator('[data-action=toggle-task]').first().click();await page.locator('.first-value-card[data-first-value-status=first_value_reached]').waitFor();
        assert.equal((await read(page,'first-value')).evidence.outcomeType,'quest_completed');
        report.checks.push('EN: skip setup → first task → pause/resume → persisted completion');
      }
      if(locale==='de'){
        await deferAndChoose(page,'clarify');
        await page.locator('#add-goal [name=title]').fill('Learn a short speech');await page.locator('#add-goal [name=firstStep]').fill('Choose one example');
        await page.locator('#add-goal button[type=submit]').click();await page.locator('button[data-action=goal-detail-close]').click();
        await page.locator('[data-action=go-section][data-sec=today]').click();await page.locator('.first-value-card[data-first-value-status=first_value_reached]').waitFor();
        assert.equal((await read(page,'first-value')).evidence.outcomeType,'next_action_committed');report.checks.push('DE: clarify → goal with first step → persisted result');
      }
      if(locale==='uk'){
        await deferAndChoose(page,'recover');await page.locator('[data-action=first-value-open-primary]').click();
        const form=page.locator('#attention-recovery-form');await form.waitFor();assert.equal(await form.locator('[name=minutes]:checked').inputValue(),'10');
        await page.keyboard.press('Escape');await form.waitFor({state:'hidden'});
        assert.equal(await page.locator('[data-action=first-value-open-primary]').evaluate(e=>e===document.activeElement),true);
        await page.locator('[data-action=first-value-open-primary]').click();await form.locator('button[type=submit]').click();
        await page.locator('.first-value-card[data-first-value-status=first_value_reached]').waitFor();
        assert.equal((await read(page,'first-value')).evidence.outcomeType,'recovery_boundary_started');report.checks.push('UK: recovery launcher, promised 10 minutes, Escape/focus return, durable boundary');
      }
      await shot(page,locale+'-result');
      if(['en','de','es'].includes(locale))assert.doesNotMatch(await page.locator('.first-value-card').innerText(),/[А-Яа-яЁё]/);
      if(locale==='ru')await goalStepLoop(page);
      await reopen(account,locale);console.log('PASS',locale);
    }
    assert.deepEqual(report.errors,[]);report.complete=true;
  }catch(e){report.failure=e.message;console.error(e);if(active&&!active.isClosed())await active.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
  finally{await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(report,null,2));await browser.close();}
})();
