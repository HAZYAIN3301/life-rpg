const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/native-input-v1.js'),'utf8');
function setup(enabled=true){const listeners={},sent=[];const w={satoruNativeSpeech:enabled,webkit:{messageHandlers:{satoruShell:{postMessage:x=>sent.push(x)}}},addEventListener:(n,f)=>listeners[n]=f,document:{addEventListener(){}}};vm.runInNewContext(source,{window:w});return{w,sent,event:d=>listeners['satoru-speech']({detail:d})};}
test('ordinary browsers keep their speech implementation',()=>{const x=setup(false);assert.equal(x.w.SpeechRecognition,undefined);assert.equal(x.sent.length,0);});
test('native recognition ignores stale sessions and commits interim words only once on stop',()=>{
 const x=setup(),rec=new x.w.SpeechRecognition(),results=[];let ended=0;
 rec.lang='uk-UA';rec.onresult=e=>results.push([e.results[0][0].transcript,e.results[0].isFinal]);rec.onend=()=>ended++;rec.start();
 const id=x.sent[0].id;assert.equal(x.sent[0].language,'uk-UA');
 x.event({id:'old',type:'result',text:'stale'});assert.equal(results.length,0);
 x.event({id,type:'result',text:'мій день',final:'false'});rec.stop();
 x.event({id,type:'result',text:'мій день',final:'true'});assert.equal(results.length,2);
 x.event({id,type:'end'});assert.equal(ended,1);assert.equal(results.length,2);assert.equal(results[1][1],true);
 x.event({id,type:'result',text:'late',final:'true'});assert.equal(results.length,2);
});
test('starting another capture aborts the previous one and does not accept its transcript',()=>{
 const x=setup(),a=new x.w.SpeechRecognition(),b=new x.w.SpeechRecognition();let stale=0;a.onresult=()=>stale++;a.start();const id=x.sent[0].id;b.start();
 assert.equal(x.sent[1].action,'speech-stop');x.event({id,type:'result',text:'private'});assert.equal(stale,0);b.abort();
});
