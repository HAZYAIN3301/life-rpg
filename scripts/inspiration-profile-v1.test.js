'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Profile = require('../public/inspiration-profile-v1.js');
const Catalog = require('../public/inspiration-catalog-v1.js');

const DAY = '2026-08-29';
const NEXT_DAY = '2026-08-30';

function profile(over = {}) {
  return Profile.configure(Object.assign({
    interests: [
      { id: 'animation', label: 'Анимация', source: 'Цели' },
      { id: 'science', label: 'Наука', source: 'Профиль Тени' },
      { id: 'fitness', label: 'Спорт', source: 'Сферы' },
    ],
    formats: Profile.FORMATS.slice(),
    blocked: [],
  }, over));
}

function row(id, format, interestIds, body = `Материал ${id}`) {
  return { id, format, interestIds, title: `Название ${id}`, body };
}

test('дневная подборка конечна, содержит максимум три материала и стабильна при reload', () => {
  const p = profile();
  const catalog = Catalog.items('ru');
  const first = Profile.ensureDigest(p, catalog, DAY);

  assert.equal(first.items.length, Profile.DIGEST_SIZE);
  assert.equal(first.items.length, 3);
  assert.deepEqual(first.profile.digest.ids, first.items.map((item) => item.id));

  for (let reload = 0; reload < 5; reload += 1) {
    const again = Profile.ensureDigest(JSON.parse(JSON.stringify(first.profile)), catalog.slice().reverse(), DAY);
    assert.deepEqual(again.items.map((item) => item.id), first.items.map((item) => item.id),
      'сохранённая дневная тройка не должна меняться ни от reload, ни от порядка каталога');
    assert.deepEqual(again.profile.digest, first.profile.digest);
  }

  assert.equal(Profile.choose(catalog, p, DAY, 999).length, 3, 'параметром нельзя превратить подборку в ленту');
});

test('feedback влияет только на будущую подборку, но не переписывает текущую', () => {
  const p = profile({
    interests: [{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }],
    formats: ['quote'],
  });
  const catalog = [
    row('alpha-card', 'quote', ['alpha']),
    row('beta-card', 'quote', ['beta']),
  ];
  const current = Profile.ensureDigest(p, catalog, DAY);
  const selected = current.items[0];
  const other = catalog.find((item) => item.id !== selected.id);

  const learned = Profile.recordFeedback(current.profile, selected, 'not_for_me', DAY);
  const sameDay = Profile.ensureDigest(learned, catalog, DAY);
  assert.equal(sameDay.items[0].id, selected.id, 'ответ не должен подменять уже обещанную дневную карточку');
  assert.equal(sameDay.profile.digest.doneIds.includes(selected.id), true);

  const tomorrow = Profile.ensureDigest(learned, catalog, NEXT_DAY);
  assert.equal(tomorrow.items[0].id, other.id, 'явное «не моё» должно изменить следующий день');
  assert.equal(learned.feedback.at(-1).verdict, 'not_for_me');
});

test('до 10 видео-референсов сохраняются безопасно и уточняют будущий порядок', () => {
  const references = Array.from({ length: 12 }, (_, index) => ({
    url: `https://www.tiktok.com/@creator/video/${1000 + index}`,
    why: index === 0 ? 'Меня мотивируют космос и научные исследования' : `Причина ${index}`,
  }));
  references.push({ url: 'javascript:alert(1)', why: 'bad' }, references[0]);
  const p = profile({
    interests: [{ id: 'science', label: 'Наука' }], formats: ['quote'], videoReferences: references,
  });
  assert.equal(p.videoReferences.length, Profile.MAX_VIDEO_REFERENCES);
  assert.ok(p.videoReferences.every((item) => item.url.startsWith('https://')));
  assert.equal(new Set(p.videoReferences.map((item) => item.url)).size, p.videoReferences.length);
  assert.deepEqual(p.videoReferences[0].interestIds.sort(), ['science', 'space']);

  const catalog = [
    row('generic-science', 'quote', ['science'], 'Научный метод'),
    row('space-science', 'quote', ['science', 'space'], 'Космос и телескопы'),
  ];
  assert.equal(Profile.choose(catalog, p, DAY)[0].id, 'space-science',
    'положительный видео-референс должен усиливать совпадающие темы');
});

