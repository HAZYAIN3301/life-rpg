'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Policy = require('../public/inspiration-supply-policy-v1.js');
const Media = require('../public/inspiration-media-v1.js');
const Batch = require('../public/inspiration-visual-batch-v1.js');
const Runtime = require('../public/inspiration-supply-runtime-v1.js');
const Profile = require('../public/inspiration-profile-v1.js');
const now = '2026-09-19T12:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));

test('all specific visual posts reach the catalog without fabricating playback proof or language', () => {
  const result = Policy.admit(Batch.CANDIDATES, {now});
  assert.deepEqual(result.rejected, []);
  assert.equal(result.items.length, Batch.CANDIDATES.length);
  for (const item of result.items) {
    assert.equal(item.checkMethod, 'metadata');
    assert.equal(item.available, 'unknown');
    assert.equal(Policy.selfHostAllowed(item), false);
    assert.ok(Media.isAllowedEmbed(item.embedUrl, item.sourceUrl));
  }
  const rows = Policy.toCatalogRows(result.items, 'ru');
  for (const row of rows) {
    assert.ok(row.imageUrl);
    assert.ok(row.tags.length && row.keywords.length);
    assert.equal(row.availabilityCheck, 'metadata');
  }
  const eligible = Policy.eligibleToday(result.items, {day:'2026-09-19',locales:['ru','en'],ctx:{maxSharePerSource:1}});
  assert.equal(eligible.pool.length, result.items.length);
});

test('metadata cannot admit an unrelated source, arbitrary iframe, autoplay or removed post', () => {
  const tiktok = Batch.CANDIDATES.find(row => row.source === 'tiktok');
  for (const change of [
    row => { row.delivery.sourceUrl = 'https://www.tiktok.com/@someone/video/7482465014314552598'; },
    row => { row.delivery.embedUrl = row.delivery.embedUrl.replace('autoplay=0','autoplay=1'); },
    row => { row.delivery.embedUrl = 'https://www.tiktok.com/explore'; },
    row => { row.delivery.embedUrl = 'https://example.com/player'; },
    row => { row.available = false; row.availabilityReason = 'removed'; },
    row => { row.imageUrl = 'https://i.pinimg.com/../../private.json'; },
  ]) {
    const candidate = clone(tiktok); change(candidate);
    assert.equal(Policy.admit([candidate], {now}).items.length, 0);
  }
  const stale = clone(tiktok); stale.lastCheckedAt = '2026-07-01T00:00:00.000Z';
  assert.equal(Policy.admit([stale], {now}).rejected[0].code, 'stale_unverified');
});

test('exact own references stay excluded and an empty confirmed day stays fixed', () => {
  const candidate = Batch.CANDIDATES.find(row => row.externalId === '1075375217279793808');
  const profile = Profile.normalize({configured:true,interests:candidate.interestIds,formats:['image'],visualTaste:'garden home gym wood sunlight plants',videoReferences:[{url:candidate.delivery.sourceUrl,title:'Garden gym',why:'Wood and plants'}]});
  const opts = {profile,candidates:[candidate],day:'2026-09-19',now,locale:'ru',ctx:{maxSharePerSource:1}};
  const first = Runtime.ensureDigest(opts);
  assert.equal(first.items.length,0);
  const next = Runtime.ensureDigest({...opts, profile:first.profile,candidates:Batch.CANDIDATES});
  assert.equal(next.fixed,true);
  assert.equal(next.items.length,0);
});

test('manually inspected static image is not required to have a video playback receipt', () => {
  const candidate = clone(Batch.CANDIDATES.find(row => row.source === 'pinterest'));
  candidate.checkMethod = 'manual'; candidate.available = true;
  assert.equal(Policy.admit([candidate], {now}).items.length,1);
  candidate.format = 'video'; candidate.durationSec = 30;
  assert.equal(Policy.admit([candidate], {now}).rejected[0].code, 'playback_unverified');
});

test('specific visual taste refuses unrelated category filler even when fewer than three matches remain', () => {
  const profile = Profile.configure({interests:['home','travel','design','creative'],formats:['image'],visualTaste:'garden home gym wood sunlight'});
  const rows = [
    {id:'garden',format:'image',interestIds:['home'],title:'Garden gym',body:'Sunlight through plants',keywords:['homegym','garden','wood','sunlight']},
    {id:'neon',format:'image',interestIds:['travel','design','creative'],title:'Tokyo taxis',body:'Your garden home gym wood sunlight taste',keywords:['neon','city']},
    {id:'wall',format:'image',interestIds:['design'],title:'Red architecture',body:'A building',keywords:['architecture','red']},
  ];
  assert.deepEqual(Profile.choose(rows,profile,'2026-09-19').map(row=>row.id),['garden']);
  assert.deepEqual(Profile.choose(rows.slice(1),profile,'2026-09-19'),[]);
  const broad = Profile.configure({interests:['travel','design'],formats:['image']});
  assert.equal(Profile.choose(rows.slice(1),broad,'2026-09-19').length,2,'broad-only profiles still work');
});
