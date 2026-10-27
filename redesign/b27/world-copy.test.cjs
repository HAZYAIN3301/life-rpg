const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const source=fs.readFileSync('../../public/app.js','utf8'),start=source.indexOf('function i18nString(s, l) {');
 const context={I18N:{en:{},de:{},uk:{},es:{}},I18N_DYN:[],I18N_LVL:{},i18nWord:(key,locale)=>context.I18N[locale][key]||key};
 vm.runInNewContext(fs.readFileSync('world-copy.js','utf8')+'\n'+source.slice(start,source.indexOf('// Пост-рендер',start)),context);return context;
}
test('World local dialogs and actions use the canonical translator in every supported locale',()=>{
 const h=harness();for(const locale of ['en','de','uk','es'])for(const key of ['Новый узел','Что считается результатом','Имя Тени','Новый эпизод','Сохранить эпизод','Период прогресса','Сфера пути','Записанное время']){
  const value=h.i18nString(key,locale);a.ok(value&&value!==key,locale+': '+key);
 }a.equal(h.i18nString('Личный питомец Альберта','en'),null);
});
test('World copy preserves existing translations and the numbers in accessible descriptions',()=>{
 const h=harness();h.I18N.de['Новый узел']='Vorhandener Text';vm.runInNewContext(fs.readFileSync('world-copy.js','utf8'),h);a.equal(h.I18N.de['Новый узел'],'Vorhandener Text');
 a.equal(h.i18nString('До уровня 3','en'),'To level 3');
 a.equal(h.i18nString('Опыт за 14 дней: 72 XP','en'),'Experience over 14 days: 72 XP');
});
