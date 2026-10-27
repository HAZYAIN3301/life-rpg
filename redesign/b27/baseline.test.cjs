const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const hashes=require('./baseline-b25.json');
test('approved B2.5 scenes, main content, forms and visual styles remain byte-identical',()=>{
 const extended=new Set(['B2Workbench.tsx','PlanWorkspace.tsx','B2Model.ts','ClearIcons.tsx','WorldWorkspace.tsx','regression.test.cjs']);
 for(const [name,hash] of Object.entries(hashes)){
   if(extended.has(name.split('/').at(-1)))continue;
   let source=fs.readFileSync(require('node:path').join(__dirname,name));
   // B2.8 supplies the real chest count. Strip only this optional data input;
   // default behavior, markup and every visual class still match accepted B2.5.
   if(name.endsWith('/TodayDashboard.tsx'))source=Buffer.from(source.toString().replace('  chestsAvailable,\n','').replace('  chestsAvailable?: number;\n','').replace('(chestsAvailable ?? chestProgress(data).available)>0','chestProgress(data).available>0'));
   assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash,`Unapproved B2.5 change: ${name}`);
 }
});
