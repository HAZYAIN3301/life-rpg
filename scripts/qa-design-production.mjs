// Read-only release verification. No sign-in, registration or user-data writes.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const base='https://life-rpg-production-416a.up.railway.app',dir=new URL('../art-factory/design-rollout-20260908/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={runtimeCommit:process.env.SATORU_RELEASE_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),base,files:[]};
for(const file of ['index.html','app.js','design-next-v1.css','sw.js','compare.html','design-baseline/v244/manifest.json','design-baseline/v244/app.js','fonts/russo-one/RussoOne.ttf']){
 const response=await fetch(base+'/'+file+'?verify=v246');
 assert.equal(response.status,200,file);
 const actual=hash(Buffer.from(await response.arrayBuffer())),expected=hash(await readFile(new URL('../public/'+file,import.meta.url)));
 assert.equal(actual,expected,file+' production bytes');receipt.files.push({file,sha256:actual});
}
const archive=await fetch(base+'/design-baseline/v244/index.html');
assert.equal(archive.status,200);assert.match(archive.headers.get('content-security-policy'),/sandbox allow-scripts allow-downloads.*connect-src 'none'/);
receipt.archiveCsp=archive.headers.get('content-security-policy');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 // A clean temporary browser has no account cookies. Do not inject Playwright's
 // serviceWorker blocker into the opaque archive frame: its Navigator getter throws
 // in that sandbox. The archive itself never invokes app init/registration.
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});
 await page.goto(base+'/compare.html');
 const frame=page.frameLocator('iframe');await frame.locator('#main>*').first().waitFor({state:'visible'});
 assert.equal(await frame.locator('.today-shell').count(),1);
 await page.screenshot({path:new URL('production-classic-today.png',dir).pathname});
 assert.deepEqual(requests,[],'archive never reads account API');assert.deepEqual(errors,[]);
 receipt.archiveBrowser={errors:[...errors],apiRequests:[...requests]};
 await page.goto(base+'/');await page.locator('input[type=password]').first().waitFor({state:'visible',timeout:15000});
 assert.equal(await page.locator('html').getAttribute('data-design'),'next');
 await page.screenshot({path:new URL('production-auth.png',dir).pathname});
 assert.deepEqual(errors,[]);receipt.newAuthBrowser='visible, next design, no pageerrors, no login';
}finally{await browser.close();}
await writeFile(new URL('production-receipt.json',dir),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
