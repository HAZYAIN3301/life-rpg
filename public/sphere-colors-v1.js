(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SphereColorsV1 = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const valid = color => /^#[0-9a-f]{6}$/i.test(color || '');
  const automatic = skill => skill.colorMode === 'auto' || !valid(skill.color);
  function resolve(skills) {
    const byId = new Map(skills.map(s => [s.id, s])), colors = new Map();
    function color(skill, seen = new Set()) {
      if (colors.has(skill.id)) return colors.get(skill.id);
      if (seen.has(skill.id)) return '#6c8cff';
      seen.add(skill.id);
      let result = valid(skill.color) ? skill.color : '#6c8cff';
      const parent = byId.get(skill.parentId);
      if (automatic(skill) && parent) {
        const base = color(parent, seen), siblings = skills.filter(s => s.parentId === parent.id);
        const index = Math.max(0, siblings.findIndex(s => s.id === skill.id));
        const lightness = [1, 3, 5].reduce((sum, i) => sum + parseInt(base.slice(i, i + 2), 16), 0) / 765;
        const step = [0.12, 0.2, 0.28, 0.36, 0.44, 0.52][index % 6];
        const amount = lightness > 0.85 ? -step : lightness < 0.12 ? step : [0.18, -0.18, 0.32, -0.3, 0.1, -0.1][index % 6];
        result = '#' + [1, 3, 5].map(i => {
          const v = parseInt(base.slice(i, i + 2), 16);
          return Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount)).toString(16).padStart(2, '0');
        }).join('');
      }
      colors.set(skill.id, result); return result;
    }
    return skills.map(skill => ({ ...skill, color: color(skill) }));
  }
  return Object.freeze({ automatic, resolve });
}));
