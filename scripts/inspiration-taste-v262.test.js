'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Profile = require('../public/inspiration-profile-v1.js');
const Runtime = require('../public/inspiration-supply-runtime-v1.js');
const Batch = require('../public/inspiration-supply-batch-v1.js');

const DAY = '2026-09-13';
const dayAfter = (days) => new Date(Date.parse(`${DAY}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const profile = (extra = {}) => Profile.configure({ interests: [{ id: 'art', label: 'Art' }], formats: ['image'], ...extra });
const image = (id, extra = {}) => ({ id, format: 'image', interestIds: ['art'], title: 'Visual study', body: 'An editorial selection.', ...extra });
const chosen = (rows, p, day = DAY) => Profile.choose(rows, p, day)[0]?.id;
const candidate = (id) => ({ ...Batch.CANDIDATES[0], id, externalId: id, source: id, interestIds: ['art'] });
const supply = (p, rows, day) => Runtime.ensureDigest({ profile: p, candidates: rows, day, now: `${day}T12:00:00.000Z`, locale: 'en' });

test('visual taste and existing image/video references survive account serialization with bounded fields', () => {
  const p = profile({ visualTaste: '  Коллаж,   стоицизм и личные символы. ', videoReferences: [
    { url: 'https://www.pinterest.com/pin/100000000000000001/', title: 'Amor Fati — Marcus Aurelius', why: 'Нравится коллаж, а не просто портрет философа' },
    { url: 'https://www.tiktok.com/@creator/video/1234567890123456789', title: 'SpiderVerse', why: 'Ритм и комиксная фактура' },
  ] });
  assert.equal(p.visualTaste, 'Коллаж, стоицизм и личные символы.');
  assert.equal(Profile.normalize(JSON.parse(JSON.stringify(p))).visualTaste, p.visualTaste);
  assert.deepEqual(Profile.normalize(JSON.parse(JSON.stringify(p))).videoReferences, p.videoReferences);
  assert.equal(Profile.normalize({ visualTaste: 'x'.repeat(900) }).visualTaste.length, 600);
  assert.equal(Profile.normalize({ visualTaste: { text: 'bad' } }).visualTaste, '');
  assert.deepEqual(Profile.normalize({}).shownHistory, []);
});

test('personalized external discovery requires an explicit boolean opt-in and survives reconfiguration', () => {
  for (const value of [undefined, null, false, 'true', 1, {}]) {
    assert.equal(profile({ discoveryEnabled: value }).discoveryEnabled, false);
  }
  const enabled = profile({ discoveryEnabled: true });
  assert.equal(Profile.normalize(JSON.parse(JSON.stringify(enabled))).discoveryEnabled, true);
  assert.equal(Profile.configure({ ...enabled, visualTaste: 'new description' }).discoveryEnabled, true);
  assert.equal(Profile.configure({ ...enabled, discoveryEnabled: false }).discoveryEnabled, false);
});

test('reference metadata retains a real preview and attribution without granting playback or losing the personal explanation', () => {
  const reference = { url: 'https://www.pinterest.com/pin/100000000000000001/', title: 'Source title', why: 'My personal explanation',
    imageUrl: 'https://i.pinimg.com/736x/example.jpg', authorName: 'Public creator', mediaFormat: 'image', metadataAt: `${DAY}T12:00:00Z` };
  const normalized = profile({ videoReferences: [reference] }).videoReferences[0];
  assert.equal(normalized.title, reference.title);
  assert.equal(normalized.why, reference.why);
  assert.equal(normalized.imageUrl, reference.imageUrl);
  assert.equal(normalized.authorName, reference.authorName);
  assert.equal(normalized.mediaFormat, 'image');
  assert.equal(normalized.metadataAt, `${DAY}T12:00:00.000Z`);
  assert.equal(Object.hasOwn(normalized, 'playbackVerified'), false);
  assert.deepEqual(Profile.normalize(JSON.parse(JSON.stringify(profile({ videoReferences: [reference] })))).videoReferences[0], normalized);
  assert.equal(profile({ videoReferences: [{ ...reference, authorName: 'x'.repeat(150), mediaFormat: 'edit' }] }).videoReferences[0].authorName.length, 120);
  for (const imageUrl of ['javascript:alert(1)', 'http://i.pinimg.com/x.jpg', 'https://name:password@i.pinimg.com/x.jpg', '']) {
    const item = profile({ videoReferences: [{ ...reference, imageUrl, mediaFormat: 'unknown', metadataAt: '2026-02-30T12:00:00Z' }] }).videoReferences[0];
    assert.equal(Object.hasOwn(item, 'imageUrl'), false);
    assert.equal(Object.hasOwn(item, 'mediaFormat'), false);
    assert.equal(Object.hasOwn(item, 'metadataAt'), false);
    assert.equal(item.why, reference.why);
  }
});

test('people sharing an interest receive different selections for their own visual styles', () => {
  const rows = [
    image('neon', { tags: ['neon', 'cinematic', 'night city'] }),
    image('quiet', { keywords: ['pastel', 'sunlight', 'garden'] }),
    image('stoic', { tags: ['stoicism', 'collage', 'Amor Fati'] }),
  ];
  const profiles = [profile({ visualTaste: 'Неон и кинематографичный город ночью' }),
    profile({ visualTaste: 'Пастель, солнечный свет и сад' }),
    profile({ visualTaste: 'Стоицизм, коллаж, Amor Fati' })];
  assert.deepEqual(profiles.map((p) => chosen(rows, p)), ['neon', 'quiet', 'stoic']);
  for (const p of profiles) assert.equal(chosen(rows.slice().reverse(), p), chosen(rows, p));
});

test('specific reference title and explanation distinguish motifs inside the same generic theme', () => {
  const rows = [image('generic-sport', { interestIds: ['sport'], tags: ['fitness'] }),
    image('home-training', { interestIds: ['sport'], tags: ['home gym', 'garden', 'wood', 'sunlight'] }),
    image('alpine', { interestIds: ['sport'], tags: ['Arc’teryx', 'snowboarding', 'snow leopard', 'mountains'] })];
  const home = profile({ interests: [{ id: 'sport', label: 'Спорт' }], videoReferences: [{
    url: 'https://www.pinterest.com/pin/100000000000000002/', title: 'Home gym in a lush garden', why: 'Деревянный зал, солнечный свет, природа вокруг' }] });
  const alpine = profile({ interests: [{ id: 'sport', label: 'Спорт' }], videoReferences: [{
    url: 'https://www.pinterest.com/pin/100000000000000003/', title: 'Arc’teryx — snow leopard', why: 'Сноуборд, горы и ирбис в одном образе' }] });
  assert.equal(chosen(rows, home), 'home-training');
  assert.equal(chosen(rows, alpine), 'alpine');
});

test('Re:Zero and Spider-Verse remain specific signals alongside compatible broad interest ids', () => {
  const rows = [image('generic', { interestIds: ['anime', 'superhero'], title: 'Anime heroes' }),
    image('rezero', { interestIds: ['anime', 'superhero'], keywords: ['ReZero'] }),
    image('spiderverse', { interestIds: ['anime', 'superhero'], keywords: ['Spider-Verse'] })];
  const p = (name) => profile({ interests: [{ label: name }], customInterests: name });
  assert.equal(p('Re:Zero').interests[0].id, 'anime');
  assert.equal(p('Spider-Verse').interests[0].id, 'superhero');
  assert.equal(chosen(rows, p('Re:Zero')), 'rezero');
  assert.equal(chosen(rows, p('Spider-Verse')), 'spiderverse');
});

test('Russian Spider-Man reference matches the comic motif, not any superhero photograph', () => {
  const p = profile({ visualTaste: 'Человек-паук, комиксы, рабочая эстетика', videoReferences: [{
    url: 'https://www.pinterest.com/pin/100000000000000004/', title: 'Spider-Man — work hours', why: 'Герой за компьютером, спокойная комиксная сцена' }] });
  const rows = [image('hero-photo', { tags: ['superhero', 'photo'] }), image('comic-work', { tags: ['spider-man', 'comic', 'work hours', 'computer'] })];
  assert.equal(chosen(rows, p), 'comic-work');
});

test('reference URLs are taste input and never appear as discovered candidates', () => {
  const p = profile({ videoReferences: [{ url: 'https://www.pinterest.com/pin/100000000000000005/', title: 'Adventure vision board' }] });
  assert.deepEqual(Profile.choose([], p, DAY), []);
  const selected = Profile.ensureDigest(p, [image('editorial', { tags: ['adventure', 'vision board'] })], DAY);
  assert.deepEqual(selected.profile.digest.ids, ['editorial']);
  assert.equal(selected.profile.videoReferences[0].url, p.videoReferences[0].url);
});

test('visual media wins a relevance tie, while a specifically matching quote can remain first', () => {
  const rows = [{ ...image('text'), format: 'quote' }, image('photo', { imageUrl: 'https://source.invalid/photo.jpg' }),
    { ...image('clip'), format: 'edit', embedUrl: 'https://source.invalid/player' }];
  const p = profile({ formats: ['quote', 'image', 'edit'] });
  assert.notEqual(chosen(rows, p), 'text');
  const matched = rows.map((row) => row.id === 'text' ? { ...row, keywords: ['stoicism', 'collage'] } : row);
  assert.equal(chosen(matched, { ...p, visualTaste: 'Стоицизм и коллаж' }), 'text');
  assert.equal(chosen(rows, { ...p, formats: ['quote'] }), 'text');
});

test('three specifically matching images are not displaced by a generic quote for format variety', () => {
  const rows = ['one', 'two', 'three'].map((id) => image(id, { tags: ['stoicism', 'collage'], imageUrl: `https://source.invalid/${id}.jpg` }));
  rows.push({ ...image('generic-text'), format: 'quote' });
  const p = profile({ formats: ['image', 'quote'], visualTaste: 'Стоицизм, коллаж' });
  for (let offset = 0; offset < 10; offset += 1) {
    const selected = Profile.choose(rows, p, dayAfter(offset));
    assert.equal(selected.length, 3);
    assert.ok(selected.every((row) => row.format === 'image'));
  }
});

