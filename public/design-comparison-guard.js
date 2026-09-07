// Defence in depth; server CSP sandbox/connect-src/form-action remains the boundary.
window.fetch=async()=>new Response(JSON.stringify({error:'Архив для сравнения: действия с аккаунтом отключены.'}),{status:403,headers:{'Content-Type':'application/json'}});
try{navigator.sendBeacon=()=>false;}catch{}
document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();alert('Это сохранённый интерфейс для сравнения. Данные аккаунта здесь не изменяются.');},true);
