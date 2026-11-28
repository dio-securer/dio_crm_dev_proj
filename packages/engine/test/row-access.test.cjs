// Row-level access evaluator: rule kinds, permission gates, OR, closed default, predicate == row check.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canAccessRow, filterRows, accessPredicate, matchesPredicate } = require('../dist');

const actor = { userId: 'u1', memberIds: ['u2', 'u3'], unitIds: ['east'], permissions: ['lead.read_all'] };
const rows = [
  { id: 'a', owner_id: 'u1', unit_id: 'west' },
  { id: 'b', owner_id: 'u2', unit_id: 'west' },
  { id: 'c', owner_id: 'u9', unit_id: 'east' },
  { id: 'd', owner_id: 'u9', unit_id: 'west' },
  { id: 'e', unit_id: 'west' },
];
const ids = (rules, who = actor) => filterRows(rules, who, rows).map(r => r.id);

test('no rule and none rule deny everything', () => {
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids([{ kind: 'none' }]), []);
  assert.deepEqual(accessPredicate([], actor), { kind: 'none' });
});

test('each rule kind', () => {
  assert.deepEqual(ids([{ kind: 'own', ownerField: 'owner_id' }]), ['a']);
  assert.deepEqual(ids([{ kind: 'members', ownerField: 'owner_id' }]), ['b']);
  assert.deepEqual(ids([{ kind: 'unit', unitField: 'unit_id' }]), ['c']);
  assert.deepEqual(ids([{ kind: 'all' }]), ['a', 'b', 'c', 'd', 'e']);
});

test('rules are ORed and merged per field', () => {
  const rules = [{ kind: 'own', ownerField: 'owner_id' }, { kind: 'members', ownerField: 'owner_id' }, { kind: 'unit', unitField: 'unit_id' }];
  assert.deepEqual(ids(rules), ['a', 'b', 'c']);
  assert.deepEqual(accessPredicate(rules, actor), {
    kind: 'anyOf', terms: [{ field: 'owner_id', values: ['u1', 'u2', 'u3'] }, { field: 'unit_id', values: ['east'] }],
  });
});

test('a permission gate turns a rule on only for actors who hold it', () => {
  const rules = [{ kind: 'own', ownerField: 'owner_id' }, { kind: 'all', permission: 'lead.read_all' }];
  assert.deepEqual(ids(rules), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(ids(rules, { ...actor, permissions: [] }), ['a']);
});

test('missing member or unit lists and non-string values never match', () => {
  const bare = { userId: 'u1', permissions: [] };
  assert.deepEqual(ids([{ kind: 'members', ownerField: 'owner_id' }, { kind: 'unit', unitField: 'unit_id' }], bare), []);
  assert.equal(canAccessRow([{ kind: 'own', ownerField: 'owner_id' }], actor, { owner_id: ['u1'] }), false);
});

test('predicate and row check agree on every row', () => {
  const ruleSets = [[], [{ kind: 'all' }], [{ kind: 'own', ownerField: 'owner_id' }, { kind: 'unit', unitField: 'unit_id' }],
    [{ kind: 'members', ownerField: 'owner_id', permission: 'x' }]];
  for (const rules of ruleSets) for (const row of rows) {
    assert.equal(canAccessRow(rules, actor, row), matchesPredicate(accessPredicate(rules, actor), row));
  }
});
