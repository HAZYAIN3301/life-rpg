/* Satoru Return Shelf UI v1 — finite action library, never a feed.
 *
 * The domain engine owns ordering and completion semantics. This renderer only
 * accepts a bounded view model from app.js and never fetches, mutates global
 * state, recommends content, autoplays media or exposes engagement counters.
 */
(function exposeReturnShelfUI(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReturnShelfUIV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildReturnShelfUI() {
  'use strict';

  const VERSION = '1.0.0';
  const FILTERS = Object.freeze(['all', 'energy', 'practical']);
  const ACTIONS = Object.freeze(['quest', 'focus', 'note', 'project', 'postpone']);

  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
  function tr(t, key) { return esc(typeof t === 'function' ? t(key) : key); }
  function row(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function rows(value, max = 40) { return Array.isArray(value) ? value.slice(0, max).map(row) : []; }
  function filterLabel(filter) {
    return filter === 'energy' ? 'Энергия' : filter === 'practical' ? 'Практика' : 'Всё';
  }
  function kindLabel(kind) { return kind === 'practical' ? 'Практический' : 'Энергетический'; }
  function actionLabel(action) {
    return ({ quest: 'Перейти к квесту', focus: 'Запустить фокус', note: 'Записать мысль', project: 'Открыть цель', postpone: 'Отложить без наказания' })[action] || 'Выбрать действие';
  }
  function host(url) {
    try { return new URL(String(url)).hostname.replace(/^www\./, '').slice(0, 80); }
    catch { return ''; }
  }

  function renderLoading(t) {
    return `<section class="return-shelf-shell" aria-labelledby="return-shelf-title"><header class="return-shelf-head"><p class="return-shelf-kicker">SATORU · ${tr(t, 'Возвращение')}</p><h2 id="return-shelf-title" tabindex="-1">${tr(t, 'Полка возвращения')}</h2></header><div class="card return-shelf-state" role="status" aria-live="polite"><p>${tr(t, 'Загружаем сохранённые материалы…')}</p></div></section>`;
  }

  function renderError(vm, t) {
    const invalid = vm.error === 'invalid';
    return `<section class="return-shelf-shell" aria-labelledby="return-shelf-title"><header class="return-shelf-head"><p class="return-shelf-kicker">SATORU · ${tr(t, 'Возвращение')}</p><h2 id="return-shelf-title" tabindex="-1">${tr(t, 'Полка возвращения')}</h2><p>${tr(t, 'Конечная библиотека, которая возвращает к выбранному действию.')}</p></header><div class="card return-shelf-state is-error" role="alert"><h3>${tr(t, invalid ? 'Данные Полки повреждены' : 'Не удалось загрузить Полку')}</h3><p>${tr(t, 'Это не пустая Полка. Ничего не перезаписываем, пока данные не восстановлены.')}</p><button type="button" class="btn" data-action="shelf-retry" ${vm.busy ? 'disabled' : ''}>${tr(t, vm.busy ? 'Повторяем…' : 'Повторить')}</button></div></section>`;
  }

  function renderLinkOptions(vm, t) {
    const taskRows = rows(vm.tasks, 30).map((item) => `<option value="task:${esc(item.id)}">${tr(t, 'Квест')}: ${esc(item.title)}</option>`).join('');
    const goalRows = rows(vm.goals, 30).map((item) => `<option value="goal:${esc(item.id)}">${tr(t, 'Цель')}: ${esc(item.title)}</option>`).join('');
    return `<option value="">${tr(t, 'Без связи')}</option>${taskRows}${goalRows}`;
  }

  function renderComposer(vm, t) {
    if (!vm.composerOpen) return '';
    return `<form id="return-shelf-add-form" class="card return-shelf-composer" data-shelf-kind="energy">
      <header><div><p class="return-shelf-kicker">${tr(t, 'Новый материал')}</p><h3>${tr(t, 'Сохрани результат, а не новую бесконечность')}</h3></div><button type="button" class="return-shelf-close" data-action="shelf-toggle-composer" aria-label="${tr(t, 'Закрыть')}">✕</button></header>
      <div class="return-shelf-form-grid">
        <label class="return-shelf-field return-shelf-field-wide"><span>${tr(t, 'Название')}</span><input name="title" maxlength="120" required autocomplete="off" /></label>
        <label class="return-shelf-field return-shelf-field-wide"><span>${tr(t, 'Ссылка — можно просто вставить')}</span><input name="url" type="url" maxlength="500" inputmode="url" placeholder="https://…" autocomplete="url" /></label>
        <label class="return-shelf-field return-shelf-field-wide"><span>${tr(t, 'Что я отсюда беру')}</span><textarea name="why" maxlength="200" rows="2" required></textarea></label>
        <label class="return-shelf-field"><span>${tr(t, 'Тип материала')}</span><select name="kind" data-action="shelf-kind"><option value="energy">${tr(t, 'Энергетический · 30–90 секунд')}</option><option value="practical">${tr(t, 'Практический · с конкретным выводом')}</option></select></label>
        <label class="return-shelf-field"><span>${tr(t, 'Связать с делом')}</span><select name="link">${renderLinkOptions(vm, t)}</select></label>
        <label class="return-shelf-field return-shelf-field-wide" data-shelf-practical hidden><span>${tr(t, 'Ожидаемый практический вывод')}</span><input name="expect" maxlength="200" autocomplete="off" /></label>
        <label class="return-shelf-field" data-shelf-practical hidden><span>${tr(t, 'Точка остановки')}</span><input name="stopAt" maxlength="60" placeholder="12:30 / глава 3" autocomplete="off" /></label>
        <label class="return-shelf-field" data-shelf-practical hidden><span>${tr(t, 'Минуты')}</span><input name="minutes" type="number" min="1" max="240" value="20" inputmode="numeric" /></label>
        <label class="return-shelf-field"><span>${tr(t, 'Убрать после даты')}</span><input name="expiresOn" type="date" /></label>
      </div>
      <p class="return-shelf-note">${tr(t, 'Satoru хранит ссылку и твою заметку, а не копию чужого видео или аудио.')}</p>
      <p class="return-shelf-form-status" data-shelf-form-status role="status" aria-live="polite"></p>
      <div class="return-shelf-form-actions"><button type="button" class="btn ghost" data-action="shelf-toggle-composer">${tr(t, 'Отмена')}</button><button type="submit" class="btn">${tr(t, 'Положить на Полку')}</button></div>
    </form>`;
  }

  function renderItem(item, t) {
    const practical = item.kind === 'practical';
    const source = item.url ? `<button type="button" class="btn ghost return-shelf-source" data-action="shelf-open-source" data-id="${esc(item.id)}">↗ ${tr(t, 'Открыть через границу')}${host(item.url) ? ` · ${esc(host(item.url))}` : ''}</button>` : '';
    const context = item.linkLabel ? `<p class="return-shelf-context">${tr(t, 'Связано')}: <span data-noi18n>${esc(item.linkLabel)}</span></p>` : '';
    return `<article class="card return-shelf-item is-${practical ? 'practical' : 'energy'}" data-shelf-id="${esc(item.id)}" aria-labelledby="return-shelf-item-${esc(item.id)}">
      <header><span class="return-shelf-kind">${tr(t, kindLabel(item.kind))}</span><button type="button" class="return-shelf-menu" data-action="shelf-archive" data-id="${esc(item.id)}" aria-label="${tr(t, 'Архивировать')}: ${esc(item.title)}">${tr(t, 'В архив')}</button></header>
      <h3 id="return-shelf-item-${esc(item.id)}" tabindex="-1" data-noi18n>${esc(item.title)}</h3>
      <p class="return-shelf-why"><span>${tr(t, 'Беру с собой')}</span><b data-noi18n>${esc(item.why)}</b></p>
      ${practical ? `<dl class="return-shelf-practical"><div><dt>${tr(t, 'Вывод')}</dt><dd data-noi18n>${esc(item.expect || '')}</dd></div>${item.stopAt ? `<div><dt>${tr(t, 'Стоп')}</dt><dd data-noi18n>${esc(item.stopAt)}</dd></div>` : ''}${item.minutes ? `<div><dt>${tr(t, 'Время')}</dt><dd>${esc(item.minutes)} ${tr(t, 'мин')}</dd></div>` : ''}</dl>` : ''}
      ${item.note ? `<p class="return-shelf-own-note" data-noi18n>${esc(item.note)}</p>` : ''}${context}${source}
      <form class="return-shelf-complete-form" data-id="${esc(item.id)}"><label><span>${tr(t, 'После материала')}</span><select name="action">${ACTIONS.map((action) => `<option value="${action}">${tr(t, actionLabel(action))}</option>`).join('')}</select></label><button type="submit" class="btn" ${item.busy ? 'disabled' : ''}>${tr(t, 'Перейти к действию')}</button></form>
    </article>`;
  }

  function renderArchive(vm, t) {
    const archived = rows(vm.archived, 40);
    if (!archived.length) return '';
    return `<details class="card return-shelf-archive"><summary>${tr(t, 'Архив Полки')} · ${archived.length}</summary><div class="return-shelf-archive-list">${archived.map((item) => `<div class="return-shelf-archive-row"><span><b data-noi18n>${esc(item.title)}</b><small>${tr(t, kindLabel(item.kind))}</small></span><button type="button" class="btn danger" data-action="shelf-delete" data-id="${esc(item.id)}" aria-label="${tr(t, 'Удалить навсегда')}: ${esc(item.title)}">${tr(t, 'Удалить')}</button></div>`).join('')}</div></details>`;
  }

  function renderReady(vm, t) {
    const filter = FILTERS.includes(vm.filter) ? vm.filter : 'all';
    const items = rows(vm.items, 5);
    const rate = row(vm.rate);
    const ratio = Number(rate.seen) > 0 ? `${Number(rate.moved) || 0} ${tr(t, 'из')} ${Number(rate.seen)}` : tr(t, 'Пока не измерено');
    const status = vm.errorMessage ? `<p class="return-shelf-inline-error" role="alert">${tr(t, vm.errorMessage)}</p>` : '';
    return `<section class="return-shelf-shell" aria-labelledby="return-shelf-title">
      <header class="return-shelf-head"><div><p class="return-shelf-kicker">SATORU · ${tr(t, 'Возвращение')}</p><h2 id="return-shelf-title" tabindex="-1">${tr(t, 'Полка возвращения')}</h2><p>${tr(t, 'Три сохранённых материала за один вход. Никакой ленты, autoplay и наград за просмотр.')}</p></div><button type="button" class="btn" data-action="shelf-toggle-composer">${vm.composerOpen ? tr(t, 'Закрыть добавление') : `+ ${tr(t, 'Добавить материал')}`}</button></header>
      <div class="return-shelf-stats" aria-label="${tr(t, 'Состояние Полки')}"><div><b>${Number(vm.liveCount) || 0}</b><span>${tr(t, 'на Полке')}</span></div><div><b>${Number(vm.freeCount) || 0}</b><span>${tr(t, 'свободных мест')}</span></div><div><b>${ratio}</b><span>${tr(t, 'перешли к действию')}</span></div></div>
      ${renderComposer(vm, t)}${status}
      ${Number(vm.expiredCount) > 0 ? `<div class="card return-shelf-expired" role="status"><p>${tr(t, 'Истёкших материалов')}: <b>${Number(vm.expiredCount)}</b>. ${tr(t, 'Они уже не попадают в пачку.')}</p><button type="button" class="btn ghost" data-action="shelf-archive-expired">${tr(t, 'Убрать в архив')}</button></div>` : ''}
      <div class="return-shelf-toolbar"><div class="return-shelf-filters" role="group" aria-label="${tr(t, 'Фильтр материалов')}">${FILTERS.map((value) => `<button type="button" class="${value === filter ? 'active' : ''}" data-action="shelf-filter" data-filter="${value}" aria-pressed="${value === filter}">${tr(t, filterLabel(value))}</button>`).join('')}</div><p>${tr(t, 'Пачка конечна')}: ${items.length} / 5</p></div>
      <div class="return-shelf-batch">${items.length ? items.map((item) => renderItem(item, t)).join('') : `<div class="card return-shelf-state"><h3>${tr(t, filter === 'all' ? 'Полка пока пуста' : 'В этом типе пока пусто')}</h3><p>${tr(t, 'Сохрани один материал вместе с тем, что хочешь забрать в реальную жизнь.')}</p><button type="button" class="btn" data-action="shelf-toggle-composer">+ ${tr(t, 'Добавить материал')}</button></div>`}</div>
      <footer class="return-shelf-footer"><p>${tr(t, 'Просмотр не даёт XP или золото. Отложить можно без наказания.')}</p><button type="button" class="btn ghost" data-action="shelf-open-export">${tr(t, 'Экспорт и удаление данных')}</button></footer>
      ${renderArchive(vm, t)}
    </section>`;
  }

  function render(vm = {}, t) {
    if (vm.state === 'loading') return renderLoading(t);
    if (vm.state === 'error') return renderError(vm, t);
    return renderReady(vm, t);
  }

  return Object.freeze({ VERSION, FILTERS, ACTIONS, render, renderLoading, renderError, renderReady });
});
