const test = require('node:test');
const assert = require('node:assert/strict');
const Goals = require('../public/goals-initiatives-v1.js');

function goal(id, patch = {}) {
  return { id, title: id, type: 'short', status: 'active', archived: false, completedAt: null, createdAt: id, ...patch };
}

test('initiative records have stable unique ids and explicit states', () => {
  assert.equal(Goals.validateGroups([{ id: 'grp_1', title: 'Research', status: 'active', createdAt: '2026-08-25' }]), true);
  assert.equal(Goals.validateGroups([{ id: 'grp_1', title: 'A' }, { id: 'grp_1', title: 'B' }]), false);
  assert.equal(Goals.validateGroups([{ id: 'grp_1', title: 'A', status: 'deleted' }]), false);
});

test('normalization is non-destructive and detaches only orphan group links', () => {
  const groups = Goals.normalizeGroups([{ id: ' grp_1 ', title: ' Research ', createdAt: null }]);
  assert.deepEqual(groups, [{ id: 'grp_1', title: 'Research', createdAt: '', status: 'active' }]);
  const goals = [goal('a', { groupId: 'grp_1' }), goal('b', { groupId: 'missing' }), goal('c')];
  Goals.reconcileGoalLinks(goals, groups);
  assert.equal(goals[0].groupId, 'grp_1');
  assert.equal(goals[1].groupId, null);
  assert.equal(goals[2].groupId, undefined);
});

test('focus excludes mission/vision/path and shows at most three initiatives', () => {
  const groups = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id.toUpperCase(), status: 'active', createdAt: id }));
  const goals = [
    goal('mission', { groupId: 'a', type: 'mission' }),
    goal('a1', { groupId: 'a' }), goal('b1', { groupId: 'b' }), goal('c1', { groupId: 'c' }), goal('d1', { groupId: 'd' }),
  ];
  const model = Goals.focusModel({ goals, groups, today: '2026-08-25', nextAction: (item) => item.id === 'd1' ? { id: 'q1' } : null });
  assert.equal(model.initiatives.length, 3);
  assert.equal(model.initiatives[0].group.id, 'd');
  assert.equal(model.hiddenInitiatives, 1);
  assert.equal(model.initiatives.some((entry) => entry.goal.id === 'mission'), false);
});

test('focus ranking prefers overdue and actionable goals without leaking high horizons', () => {
  const goals = [
    goal('plain'),
    goal('action', { type: 'long' }),
    goal('overdue', { targetDate: '2026-08-20' }),
    goal('vision', { type: 'vision', targetDate: '2026-08-19' }),
  ];
  const ranked = Goals.rankGoals(goals, { today: '2026-08-25', nextAction: (item) => item.id === 'action' ? { id: 'q' } : null });
  assert.deepEqual(ranked.map((item) => item.id), ['overdue', 'action', 'plain']);
});

test('waiting and paused goals stay out of the immediate-action contour', () => {
  const ranked = Goals.rankGoals([
    goal('active'),
    goal('waiting', { status: 'waiting' }),
    goal('paused', { status: 'paused' }),
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ['active']);
});
