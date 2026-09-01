'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UI = require('../public/return-shelf-ui-v1.js');
const Profile = require('../public/inspiration-profile-v1.js');
const Catalog = require('../public/inspiration-catalog-v1.js');
const t = (value) => value;

function configuredProfile() {
  return Profile.configure({
    interests: [
      { id: 'animation', label: 'Анимация', source: 'Цели' },
      { id: 'science', label: 'Наука', source: 'Сферы' },
      { id: 'fitness', label: 'Спорт', source: 'Профиль Тени' },
    ],
    formats: Profile.FORMATS.slice(),
    blocked: [],
  });
}

function digestItem(id, format, over = {}) {
  return Object.assign({
    id, format, visual: format, title: `Материал ${id}`, body: `Короткое содержание ${id}`,
    reason: ['Анимация'], attribution: 'Satoru', done: false, saved: false,
  }, over);
}

function ready(over = {}) {
  return Object.assign({
    state: 'ready', section: 'today', setupOpen: false, composerOpen: false,
    profile: configuredProfile(), suggestions: [], savedCount: 0, digestTotal: 3, digestDone: false,
    items: [
      digestItem('a', 'edit'),
      digestItem('b', 'video', { embedUrl: 'https://www.youtube-nocookie.com/embed/example' }),
      digestItem('c', 'image'),
    ],
    saved: [], archived: [],
  }, over);
}

test('первый вход начинается с импорта интересов, а не с технической формы ссылки', () => {
  const html = UI.render(ready({
    profile: Profile.emptyProfile(),
    suggestions: [
      { id: 'animation', label: 'Анимация', source: 'Активные цели' },
      { id: 'fitness', label: 'Спорт', source: 'Сферы' },
    ],
    items: [],
  }), t);

  assert.match(html, /class="inspiration-mark"/);
  assert.match(html, /Что тебя зажигает\?/);
  assert.match(html, /data-action="inspiration-import-guide-open"/);
  assert.match(html, /Как импортировать из TikTok/);
  assert.match(html, /data-inspiration-import-file/);
  assert.match(html, /У меня уже есть архив/);
  assert.match(html, /data-action="inspiration-import-links-toggle"/);
  assert.match(html, /data-action="inspiration-setup-import-satoru"/);
  assert.match(html, /Собрать из Satoru/);
  assert.match(html, /data-action="inspiration-setup-manual"/);
  assert.match(html, /Анимация/);
  assert.match(html, /Спорт/);
  assert.doesNotMatch(html, /name="url"|name="kind"|Тип материала|Экспорт и удаление данных|Энергия|Практика/);
});

