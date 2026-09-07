// One-time immutable UI capture. Never rebuild v244 from a newer runtime.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),pub=resolve(root,'public'),out=resolve(pub,'design-baseline/v244');
const baseline='74a97ddbef6547e482b6b6944a10d377b8db604e';
if(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==baseline)throw Error('Only the approved pre-redesign commit may produce v244.');
try{await access(resolve(out,'manifest.json'));throw Error('Frozen baseline already exists; do not overwrite.');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(out,{recursive:true});
let html=await readFile(resolve(pub,'index.html'),'utf8');
const files=new Set(['styles.css','fonts/podkova/Podkova-wght.woff2',...[...html.matchAll(/<script src="([^"?]+)[^"]*"/g)].map(m=>m[1])]);
const hashes={};
for(const file of files){
 const source=await readFile(resolve(pub,file));hashes[file]=createHash('sha256').update(source).digest('hex');
 const dest=resolve(out,file);await mkdir(dirname(dest),{recursive:true});
 if(file==='app.js'){const text=source.toString();if(!/init\(\);\s*$/.test(text))throw Error('Unexpected init gate');await writeFile(dest,text.replace(/init\(\);\s*$/,'// Frozen comparison starts with isolated fixtures, never auth/init.\n'));}
 else await copyFile(resolve(pub,file),dest);
}
html=html.replace('<head>','<head>\n<base href="/">\n<script src="/design-comparison-guard.js"></script>');
html=html.replace(/(src|href)="([^"?]+)([^"]*)"/g,(whole,attr,path,suffix)=>files.has(path)?attr+'="/design-baseline/v244/'+path+suffix+'"':whole);
html=html.replace('</body>','<script src="/design-comparison-boot.js"></script></body>');
await writeFile(resolve(out,'index.html'),html);
await writeFile(resolve(out,'manifest.json'),JSON.stringify({baseline,createdAt:'2026-09-08',readOnly:true,sourceHashes:hashes,adapter:'init replaced by isolated comparison boot; dated artwork reused from public'},null,2)+'\n');
console.log('Frozen',files.size,'code/style files; no user data.');
