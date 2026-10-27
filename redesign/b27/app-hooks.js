// Runs once, from the canonical init, after its lexical State/owners exist.
const sourceRender=render;
render=function(){
 if(State.phase==='app'&&window.SatoruLiveBridge&&window.SatoruLiveView){syncDeviceAccount();if(State.view==='today')ensureSenkuDay();window.SatoruPlanBridge.originalRender();window.SatoruLiveView.render(window.SatoruLiveBridge.snapshot());return;}
 window.SatoruLiveView?.hide();sourceRender();
};
const sourceBank=bankTimerProgress;
bankTimerProgress=function(){if(window.SatoruLiveBridge){void window.SatoruLiveBridge.bank();return 0;}return sourceBank();};
const sourceFocusWidget=openFocusWidget,sourcePill=updatePill;
openFocusWidget=async function(...args){if(window.SatoruLiveBridge)return;return sourceFocusWidget(...args);};
updatePill=function(...args){if(window.SatoruLiveBridge)return;return sourcePill(...args);};
const sourceToast=toast;
toast=function(msg){sourceToast(msg);window.dispatchEvent(new CustomEvent('satoru:legacy-toast',{detail:String(msg).replace(/🪙/gu,t('золота')).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim()}));};
for(const[phase,original,assign]of[
 ['login',renderLoginScreen,f=>renderLoginScreen=f],
 ['register-language',renderRegistrationLanguageScreen,f=>renderRegistrationLanguageScreen=f],
 ['register',renderRegisterScreen,f=>renderRegisterScreen=f],
 ['reset',renderResetScreen,f=>renderResetScreen=f],
 ['reset-token',renderResetTokenScreen,f=>renderResetTokenScreen=f],
])assign(function(){original();window.SatoruStartView?.mount(phase,lang());});
if(window.SatoruStartView)window.SatoruStartView.changeLanguage=code=>{if(APP_LANGS.includes(code)){State.authLang=code;render();}};
