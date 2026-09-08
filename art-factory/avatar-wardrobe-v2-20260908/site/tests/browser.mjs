import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('../qa');await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[],external=[];
const ctx=await browser.newContext({viewport:{width:1280,height:1100}});
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4179')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
await page.goto('http://127.0.0.1:4179/');await page.waitForSelector('body[data-ready=true]');
await page.locator('#pause').click();
checks.push({name:'ready',passed:true});
for(const upper of ['rogue','knight','mage'])for(const lower of ['rogue','knight','mage'])for(const head of ['rogue','knight','mage']){
 await page.locator('[name=upper]').selectOption(upper);await page.locator('[name=lower]').selectOption(lower);await page.locator('[name=head]').selectOption(head);
 const s=await page.evaluate(()=>avatarLab.inspect());
 assert.equal(s.visible.filter(n=>n.endsWith('_Head')).join(),'Rogue_Head','Equipment must preserve identity');
 assert.equal(s.visible.length,6);assert.equal(s.bones,41);assert.ok(s.visibleBounds.min.every(Number.isFinite)&&s.visibleBounds.max.every(Number.isFinite));
}
checks.push({name:'27 clothing mixes preserve head and one shared rig',passed:true});
await page.locator('[name=weapon]').selectOption('sword');assert.equal((await page.evaluate(()=>avatarLab.inspect())).swordParent,'handslotr');
for(const [upper,lower,head,skin,hair,cloth,id] of [
 ['rogue','rogue','rogue','#ffd3b0','#ad6f4f','#7563a1','scout'],
 ['knight','rogue','mage','#c98b63','#302b38','#3c6890','mixed'],
 ['mage','knight','knight','#754f3c','#ddd1ae','#138c6c','armour']]){
 for(const [name,value]of Object.entries({upper,lower,head,skin,hair,cloth}))await page.locator('[name='+name+']').selectOption(value);
 await page.evaluate(()=>avatarLab.sample('Idle',.4));await page.screenshot({path:path.join(dir,id+'.png'),fullPage:true});
}
for(const [motion,camera,time,id] of [
 ['Walking_A','side',.15,'walk-a'],['Walking_A','side',.55,'walk-b'],
 ['1H_Melee_Attack_Slice_Horizontal','front',.3,'sword-mid'],['1H_Melee_Attack_Slice_Horizontal','side',.65,'sword-end'],
 ['Sit_Floor_Idle','front',.5,'sit'],['Cheer','front',.8,'cheer']]){
 await page.locator('[data-camera='+camera+']').click();
 await page.evaluate(([m,t])=>avatarLab.sample(m,t),[motion,time]);const s=await page.evaluate(()=>avatarLab.inspect());
 assert.ok(s.visibleBounds.min.every(Number.isFinite));await page.screenshot({path:path.join(dir,id+'.png'),fullPage:true});
}
checks.push({name:'six deterministic motion/angle samples, sword on authored socket',passed:true});
await page.locator('#save').click();assert.match(await page.locator('#receipt').innerText(),/сохранён/);const saved=(await page.evaluate(()=>avatarLab.inspect())).look;
await page.reload();await page.waitForSelector('body[data-ready=true]');assert.deepEqual((await page.evaluate(()=>avatarLab.inspect())).look,saved);
checks.push({name:'local save readback + reload',passed:true});
await page.locator('[data-motion=Sit_Floor_Idle]').click();assert.equal((await page.evaluate(()=>avatarLab.inspect())).phase,'Sit_Floor_Down');
await page.waitForFunction(()=>avatarLab.inspect().phase==='Sit_Floor_Idle');await page.locator('[data-motion=Idle]').click();
assert.equal((await page.evaluate(()=>avatarLab.inspect())).phase,'Sit_Floor_StandUp');await page.waitForFunction(()=>avatarLab.inspect().phase==='Idle');
checks.push({name:'authored sit-down and stand-up transitions',passed:true});
await page.emulateMedia({reducedMotion:'reduce'});const t=(await page.evaluate(()=>avatarLab.inspect())).mixerTime;
await page.waitForTimeout(250);assert.equal((await page.evaluate(()=>avatarLab.inspect())).mixerTime,t);
checks.push({name:'reduced motion freezes mixer',passed:true});
await page.setViewportSize({width:375,height:812});await page.locator('[data-camera=front]').click();
await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const bad=await page.locator('button,select').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width<42||r.height<42}).map(e=>e.textContent));assert.deepEqual(bad,[]);
checks.push({name:'375px no horizontal overflow; all controls >=42px',passed:true});
await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));
const denied=await browser.newContext();await denied.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}});});
const fail=await denied.newPage();await fail.goto('http://127.0.0.1:4179/');await fail.waitForSelector('body[data-ready=true]');await fail.locator('#save').click();assert.match(await fail.locator('#receipt').innerText(),/не удалось/);
checks.push({name:'storage denied keeps preview, reports failure',passed:true});await denied.close();
const broken=await browser.newContext();const bp=await broken.newPage();await bp.route('**/models/knight.glb',r=>r.fulfill({status:503,body:'Unavailable'}));await bp.goto('http://127.0.0.1:4179/');await bp.waitForSelector('body[data-error=true]');assert.match(await bp.locator('#loading').innerText(),/не загрузился/);assert.equal(await bp.locator('#save').isEnabled(),false);
checks.push({name:'asset 503 is explicit error, never fake avatar/save',passed:true});await broken.close();
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,external,scope:'Synthetic isolated preview, no account; visual acceptance is separate'},null,2));
await browser.close();console.log(JSON.stringify({checks:checks.length,errors,external}));
