const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const paren = app.indexOf('(', start);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = paren; i < app.length; i += 1) {
    if (app[i] === '(') parenDepth += 1;
    else if (app[i] === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) { paramsEnd = i; break; }
    }
  }
  assert.notEqual(paramsEnd, -1, `${name} params must terminate`);
  const brace = app.indexOf('{', paramsEnd);
  let depth = 0;
  for (let i = brace; i < app.length; i += 1) {
    if (app[i] === '{') depth += 1;
    else if (app[i] === '}') {
      depth -= 1;
      if (depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('Day keeps seven labelled dates, three labelled tools, and three modes', () => {
  const view = functionBody('renderCalendarView');
  assert.match(view, /for \(let i = 0; i < 7; i\+\+\)/);
  assert.match(view, /class="calv-strip" role="group" aria-label=/);
  assert.match(view, /aria-pressed="\$\{selected\}"/);
  const tools = functionBody('calendarToolsHTML');
  assert.match(tools, /calExportBtn\(\)\}\$\{calSubscribeBtn\(\)\}\$\{calRemindBtn\(\)\}/);
  for (const helper of ['calExportBtn', 'calSubscribeBtn', 'calRemindBtn']) {
    assert.match(functionBody(helper), /cal-tool-icon/);
    assert.match(functionBody(helper), /cal-tool-copy/);
    assert.match(functionBody(helper), /aria-label=/);
  }
  const modes = functionBody('calModeToggle');
  for (const mode of ['day', 'week', 'month']) assert.match(modes, new RegExp(`option\\('${mode}'`));
  assert.match(css, /\.calendar-shell \.calv-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(7,\s*minmax\(var\(--touch-min\),\s*1fr\)\)/);
});

test('Day DOM is work-first and support stays secondary', () => {
  const view = functionBody('renderCalendarView');
  const work = view.indexOf('calendar-day-work');
  const schedule = view.indexOf('calendar-work-card');
  const support = view.indexOf('calendar-day-support');
  const add = view.indexOf('calendar-add-card');
  assert.ok(work >= 0 && schedule > work, 'work card must exist');
  assert.ok(support > schedule && add > support, 'support/add form must follow schedule work in DOM');
  assert.match(view, /class="calv-agenda" role="list"/);
  assert.match(view, /class="calv-grid-viewport" role="region"/);
  assert.match(functionBody('afterMainCommit'), /syncCalendarDayViewport\(\)/);
  assert.match(functionBody('syncCalendarDayViewport'), /firstTask \|\| currentTime/);
});

test('touch and keyboard use one explicit schedule editor; drag is enhancement', () => {
  const view = functionBody('renderCalendarView');
  assert.match(view, /button type="button" class="cal-agenda-main" data-action="cal-edit-task"/);
  assert.match(view, /cal-agenda-disclosure/);
  assert.match(view, /button type="button" class="calv-chip" draggable="true"[\s\S]*data-action="cal-edit-task"/);
  const editor = functionBody('openCalendarTaskEditor');
  assert.match(editor, /setAttribute\('role', 'dialog'\)/);
  assert.match(editor, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(editor, /appRoot\.inert = true/);
  assert.match(editor, /lockCalendarDialogScroll\(\)/);
  assert.match(editor, /addEventListener\('keydown', handleCalendarTaskKeydown\)/);
  const keys = functionBody('handleCalendarTaskKeydown');
  assert.match(keys, /event\.key === 'Escape'/);
  assert.match(keys, /event\.key !== 'Tab'/);
  assert.match(css, /html\.calendar-task-open,[\s\S]*html\.calendar-task-open body\s*\{[\s\S]*overflow:\s*hidden/);
  const lock = functionBody('lockCalendarDialogScroll');
  assert.match(lock, /x: window\.scrollX, y: window\.scrollY/);
  assert.match(lock, /body\.style\.position = 'fixed'/);
  assert.match(lock, /body\.style\.top = `-\$\{_calendarDialogScrollLock\.y\}px`/);
  const unlock = functionBody('unlockCalendarDialogScroll');
  assert.match(unlock, /document\.querySelector\('#cal-task-modal, #desire-pop, #cal-sub-ov'\)/);
  assert.match(unlock, /body\.style\.position = lock\.position/);
  assert.match(unlock, /window\.scrollTo\(lock\.x, lock\.y\)/);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*\.calendar-shell :is\(button, input, select, summary\)[\s\S]*min-block-size:\s*var\(--touch-min\)/);
});

test('the persistent subscription tool opens one localized accessible dialog', () => {
  const open = functionBody('showCalSubscribeModal');
  assert.match(open, /setAttribute\('role', 'dialog'\)/);
  assert.match(open, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(open, /setAttribute\('aria-labelledby', 'cal-sub-title'\)/);
  assert.match(open, /setAttribute\('aria-describedby', 'cal-sub-intro'\)/);
  assert.match(open, /appRoot\.inert = true/);
  assert.match(open, /lockCalendarDialogScroll\(\)/);
  assert.match(open, /addEventListener\('keydown', handleCalSubscribeKeydown\)/);
  assert.match(open, /event\.target === ov\) closeCalSubscribeModal\(\)/);
  assert.match(open, /aria-label="\$\{esc\(t\('Закрыть'\)\)\}"/);
  const keys = functionBody('handleCalSubscribeKeydown');
  assert.match(keys, /event\.key === 'Escape'/);
  assert.match(keys, /event\.key !== 'Tab'/);
  assert.match(keys, /pathChoiceFocusable\(overlay\)/);
  const close = functionBody('closeCalSubscribeModal');
  assert.match(close, /overlay\._calendarApp\.inert = !!overlay\._calendarAppWasInert/);
  assert.match(close, /overlay\._returnFocus && overlay\._returnFocus\.isConnected/);
  assert.match(close, /focusPathChoiceTarget\(target\)/);
  const load = functionBody('loadCalSubscribeBody');
  assert.match(load, /t\('Копировать'\)/);
  assert.match(load, /t\('Как подключить календарь'\)/);
  assert.match(load, /focusAfter[\s\S]*focusPathChoiceTarget\(document\.getElementById\('cal-sub-loading'\)\)/);
  assert.match(load, /focusPathChoiceTarget\(document\.getElementById\('cal-sub-url'\)\)/);
  assert.match(load, /focusPathChoiceTarget\(body\.querySelector\('\.cal-sub-retry'\)\)/);
  assert.match(app, /action === 'cal-sub-retry'[\s\S]*loadCalSubscribeBody\(document\.getElementById\('cal-sub-ov'\), \{ focusAfter: true \}\)/);
  assert.doesNotMatch(load, /Настройки → Учётные записи|Другие календари → \+ → По URL/);
  assert.match(css, /\.cal-sub-dialog \.modal-x\s*\{[\s\S]*min-inline-size:\s*var\(--touch-min\)[\s\S]*min-block-size:\s*var\(--touch-min\)/);
});

test('normal and hard completion preserve focus; hard choice is a complete modal', () => {
  const plan = functionBody('taskCompletionFocusPlan');
  assert.match(plan, /\[data-action="toggle-task"\]\[data-id=/);
  assert.match(plan, /source\.closest\('\[data-calendar-task\]'\)/);
  assert.match(plan, /calendarSource \? '_calendarFocusAfterCommit' : '_tasksFocusAfterCommit'/);
  const queue = functionBody('queueTaskCompletionFocus');
  assert.match(queue, /State\[plan\.stateKey\] = plan\.selector/);

  const picker = functionBody('openDesirePicker');
  assert.match(picker, /setAttribute\('role', 'dialog'\)/);
  assert.match(picker, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(picker, /setAttribute\('aria-labelledby', 'desire-title'\)/);
  assert.match(picker, /setAttribute\('aria-describedby', 'desire-task-summary desire-science'\)/);
  assert.match(picker, /setAttribute\('lang', lang\(\)\)/);
  assert.match(picker, /overlay\._returnFocus =/);
  assert.match(picker, /overlay\._completionFocus = taskCompletionFocusPlan/);
  assert.match(picker, /appRoot\.inert = true/);
  assert.match(picker, /lockCalendarDialogScroll\(\)/);
  assert.match(picker, /classList\.add\('desire-picker-open'\)/);
  assert.match(picker, /addEventListener\('keydown', handleDesirePickerKeydown\)/);
  assert.match(picker, /event\.target === overlay\) closeDesirePicker\(\)/);
  assert.match(picker, /focusPathChoiceTarget\(document\.getElementById\('desire-title'\)\)/);
  assert.match(picker, /id="desire-task-summary"[\s\S]*data-noi18n/);

  const keys = functionBody('handleDesirePickerKeydown');
  assert.match(keys, /event\.key === 'Escape'/);
  assert.match(keys, /event\.key !== 'Tab'/);
  assert.match(keys, /pathChoiceFocusable\(overlay\)/);
  const close = functionBody('closeDesirePicker');
  assert.match(close, /overlay\._desireApp\.inert = !!overlay\._desireAppWasInert/);
  assert.match(close, /overlay\._returnFocus && overlay\._returnFocus\.isConnected/);
  assert.match(close, /focusPathChoiceTarget\(target\)/);

  assert.match(app, /if \(q\.difficulty === 'hard'\) \{ openDesirePicker\(id, el\); return; \}[\s\S]*queueTaskCompletionFocus\(id, el\);[\s\S]*completeTask\(q, null\)/);
  assert.match(app, /const focusPlan = overlay && overlay\._completionFocus;[\s\S]*closeDesirePicker\(\{ restoreFocus: false \}\);[\s\S]*State\[focusPlan\.stateKey\] = focusPlan\.selector;[\s\S]*completeTask\(task, el\.dataset\.desire\)/);
});

test('move is awaitable, rolls back on failure, and offers undo', () => {
  const move = functionBody('moveCalendarTask');
  assert.match(move, /await Store\.saveNow\('tasks', State\.tasks\)/);
  assert.match(move, /if \(!saved\) \{[\s\S]*Object\.assign\(task, before\)/);
  assert.match(move, /const receipt = \{ taskId: task\.id, before/);
  assert.match(move, /State\._calendarUndo = receipt/);
  assert.match(move, /expiresAt: Date\.now\(\) \+ 12000/);
  assert.match(move, /setTimeout\(\(\) => \{[\s\S]*State\._calendarUndo !== receipt[\s\S]*12050/);
  const undo = functionBody('undoCalendarMove');
  assert.match(undo, /moveCalendarTask\([\s\S]*\{ makeUndo: false, renderAfter: false \}/);
  const failedUndo = undo.match(/if \(!ok\) \{([\s\S]*?)\n  \}/);
  assert.ok(failedUndo, 'failed Undo branch must exist');
  assert.doesNotMatch(failedUndo[1], /State\._calendarUndo = null/, 'failed Undo must retain its receipt');
  assert.match(undo.slice(undo.indexOf('if (!ok)') + failedUndo[0].length), /State\._calendarUndo = null/);
  assert.match(functionBody('calendarMoveReceiptHTML'), /data-action="cal-move-undo"/);
});

test('desktop timeline preserves per-date scroll and composes overlaps into truthful lanes', () => {
  assert.match(app, /const CAL_H0 = 0, CAL_H1 = 23, CAL_ROWH = 48/);
  assert.match(functionBody('openCalendarTaskEditor'), /type="time" min="00:00" max="23:45"/);
  const sync = functionBody('syncCalendarDayViewport');
  assert.match(sync, /State\._calendarViewportDate === date/);
  assert.match(sync, /viewport\.scrollTop = State\._calendarViewportScroll/);
  assert.match(sync, /addEventListener\('scroll'/);
  assert.match(sync, /State\._calendarViewportScroll = viewport\.scrollTop/);

  const layoutSource = functionBody('calendarTaskLayout');
  const layout = Function('CAL_BLOCK_MIN_MIN', `${layoutSource}; return calendarTaskLayout;`)(35);
  const tasks = [
    { id: 'a', startTime: '08:15', estimateMin: 30 },
    { id: 'b', startTime: '08:30', estimateMin: 30 },
    { id: 'c', startTime: '09:00', estimateMin: 15 },
  ];
  const laidOut = layout(tasks);
  assert.deepEqual(laidOut.slice(0, 2).map((item) => item.lane), [0, 1]);
  assert.deepEqual(laidOut.slice(0, 2).map((item) => item.laneCount), [2, 2]);
  assert.equal(laidOut[2].laneCount, 2, 'the visible hitbox of the 08:30 task still occupies a lane at 09:00');

  const short = layout([
    { id: 'short-a', startTime: '08:00', estimateMin: 5 },
    { id: 'short-b', startTime: '08:15', estimateMin: 5 },
  ]);
  assert.deepEqual(short.map((item) => item.lane), [0, 1], 'visible 28px hitboxes must not occlude adjacent short events');
  assert.deepEqual(short.map((item) => item.laneCount), [2, 2]);

  const view = functionBody('renderCalendarView');
  assert.match(view, /class="cal-events-layer"/);
  assert.match(view, /data-cal-lane="\$\{lane \+ 1\}\/\$\{laneCount\}"/);
  assert.match(view, /class="cal-duration-mark"/);
  assert.match(view, /--cal-duration-h:\$\{durationHeight\}px/);
  assert.match(view, /name="startTime" type="time" min="00:00" max="23:45"/);
  assert.match(css, /\.calendar-shell \.cal-events-layer\s*\{[\s\S]*inset:\s*0 var\(--sp-3\) 0 58px/);
  assert.match(css, /\.calendar-shell \.cal-duration-mark\s*\{[\s\S]*height:\s*min\(100%, var\(--cal-duration-h\)\)/);
});

test('new Calendar quest has persistent labels and optional exact start time', () => {
  const view = functionBody('renderCalendarView');
  for (const field of ['title', 'startTime', 'difficulty']) {
    assert.match(view, new RegExp(`name="${field}"`), `missing ${field}`);
  }
  // skillId больше не инлайновый <select> — это sphereFieldHTML() (дерево сфер с поиском, Q14),
  // сама она рендерит `name="skillId"` в своё собственное тело функции, проверено отдельно.
  assert.match(view, /\$\{sphereFieldHTML\(\)\}/, 'missing skillId sphere field');
  assert.match(functionBody('sphereFieldHTML'), /name="skillId"/);
  assert.match(view, /durInputHTML\('estimateMin', 30, true\)/);
  assert.match(view, /class="add-field-label"/);
  assert.match(app, /const startTime = f\.startTime \? calendarTimeValue\(f\.startTime\.value\) : null/);
  assert.match(app, /startTime, createdAt:/);
  const submit = functionBody('onSubmit');
  assert.match(submit, /f\.classList\.contains\('calendar-add-form'\)/);
  assert.match(submit, /await Store\.saveNow\('tasks', State\.tasks\)/);
  assert.match(submit, /State\.tasks = State\.tasks\.filter\(\(item\) => item !== task\)/);
  assert.match(submit, /State\._calendarFocusAfterCommit = startTime/);
});

test('rendered Day copy protects only user titles and localizes duration units', () => {
  const view = functionBody('renderCalendarView');
  for (const className of ['cal-block-main', 'cal-agenda-main', 'calv-chip']) {
    assert.doesNotMatch(view, new RegExp(`class="${className}"[^>]*\\bdata-noi18n\\b`), `${className} must not suppress authored translations`);
  }
  assert.match(view, /class="cal-b-text"[\s\S]*?<span data-noi18n>[\s\S]*?class="cal-dur"/);
  assert.match(view, /class="cal-agenda-title" data-noi18n/);
  assert.match(view, /class="calv-chip-title" data-noi18n/);
  const duration = functionBody('fmtDur');
  assert.match(duration, /t\('м'\)/);
  assert.match(duration, /t\('ч'\)/);
});

test('mobile is agenda-first, labelled, unclipped, and reduced-motion safe', () => {
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*\.calendar-shell \.calv-title\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*\.calendar-shell \.cal-modes\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*2/);
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*\.calendar-shell \.cal-tools\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*3/);
  assert.match(css, /\.calendar-shell \.cal-tools\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.calendar-shell \.cal-tools > button\s*\{[\s\S]*white-space:\s*nowrap;[\s\S]*hyphens:\s*none/);
  assert.match(css, /\.calendar-shell \.cal-tool-icon \{ display:\s*none; \}/);
  assert.match(css, /\.calendar-shell \.calv-title-main \.wk-load \{ display:\s*none; \}/);
  assert.doesNotMatch(css, /body:has\(\.calendar-day-shell\) #ai-fab[^}]*display:\s*none/);
  assert.match(css, /\.calv-grid-viewport \{ display:\s*none; \}/);
  assert.match(css, /\.calv-agenda\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.cal-agenda-title\s*\{[\s\S]*-webkit-line-clamp:\s*3/);
  assert.match(css, /\.calendar-shell :is\(button, input, select, textarea, summary\):focus-visible,[\s\S]*box-shadow:\s*var\(--focus-ring\) !important/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.calendar-shell \*[\s\S]*animation:\s*none !important/);
});

test('new authored Calendar copy is complete in all supported locales', () => {
  for (const key of [
    'Режим календаря', 'Инструменты календаря', 'Расписание дня', 'Расписание',
    'Нет квестов со временем', 'Открыть расписание квеста', 'Изменить расписание квеста',
    'Квест перенесён', 'Квест снят с расписания', 'Сохранить расписание',
    'Не удалось сохранить квест', 'Название квеста',
    'Квесты автоматически обновляются в Apple и Google Календаре после изменений в Satoru.',
    'Готовим безопасную ссылку…', 'Не удалось создать ссылку. Повтори попытку.',
    'Как подключить календарь',
    'Apple Календарь: добавь подписной календарь и вставь ссылку.',
    'Google Календарь: открой «Другие календари» → «Добавить по URL» и вставь ссылку.',
    'Насколько ты хотел это сделать?',
    'Это сложный квест. Ответ сохраняет контекст, но не меняет XP, золото или энергию.',
    'Через силу', 'Нормально', 'В кураже!', 'Контекст без бонуса или штрафа',
    'Самооценка нужна для рефлексии, а не для оптимизации выплаты.',
    'Состояние отмечено. XP, золото и энергия не меняются от самооценки.',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = app.match(new RegExp(`'${escaped}': \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
});
