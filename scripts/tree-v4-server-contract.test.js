'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = server.indexOf(startMarker);
  const end = server.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return server.slice(start, end);
}

test('Tree crash redaction preserves the mechanical graph without mutating its source', () => {
  const source = sourceBetween('const TREE_CRASH_PRIVATE_FIELDS', '// Маппинг ошибок aiCallForUser');
  const { redactSkillTreeForCrash, fields } = Function(`${source}\nreturn { redactSkillTreeForCrash, fields: TREE_CRASH_PRIVATE_FIELDS };`)();
  const secret = 'личный результат';
  const input = {
    body: {
      schemaVersion: 4,
      archetype: '🏋',
      nodes: [
        { id: 'n1', title: 'Подтягивания', criterion: secret, nextAction: secret, proofNote: secret, requires: [], perks: [], unlocked: true, x: 0, y: 0 },
        { id: 'n2', title: 'Второй узел', requires: ['n1'], perks: [{ kind: 'xpPct', val: 8 }], unlocked: false, x: 194, y: 112 },
      ],
    },
    malformed: null,
  };
  const before = structuredClone(input);
  const output = redactSkillTreeForCrash(input);

  assert.deepEqual(fields, ['criterion', 'nextAction', 'proofNote']);
  assert.notEqual(output, input);
  assert.notEqual(output.body, input.body);
  assert.notEqual(output.body.nodes, input.body.nodes);
  assert.notEqual(output.body.nodes[0], input.body.nodes[0]);
  for (const field of fields) assert.equal(output.body.nodes[0][field], '[скрыто]');
  assert.equal(JSON.stringify(output).includes(secret), false);
  assert.equal(output.body.nodes.length, 2);
  assert.equal(output.body.nodes[0].id, 'n1');
  assert.equal(output.body.nodes[0].title, 'Подтягивания');
  assert.deepEqual(output.body.nodes[1], input.body.nodes[1]);
  assert.deepEqual(input, before, 'redaction mutated the account data loaded from disk');

  const malformedRoot = [{ nodes: [{ id: 'odd', criterion: secret, nextAction: secret, proofNote: secret }] }];
  const malformedOutput = redactSkillTreeForCrash(malformedRoot);
  assert.equal(JSON.stringify(malformedOutput).includes(secret), false, 'malformed Tree root bypassed privacy redaction');
  assert.equal(malformedOutput[0].nodes[0].id, 'odd');
});

test('redaction is scoped to crash diagnostics; owner and full admin exports remain complete', () => {
  const accountExport = sourceBetween("if (u === '/api/account/export'", "if (u === '/api/account/import'");
  assert.match(accountExport, /data: readPortableAccountData\(uid\)/);
  assert.doesNotMatch(accountExport, /redactSkillTreeForCrash/);

  const adminUserdata = sourceBetween('// GET /api/admin/userdata/<userId> —', '// GET /api/admin/crash-export/<userId> —');
  assert.match(adminUserdata, /files\[n\] = JSON\.parse/);
  assert.doesNotMatch(adminUserdata, /redactSkillTreeForCrash/);

  const crashExport = sourceBetween("am = u.match(/^\\/api\\/admin\\/crash-export", '// GET /api/admin/userdata/<userId>/backup');
  assert.match(crashExport, /n === 'skilltree' \? redactSkillTreeForCrash\(value\) : value/);
  assert.match(crashExport, /redacted: \{ 'skilltree\.nodes': TREE_CRASH_PRIVATE_FIELDS \}/);
});

test('Tree-map AI contract requires a complete 4–6 step capability path', () => {
  const prompt = sourceBetween('const AI_TREEMAP_SYS = `', '`;\n\nfunction normalizeTreeMapProposals');
  assert.match(prompt, /"title":"веха","criterion":/);
  assert.match(prompt, /"nextAction":"одно конкретное действие/);
  assert.match(prompt, /criterion описывает наблюдаемый результат/);
  assert.match(prompt, /nextAction — конкретное действие в реальном мире на ближайшие 7 дней/);

  const normalizerSource = sourceBetween('function normalizeTreeMapProposals', '// Каталог бэкапов');
  const normalizeTreeMapProposals = Function(`${normalizerSource}\nreturn normalizeTreeMapProposals;`)();
  const valid = Array.from({ length: 8 }, (_, index) => ({
    title: `  Шаг ${index + 1}  `,
    criterion: `  Проверяемый результат ${index + 1}  `,
    nextAction: `  Сделать конкретный шаг ${index + 1}  `,
    ignored: secretValue(index),
  }));
  const normalized = normalizeTreeMapProposals([
    null,
    { title: 'Нет критерия', nextAction: 'Действие' },
    { title: 'Нет шага', criterion: 'Критерий', nextAction: '' },
    ...valid,
  ]);

  assert.equal(normalized.length, 6);
  assert.deepEqual(Object.keys(normalized[0]), ['title', 'criterion', 'nextAction']);
  assert.equal(normalized[0].title, 'Шаг 1');
  assert.equal(normalized[0].criterion, 'Проверяемый результат 1');
  assert.equal(normalized[0].nextAction, 'Сделать конкретный шаг 1');

  const route = sourceBetween("if (u === '/api/ai/propose'", '// Тех-поддержка / гид');
  assert.match(route, /kind === 'treemap' \? normalizeTreeMapProposals\(parsed\.proposals\) : null/);
  assert.match(route, /kind === 'treemap' && treeMapProposals\.length < 4/);
});

function secretValue(index) {
  return `not-forwarded-${index}`;
}
