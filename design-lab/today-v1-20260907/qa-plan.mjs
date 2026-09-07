import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report=[],errors=[];
await mkdir(new URL('./qa/',import.meta.url),{recursive:true});
try{
for(const theme of ['light','dark'])for(const width of [375,390,1280,1440]){
 const page=await browser.newPage({viewport:{width,height:width<700?812:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:4179/?view=plan&theme='+theme);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('.preview-settings summary').click();await page.selectOption('#scenario','week');await page.locator('.preview-settings summary').click();
 for(const mode of ['week','day','month','goals']){
   if(mode==='goals')await page.locator('[data-plan-section=goals]').click();else await page.locator('[data-plan-mode='+mode+']').click();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   assert.equal(overflow,false,theme+' '+width+' '+mode);
   assert.ok(await page.locator('#plan-view').isVisible());
   if(width<700){const small=await page.locator('#plan-view button:visible,#plan-view summary:visible').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width<41.5||r.height<41.5;}).map(n=>n.outerHTML.slice(0,150)));assert.deepEqual(small,[]);}
   if(mode!=='goals'){assert.equal(await page.locator('.calendar-tools button:visible').count(),3);if(width<700)assert.equal(await page.locator('.plan-week-strip button:visible').count(),7);}
   await page.screenshot({path:new URL('./qa/plan-'+theme+'-'+width+'-'+mode+'.png',import.meta.url).pathname,fullPage:false});
   report.push({theme,width,mode,overflow});
 }
 // Goal → Today, one task (no duplicate) → completion reflected in goal progress.
 await page.locator('[data-goal-card=film] [data-goal-schedule]').click();
 assert.ok(await page.locator('#today-view').isVisible());assert.equal(await page.locator('[data-task=video]').count(),1);
 await page.locator('[data-task=video] .check').click();
 await page.locator('[data-section="План"]:visible').first().click();
 assert.match(await page.locator('[data-goal-card=film] .goal-progress').innerText(),/1 \/ 3/);
 await page.locator('[data-goal-card=film] [data-goal-schedule]').click();
 assert.equal(await page.locator('.task').count(),6);
 // Full shared editor; date, time, difficulty, multiple primaries and background.
 await page.locator('[data-task="step:film:cut"] .task-title').click();
 await page.locator('#edit-form [name=date]').fill('2026-09-08');
 await page.locator('#edit-form [name=time]').fill('20:10');
 await page.locator('#edit-form [name=difficulty]').selectOption('hard');
 await page.locator('#edit-form .sphere-fields summary').click();
 await page.locator('#edit-form [name=spheres][value="Учёба"]').check();
 await page.locator('#edit-form [name=background][value="Отдых"]').check();
 await page.locator('#edit-form .primary').click();
 assert.equal(await page.locator('[data-task="step:film:cut"]').count(),0);
 await page.locator('[data-section="План"]:visible').first().click();
 await page.locator('[data-plan-section=calendar]').click();
 await page.locator('[data-plan-mode=day]').click();
 await page.locator('[data-plan-day="2026-09-08"]:visible').first().click();
 assert.ok(await page.locator('[data-calendar-task="step:film:cut"]').isVisible());
 const download=page.waitForEvent('download');await page.locator('[data-plan-tool=export]').click();assert.match((await download).suggestedFilename(),/\.ics$/);
 await page.reload();assert.ok(await page.locator('[data-calendar-task="step:film:cut"]').isVisible());
 await page.locator('[data-calendar-task="step:film:cut"] .agenda-title').click();
 assert.equal(await page.locator('#edit-form [name=difficulty]').inputValue(),'hard');
 assert.ok(await page.locator('#edit-form [name=spheres][value="Учёба"]').isChecked());
 assert.ok(await page.locator('#edit-form [name=background][value="Отдых"]').isChecked());
 await page.keyboard.press('Escape');
 // Calendar completion keeps focus on the visible control.
 await page.locator('[data-calendar-task="step:film:cut"] .check').focus();
 await page.keyboard.press('Enter');assert.ok(await page.locator('.completed-agenda').isVisible());
 await page.locator('#undo').click();
 // Exact bulk action and Undo, with no task cascade.
 await page.locator('[data-plan-section=goals]').click();await page.locator('[data-goal-bulk]').click();
 await page.locator('[data-goal-select=film]').check();await page.locator('[data-goal-select=biology]').check();
 await page.locator('[data-goal-bulk-status=archived]').click();assert.equal(await page.locator('.confirm-list li').count(),2);
 await page.locator('#confirm-goal-status').click();await page.locator('[data-goal-filter=archive]').click();
 assert.equal(await page.locator('.goal-card').count(),2);await page.locator('#undo').click();assert.equal(await page.locator('.goal-card').count(),0);
 // Failure is visible in modal top layer, not hidden behind it.
 await page.locator('[data-goal-create]').click();await page.locator('#goal-form [name=title]').fill('Проверка сохранения');await page.locator('#goal-form [name=firstStep]').fill('Открыть план');
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('Хранилище недоступно');};});
 await page.locator('#goal-form .primary').click();
 assert.ok(await page.locator('#dialog #notice.error').isVisible());assert.ok(await page.locator('#goal-form').isVisible());
 await page.close();
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({states:report.length,errors,behavior:'shared tasks / goals / transfer / export / bulk / modal failure passed'}));
}finally{await writeFile(new URL('./qa/plan-report.json',import.meta.url),JSON.stringify({report,errors},null,2));await browser.close();}
