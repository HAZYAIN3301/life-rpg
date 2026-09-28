'use strict';
// Deliberately separate from live multiplayer. No API, account or economy access.
(() => {
  const KEY = 'satoru.lighthouse.m01.v1';
  const initial = () => ({ version: 1, step: 0, actor: 0, signal: ['', ''], route: ['', ''], tools: ['', ''], storm: ['', ''], attempts: 0, wish: '' });
  const stages = ['Причал', 'Сигнал', 'Развилка', 'Мастерская', 'Шторм', 'Хроника'];
  const tools = { compass: ['Компас', 'Находит путь, укрытый от ветра. Не чинит механизм.'],
    lens: ['Линза', 'Читает сигналы и ритм волн. Не удерживает башню.'],
    repair: ['Набор ремонта', 'Закрепляет детали и мосты. Не показывает путь.'] };
  const routes = { shore: ['Берег сигналов', 'Читать прилив и передавать свет сквозь туман. В хронике останется морской узор.'],
    garden: ['Сад механизмов', 'Пройти между ветряными механизмами. В хронике останется узор ветвей.'] };
  const moves = { wait: 'Дождаться тихого промежутка', shelter: 'Найти укрытие от ветра', align: 'Настроить линзу',
    flash: 'Передать короткий сигнал', anchor: 'Закрепить трос', brace: 'Зафиксировать основание' };
  let state = initial(), storageAvailable = true;
  const notice = text => { document.querySelector('#notice').textContent = text; };
  function valid(s) {
    return s && s.version === 1 && Number.isInteger(s.step) && s.step >= 0 && s.step <= 5
      && [0, 1].includes(s.actor) && Number.isInteger(s.attempts) && s.attempts >= 0
      && ['signal', 'route', 'tools', 'storm'].every(key => Array.isArray(s[key]) && s[key].length === 2)
      && ['', 'amber', 'blue'].includes(s.signal[0]) && ['', 'wave', 'leaf'].includes(s.signal[1])
      && s.route.every(x => ['', ...Object.keys(routes)].includes(x))
      && s.tools.every(x => ['', ...Object.keys(tools)].includes(x))
      && s.storm[0] !== undefined && ['', 'wait', 'shelter', 'align'].includes(s.storm[0])
      && ['', 'flash', 'anchor', 'brace'].includes(s.storm[1])
      && ['', 'lamp', 'bench', 'planter'].includes(s.wish)
      && (s.step < 2 || s.signal.every(Boolean))
      && (s.step < 3 || !!s.route[0] && s.route[0] === s.route[1])
      && (s.step < 4 || s.tools.every(Boolean) && s.tools[0] !== s.tools[1]);
  }
  try { const saved = localStorage.getItem(KEY); if (saved) { const parsed = JSON.parse(saved); if (!valid(parsed)) throw Error(); state = parsed; } }
  catch { notice('Сохранённый прототип не прочитался. Начинаем новую пробную игру.'); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; notice('Браузер не сохранил прототип. Можно играть, но после закрытия страницы результат может исчезнуть.'); }
  }
  function combination() {
    if (state.route[0] === 'garden') {
      if (!state.tools.includes('repair')) return { answers: ['align', 'flash'],
        hints: ['Компас показывает, куда смотрит ряд зеркал. Линзу нужно повернуть к этому ряду.', 'Зеркала передают свет только короткими вспышками. После настройки линзы дай короткий сигнал.'], result: 'Вы направили свет через зеркала сада. Механизм проснулся без ремонта.' };
      if (!state.tools.includes('lens')) return { answers: ['wait', 'anchor'],
        hints: ['Компас дрожит у крыльчатки: механизм движется от ветра. Закреплять его можно только в тихий промежуток.', 'В крыльчатке есть паз для троса. Дождитесь остановки ветра, затем закрепи трос.'], result: 'Вы поймали тихий промежуток и закрепили привод сада. Он снова питает маяк.' };
      return { answers: ['shelter', 'brace'],
        hints: ['Линза проявила знак укрытия за стеклянной стеной. Оттуда есть безопасный доступ к основанию.', 'За стеклянной стеной основание защищено от ветра. Найдя укрытие, зафиксируйте его набором ремонта.'], result: 'Вы прошли через укрытие и восстановили основание садового отражателя.' };
    }
    if (!state.tools.includes('repair')) return { answers: ['wait', 'flash'],
      hints: ['Компас ведёт к воде. Линза показывает: после двух больших волн бывает тихий промежуток.', 'У тропы нет троса. В тихий промежуток смотрителю нужен один короткий сигнал.'], result: 'Вы прошли тропу во время отлива и передали сигнал смотрителю.' };
    if (!state.tools.includes('lens')) return { answers: ['shelter', 'anchor'],
      hints: ['Компас нашёл подветренную сторону. Здесь можно переждать шквал и удержать путь к башне.', 'Без линзы сигнал не прочитать. На подветренной стороне есть проушина для страховочного троса.'], result: 'Вы нашли укрытие и закрепили безопасный путь к башне.' };
    return { answers: ['align', 'brace'], hints: ['Линза показывает метку на кольце маяка. Поворот к этой метке восстанавливает свет.', 'Основание шатается. Поворот линзы сработает, если второй участник зафиксирует основание.'], result: 'Вы совместили метку и закрепили основание. Луч снова держит направление.' };
  }
  const option = (group, value, title, detail = '') => `<button type="button" class="lh-option" data-group="${group}" data-value="${value}" aria-pressed="${state[group]?.[state.actor] === value || group === 'wish' && state.wish === value}"><span>${title}</span>${detail ? `<small>${detail}</small>` : ''}</button>`;
  const next = (label, enabled = true) => `<button type="button" class="lh-primary" data-next ${enabled ? '' : 'disabled'}>${label}</button>`;
  const roles = () => `<div class="lh-roles" aria-label="Пробная роль">${[0, 1].map(i => `<button type="button" data-actor="${i}" aria-pressed="${state.actor === i}">${i ? 'Роль друга' : 'Твоя роль'}</button>`).join('')}</div>`;
  const selection = group => `<p class="lh-status">Твоя роль: ${state[group][0] ? 'выбор сделан' : 'ждёт выбора'} · Роль друга: ${state[group][1] ? 'выбор сделан' : 'ждёт выбора'}. Переключись между ролями, чтобы сыграть за обоих.</p>`;
  function report() {
    return `Маяк / M01 — пробная игра\nМаршрут: ${routes[state.route[0]]?.[0] || 'не выбран'}\nИнструменты: ${state.tools.map(x => tools[x]?.[0] || '—').join(' + ')}\nПопыток в финале: ${state.attempts}\nЖеланный предмет: ${{lamp:'Сигнальная лампа',bench:'Скамья смотрителей',planter:'Сад в стекле'}[state.wish] || 'не выбран'}\n\nЧто было интересно: …\nГде выбор показался бессмысленным: …\nПозвал бы друга ради этого: …\nФинал: спокойная головоломка / больше тактики / совместная работа без RPG`;
  }
  function render(focus = false) {
    const play = document.querySelector('#play'), s = state, combo = combination();
    let content = '';
    if (s.step === 0) content = `<h2 tabindex="-1">Зажечь свет вместе</h2><p>У старого маяка погас огонь. Каждый из вас делает небольшой шаг в своей жизни; вместе вы решаете, как оживить остров.</p><div class="lh-hint">В этой пробной игре ваши два дела уже условно сохранены. Дальше — решения, а не ещё один список задач.</div><p>Пройди две роли с одного телефона за 5–7 минут. В настоящей компании у каждого будет собственный ход и своя подсказка.</p>${next('Начать с сигнала')}`;
    if (s.step === 1) content = `<h2 tabindex="-1">У каждого — часть сигнала</h2><p>Один выбирает свет, другой — знак. Сочетание подскажет первый маршрут; золото за подбор «правильного» ответа не требуется.</p>${roles()}<div class="lh-options">${s.actor === 0 ? option('signal','amber','Тёплый свет','Проявляет близкие детали и механизмы.') + option('signal','blue','Холодный свет','Различим в тумане над водой.') : option('signal','wave','Знак волны','Ищем ответ со стороны моря.') + option('signal','leaf','Знак ветви','Ищем ответ среди старых механизмов.')}</div>${selection('signal')}${next('Увидеть ответ острова', s.signal.every(Boolean))}`;
    if (s.step === 2) {
      const hint = s.signal[0] === 'blue' && s.signal[1] === 'wave' ? 'С моря ответил чёткий сигнал. Берег зовёт первым.' : s.signal[0] === 'amber' && s.signal[1] === 'leaf' ? 'В саду проявилось зубчатое кольцо. Там ждёт механизм.' : 'Ответ пришёл с двух сторон. Свет и знак указали разные пути — придётся договориться.';
      content = `<h2 tabindex="-1">Куда пойдём?</h2><div class="lh-hint">${hint}</div><p>Оба пути проходимы. Выберите, какой след хотите оставить в своём общем месте.</p>${roles()}<div class="lh-options">${Object.entries(routes).map(([id,r]) => option('route',id,...r)).join('')}</div>${selection('route')}${s.route.every(Boolean) && s.route[0] !== s.route[1] ? '<p class="lh-hint">Пока выбраны разные пути. Обсудите и поменяйте один голос. Прогресс останется на месте.</p>' : ''}${next('К мастерской', !!s.route[0] && s.route[0] === s.route[1])}`;
    }
    if (s.step === 3) content = `<h2 tabindex="-1">Два места в рюкзаке</h2><p>Три инструмента, два участника. Каждый берёт один. Любая пара разных инструментов откроет свой способ пройти шторм.</p>${roles()}<div class="lh-options">${Object.entries(tools).map(([id,r]) => option('tools',id,...r)).join('')}</div>${selection('tools')}${s.tools[0] && s.tools[0] === s.tools[1] ? '<p class="lh-hint">Два одинаковых инструмента не дополняют друг друга. Выберите разные.</p>' : ''}${next('Подойти к маяку', s.tools.every(Boolean) && s.tools[0] !== s.tools[1])}`;
    if (s.step === 4) content = `<h2 tabindex="-1">Переждать шторм. Соединить ходы.</h2><p>${routes[s.route[0]][0]}. С собой: ${s.tools.map(x => tools[x][0]).join(' и ')}.</p>${roles()}<div class="lh-hint"><strong>${s.actor ? 'Подсказка друга' : 'Твоя подсказка'}</strong><br>${combo.hints[s.actor]}</div><div class="lh-options">${(s.actor ? ['flash','anchor','brace'] : ['wait','shelter','align']).map(id => option('storm',id,moves[id])).join('')}</div>${selection('storm')}<p class="lh-status">Неудачный ход ничего не отнимет. Можно остановиться и вернуться.</p>${next('Совместить ходы', s.storm.every(Boolean))}`;
    if (s.step === 5) content = `<h2 tabindex="-1">Маяк снова светит</h2><p>${combo.result}</p><div class="lh-result"><h3>${s.route[0] === 'shore' ? 'Огонь прилива' : 'Свет старого сада'}</h3><p>Ваша пробная хроника: ${routes[s.route[0]][0].toLowerCase()}, ${s.tools.map(x => tools[x][0].toLowerCase()).join(' и ')}, ${s.attempts} попыток.</p></div><h3>Во что хотелось бы превратить золото?</h3><p>Это выбор для обсуждения мастерской. Цена ещё не назначена, покупка не происходит.</p><div class="lh-options">${option('wish','lamp','Сигнальная лампа','Свет и узор из вашей истории — для личного Логова.')}${option('wish','bench','Скамья смотрителей','Место для двоих в общей комнате.')}${option('wish','planter','Сад в стекле','Живой уголок с выбранными цветом и формой.')}</div><p class="lh-status">Предметы здесь — концепты. Приложение ещё не выдало их в инвентарь.</p><button type="button" class="lh-primary" data-report>Показать результат для отзыва</button><div id="report"></div>`;
    play.innerHTML = `<div class="lh-kicker">${s.step + 1} / 6 · ${stages[s.step]}</div>${content}`;
    document.querySelector('#route').innerHTML = stages.map((stage,i) => `<li ${i === s.step ? 'aria-current="step"' : ''}>${i < s.step ? '✓ ' : ''}${stage}</li>`).join('');
    document.querySelector('.lh-map').classList.toggle('is-lit', s.step === 5);
    if (focus) { const heading = play.querySelector('h2'); heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start' }); }
  }
  document.querySelector('#play').addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    let moved = false, message = '';
    if (button.dataset.actor !== undefined) state.actor = Number(button.dataset.actor);
    else if (button.dataset.group) {
      const { group, value } = button.dataset;
      if (group === 'wish') state.wish = value; else state[group][state.actor] = value;
    } else if (button.hasAttribute('data-next')) {
      if (state.step === 4) {
        state.attempts++;
        if (state.storm.every((move,i) => move === combination().answers[i])) { state.step++; moved = true; }
        else { state.storm = ['', '']; message = 'Ходы не соединились. Сопоставьте две подсказки и попробуйте ещё раз. Дела, инструменты и путь сохранены.'; }
      } else { state.step++; moved = true; }
      state.actor = 0;
    } else if (button.hasAttribute('data-report')) {
      const output = document.createElement('pre'); output.textContent = report();
      document.querySelector('#report').replaceChildren(output); return;
    }
    save(); render(moved);
    if (storageAvailable) notice(message || (moved ? 'Следующий этап. Прототип сохранён на этом устройстве.' : 'Выбор сохранён в прототипе.'));
    if (!moved) {
      const selector = button.dataset.actor !== undefined ? `[data-actor="${button.dataset.actor}"]`
        : button.dataset.group ? `[data-group="${button.dataset.group}"][data-value="${button.dataset.value}"]` : 'h2';
      document.querySelector('#play').querySelector(selector)?.focus({ preventScroll: true });
    }
  });
  document.querySelector('#reset').addEventListener('click', () => { state = initial(); save(); render(true); if (storageAvailable) notice('Начата новая пробная игра. Данные Satoru не затронуты.'); });
  document.querySelector('#theme').addEventListener('click', () => {
    document.body.dataset.lhTheme = document.body.dataset.lhTheme === 'light' ? 'dark' : 'light';
  });
  document.body.dataset.lhTheme = matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
  render();
})();
