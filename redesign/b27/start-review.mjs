// Keep the local review available after the agent's terminal turn ends.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
fs.mkdirSync(path.join(here,'.checks'),{recursive:true});
const log=fs.openSync(path.join(here,'.checks/review-server.log'),'a');
async function probe(url){try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});return r.ok?await r.text():null;}catch{return null;}}
async function ensure(port,script,env,checkPath,marker){
 const url='http://127.0.0.1:'+port+checkPath,current=await probe(url);
 if(current!==null){if(!current.includes(marker))throw Error('Port '+port+' belongs to another application.');return;}
 const child=spawn(process.execPath,[script],{cwd:root,env:{...process.env,...env},detached:true,stdio:['ignore',log,log]});child.unref();
 for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100));const page=await probe(url);if(page?.includes(marker))return;}
 throw Error('Review server '+port+' did not start. See redesign/b27/.checks/review-server.log.');
}
await ensure(8771,'server.js',{HOST:'127.0.0.1',PORT:'8771',DATA_DIR:path.join(root,'.qa-b26-data')},'/','redesign/app-runtime.js');
await ensure(8773,'redesign/b27/serve-live.mjs',{SATORU_REVIEW_PORT:'8773'},'/','redesign/live-ui.js');
await ensure(8775,'redesign/b27/serve-live.mjs',{SATORU_REVIEW_PORT:'8775',SATORU_REVIEW_WELCOME:'1'},'/','redesign/live-ui.js');
fs.closeSync(log);
console.log('Старт: http://localhost:8771/redesign/live.html?welcome=1');
console.log('Приложение: http://localhost:8771/');
console.log('Проверка телефона: http://localhost:8771/redesign/phone.html');
