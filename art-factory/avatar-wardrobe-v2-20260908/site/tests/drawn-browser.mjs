import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('../qa-drawn');await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[],external=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:1060}});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4179')&&!r.url().startsWith('data:'))external.push(r.url())});
 await page.goto('http://127.0.0.1:4179/drawn.html');await page.waitForSelector('body[data-ready=true]');
 assert.equal((await page.evaluate(()=>drawnLab.inspect())).productionWrites,0);
 for(const [pose,cloth,name]of [[0,'original','idle'],[.5,'original','mid'],[1,'original','elbow'],[1,'plum','plum']]){
  await page.evaluate(v=>drawnLab.configure(v),{pose,cloth,original:true});await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
 }
 checks.push('four visual samples: idle / mid / max elbow / alternate cloth');
 await page.locator('#pose').focus();await page.keyboard.press('Home');assert.equal((await page.evaluate(()=>drawnLab.inspect())).pose,0);await page.keyboard.press('End');assert.equal((await page.evaluate(()=>drawnLab.inspect())).pose,1);
 checks.push('keyboard slider Home/End shares pose state');
 const before=await page.evaluate(()=>drawnLab.inspect());assert.equal(await page.evaluate(()=>{try{drawnLab.configure({pose:.5,cloth:'missing'});return false}catch{return true}}),true);assert.deepEqual(await page.evaluate(()=>drawnLab.inspect()),before);
 checks.push('invalid batched change is atomic');
 await page.locator('#play').click();await page.waitForTimeout(180);assert.equal((await page.evaluate(()=>drawnLab.inspect())).playing,true);await page.locator('#play').click();const paused=(await page.evaluate(()=>drawnLab.inspect())).pose;await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>drawnLab.inspect())).pose,paused);
 checks.push('animation runs; pause freezes exactly');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#play').click();assert.equal((await page.evaluate(()=>drawnLab.inspect())).playing,false);await page.locator('#reset').click();assert.equal((await page.evaluate(()=>drawnLab.inspect())).pose,0);
 checks.push('reduced motion prevents autoplay; manual slider still available');
 await page.setViewportSize({width:375,height:812});await page.evaluate(()=>drawnLab.configure({pose:1,cloth:'plum'}));await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(await page.locator('button,select,input[type=range]').evaluateAll(es=>es.filter(e=>!e.closest('[hidden]')&&e.getBoundingClientRect().width<42).map(e=>e.id)),[]);
 checks.push('375px: no horizontal overflow and usable controls');
 await page.setViewportSize({width:1280,height:1060});await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('200% root text enlargement: no page overflow');
 const broken=await browser.newPage();await broken.route('**/images/drawn/traveller-original.png',r=>r.fulfill({status:503,body:'unavailable'}));await broken.goto('http://127.0.0.1:4179/drawn.html');await broken.waitForSelector('body[data-error=true]');assert.equal(await broken.locator('#play').isDisabled(),true);assert.match(await broken.locator('#loading').innerText(),/Не удалось/);checks.push('missing original: explicit load failure, disabled controls');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,external,scope:'Isolated synthetic drawing experiment; no production integration; technical checks do not establish visual acceptance'},null,2));console.log(JSON.stringify({checks:checks.length,errors,external}));
}finally{await browser.close()}
