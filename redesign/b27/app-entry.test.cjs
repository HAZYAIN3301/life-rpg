const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('root boots one canonical core after B2.5 installer, with no rejected B26 shell',()=>{
 const html=fs.readFileSync('../../public/index.html','utf8'),scripts=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
 assert.ok(scripts.indexOf('redesign/app-runtime.js')>=0);assert.ok(scripts.indexOf('redesign/app-runtime.js')<scripts.indexOf('app.js'));assert.equal(scripts.filter(p=>p==='app.js').length,1);assert.ok(!scripts.includes('redesign/live-engine.js'));assert.doesNotMatch(html,/app-shell-b26|redesign-b26/);
 assert.match(html,/data-satoru-mode="app"/);assert.match(fs.readFileSync('../../public/redesign/live.html','utf8'),/data-satoru-mode="review"/);
});
test('runtime can load before State exists and repeated install cannot replace a running owner',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('../../public/redesign/app-runtime.js','utf8'),context);assert.equal(typeof context.window.SatoruAppStartup,'function');const running={};context.window.SatoruLiveBridge=running;context.window.SatoruAppStartup();assert.equal(context.window.SatoruLiveBridge,running);
});
test('canonical init installs presentation before session lookup and uses the unchanged B3 owner',()=>{
 const source=fs.readFileSync('../../public/app.js','utf8'),start=source.indexOf('async function init() {');assert.ok(start>=0);const init=source.slice(start);assert.ok(init.indexOf('window.SatoruAppStartup?.()')<init.indexOf("fetch('/api/auth/me')"));assert.equal((source.match(/^init\(\);$/gm)||[]).length,1);
});
test('startup exposes the domain model to existing owners even from its private function scope',()=>{
 const runtime=fs.readFileSync('../../public/redesign/app-runtime.js','utf8'),boundary=runtime.indexOf('\nasync function b28UndoTask');assert.ok(boundary>0);
 const context={window:{}};vm.runInNewContext(runtime.slice(0,boundary)+'\n};',context);context.window.SatoruAppStartup();
 assert.equal(typeof context.window.SatoruLiveModel?.buildTask,'function');
 assert.equal(typeof context.window.SatoruLiveModel?.reconcileRewardTasks,'function');
});
