/* Satoru Guide v3 — Ukrainian (Українська) runtime copy.
 *
 * Translated from the Albert-approved Russian source (guide-v3-copy-ru.js,
 * VERSION 1.0.0/runtime-approved) after the RU tone gate closed. Mirrors its
 * exact key set and every {placeholder} — see scripts/guide-v3-copy-locales-v1.test.js,
 * which enforces both. Terminology (Лігво, Плем'я, Улюбленці, Герой, Прогрес,
 * Помічник, Іскра/Дух/Вартовий/Хранитель, etc.) matches the existing I18N_UK /
 * per-key {en,de,uk,es} tables in app.js — cross-checked, not guessed.
 *
 * A genuine translation, not a transliteration: same casual, warm, slightly
 * cheeky register as the approved RU source.
 *
 * context.rewards.choose nods at Fullmetal Alchemist's law of equivalent exchange
 * (Albert's explicit choice: attribute rather than hide it), paraphrased rather
 * than reproducing a specific published translation's line verbatim.
 *
 * Pure UMD module: no DOM, State, storage, network, or translator access.
 * Callers must escape user-provided substitutions before inserting formatted
 * text into HTML. format() intentionally performs text substitution only.
 */
(function exposeGuideV3CopyUk(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuideV3CopyUk = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGuideV3CopyUk() {
  'use strict';

  const VERSION = '0.1.0';
  const LOCALE = 'uk';
  const STATUS = 'translated';

  const CONTEXTUAL_STATUS = Object.freeze({
    habits: 'draft-ready',
    goals: 'deferred-questionnaire',
    calendar: 'draft-ready',
    notes: 'draft-ready',
    voice: 'draft-ready',
    jarvis: 'draft-ready',
    systemTheme: 'draft-ready',
    rewards: 'draft-ready',
    hero: 'draft-ready',
    den: 'draft-ready',
    pets: 'draft-ready',
    tree: 'draft-ready',
    stats: 'draft-ready',
    tribe: 'draft-ready',
  });

  const COPY = Object.freeze({
    "chapter.first.title": "Перша подорож",
    "chapter.habits.title": "Звички",
    "chapter.goals.title": "Цілі",
    "chapter.calendar.title": "Календар",
    "chapter.notes.title": "Нотатки",
    "chapter.voice.title": "Голос Тіні",
    "chapter.jarvis.title": "Особистий помічник",
    "chapter.system_theme.title": "Тема системи",
    "chapter.rewards.title": "Нагороди",
    "chapter.hero.title": "Герой",
    "chapter.den.title": "Лігво",
    "chapter.pets.title": "Улюбленці",
    "chapter.tree.title": "Дерево навичок",
    "chapter.stats.title": "Статистика",
    "chapter.tribe.title": "Плем'я",

    "system.action.start": "Почати",
    "system.action.later": "Пізніше",
    "system.action.next": "Далі",
    "system.action.back": "Назад",
    "system.action.close": "Закрити",
    "system.action.skip_chapter": "Пропустити розділ",
    "system.action.disable_prompts": "Не показувати підказки",
    "system.action.enable_prompts": "Увімкнути підказки",
    "system.action.resume": "Продовжити",
    "system.action.replay": "Пройти ще раз",
    "system.action.retry": "Повторити",
    "system.action.save": "Зберегти",
    "system.action.show": "Показати",
    "system.action.not_now": "Не зараз",
    "system.action.understood": "Зрозуміло",
    "system.action.okay": "Гаразд",
    "system.action.speak": "Озвучити",
    "system.action.stop_voice": "Зупинити голос",
    "system.action.replay_voice": "Повторити репліку",
    "system.action.my_step": "Це мій крок",
    "system.action.choose_other": "Обрати інше",
    "system.action.run_focus": "Запустити",
    "system.action.without_timer": "Зроблю без таймера",
    "system.action.stay_today": "Залишитися на Сьогодні",
    "system.action.whats_next": "Що буде далі?",
    "system.action.touch_shadow": "Торкнутися Тіні",
    "system.progress": "Крок {current} з {total}",
    "system.saving": "Зберігаю…",
    "system.saved": "Збережено",
    "system.save_failed": "Не вдалося зберегти. Нічого не змінено — спробуй ще раз.",
    "system.offline": "Зараз немає зв'язку. Гайд збереже це місце і продовжить, коли застосунок знову зможе записати результат.",
    "system.voice_unavailable": "Голос зараз недоступний. Репліка залишається на екрані.",
    "system.target_unavailable": "Потрібний елемент зараз недоступний. Закрий відкрите вікно або повернися до цього кроку пізніше.",
    "system.chapter_complete": "Розділ завершено",
    "system.chapter_snoozed": "Гаразд. Повернемося до цього пізніше.",
    "system.replay_no_reward": "Повтор допомагає згадати механіку, але не видає досвід, золото чи зв'язок повторно.",
    "system.global_disable_confirm": "Вимкнути всі нові підказки? Пройдені розділи та довідник залишаться доступними.",

    "first.episode.meeting.title": "Зустріч",
    "first.episode.recognition.title": "Твій перший крок",
    "first.episode.selection.title": "Вибір",
    "first.episode.start.title": "Почати справу",
    "first.episode.wait.title": "Справжня дія",
    "first.episode.victory.title": "Перша перемога",
    "first.episode.level.title": "Рівень і Форма",
    "first.episode.bond.title": "Знайомство з Тінню",
    "first.episode.release.title": "Далі самостійно",
    "first.meeting": "Вітаю, гравцю! Я — Тінь, твій помічник. Спочатку покажу тільки те, що знадобиться прямо зараз. До решти повернемося, коли будеш готовий. Я завжди поруч.",
    "first.recognition.seed": "Ти писав, що для тебе важливо {goalOrSphere}. Ось перший крок, який з цього вийшов: «{firstQuest}». Не абстрактний план — річ, яку можна зробити.",
    "first.recognition.seed_neutral": "Ось перший крок, який вийшов із твого налаштування: «{firstQuest}». Не абстрактний план — річ, яку можна зробити.",
    "first.recognition.create": "Почнемо з одного кроку. Не з нового життя цілком — просто з того, що справді можна зробити сьогодні.",
    "first.create.label": "Одна справа на сьогодні",
    "first.create.placeholder": "Наприклад: пройтися десять хвилин",
    "first.create.sphere_label": "Сфера цього кроку",
    "first.selection": "Це буде твій наступний крок. Якщо зараз не час — нічого страшного: він залишиться тут, а ти повернешся, коли зможеш.",
    "first.start": "Коли важко увійти в справу, натисни ▶. Satoru утримає час і один фокус, щоб тобі не довелося тримати їх у голові.",
    "first.wait": "Ну а тепер — сама справа! Так, отак одразу. Ти ж не Brawl Stars завантажив — тут продуктивність, розвиток і все таке. Тож берися до діла, я почекаю. Познач її виконаною лише коли вона й справді закінчена, і ми продовжимо.",
    "first.wait.resume": "Ти повернувся. Наш крок усе ще тут. Якщо він уже зроблений, познач це чесно; якщо ні — продовжуй у своєму темпі.",
    "first.victory": "Ось тепер це стало зростанням: досвід — у твою сферу, золото — на нагороди, виконана справа — в історію. Не за обіцянку. За те, що ти зробив.",
    "first.level_form": "Можеш уявити це так: рівень — це як пояс у бойових мистецтвах. Його в тебе ніхто не забере, доведена майстерність не згорає через паузу. Однак якщо довго не займаєшся, навички гіршають — падає «свіжість форми».",
    "first.bond": "Здоров! Давай кулачок!",
    "first.bond.complete": "Гаразд. Тепер ми знайомі.",
    "first.release": "Усе, чемпіоне! На сьогодні пауза. Коли нова частина Satoru справді знадобиться, я покажу її окремо. Ці та інші «уроки» можеш знайти в розділі «Як грати». А тепер хід за тобою. Гарного продуктивного дня!",
    "first.teaser": "Далі з'являться звички, цілі й твій Герой. Пізніше — Лігво, улюбленці, навички та Плем'я. Не все одразу: спочатку хай сьогоднішній крок стане твоїм.",
    "first.skip": "Гаразд. Твій день залишиться твоїм. Якщо захочеш, продовжити знайомство можна в довіднику.",

    "context.habits.prompt": "Одна справа допомагає сьогодні. Повторювана змінює те, якою людиною ти стаєш. Хочеш разом перетворити один знайомий крок на звичку?",
    "context.habits.choose": "Обери крок, який справді хочеш повторювати. Новий вигадувати не обов'язково.",
    "context.habits.schedule": "Познач дні, коли цей ритм реалістичний. Розклад можна змінити пізніше.",
    "context.habits.two_minute": "Додай версію на дві хвилини — найменший чесний вхід у звичку у важкий день.",
    "context.habits.complete": "Готово. Серія показує ритм, але не створює борг. Пропустиш — ми просто продовжимо з наступного разу.",

    "context.calendar.prompt": "У цієї справи з'явився свій час. Хочеш поставити її в календар, щоб вона не сперечалася з сьогоднішнім кроком?",
    "context.calendar.guide": "Обери реальну справу, дату і, якщо потрібно, час. Ми змінюємо лише її місце в плані.",
    "context.calendar.complete": "Готово. Справа залишилася твоєю — ми тільки знайшли їй місце.",

    "context.notes.prompt": "Не кожна думка має одразу ставати справою. Хочеш зберегти одну без рішення прямо зараз?",
    "context.notes.capture": "Запиши думку як є. Пізніше її можна залишити нотаткою або перетворити на конкретний крок.",
    "context.notes.complete": "Збережено. Тепер цю думку не треба тримати в голові.",

    "context.voice.prompt": "Я можу вимовляти репліки вголос постійним голосом. Текст усе одно залишиться на екрані. Хочеш перевірити?",
    "context.voice.complete": "Голос можна зупинити, повторити або повністю вимкнути в налаштуваннях.",

    "context.jarvis.prompt": "Якщо важко зрозуміти, що зараз головне, можна запитати мене про свій день. Я подивлюся на доступні дані й запропоную один наступний крок.",
    "context.jarvis.complete": "Це діалог, а не команда. Відповідь можна прийняти, змінити або залишити без дії.",

    "context.system_theme.prompt": "Satoru може слідувати світлій або темній темі пристрою. Це змінює тільки оформлення.",
    "context.system_theme.complete": "Готово. Тему можна змінити будь-коли.",

    "context.rewards.prompt": "У тебе вже є зароблене золото. Хочеш обміняти його на одну нагороду, яку ти обрав для себе?",
    "context.rewards.choose": "Щоб щось отримати, треба щось віддати натомість — так, це майже дослівно із «Сталевого алхіміка», але істина є істина.",
    "context.rewards.complete": "Нагороду куплено. Тепер головне — справді нею скористатися.",

    "context.hero.prompt": "Герой відображає доведений прогрес у твоїх сферах. Тут немає окремої сили, яку треба фармити заради картинки.",
    "context.hero.complete": "Образ змінюється разом із твоїм шляхом, але вже прожитий прогрес не зникає.",

    "context.den.prompt": "Лігво — місце, де живуть Тінь, Герой і улюбленці. Воно відкривається поступово разом із твоєю історією.",
    "context.den.complete": "Роздивись без поспіху. Повертатися сюди можна тоді, коли хочеться побачити свій світ, а не перевірити список справ.",

    "context.pets.prompt": "Улюбленці відображають головні життєві сфери. Їхній стан показує час, витрачений на кожну з них. Якщо ти давно нічого не робив у сфері, улюбленець починає голодувати; якщо ж останнім часом не робив нічого, крім цього, він переїдає і може мало не луснути від ожиріння. Так ти можеш підтримувати сфери в балансі й не вигорати в тому, що тобі важливо, — намагайся тримати їх приблизно посередині. Це орієнтир, не докір і не покарання. За допомогою ШІ та твого фідбеку я зможу налаштувати твоє особисте «колесо балансу».",
    "context.pets.complete": "Обери одного улюбленця й подивись, з якою сферою він пов'язаний. Виправляти все одразу не треба.",

    "context.tree.prompt": "У тебе з'явилося очко навички. У Дереві воно відкриває практику на реальному шляху сфери, а не випадковий бонус.",
    "context.tree.complete": "Готово. Наступні вузли з'являться тоді, коли для них буде доведений прогрес.",

    "context.stats.prompt": "Назбиралося достатньо днів, щоб побачити ритм без здогадок. Хочеш подивитися одну закономірність?",
    "context.stats.complete": "Статистика показує спостереження, а не оцінку тебе. Рішення все одно залишається за тобою.",

    "context.tribe.prompt": "Плем'я відкриває спільну гру. Нічого не публікується і не порівнюється без окремої згоди.",
    "context.tribe.complete": "Ти сам обираєш, чи брати участь у Племені і які соціальні можливості вмикати.",

    "library.title": "Як грати",
    "library.subtitle": "Короткі розділи з'являються тоді, коли можуть знадобитися. Їх можна пропустити й пройти пізніше.",
    "library.continue": "Продовжити знайомство",
    "library.available": "Доступно зараз",
    "library.completed": "Пройдено",
    "library.locked": "З'явиться пізніше",
    "library.locked_condition": "Відкриється: {condition}",
    "library.replay_note": "Повтор не змінює дані і не видає нагороди повторно.",
    "library.search.label": "Пошук у довіднику",
    "library.search.placeholder": "Знайти функцію або механіку",
    "library.empty_search": "Нічого не знайдено. Спробуй інше слово.",
    "library.overview.title": "Що робить Satoru особливим",
    "library.overview.body": "Satoru (яп. «просвітлення») — не «ще один застосунок для продуктивності». Це трекер життя й особистий секретар, доступний 24/7. За допомогою вбудованого ШІ він допомагає не тільки бути продуктивним, а й не вигорати, нагадуючи про баланс у сферах, відпочинок і пригоди, пропонуючи варіанти індивідуально під кожного.",
    "library.goals.deferred": "Розділ про цілі з'явиться після затвердження нової механіки і зв'язку з майбутньою анкетою.",
    "library.disable_prompts.note": "Це вимкне нові контекстні підказки. Довідник і пройдені розділи залишаться доступними.",

    "a11y.guide_dialog": "Гайд Satoru",
    "a11y.guide_status": "Репліка Тіні",
    "a11y.spotlight_target": "Елемент, про який зараз говорить Тінь",
    "a11y.shadow_visual": "Тінь · {form}",
    "a11y.shadow_alt": "Тінь, форма {form}: {state}",
    "a11y.form.spark": "Іскра",
    "a11y.form.spirit": "Дух",
    "a11y.form.guardian": "Вартовий",
    "a11y.form.keeper": "Хранитель",
    "a11y.state.arrive": "з'являється поруч",
    "a11y.state.close_speak": "говорить із користувачем",
    "a11y.state.listen": "слухає",
    "a11y.state.direct": "спрямовує увагу",
    "a11y.state.recognize": "впізнає знайому ціль",
    "a11y.state.celebrate": "радіє виконаній справі",
    "a11y.state.wait": "спокійно чекає",
    "a11y.state.return": "зустрічає після повернення"
  });

  function has(key) {
    return Object.prototype.hasOwnProperty.call(COPY, key);
  }

  function get(key) {
    return has(key) ? COPY[key] : null;
  }

  function format(key, variables) {
    const source = get(key);
    if (source == null) return null;
    const values = variables && typeof variables === 'object' ? variables : {};
    return source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    ));
  }

  function entries() {
    return Object.entries(COPY);
  }

  return Object.freeze({
    VERSION,
    LOCALE,
    STATUS,
    COPY,
    CONTEXTUAL_STATUS,
    has,
    get,
    format,
    entries,
  });
});