test('format variety is retained among comparably relevant materials', () => {
  const rows = ['one', 'two', 'three', 'four'].map((id) => image(id, { imageUrl: `https://source.invalid/${id}.jpg` }));
  rows.push({ ...image('quote'), format: 'quote' }, { ...image('edit'), format: 'edit', embedUrl: 'https://source.invalid/player' });
  const p = profile({ formats: ['image', 'quote', 'edit'] });
  for (let offset = 0; offset < 10; offset += 1) {
    const selected = Profile.choose(rows, p, dayAfter(offset));
    assert.deepEqual(new Set(selected.map((row) => row.format)), new Set(['image', 'quote', 'edit']));
  }
});

test('format selection does not duplicate a material supplied more than once', () => {
  const one = image('one', { tags: ['neon'] });
  const rows = [one, { ...one }, image('two', { tags: ['neon'] })];
  const ids = Profile.choose(rows, profile({ visualTaste: 'neon' }), DAY).map((row) => row.id);
  assert.equal(ids.length, 2);
  assert.deepEqual(new Set(ids), new Set(['one', 'two']));
});

test('personal reference URLs are excluded from curated discovery across canonical platform forms', () => {
  const p = profile({ videoReferences: [
    { url: 'https://ru.pinterest.com/pin/100000000000000001/?utm_source=share#image' },
    { url: 'https://www.tiktok.com/@creator/video/1234567890123456789?is_from_webapp=1' },
    { url: 'https://youtu.be/WhWc3b3KhnY?si=personal-share' },
    { url: 'https://example.com/art/?utm_medium=referral&item=1#details' },
  ] });
  const rows = [image('own-pin', { sourceUrl: 'https://www.pinterest.de/pin/100000000000000001/' }),
    image('own-tiktok', { embedUrl: 'https://www.tiktok.com/player/v1/1234567890123456789?loop=0' }),
    image('own-youtube', { sourceUrl: 'https://www.youtube.com/watch?v=WhWc3b3KhnY' }),
    image('own-page', { sourceUrl: 'https://www.example.com/art?item=1&fbclid=shared' }),
    image('new-page', { sourceUrl: 'https://example.com/art?item=2' }),
    image('new-pin', { sourceUrl: 'https://www.pinterest.com/pin/100000000000000002/' })];
  assert.deepEqual(Profile.choose(rows, p, DAY).map((row) => row.id).sort(), ['new-page', 'new-pin']);
  assert.equal(Profile.referenceKey('javascript:alert(1)'), '');
  assert.equal(Profile.referenceKey('https://owner:secret@example.com/art'), '');
  assert.equal(Profile.isReference(image('lookalike', { sourceUrl: 'https://pinterest.example/pin/100000000000000001/' }), p), false);
});

