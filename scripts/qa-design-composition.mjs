// Interaction receipts for the real renderers; synthetic data and localhost only.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const pub=new URL('../public/',import.meta.url),dir=new URL(process.env.SATORU_QA_OUTPUT || '../art-factory/design-deep-20260908/',import.meta.url);
const html=(await readFile(new URL('index.html',pub),'utf8')).replace('<head>','<head><script src="/design-comparison-guard.js"></script>').replace('</body>','<script src="/design-comparison-boot.js"></script></body>');
const app=(await readFile(new URL('app.js',pub),'utf8')).replace(/init\(\);\s*$/,'// Synthetic boot');
// Extend only the test browser's navigation allowlist. Frozen archive is unchanged;
// every fetch and every Store write remains denied by its guard.
const boot=(await readFile(new URL('design-comparison-boot.js',pub),'utf8')).replace('week-select-day)$','week-select-day|goals-toggle-bulk|inspiration-import-guide-open|inspiration-setup-manual|cal-focus-add)$');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.route('**/app.js?*',r=>r.fulfill({body:app,contentType:'text/javascript'}));
 await page.route('**/design-comparison-boot.js',r=>r.fulfill({body:boot,contentType:'text/javascript'}));
 await page.route('http://127.0.0.1:4183/?*',r=>r.fulfill({body:html,contentType:'text/html'}));
 const go=async view=>{await page.goto('http://127.0.0.1:4183/?view='+view+'&theme=light');await page.locator('#main > *').first().waitFor();};
 const visible=async selector=>{await page.locator(selector).first().waitFor({state:'visible',timeout:8000});assert.equal(await page.locator(selector).first().isVisible(),true,selector);};
 await go('today');
 for(const s of ['.task .task-schedule','.task .task-duration','.task [data-action=edit-actual]','.day-recap-direct','#add-task input[name=startTime]','.today-lair','.task-context .t-cats'])await visible(s);
 assert.equal(await page.locator('.today-week button').count(),7);
 await page.locator('#add-task [name=title]').fill('Keep this draft');
 await page.evaluate(()=>render());assert.equal(await page.locator('#add-task [name=title]').inputValue(),'Keep this draft');
 checks.push('Today: direct schedule/duration/actual/voice, seven days, context, lair and draft across repaint');
 await go('rewards');
 assert.equal(await page.locator('#main [data-action=open-chest]').count(),1);
 await page.locator('[data-layout-tab=collection]').click();await visible('#workspace-rewards-collection');
 await page.evaluate(()=>render());await visible('#workspace-rewards-collection');
 assert.equal(await page.locator('#workspace-rewards-shop').isVisible(),false);
 await page.locator('[data-layout-tab=collection]').focus();await page.keyboard.press('ArrowRight');await visible('#workspace-rewards-achievements');
 await page.evaluate(()=>InterfaceCompositionV1.reveal(document.querySelector('[data-guide-target=reward-buy]')));await visible('[data-guide-target=reward-buy]');
 checks.push('Rewards: single claim, collection survives repaint, arrow keys, guide reveals hidden target');
 await go('goals');
 await visible('.goals-direct-tools [data-action=goals-toggle-bulk]');await visible('.goals-direct-tools [data-action=ai-import-goals]');
 await page.locator('.goals-direct-tools [data-action=goals-toggle-bulk]').click();
 await visible('.goals-bulk-toolbar');await visible('[data-action=goals-bulk-delete]');
 checks.push('Goals: bulk and import direct; bulk toolbar reachable');
 await go('notes');
 await visible('.notes-workspace #capture-form');await visible('.notes-gallery .note-text');
 await go('pets');
 const pet=page.locator('.pet-card').filter({has:page.locator('summary > .pet-art')}).first();
 assert.ok(await pet.count());await pet.evaluate(el=>el.open=false);await visible('.pet-card:not([open]) > summary > .pet-art');
 assert.equal(await page.locator('.pets-shell .comp-card').count(),0);
 checks.push('Notes compose/read workspace; closed pet still shows original interactive art; no duplicated Shadow');
 await go('settings');
 for(const group of ['account','experience','life','connections','progression','data']){
   const button=page.locator('.settings-purpose-rail [data-settings-group="'+group+'"]');
   assert.equal(await button.count(),1,group+' settings entry');
   await button.click();await visible('.settings-purpose-content > [data-settings-group="'+group+'"]');
 }
 checks.push('Settings purpose rail opens existing groups');
 await go('shelf');
 await visible('.inspiration-import-choice');
 await page.locator('.inspiration-import-choice > summary').click();await visible('[data-action=inspiration-import-guide-open]');
 await page.locator('[data-action=inspiration-setup-manual]').click();await visible('.inspiration-profile-workspace');
 await page.screenshot({path:new URL('nested-inspiration-setup.png',dir).pathname});
 checks.push('Inspiration: source choice first, TikTok methods disclose, full profile editor remains usable');
 await go('calendar');
 const tools=await page.locator('.cal-tools>button').evaluateAll(es=>es.map(e=>({y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})));
 assert.ok(Math.max(...tools.map(e=>e.y))-Math.min(...tools.map(e=>e.y))<2,'calendar tools share a row');
 await page.locator('[data-action=cal-focus-add]').first().click();await visible('#add-task [name=startTime]');await visible('.calendar-add-options[open]');
 await page.screenshot({path:new URL('nested-calendar-create.png',dir).pathname});
 checks.push('Calendar: tools in a row, create exposes time and options');
 await go('stats');
 for(const button of await page.locator('.workspace-tab').all()){await button.click();assert.equal(await page.locator('.workspace-panel:visible').count(),1);}
 checks.push('Progress: one selected panel with all original content reachable');
 await go('party');
 await page.evaluate(()=>{
   State.party={name:'Test expedition',code:'ABCDE',ws:weekStart(todayStr()),max:6,season:0,permissions:{role:'member'},
     raid:{total:300,target:1000,won:false,iClaimed:false,claimedCount:0},
     members:[{id:'comparison-only',name:'Алекс · пример',me:true,shared:true,weekXp:300,weekQuests:4,avatar:'🌙'}]};
   render();
 });
 await visible('.party-team-workspace');
 await visible('[data-action=open-party-leave]');
 await page.screenshot({path:new URL('nested-party-active.png',dir).pathname});
 await go('leaderboard');
 await page.evaluate(()=>{State.leaderboard={rows:[{id:'comparison-only',name:'Алекс · пример',me:true,totalXp:1200,level:7,rank:'',avatar:'🌙'}]};render();});
 await visible('.leaderboard-workspace .lb-row');
 await visible('[data-action=set-leaderboard-consent]');
 await page.screenshot({path:new URL('nested-leaderboard-filled.png',dir).pathname});
 checks.push('Populated party and ranking: team actions and separate privacy consent preserved; no actual publication');
 await go('calendar');
 await page.locator('[data-action=cal-mode][data-mode=month]').click();
 await visible('.calendar-month-shell');
 await page.screenshot({path:new URL('nested-month.png',dir).pathname});
 checks.push('Month view still reachable through the real mode switch');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks,errors}));
} finally {await writeFile(new URL('composition-receipt.json',dir),JSON.stringify({checks,errors},null,2));await browser.close();}
