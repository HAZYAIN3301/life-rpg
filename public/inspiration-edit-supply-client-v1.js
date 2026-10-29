/* Finite, abortable polling of the same recorded provider run. No writes here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.InspirationEditSupplyClientV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function delay(ms,signal){return new Promise((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Error('supply_aborted'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 });}
 async function load({fetchSupply,active,signal,wait=()=>delay(8000,signal),maxPolls=23}){
  for(let i=0;i<maxPolls;i++){
   if(!active()||signal?.aborted)throw Error('supply_aborted');
   const result=await fetchSupply();if(!active()||signal?.aborted)throw Error('supply_aborted');
   if(result.editStatus!=='pending')return result;
   if(i+1<maxPolls)await wait();
  }
  throw Error('supply_pending');
 }
 return Object.freeze({load});
});
