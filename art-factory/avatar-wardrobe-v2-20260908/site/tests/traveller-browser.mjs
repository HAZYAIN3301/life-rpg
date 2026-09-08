import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const dir='../qa-traveller-v6';await fs.mkdir(dir,{recursive:true});
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[],external=[];
try{
 const p=await b.newPage({viewport:{width:1440,height:1000}});
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4179')&&!r.url().startsWith('data:'))external.push(r.url())});
 await p.goto('http://127.0.0.1:4179/traveller.html');await p.waitForSelector('body[data-ready=true]');
 for(const[patch,name]of [[{yaw:0},'front'],[{yaw:35},'three-quarter'],[{yaw:90},'side'],[{yaw:180},'back'],[{yaw:35,pose:.5},'mid'],[{pose:1},'reach'],[{outfit:'jacket'},'jacket'],[{clay:true},'clay']]){
  await p.evaluate(v=>travellerLab.configure(v),patch);await p.screenshot({path:dir+'/'+name+'.png',fullPage:true});
 }
 checks.push('8 visual states saved: front, three-quarter, side, back, mid, reach, jacket, clay');
 const baseline=await p.evaluate(()=>travellerLab.inspect());
 assert.ok(await p.evaluate(()=>{try{travellerLab.configure({pose:0,outfit:'bad'});return false}catch{return true}}));
 assert.deepEqual(await p.evaluate(()=>travellerLab.inspect()),baseline);checks.push('invalid batch refused without partial mutation');
 await p.locator('#pose').focus();await p.keyboard.press('Home');assert.equal((await p.evaluate(()=>travellerLab.inspect())).pose,0);await p.keyboard.press('End');assert.equal((await p.evaluate(()=>travellerLab.inspect())).pose,1);
 await p.locator('[data-yaw="90"]').click();assert.equal((await p.evaluate(()=>travellerLab.inspect())).yaw,90);
 await p.locator('#outfit').selectOption('traveller');assert.equal((await p.evaluate(()=>travellerLab.inspect())).outfit,'traveller');checks.push('actual controls: keyboard pose, view button and garment selection');
 await p.locator('#reset').click();await p.locator('#play').click();await p.waitForTimeout(300);await p.locator('#play').click();
 const paused=(await p.evaluate(()=>travellerLab.inspect())).pose;assert.ok(paused>0);await p.waitForTimeout(120);assert.equal((await p.evaluate(()=>travellerLab.inspect())).pose,paused);
 await p.locator('#play').click();await p.waitForFunction(()=>!travellerLab.inspect().playing);assert.equal((await p.evaluate(()=>travellerLab.inspect())).pose,0);checks.push('finite movement, exact pause/resume, terminal rest');
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#play').click();assert.equal((await p.evaluate(()=>travellerLab.inspect())).playing,false);assert.equal((await p.evaluate(()=>travellerLab.inspect())).pose,1);checks.push('reduced motion retains a static result and manual pose');
 await p.setViewportSize({width:375,height:812});await p.screenshot({path:dir+'/mobile.png',fullPage:true});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(await p.locator('button,select,input').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width<42||r.height<42}).map(e=>e.id)),[]);checks.push('375px: no overflow, 42px touch floor');
 await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('200% text enlargement at fixed 375px');
 const broken=await b.newPage();await broken.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.startsWith('webgl')?null:old.call(this,t,...a)}});
 await broken.goto('http://127.0.0.1:4179/traveller.html');await broken.waitForSelector('body[data-error=true]');assert.ok(await broken.locator('#play').isDisabled());checks.push('WebGL unavailable: visible error and no actionable empty state');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile(dir+'/receipt.json',JSON.stringify({at:new Date().toISOString(),checks,errors,external,scope:'Fullbody prototype only; visual/anatomical quality remains unapproved; no production/account writes'},null,2));
 console.log(JSON.stringify({checks:checks.length,errors,external}));
}finally{await b.close()}
