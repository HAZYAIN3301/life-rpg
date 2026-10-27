const PET_DARK = 'rgba(0,0,0,0.16)';
const PET_SPECIES = {
  bodyToad: { // утверждённый BODY Guardian v1 — полнохолстовый cut-paper raster
    slots: { head: [60, 40], neck: [60, 92], back: [76, 70] },
    raster: true,
    guardianV1: true,
    draw: () => ({ ears: '', feet: '', belly: '', extra: '', tail: '', body: '' }),
  },
  resourcesPenguin: { // утверждённый MONEY / RESOURCES Guardian v1
    slots: { head: [60, 34], neck: [60, 68], back: [78, 76] },
    raster: true,
    guardianV1: true,
    guardian: 'resources',
    draw: () => ({ ears: '', feet: '', belly: '', extra: '', tail: '', body: '' }),
  },
  round: { // дружелюбный зверёк (универсальный)
    slots: { head: [60, 48], neck: [60, 102], back: [60, 62] },
    draw: (c) => ({
      tail: `<path class="pd-tail" d="M90 92 q22 -4 19 -23 q-2 14 -17 15 q9 -10 4 -19 q-3 16 -14 19 z" fill="${c}"/>`,
      ears: `<path class="pd-ear-l" d="M36 62 q-9 -24 10 -31 q4 18 -1 31 z" fill="${c}"/><path class="pd-ear-r" d="M84 62 q9 -24 -10 -31 q-4 18 1 31 z" fill="${c}"/>`,
      feet: `<ellipse cx="46" cy="115" rx="10" ry="7.5" fill="${c}"/><ellipse cx="74" cy="115" rx="10" ry="7.5" fill="${c}"/>`,
      body: `<ellipse cx="60" cy="82" rx="37" ry="34" fill="${c}" stroke="${PET_DARK}" stroke-width="1.2"/>`,
      belly: `<ellipse cx="60" cy="92" rx="23" ry="21" fill="#fff" opacity="0.16"/>`, extra: '',
    }),
  },
  sturdy: { // крепыш (спорт/работа) — коренастый, мелкие ушки
    slots: { head: [60, 50], neck: [60, 104], back: [60, 64] },
    draw: (c) => ({
      tail: `<path class="pd-tail" d="M88 102 q15 1 17 -10 q-2 8 -15 6 z" fill="${c}"/>`,
      ears: `<path class="pd-ear-l" d="M45 52 q-6 -16 7 -18 q2 11 -3 18 z" fill="${c}"/><path class="pd-ear-r" d="M75 52 q6 -16 -7 -18 q-2 11 3 18 z" fill="${c}"/>`,
      feet: `<ellipse cx="44" cy="117" rx="12" ry="8" fill="${c}"/><ellipse cx="76" cy="117" rx="12" ry="8" fill="${c}"/>`,
      body: `<path d="M28 64 q0 -26 32 -26 q32 0 32 26 l0 28 q0 24 -32 24 q-32 0 -32 -24 z" fill="${c}" stroke="${PET_DARK}" stroke-width="1.2"/>`,
      belly: `<ellipse cx="60" cy="94" rx="24" ry="19" fill="#fff" opacity="0.15"/>`, extra: '',
    }),
  },
  fluffy: { // пушистик (творчество/социал) — большие уши, пышный хвост
    slots: { head: [60, 44], neck: [60, 104], back: [60, 60] },
    draw: (c) => ({
      tail: `<path class="pd-tail" d="M88 96 q31 -2 26 -31 q-3 20 -23 19 q15 -12 8 -27 q-5 23 -20 27 z" fill="${c}"/>`,
      ears: `<path class="pd-ear-l" d="M34 66 q-17 -29 7 -39 q8 23 2 39 z" fill="${c}"/><path class="pd-ear-r" d="M86 66 q17 -29 -7 -39 q-8 23 -2 39 z" fill="${c}"/>`,
      feet: `<ellipse cx="48" cy="116" rx="9" ry="7" fill="${c}"/><ellipse cx="72" cy="116" rx="9" ry="7" fill="${c}"/>`,
      body: `<ellipse cx="60" cy="84" rx="38" ry="35" fill="${c}" stroke="${PET_DARK}" stroke-width="1.2"/>`,
      belly: `<ellipse cx="60" cy="93" rx="24" ry="22" fill="#fff" opacity="0.16"/>`,
      extra: `<circle cx="34" cy="74" r="6" fill="${c}"/><circle cx="86" cy="74" r="6" fill="${c}"/><circle cx="40" cy="58" r="5" fill="${c}"/><circle cx="80" cy="58" r="5" fill="${c}"/>`,
    }),
  },
  slime: { // слайм (код/быт) — капля, без ушей и хвоста
    slots: { head: [60, 54], neck: [60, 102], back: [60, 68] },
    draw: (c) => ({
      tail: '', ears: '',
      feet: '',
      body: `<path d="M60 46 q27 6 31 41 q4 35 -31 37 q-35 -2 -31 -37 q4 -35 31 -41 z" fill="${c}" stroke="${PET_DARK}" stroke-width="1.2"/>`,
      belly: `<ellipse cx="60" cy="94" rx="23" ry="20" fill="#fff" opacity="0.15"/>`,
      extra: `<ellipse cx="48" cy="64" rx="9" ry="6" fill="#fff" opacity="0.3"/>`,
    }),
  },
  bird: { // птичка (язык/здоровье) — яйцо-тело, крылья вместо ушей, клюв
    slots: { head: [60, 50], neck: [60, 102], back: [60, 64] },
    draw: (c) => ({
      tail: `<path class="pd-tail" d="M86 100 q17 3 21 -6 q-4 11 -17 13 z" fill="${c}"/>`,
      ears: `<path class="pd-ear-l" d="M32 80 q-19 -7 -16 15 q13 -2 19 -9 z" fill="${c}"/><path class="pd-ear-r" d="M88 80 q19 -7 16 15 q-13 -2 -19 -9 z" fill="${c}"/>`,
      feet: `<path d="M52 116 l0 8 M48 124 h8" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M68 116 l0 8 M64 124 h8" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      body: `<ellipse cx="60" cy="84" rx="32" ry="37" fill="${c}" stroke="${PET_DARK}" stroke-width="1.2"/>`,
      belly: `<ellipse cx="60" cy="93" rx="20" ry="22" fill="#fff" opacity="0.16"/>`,
      extra: `<path d="M55 89 l5 7 l5 -7 z" fill="#ffb24b"/>`,
    }),
  },
  fortune: { // 🐈‍⬛ Кот Удачи (манэки-нэко) — Codex-арт, сфера «Доход»
    // v2 собран из пре-регистрированных 1024×1024 слоёв с явными pivot-точками.
    // assembled.png остаётся резервным цельным рендером для старых клиентов.
    slots: { head: [60, 31], neck: [60, 64], back: [78, 72] },
    raster: true,
    rigV2: true,
    draw: () => ({
      ears: '', feet: '', belly: '', extra: '', tail: '',
      body: `<image href="art/pets/fortune/assembled.png" x="5" y="3" width="111" height="124"/>`,
    }),
  },
};
function archToSpecies(arc) {
  return ({ '🏋': 'sturdy', '💼': 'fortune', '🎨': 'fluffy', '💬': 'fluffy', '💻': 'slime', '🧹': 'slime', '🗣': 'bird', '🧘': 'bird' })[arc] || 'round';
}
const PET_SPECIES_LABELS = {
  bodyToad: 'Жабий сэнсэй',
  resourcesPenguin: 'Распорядитель ресурсов',
  round: 'Огонёк',
  sturdy: 'Силач',
  fortune: 'Кот Удачи',
  fluffy: 'Пушистик',
  slime: 'Слизень',
  bird: 'Птица',
};
function genericPetMarkup(kind,color){const p=(PET_SPECIES[kind]||PET_SPECIES.round).draw(color);return `<svg viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="123" rx="32" ry="7" fill="#000" opacity=".12"/>${p.tail}${p.feet}${p.ears}${p.body}${p.belly}<circle cx="48" cy="78" r="3" fill="#26313c"/><circle cx="72" cy="78" r="3" fill="#26313c"/><path d="M54 90q6 5 12 0" fill="none" stroke="#26313c" stroke-width="2"/>${p.extra}</svg>`;}
module.exports={genericPetMarkup,PET_SPECIES_LABELS};
