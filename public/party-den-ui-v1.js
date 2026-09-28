/* Shared room UI. The server owns membership, placement and durable receipts. */
(function(root) {
  'use strict';
  // ru / en / de / uk / es
  const copy = {
    title: ['Общее Логово', 'Our shared Den', 'Unser gemeinsames Versteck', 'Спільне Лігво', 'Nuestra Guarida compartida'],
    intro: ['Свои дела. Свои награды. Одна комната, которую вы обустраиваете вместе.', 'Your tasks. Your rewards. One room you furnish together.', 'Eigene Aufgaben. Eigene Belohnungen. Ein Raum, den ihr gemeinsam einrichtet.', 'Свої справи. Свої нагороди. Одна кімната, яку ви облаштовуєте разом.', 'Vuestras tareas y recompensas. Una habitación que decoráis juntos.'],
    empty: ['Первую вещь можно поставить уже сейчас.', 'Place your first item now.', 'Stelle jetzt den ersten Gegenstand auf.', 'Першу річ можна поставити вже зараз.', 'Coloca vuestro primer objeto ahora.'],
    choose: ['Из моей коллекции', 'From my collection', 'Aus meiner Sammlung', 'З моєї колекції', 'De mi colección'],
    place: ['Поставить для группы', 'Place for the group', 'Für die Gruppe aufstellen', 'Поставити для групи', 'Colocar para el grupo'],
    remove: ['Убрать мою вещь', 'Remove my item', 'Meinen Gegenstand entfernen', 'Прибрати мою річ', 'Retirar mi objeto'],
    privacy: ['Участники увидят выбранную вещь и твоё имя. Личный план скрыт. Мебель остаётся твоей; дополнительной платы нет.', 'Members see this item and your name. Your plan stays private. You keep the furniture; there is no extra charge.', 'Mitglieder sehen diesen Gegenstand und deinen Namen. Dein Plan bleibt privat. Die Möbel bleiben deine; ohne zusätzliche Kosten.', 'Учасники побачать вибрану річ і твоє ім’я. Особистий план прихований. Меблі залишаються твоїми; додаткової плати немає.', 'Los miembros verán el objeto y tu nombre. Tu plan sigue privado. Los muebles siguen siendo tuyos; no hay coste adicional.'],
    busy: ['Сохраняем…', 'Saving…', 'Wird gespeichert…', 'Зберігаємо…', 'Guardando…'],
    saved: ['Комната сохранена для всех участников.', 'Room saved for all members.', 'Raum für alle Mitglieder gespeichert.', 'Кімнату збережено для всіх учасників.', 'Habitación guardada para todos.'],
    error: ['Не удалось подтвердить сохранение. Попробуй ещё раз.', 'Could not confirm the save. Please try again.', 'Speicherung nicht bestätigt. Bitte erneut versuchen.', 'Не вдалося підтвердити збереження. Спробуй ще раз.', 'No se pudo confirmar el guardado. Inténtalo de nuevo.'],
    conflict: ['Комната изменилась. Обнови её и выбери место снова.', 'The room changed. Refresh and choose again.', 'Der Raum hat sich geändert. Aktualisieren und erneut wählen.', 'Кімната змінилася. Онови її та вибери місце знову.', 'La habitación cambió. Actualiza y elige de nuevo.'],
    loadError: ['Не удалось обновить комнату.', 'Could not refresh the room.', 'Raum konnte nicht aktualisiert werden.', 'Не вдалося оновити кімнату.', 'No se pudo actualizar la habitación.'],
    retry: ['Повторить сохранение', 'Retry save', 'Speichern wiederholen', 'Повторити збереження', 'Reintentar guardado'],
    refresh: ['Обновить комнату', 'Refresh room', 'Raum aktualisieren', 'Оновити кімнату', 'Actualizar habitación'],
    occupied: ['Это место занято вещью друга. Выбери другую.', 'A friend owns this spot. Choose another item.', 'Hier steht der Gegenstand eines Freundes. Wähle einen anderen.', 'Це місце зайняте річчю друга. Вибери іншу.', 'Este lugar tiene un objeto de un amigo. Elige otro.'],
    placed: ['Уже стоит здесь', 'Already placed here', 'Steht bereits hier', 'Вже стоїть тут', 'Ya está colocado aquí'],
    shop: ['Выбрать следующую вещь за золото', 'Choose your next item for gold', 'Nächsten Gegenstand für Gold wählen', 'Вибрати наступну річ за золото', 'Elegir el próximo objeto con oro'],
    personal: ['Моё Логово', 'My Den', 'Mein Versteck', 'Моє Лігво', 'Mi Guarida'],
    shared: ['К общему Логову', 'Go to our shared Den', 'Zum gemeinsamen Versteck', 'До спільного Лігва', 'Ir a la Guarida compartida'],
    goal: ['Моя цель за золото', 'My gold goal', 'Mein Goldziel', 'Моя ціль за золото', 'Mi objetivo de oro'],
    ready: ['Можно купить', 'Ready to buy', 'Bereit zum Kauf', 'Можна купити', 'Listo para comprar'],
    remaining: ['Осталось золота', 'Gold remaining', 'Noch benötigtes Gold', 'Залишилося золота', 'Oro restante'],
    level: ['Откроется на уровне', 'Unlocks at level', 'Ab Level verfügbar', 'Відкриється на рівні', 'Se desbloquea en el nivel'],
    acquired: ['В твоей коллекции', 'In your collection', 'In deiner Sammlung', 'У твоїй колекції', 'En tu colección'],
  };
  const text = (key, locale) => copy[key][({ ru: 0, en: 1, de: 2, uk: 3, es: 4 })[locale] ?? 1];
  function createUI(d) {
    let selected = '', pending = null, busy = false, message = '', identity = '', reading = false;
    const tr = key => text(key, d.lang());
    const current = () => { const p = d.state().party; return p && p.members ? { p, me: p.members.find(m => m.me)?.id } : {}; };
    function scope() {
      const { p, me } = current(), next = p && me ? p.id + ':' + me : '';
      if (next !== identity) { identity = next; selected = ''; pending = null; busy = false; message = ''; }
      return next;
    }
    const safe = d.escape;
    function body() {
      if (!scope()) return '';
      const { p, me } = current(), room = p.sharedDen;
      if (!room) return `<section class="card"><p>${tr('loadError')}</p><button data-party-den="refresh">${tr('refresh')}</button></section>`;
      const owned = d.items().filter(x => x.access !== 'pro' && d.owned(x.id));
      if (!owned.some(x => x.id === selected)) selected = owned[0]?.id || '';
      const choice = owned.find(x => x.id === selected), occupied = room.placements.find(x => x.slot === choice?.slot);
      const blocked = occupied && occupied.actor !== me, same = occupied?.itemId === selected && !blocked;
      const rows = room.placements.map(pose => {
        const entry = d.items().find(x => x.id === pose.itemId);
        const member = p.members.find(m => m.id === pose.actor);
        return `<li><span><strong>${safe(d.translate(entry.name))}</strong><small>${safe(p.sharedDenNames?.[pose.actor] || member?.name || '—')}</small></span>${pose.actor === me ? `<button class="btn ghost" data-party-den="remove" data-slot="${pose.slot}" ${busy || pending ? 'disabled' : ''} aria-label="${safe(tr('remove') + ': ' + d.translate(entry.name))}">${tr('remove')}</button>` : ''}</li>`;
      }).join('');
      return `<section class="card shared-den" aria-labelledby="shared-den-title">
        <header><div><h3 id="shared-den-title" tabindex="-1">${tr('title')}</h3><p class="muted">${tr('intro')}</p></div><button class="btn ghost" data-party-den="refresh" ${busy ? 'disabled' : ''}>${tr('refresh')}</button></header>
        ${d.scene(room)}
        <div data-party-project-host>${d.project ? d.project() : ''}</div>
        ${rows ? `<ul class="shared-den-items">${rows}</ul>` : `<p class="muted">${tr('empty')}</p>`}
        <div class="shared-den-editor"><label for="shared-den-item">${tr('choose')}</label><div class="shared-den-controls"><select id="shared-den-item" ${busy || pending ? 'disabled' : ''}>${owned.map(x => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${safe(d.translate(x.name))}</option>`).join('')}</select>
        <button class="btn" data-party-den="place" ${busy || pending || blocked || same || !choice ? 'disabled' : ''}>${busy ? tr('busy') : same ? tr('placed') : tr('place')}</button></div>
        ${blocked ? `<p>${tr('occupied')}</p>` : ''}<p class="muted shared-den-privacy">${tr('privacy')}</p>
        <p class="shared-den-status" role="status" aria-live="polite">${safe(message)}</p>
        ${pending && !busy ? `<button class="btn" data-party-den="retry">${tr('retry')}</button>` : ''}</div>
        <footer><button class="btn ghost" data-action="goto-rewards">${tr('shop')}</button><button class="btn ghost" data-party-den="personal">${tr('personal')}</button></footer>
      </section>`;
    }
    function paint(focus) {
      const host = document.querySelector('[data-party-den-host]');
      if (!host) return;
      // Polling never replaces a focused editor. Explicit actions may do so.
      if (!focus && host.contains(document.activeElement)) {
        const active = document.activeElement;
        if (active.matches('input,select')) return;
        if (active.dataset.partyDen) focus = `[data-party-den="${active.dataset.partyDen}"]${active.dataset.slot ? `[data-slot="${active.dataset.slot}"]` : ''}`;
      }
      host.innerHTML = body();
      if (focus) host.querySelector(focus)?.focus();
    }
    async function refresh(explicit = false) {
      const captured = scope();
      if (!captured || reading || busy || (!explicit && pending)) return;
      if (!explicit && document.activeElement.closest('[data-party-den-host]') && document.activeElement.matches('input,select')) return;
      reading = true;
      try {
        const response = await fetch('/api/party/den', { cache: 'no-store' }), data = await response.json();
        if (scope() !== captured) return;
        if (!response.ok || data.partyId !== current().p.id || !data.room) throw Error('refresh');
        const changed = JSON.stringify(current().p.sharedDen) !== JSON.stringify(data.room) || JSON.stringify(current().p.sharedDenNames) !== JSON.stringify(data.names) || (data.projects?.revision || 0) > (current().p.projects?.revision || 0);
        if (data.projects && data.projects.revision >= (current().p.projects?.revision || 0)) current().p.projects = data.projects;
        current().p.sharedDen = data.room;
        current().p.sharedDenNames = data.names;
        if (explicit) message = '';
        if (changed || explicit) paint(explicit ? '[data-party-den="refresh"]' : null);
      } catch { if (scope() === captured && explicit) { message = tr('loadError'); paint('[data-party-den="refresh"]'); } }
      finally { reading = false; }
    }
    async function save(input) {
      const captured = scope(); if (!captured || busy) return;
      pending = input; busy = true; message = tr('busy'); paint('#shared-den-title');
      try {
        const response = await fetch('/api/party/den', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data = await response.json(); if (scope() !== captured) return;
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) { pending = null; message = tr('conflict'); }
          else message = tr('error');
        } else if (data.partyId === current().p.id && data.room) {
          current().p.sharedDen = data.room; current().p.sharedDenNames = data.names; pending = null; message = tr('saved');
        } else message = tr('error');
      } catch { if (scope() === captured) message = tr('error'); }
      finally { if (scope() === captured) { busy = false; paint(pending ? '[data-party-den="retry"]' : '#shared-den-title'); } }
    }
    async function handle(event) {
      const button = event.target.closest('[data-party-den]'); if (!button) return false;
      event.preventDefault(); scope(); const op = button.dataset.partyDen;
      if (op === 'refresh') await refresh(true);
      else if (op === 'personal') d.navigate('den');
      else if (op === 'shared') d.navigate('party');
      else if (op === 'retry' && pending) await save(pending);
      else if (!pending && !busy && ['place', 'remove'].includes(op)) {
        const { p } = current(), choice = d.items().find(x => x.id === selected);
        if (p && (op === 'remove' || choice)) await save({ partyId: p.id, operationId: crypto.randomUUID(),
          revision: p.sharedDen.revision, share: true, slot: op === 'remove' ? button.dataset.slot : choice.slot,
          itemId: op === 'remove' ? null : choice.id });
      }
      return true;
    }
    document.addEventListener('change', event => { if (event.target.id === 'shared-den-item') { selected = event.target.value; paint('#shared-den-item'); } });
    setInterval(() => { if (d.state().view === 'party' && document.visibilityState === 'visible') refresh(); }, 15000);
    return { body, handle, refresh };
  }
  root.PartyDenUIV1 = { createUI, text };
})(typeof window === 'undefined' ? globalThis : window);
