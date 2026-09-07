'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public'),frozen=path.join(pub,'design-baseline/v244');
const manifest=JSON.parse(fs.readFileSync(path.join(frozen,'manifest.json'),'utf8'));
test('comparison freezes pre-redesign source, not the current application',()=>{
 assert.equal(manifest.baseline,'74a97ddbef6547e482b6b6944a10d377b8db604e');
 assert.ok(Object.keys(manifest.sourceHashes).length>=95);
 for(const [file,hash] of Object.entries(manifest.sourceHashes)){
  let bytes=fs.readFileSync(path.join(frozen,file));
  if(file==='app.js')bytes=Buffer.from(bytes.toString().replace('// Frozen comparison starts with isolated fixtures, never auth/init.\n','init();\n'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file+' stays frozen');
 }
 assert.notEqual(fs.readFileSync(path.join(frozen,'app.js'),'utf8'),fs.readFileSync(path.join(pub,'app.js'),'utf8'));
});
test('comparison is opaque, network isolated, and never authenticates',()=>{
 const page=fs.readFileSync(path.join(pub,'compare.html'),'utf8'),server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(page,/sandbox="allow-scripts allow-downloads"/);
 assert.doesNotMatch(page,/allow-same-origin|allow-forms|allow-top-navigation/);
 assert.match(server,/connect-src 'none'; form-action 'none'; frame-src 'none'/);
 const archived=fs.readFileSync(path.join(frozen,'app.js'),'utf8');
 assert.doesNotMatch(archived,/init\(\);\s*$/);
 const live=fs.readFileSync(path.join(pub,'index.html'),'utf8');
 assert.doesNotMatch(live,/design-comparison-(guard|boot)/);
 assert.match(live,/design-next-v1\.css/);
});
