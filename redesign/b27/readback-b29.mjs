// Read-only evidence from this task's isolated localhost QA account.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const source=await fs.readFile('../../public/app.js','utf8');
const fixture=vm.runInNewContext('('+source.match(/const TEST_USER = (\{[^\n]+\});/)[1]+')');
const origin='http://localhost:8771';
const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fixture.email,password:fixture.password})});
if(!login.ok)throw Error('QA login failed');
const cookie=login.headers.get('set-cookie').split(';')[0];
const data={};
for(const slot of ['tasks','weeks']){const response=await fetch(origin+'/api/data/'+slot,{headers:{cookie}});if(response.status===404&&slot==='weeks'){data[slot]={};continue;}if(!response.ok)throw Error(slot+': '+response.status);data[slot]=await response.json();}
const report={at:new Date().toISOString(),phase:process.argv[2]||'final',tasks:data.tasks.filter(t=>['Собрать план новой недели','Проверить новый экран Satoru','Встреча по Satoru'].includes(t.title)).map(({title,date,startTime,estimateMin,actualMin,done,xpAwarded,goldAwarded,postponedCount})=>({title,date,startTime,estimateMin,actualMin,done,xpAwarded,goldAwarded,postponedCount})),week:data.weeks['2026-10-26']||{}};
if(!/^[a-z-]+$/.test(report.phase))throw Error('Invalid evidence label');
await fs.writeFile('review/b29-'+report.phase+'-readback.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
