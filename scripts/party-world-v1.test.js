'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../public/party-world-ui-v1');
test('world starts at map, has six real destinations and rejects an unknown route',()=>{
 const n=W.createNavigation();assert.equal(n.location(),'map');assert.equal(W.places.length,6);
 assert.equal(new Set(W.places.map(x=>x.id)).size,6);assert.equal(n.go('missing'),false);
 for(const p of W.places){assert(n.go(p.id));assert.equal(n.location(),p.id);assert(p.x>0&&p.x<100&&p.y>0&&p.y<100);}
 for(const lang of ['ru','en','de','uk','es'])for(const p of W.places)assert(W.text(p.id,lang));
});
test('a later destination, back navigation or cancellation invalidates an old walk',()=>{
 const n=W.createNavigation(),first=n.begin('den'),second=n.begin('forest');
 assert.equal(n.finish(first),false);assert.equal(n.finish(second),true);assert.equal(n.location(),'forest');
 const third=n.begin('arena');n.go('map');assert.equal(n.finish(third),false);
 const fourth=n.begin('room');n.cancel();assert.equal(n.finish(fourth),false);
});
test('loading does not erase destination; joining preserves intent; actual departure and account changes reset',()=>{
 const n=W.createNavigation(),scope={userId:'a',epoch:1,group:false};n.sync(scope);n.go('sessions');
 n.sync({...scope,group:null});assert.equal(n.location(),'sessions');
 n.sync({...scope,group:{id:'p'}});assert.equal(n.location(),'sessions');
 const move=n.begin('room');n.sync({...scope,group:{id:'other'}});assert.equal(n.location(),'map');assert.equal(n.finish(move),false);
 n.go('cave');n.sync({...scope,group:false});assert.equal(n.location(),'map');
 n.go('friends');n.sync({...scope,userId:'b'});assert.equal(n.location(),'map');
 const stale=n.begin('arena');n.sync({...scope,userId:'b',epoch:2});assert.equal(n.finish(stale),false);
});