test('an own reference is removed from a fixed digest without replacing its ids or losing completion', () => {
  const pinUrl = 'https://www.pinterest.com/pin/100000000000000001/';
  const rows = [image('own', { sourceUrl: pinUrl }), image('fresh')];
  const p = profile({ videoReferences: [{ url: pinUrl }], digest: { day: DAY, ids: ['own'], doneIds: ['own'] } });
  // configure intentionally resets the digest, so restore an existing durable receipt.
  p.digest = { day: DAY, ids: ['own'], doneIds: ['own'] };
  const result = Profile.ensureDigest(p, rows, DAY);
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.profile.digest, p.digest);
});

test('supply excludes a personal reference from both a new pool and fixed-day resolution', () => {
  const sourceUrl = 'https://www.pinterest.com/pin/100000000000000001/';
  const own = { ...candidate('own'), format: 'image', durationSec: null,
    rights: { kind: 'official-source', holder: 'Creator', url: sourceUrl, embedAllowed: false, downloadAllowed: false },
    delivery: { policy: 'link', sourceUrl }, available: true, checkMethod: 'manual', lastCheckedAt: `${DAY}T00:00:00Z` };
  const p = profile({ videoReferences: [{ url: `${sourceUrl}?utm_source=share` }] });
  const fresh = supply(p, [own], DAY);
  assert.equal(fresh.catalog.length, 1, 'the material remains available in saved content');
  assert.deepEqual(fresh.items, []);
  assert.deepEqual(fresh.poolRows, []);
  const digest = { day: DAY, ids: ['own'], doneIds: [] };
  const fixed = supply({ ...p, digest }, [own], DAY);
  assert.deepEqual(fixed.items, []);
  assert.deepEqual(fixed.profile.digest, digest);
  assert.deepEqual(fixed.unavailableIds, ['own']);
});

