import {build as esbuild} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const build=options=>esbuild({absWorkingDir:process.cwd(),...options});
const out='../../public/redesign';
await mkdir('.checks',{recursive:true});
const check=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--jsx','react-jsx','--lib','dom,dom.iterable,es2023','--module','esnext','--target','es2022','--moduleResolution','bundler','--types','react,react-dom','--skipLibCheck',... (await import('node:fs')).readdirSync('src/components/generated').filter(n=>/\.tsx?$/.test(n)).map(n=>'src/components/generated/'+n)],{stdio:'inherit'});
if(check.status)process.exit(check.status);
await build({entryPoints:['src/preview.tsx'],bundle:true,platform:'browser',format:'esm',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:out+'/app.js',loader:{'.woff2':'file'},assetNames:'assets/[name]-[hash]'});
// esbuild preserves blank SVG-template lines. Remove their indentation only;
// the accepted source artwork and all nonblank template content stay intact.
await writeFile(out+'/app.js',(await readFile(out+'/app.js','utf8')).replace(/^[\t ]+$/gm,''));
for(const name of ['B2Model','PlanModel','DailyModel','CalendarModel','ShadowImportModel','ReviewExamples','WorldModel','InspirationModel','TimeModel'])await build({entryPoints:['src/components/generated/'+name+'.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.checks/'+name+'.cjs',logLevel:'silent'});
console.log('B2.7 bundled; React is local.');
