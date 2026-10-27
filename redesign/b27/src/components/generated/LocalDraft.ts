import {useEffect,useState} from 'react';
function comparable(value:any,isNew:boolean){return JSON.stringify(isNew?{...value,id:'',created:''}:value);}
export function useDraft<T>(key:string,initial:T){
  const storageKey='satoru.plan.draft.'+key;
  const [snapshot]=useState(()=>{try{const raw=sessionStorage.getItem(storageKey);if(!raw)return null;return JSON.parse(raw);}catch{return null;}});
  const isNew=key.includes('new')||key.includes('source-');
  const compatible=snapshot?.base!==undefined&&comparable(snapshot.base,isNew)===comparable(initial,isNew);
  const [value,setValue]=useState<T>(()=>compatible?snapshot.value:initial),[warning,setWarning]=useState('');
  useEffect(()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({base:initial,value}));}catch{setWarning('Черновик не сохранён. Оставь форму открытой до сохранения.');}},[value,storageKey]);
  const clear=()=>{try{sessionStorage.removeItem(storageKey);}catch{}};
  return {value,setValue,clear,hint:warning||(compatible?'Черновик восстановлен.':snapshot?'Запись изменилась. Открыта свежая версия.':'Черновик сохранится в этой вкладке.')};
}