test('editorial tags and later references keep their influence beside a long unrelated description', () => {
  const noise = Array.from({ length: 100 }, (_, index) => `word${index}`).join(' ');
  const p = profile({ videoReferences: Array.from({ length: 10 }, (_, index) => ({
    url: `https://www.pinterest.com/pin/${1000000000 + index}/`, title: index === 9 ? 'Obsidian architecture' : noise,
  })) });
  const rows = [image('generic', { body: noise }), image('specific', { body: noise, keywords: ['obsidian', 'architecture'] })];
  for (let offset = 0; offset < 10; offset += 1) assert.equal(chosen(rows, p, dayAfter(offset)), 'specific');
});

test('negative feedback changes future style ordering without deleting a whole shared interest', () => {
  const seed = image('seen-neon', { tags: ['neon', 'cinematic'] });
  const p = profile({ visualTaste: 'Неон, cinematic' });
  const next = [image('fresh-neon', { keywords: ['neon', 'cinematic'] }), image('fresh-quiet', { tags: ['pastel', 'sunlight'] })];
  assert.equal(chosen(next, p), 'fresh-neon');
  const learned = Profile.recordFeedback(p, seed, 'not_for_me', DAY);
  assert.deepEqual(learned.feedback[0].keywords, ['neon', 'cinematic']);
  assert.equal(chosen(next, Profile.normalize(JSON.parse(JSON.stringify(learned))), dayAfter(1)), 'fresh-quiet');
  assert.equal(Profile.choose(next, learned, dayAfter(1)).length, 2);
});

