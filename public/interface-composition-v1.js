/* Presentation only. Move existing controls, never clone records or decide game rules.
 * Input: detached route DOM from the canonical renderers. No network or persistence.
 * Missing selectors leave the original view intact (including recovery/error views).
 */
(function (root) {
  'use strict';
  const choices = new Map();
  const el = (doc, tag, className) => Object.assign(doc.createElement(tag), {className});
  function region(parent, className, nodes, tag = 'div') {
    const box = el(parent.ownerDocument, tag, className);
    nodes.filter(Boolean).forEach(node => box.append(node));
    parent.append(box); return box;
  }
  function tabs(parent, key, entries, t) {
    const items = entries.filter(item => item.nodes.some(Boolean));
    if (items.length < 2) return;
    const doc = parent.ownerDocument, box = el(doc, 'section', 'workspace-browser');
    box.dataset.workspace = key;
    const nav = el(doc, 'div', 'workspace-tabs'); nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', t(items[0].label)); box.append(nav);
    const selected = items.some(item => item.id === choices.get(key)) ? choices.get(key) : items[0].id;
    for (const item of items) {
      const button = el(doc, 'button', 'workspace-tab'); button.type = 'button';
      button.textContent = t(item.label); button.dataset.layoutTab = item.id;
      button.id = `workspace-${key}-${item.id}-tab`;
      button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `workspace-${key}-${item.id}`);
      nav.append(button);
      const panel = region(box, 'workspace-panel', item.nodes, 'section');
      panel.id = `workspace-${key}-${item.id}`; panel.dataset.layoutPanel = item.id;
      panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id);
      // A selected collection must not require a second disclosure to enter it.
      for (const node of item.nodes.filter(Boolean)) if (node.tagName === 'DETAILS') node.open = true;
    }
    parent.append(box); select(box, selected, false);
  }
  function select(box, id, focus) {
    const buttons = [...box.querySelectorAll(':scope > .workspace-tabs > button')];
    if (!buttons.some(button => button.dataset.layoutTab === id)) return;
    choices.set(box.dataset.workspace, id);
    buttons.forEach(button => {
      const selected = button.dataset.layoutTab === id;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    box.querySelectorAll(':scope > .workspace-panel').forEach(panel => {panel.hidden = panel.dataset.layoutPanel !== id;});
  }
  function reveal(target) {
    for (let node = target; node; node = node.parentElement) {
      if (node.matches?.('.workspace-panel')) select(node.parentElement, node.dataset.layoutPanel, false);
      if (node.tagName === 'DETAILS') node.open = true;
    }
  }
  function apply(root, view, {t = value => value, roomSrc = ''} = {}) {
    if (root.dataset.composition === view) return;
    root.dataset.composition = view;
    const q = selector => root.querySelector(selector);
    const all = selector => [...root.querySelectorAll(selector)];
    if (view === 'today') {
      const card = q('.today-support .comp-card'), summary = card?.querySelector('.secretary-summary');
      if (card && summary && roomSrc) {
        const art = summary.querySelector('.comp-art'), body = summary.querySelector('.comp-body');
        const name = body?.querySelector('.comp-name'), line = body?.querySelector('.comp-line-row');
        const toggle = summary.querySelector('.secretary-toggle');
        if (art && name && line) {
          const scene = el(root.ownerDocument, 'div', 'today-lair');
          const image = el(root.ownerDocument, 'img', 'today-lair-room');
          image.src = roomSrc; image.alt = ''; image.width = 1536; image.height = 864;
          scene.append(image, art);
          summary.replaceChildren(name, ...(toggle ? [toggle] : []));
          summary.after(scene); scene.after(line);
        }
      }
    }
    if (view === 'calendar' || view === 'weekly') {
      const header = q('.calv-head'), tools = q('.cal-tools');
      if (header && tools) { tools.classList.add('calendar-tools-footer'); header.append(tools); }
      // Always show unassigned work and the full scheduling form when opened.
      all('.calv-tray,.calendar-add-options').forEach(node => {node.open = true;});
      const shell = q('.calendar-week-shell'), work = q('.week-work'), support = q('.week-secondary');
      if (shell && work && support) region(shell, 'week-workspace', [work, support]);
      all('.wk-task-main').forEach(button => {
        const meta = button.querySelector('.wk-task-meta'); if (meta) button.prepend(meta);
      });
    }
    if (view === 'goals') {
      const menu = q('.goals-more-menu'), nav = q('.goals-route-nav');
      if (menu && nav) {
        const direct = el(root.ownerDocument, 'div', 'goals-direct-tools');
        ['goals-toggle-bulk','ai-import-goals'].forEach(action => {
          const button = menu.querySelector(`[data-action="${action}"]`); if (button) direct.append(button);
        });
        if (q('.goals-all-tools [data-action="goals-toggle-bulk"]') || q('.goals-bulk-toolbar')) direct.querySelector('[data-action="goals-toggle-bulk"]')?.remove();
        nav.append(direct);
      }
    }
    if (view === 'habits') {
      const shell = q('.habits-shell'), today = q('.habits-today'), nav = q('.hsub');
      if (shell && nav) {
        const content = el(root.ownerDocument, 'section', 'habits-design-panel');
        const siblings = []; for (let node = nav.nextElementSibling; node; node = node.nextElementSibling) siblings.push(node);
        content.append(nav, ...siblings);
        const daily = today || q('.habit-today-card');
        region(shell, 'habits-workspace', [daily, content]);
      }
    }
    if (view === 'notes') {
      const shell = q('.notes-screen'), capture = q('.capture-card'), list = q('.notes-list');
      if (shell && list) {
        const composer = capture || q('[data-capture-owner]') || q('form.capture');
        if (composer) region(shell, 'notes-workspace', [composer, list]);
        list.classList.add('notes-gallery');
      }
    }
    if (view === 'rewards') {
      const shell = q('.rewards-shell'), hero = q('.reward-hero');
      if (shell && hero) {
        const daily = q('.daily-reward-card'), store = q('.personal-reward-store');
        const collection = q('.collection-card'), arsenal = q('.arsenal-disclosure');
        const achievements = q('.achievements-disclosure');
        const history = all('.rewards-shell > .rewards-disclosure').find(node => node !== collection && node !== arsenal && node !== achievements);
        const primary = q('.rewards-primary-grid');
        // One catalogue entry, next to the collection it edits.
        hero.querySelector('.th-actions')?.remove();
        if (store) {
          const heading = store.querySelector('h3'), actions = store.querySelector('.settings-actions');
          const create = store.querySelector('.reward-create-details'), grid = store.querySelector('.rewards-grid');
          if (heading && actions) {
            const head = region(store, 'reward-shop-head', [heading, actions]); store.prepend(head);
          }
          if (create && grid) grid.before(create);
        }
        const stage = region(shell, 'rewards-stage', [hero, daily]);
        shell.prepend(stage);
        tabs(shell, 'rewards', [
          {id:'shop', label:'Личные награды', nodes:[store]},
          {id:'collection', label:'Коллекция', nodes:[collection, arsenal]},
          {id:'achievements', label:'Достижения', nodes:[achievements]},
          {id:'history', label:'Правила и история', nodes:[history]},
        ], t);
        if (primary && !primary.children.length) primary.remove();
      }
    }
    if (view === 'den') {
      const card = q('.den-card'), console = q('.den-console');
      if (card && console) { card.classList.add('den-room-workspace'); console.classList.add('den-control-rail'); }
    }
    if (view === 'character') {
      const wardrobe = q('.character-wardrobe-v1'), identity = q('.character-identity');
      const preview = q('.character-wardrobe-preview-panel'), secondary = q('.character-secondary');
      if (wardrobe && identity && preview) {
        wardrobe.before(identity);
        if (secondary) preview.append(secondary);
      }
    }
    if (view === 'pets') {
      const shell = q('.pets-shell'), grid = q('.pet-grid'), intro = q('.pet-intro'), comp = q('.comp-card');
      if (shell && grid) {
        // Pets first; the same Shadow is already available in Today and the assistant.
        const priority = q('.pet-priority');
        const support = region(shell, 'pets-context', [priority, intro], 'aside');
        // The global Shadow button already opens the same assistant here.
        comp?.remove();
        const gallery = region(shell, 'pets-workspace', [grid, support]);
        // The actual pet, not an emblem, is visible before its settings are opened.
        // Move the original interactive art: IDs, animation nodes and handlers remain intact.
        all('.pet-card').forEach(card => {
          const summary = card.querySelector(':scope > summary');
          const art = card.querySelector('.pet-summary-body .pet-art');
          if (summary && art) summary.prepend(art);
          const name = summary?.querySelector('.pet-summary-name');
          if (name?.querySelector('b')?.textContent === name?.querySelector('small')?.textContent) name.querySelector('small')?.remove();
        });
        all('.body-toad-domain-badge').forEach(node=>node.remove());
      }
    }
    if (view === 'tree') {
      const shell = q('.tree-shell'), spheres = q('.tree-tabs-card'), path = q('#tree-route-content'), mode = q('.tree-v4-switch');
      if (shell && spheres && path) {
        const body = el(root.ownerDocument, 'div', 'tree-path-work'); body.append(...[mode,path].filter(Boolean));
        region(shell, 'tree-workspace', [spheres,body]);
      }
    }
    if (view === 'stats') {
      const shell = q('.stats-shell'), lead = q('.stats-lead'), kpis = q('.stats-kpis-compact');
      lead?.querySelector('p')?.remove(); // Balance explanation already lives in the balance panel.
      if (shell && lead && kpis) {const summary = region(shell, 'stats-overview', [lead,kpis]);q('.stats-route-head').after(summary);}
      const panels = all('.stats-shell > .stats-progressive');
      if (shell && panels.length) tabs(shell, 'stats', panels.map((node,i)=>({id:String(i),label:node.querySelector('summary').textContent.trim(),nodes:[node]})), t);
    }
    if (view === 'settings') {
      const shell = q('.settings-shell'), hub = q('.settings-hub'), nav = q('.settings-hub-nav');
      const groups = all('.settings-shell > .settings-group');
      if (shell && hub && nav && groups.length) {
        hub.querySelector('.settings-eyebrow')?.remove();
        const heading = hub.querySelector('h2'); if (heading) heading.textContent = t('Настройки');
        const rail = el(root.ownerDocument, 'aside', 'settings-purpose-rail'); rail.append(nav);
        const step = q('.settings-mobile-step'); if (step) rail.append(step);
        const content = el(root.ownerDocument, 'div', 'settings-purpose-content'); content.append(...groups);
        region(shell, 'settings-workspace', [rail,content]);
      }
    }
    if (view === 'shelf') {
      const shell = q('.inspiration-shell'), head = q('.inspiration-head');
      if (shell && head) {
        shell.classList.add('inspiration-studio');
        const actions = q('.inspiration-first-actions');
        if (actions) {
          const imported = actions.querySelector('[data-action="inspiration-setup-import-satoru"]');
          const manual = actions.querySelector('[data-action="inspiration-setup-manual"]');
          const importControls = [...actions.children].filter(node => node !== imported && node !== manual);
          const details = el(root.ownerDocument, 'details', 'inspiration-import-choice');
          const summary = el(root.ownerDocument, 'summary', ''); summary.textContent = t('Импорт из TikTok');
          details.append(summary); region(details, 'inspiration-import-methods', importControls);
          actions.replaceChildren(...[imported, details, manual].filter(Boolean));
        }
        const setup = q('.inspiration-setup'), fields = all('.inspiration-setup > fieldset');
        if (setup && fields.length) {
          const grid = region(setup, 'inspiration-profile-workspace', fields);
          const footer = setup.querySelector('.inspiration-privacy'); if (footer) footer.before(grid);
        }
      }
    }
    if (view === 'party') {
      const shell = q('.party-shell'), hero = q('.event-hero');
      if (shell && hero) {
        const panels = [...shell.children].filter(node => node !== hero);
        const work = region(shell, 'party-team-workspace', panels);
        hero.after(work);
      }
    }
    if (view === 'leaderboard') {
      const table = q('.leaderboard-card'), privacy = q('.social-privacy-card');
      if (table && privacy) region(root, 'leaderboard-workspace', [table, privacy]);
    }
  }
  root.InterfaceCompositionV1 = Object.freeze({apply, select, reveal});
  root.document?.addEventListener('click', event => {
    const button = event.target.closest('[data-layout-tab]');
    if (button) {
      if (button.getAttribute('aria-selected') !== 'true') root.sfx?.('navigate');
      select(button.closest('[data-workspace]'), button.dataset.layoutTab, false);
    }
  });
  root.document?.addEventListener('keydown', event => {
    const button = event.target.closest('[data-layout-tab]'); if (!button || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const buttons = [...button.parentElement.children], index = buttons.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    if (next !== index) root.sfx?.('navigate');
    select(button.closest('[data-workspace]'), buttons[next].dataset.layoutTab, true);
  });
})(typeof window !== 'undefined' ? window : globalThis);
