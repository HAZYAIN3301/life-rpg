import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const dir=new URL('../art-factory/design-rollout-20260908/',import.meta.url);
await mkdir(dir,{recursive:true});
const records=[],errors=[],network=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('dialog',d=>d.dismiss());
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push(r.url());});
 for(const view of ['today','calendar','goals','habits','notes','shelf','rewards','den','character','pets','tree','stats','weekly','party','leaderboard','settings']){
  await page.goto('http://127.0.0.1:4183/compare.html?view='+view);
  const frame=page.frameLocator('iframe');
  await frame.locator('#main').waitFor({state:'visible'});
  await frame.locator('#main > *').first().waitFor({state:'visible',timeout:10000});
  await page.screenshot({path:new URL('classic-'+view+'.png',dir).pathname});
  const body=await frame.locator('#main').innerText();
  records.push({view,chars:body.length,error:/Не удалось открыть раздел|Ошибка отрисовки|Этот раздел не открылся/.test(body)});
 }
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);assert.equal(records.some(r=>r.error),false);
 console.log(JSON.stringify({records,errors,network}));
}finally{await writeFile(new URL('classic-report.json',dir),JSON.stringify({records,errors,network},null,2));await browser.close();}
