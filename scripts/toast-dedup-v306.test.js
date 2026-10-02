'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const start=app.indexOf('function toast(msg) {'),end=app.indexOf('\n}\n',start)+2;
test('one refusal has one toast; distinct messages and later retries remain visible',()=>{
const nodes=[];const host={querySelectorAll:()=>nodes,appendChild:e=>nodes.push(e)};
const c={document:{getElementById:()=>host,createElement:()=>({classList:{add(){},remove(){}},remove(){nodes.splice(nodes.indexOf(this),1)}})},requestAnimationFrame:f=>f(),setTimeout:()=>0};
c.t=value=>value;vm.createContext(c);vm.runInContext(app.slice(start,end),c);
c.toast('Retry');c.toast('Retry');assert.equal(nodes.length,1);c.toast('Another result');assert.equal(nodes.length,2);nodes[0].remove();c.toast('Retry');assert.equal(nodes.length,2);
c.toast('+20 🪙 ✅');assert.equal(nodes.at(-1).textContent,'+20 золота');
});
