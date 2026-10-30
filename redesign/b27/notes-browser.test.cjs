const test=require('node:test'),a=require('node:assert/strict'),{parseHTML}=require('linkedom');
const N=require('./notes-browser.js');
const notes=[{id:'a',kind:'text',text:'План поездки в Київ'}, {id:'b',kind:'voice',text:'Идея про café и музыку'}, {id:'c',kind:'video',text:'Видео из поездки'}, {id:'d',kind:'text',text:'x'.repeat(200)+' ЗАБЫТАЯ мысль'}];
test('search uses full Unicode text and all terms; kind filters preserve source order and data',()=>{
 const before=JSON.stringify(notes);a.deepEqual(N.select(notes,{query:'  поездки КИЇВ ',kind:'all'}).ids,['a']);
 a.deepEqual(N.select(notes,{query:'CAFE',kind:'voice'}).ids,['b']);
 a.deepEqual(N.select(notes,{query:'забытая',kind:'all'}).ids,['d']);
 a.deepEqual(N.select(notes,{query:'поездки',kind:'video'}).ids,['c']);
 a.deepEqual(N.select(notes,{query:'no matches',kind:'all'}).ids,[]);
 a.equal(JSON.stringify(notes),before);a.deepEqual(N.select(notes,{}).counts,{all:4,text:2,voice:1,video:1});
});
function harness(){const {window}=parseHTML('<div id="host"><section class="notes-screen"><div class="capture-card"><textarea id="capture-text"></textarea></div><section class="notes-list">'+notes.map(n=>'<article class="note-card" data-id="'+n.id+'"><details open><summary>'+n.id+'</summary><textarea class="note-text">original</textarea></details></article>').join('')+'</section></section></div>');const host=window.document.getElementById('host'),state={query:'',kind:'all'};N.prepare(host,notes,state,s=>s,'');N.bind(host,notes,state,s=>s);return{window,host,state};}
test('filtering never rebuilds an open editor or clears its draft; clear restores all notes',()=>{
 const {window,host,state}=harness(),editor=host.querySelector('.note-text'),card=host.querySelector('.note-card'),input=host.querySelector('#b218-notes-query');editor.value='unsent draft';
 input.value='café';input.dispatchEvent(new window.Event('input',{bubbles:true}));a.equal(state.query,'café');a.equal(card.hidden,true);a.equal(host.querySelector('.note-text'),editor);a.equal(editor.value,'unsent draft');a.equal(card.querySelector('details').hasAttribute('open'),true);
 host.querySelector('[data-notes-reset]').click();a.equal(state.query,'');a.equal(state.kind,'all');a.equal(card.hidden,false);a.equal(editor.value,'unsent draft');
});
test('a receipt keeps presentation, malformed kinds fall back to all, and empty states do not invent content',()=>{
 const {host,state}=harness();state.query='unmatched';state.kind='voice';N.prepare(host,notes,state,s=>s,'');N.bind(host,notes,state,s=>s);
 a.equal(host.querySelector('#b218-notes-query').value,'unmatched');a.equal(host.querySelector('[data-notes-empty]').hidden,false);
 state.query='';state.kind='unknown';N.bind(host,[],state,s=>s);a.equal(state.kind,'all');a.match(host.querySelector('[data-notes-empty]').textContent,/Пока нет заметок/);
});
test('hiding a playing note pauses its media, keeps its position and never autoplays on reveal',()=>{
 const {window,host}=harness(),card=host.querySelector('.note-card'),media=window.document.createElement('audio');let pauses=0;media.paused=false;media.currentTime=12;media.pause=()=>{media.paused=true;pauses++;};card.append(media);
 const input=host.querySelector('input');input.value='café';input.dispatchEvent(new window.Event('input',{bubbles:true}));a.equal(pauses,1);a.equal(media.currentTime,12);
 host.querySelector('[data-notes-reset]').click();a.equal(card.querySelector('audio'),media);a.equal(media.paused,true);a.equal(pauses,1);
});
test('the bridge keeps search identity across receipts, reads confirmed edits, and resets for capture/account change',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{window}=parseHTML('<div id="host"></div>'),document=window.document,host=document.getElementById('host');
 const State={me:{id:'account-a'},inbox:structuredClone(notes)},context={window,document,State,t:s=>s,lang:()=> 'ru',todayStr:()=> '2026-10-30',satoruIconHTML:()=>'',translateDOM:()=>{},sessionStorage:{getItem:()=>null,removeItem:()=>{}},requestAnimationFrame:f=>f(),renderNotes:()=>'<section class="notes-screen"><header class="notes-header"></header><form id="capture-form"><textarea id="capture-text"></textarea></form><section class="notes-list">'+State.inbox.map(n=>'<article class="note-card" data-id="'+n.id+'"></article>').join('')+'</section></section>'};
 window.SatoruNotesBrowser=N;window.SatoruPlanBridge={commitOwned:(h,s)=>h.replaceChildren(...s.childNodes)};vm.createContext(context);vm.runInContext(fs.readFileSync('today-bridge.js','utf8'),context);
 const mount=()=>window.SatoruTodayBridge.mount(host,'notes');mount();const search=host.querySelector('input[type=search]');search.value='café';search.dispatchEvent(new window.Event('input',{bubbles:true}));mount();a.equal(host.querySelector('input[type=search]'),search);a.equal(search.value,'café');
 State.inbox=State.inbox.map(n=>n.id==='a'?{...n,text:'newly confirmed café'}:n);search.dispatchEvent(new window.Event('input',{bubbles:true}));a.equal(host.querySelector('[data-id=a]').hidden,false);
 host.querySelector('#capture-form').dataset.persisted='true';mount();a.equal(host.querySelector('input[type=search]').value,'');
 const nextSearch=host.querySelector('input[type=search]');nextSearch.value='private account-a query';nextSearch.dispatchEvent(new window.Event('input',{bubbles:true}));State.me.id='account-b';State.inbox=[];mount();a.equal(host.querySelector('input[type=search]').value,'');
});
