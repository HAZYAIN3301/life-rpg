const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const code=read('public/interface-composition-v1.js'),app=read('public/app.js');
test('presentation module loads without browser services and does not own business state',()=>{
 const context=vm.createContext({});vm.runInContext(code,context);
 for(const name of ['apply','select','reveal'])assert.equal(typeof context.InterfaceCompositionV1[name],'function');
 assert.doesNotMatch(code,/fetch\(|localStorage|Store\.|State\.|saveNow|innerHTML\s*=/);
});
test('composition is an explicit shell dependency and applied before DOM commit',()=>{
 assert.match(read('public/index.html'),/interface-composition-v1\.js/);
 assert.match(read('public/sw.js'),/'interface-composition-v1\.js'/);
 const commit=app.slice(app.indexOf('function commitMainView('),app.indexOf('function renderMainView('));
 assert.match(commit,/InterfaceCompositionV1\?\.apply\(staging, view/);
 assert.match(app,/InterfaceCompositionV1\?\.reveal\(document\.querySelector\(targetSelector\)\)/);
});
test('workspace navigation is keyboard reachable; view choices cannot write user records',()=>{
 for(const token of ["'tablist'","'tabpanel'","'aria-controls'","'aria-selected'","'ArrowLeft'","'ArrowRight'","'Home'","'End'"])assert.ok(code.includes(token),token);
 assert.match(code,/panel\.hidden = panel\.dataset\.layoutPanel !== id/);
 assert.match(code,/choices\.set\(box\.dataset\.workspace, id\)/);
});