test('explicit negative explanation penalizes the corresponding motif in later candidates', () => {
  const p = profile();
  const learned = Profile.recordFeedback(p, image('old'), 'not_for_me', DAY, 'Не нравится неон и кинематографичная обработка');
  const next = [image('neon', { tags: ['neon', 'cinematic'] }), image('garden', { tags: ['wood', 'garden'] })];
  assert.equal(chosen(next, learned, dayAfter(1)), 'garden');
});

test('blocked topics remain hard filters when present only in editorial keywords or tags', () => {
  const rows = [image('blocked-keyword', { keywords: 'spoiler, neon' }), image('blocked-tag', { tags: ['spoiler'] }), image('allowed')];
  assert.deepEqual(Profile.choose(rows, profile({ blocked: ['spoiler'] }), DAY).map((row) => row.id), ['allowed']);
});

test('same-day choices remain fixed after taste and feedback change', () => {
  const rows = [image('neon', { keywords: ['neon'] }), image('garden', { keywords: ['garden'] })];
  const first = Profile.ensureDigest(profile({ visualTaste: 'neon' }), rows, DAY);
  const changed = Profile.recordFeedback({ ...first.profile, visualTaste: 'garden' }, first.items[0], 'not_for_me', DAY);
  assert.deepEqual(Profile.ensureDigest(changed, rows.slice().reverse(), DAY).profile.digest.ids, first.profile.digest.ids);
});

test('recordShown is immutable and idempotent, and records only the selected digest on the given day', () => {
  const first = Profile.ensureDigest(profile(), [image('a'), image('b'), image('c')], DAY).profile;
  const snapshot = JSON.stringify(first);
  const shown = Profile.recordShown(first, DAY, ['a', 'foreign-id']);
  assert.deepEqual(shown.shownHistory, [{ id: 'a', day: DAY }]);
  assert.equal(JSON.stringify(first), snapshot);
  assert.deepEqual(Profile.recordShown(shown, DAY, ['a']), shown);
  assert.deepEqual(Profile.recordShown(shown, dayAfter(1)), shown);
  assert.deepEqual(Profile.recordShown(shown, '2026-02-30'), shown);
  const all = Profile.recordShown(first, DAY);
  assert.deepEqual(all.shownHistory, ['a', 'b', 'c'].map((id) => ({ id, day: DAY })));
  assert.deepEqual(Profile.recordShown(all, DAY), all);
});

test('a confirmed empty day survives reload and is not refilled until a new day or explicit configuration', () => {
  const first = Profile.ensureDigest(profile(), [], DAY);
  assert.deepEqual(first.profile.digest, { day: DAY, ids: [], doneIds: [] });
  const committed = Profile.normalize(JSON.parse(JSON.stringify(first.profile)));
  assert.deepEqual(committed.digest, first.profile.digest);
  assert.deepEqual(Profile.recordShown(committed, DAY), committed);
  assert.equal(Profile.isDigestDone(committed), false, 'an empty day is not watched content');
  for (let reload = 0; reload < 5; reload += 1) {
    const again = Profile.ensureDigest(committed, [image('new')], DAY);
    assert.deepEqual(again.profile.digest, committed.digest);
    assert.deepEqual(again.items, []);
  }
  assert.equal(Profile.ensureDigest(committed, [image('new')], dayAfter(1)).items[0].id, 'new');
  assert.equal(Profile.ensureDigest(Profile.configure(committed), [image('new')], DAY).items[0].id, 'new');
  assert.equal(Profile.ensureDigest(Profile.emptyProfile(), [], DAY).profile.digest, null);
  assert.equal(Profile.normalize({ ...profile(), digest: { day: DAY } }).digest, null);
});

