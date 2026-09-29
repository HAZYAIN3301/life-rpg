// A transparent model using today's actual formula/catalogue; not user analytics.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), catalog=require('../public/shop-catalog-v1.js');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const pick=regex=>{const m=app.match(regex);if(!m)throw Error('formula changed: update model');return m[0];};
const formula=[pick(/const ECONOMY_GOLD_BONUS_CAP_PCT = .*?;/),pick(/const ECONOMY_DIFFICULTY = .*?;/),pick(/function economyDifficultyMultiplier\(difficulty\) \{[\s\S]*?\n\}/),pick(/function itemGold\(it\) \{[\s\S]*?\n\}/)].join('\n');
const defaults=app.match(/gold: (\{ perMinute: [^\n]+?\})/)[1];
const ctx=vm.createContext({gearBonus:()=>({goldPct:0}),skillPerks:()=>({goldPct:0})});
vm.runInContext(`const DEFAULT_SETTINGS={gold:${defaults}}; const State={settings:{}}; ${formula}`,ctx);
const earn=min=>vm.runInContext(`itemGold({estimateMin:${min},difficulty:'normal'})`,ctx);
const items=catalog.DEN_ITEMS.filter(x=>x.access==='level'&&x.cost>0);
const total=items.reduce((s,x)=>s+x.cost,0);
const goalItems=require('../public/gold-goal-v1.js').collection;
const currentThree=items.filter(x=>goalItems.includes(x.id)).reduce((s,x)=>s+x.cost,0);
const profiles=[{name:'Неспешный',minutes:[15,10]},{name:'Регулярный',minutes:[25,25,15,10,10]},{name:'Интенсивный',minutes:[60,45,30,25,20,15,10,10]}];
console.log(JSON.stringify({assumptions:'Синтетические дни; обычная сложность, штатные настройки, без бонусов, сундуков, целей и пропусков. Уровневые ограничения и траты на другие награды не учтены. Это не наблюдаемое поведение людей.',totalGoldFurnitureCost:total,currentCollectionCost:currentThree,items:items.map(({id,cost,level})=>({id,cost,level})),profiles:profiles.map(p=>{const daily=p.minutes.reduce((s,m)=>s+earn(m),0);return{name:p.name,dailyGold:daily,daysForAllGoldFurniture:Math.ceil(total/daily),daysForCurrentThree:Math.ceil(currentThree/daily)};}),existingBalance8000:{remainingAfterAll:8000-total,newGoldNeeded:Math.max(0,total-8000)}},null,2));
