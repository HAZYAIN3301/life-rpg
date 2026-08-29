/* Satoru Inspiration UI v2 — a finite personal digest, not another feed.
 *
 * The renderer receives an already fixed three-item digest. It has no fetch,
 * autoplay, scrolling pagination, reward counters, popularity or randomization.
 */
(function exposeReturnShelfUI(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReturnShelfUIV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildReturnShelfUI() {
  'use strict';

  const VERSION = '2.0.0';
  const SECTIONS = Object.freeze(['today', 'saved']);
  const FORMATS = Object.freeze(['edit', 'video', 'image', 'quote', 'podcast']);
  const FORMAT_COPY = Object.freeze({
    edit: ['Эдит', 'Смотреть'], video: ['Видео', 'Смотреть'], image: ['Изображение', 'Рассмотреть'],
    quote: ['Цитата', 'Прочитать'], podcast: ['Подкаст', 'Слушать'], link: ['Материал', 'Открыть'],
  });

  function esc(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
  function tr(t, key) { return esc(typeof t === 'function' ? t(key) : key); }
  function row(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  function rows(value, max = 160) { return Array.isArray(value) ? value.slice(0, max).map(row) : []; }
  function formatLabel(format) { return (FORMAT_COPY[format] || FORMAT_COPY.link)[0]; }
  function formatAction(format) { return (FORMAT_COPY[format] || FORMAT_COPY.link)[1]; }
  function host(url) {
    try { return new URL(String(url)).hostname.replace(/^www\./, '').slice(0, 80); }
    catch { return ''; }
  }
  function safeImage(url) {
    try { const parsed = new URL(String(url)); return parsed.protocol === 'https:' ? parsed.href : ''; }
    catch { return ''; }
  }

  function shellHead(t, actions = '') {
    return `<header class="inspiration-head">
      <span class="inspiration-mark" aria-hidden="true"><i></i><b></b><em></em></span>
      <div><p class="inspiration-kicker">SATORU · ${tr(t, 'ВДОХНОВЕНИЕ')}</p><h2 id="return-shelf-title" tabindex="-1">${tr(t, 'Вдохновение')}</h2>
      <p>${tr(t, 'Короткая подборка по твоим интересам. Она закончится — и не станет новой лентой.')}</p></div>${actions}
    </header>`;
  }

  function renderLoading(t) {
    return `<section class="return-shelf-shell inspiration-shell" aria-labelledby="return-shelf-title">${shellHead(t)}<div class="card inspiration-state" role="status" aria-live="polite"><p>${tr(t, 'Собираем сохранённое и твою подборку…')}</p></div></section>`;
  }

  function renderError(vm, t) {
    const invalid = vm.error === 'invalid';
    return `<section class="return-shelf-shell inspiration-shell" aria-labelledby="return-shelf-title">${shellHead(t)}<div class="card inspiration-state is-error" role="alert"><h3>${tr(t, invalid ? 'Данные сохранённых материалов повреждены' : 'Не удалось загрузить Вдохновение')}</h3><p>${tr(t, 'Это не пустой экран. Ничего не перезаписываем, пока данные не восстановлены.')}</p><button type="button" class="btn" data-action="shelf-retry" ${vm.busy ? 'disabled' : ''}>${tr(t, vm.busy ? 'Повторяем…' : 'Повторить')}</button></div></section>`;
  }

  function renderTabs(vm, t) {
    const section = SECTIONS.includes(vm.section) ? vm.section : 'today';
    return `<nav class="inspiration-tabs" aria-label="${tr(t, 'Разделы Вдохновения')}">
      <button type="button" data-action="inspiration-section" data-section="today" class="${section === 'today' ? 'active' : ''}" aria-current="${section === 'today' ? 'page' : 'false'}">${tr(t, 'Подборка')}</button>
      <button type="button" data-action="inspiration-section" data-section="saved" class="${section === 'saved' ? 'active' : ''}" aria-current="${section === 'saved' ? 'page' : 'false'}">${tr(t, 'Сохранённое')}<span>${Number(vm.savedCount) || 0}</span></button>
    </nav>`;
  }

  function renderFirstUse(vm, t) {
    const suggestions = rows(vm.suggestions, 6);
    const preview = suggestions.length ? `<div class="inspiration-import-preview">${suggestions.map((item) => `<span data-noi18n>${esc(item.label)}</span>`).join('')}</div>` : '';
    return `<section class="card inspiration-first-use" aria-labelledby="inspiration-first-title">
      <div class="inspiration-first-visual" aria-hidden="true"><i></i><i></i><i></i><b>✦</b></div>
      <div><p class="inspiration-kicker">${tr(t, 'ПОДБОРКА ДЛЯ ТЕБЯ')}</p><h3 id="inspiration-first-title">${tr(t, 'Что тебя зажигает?')}</h3>
      <p>${tr(t, 'Перенеси реальные интересы из TikTok или собери их из того, что уже знаешь о себе в Satoru. Перед сохранением всё можно проверить.')}</p>${preview}
      <div class="inspiration-first-actions"><label class="btn inspiration-import-file-button">${tr(t, 'Импортировать TikTok')}<input type="file" data-inspiration-import-file accept=".zip,.json,.txt,.csv,application/zip,application/json,text/plain" hidden></label><button type="button" class="btn ghost" data-action="inspiration-import-links-toggle">${tr(t, 'Вставить TikTok-ссылки')}</button><button type="button" class="btn ghost" data-action="inspiration-setup-import-satoru">${tr(t, 'Собрать из Satoru')}</button><button type="button" class="btn ghost" data-action="inspiration-setup-manual">${tr(t, 'Настроить вручную')}</button></div></div>
    </section>`;
  }

  function renderImportStats(session, t) {
    const stats = row(session && session.stats), values = [
      ['Поиски', stats.searches], ['Хэштеги', stats.hashtags], ['Видео', stats.videos], ['Сигналы', stats.signals],
    ].filter((entry) => Number(entry[1]) > 0);
    return values.length ? `<div class="inspiration-import-stats">${values.map(([label, value]) => `<span><b>${Number(value)}</b>${tr(t, label)}</span>`).join('')}</div>` : '';
  }

  function renderImporter(vm, t) {
    const session = row(vm.importSession), status = String(session.status || 'idle');
    const busy = status === 'reading' || status === 'enriching';
    const signals = rows(session.signals, 12);
    const signalPreview = signals.length ? `<div class="inspiration-import-signals" aria-label="${tr(t, 'Найденные сигналы')}">${signals.map((item) => `<span data-noi18n>${esc(item.label)}</span>`).join('')}</div>` : '';
    const result = status === 'ready' ? `<div class="inspiration-import-result" role="status"><div><span aria-hidden="true">✓</span><div><b>${tr(t, 'Профиль интересов собран')}</b><p>${tr(t, 'Проверь отмеченные темы ниже. Сохранятся только темы и сводка — не история просмотров.')}</p></div></div>${renderImportStats(session, t)}${signalPreview}<button type="button" class="btn ghost sm" data-action="inspiration-import-clear">${tr(t, 'Импортировать заново')}</button></div>`
      : status === 'empty' ? `<div class="inspiration-import-result is-warning" role="status"><div><span aria-hidden="true">!</span><div><b>${tr(t, 'Тем недостаточно')}</b><p>${tr(t, 'Архив прочитан, но знакомых тем мало. Добавь несколько ссылок или выбери темы вручную.')}</p></div></div>${renderImportStats(session, t)}${signalPreview}</div>`
      : status === 'error' ? `<div class="inspiration-import-error" role="alert"><b>${tr(t, 'Импорт не завершён')}</b><p>${tr(t, session.error || 'Не удалось прочитать импорт. Исходные интересы не изменены.')}</p></div>`
      : busy ? `<div class="inspiration-import-status" role="status" aria-live="polite"><span aria-hidden="true"></span><div><b>${tr(t, status === 'reading' ? 'Читаю архив на устройстве…' : 'Определяю темы сохранённых роликов…')}</b><p>${tr(t, status === 'reading' ? 'Файл никуда не загружается.' : 'Запрашиваются только публичные подписи роликов у TikTok.')}</p></div></div>` : '';
    const links = vm.importLinksOpen ? `<div class="inspiration-import-links"><label for="inspiration-import-links">${tr(t, 'Вставь до 32 ссылок из TikTok')}</label><textarea id="inspiration-import-links" rows="4" maxlength="12000" placeholder="https://www.tiktok.com/@…/video/…"></textarea><div><button type="button" class="btn ghost" data-action="inspiration-import-links-toggle">${tr(t, 'Отмена')}</button><button type="button" class="btn" data-action="inspiration-import-links-run">${tr(t, 'Определить интересы')}</button></div></div>` : '';
    return `<section class="inspiration-importer" aria-labelledby="inspiration-import-title">
      <header><div><p class="inspiration-kicker">${tr(t, 'БЫСТРЫЙ ИМПОРТ')}</p><h4 id="inspiration-import-title">${tr(t, 'Не заполняй профиль с нуля')}</h4></div><span class="inspiration-import-local">${tr(t, 'Архив остаётся на устройстве')}</span></header>
      <div class="inspiration-import-actions"><label class="btn inspiration-import-file-button">${tr(t, status === 'error' ? 'Выбрать другой архив' : 'Выбрать архив TikTok')}<input type="file" data-inspiration-import-file accept=".zip,.json,.txt,.csv,application/zip,application/json,text/plain" hidden></label><button type="button" class="btn ghost" data-action="inspiration-import-links-toggle" aria-expanded="${!!vm.importLinksOpen}">${tr(t, vm.importLinksOpen ? 'Скрыть ссылки' : 'Вставить ссылки')}</button><a class="btn ghost" href="https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data" target="_blank" rel="noopener noreferrer">${tr(t, 'Как получить архив')} ↗</a></div>
      ${links}${result}
      <p class="inspiration-import-disclosure">${tr(t, 'Satoru читает только интересы, поиски, хэштеги, лайки, избранное и историю просмотра. Сообщения, контакты, входы, адреса и платежи игнорируются.')}</p>
    </section>`;
  }

  function renderSetup(vm, t) {
    const profile = row(vm.profile), selected = new Set(rows(profile.interests).map((item) => item.id));
    const suggestions = rows(vm.suggestions, 6);
    // Keep already-confirmed interests as stable checkbox records even when
    // they are no longer present in today's import candidates. Rebuilding
    // their ids from a translated free-text label would break catalog matches.
    for (const interest of rows(profile.interests, 16)) {
      if (!suggestions.some((candidate) => candidate.id === interest.id)) suggestions.push(interest);
    }
    const formats = Array.isArray(profile.formats) && profile.formats.length ? profile.formats : FORMATS;
    const chip = (item) => {
      const source = String(item.source || '').trim();
      const distinctSource = source && source.toLocaleLowerCase() !== String(item.label || '').trim().toLocaleLowerCase();
      return `<label class="inspiration-choice${selected.has(item.id) ? ' is-selected' : ''}"><input type="checkbox" name="interest" value="${esc(item.id)}" data-label="${esc(item.label)}" data-source="${esc(source)}" ${selected.has(item.id) ? 'checked' : ''}><span data-noi18n>${esc(item.label)}</span>${distinctSource ? `<small>${tr(t, 'из')}: ${esc(source)}</small>` : ''}</label>`;
    };
    const chips = suggestions.slice(0, 6).map(chip).join('');
    const moreChips = suggestions.length > 6 ? `<details class="inspiration-more-topics"><summary>${tr(t, 'Ещё темы')} · ${suggestions.length - 6}</summary><div class="inspiration-choices">${suggestions.slice(6).map(chip).join('')}</div></details>` : '';
    const formatChoices = FORMATS.map((format) => `<label class="inspiration-format-choice${formats.includes(format) ? ' is-selected' : ''}"><input type="checkbox" name="format" value="${format}" ${formats.includes(format) ? 'checked' : ''}><span aria-hidden="true" data-format="${format}"></span><b>${tr(t, formatLabel(format))}</b></label>`).join('');
    const manual = '';
    return `<form id="inspiration-setup-form" class="card inspiration-setup">
      <header><div><p class="inspiration-kicker">${tr(t, 'НАСТРОЙКА · ДО 2 МИНУТ')}</p><h3>${tr(t, 'Собери свою подборку')}</h3></div><button type="button" class="inspiration-close" data-action="inspiration-setup-close" aria-label="${tr(t, 'Закрыть')}">✕</button></header>
      ${renderImporter(vm, t)}
      <fieldset><legend><b>1</b><span>${tr(t, 'Темы, вселенные и образы')}</span><small>${tr(t, 'Выбери то, что действительно может тебя зацепить.')}</small></legend><div class="inspiration-choices">${chips || `<p>${tr(t, 'Добавь первую тему своими словами.')}</p>`}</div>${moreChips}
      <label class="inspiration-free"><span>${tr(t, 'Добавить свои темы')}</span><input name="customInterests" value="${esc(manual)}" maxlength="300" placeholder="${tr(t, 'Spider-Verse, Re:Zero, путешествия…')}" autocomplete="off"></label></fieldset>
      <fieldset><legend><b>2</b><span>${tr(t, 'Что показывать')}</span><small>${tr(t, 'Можно выбрать несколько форматов.')}</small></legend><div class="inspiration-format-choices">${formatChoices}</div>
      <details class="inspiration-setup-more"><summary>${tr(t, 'Что не показывать')}</summary><label class="inspiration-free"><span>${tr(t, 'Исключить темы')}</span><input name="blocked" value="${esc((profile.blocked || []).join(', '))}" maxlength="300" placeholder="${tr(t, 'Необязательно. Например: hustle, сравнение тел, политика.')}" autocomplete="off"></label></details></fieldset>
      <p class="inspiration-privacy">${tr(t, 'Интересы принадлежат твоему аккаунту. Satoru использует их только для конечной подборки и не публикует.')}</p>
      <p class="return-shelf-form-status" data-shelf-form-status role="status" aria-live="polite"></p>
      <div class="inspiration-setup-actions"><button type="button" class="btn ghost" data-action="inspiration-setup-import-satoru">${tr(t, 'Добавить из Satoru')}</button><button type="submit" class="btn">${tr(t, 'Показать мою подборку')}</button></div>
    </form>`;
  }

  function mediaControl(item, t) {
    if (item.mediaPolicy === 'iframe' && item.embedUrl) return `<button type="button" class="inspiration-play" data-action="inspiration-play" data-id="${esc(item.id)}" aria-label="${tr(t, formatAction(item.format))}: ${esc(item.title)}"><span aria-hidden="true">▶</span>${tr(t, formatAction(item.format))}</button>`;
    if (item.mediaPolicy === 'link' && (item.sourceUrl || item.url)) return `<button type="button" class="inspiration-play" data-action="inspiration-open-source" data-id="${esc(item.id)}"><span aria-hidden="true">↗</span>${tr(t, item.format === 'podcast' ? 'Открыть выпуск' : 'Открыть источник')}</button>`;
    return '';
  }

  function renderVisual(item, t) {
    const imageUrl = item.format === 'image' ? safeImage(item.imageUrl) : '';
    const image = imageUrl ? `<img class="inspiration-visual-image" src="${esc(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    const quote = item.format === 'quote' ? `<blockquote id="inspiration-item-${esc(item.id)}" data-noi18n>${esc(item.title)}</blockquote>` : '';
    const body = item.format === 'quote' ? `<p class="inspiration-attribution" data-noi18n>${esc(item.body)}</p>` : `<div class="inspiration-visual-copy"><h3 id="inspiration-item-${esc(item.id)}" data-noi18n>${esc(item.title)}</h3><p data-noi18n>${esc(item.body)}</p></div>`;
    return `<div class="inspiration-visual is-${esc(item.visual || item.format || 'link')}" data-inspiration-media="${esc(item.id)}">${image}<div class="inspiration-art" aria-hidden="true"><i></i><i></i><b></b></div>${quote}${body}${mediaControl(item, t)}</div>`;
  }

  function renderDigestItem(item, index, vm, t) {
    const reason = Array.isArray(item.reason) && item.reason.length ? item.reason.join(' + ') : tr(t, 'твои интересы');
    const done = !!item.done, saved = !!item.saved, verdict = item.feedbackVerdict || '';
    const rights = item.attribution ? `<span class="inspiration-source" data-noi18n>${esc(item.attribution)}</span>` : '';
    const sourceAction = item.rightsUrl || item.sourceUrl ? `<button type="button" class="inspiration-menu-action" data-action="inspiration-open-rights" data-id="${esc(item.id)}">${tr(t, 'Источник и права')}</button>` : '';
    return `<article class="inspiration-item${index === 0 ? ' is-featured' : ''}${done ? ' is-done' : ''}" style="--item-index:${index}" data-inspiration-id="${esc(item.id)}" aria-labelledby="inspiration-item-${esc(item.id)}">
      <div class="inspiration-item-meta"><span>${tr(t, formatLabel(item.format))}${item.durationLabel ? ` · ${esc(item.durationLabel)}` : ''}</span><span>${index + 1} ${tr(t, 'из')} ${Number(vm.digestTotal) || 3}</span></div>
      ${renderVisual(item, t)}
      <div class="inspiration-why"><span>${tr(t, 'Почему здесь')}</span><b data-noi18n>${esc(reason)}</b>${rights}</div>
      <div class="inspiration-item-actions">
        <button type="button" class="btn${done ? ' ghost' : ''}" data-action="inspiration-done" data-id="${esc(item.id)}" ${done ? 'disabled' : ''}>${done ? tr(t, 'Просмотрено ✓') : tr(t, 'Дальше')}</button>
        <button type="button" class="inspiration-save" data-action="inspiration-save" data-id="${esc(item.id)}" ${saved ? 'disabled' : ''}>${saved ? tr(t, 'Сохранено') : tr(t, 'Сохранить')}</button>
        <details class="inspiration-item-more"><summary aria-label="${tr(t, 'Ещё действия')}">•••</summary><div role="group" aria-label="${tr(t, 'Настроить подборку')}">
          <button type="button" class="inspiration-menu-action${verdict === 'more' ? ' is-active' : ''}" data-action="inspiration-feedback" data-verdict="more" data-id="${esc(item.id)}" aria-pressed="${verdict === 'more'}">${tr(t, 'Больше такого')}</button>
          <button type="button" class="inspiration-menu-action${verdict === 'not_for_me' ? ' is-active' : ''}" data-action="inspiration-feedback" data-verdict="not_for_me" data-id="${esc(item.id)}" aria-pressed="${verdict === 'not_for_me'}">${tr(t, 'Не моё')}</button>${sourceAction}
        </div></details>
      </div>
    </article>`;
  }

  function renderDaily(vm, t) {
    const items = rows(vm.items, 3);
    const interests = rows(vm.profile && vm.profile.interests, 8);
    const summary = `<div class="inspiration-profile-summary"><div>${interests.slice(0, 5).map((item) => `<span data-noi18n>${esc(item.label)}</span>`).join('')}${interests.length > 5 ? `<span>+${interests.length - 5}</span>` : ''}</div><button type="button" class="btn ghost sm" data-action="inspiration-setup-edit">${tr(t, 'Настроить')}</button></div>`;
    if (!items.length) return `${summary}<div class="card inspiration-state"><h3>${tr(t, 'Для этих интересов пока нет безопасных материалов')}</h3><p>${tr(t, 'Измени форматы или добавь своё. Мы не подставляем случайные ссылки только ради заполнения экрана.')}</p><button type="button" class="btn" data-action="inspiration-setup-edit">${tr(t, 'Изменить интересы')}</button></div>`;
    const terminal = vm.digestDone ? `<section class="card inspiration-terminal" role="status"><span aria-hidden="true">✓</span><div><h3>${tr(t, 'На сегодня всё')}</h3><p>${tr(t, 'Подборка закончилась. Никакого «ещё одного». Можно вернуться к своему дню.')}</p></div><button type="button" class="btn" data-action="goto-today">${tr(t, 'К делам')}</button></section>` : '';
    return `${summary}<div class="inspiration-digest${vm.animateEntry ? ' should-enter' : ''}" aria-label="${tr(t, 'Подборка на сегодня')}">${items.map((item, index) => renderDigestItem(item, index, vm, t)).join('')}</div>${terminal}`;
  }

  function renderQuickAdd(vm, t) {
    if (!vm.composerOpen) return '';
    return `<form id="return-shelf-add-form" class="card inspiration-quick-add"><header><div><p class="inspiration-kicker">${tr(t, 'СОХРАНИТЬ СВОЁ')}</p><h3>${tr(t, 'Вставь материал — остальное определим сами')}</h3></div><button type="button" class="inspiration-close" data-action="shelf-toggle-composer" aria-label="${tr(t, 'Закрыть')}">✕</button></header>
      <label><span>${tr(t, 'Ссылка, цитата или мысль')}</span><textarea name="content" maxlength="1000" required rows="3" placeholder="https://…"></textarea></label>
      <label><span>${tr(t, 'Название, если хочется уточнить')}</span><input name="title" maxlength="120" autocomplete="off"></label>
      <p>${tr(t, 'Формат определяется автоматически. Чужие видео и аудио не копируются на сервер.')}</p>
      <p class="return-shelf-form-status" data-shelf-form-status role="status" aria-live="polite"></p>
      <div><button type="button" class="btn ghost" data-action="shelf-toggle-composer">${tr(t, 'Отмена')}</button><button type="submit" class="btn">${tr(t, 'Сохранить')}</button></div>
    </form>`;
  }

  function savedMedia(item, t) {
    if (item.catalogItem) return renderVisual(Object.assign({}, item.catalogItem, { id: item.id }), t);
    if (item.embedUrl) return `<div class="inspiration-saved-preview is-link" data-inspiration-media="${esc(item.id)}"><button type="button" class="inspiration-play" data-action="inspiration-play-saved" data-id="${esc(item.id)}"><span aria-hidden="true">▶</span>${tr(t, 'Смотреть')}</button></div>`;
    if (item.format === 'image' && item.url) return `<div class="inspiration-saved-preview is-link"><span>${esc(host(item.url) || tr(t, 'Изображение'))}</span></div>`;
    if (item.note) return `<blockquote class="inspiration-saved-quote" data-noi18n>${esc(item.note)}</blockquote>`;
    return `<div class="inspiration-saved-preview is-link"><span>${esc(host(item.url) || (typeof t === 'function' ? t(formatLabel(item.format)) : formatLabel(item.format)))}</span></div>`;
  }

  function renderSaved(vm, t) {
    const saved = rows(vm.saved, 40), archived = rows(vm.archived, 160);
    const status = vm.errorMessage ? `<p class="return-shelf-inline-error" role="alert">${tr(t, vm.errorMessage)}</p>` : '';
    const list = saved.length ? `<div class="inspiration-saved-grid">${saved.map((item) => `<article class="card inspiration-saved-item" data-shelf-id="${esc(item.id)}">${savedMedia(item, t)}<div><span class="inspiration-format-label">${tr(t, formatLabel(item.format))}</span><h3 data-noi18n>${esc(item.title)}</h3>${item.attribution ? `<p data-noi18n>${esc(item.attribution)}</p>` : ''}</div><div class="inspiration-saved-actions">${item.url ? `<button type="button" class="btn ghost" data-action="shelf-open-source" data-id="${esc(item.id)}">${tr(t, 'Открыть')}</button>` : ''}<button type="button" class="btn ghost" data-action="shelf-archive" data-id="${esc(item.id)}">${tr(t, 'В архив')}</button></div></article>`).join('')}</div>` : `<div class="card inspiration-state"><h3>${tr(t, 'Пока ничего не сохранено')}</h3><p>${tr(t, 'Сохраняй сильные материалы из подборки одним нажатием или добавь своё.')}</p><button type="button" class="btn" data-action="shelf-toggle-composer">${tr(t, 'Добавить своё')}</button></div>`;
    const archive = archived.length ? `<details class="card inspiration-archive"><summary>${tr(t, 'Архив')} · ${archived.length}</summary><div>${archived.map((item) => `<p><span data-noi18n>${esc(item.title)}</span><button type="button" class="btn danger sm" data-action="shelf-delete" data-id="${esc(item.id)}">${tr(t, 'Удалить')}</button></p>`).join('')}</div></details>` : '';
    return `<div class="inspiration-saved-head"><div><h3>${tr(t, 'Мои материалы')}</h3><p>${tr(t, 'Личная конечная коллекция — не ещё один список «когда-нибудь».')}</p></div><button type="button" class="btn" data-action="shelf-toggle-composer">${vm.composerOpen ? tr(t, 'Закрыть') : `+ ${tr(t, 'Добавить своё')}`}</button></div>${renderQuickAdd(vm, t)}${status}${list}${archive}`;
  }

  function renderReady(vm, t) {
    const configured = !!(vm.profile && vm.profile.configured);
    const setup = !!vm.setupOpen;
    const actions = configured ? `<button type="button" class="btn ghost inspiration-settings-button" data-action="inspiration-setup-edit" aria-label="${tr(t, 'Настроить интересы')}">${tr(t, 'Интересы')}</button>` : '';
    const main = setup ? renderSetup(vm, t) : !configured ? renderFirstUse(vm, t)
      : (vm.section === 'saved' ? renderSaved(vm, t) : renderDaily(vm, t));
    return `<section class="return-shelf-shell inspiration-shell" aria-labelledby="return-shelf-title">${shellHead(t, actions)}${configured && !setup ? renderTabs(vm, t) : ''}${main}</section>`;
  }

  function render(vm = {}, t) {
    if (vm.state === 'loading') return renderLoading(t);
    if (vm.state === 'error') return renderError(vm, t);
    return renderReady(vm, t);
  }

  return Object.freeze({ VERSION, SECTIONS, FORMATS, render, renderLoading, renderError, renderReady });
});
