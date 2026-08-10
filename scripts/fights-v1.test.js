'use strict';

const assert = require('node:assert/strict');
const F = require('../public/fights-v1.js');

assert.equal(F.VERSION, '1.0.0');
assert.equal(F.MAX_FIGHTS, 5);
assert.equal(F.MAX_SECONDS, 300);

const day = (d) => `2026-08-${String(d).padStart(2, '0')}`;
const draft = (id, extra) => Object.assign({ id, title: 'Рука к телефону', seconds: 10 }, extra || {});

// ── normalize: терпит мусор, не роняет экран ─────────────────────────────────
assert.deepEqual(F.normalize(null), F.emptyState());
assert.deepEqual(F.normalize({ fights: 'нет', log: 5 }), F.emptyState());
assert.equal(F.normalize({ fights: [draft('a'), draft('a')] }).fights.length, 1, 'дубликаты id схлопываются');
assert.equal(F.normalize({ fights: [{ id: 'a', title: '', seconds: 10 }] }).fights.length, 0);
assert.equal(F.normalize({ fights: [{ id: 'a', title: 'x', seconds: 0 }] }).fights.length, 0);
assert.equal(F.normalize({ fights: [{ id: 'a', title: 'x', seconds: 301 }] }).fights.length, 0);
assert.equal(F.normalize({ fights: [{ id: 'a', title: 'x', seconds: 'десять' }] }).fights.length, 0);

// Заголовок подрезается, а не отбрасывается — человек не теряет схватку из-за длины
assert.equal(F.normalize({ fights: [{ id: 'a', title: 'я'.repeat(200), seconds: 5 }] }).fights[0].title.length, F.MAX_TITLE);

// Отметки для несуществующих схваток и неизвестные исходы не выживают
{
  const s = F.normalize({ fights: [draft('a')], log: { [day(1)]: { a: 'won', ghost: 'won', b: 'молодец' } } });
  assert.deepEqual(s.log[day(1)], { a: 'won' });
}

// ── триггеры (§10 схлопнут сюда) ─────────────────────────────────────────────
assert.deepEqual(F.normalize({ fights: [draft('a', { trigger: { kind: 'time', at: '23:00' } })] }).fights[0].trigger, { kind: 'time', at: '23:00' });
assert.deepEqual(F.normalize({ fights: [draft('a', { trigger: { kind: 'moment' } })] }).fights[0].trigger, { kind: 'moment' });
assert.equal(F.normalize({ fights: [draft('a', { trigger: { kind: 'time', at: '25:00' } })] }).fights[0].trigger, null);
assert.equal(F.normalize({ fights: [draft('a', { trigger: 'в туалете' })] }).fights[0].trigger, null);