test('объяснение к понравилось/не понравилось хранится и усиливает понятные алгоритму причины', () => {
  const p = profile({ interests: [{ id: 'science', label: 'Наука' }], formats: ['quote'] });
  const seed = row('seed', 'quote', ['science'], 'Исследование привычек');
  const learned = Profile.recordFeedback(p, seed, 'more', DAY, 'Мне особенно понравились космос и телескопы');
  const feedback = learned.feedback.at(-1);
  assert.equal(feedback.reason, 'Мне особенно понравились космос и телескопы');
  assert.ok(feedback.reasonInterestIds.includes('space'));

  const candidates = [
    row('generic', 'quote', ['science'], 'Общий научный материал'),
    row('space', 'quote', ['science', 'space'], 'Космос и телескопы'),
  ];
  assert.equal(Profile.choose(candidates, learned, NEXT_DAY)[0].id, 'space');
  const withoutReason = Profile.recordFeedback(p, seed, 'more', DAY);
  assert.equal(Object.hasOwn(withoutReason.feedback.at(-1), 'reason'), false,
    'объяснение остаётся необязательным');
});

test('форматы и исключённые темы — жёсткие фильтры, а не пожелания ранжированию', () => {
  const p = profile({
    interests: [{ id: 'science', label: 'Наука' }, { id: 'sport', label: 'Спорт' }],
    formats: ['quote', 'podcast'],
    blocked: ['политика', 'травма'],
  });
  const catalog = [
    row('allowed-quote', 'quote', ['science'], 'Чистый опыт'),
    row('wrong-format', 'video', ['science'], 'Научное видео'),
    row('blocked-body', 'podcast', ['science'], 'Политика научных институтов'),
    row('blocked-interest', 'quote', ['sport', 'травма'], 'Восстановление'),
    row('allowed-podcast', 'podcast', ['sport'], 'Ритм движения'),
  ];

  assert.deepEqual(Profile.choose(catalog, p, DAY).map((item) => item.id).sort(), ['allowed-podcast', 'allowed-quote']);
  assert.ok(Profile.choose(catalog, p, DAY).every((item) => p.formats.includes(item.format)));
});

test('профиль требует явного подтверждения интересов и чистит недоверенный ввод', () => {
  const empty = Profile.normalize({ configured: true, interests: [], formats: ['video'] });
  assert.equal(empty.configured, false, 'пустой импорт не считается согласием');

  const p = Profile.configure({
    interests: [
      { id: 'Space!', label: '  Космос  ', source: '  Цель   ' },
      { id: 'space', label: 'Дубликат' },
      null,
      { id: '', label: '' },
    ],
    formats: ['video', 'video', 'unknown'],
    blocked: [' Politics ', 'politics', '', 'hustle'],
  });
  assert.equal(p.configured, true);
  assert.deepEqual(p.interests, [{ id: 'space', label: 'Космос', source: 'Цель' }]);
  assert.deepEqual(p.formats, ['video']);
  assert.deepEqual(p.blocked, ['Politics', 'hustle']);
});

test('ноль выбранных форматов остаётся нулём и не может стать настроенным профилем', () => {
  const normalized = Profile.normalize({
    configured: false,
    interests: [{ id: 'science', label: 'Наука' }],
    formats: [],
  });
  assert.deepEqual(normalized.formats, [],
    'явное «ничего не показывать» нельзя молча заменять всеми форматами');

  const configured = Profile.configure(normalized);
  assert.equal(configured.configured, false,
    'профиль без единого формата не должен проходить submit-контракт');
  assert.deepEqual(configured.formats, []);
  assert.deepEqual(Profile.choose(Catalog.items('ru'), configured, DAY), []);
});

test('пользовательские Spider-Verse и Re:Zero получают каталожные semantic tags', () => {
  const custom = Profile.configure({
    interests: [
      { id: 'Spider-Verse', label: 'Spider-Verse', source: 'Добавлено тобой' },
      { id: 'Re:Zero', label: 'Re:Zero', source: 'Добавлено тобой' },
    ],
    formats: Profile.FORMATS.slice(),
  });
  const ids = new Set(custom.interests.map((interest) => interest.id));
  assert.equal(ids.has('superhero'), true,
    'Spider-Verse должен связываться с superhero, а не становиться заведомо пустым id');
  assert.equal(ids.has('anime'), true,
    'Re:Zero должен связываться с anime, а не становиться заведомо пустым id');

  const selected = Profile.choose(Catalog.items('ru'), custom, DAY);
  assert.ok(selected.length > 0, 'темы из подсказки настройки обязаны давать безопасную подборку');
  assert.ok(selected.some((item) => item.interestIds.includes('superhero') || item.interestIds.includes('anime')));
});

test('локализованный пример путешествий не создаёт пустой custom id', () => {
  for (const label of ['Путешествия', 'Travel', 'Reisen', 'Подорожі', 'Viajes']) {
    const p = Profile.configure({ interests: [{ id: label, label }], formats: Profile.FORMATS.slice() });
    assert.deepEqual(p.interests.map((interest) => interest.id), ['travel'], label);
    assert.ok(Profile.choose(Catalog.items('ru'), p, DAY).length > 0, `${label}: пустая подборка`);
  }
});

