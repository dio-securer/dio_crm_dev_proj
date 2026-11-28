// diffBundles D05: widening row access is an error; narrowing, keeping and first definition are clean.
const { test } = require('node:test');
const { m, variant, obj, field, assert } = require('./helpers.cjs');
const withRules = rules => variant(b => { obj(b, 'lead').access = { entity: 'lead', rules }; });
const codes = (base, head) => m.diffBundles(base, head).map(i => `${i.code} ${i.path}`);
const own = { kind: 'own', ownerField: 'name' };
const W = i => `D05_ACCESS_WIDENED objects[lead]/access/rules[#${i}]`;

test('own -> all, adding a rule, changing the field or kind, dropping a permission are widenings', () => {
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'all' }])), [W(0)]);
  assert.deepEqual(codes(withRules([own]), withRules([own, { kind: 'members', ownerField: 'name' }])), [W(1)]);
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'own', ownerField: 'phone' }])), [W(0)]);
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'unit', unitField: 'name' }])), [W(0)]);
  assert.deepEqual(codes(withRules([{ kind: 'all', permission: 'company.manage' }]), withRules([{ kind: 'all' }])), [W(0)]);
  assert.deepEqual(codes(withRules([{ kind: 'all', permission: 'company.manage' }]), withRules([{ kind: 'all', permission: 'account.read' }])), [W(0)]);
  assert.deepEqual(codes(withRules([{ kind: 'none' }]), withRules([own])), [W(0)]);
});

test('keeping, narrowing, adding a permission, none, and removing access.json are clean', () => {
  assert.deepEqual(codes(withRules([own]), withRules([own])), []);
  assert.deepEqual(codes(withRules([own, { kind: 'all', permission: 'company.manage' }]), withRules([own])), []);
  assert.deepEqual(codes(withRules([own]), withRules([{ ...own, permission: 'account.read' }])), []);
  assert.deepEqual(codes(withRules([{ kind: 'all' }]), withRules([own, { kind: 'unit', unitField: 'company_name' }])), []);
  assert.deepEqual(codes(withRules([{ kind: 'all', permission: 'company.manage' }]), withRules([{ ...own, permission: 'company.manage' }])), []);
  assert.deepEqual(codes(withRules([own]), withRules([{ kind: 'none' }])), []);
  assert.deepEqual(codes(withRules([own]), variant(() => {})), []);
});

test('a first access.json on an existing object is a new definition, not compared', () => {
  assert.deepEqual(codes(variant(() => {}), withRules([{ kind: 'all' }])), []);
});

test('a field named by its alias is the same field', () => {
  const head = variant(b => { field(b, 'lead', 'name').aliases = ['title']; obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] }; });
  assert.deepEqual(codes(withRules([own]), head), []);
});
