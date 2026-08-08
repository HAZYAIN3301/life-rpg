'use strict';

const assert = require('node:assert/strict');
const profile = require('../public/profile-memory-v1.js');

assert.equal(profile.VERSION, '1.0.0');
assert.equal(profile.MAX_CHARS, 3000);
assert.equal(profile.SECTIONS.length, 5);
assert.equal(profile.SECTIONS[0], 'Кто это');

// ── normalize: модели любят обернуть ответ, содержимое от этого страдать не должно
assert.equal(profile.normalize('```markdown\n## Кто это\nАльберт\n```'), '## Кто это\nАльберт');
assert.equal(profile.normalize('```\nтекст\n```'), 'текст');
assert.equal(profile.normalize('Вот обновлённый профиль:\n## Кто это\nАльберт'), '## Кто это\nАльберт');
// Преамбула И фенс вместе, в любом порядке — поймано живым прогоном: односторонний
// проход снимал преамбулу, а фенс оставлял, и в профиль уезжали ``` .
assert.equal(profile.normalize('Вот профиль:\n```markdown\n## Кто это\nАльберт\n```'), '## Кто это\nАльберт');
assert.equal(profile.normalize('```markdown\nВот профиль:\n## Кто это\nАльберт\n```'), '## Кто это\nАльберт');
assert.equal(profile.normalize('  ## Кто это\nАльберт  '), '## Кто это\nАльберт');
assert.equal(profile.normalize('a\n\n\n\nb'), 'a\n\nb', 'лишние пустые строки схлопываются');
assert.equal(profile.normalize(null), '');
assert.equal(profile.normalize(undefined), '');
// Заголовок не должен приниматься за преамбулу
assert.equal(profile.normalize('# Профиль:\nтекст'), '# Профиль:\nтекст');
// Единственная строка с двоеточием — это содержимое, а не преамбула
assert.equal(profile.normalize('Сферы: спорт, учёба'), 'Сферы: спорт, учёба');

// ── enforceBudget: обрезка по границе строки, идемпотентная
const short = 'строка раз\nстрока два';
assert.equal(profile.enforceBudget(short, 3000), short, 'влезающий текст не трогаем');

const long = ['aaaa', 'bbbb', 'cccc', 'dddd'].join('\n'); // 19 символов
const cut = profile.enforceBudget(long, 12);
assert.ok(cut.length <= 12);
assert.ok(!cut.endsWith('\n'), 'хвостовой перевод строки убран');
assert.equal(cut, 'aaaa\nbbbb', 'режем по границе строки, не по середине');
assert.equal(profile.enforceBudget(cut, 12), cut, 'идемпотентна');

// Первая строка длиннее лимита — границы строки нет, режем по слову
const oneLine = 'слово раз два три четыре пять';
const cutWord = profile.enforceBudget(oneLine, 12);
assert.ok(cutWord.length <= 12);
assert.ok(!/\s$/.test(cutWord), 'без висящего пробела');
assert.ok(!cutWord.includes('\n'));

assert.equal(profile.enforceBudget('', 100), '');
assert.equal(profile.enforceBudget(null, 100), '');
// Невалидный лимит → дефолтный бюджет, а не падение и не нулевая обрезка
assert.equal(profile.enforceBudget('текст', 0), 'текст');
assert.equal(profile.enforceBudget('текст', -5), 'текст');

// ── isEmpty
assert.equal(profile.isEmpty(null), true);
assert.equal(profile.isEmpty({}), true);
assert.equal(profile.isEmpty({ text: '' }), true);
assert.equal(profile.isEmpty({ text: '   \n  ' }), true, 'пробелы — не содержимое');
assert.equal(profile.isEmpty({ text: 'Альберт' }), false);

// ── buildPrompt
const facts = {
  lang: 'ru',
  spheres: 'Тело (ур.3), Наука (ур.2)',
  goals: '«Запустить Satoru» — через 30 дн.',
  pattern: 'Трудно начать',
  state: 'энергия 40%',
  reflections: '2026-08-06: слил вечер в телефон',
};

const first = profile.buildPrompt(facts, '', 3000);
assert.ok(first.includes('3000 символов'), 'лимит назван явно');
assert.ok(first.includes('Прошлой версии нет'));
assert.ok(first.includes('Тело (ур.3)'));
assert.ok(first.includes('слил вечер в телефон'), 'дословные слова юзера доезжают');
assert.ok(first.includes('НЕ ВЫВОДИ новых закономерностей'), 'запрет на диагностику ИИ на месте');
for (const s of profile.SECTIONS) assert.ok(first.includes(s), `раздел «${s}» в структуре`);

const update = profile.buildPrompt(facts, '## Кто это\nАльберт, 19', 3000);
assert.ok(update.includes('ПРОШЛАЯ ВЕРСИЯ ПРОФИЛЯ'));
assert.ok(update.includes('Альберт, 19'));
assert.ok(!update.includes('Прошлой версии нет'));

// Пустые факты не превращаются в пустые заголовки-мусор
const sparse = profile.buildPrompt({ lang: 'de' }, '', 3000);
assert.ok(sparse.includes('(de)'), 'язык подставлен');
assert.ok(!sparse.includes('Сферы:'), 'пустой блок не рендерится');
assert.ok(!sparse.includes('Цели:'));
assert.ok(!/Найденный паттерн/.test(sparse));

// Пробельные значения тоже считаются пустыми
assert.ok(!profile.buildPrompt({ spheres: '   ' }, '', 3000).includes('Сферы:'));

// Лимит из аргумента реально доезжает до текста промпта
assert.ok(profile.buildPrompt(facts, '', 1500).includes('1500 символов'));

// ── usage
assert.deepEqual(profile.usage({ text: 'x'.repeat(1500) }, 3000), { chars: 1500, max: 3000, pct: 50 });
assert.deepEqual(profile.usage({ text: '' }, 3000), { chars: 0, max: 3000, pct: 0 });
assert.deepEqual(profile.usage(null, 3000), { chars: 0, max: 3000, pct: 0 });
// Переполнение не даёт больше 100% — полоса в UI не должна вылезать за контейнер
assert.equal(profile.usage({ text: 'x'.repeat(9000) }, 3000).pct, 100);

console.log('profile-memory-v1: все проверки прошли');
