// Only synthetic data. Routes replace init in the test browser, never on the server.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const pub=new URL('../public/',import.meta.url),dir=new URL('../art-factory/design-rollout-20260908/',import.meta.url);
const html=(await readFile(new URL('index.html',pub),'utf8')).replace('<head>','<head><script src="/design-comparison-guard.js"></script>').replace('</body>','<script src="/design-comparison-boot.js"></script></body>');
const app=(await readFile(new URL('app.js',pub),'utf8')).replace(/init\(\);\s*$/,'// Test fixture boot instead of authentication.');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const records=[],errors=[];
await mkdir(dir,{recursive:true});
try{
 for(const [device,width,height,theme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]){
  const page=await browser.newPage({viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile',reducedMotion:'reduce'});
  page.on('dialog',d=>d.dismiss());page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/app.js?*',r=>r.fulfill({body:app,contentType:'text/javascript'}));
  await page.route('http://127.0.0.1:4183/?*',r=>r.fulfill({body:html,contentType:'text/html'}));
  for(const view of ['today','calendar','goals','habits','notes','shelf','rewards','den','character','pets','tree','stats','weekly','party','leaderboard','settings']){
   await page.goto('http://127.0.0.1:4183/?view='+view+'&theme='+theme);
   await page.locator('#main > *').first().waitFor({state:'visible',timeout:15000});
   await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#main img')].filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0}).map(img=>img.decode().catch(()=>{})));});
   const result=await page.evaluate(()=>({view:State.view,overflow:document.documentElement.scrollWidth>innerWidth+1,body:document.querySelector('#main').innerText.slice(0,150),wide:[...document.querySelectorAll('#main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2)}).slice(0,12).map(e=>e.className)}));
   records.push({device,theme,...result});
   await page.screenshot({path:new URL('next-'+device+'-'+view+'.png',dir).pathname});
  }
  await page.close();
 }
 console.log(JSON.stringify({records,errors}));
 assert.deepEqual(errors,[]);
 assert.equal(records.some(r=>r.overflow),false,'No document overflow');
 assert.equal(records.some(r=>/Не удалось открыть раздел|Ошибка отрисовки|Этот раздел не открылся/.test(r.body)),false);
}finally{await writeFile(new URL('next-report.json',dir),JSON.stringify({records,errors},null,2));await browser.close();}
