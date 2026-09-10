const test = require('node:test');
const assert = require('node:assert/strict');
const Client = require('../public/secretary-next-moves-client-v1.js');
const UI = require('../public/secretary-next-moves-ui-v1.js');
const Policy = require('../public/secretary-next-moves-v2.js');
const now = '2026-09-10T12:00:00.000Z';
function offer() {
  return Policy.decide({ now, today:'2026-09-10', utcOffsetMinutes:0, invocation:'app_open', availableChannels:['card'], ledger:Policy.emptyLedger(),
    lapse:{confirmed:true,source:'user_confirmed',eventKey:'episode:a1',day:'2026-09-10',endedAt:now,observedAt:now,originalRef:'quest:q1',originalStillActionable:true} }).offer;
}
function harness(rpc, extras = {}) {
  let seq = 0, account = 'a'; const changes = [];
  const client = Client.create({accountId:'a',clientId:'tab1',requestId:()=>`r${++seq}`,rpc,currentAccount:()=>account,changed:s=>changes.push(s),...extras});
  return {client,changes, switchAccount:()=>{account='b';}};
}
const claimed = () => ({ok:true,offer:offer(),token:'secret-token',persistedAt:now});
test('no visible offer before durable claim; malformed claim fails closed', async () => {
  let release; const wait = new Promise(resolve=>release=resolve);
  const h = harness(async body => body.op === 'decide' ? {ok:true,offer:offer()} : wait);
  const work = h.client.load({}); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.client.state().offer,null);
  release({ok:true,offer:offer(),token:'token'}); await work;
  assert.equal(h.client.state().phase,'error'); assert.equal(h.client.state().offer,null);
});
test('lost outcome retains exact request and no success until retry receipt', async () => {
  const calls=[];let lost=true;
  const h=harness(async body=>{calls.push(body);if(body.op==='decide')return {ok:true,offer:offer()};if(body.op==='claim')return claimed();
    if(lost){lost=false;throw new Error('offline');}return {ok:true,outcome:body.outcome,action:offer().action,persistedAt:now};});
  await h.client.load({}); assert.equal(h.client.state().phase,'offered');
  assert.equal(await h.client.outcome('accepted'),null);assert.ok(h.client.state().offer);assert.equal(h.client.state().phase,'error');
  assert.equal(await h.client.outcome('dismissed'),null);
  assert.ok(await h.client.outcome('accepted'));assert.equal(h.client.state().offer,null);
  assert.deepEqual(calls.filter(x=>x.op==='outcome')[0],calls.filter(x=>x.op==='outcome')[1]);
});
test('pending dismissal survives reload and retries original outcome', async () => {
  let stored;const extras={readPending:()=>stored,writePending:v=>{stored=v;}};
  const a=harness(async body=>body.op==='decide'?{ok:true,offer:offer()}:body.op==='claim'?claimed():Promise.reject(new Error('500')),extras);
  await a.client.load({});await a.client.outcome('dismissed');assert.ok(stored);
  const b=harness(async body=>({ok:true,outcome:body.outcome,action:null,persistedAt:now}),extras);
  assert.equal(b.client.pending().outcome,'dismissed');assert.ok(await b.client.outcome('dismissed'));assert.equal(stored,null);
});
test('late reply cannot populate a different account', async () => {
  let release;const h=harness(()=>new Promise(r=>release=r));const work=h.client.load({});h.switchAccount();release({ok:true,offer:offer()});await work;
  assert.equal(h.client.state().offer,null);assert.equal(h.changes.length,1);
});
test('silence is distinguished from offline, 422 and malformed success', async () => {
  for(const response of [{ok:true},{ok:false,error:'invalid_ledger'},null]){const h=harness(async()=>response);await h.client.load({});assert.equal(h.client.state().phase,'error');}
  const h=harness(async()=>({ok:true,offer:null,silence:{reason:'nothing_eligible'}}));await h.client.load({});assert.equal(h.client.state().phase,'silence');
});
test('resume requires an actual durable offer; expired reports explicit outcome', async () => {
  const calls=[];const h=harness(async body=>{calls.push(body);return body.op==='decide'?{ok:true,resume:claimed()}:{ok:true,outcome:'expired',action:null,persistedAt:now};});
  await h.client.load({});assert.equal(h.client.state().phase,'offered');await h.client.outcome('expired');assert.equal(calls[1].outcome,'expired');
});
test('UI escapes personal titles, refuses stale targets and covers all visible copy in five languages', () => {
  const o=offer();const snapshot={tasks:[{id:'q1',title:'<img src=x onerror=alert(1)>',done:false}],habits:[]};
  for(const lang of UI.LANGS){const html=UI.render({offer:o,busy:false},lang,snapshot);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
    for(const key of [o.copy.titleKey,o.copy.bodyKey,o.primary.labelKey])assert.ok(UI.COPY[lang][key]);}
  assert.equal(UI.target('quest:q1',{tasks:[{...snapshot.tasks[0],done:true}]}),null);
  assert.equal(UI.target('habit:h1',{habits:[{id:'h1',name:'Read',atomic:{twoMin:''}}]}),null);
  assert.equal(Client.validAction({type:'arbitrary',args:{}}),false);
  assert.equal(Client.validOffer({...o,primary:{action:{type:'task_open_prepared',args:{targetRef:'https://example.test',size:'minimum'}}}}),false);
});
