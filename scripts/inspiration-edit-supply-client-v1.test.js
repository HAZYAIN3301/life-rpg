'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../public/inspiration-edit-supply-client-v1.js');
test('pending waits on the same supply call; abort and finite polling never commit an unfinished digest',async()=>{
 let calls=0,waits=0;const ready={editStatus:'ready',editCandidates:[],provider:'pexels'};
 assert.equal(await C.load({fetchSupply:async()=>++calls<3?{...ready,editStatus:'pending'}:ready,wait:async()=>{waits++;},active:()=>true}),ready);
 assert.equal(calls,3);assert.equal(waits,2);
 await assert.rejects(C.load({fetchSupply:async()=>({...ready,editStatus:'pending'}),wait:async()=>{},active:()=>true,maxPolls:2}),/supply_pending/);
 await assert.rejects(C.load({fetchSupply:async()=>ready,active:()=>false}),/supply_aborted/);
});
