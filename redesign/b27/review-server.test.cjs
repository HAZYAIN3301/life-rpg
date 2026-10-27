const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));
test('native review proxy retains same-origin host and maps welcome root with query',async t=>{
 const {createReviewServer}=await import('./review-server.mjs');
 const backend=http.createServer((req,res)=>{let accepted=true;if(req.headers.origin)accepted=new URL(req.headers.origin).host===req.headers.host;res.writeHead(accepted?200:403,{'content-type':'application/json'});res.end(JSON.stringify({url:req.url,host:req.headers.host}));});
 const upstreamPort=await listen(backend),proxy=createReviewServer({upstreamPort,welcome:true}),port=await listen(proxy);
 t.after(async()=>{await close(proxy);await close(backend);});
 const post=await fetch('http://127.0.0.1:'+port+'/api/focus/sessions',{method:'POST',headers:{origin:'http://127.0.0.1:'+port}});assert.equal(post.status,200);
 const rootResponse=await fetch('http://127.0.0.1:'+port+'/?lang=ru');assert.equal(new URL(rootResponse.url).searchParams.get('welcome'),'1');const root=await rootResponse.json();assert.equal(root.url,'/redesign/live.html?lang=ru&welcome=1');
 const asset=await (await fetch('http://127.0.0.1:'+port+'/redesign/live-ui.js')).json();assert.equal(asset.url,'/redesign/live-ui.js');
});
