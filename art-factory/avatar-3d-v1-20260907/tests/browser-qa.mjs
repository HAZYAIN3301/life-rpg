import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createPreviewServer} from '../serve.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'qa-output');await mkdir(out,{recursive:true});
const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
const evidence={};
try {
  await page.goto(url);await page.waitForFunction(()=>window.__avatarLab?.ready);
  await page.getByRole('button',{name:'Приостановить',exact:true}).click();
  evidence.initial=await page.evaluate(()=>window.__avatarLab.state());
  await page.screenshot({path:path.join(out,'desktop-idle.png'),fullPage:true});
  for(const pose of ['walk','sit','pet']) {
    await page.locator('[data-pose="'+pose+'"]').click();
    await page.screenshot({path:path.join(out,'desktop-'+pose+'.png'),fullPage:true});
  }
  await page.locator('[data-look=hair]').selectOption('ponytail');await page.locator('[data-look=top]').selectOption('field-vest');
  await page.locator('[data-look=bottom]').selectOption('ranger');await page.locator('[data-look=cloth]').selectOption('plum');
  await page.locator('[data-pose=idle]').click();
  await page.screenshot({path:path.join(out,'desktop-variant.png'),fullPage:true});
  const saved=await page.evaluate(()=>window.__avatarLab.state().look);
  await page.reload();await page.waitForFunction(()=>window.__avatarLab?.ready);assert.deepEqual(await page.evaluate(()=>window.__avatarLab.state().look),saved);
  await page.getByRole('button',{name:'Приостановить',exact:true}).click();
  await page.locator('#stress').click();evidence.stress=await page.evaluate(()=>{const r=window.__avatarLab.lastStress;return{count:r.length,failures:r.filter(x=>!x.ok)};});
  assert.equal(evidence.stress.count,256);assert.deepEqual(evidence.stress.failures,[]);
  evidence.roundtrip=await page.evaluate(()=>window.__avatarLab.roundtrip());assert.deepEqual(evidence.roundtrip.errors,[]);assert.ok(evidence.roundtrip.bytes>10000);
  assert.deepEqual(evidence.roundtrip.clips,['idle','walk','sit','pet']);
  for(const sample of evidence.roundtrip.samples){assert.deepEqual(sample.errors,[]);assert.ok(sample.footHeights.every(y=>y>=-.0005));if(sample.contactError!==null)assert.ok(sample.contactError<.005);}
  await page.locator('.lab-diagnostics summary').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;
  const glbPath=path.join(out,'satoru-avatar-engineering-pilot.glb');await download.saveAs(glbPath);
  await page.locator('#import').setInputFiles(glbPath);await page.waitForFunction(()=>document.querySelector('#save-status').textContent.startsWith('GLB прошёл'));
  assert.deepEqual(await page.evaluate(()=>window.__avatarLab.state().look),saved);
  await page.locator('[data-pose=walk]').click();await page.locator('#camera').selectOption('side');
  await page.screenshot({path:path.join(out,'imported-walk-side.png'),fullPage:true});
  await page.locator('#camera').selectOption('front');await page.locator('.lab-diagnostics summary').click();
  await page.locator('#stage').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  const movingTime=await page.evaluate(()=>window.__avatarLab.state().elapsed);
  await page.waitForFunction(t=>window.__avatarLab.state().elapsed>t+.04,movingTime);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__avatarLab.state().reduced&&!window.__avatarLab.state().animating);
  const time=await page.evaluate(()=>window.__avatarLab.state().elapsed);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__avatarLab.state().elapsed),time);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>window.__avatarLab.state().animating);
  await page.getByRole('button',{name:'Приостановить',exact:true}).click();
  const pausedTime=await page.evaluate(()=>window.__avatarLab.state().elapsed);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__avatarLab.state().elapsed),pausedTime);
  evidence.motion={playbackAdvances:true,reducedMotionStops:true,resumesAfterPreferenceChange:true,pauseStops:true};
  await page.locator('#import').setInputFiles({name:'invalid.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('not a GLB')});
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent.startsWith('GLB не прошёл'));
  assert.deepEqual(await page.evaluate(()=>window.__avatarLab.state().look),saved);
  assert.deepEqual(await page.evaluate(()=>window.__avatarLab.state().metrics.errors),[]);
  evidence.invalidImportPreservesRig=true;
  for(const width of [375,360]) {
    await page.setViewportSize({width,height:812});await page.screenshot({path:path.join(out,'mobile-'+width+'.png'),fullPage:true});
    evidence['mobile'+width]=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('button,select,summary')].filter(e=>e.getClientRects().length&&!e.closest('details:not([open])')).filter(e=>{const r=e.getBoundingClientRect();return r.width<42||r.height<42;}).map(e=>e.textContent)}));
    assert.equal(evidence['mobile'+width].overflow,false);assert.deepEqual(evidence['mobile'+width].small,[]);
  }
  // Only the factory prefix persists, and the preview server cannot expose user data.
  evidence.storage=await page.evaluate(()=>Object.keys(localStorage));assert.deepEqual(evidence.storage,['satoru:factory:avatar-3d-pilot:look:v1']);
  for(const p of ['/data/users.json','/.git/config','/package.json','/vendor/../../../server.js'])assert.equal((await page.request.get(url+p)).status(),404);
  evidence.errors=errors;evidence.external=external;assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.error=String(error.stack||error);process.exitCode=1;}
finally{await writeFile(path.join(out,'browser-report.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
