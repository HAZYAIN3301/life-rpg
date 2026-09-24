const test = require('node:test'), assert = require('node:assert/strict');
const colors = require('../public/sphere-colors-v1.js');
test('automatic descendants follow parent while explicit legacy colors survive', () => {
  const skills = [{id:'p',color:'#406080'}, {id:'a',parentId:'p',colorMode:'auto'}, {id:'b',parentId:'p'}, {id:'m',parentId:'p',color:'#ee2288'}, {id:'g',parentId:'a',colorMode:'auto'}];
  const before = structuredClone(skills), first = colors.resolve(skills);
  assert.deepEqual(skills, before); assert.notEqual(first[1].color,first[2].color);
  assert.equal(first[3].color,'#ee2288');
  const next = colors.resolve(skills.map(s=>s.id==='p'?{...s,color:'#205030'}:s));
  assert.notEqual(first[1].color,next[1].color);assert.notEqual(first[4].color,next[4].color);
  assert.equal(next[3].color,first[3].color);
});
test('manual override, orphan and cycle remain finite valid colors', () => {
  const out = colors.resolve([{id:'a',parentId:'b',colorMode:'auto'}, {id:'b',parentId:'a',colorMode:'auto'}, {id:'o',parentId:'missing'}, {id:'m',parentId:'a',colorMode:'manual',color:'#010203'}]);
  assert.ok(out.every(s=>/^#[0-9a-f]{6}$/i.test(s.color)));assert.equal(out[3].color,'#010203');
});
test('black and white parents still produce distinct visible child shades', () => {
  for (const color of ['#000000','#ffffff']) {
    const out=colors.resolve([{id:'p',color},...[0,1,2].map(id=>({id:String(id),parentId:'p',colorMode:'auto'}))]);
    assert.equal(new Set(out.map(s=>s.color)).size,4);
  }
});