test('fixed empty supply retains a meaningful empty state instead of inventing unverified media', () => {
  const p = profile({ formats: ['quote'] });
  const first = supply(p, [], DAY);
  assert.deepEqual(first.profile.digest, { day: DAY, ids: [], doneIds: [] });
  const again = supply(first.profile, [], DAY);
  assert.equal(again.fixed, true);
  assert.equal(again.report.emptyReason, 'no_matching_material');
  const laterSupply = supply(first.profile, [candidate('arrived')], DAY);
  assert.deepEqual(laterSupply.items, []);
  assert.deepEqual(laterSupply.unavailableIds, []);
  assert.equal(laterSupply.report.emptyReason, 'no_matching_material');
  assert.equal(supply(first.profile, [candidate('arrived')], dayAfter(1)).items[0].id, 'arrived');
  const foreign = { ...candidate('foreign'), lang: 'ru', contentLocales: ['ru'] };
  const languageGap = supply(p, [foreign], DAY);
  assert.equal(supply(languageGap.profile, [foreign], DAY).report.emptyReason, 'language_gap');
});

test('normalization deduplicates valid history and retains the newest 180 records across 60 full days', () => {
  const history = Array.from({ length: 70 }, (_, offset) => [0, 1, 2].map((item) => ({ id: `day-${offset}-${item}`, day: dayAfter(offset) }))).flat();
  const p = profile({ shownHistory: [...history, history[0], null, { id: 'bad', day: '2026-02-30' }, { id: '', day: DAY }] });
  assert.equal(p.shownHistory.length, Profile.MAX_SHOWN_HISTORY);
  assert.equal(new Set(p.shownHistory.map((row) => row.day)).size, 60);
  assert.equal(p.shownHistory[0].day, dayAfter(10));
  assert.equal(p.shownHistory.at(-1).day, dayAfter(69));
  assert.deepEqual(Profile.normalize(JSON.parse(JSON.stringify(p))).shownHistory, p.shownHistory);
  const late = Profile.recordShown({ ...p, digest: { day: DAY, ids: ['late'], doneIds: [] } }, DAY);
  assert.deepEqual(late.shownHistory, p.shownHistory);
});

test('supply uses durable shown history after the previous digest has changed, including day 44 and 46', () => {
  const rows = [candidate('old')];
  const first = supply(profile({ formats: ['quote'] }), rows, DAY);
  assert.equal(first.items.length, 1);
  assert.deepEqual(first.profile.shownHistory, [], 'ensuring a digest never invents a durable impression');
  const recorded = Profile.recordShown(first.profile, DAY);
  recorded.digest = { day: dayAfter(1), ids: ['different'], doneIds: [] };
  for (const offset of [2, 20, 44]) {
    const out = supply(Profile.normalize(JSON.parse(JSON.stringify(recorded))), rows, dayAfter(offset));
    assert.equal(out.items.length, 0, `day ${offset} must not repeat the first item`);
    assert.ok(out.blocked.some((row) => row.id === 'old' && row.code === 'repeat_cooldown'));
  }
  assert.equal(supply(recorded, rows, dayAfter(46)).items[0].id, 'old');
});

test('history recording does not hide the fixed current digest and explicit rerequest preserves feedback refusals', () => {
  const input = { profile: profile({ formats: ['quote'] }), candidates: [candidate('one')], day: DAY, now: `${DAY}T12:00:00.000Z`, locale: 'en' };
  const first = Runtime.ensureDigest(input);
  const recorded = Profile.recordShown(first.profile, DAY);
  assert.deepEqual(Runtime.ensureDigest({ ...input, profile: recorded }).items.map((row) => row.id), ['one']);
  const tomorrow = { ...input, profile: recorded, day: dayAfter(1), now: `${dayAfter(1)}T12:00:00.000Z`, requestedIds: ['one'] };
  assert.equal(Runtime.ensureDigest(tomorrow).items[0].id, 'one');
  const refused = Profile.recordFeedback(recorded, first.items[0], 'not_for_me', DAY);
  assert.deepEqual(Runtime.ensureDigest({ ...tomorrow, profile: refused }).items, []);
});
