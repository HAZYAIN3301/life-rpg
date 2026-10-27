// Loopback synthetic fixture only. API readback, no raw writes or production access.
import fs from 'node:fs/promises';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const label=process.argv[2]||'final';if(!/^[a-z-]+$/.test(label))throw Error('Invalid evidence label');
const source=await fs.readFile('../../public/app.js','utf8'),fixture=vm.runInNewContext('('+source.match(/const TEST_USER = (\{[^\n]+\});/)[1]+')');
const origin='http://localhost:8771',login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fixture.email,password:fixture.password})});if(!login.ok)throw Error('QA login failed');
const headers={cookie:login.headers.get('set-cookie').split(';')[0]},me=await(await fetch(origin+'/api/auth/me',{headers})).json();if((me.user||me).name!=='Тестовый герой')throw Error('Refuse non-QA account');
const data={};for(const slot of ['settings','tasks','skilltree','episodes','goals','habitlog','purchases','lootbox']){const r=await fetch(origin+'/api/data/'+slot,{headers});if(!r.ok)throw Error(slot+': '+r.status);data[slot]=await r.json();}
const keys=['skills','curve','den','avatarAppearance','avatarCoreGender','avatar','body','wear','gear','cosmetics','petNames','petSpecies','fortuneSkins','fortuneProps','companion','theme','lang','accent','motion'];
const report={at:new Date().toISOString(),label,account:'Тестовый герой',settings:Object.fromEntries(keys.map(k=>[k,data.settings[k]??null])),tasks:data.tasks,skilltree:data.skilltree,episodes:data.episodes,economy:{purchases:data.purchases,goals:data.goals,habitlog:data.habitlog,lootbox:data.lootbox}};
await fs.mkdir('review/b215',{recursive:true});await fs.writeFile('review/b215/'+label+'-readback.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({label,tasks:report.tasks.length,trees:Object.keys(report.skilltree).length,episodes:report.episodes.length,companion:report.settings.companion?.bond}));