// ── addFight и потолок 5 (§15) ───────────────────────────────────────────────
{
  let s = F.emptyState();
  for (let i = 0; i < F.MAX_FIGHTS; i++) {
    const r = F.addFight(s, draft('f' + i));
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.deepEqual(F.addFight(s, draft('f9')), { ok: false, error: 'limit' });
  assert.deepEqual(F.addFight(s, { id: 'x', title: '', seconds: 10 }), { ok: false, error: 'invalid' });
  assert.deepEqual(F.addFight(s, draft('f0')), { ok: false, error: 'limit' }, 'потолок проверяется раньше дубликата');

  // Архив освобождает место, но история отметок остаётся честной
  const archived = F.archiveFight(s, 'f0', day(10));
  assert.equal(F.activeFights(archived).length, 4);
  assert.equal(F.addFight(archived, draft('f9')).ok, true);
}

// ── mark / clearMark ─────────────────────────────────────────────────────────
{
  let s = F.addFight(F.emptyState(), draft('a')).state;
  s = F.mark(s, 'a', day(5), 'won');
  assert.deepEqual(s.log[day(5)], { a: 'won' });

  s = F.mark(s, 'a', day(5), 'lost');
  assert.deepEqual(s.log[day(5)], { a: 'lost' }, 'переотметка перезаписывает');

  assert.deepEqual(F.mark(s, 'ghost', day(5), 'won').log[day(5)], { a: 'lost' }, 'чужой id игнорируется');
  assert.deepEqual(F.mark(s, 'a', day(5), 'почти').log[day(5)], { a: 'lost' }, 'чужой исход игнорируется');
  assert.deepEqual(F.mark(s, 'a', 'завтра', 'won').log[day(5)], { a: 'lost' }, 'кривой день игнорируется');

  // Снятие отметки не оставляет пустой день в журнале
  const cleared = F.clearMark(s, 'a', day(5));
  assert.equal(cleared.log[day(5)], undefined);
}

// ── dayScore: главный гейт — неотмеченная схватка НЕ проиграна ───────────────
// Без этого человек, забывший открыть приложение, получает наутро 0:5 и вывод
// о себе, которого он не делал. Это ровно та вина, против которой продукт.
{
  let s = F.emptyState();
  for (const id of ['a', 'b', 'c']) s = F.addFight(s, draft(id)).state;
  assert.deepEqual(F.dayScore(s, day(6)), { won: 0, lost: 0, undecided: 3, total: 3 });

  s = F.mark(s, 'a', day(6), 'won');
  s = F.mark(s, 'b', day(6), 'lost');
  assert.deepEqual(F.dayScore(s, day(6)), { won: 1, lost: 1, undecided: 1, total: 3 });
}

// Архивированная схватка исчезает из будущих дней, но остаётся в прошлых
{
  let s = F.addFight(F.emptyState(), draft('a')).state;
  s = F.mark(s, 'a', day(3), 'won');
  s = F.archiveFight(s, 'a', day(5));
  assert.equal(F.dayScore(s, day(3)).total, 1, 'до архивации схватка была');
  assert.equal(F.dayScore(s, day(3)).won, 1);
  assert.equal(F.dayScore(s, day(7)).total, 0, 'после архивации её нет');
}

// ── secondsPerDay: то самое число, без которого фича — обычный чеклист ───────
{
  let s = F.emptyState();
  s = F.addFight(s, { id: 'alarm', title: 'Будильник', seconds: 4 }).state;
  s = F.addFight(s, { id: 'phone', title: 'Рука к телефону', seconds: 10 }).state;
  s = F.addFight(s, { id: 'start', title: 'Первое действие блока', seconds: 60 }).state;
  assert.equal(F.secondsPerDay(s), 74, 'день целиком — 74 секунды настоящей борьбы');
  assert.equal(F.secondsPerDay(F.archiveFight(s, 'start', day(9))), 14);
}

// ── fightStats: арифметика, а не утешение (§4) ───────────────────────────────
{
  let s = F.addFight(F.emptyState(), draft('a')).state;
  s = F.mark(s, 'a', day(1), 'won');
  s = F.mark(s, 'a', day(2), 'won');
  s = F.mark(s, 'a', day(3), 'lost');
  s = F.mark(s, 'a', day(9), 'won');

  const all = F.fightStats(s, 'a');
  assert.deepEqual([all.won, all.lost, all.decided], [3, 1, 4]);
  assert.equal(all.rate, 0.75);
  assert.equal(all.lastResult, 'won');
  assert.equal(all.lastDay, day(9));

  const win = F.fightStats(s, 'a', day(1), day(3));
  assert.deepEqual([win.won, win.lost], [2, 1]);
  assert.equal(win.lastDay, day(3), 'верхняя граница включительна');

  assert.equal(F.fightStats(s, 'ghost').rate, null, 'без решённых схваток доли нет, а не ноль');
}

// ── suggestFor: вариант B/C, сырые id вместо русских строк ───────────────────
{
  const s = F.suggestFor('nightdebt');
  assert.equal(s.suggestionId, 'evening-phone');
  assert.equal(s.seconds, 10);
  assert.deepEqual(s.trigger, { kind: 'time', at: '23:00' });
  assert.equal(F.suggestFor('nostart').suggestionId, 'first-action');

  // Отдых схваткой не становится: превратить его в ещё один выигрываемый момент
  // значит сделать ровно то, от чего продукт уходит.
  assert.equal(F.suggestFor('norest'), null);
  assert.equal(F.suggestFor('нет такого'), null);

  // Возвращается копия — правка предложения не портит таблицу для следующего вызова
  F.suggestFor('nightdebt').trigger.at = '03:00';
  assert.equal(F.suggestFor('nightdebt').trigger.at, '23:00');
}

// ── Иммутабельность: исходное состояние не мутируется ────────────────────────
{
  const base = F.addFight(F.emptyState(), draft('a')).state;
  const snapshot = JSON.stringify(base);
  F.mark(base, 'a', day(4), 'won');
  F.archiveFight(base, 'a', day(4));
  F.clearMark(base, 'a', day(4));
  assert.equal(JSON.stringify(base), snapshot, 'операции не трогают переданное состояние');
}

// ── Гейт §13: модуль не умеет штрафовать. Проверяем поверхность API. ─────────
// Если кто-то добавит сюда начисление/списание, этот тест должен сломаться и
// заставить перечитать «что НЕ делать».
assert.deepEqual(
  Object.keys(F).filter((k) => /xp|gold|streak|penal|damage|score.*publish|leaderboard/i.test(k)),
  [],
  'в API нет ничего, к чему можно прицепить штраф или лидерборд',
);

console.log('fights-v1: все проверки прошли');
