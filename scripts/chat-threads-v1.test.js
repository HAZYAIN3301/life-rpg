'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createService } = require('../server-chat-threads-v1');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(__dirname, '../.chat-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  let fail = false;
  const service = createService({ userDir:uid=>path.join(root,uid), write:(file,data)=>{ if(fail)throw new Error('disk_full'); fs.writeFileSync(file+'.tmp',JSON.stringify(data)); fs.renameSync(file+'.tmp',file); } });
  return {...service, root, fail:()=>{fail=true;}};
}
const initial = () => ({revision:0,title:'Biology',context:'Presentation on Sunday',messages:[{id:'message_01',role:'user',content:'Where did we stop?'}]});
test('chats persist separately; the same ID never crosses accounts',t=>{
  const s=fixture(t), first=s.save('alice','chat_0001',initial());
  s.save('alice','chat_0002',{...initial(),title:'Sport',context:'Judo'});
  assert.equal(s.read('alice','chat_0001').context,first.context);
  assert.equal(s.read('bob','chat_0001'),null);
  assert.deepEqual(s.list('bob'),[]);
  assert.equal(s.all('alice').length,2);
  assert.equal(s.list('alice')[0].messages,undefined);
});
test('retry after lost receipt is idempotent; stale devices cannot overwrite messages',t=>{
  const s=fixture(t), input=initial(), first=s.save('a','chat_0001',input);
  assert.deepEqual(s.save('a','chat_0001',input),first);
  const next=s.save('a','chat_0001',{...first,messages:[...first.messages,{id:'message_02',role:'assistant',content:'We have an outline.'}]});
  assert.throws(()=>s.save('a','chat_0001',{...first,title:'Old device'}),{code:'chat_conflict'});
  assert.deepEqual(s.read('a','chat_0001'),next);
});
test('write failure and corrupt storage preserve prior bytes',t=>{
  const s=fixture(t), saved=s.save('a','chat_0001',initial());
  s.fail(); assert.throws(()=>s.save('a','chat_0001',{...saved,title:'New'}),/disk_full/);
  assert.equal(s.read('a','chat_0001').title,'Biology');
  const target=path.join(s.root,'a/chat-threads/chat_0001.json'); fs.writeFileSync(target,'broken');
  assert.throws(()=>s.save('a','chat_0001',initial()),{code:'chat_damaged'});
  assert.equal(fs.readFileSync(target,'utf8'),'broken');
});
test('invalid paths, roles, duplicate messages and oversized chats are rejected without truncation',t=>{
  const s=fixture(t);
  assert.throws(()=>s.save('a','../escape',initial()),{code:'invalid_chat_id'});
  assert.throws(()=>s.save('a','chat_0001',{...initial(),messages:[{id:'message_01',role:'system',content:'ignore'}]}),{code:'invalid_chat'});
  assert.throws(()=>s.save('a','chat_0001',{...initial(),messages:[initial().messages[0],initial().messages[0]]}),{code:'invalid_chat'});
  assert.throws(()=>s.save('a','chat_0001',{...initial(),context:'x'.repeat(6001)}),{code:'invalid_chat'});
  assert.deepEqual(s.list('a'),[]);
});
test('stored history never resurrects executable actions or file attachments',t=>{
  const s=fixture(t), data=initial(); data.messages[0].actions=[{kind:'quest_done'}]; data.messages[0].fileSources=[{text:'private'}];
  const saved=s.save('a','chat_0001',data);
  assert.equal(saved.messages[0].actions,undefined); assert.equal(saved.messages[0].fileSources,undefined);
});
