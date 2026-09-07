import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const dir=new URL('../art-factory/design-rollout-20260908/',import.meta.url),pub=new URL('../public/',import.meta.url);
const html=(await readFile(new URL('index.html',pub),'utf8')).replace('<head>','<head><script src="/design-comparison-guard.js"></script>').replace('</body>','<script src="/design-comparison-boot.js"></script></body>');
const app=(await readFile(new URL('app.js',pub),'utf8')).replace(/init\(\);\s*$/,'// Synthetic fixture only.');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[],checks=[];
const scenarios=[
 ['dense',320,'light','ru','today'],['empty',720,'dark','en','today'],
 ['week',1024,'light','de','weekly'],['goal',390,'dark','de','goals'],
 ['settings',390,'light','en','settings'],['composer',1440,'light','ru','today'],
 ['composer-mobile',390,'light','ru','today'],['habit-mobile',390,'light','ru','habits']
];
function contrast(a,b){const lum=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
try{
 for(const [name,width,theme,lang,view] of scenarios){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width<761,isMobile:width<761,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(name+': '+e.message));page.on('dialog',d=>d.dismiss());
  await page.route('**/app.js?*',r=>r.fulfill({body:app,contentType:'text/javascript'}));
  await page.route('http://127.0.0.1:4183/?*',r=>r.fulfill({body:html,contentType:'text/html'}));
  await page.goto(`http://127.0.0.1:4183/?view=${view}&theme=${theme}&lang=${lang}`);
  await page.locator('#main>*').first().waitFor({state:'visible'});
  if(name==='dense')await page.evaluate(()=>{const base=State.tasks.find(t=>t.core);State.tasks=Array.from({length:12},(_,i)=>({...base,id:'dense-'+i,core:i===0,title:i===0?'Записать первый дубль: объяснить весь план подготовки и показать самое важное действие без длинного вступления':'Следующий конкретный шаг №'+(i+1)}));render();});
  if(name==='empty')await page.evaluate(()=>{State.tasks=[];State.habits=[];State.days={};render();});
  if(name==='goal')await page.evaluate(()=>openGoalDetailDialog(State.goals[0].id));
  if(name==='settings')await page.evaluate(()=>{State._settingsGroup='data';render();});
  if(name.startsWith('composer')){
   await page.locator('#add-task input[name=title]').fill('Следующее небольшое дело');
   await page.locator('#add-task').scrollIntoViewIfNeeded();
   const r=await page.locator('#add-task').evaluate(f=>{const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}};return {form:rect(f),title:rect(f.querySelector('[name=title]')),submit:rect(f.querySelector('[type=submit]')),time:rect(f.querySelector('[name=startTime]'))}});
   assert.ok(r.submit.y>=r.title.bottom,name+' submit cannot overlap title');
   assert.ok(r.time.x>=r.form.x-1&&r.time.right<=r.form.right+1,name+' time fits');
  }
  if(name==='habit-mobile'){
   const r=await page.locator('.habits-today .task.habit').first().evaluate(e=>{const c=e.querySelector('.check').getBoundingClientRect(),t=e.querySelector('.t-title').getBoundingClientRect();return {cr:c.right,tx:t.x}});
   assert.ok(r.cr<=r.tx,name+' checkbox and title do not collide');
  }
  await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,error:/Этот раздел не открылся/.test(document.querySelector('#main').innerText),colors:[...document.querySelectorAll('.btn:not(.ghost):not(.danger)')].filter(e=>e.getClientRects().length).map(e=>{let s=getComputedStyle(e);return {text:e.innerText.slice(0,40),fg:s.color,bg:s.backgroundColor}})}));
  assert.equal(state.overflow,false,name+' document overflow');assert.equal(state.error,false,name+' error card');
  for(const c of state.colors.filter(c=>c.bg!=='rgba(0, 0, 0, 0)'))assert.ok(contrast(c.fg,c.bg)>=4.5,`${name}: ${c.text} contrast ${contrast(c.fg,c.bg)}`);
  await page.screenshot({path:new URL('edge-'+name+'.png',dir).pathname});
  if(name==='dense'){
   await page.locator('[data-action=mobile-nav-more]').click();await page.locator('#mobile-nav-sheet').waitFor({state:'visible'});
   await page.keyboard.press('Escape');await page.locator('#mobile-nav-sheet').waitFor({state:'detached'});
   assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);
   await page.locator('.profile-details>summary').focus();await page.keyboard.press('Enter');
   await page.locator('.design-compare-link').waitFor({state:'visible'});
   await page.emulateMedia({colorScheme:'light'});await page.evaluate(()=>{State.settings.theme='system';applyTheme();});
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
   await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>applyTheme());
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   checks.push('More keyboard close restores app, profile comparison reachable, system light/dark');
  }
  checks.push({name,width,theme,lang,overflow:state.overflow,primaryContrast:'>=4.5'});await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await writeFile(new URL('edge-report.json',dir),JSON.stringify({checks,errors},null,2));await browser.close();}
