// Real renderers and explicit synthetic fixtures. Never log into a live account.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const dir=new URL('../art-factory/product-polish-20260908/',import.meta.url),pub=new URL('../public/',import.meta.url);
await mkdir(dir,{recursive:true});
const html=(await readFile(new URL('index.html',pub),'utf8')).replace('<head>','<head><script src="/design-comparison-guard.js"></script>').replace('</body>','<script src="/design-comparison-boot.js"></script></body>');
const app=(await readFile(new URL('app.js',pub),'utf8')).replace(/init\(\);\s*$/,'// synthetic boot');
const boot=(await readFile(new URL('design-comparison-boot.js',pub),'utf8')).replace('week-select-day)$','week-select-day|habit-edit|habit-edit-cancel|open-attention-settings|helper-to-settings|go-settings-skills|goto-import|goto-calendar|account-profile-edit|ai-memory-edit|ai-memory-cancel)$');
const base='http://127.0.0.1:4183',report={routes:[],checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 for(const [device,width,height,theme] of [['desktop',1440,1000,'dark'],['mobile',375,812,'light']]){
  const page=await browser.newPage({viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile',reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',dialog=>dialog.dismiss());
  await page.route('**/app.js?*',route=>route.fulfill({body:app,contentType:'text/javascript'}));
  await page.route('**/design-comparison-boot.js',route=>route.fulfill({body:boot,contentType:'text/javascript'}));
  await page.route(base+'/?*',route=>route.fulfill({body:html,contentType:'text/html'}));
  const go=async(view,extra='')=>{await page.goto(base+'/?view='+view+'&theme='+theme+extra);await page.locator('#main > *').first().waitFor();await page.evaluate(()=>document.fonts.ready);};
  const visible=async selector=>{await page.locator(selector).first().waitFor({state:'visible',timeout:5000});};
  const shot=async name=>{await page.screenshot({path:new URL(device+'-'+name+'.png',dir).pathname});};
  for(const route of ['today','calendar','weekly','goals','notes','habits','shelf','rewards','den','character','pets','tree','stats','party','leaderboard','settings']){
   await go(route);
   const inventory=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    headings:[...document.querySelectorAll('#main h2,#main h3,#main summary')].filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()),
    actions:[...document.querySelectorAll('#main button')].filter(e=>e.getClientRects().length).map(e=>({action:e.dataset.action||e.dataset.view||e.dataset.layoutTab,label:(e.innerText||e.getAttribute('aria-label')||'').trim()}))
   }));
   assert.equal(inventory.overflow,false,route+' overflow');
   assert.ok(!inventory.headings.some(h=>/Не удалось открыть раздел|Ошибка отрисовки/.test(h)),route+' render');
   report.routes.push({device,route,...inventory});await shot(route);
  }
  await go('today');
  // Full init keyboard listeners are tested in the isolated authenticated test.
  await page.locator('#today-tab-board').click();await visible('#today-panel-board');
  await page.locator('#today-tab-day').click();await visible('#today-panel-day');
  await page.evaluate(()=>{State.days[todayStr()]={closed:true};render();});
  assert.equal(await page.locator('.today-hero [data-action=focus-task]').count(),0);
  await page.locator('.today-hero [data-action=goto-calendar]').click();
  assert.equal(await page.evaluate(()=>State.calDate===addDays(todayStr(),1)),true);
  await go('today');
  await page.evaluate(()=>{State.settings.path='control';State.tasks.push({id:'overdue-qa',title:'Незавершённое дело',date:addDays(todayStr(),-4),estimateMin:20,difficulty:'normal',skillId:'work',done:false});pathReckoning();render();});
  await visible('.control-review-card');assert.equal(await page.locator('.today-earlier .control-review-card').count(),0);await shot('control-review');
  report.checks.push(device+': Day/Board navigation, closed day routes to tomorrow, Control is visible');
  await go('habits');
  await page.locator('.habit-compact-card > summary').first().click();
  await page.locator('[data-action=habit-edit]').first().click();await visible('#edit-habit-form');
  for(const field of ['title','skillId','estimateMin','difficulty','status'])await visible('#edit-habit-form [name='+field+']');
  assert.equal(await page.locator('#edit-habit-form [name=days]').count(),7);await shot('habit-editor');
  await page.locator('[data-action=habit-edit-cancel]').first().click();
  await page.locator('[data-action=habits-tab][data-tab=break]').click();await page.locator('[data-action=open-attention-settings]').click();
  await visible('.attention-settings-card');
  assert.equal(await page.evaluate(()=>State.settingsSection),'experience');
  report.checks.push(device+': habit schedule/edit/pause + observations → actual attention setup');
  await go('settings');
  assert.equal(await page.locator('.account-profile-settings').isVisible(),true);
  for(const group of ['account','experience','life','connections','progression','data']){
   if(device==='mobile')await page.locator('.settings-purpose-picker').click();
   await page.locator('.settings-hub-item[data-settings-group='+group+']').click();
   await visible('.settings-group[data-settings-group='+group+']');await shot('settings-'+group);
  }
  await page.evaluate(()=>{State.settingsSection='life';State._settingsFocusAfterCommit='.focus-settings-card';render();});await visible('.focus-settings-card');
  assert.equal(await page.locator('[data-settings-group=progression] .focus-settings-card').count(),0);
  await page.evaluate(()=>{State.settingsSection='connections';State._settingsFocusAfterCommit='#profile-text';render();});await visible('#profile-text');
  await page.evaluate(()=>{State.settingsSection='connections';State._settingsFocusAfterCommit='.connections-ai';render();});await visible('.aikey-row');
  report.checks.push(device+': six named settings groups; profile first; focus in planning; exact target opens disclosure');
  await go('rewards');
  await page.locator('[data-layout-tab=history]').click();
  await page.evaluate(()=>{State._rewardsFocusAfterCommit='[data-action=buy-reward]';render();});
  await visible('[data-action=buy-reward]');
  report.checks.push(device+': reward receipt returns to visible item, not a hidden tab');
  await go('goals');
  for(const view of ['all','map','archive','focus']){
   await page.evaluate(view=>{State.goalView=view;render();},view);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await shot('goals-'+view);
  }
  await go('settings','&lang=de');await shot('settings-de');
  await page.close();
 }
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify({routes:report.routes.length,checks:report.checks,errors:report.errors}));
}finally{await writeFile(new URL('ui-receipt.json',dir),JSON.stringify(report,null,2));await browser.close();}
