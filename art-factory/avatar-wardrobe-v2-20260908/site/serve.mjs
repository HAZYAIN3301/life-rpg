import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json','.txt':'text/plain'};
export function createPreviewServer(){
 return http.createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
   let base=root,rel=name;
   if(name.startsWith('models/')||name.startsWith('images/')||name.startsWith('fonts/'))base=path.join(root,'public');
   else if(name.startsWith('vendor/build/')){base=path.join(root,'node_modules/three/build');rel=name.slice(13);}
   else if(name.startsWith('vendor/addons/')){base=path.join(root,'node_modules/three/examples/jsm');rel=name.slice(14);}
   else if(!['index.html','workbench.css','workbench.mjs','wardrobe.mjs','contract.mjs','drawn.html','drawn.css','drawn.mjs','drawn-rig.mjs','volume.html','volume.css','volume.mjs','volume-rig.mjs'].includes(name))throw Error('Private');
   const file=await realpath(path.resolve(base,rel)),allowed=await realpath(base);
   if(!file.startsWith(allowed+path.sep)||!(await stat(file)).isFile())throw Error('Private');
   const body=await readFile(file);
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found');}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const server=createPreviewServer();server.listen(Number(process.env.AVATAR_LAB_PORT||4179),'127.0.0.1',()=>console.log('Avatar wardrobe: http://127.0.0.1:'+server.address().port));
}
