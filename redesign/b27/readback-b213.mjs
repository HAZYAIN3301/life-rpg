// Read only, on the named loopback QA fixture. Never prints cookies or credentials.
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
const cookie=login.headers.get('set-cookie').split(';')[0],headers={cookie};
const me=await(await fetch(origin+'/api/auth/me',{headers})).json();
if((me.user||me).name!=='Тестовый герой')throw Error('Refuse non-QA account');
const data={};
for(const slot of ['settings','tasks','inbox','days','weeks','goals','purchases']){
 const r=await fetch(origin+'/api/data/'+slot,{headers});if(!r.ok)throw Error(slot+': '+r.status);data[slot]=await r.json();
}
const report={at:new Date().toISOString(),account:'Тестовый герой',
 tasks:data.tasks.filter(t=>t.title?.startsWith('B2.13')).map(({id,title,date,startTime,estimateMin,actualMin,done,core,xpAwarded,goldAwarded})=>({id,title,date,startTime,estimateMin,actualMin,done,core,xpAwarded,goldAwarded})),
 notes:data.inbox.filter(n=>n.text?.startsWith('B2.13')).map(({id,kind,text})=>({id,kind,text})),
 day:data.days['2026-10-27'],week:data.weeks['2026-10-26'],
 preserved:{oldNote:data.inbox.some(n=>n.text==='Логово и главный экран должны оставаться такими, как в B2.5.'),oldCore:data.tasks.find(t=>t.title==='Собрать план новой недели'),worldQuest:data.tasks.find(t=>t.title==='B2.12 · Проверить сохранение Мира'),goals:data.goals.filter(g=>g.title?.startsWith('B2.10')).map(({id,title,steps,completedAt})=>({id,title,steps,completedAt})),purchases:data.purchases.map(({id,cost})=>({id,cost})),appearance:{lang:data.settings.lang,theme:data.settings.theme,motion:data.settings.motion}}
};
await fs.writeFile('review/b213/final-readback.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tasks:report.tasks,notes:report.notes,preserved:report.preserved.oldNote,lang:report.preserved.appearance.lang}));
