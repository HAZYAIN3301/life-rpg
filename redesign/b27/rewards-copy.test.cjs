const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const source=fs.readFileSync('../../public/app.js','utf8'),code=source.slice(source.indexOf('function i18nString(s, l) {'),source.indexOf('// Пост-рендер',source.indexOf('function i18nString(s, l) {')));
 const I18N={en:{},de:{},uk:{},es:{}},context={I18N,I18N_DYN:[],I18N_LVL:{},i18nWord:(key,locale)=>I18N[locale][key]||key};
 vm.runInNewContext(fs.readFileSync('rewards-copy.js','utf8')+'\n'+code,context);return context;
}
test('reward actions translate through the actual core translator while preserving personal names and balances',()=>{
 const h=harness();for(const locale of ['en','de','uk','es']){
  const name='Мой перерыв · 7 ✨';assert.equal(h.i18nString('Открыть полученную награду: '+name,locale),h.I18N[locale]['Открыть полученную награду:']+' '+name);
  assert.match(h.i18nString('Баланс 1234 золота',locale),/1234/);assert.ok(h.i18nString('Своя награда',locale));assert.ok(h.i18nString('Дата для себя',locale));
 }assert.equal(h.i18nString('Мой личный текст', 'en'),null);
});
test('reward copy installation preserves existing authored translations',()=>{
 const h=harness();h.I18N.de['Получить']='Bestehender Text';vm.runInNewContext(fs.readFileSync('rewards-copy.js','utf8'),h);assert.equal(h.I18N.de['Получить'],'Bestehender Text');
});
