import {SPHERES} from './model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sphereFields(task={sphere:'Медиа'}) {
  const primary=task.spheres||[task.sphere],background=task.background||[];
  return '<details class="sphere-fields"><summary>Сферы <span class="sphere-selection">'+esc(primary.join(' · '))+(background.length?' + фон':'')+'</span></summary><div class="sphere-options"><fieldset><legend>Основные</legend>'+SPHERES.map(s=>'<label><input type="checkbox" name="spheres" value="'+s+'" '+(primary.includes(s)?'checked':'')+'>'+s+'</label>').join('')+'</fieldset><fieldset><legend>Фон</legend>'+SPHERES.map(s=>'<label><input type="checkbox" name="background" value="'+s+'" '+(background.includes(s)?'checked':'')+'>'+s+'</label>').join('')+'</fieldset></div></details>';
}
export function difficultyField(value='normal') {return '<label class="difficulty-field">Сложность<select name="difficulty">'+[['easy','Лёгкая'],['normal','Обычная'],['hard','Сложная']].map(([id,label])=>'<option value="'+id+'" '+(id===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';}
export function readTaskForm(form) {
  const data=new FormData(form),values=Object.fromEntries(data),spheres=data.getAll('spheres'),background=data.getAll('background');
  if(spheres.length===0)throw Error('Выбери хотя бы одну основную сферу.');
  return {...values,sphere:spheres[0],spheres,background};
}
export function bindSphereFields(form) {
  form.addEventListener('change',e=>{
    if(!['spheres','background'].includes(e.target.name))return;
    if(e.target.checked)form.querySelectorAll('input[name="'+(e.target.name==='spheres'?'background':'spheres')+'"]').forEach(n=>{if(n.value===e.target.value)n.checked=false;});
    const data=new FormData(form),primary=data.getAll('spheres'),back=data.getAll('background');
    form.querySelector('.sphere-selection').textContent=primary.join(' · ')+(back.length?' + фон':'')||'Выбери сферу';
  });
}
