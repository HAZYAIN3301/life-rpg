(function (w) {
  'use strict';
  const bridge = () => w.webkit?.messageHandlers?.satoruShell;
  if (!w.satoruNativeSpeech || !bridge()) return;
  let active = null, next = 0;
  class NativeSpeechRecognition {
    constructor() { this.lang = 'en-US'; this.text = ''; this.id = null; this.final = false; }
    start() {
      if (this.id) throw new Error('recognition_already_started');
      if (active) active.abort();
      this.id = `speech-${Date.now()}-${++next}`; this.text = ''; this.final = false; active = this;
      bridge().postMessage({ action: 'speech-start', id: this.id, language: this.lang });
    }
    result(text, final) {
      if (this.final) return;
      this.text = text; this.final = final;
      const result = [{transcript:text, confidence:1}]; result.isFinal = final;
      this.onresult?.({resultIndex:0,results:[result]});
    }
    stop() {
      if (!this.id) return;
      if (this.text && !this.final) this.result(this.text, true);
      bridge().postMessage({action:'speech-stop',id:this.id});
    }
    abort() {
      if (!this.id) return;
      const id=this.id;this.id=null;if(active===this)active=null;
      bridge().postMessage({action:'speech-stop',id});this.onend?.();
    }
  }
  w.addEventListener('satoru-speech', event => {
    const d=event.detail, rec=active;if(!d||!rec||d.id!==rec.id)return;
    if(d.type==='start')rec.onstart?.();
    if(d.type==='result')rec.result(String(d.text||''),d.final==='true');
    if(d.type==='error')rec.onerror?.({error:d.error||'recognition-failed'});
    if(d.type==='end'){if(rec.text&&!rec.final)rec.result(rec.text,true);rec.id=null;active=null;rec.onend?.();}
  });
  w.addEventListener('pagehide',()=>active?.abort());
  w.document?.addEventListener('visibilitychange',()=>{if(w.document.hidden)active?.stop();});
  // The native capability is advertised only by our trusted WKWebView shell.
  w.SpeechRecognition = NativeSpeechRecognition;
})(window);
