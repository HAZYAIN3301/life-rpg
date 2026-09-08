import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve('../qa-volume-v5');await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[],external=[];
try{
 const p=await browser.newPage({viewport:{width:1280,height:960}});p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4179')&&!r.url().startsWith('data:'))external.push(r.url())});
 await p.goto('http://127.0.0.1:4179/volume.html');await p.waitForSelector('body[data-ready=true]');
 for(const [patch,name]of [[{pose:0},'rest'],[{pose:.5},'mid'],[{pose:1},'bend'],[{outfit:'long'},'long'],[{outfit:'armor',grip:true},'grip'],[{yaw:90,grip:false},'side'],[{yaw:150,clay:true},'back-clay'],[{yaw:25,clay:false,action:'reach',pose:1},'reach'],[{action:'turn',pose:1},'palm-turn']]){
  await p.evaluate(v=>volumeLab.configure(v),patch);await p.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
 }
 checks.push('9 visual states: rest, mid, full bend, 3 garments, grip, side, back/clay, reach, palm turn');
 let count=0;
 for(const action of ['bend','reach','turn'])for(const outfit of ['short','long','armor'])for(const pose of [0,.5,1]){
  const d=await p.evaluate(v=>volumeLab.configure(v),{action,outfit,pose});assert.ok(d.sharedSkeleton);assert.ok(d.measuredPalmThickness>.08);count++;
 }checks.push(count+' gesture/garment/pose combinations preserve shared rig and palm thickness');
 const before=await p.evaluate(()=>volumeLab.inspect());assert.ok(await p.evaluate(()=>{try{volumeLab.configure({pose:.5,outfit:'missing'});return false}catch{return true}}));assert.deepEqual(await p.evaluate(()=>volumeLab.inspect()),before);checks.push('invalid batch is atomic');
 await p.locator('#pose').focus();await p.keyboard.press('Home');assert.equal((await p.evaluate(()=>volumeLab.inspect())).pose,0);await p.keyboard.press('End');assert.equal((await p.evaluate(()=>volumeLab.inspect())).pose,1);checks.push('keyboard range Home/End');
 await p.locator('#reset').click();await p.locator('#play').click();await p.waitForTimeout(220);await p.locator('#play').click();const paused=(await p.evaluate(()=>volumeLab.inspect())).pose;await p.waitForTimeout(100);assert.equal((await p.evaluate(()=>volumeLab.inspect())).pose,paused);await p.locator('#play').click();await p.waitForFunction(()=>!volumeLab.inspect().playing);assert.equal((await p.evaluate(()=>volumeLab.inspect())).pose,0);checks.push('one shot; exact pause and resume; stops at rest');
 await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#play').click();assert.equal((await p.evaluate(()=>volumeLab.inspect())).playing,false);checks.push('reduced motion stops animation, retains manual pose');
 await p.setViewportSize({width:375,height:812});await p.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(await p.locator('button,select,input[type=range]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width<42).map(e=>e.id)),[]);checks.push('375px: no overflow, touch controls');
 await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('200% text enlargement on 375px');
 const broken=await browser.newPage();await broken.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.startsWith('webgl')?null:old.call(this,t,...a)}});await broken.goto('http://127.0.0.1:4179/volume.html');await broken.waitForSelector('body[data-error=true]');assert.ok(await broken.locator('#play').isDisabled());checks.push('WebGL unavailable: honest error and disabled controls');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,external,scope:'Arm close-up only; not a finished avatar or approval of style'},null,2));console.log(JSON.stringify({checks:checks.length,errors,external}));
}finally{await browser.close()}
