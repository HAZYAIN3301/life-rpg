import {build as esbuild} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const build=options=>esbuild({absWorkingDir:process.cwd(),...options}),out='../../public/redesign';
await mkdir('.checks',{recursive:true});
const check=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--jsx','react-jsx','--lib','dom,dom.iterable,es2023','--module','esnext','--target','es2022','--moduleResolution','bundler','--types','react,react-dom','--skipLibCheck','src/live/Today.tsx','src/components/generated/styles.d.ts'],{stdio:'inherit'});
if(check.status)process.exit(check.status);
await build({entryPoints:['src/live/Today.tsx'],bundle:true,format:'iife',platform:'browser',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:out+'/live-ui.js'});
await writeFile(out+'/live-ui.js',(await readFile(out+'/live-ui.js','utf8')).replace(/^[\t ]+$/gm,''));
const model=await build({entryPoints:['src/live/model.ts'],bundle:true,format:'iife',globalName:'SatoruLiveModel',platform:'browser',write:false});
await build({entryPoints:['src/live/model.ts'],bundle:true,format:'cjs',platform:'node',outfile:'.checks/live-model.cjs'});
await build({entryPoints:['src/live/world-model.ts'],bundle:true,format:'cjs',platform:'node',outfile:'.checks/world-model.cjs'});
const core=await readFile('../../public/app.js','utf8');
const undoStart=core.indexOf('      const completedDay = dayOf(q), beforeTask = structuredClone(q), record = questCommitmentRecord(q);',core.indexOf("if (action === 'toggle-task')"));
const undoEnd=core.indexOf('      checkAchievements(); render(); publishLeaderboard();',undoStart);
if(undoStart<0||undoEnd<0)throw Error('Undo transaction anchor changed');
const undo=`async function b28UndoTask(id){const q=questById(id),el=null;\n${core.slice(undoStart,undoEnd)}\nreturn saved;}\n`.replace(": await Store.saveNow('tasks', State.tasks);",": q.rewardPurchaseId ? await commitmentDataCommit(({settings,tasks})=>({settings,tasks})) : await Store.saveNow('tasks', State.tasks);");
const parts=await Promise.all(['live-copy.js','plan-bridge.js','rewards-bridge.js','world-bridge.js','today-bridge.js','live-bridge.js','app-hooks.js'].map(p=>readFile(p,'utf8')));
const runtime=`'use strict';\nwindow.SatoruAppStartup=function(){\nif(window.SatoruLiveBridge)return;\n${model.outputFiles[0].text}\nwindow.SatoruLiveModel=SatoruLiveModel;\n${undo}\n${parts.join('\n')}\n};\n`;
await writeFile(out+'/app-runtime.js',runtime);
if(core.split('\ninit();').length!==2)throw Error('Canonical startup anchor changed');
await writeFile(out+'/live-engine.js',core.replace('\ninit();','\n'+runtime+'\ninit();'));
const template=await readFile('app-template.html','utf8');
const assets={'live-ui.js':await readFile(out+'/live-ui.js'),'live-ui.css':await readFile(out+'/live-ui.css')};
function html(mode){
 let page=template.replace('<html lang="en"','<html lang="en" data-satoru-mode="'+mode+'"').replace('<head>','<head><base href="/">');
 page=page.replace('</head>','<link rel="stylesheet" href="redesign/live-ui.css"></head>');
 page=page.replace(/<script src="app\.js[^" ]*"><\/script>/,'<script src="redesign/live-ui.js"></script><script src="redesign/app-runtime.js"></script><script src="app.js?v=20261027-b25-app-v344-1"></script>');
 for(const name of ['app-runtime.js','live-ui.js','live-ui.css']){
  const digest=createHash('sha256').update(name==='app-runtime.js'?runtime:assets[name]).digest('hex').slice(0,12);
  page=page.replace('redesign/'+name+'"','redesign/'+name+'?v=b213-'+digest+'"');
 }
 return page;
}
await writeFile('../../public/index.html',html('app'));
await writeFile(out+'/live.html',html('review'));
console.log('B2.13 app root built: one canonical runtime, accepted B2.5 UI, no B26 shell.');