test('главная Подборка конечна: ровно три карточки и явный конец вместо load more', () => {
  const html = UI.render(ready(), t);
  assert.equal((html.match(/<article class="inspiration-item/g) || []).length, 3);
  assert.equal((html.match(/data-action="inspiration-done"/g) || []).length, 3);
  assert.equal((html.match(/data-verdict="more"/g) || []).length, 3);
  assert.equal((html.match(/data-verdict="not_for_me"/g) || []).length, 3);
  assert.equal((html.match(/class="inspiration-item-more"/g) || []).length, 3,
    'feedback и source должны жить в secondary menu, а не в ряду primary controls');
  assert.match(html, /Подборка/);
  assert.match(html, /Сохранённое/);
  assert.match(html, /Почему здесь/);

  assert.doesNotMatch(html, /shelf-load-more|load-more|next-page|infinite|likes-count|views-count/i);
  assert.doesNotMatch(html, /<iframe|<video|<audio|autoplay|href=/i,
    'медиа запускается только явной кнопкой, а источник проходит через attention boundary');
  assert.doesNotMatch(html, /XP|золото|награда за просмотр|return-shelf-complete-form/i);
});

test('сохранённый feedback виден и визуально, и screen reader', () => {
  const html = UI.render(ready({
    items: [digestItem('a', 'quote', { feedbackVerdict: 'not_for_me' })], digestTotal: 1,
  }), t);
  assert.match(html, /data-verdict="not_for_me"[^>]+aria-pressed="true"/);
  assert.match(html, /data-verdict="more"[^>]+aria-pressed="false"/);
  assert.match(html, /class="inspiration-menu-action is-active"/);
});

test('завершённая тройка показывает терминал и не предлагает «ещё одно»', () => {
  const items = [
    digestItem('a', 'edit', { done: true }),
    digestItem('b', 'quote', { done: true }),
    digestItem('c', 'podcast', { done: true }),
  ];
  const html = UI.render(ready({ items, digestDone: true }), t);
  assert.match(html, /На сегодня всё/);
  assert.match(html, /Никакого «ещё одного»/);
  assert.match(html, /data-action="goto-today"/);
  assert.equal((html.match(/data-action="inspiration-done"[^>]*disabled/g) || []).length, 3);
  assert.doesNotMatch(html, /Показать ещё|Загрузить ещё|Следующая подборка/);
});

test('настройка делает интересы и форматы явными и оставляет исключения человеку', () => {
  const html = UI.render(ready({
    setupOpen: true,
    suggestions: [
      { id: 'animation', label: 'Анимация', source: 'Цели' },
      { id: 'science', label: 'Наука', source: 'Сферы' },
      { id: 'travel', label: 'Путешествия', source: 'Профиль Тени' },
    ],
  }), t);

  assert.match(html, /id="inspiration-setup-form"/);
  assert.match(html, /Темы, вселенные и образы/);
  assert.match(html, /Что показывать/);
  assert.match(html, /Что не показывать/);
  assert.match(html, /name="customInterests"/);
  assert.match(html, /name="blocked"/);
  assert.equal((html.match(/name="format"/g) || []).length, Profile.FORMATS.length);
  assert.match(html, /name="interest" value="animation"[^>]*checked/);
  assert.match(html, /Профиль Тени/);
  assert.match(html, /не публикует/);
  assert.match(html, /Выбрать архив TikTok/);
  assert.match(html, /Архив остаётся на устройстве/);
  assert.match(html, /Сообщения, контакты, входы, адреса и платежи игнорируются/);
  assert.doesNotMatch(html, /name="url"|name="kind"|name="why"|Тип материала|Экспорт/);
});

test('настройка принимает до 10 мотивирующих видео и необязательное объяснение', () => {
  const profile = Profile.normalize({ ...configuredProfile(), videoReferences: [
    { url: 'https://www.tiktok.com/@maker/video/1234567890', why: 'Нравится упорство и темп монтажа' },
  ] });
  const html = UI.render(ready({ setupOpen: true, profile }), t);
  assert.match(html, /Видео, которые тебя мотивируют/);
  assert.match(html, /data-inspiration-reference-count>1 \/ 10/);
  assert.match(html, /name="referenceUrl"[^>]+value="https:\/\/www\.tiktok\.com\/@maker\/video\/1234567890"/);
  assert.match(html, /name="referenceWhy"[\s\S]*Нравится упорство и темп монтажа/);
  assert.match(html, /maxlength="320"/);
  assert.match(html, /data-action="inspiration-reference-add"/);
  assert.match(html, /data-action="inspiration-reference-remove"/);
  assert.match(html, /Видео не загружаются в Satoru/);
});

test('редактор возвращает сохранённые ответы и честно сообщает об автосохранении', () => {
  const profile = Profile.configure({
    interests: [{ id: 'superhero', label: 'Spider-Verse', source: 'Добавлено тобой' }],
    customInterests: 'Spider-Verse, Re:Zero',
    formats: ['edit', 'video'],
  });
  const html = UI.render(ready({ setupOpen: true, profile }), t);
  assert.match(html, /name="customInterests" value="Spider-Verse, Re:Zero"/);
  assert.match(html, /Черновик сохраняется автоматически/);
  assert.match(html, />Сохранить интересы<\/button>/);
});

test('runtime хранит незавершённый профиль отдельно и очищает черновик только атомарным финальным сохранением', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(src, /function inspirationStoredDraft\([\s\S]{0,650}State\.settings\?\.inspirationDraft/);
  assert.match(src, /function queueInspirationSetupDraft\([\s\S]{0,650}persistInspirationSetupDraft/);
  assert.match(src, /base\.inspirationDraft = envelope/);
  assert.match(src, /base\.inspiration = profile; delete base\.inspirationDraft/);
  assert.match(src, /const saved = await flushInspirationSetupDraft\(form\);\s*if \(!saved\) return;/);
  assert.match(src, /#inspiration-setup-form[\s\S]{0,250}queueInspirationSetupDraft/);
  assert.match(src, /beforeunload[\s\S]{0,950}inspirationDraft/);
});

test('пояснение к понравилось и не понравилось открывается отдельно и остаётся необязательным', () => {
  const html = UI.render(ready({
    feedbackDraft: { itemId: 'a', verdict: 'not_for_me', reason: 'Слишком громко <script>' },
  }), t);
  assert.match(html, /data-action="inspiration-feedback-open"[^>]+data-verdict="more"/);
  assert.match(html, /data-action="inspiration-feedback-open"[^>]+data-verdict="not_for_me"/);
  assert.match(html, /class="inspiration-feedback-reason"/);
  assert.match(html, /Почему\? Необязательно/);
  assert.match(html, /data-action="inspiration-feedback-skip"/);
  assert.match(html, /data-action="inspiration-feedback-save"/);
  assert.match(html, /Слишком громко &lt;script&gt;/);
  assert.doesNotMatch(html, /Слишком громко <script>/);
});

test('готовый TikTok-импорт показывает только сводку и безопасные сигналы', () => {
  const html = UI.render(ready({
    setupOpen: true,
    importSession: {
      status: 'ready',
      stats: { searches: 14, hashtags: 5, videos: 22, signals: 9 },
      signals: [{ label: 'Blender animation' }, { label: '#surfing' }],
    },
  }), t);
  assert.match(html, /Профиль интересов собран/);
  assert.match(html, />14<.*Поиски/s);
  assert.match(html, /Blender animation/);
  assert.match(html, /#surfing/);
  assert.match(html, /не история просмотров/);
  assert.doesNotMatch(html, /Direct Messages|Login History|email@example\.com/);
});

test('компьютерный TikTok-мастер ведёт прямо в выгрузку и показывает весь путь до ZIP', () => {
  const html = UI.render(ready({
    setupOpen: true,
    importGuideOpen: true,
    importDevice: { kind: 'desktop', platform: 'desktop' },
  }), t);
  assert.match(html, /class="inspiration-import-guide"/);
  assert.match(html, /data-device="desktop" class="is-active" aria-pressed="true"/);
  assert.match(html, /href="https:\/\/www\.tiktok\.com\/setting\/download-your-data"/);
  assert.match(html, /Открыть нужное окно TikTok/);
  assert.match(html, /Выбери «Все данные»/);
  assert.match(html, /формат JSON/);
  assert.match(html, /Запросить данные/);
  assert.match(html, /Скачать данные/);
  assert.match(html, /папке «Загрузки»/);
  assert.match(html, /Выбрать архив TikTok/);
  assert.doesNotMatch(html, /Куда нажимать в TikTok|внизу экрана|справа сверху/);
});

test('телефонный TikTok-мастер подсказывает каждое нажатие и место скачанного файла', () => {
  const html = UI.render(ready({
    setupOpen: true,
    importGuideOpen: true,
    importDevice: { kind: 'phone', platform: 'ios' },
  }), t);
  for (const copy of ['Профиль', 'внизу экрана', 'Меню ☰', 'справа сверху',
    'Настройки и конфиденциальность', 'Аккаунт', 'Скачать ваши данные']) {
    assert.match(html, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), copy);
  }
  assert.match(html, /На iPhone и iPad архив обычно лежит в «Файлы» → «Загрузки»/);
  assert.match(html, /data-device="phone" class="is-active" aria-pressed="true"/);
  assert.equal((html.match(/class="inspiration-import-tap"/g) || []).length, 4);
});

test('Android-подсказка и ручной выбор устройства не зависят от размера окна', () => {
  const html = UI.render(ready({
    setupOpen: true,
    importGuideOpen: true,
    importDevice: { kind: 'tablet', platform: 'android' },
  }), t);
  assert.match(html, /data-device="tablet" class="is-active" aria-pressed="true"/);
  assert.match(html, /На Android архив обычно лежит в «Файлы» → «Загрузки»/);
  assert.equal((html.match(/data-action="inspiration-import-device"/g) || []).length, 3);
});

test('Сохранённое — вторичный раздел, а ручное добавление просит только материал и необязательное имя', () => {
  const catalogItem = Catalog.byId('blender-spring', 'ru');
  const html = UI.render(ready({
    section: 'saved', composerOpen: true, items: [], savedCount: 1,
    saved: [{
      id: 'saved-1', kind: 'energy', format: catalogItem.format, title: catalogItem.title,
      why: 'Сохранено из подборки', attribution: catalogItem.attribution, catalogItem,
    }],
  }), t);

  assert.match(html, /Мои материалы/);
  assert.match(html, /id="return-shelf-add-form"/);
  assert.match(html, /name="content"/);
  assert.match(html, /name="title"/);
  assert.match(html, /Формат определяется автоматически/);
  assert.match(html, /Blender Foundation/);
  assert.doesNotMatch(html, /name="url"|name="kind"|name="why"|name="expect"|Тип материала|Экспорт и удаление данных/);
  assert.doesNotMatch(html, /href=|autoplay|<iframe/i);
});

test('ручной YouTube в Сохранённом получает рабочий Play через enriched item', () => {
  const html = UI.render(ready({
    section: 'saved', items: [], savedCount: 1,
    saved: [{
      id: 'saved-youtube', kind: 'energy', format: 'video', title: 'Референс',
      why: 'Сохранено тобой', url: 'https://www.youtube.com/watch?v=WhWc3b3KhnY',
      embedUrl: 'https://www.youtube-nocookie.com/embed/WhWc3b3KhnY',
    }],
  }), t);
  assert.match(html, /data-action="inspiration-play-saved"[^>]+data-id="saved-youtube"/);

  const app = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const start = app.indexOf('function inspirationActionItem');
  const end = app.indexOf('function closeInspirationEmbed', start);
  assert.ok(start >= 0 && end > start, 'не найден runtime-контур Play');
  const playablePath = app.slice(start, end);
  assert.match(playablePath, /inspirationYoutubeEmbed\((?:item|saved)\.url\)/,
    'UI вычисляет preview, но click обязан заново получить тот же безопасный embed URL');
});

test('ошибка загрузки не маскируется под пустую подборку и сохраняет Retry', () => {
  const html = UI.render({ state: 'error', error: 'invalid' }, t);
  assert.match(html, /role="alert"/);
  assert.match(html, /Данные сохранённых материалов повреждены/);
  assert.match(html, /data-action="shelf-retry"/);
  assert.match(html, /Ничего не перезаписываем/);
  assert.doesNotMatch(html, /Что тебя зажигает\?|Пока ничего не сохранено/);
});

test('пользовательский текст экранируется, а внешняя ссылка не становится href', () => {
  const html = UI.render(ready({
    items: [digestItem('unsafe', 'quote', {
      title: '<img src=x onerror=alert(1)>', body: '"не код"', reason: ['<script>alert(2)</script>'],
      sourceUrl: 'https://example.test/?q=<x>',
    })],
    digestTotal: 1,
  }), t);
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&quot;не код&quot;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /href=/);
});

test('внешняя картинка отображается только по HTTPS и сохраняет атрибуцию', () => {
  const nasa = Catalog.byId('nasa-pale-blue-dot', 'ru');
  const good = UI.render(ready({ items: [{ ...nasa, reason: ['Космос'], done: false, saved: false }], digestTotal: 1 }), t);
  assert.match(good, /<img class="inspiration-visual-image" src="https:\/\/science\.nasa\.gov\//);
  assert.match(good, /NASA\/JPL-Caltech/);
  assert.match(good, /referrerpolicy="no-referrer"/);

  const unsafe = UI.render(ready({
    items: [digestItem('unsafe-image', 'image', { imageUrl: 'javascript:alert(1)' })], digestTotal: 1,
  }), t);
  assert.doesNotMatch(unsafe, /inspiration-visual-image|javascript:/);
});

test('каждая digest-card имеет доступное имя и все действия — кнопки', () => {
  const html = UI.render(ready({ items: [
    digestItem('quote-card', 'quote'),
    digestItem('video-card', 'video'),
    digestItem('podcast-card', 'podcast'),
  ] }), t);
  const labelledBy = [...html.matchAll(/<article[^>]+aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(labelledBy.length, 3);
  for (const id of labelledBy) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(html, new RegExp(`<[^>]+\\sid="${escapedId}"`),
      `${id}: aria-labelledby ссылается на отсутствующий заголовок`);
  }
  assert.doesNotMatch(html, /<a\b/i, 'внешний переход не должен обходить app guard');
});

test('интеграция подключает профиль и каталог до UI/app и даёт разделу собственную иконку', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(app, /shelf:\s*renderShelf/);
  assert.match(app, /iconId:\s*'nav\.inspiration'[\s\S]{0,120}label:\s*'Вдохновение'/);
  assert.match(app, /(?:id\s*===|case)\s*'nav\.inspiration'/);
  assert.match(app, /MOBILE_MORE_SECTION_IDS[^\n]*'library'/);

  const importAt = index.indexOf('inspiration-import-v1.js');
  const profileAt = index.indexOf('inspiration-profile-v1.js');
  const catalogAt = index.indexOf('inspiration-catalog-v1.js');
  const domainAt = index.indexOf('return-shelf-v1.js');
  const uiAt = index.indexOf('return-shelf-ui-v1.js');
  const appAt = index.indexOf('app.js?v=20260901-browser-companion-v212-2');
  assert.ok(importAt >= 0 && profileAt > importAt && catalogAt > profileAt && domainAt > catalogAt && uiAt > domainAt && appAt > uiAt,
    'import → profile → catalog → saved domain → UI → app');
  for (const asset of ['inspiration-import-v1.js', 'inspiration-catalog-v1.js', 'return-shelf-v1.js']) {
    assert.match(index, new RegExp(`${asset.replaceAll('.', '\\.')}\\?v=20260829-inspiration-learning-v201-1`));
    assert.match(sw, new RegExp(asset.replaceAll('.', '\\.')));
  }
  assert.match(index, /inspiration-profile-v1\.js\?v=20260830-economy-art-v208-1/);
  assert.match(index, /return-shelf-ui-v1\.js\?v=20260830-economy-art-v208-1/);
  assert.match(sw, /return-shelf-ui-v1\.js/);
  assert.match(index, /styles\.css\?v=20260901-browser-companion-v212-2/);
  assert.match(sw, /satoru-v213/);
  assert.match(app, /PWA_CACHE_VERSION = 'satoru-v213'/);
});

test('ключевой copy Вдохновения имеет RU/EN/DE/UK/ES gate', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const keys = [
    'Вдохновение', 'Подборка', 'Сохранённое', 'Что тебя зажигает?',
    'Как импортировать из TikTok', 'У меня уже есть архив', 'Вставить TikTok-ссылки', 'Собрать из Satoru',
    'Архив остаётся на устройстве', 'Настроить вручную', 'Темы, вселенные и образы',
    'Инструкция для твоего устройства', 'Открыть нужное окно TikTok', 'Настройки и конфиденциальность',
    'Скачать ваши данные', 'Выбери «Все данные»', 'Нажми «Запросить данные»', 'Вернись в Satoru',
    'Что показывать', 'Что не показывать', 'Почему здесь', 'Понравилось',
    'Не понравилось', 'Почему? Необязательно', 'Видео, которые тебя мотивируют',
    'Почему это мотивирует?', 'Без объяснения', 'Сохранить ответ', 'На сегодня всё', 'Добавить своё',
    'Открыть выпуск', 'Источник и права', 'Ещё действия', 'Настроить подборку',
    'Дальше', 'Просмотрено ✓', 'Ещё темы',
  ];
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll("'", "\\'");
    assert.match(src, new RegExp(`'${escaped}': \\{ en: [^\\n]+ de: [^\\n]+ uk: [^\\n]+ es: [^\\n]+ \\}`), key);
  }
});

test('runtime сохраняет референсы и причины feedback как обучающие сигналы, не меняя текущую тройку', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(src, /querySelectorAll\('\[data-inspiration-reference-row\]'\)[\s\S]{0,700}videoReferences/);
  assert.match(src, /enrichInspirationVideoReferences[\s\S]{0,1600}resolveTikTokLinks/);
  assert.match(src, /P\.recordFeedback\(ensured\.profile, item, verdict, todayStr\(\), reason\)/);
  assert.match(src, /action === 'inspiration-feedback-open'/);
  assert.match(src, /action === 'inspiration-feedback-skip'/);
  assert.match(src, /action === 'inspiration-feedback-save'/);
  assert.doesNotMatch(src, /recordInspirationFeedback[\s\S]{0,900}ensureDigest\([^)]*tomorrow/i);
});

test('motion остаётся конечным, touch-safe и выключается в reduced motion', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');
  const at = css.indexOf('Inspiration v196');
  const fallbackAt = css.indexOf('.inspiration-shell');
  const block = css.slice(at >= 0 ? at : fallbackAt);
  assert.match(block, /\.inspiration-(?:item-actions|setup-actions)[\s\S]*?min-(?:block-)?size:\s*var\(--touch-min\)/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.inspiration-shell \*[\s\S]*?animation:\s*none !important/);
  assert.doesNotMatch(block, /animation[^;}]*infinite/i);
});

test('звуки Вдохновения используют спокойную UI-таксономию, а не loot/reward fanfare', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const start = src.indexOf('function openInspirationSetup');
  const end = src.indexOf('async function commitShelf', start);
  const block = src.slice(start, end);
  assert.ok(start >= 0 && end > start);
  for (const sound of ['open', 'close', 'confirm', 'select']) {
    assert.match(block, new RegExp(`sfx\\('${sound}'\\)`), `нет звука ${sound}`);
  }
  assert.match(src, /action === 'inspiration-section'[\s\S]{0,220}sfx\('navigate'\)/);
  assert.match(src, /#inspiration-setup-form input\[type="checkbox"\][\s\S]{0,180}sfx\('select'\)/);
  assert.doesNotMatch(block, /sfx\('(complete|reward|purchase|loot|coin|levelup)'\)/,
    'вдохновение не должно звучать как выигрыш или игровая награда');
});
