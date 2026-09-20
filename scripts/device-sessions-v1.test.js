'use strict';
/* Сессии устройства — логика решений (DEVICE-SESSIONS-V264.md).
 *
 * Здесь нет сервера: хранилище, часы и HMAC подставлены. Проверяется то, что при
 * ошибке открывает аккаунт чужому или молча выкидывает хозяина:
 *  🔐 токен не выдаётся без явного «запомнить» и не лежит на диске открытым;
 *  🔁 ключ обновления вращается, и копия старого отзывает устройство целиком;
 *  📶 потерянный ответ на ходу — это повтор, а не кража, но только в своём окне;
 *  🧱 нечитаемый файл устройств — забор, а не пустой список;
 *  💾 сбой записи не выдаёт токенов, о которых сервер не знает.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const D = require('../server-device-sessions-v1.js');

const SECRET = 'test-secret-for-device-sessions';
const T0 = Date.parse('2026-09-17T12:00:00.000Z');

test('device web credentials have separate purpose, bounded lifetime and live revocation', () => {
  const h = harness(), user = h.users.get('albert');
  const phone = h.sessions.register(user, { remember: true, name: 'Phone', platform: 'ios' });
  const web = h.sessions.issueWebSession(phone.accessToken, h.getUser);
  assert.equal(web.ok, true);
  assert.equal(h.sessions.verifyAccess(web.webSessionToken, h.getUser), null);
  assert.equal(h.sessions.verifyWebSession(phone.accessToken, h.getUser), null);
  assert.equal(h.sessions.refresh(web.webSessionToken, h.getUser).ok, false);
  assert.equal(h.sessions.verifyWebSession(web.webSessionToken, h.getUser).uid, 'albert');
  h.state.now += D.ACCESS_TTL_MS + 1;
  assert.equal(h.sessions.verifyAccess(phone.accessToken, h.getUser), null);
  assert.ok(h.sessions.verifyWebSession(web.webSessionToken, h.getUser));
  user.sessionVersion = 'changed';
  assert.equal(h.sessions.verifyWebSession(web.webSessionToken, h.getUser), null);
  user.sessionVersion = 'v-one';
  h.state.failRead = true;
  assert.equal(h.sessions.verifyWebSession(web.webSessionToken, h.getUser), null);
  h.state.failRead = false;
  h.state.now = T0 + D.WEB_TTL_MS;
  assert.equal(h.sessions.verifyWebSession(web.webSessionToken, h.getUser), null);
});

function harness() {
  const files = new Map();
  const state = { now: T0, failWrite: false, failRead: false, writes: 0 };
  const deps = {
    read(uid) {
      if (state.failRead) throw Object.assign(new Error('EIO'), { code: 'EIO' });
      return files.has(uid) ? files.get(uid) : null;
    },
    write(uid, value) {
      if (state.failWrite) throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
      state.writes += 1;
      files.set(uid, JSON.stringify(value));
    },
    sign: (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('hex'),
    randomHex: (bytes) => crypto.randomBytes(bytes).toString('hex'),
    randomSecret: () => crypto.randomBytes(32).toString('base64url'),
    now: () => state.now,
    equal: (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length
      && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')),
  };
  const users = new Map([
    ['albert', { id: 'albert', sessionVersion: 'v-one' }],
    ['mallory', { id: 'mallory', sessionVersion: 'v-mal' }],
  ]);
  const getUser = (uid) => users.get(uid) || null;
  return { sessions: D.create(deps), files, state, users, getUser };
}

const phone = { remember: true, name: 'iPhone Альберта', platform: 'ios' };

// ============================================================
//  Регистрация
// ============================================================

test('без явного «запомнить это устройство» токен не выдаётся', () => {
  const h = harness();
  const albert = h.getUser('albert');
  assert.equal(h.sessions.register(albert, { name: 'iPhone', platform: 'ios' }).error, 'confirmation_required');
  assert.equal(h.sessions.register(albert, { remember: 'true', name: 'iPhone' }).error, 'confirmation_required',
    'строка "true" — не подтверждение');
  assert.equal(h.sessions.register(albert, { remember: true, name: '   ' }).error, 'name_required');
  assert.equal(h.sessions.register({ id: 'albert' }, phone).error, 'not_authorized', 'без версии сессии нет привязки');
  assert.equal(h.state.writes, 0, 'отказ ничего не пишет');
});

test('🔐 на диске лежит только хеш ключа обновления', () => {
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  assert.equal(out.ok, true);
  assert.match(out.accessToken, /^dat1\.albert\.[a-f0-9]{32}\.\d{13}\.[a-f0-9]{64}$/);
  assert.match(out.refreshToken, /^drt1\.albert\.[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/);
  const stored = h.files.get('albert');
  assert.equal(stored.includes(out.refreshToken), false);
  assert.equal(stored.includes(out.refreshToken.split('.')[3]), false, 'и секретная часть тоже');
  assert.equal(stored.includes(out.accessToken), false);
  assert.equal(out.device.active, true);
  assert.equal(out.device.needsAck, true, 'новое устройство ждёт подтверждения хозяина');
  assert.equal('refreshHash' in out.device, false, 'хеши наружу не отдаются');
});

test('имя устройства не прячет управляющих символов и ограничено по длине', () => {
  const ch = (code) => String.fromCodePoint(code);
  assert.equal(D.cleanName(`iPhone${ch(0x202e)}enohPi`), 'iPhone enohPi', 'разворот текста не проходит');
  assert.equal(D.cleanName(`a${ch(0)}b${ch(0x200b)}c${ch(10)}d`), 'a b c d');
  assert.equal(D.cleanName(`${ch(0xfeff)}Mac${ch(0x2066)}`), 'Mac');
  assert.equal(Array.from(D.cleanName('я'.repeat(200))).length, D.NAME_MAX);
  assert.equal(D.cleanName(42), '');
});

// ============================================================
//  Доступ
// ============================================================

test('access-токен открывает только живое устройство своего пользователя в свой срок', () => {
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  assert.deepEqual(h.sessions.verifyAccess(out.accessToken, h.getUser), { uid: 'albert', deviceId: out.device.id });

  const [prefix, uid, id, exp, sig] = out.accessToken.split('.');
  const forged = [prefix, 'mallory', id, exp, sig].join('.');
  assert.equal(h.sessions.verifyAccess(forged, h.getUser), null, 'подмена пользователя ломает подпись');
  const longer = [prefix, uid, id, String(Number(exp) + 3600000), sig].join('.');
  assert.equal(h.sessions.verifyAccess(longer, h.getUser), null, 'продлить срок нельзя');
  const flipped = [prefix, uid, id, exp, (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1)].join('.');
  assert.equal(h.sessions.verifyAccess(flipped, h.getUser), null);

  for (const junk of ['', 'Bearer x', 'dat1', 'dat1.albert', out.accessToken + '.x', null, 42, 'x'.repeat(500)]) {
    assert.equal(h.sessions.verifyAccess(junk, h.getUser), null, `мусор ${String(junk).slice(0, 20)}`);
  }

  h.state.now = T0 + D.ACCESS_TTL_MS + 1;
  assert.equal(h.sessions.verifyAccess(out.accessToken, h.getUser), null, 'истёкший не открывает');
});

test('токен удалённого пользователя не открывает ничего', () => {
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  h.users.delete('albert');
  assert.equal(h.sessions.verifyAccess(out.accessToken, h.getUser), null);
  assert.equal(h.sessions.refresh(out.refreshToken, h.getUser).error, 'invalid_token');
});

test('🔐 смена пароля, PIN, сброс и «выйти везде» отзывают устройства без отдельного кода', () => {
  // Все эти маршруты вращают версию сессии. Устройство привязано к ней.
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  h.users.get('albert').sessionVersion = 'v-two';
  assert.equal(h.sessions.verifyAccess(out.accessToken, h.getUser), null);
  const refreshed = h.sessions.refresh(out.refreshToken, h.getUser);
  assert.equal(refreshed.error, 'device_revoked');
  assert.equal(refreshed.reason, 'session_rotated');
  const listed = h.sessions.list(h.getUser('albert')).devices[0];
  assert.equal(listed.active, false);
  assert.equal(listed.revokedReason, 'session_rotated');
});

// ============================================================
//  Вращение ключа обновления
// ============================================================

test('🔁 ключ обновления вращается, и копия старого отзывает устройство целиком', () => {
  const h = harness();
  const first = h.sessions.register(h.getUser('albert'), phone);
  h.state.now += 5 * 60000;
  const second = h.sessions.refresh(first.refreshToken, h.getUser);
  assert.equal(second.ok, true);
  assert.notEqual(second.refreshToken, first.refreshToken);
  assert.ok(h.sessions.verifyAccess(second.accessToken, h.getUser));

  // Через десять минут кто-то предъявляет первый ключ — у него есть копия.
  h.state.now += 10 * 60000;
  const stolen = h.sessions.refresh(first.refreshToken, h.getUser);
  assert.equal(stolen.error, 'device_revoked');
  assert.equal(stolen.reason, 'refresh_reused');
  assert.equal(stolen.persisted, true);

  assert.equal(h.sessions.refresh(second.refreshToken, h.getUser).error, 'device_revoked', 'законный ключ тоже мёртв');
  assert.equal(h.sessions.verifyAccess(second.accessToken, h.getUser), null, 'и уже выданный access');
  assert.equal(h.sessions.list(h.getUser('albert')).devices[0].revokedReason, 'refresh_reused');
});

test('ключ, использованный несколько поколений назад, тоже распознаётся как копия', () => {
  const h = harness();
  const tokens = [h.sessions.register(h.getUser('albert'), phone).refreshToken];
  for (let i = 0; i < 4; i += 1) {
    h.state.now += 5 * 60000;
    tokens.push(h.sessions.refresh(tokens[tokens.length - 1], h.getUser).refreshToken);
  }
  h.state.now += 5 * 60000;
  assert.equal(h.sessions.refresh(tokens[1], h.getUser).reason, 'refresh_reused');
});

test('📶 потерянный ответ — повтор в пределах минуты даёт новую пару', () => {
  const h = harness();
  const first = h.sessions.register(h.getUser('albert'), phone);
  h.state.now += 5 * 60000;
  const lost = h.sessions.refresh(first.refreshToken, h.getUser);
  assert.equal(lost.ok, true);
  // Ответ не дошёл. Телефон повторяет тем же ключом через 20 секунд.
  h.state.now += 20000;
  const retry = h.sessions.refresh(first.refreshToken, h.getUser);
  assert.equal(retry.ok, true, 'на ходу это обычный повтор, а не кража');
  assert.ok(h.sessions.verifyAccess(retry.accessToken, h.getUser));

  // Ключ из потерянного ответа больше не годится: если его перехватили, он выдаст себя.
  h.state.now += 5 * 60000;
  const unseen = h.sessions.refresh(lost.refreshToken, h.getUser);
  assert.equal(unseen.reason, 'refresh_reused');
});

test('окно повтора привязано к первому вращению и само не продлевается', () => {
  const h = harness();
  const first = h.sessions.register(h.getUser('albert'), phone);
  h.state.now += 5 * 60000;
  assert.equal(h.sessions.refresh(first.refreshToken, h.getUser).ok, true);
  h.state.now += 50000;
  assert.equal(h.sessions.refresh(first.refreshToken, h.getUser).ok, true, 'на 50-й секунде ещё повтор');
  h.state.now += 20000;
  assert.equal(h.sessions.refresh(first.refreshToken, h.getUser).reason, 'refresh_reused',
    'на 70-й — уже нет, хотя последний повтор был 20 секунд назад');
});

test('мусорный ключ с настоящим id устройства не отзывает устройство', () => {
  // Иначе любой, кто увидел id, мог бы выкинуть владельца.
  const h = harness();
  const first = h.sessions.register(h.getUser('albert'), phone);
  const fake = `drt1.albert.${first.device.id}.${crypto.randomBytes(32).toString('base64url')}`;
  assert.equal(h.sessions.refresh(fake, h.getUser).error, 'invalid_token');
  assert.equal(h.sessions.refresh(first.refreshToken, h.getUser).ok, true, 'хозяин продолжает работать');
});

test('ключ одного пользователя не подходит к устройству другого', () => {
  const h = harness();
  const albert = h.sessions.register(h.getUser('albert'), phone);
  const secret = albert.refreshToken.split('.')[3];
  assert.equal(h.sessions.refresh(`drt1.mallory.${albert.device.id}.${secret}`, h.getUser).error, 'invalid_token');
});

// ============================================================
//  Отзыв и уведомление
// ============================================================

test('отзыв немедленный: следующий запрос уже не проходит', () => {
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  assert.equal(h.sessions.revoke(h.getUser('albert'), out.device.id).ok, true);
  assert.equal(h.sessions.verifyAccess(out.accessToken, h.getUser), null, 'не ждём истечения access');
  assert.equal(h.sessions.refresh(out.refreshToken, h.getUser).reason, 'user');
  assert.equal(h.sessions.revoke(h.getUser('albert'), out.device.id).ok, true, 'повторный отзыв спокоен');
});

test('устройство может выйти само, но не выкинуть другое', () => {
  const h = harness();
  const a = h.sessions.register(h.getUser('albert'), phone);
  const b = h.sessions.register(h.getUser('albert'), { remember: true, name: 'iPad', platform: 'ipados' });
  assert.equal(h.sessions.revoke(h.getUser('albert'), b.device.id, { actorDeviceId: a.device.id }).error, 'forbidden');
  assert.ok(h.sessions.verifyAccess(b.accessToken, h.getUser), 'iPad жив');
  assert.equal(h.sessions.revoke(h.getUser('albert'), a.device.id, { actorDeviceId: a.device.id }).ok, true);
  assert.equal(h.sessions.verifyAccess(a.accessToken, h.getUser), null);
});

test('«отозвать все» гасит активные и не трогает уже отозванные', () => {
  const h = harness();
  const a = h.sessions.register(h.getUser('albert'), phone);
  const b = h.sessions.register(h.getUser('albert'), { remember: true, name: 'Mac', platform: 'macos' });
  h.sessions.revoke(h.getUser('albert'), a.device.id);
  assert.equal(h.sessions.revokeAll(h.getUser('albert')).ok, true);
  const byId = Object.fromEntries(h.sessions.list(h.getUser('albert')).devices.map((d) => [d.id, d]));
  assert.equal(byId[a.device.id].revokedReason, 'user', 'причина прежнего отзыва сохранена');
  assert.equal(byId[b.device.id].revokedReason, 'all');
  assert.equal(h.sessions.verifyAccess(b.accessToken, h.getUser), null);
});

test('новое устройство видно, пока хозяин не подтвердит, что это он', () => {
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  assert.equal(h.sessions.list(h.getUser('albert')).devices[0].needsAck, true);
  assert.equal(h.sessions.acknowledge(h.getUser('albert'), out.device.id).ok, true);
  assert.equal(h.sessions.list(h.getUser('albert')).devices[0].needsAck, false);
  assert.equal(h.sessions.acknowledge(h.getUser('albert'), 'nope').error, 'not_found');
});

test('список показывает текущее устройство и не отдаёт секретов', () => {
  const h = harness();
  const a = h.sessions.register(h.getUser('albert'), phone);
  h.sessions.register(h.getUser('albert'), { remember: true, name: 'Mac', platform: 'macos' });
  const listed = h.sessions.list(h.getUser('albert'), a.device.id).devices;
  assert.equal(listed.filter((d) => d.current).length, 1);
  assert.equal(listed.find((d) => d.current).id, a.device.id);
  const text = JSON.stringify(listed);
  for (const secret of ['refreshHash', 'prevRefreshHash', 'usedRefreshHashes', 'sessionVersion', 'v-one']) {
    assert.equal(text.includes(secret), false, `наружу ушло ${secret}`);
  }
});

// ============================================================
//  Отказы хранилища и пределы
// ============================================================

test('🧱 нечитаемый файл устройств — забор, а не пустой список', () => {
  const h = harness();
  const out = h.sessions.register(h.getUser('albert'), phone);
  const before = '{"schema":"satoru.device-sessions/1","devices":[{"id":"оборвано';
  h.files.set('albert', before);
  const albert = h.getUser('albert');
  assert.equal(h.sessions.verifyAccess(out.accessToken, h.getUser), null, 'не открывает');
  assert.equal(h.sessions.refresh(out.refreshToken, h.getUser).error, 'devices_unreadable');
  assert.equal(h.sessions.register(albert, phone).error, 'devices_unreadable', 'не пишет поверх');
  assert.equal(h.sessions.list(albert).error, 'devices_unreadable');
  assert.equal(h.sessions.revoke(albert, out.device.id).error, 'devices_unreadable');
  assert.equal(h.sessions.revokeAll(albert).error, 'devices_unreadable');
  assert.equal(h.files.get('albert'), before, 'испорченный файл остался как был');

  h.state.failRead = true;
  assert.equal(h.sessions.list(albert).error, 'devices_unreadable', 'ошибка чтения — тоже забор');
});

test('файл с посторонней формой тоже забор', () => {
  const h = harness();
  const albert = h.getUser('albert');
  for (const shape of [
    '[]', '{}', '{"schema":"other","devices":[]}',
    '{"schema":"satoru.device-sessions/1","devices":[{}]}',
    JSON.stringify({ schema: D.SCHEMA, devices: Array.from({ length: D.MAX_RECORDS + 1 }, () => ({})) }),
  ]) {
    h.files.set('albert', shape);
    assert.equal(h.sessions.list(albert).error, 'devices_unreadable', shape.slice(0, 40));
  }
});

test('💾 сбой записи не выдаёт токенов и не портит прежнее состояние', () => {
  const h = harness();
  const albert = h.getUser('albert');
  const out = h.sessions.register(albert, phone);
  h.state.failWrite = true;
  const failedRegister = h.sessions.register(albert, { remember: true, name: 'iPad' });
  assert.equal(failedRegister.error, 'write_failed');
  assert.equal('refreshToken' in failedRegister, false);

  h.state.now += 5 * 60000;
  const failedRefresh = h.sessions.refresh(out.refreshToken, h.getUser);
  assert.equal(failedRefresh.error, 'write_failed');
  assert.equal('refreshToken' in failedRefresh, false);

  // Запись починилась: прежний ключ работает, как будто сбоя не было.
  h.state.failWrite = false;
  assert.equal(h.sessions.refresh(out.refreshToken, h.getUser).ok, true);
});

test('не больше двадцати активных устройств; отозванные место не занимают', () => {
  const h = harness();
  const albert = h.getUser('albert');
  const ids = [];
  for (let i = 0; i < D.MAX_ACTIVE_DEVICES; i += 1) {
    ids.push(h.sessions.register(albert, { remember: true, name: `D${i}` }).device.id);
  }
  assert.equal(h.sessions.register(albert, phone).error, 'too_many_devices');
  h.sessions.revoke(albert, ids[0]);
  assert.equal(h.sessions.register(albert, phone).ok, true);
});

test('хранилище ограничено, и активные устройства никогда не выбрасываются', () => {
  const h = harness();
  const albert = h.getUser('albert');
  const active = [];
  for (let i = 0; i < D.MAX_RECORDS + 15; i += 1) {
    h.state.now += 1000;
    const out = h.sessions.register(albert, { remember: true, name: `D${i}` });
    assert.equal(out.ok, true, `регистрация ${i}`);
    if (i % 3 === 0) active.push(out);
    else h.sessions.revoke(albert, out.device.id);
    if (active.length > 18) h.sessions.revoke(albert, active.shift().device.id);
  }
  const stored = D.parseStore(h.files.get('albert'));
  assert.equal(stored.ok, true);
  assert.ok(stored.store.devices.length <= D.MAX_RECORDS);
  for (const out of active) assert.ok(h.sessions.verifyAccess(out.accessToken, h.getUser), 'активное устройство на месте');
});

test('модуль не трогает часы, случайность и файловую систему сам', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'server-device-sessions-v1.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['Date.now', 'Math.random', 'require(', 'process.', 'crypto.']) {
    assert.equal(code.includes(forbidden), false, `модуль использует ${forbidden}`);
  }
});
