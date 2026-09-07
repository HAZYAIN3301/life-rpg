import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../..');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.glb':'model/gltf-binary'};
// Read-only localhost preview. Never exposes repository docs, data/, .git or arbitrary paths.
export function createPreviewServer() {
  return http.createServer(async(req,res)=>{
    try {
      if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);
      let base=root,relative=pathname.slice(1)||'index.html';
      if(pathname.startsWith('/public/art/')){base=path.join(repo,'public/art');relative=pathname.slice('/public/art/'.length);}
      else if(pathname.startsWith('/public/fonts/')){base=path.join(repo,'public/fonts');relative=pathname.slice('/public/fonts/'.length);}
      else if(pathname==='/public/styles.css'){base=path.join(repo,'public');relative='styles.css';}
      else if(pathname.startsWith('/vendor/')){base=path.join(root,'node_modules/three');relative=pathname.slice('/vendor/'.length);}
      else if(!['index.html','workbench.css','workbench.mjs','rig.mjs','contract.mjs','glb.mjs'].includes(relative))throw new Error('Not exposed');
      const filename=await realpath(path.resolve(base,relative)),allowed=await realpath(base);
      if(!filename.startsWith(allowed+path.sep)||!(await stat(filename)).isFile())throw new Error('Not exposed');
      const bytes=await readFile(filename);
      res.writeHead(200,{'Content-Type':MIME[path.extname(filename)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:bytes);
    } catch {res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const server=createPreviewServer();server.listen(Number(process.env.AVATAR_PILOT_PORT||4178),'127.0.0.1',()=>process.stdout.write('Avatar pilot: http://127.0.0.1:'+server.address().port+'\n'));
}