test('внешние материалы имеют источник, права и атрибуцию; iframe не запускается сам', () => {
  const allowedEmbedHosts = new Set(['www.youtube-nocookie.com', 'www.nps.gov', 'www.dvidshub.net']);
  const external = Catalog.CATALOG.filter((item) => item.sourceUrl || item.embedUrl || item.rightsKind !== 'satoru-original');
  assert.ok(external.length >= 5, 'стартовая подборка должна содержать проверенные внешние источники');

  for (const item of external) {
    assert.ok(item.provider, `${item.id}: нет provider`);
    assert.ok(item.attribution && item.attribution !== 'Satoru', `${item.id}: нет внешней атрибуции`);
    assert.ok(item.rightsKind && item.rightsKind !== 'satoru-original', `${item.id}: не указан вид прав`);
    assert.match(item.rightsUrl || '', /^https:\/\//, `${item.id}: нет страницы прав`);
    assert.match(item.sourceUrl || '', /^https:\/\//, `${item.id}: нет официального источника`);

    if (item.mediaPolicy === 'iframe') {
      const embed = new URL(item.embedUrl);
      assert.equal(embed.protocol, 'https:');
      assert.equal(allowedEmbedHosts.has(embed.hostname), true, `${item.id}: iframe ведёт на недоверенный host`);
      assert.equal(embed.searchParams.has('autoplay'), false, `${item.id}: autoplay запрещён`);
      assert.doesNotMatch(item.embedUrl, /(?:^|[?&])autoplay(?:=|&|$)/i);
    } else if (item.mediaPolicy === 'remote-image') {
      const image = new URL(item.imageUrl);
      assert.equal(item.format, 'image', `${item.id}: remote-image разрешён только для изображения`);
      assert.equal(image.protocol, 'https:');
      assert.equal(item.embedUrl, undefined);
    } else {
      assert.equal(item.mediaPolicy, 'link', `${item.id}: неизвестная внешняя политика`);
      assert.equal(item.embedUrl, undefined, `${item.id}: link-only материал не должен тихо стать embed`);
    }
  }

  for (const locale of Catalog.LOCALES) {
    const localized = Catalog.items(locale);
    assert.equal(localized.length, Catalog.CATALOG.length);
    for (const item of localized) {
      assert.ok(item.title && item.body, `${item.id}: неполный ${locale} copy`);
    }
  }
});

test('каталог не выдаёт текстовую заглушку за видео, эдит, картинку или подкаст', () => {
  for (const item of Catalog.CATALOG) {
    if (item.format === 'edit' || item.format === 'video') {
      assert.equal(item.mediaPolicy, 'iframe', `${item.id}: video/edit обязан быть настоящим media`);
      assert.match(item.embedUrl || '', /^https:\/\//, `${item.id}: нет запускаемого media`);
    } else if (item.format === 'image') {
      assert.equal(item.mediaPolicy, 'remote-image', `${item.id}: image обязан иметь реальное изображение`);
      assert.match(item.imageUrl || '', /^https:\/\//, `${item.id}: нет изображения`);
    } else if (item.format === 'podcast') {
      assert.equal(item.mediaPolicy, 'link', `${item.id}: podcast обязан вести на настоящий выпуск`);
      assert.match(item.sourceUrl || '', /^https:\/\//, `${item.id}: нет выпуска`);
    } else {
      assert.equal(item.format, 'quote', `${item.id}: неподдерживаемый fake-media формат`);
    }
  }
});

test('контракты персонализации и каталога не содержат engagement/reward/infinite-feed API', () => {
  const publicNames = Object.keys(Profile).concat(Object.keys(Catalog)).join(' ').toLowerCase();
  for (const bad of ['loadmore', 'nextpage', 'shuffle', 'random', 'trending', 'popular', 'likes', 'views', 'reward', 'award', 'streak', 'gold']) {
    assert.equal(publicNames.includes(bad), false, `публичный API содержит запрещённую механику «${bad}»`);
  }

  for (const item of Catalog.CATALOG) {
    for (const leak of ['likes', 'views', 'score', 'rank', 'popularity', 'reward', 'xp', 'gold', 'nextPage']) {
      assert.equal(Object.hasOwn(item, leak), false, `${item.id}: каталог содержит ${leak}`);
    }
  }

  const profileSource = fs.readFileSync(path.join(__dirname, '..', 'public/inspiration-profile-v1.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(profileSource, /Math\.random|fetch\s*\(|localStorage|document\./,
    'чистый движок не должен зависеть от случайности, сети или DOM');
});
