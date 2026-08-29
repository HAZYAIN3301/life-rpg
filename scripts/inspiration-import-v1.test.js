'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');

const Import = require('../public/inspiration-import-v1.js');
const Profile = require('../public/inspiration-profile-v1.js');

const ids = (result) => result.interests.map((item) => item.id);
const labels = (result) => result.signals.map((item) => item.label).join(' | ');

function oneEntryZip(name, value) {
  const fileName = Buffer.from(name), source = Buffer.from(value), packed = deflateRawSync(source);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(source.length, 22); local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(source.length, 24); central.writeUInt16LE(fileName.length, 28);
  const centralOffset = local.length + fileName.length + packed.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + fileName.length, 12); eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, fileName, packed, central, fileName, eocd]);
}

test('JSON TikTok превращается в темы, но не сохраняет сообщения и приватные поля', () => {
  const data = {
    'Activity': {
      'Search History': {
        SearchList: [
          { Date: '2026-08-20 10:00:00', SearchTerm: 'learn surfing in Croatia' },
          { Date: '2026-08-21 10:00:00', SearchTerm: 'Blender animation tutorial' },
        ],
      },
      'Favorite Hashtags': { FavoriteHashtagList: [{ HashtagName: '#cosplay' }] },
      'Like List': { ItemFavoriteList: [{ Link: 'https://www.tiktok.com/@creator/video/123?is_from_webapp=1' }] },
    },
    'Ads and data': { 'Ad Interests': ['Travel', 'Anime'] },
    'Direct Messages': { ChatHistory: [{ From: 'friend@example.com', Content: 'private anime message' }] },
    'Login History': [{ IP: '192.0.2.10', DeviceModel: 'Private Mac' }],
    Profile: { EmailAddress: 'owner@example.com', TelephoneNumber: '+491234567' },
  };
  const result = Import.analyzeEntries([{ name: 'TikTok.json', text: JSON.stringify(data) }]);

  assert.ok(ids(result).includes('sport'));
  assert.ok(ids(result).includes('animation'));
  assert.ok(ids(result).includes('travel'));
  assert.ok(ids(result).includes('anime'));
  assert.ok(ids(result).includes('creative'));
  assert.equal(result.links.length, 1);
  assert.equal(result.stats.searches, 2);
  assert.doesNotMatch(labels(result), /friend@example|private anime message|192\.0\.2\.10|Private Mac|owner@example|491234567/i);
  assert.equal(Object.hasOwn(result, 'raw'), false);
});

test('TXT-экспорт читает только разрешённые разделы', () => {
  const result = Import.analyzeEntries([
    { name: 'Search History.txt', text: 'Search Term: marathon training\nSearch Term: DIY room makeover' },
    { name: 'Direct Messages.txt', text: 'Content: private fitness conversation' },
    { name: 'Payment Information.txt', text: 'Item: travel booking card 4242' },
  ]);
  assert.ok(ids(result).includes('running'));
  assert.ok(ids(result).includes('diy'));
  assert.ok(ids(result).includes('home'));
  assert.doesNotMatch(labels(result), /private fitness|travel booking|4242/);
  assert.equal(result.stats.files, 1);
});

test('реальный deflate ZIP читается локально без отправки файла', async () => {
  const archive = oneEntryZip('Activity/Search History.json', JSON.stringify({
    'Search History': { SearchList: [{ SearchTerm: 'snowboarding in Germany' }] },
  }));
  const bytes = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
  const result = await Import.parseFile({ name: 'TikTok-export.zip', size: archive.length, arrayBuffer: async () => bytes });
  assert.ok(ids(result).includes('sport'));
  assert.ok(ids(result).includes('travel'));
  assert.equal(result.stats.files, 1);
});

test('пачка ссылок очищается, дедуплицируется и ограничивается', () => {
  const links = Import.linksFromText([
    'https://www.tiktok.com/@one/video/123?is_from_webapp=1&sender_device=pc',
    'https://www.tiktok.com/@one/video/123',
    'https://vm.tiktok.com/ZTest42/?_t=abc',
    'https://example.com/@one/video/123',
  ].join('\n'));
  assert.deepEqual(links, [
    'https://www.tiktok.com/@one/video/123',
    'https://vm.tiktok.com/ZTest42/',
  ]);
});

test('публичные подписи роликов добавляют конкретные темы и хэштеги', () => {
  const result = Import.analyzeLinkMetadata([
    { url: 'https://www.tiktok.com/@one/video/123', title: 'Learning Blender animation #3dart #vfx', author_name: 'CreativeTech' },
    { url: 'https://www.tiktok.com/@two/video/456', title: 'First surfing lesson in Croatia #travel', author_name: 'Trip Notes' },
  ]);
  assert.ok(ids(result).includes('animation'));
  assert.ok(ids(result).includes('creative'));
  assert.ok(ids(result).includes('sport'));
  assert.ok(ids(result).includes('travel'));
  assert.ok(result.signals.some((item) => item.label === '#vfx'));
  assert.equal(result.links.length, 2);
});

test('oEmbed-запросы используют только TikTok URL и переживают удалённый ролик', async () => {
  const requested = [];
  const rows = await Import.resolveTikTokLinks([
    'https://www.tiktok.com/@one/video/123',
    'https://www.tiktok.com/@gone/video/456',
    'https://example.com/not-tiktok',
  ], async (url, options) => {
    requested.push({ url, options });
    if (url.includes('%40gone')) return { ok: false };
    return { ok: true, json: async () => ({ title: 'Yoga mobility #recovery', author_name: 'MoveLab' }) };
  });
  assert.equal(requested.length, 2);
  assert.equal(rows.length, 1);
  assert.match(requested[0].url, /^https:\/\/www\.tiktok\.com\/oembed\?url=/);
  assert.equal(requested[0].options.credentials, 'omit');
});

test('профиль хранит только компактные сигналы и статистику импорта', () => {
  const normalized = Profile.normalize({
    signals: [{ id: 'surf', label: 'Surfing in Croatia', score: 17.4, count: 2, sources: ['searches'] }],
    imports: [{ id: 'tiktok-1', source: 'tiktok', importedOn: '2026-08-29', signals: 92, searches: 14, hashtags: 5, videos: 31, explicitInterests: 4 }],
  });
  assert.deepEqual(normalized.signals[0], { id: 'surf', label: 'Surfing in Croatia', score: 17, count: 2, sources: ['searches'] });
  assert.deepEqual(normalized.imports[0], { id: 'tiktok-1', source: 'tiktok', importedOn: '2026-08-29', signals: 92, searches: 14, hashtags: 5, videos: 31, explicitInterests: 4 });
  assert.equal(JSON.stringify(normalized).includes('watch history'), false);
});
