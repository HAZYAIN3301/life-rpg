'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {rank}=require('../public/settings-discovery-v1.js');

test('settings search finds controls across inactive groups and prioritizes titles',()=>{
 const items=[{id:'profile',title:'Profile',text:'Change sound for your profile',group:'account'}, {id:'audio',title:'Sound',text:'Volume',group:'experience'}];
 assert.deepEqual(rank('sound',items).map(x=>x.id),['audio','profile']);
 assert.equal(items[0].score,undefined);
});
test('settings search handles accents, Cyrillic and casing',()=>{
 assert.equal(rank('EMBIENT', [{id:'1',title:'Émbient',text:''}])[0].id,'1');
 assert.equal(rank('ОТЧЕТ', [{id:'2',title:'Отчёт дня',text:''}])[0].id,'2');
 assert.equal(rank('звук', [{id:'3',title:'Звук и присутствие Тени',text:''}])[0].id,'3');
});
test('empty and unmatched searches do not suggest unrelated settings',()=>{
 const items=[{id:'1',title:'Notifications',text:'Reminder'}];
 assert.deepEqual(rank('  ',items),[]);
 assert.deepEqual(rank('unrelated',items),[]);
});
test('search limits results without mutating the catalog',()=>{
 const items=Array.from({length:20},(_,i)=>({id:String(i),title:'Sound '+i,text:''}));
 assert.equal(rank('sound',items).length,8);
 assert.equal(items.length,20);
});

test('natural queries ignore filler and punctuation across five supported languages',()=>{
 const items=[{id:'language',title:'Appearance',text:'Language theme'}, {id:'sound',title:'Sound',text:'Volume'}];
 for(const query of ['как поменять язык?','як змінити мову?','how do I change language?','wie kann ich die Sprache ändern?','como cambiar idioma?']) {
   assert.equal(rank(query,items)[0]?.id,'language',query);
 }
 assert.equal(rank('как выключить звук?',items)[0].id,'sound');
});

test('reminder vocabulary finds notifications without cloud inference',()=>{
 const items=[{id:'device',title:'Device',text:'Notifications Face ID'}];
 for(const query of ['напоминания','нагадування','recordatorios','Erinnerungen','reminders']) assert.equal(rank(query,items)[0]?.id,'device',query);
});

test('all concepts beat a partially matching title and repetition does not skew rank',()=>{
 const items=[{id:'account',title:'Account',text:'Name and email'}, {id:'delete',title:'Privacy',text:'Delete account'}];
 assert.equal(rank('delete account',items)[0].id,'delete');
 assert.deepEqual(rank('account account account',items).map(x=>x.id),rank('account',items).map(x=>x.id));
 assert.deepEqual(rank('how do I?',items),[]);
});
