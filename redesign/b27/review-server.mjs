import http from 'node:http';
export function createReviewServer({upstreamPort=8771,welcome=false}={}){
 return http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(welcome&&url.pathname==='/'&&url.searchParams.get('welcome')!=='1'){
   url.searchParams.set('welcome','1');res.writeHead(302,{location:url.pathname+url.search,'cache-control':'no-store'});res.end();return;
  }
  if(url.pathname==='/'){url.pathname='/redesign/live.html';if(welcome)url.searchParams.set('welcome','1');}
  // Keep the browser's Host alongside its Origin. Replacing only Host would
  // make the backend correctly refuse protected same-origin writes.
  const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:url.pathname+url.search,method:req.method,headers:req.headers},reply=>{
   res.writeHead(reply.statusCode||502,{...reply.headers,'cache-control':'no-store'});reply.pipe(res);
  });
  upstream.on('error',()=>{if(res.headersSent){res.destroy();return;}res.writeHead(502,{'content-type':'text/plain;charset=utf-8'});res.end('Локальный сервер Satoru не запущен.');});
  req.pipe(upstream);
 });
}
