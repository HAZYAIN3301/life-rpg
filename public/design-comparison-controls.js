(() => {const view=document.querySelector('#comparison-view'),theme=document.querySelector('#comparison-theme'),frame=document.querySelector('iframe'),params=new URLSearchParams(location.search);
 if([...view.options].some(o=>o.value===params.get('view')))view.value=params.get('view');
 if(params.get('theme')==='light')theme.value='light';
 function update(){const query=new URLSearchParams({view:view.value,theme:theme.value});frame.src='/design-baseline/v244/index.html?'+query;document.querySelector('#comparison-current').href='/?view='+encodeURIComponent(view.value);history.replaceState(null,'','/compare.html?'+query);}
 view.addEventListener('change',update);theme.addEventListener('change',update);update();
})();
