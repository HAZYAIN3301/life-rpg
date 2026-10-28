// Only the existing disposable loopback fixture. No production access or writes.
import fs from 'node:fs/promises';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const label=process.argv[2];if(!['before','after'].includes(label))throw Error('before/after required');
const source=await fs.readFile('../../public/app.js','utf8'),f=vm.runInNewContext('('+source.match(/const TEST_USER = (\{[^\n]+\});/)[1]+')');
const origin='http://localhost:8771',login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.email,password:f.password})});if(!login.ok)throw Error('QA login failed');
const headers={cookie:login.headers.get('set-cookie').split(';')[0]},me=await(await fetch(origin+'/api/auth/me',{headers})).json();if((me.user||me).name!=='Тестовый герой')throw Error('Refuse non-QA actor');
const data={};for(const slot of ['settings','tasks','skilltree','episodes','goals','habits','habitlog','rewards','purchases','lootbox']){const r=await fetch(origin+'/api/data/'+slot,{headers});if(!r.ok)throw Error(slot);data[slot]=await r.json();}
const keys=['skills','curve','den','avatarAppearance','avatarCoreGender','avatar','body','wear','gear','cosmetics','petNames','petSpecies','fortuneSkins','fortuneProps','companion','theme','lang','accent','motion','appName','rewardLifeV1','recoveryGuardianV1'];
data.settings=Object.fromEntries(keys.map(k=>[k,data.settings[k]??null]));
await fs.mkdir('review/b217',{recursive:true});await fs.writeFile('review/b217/'+label+'-readback.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({label,appName:data.settings.appName,theme:data.settings.theme,accent:data.settings.accent,tasks:data.tasks.length,purchases:data.purchases.length,rewards:data.rewards.length}));
