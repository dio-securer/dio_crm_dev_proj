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

test('an existing object without access.json was closed: a first rule set is a widening, none is not', () => {
  assert.deepEqual(codes(variant(() => {}), withRules([{ kind: 'all' }])), [W(0)]);
  assert.deepEqual(codes(variant(() => {}), withRules([own])), [W(0)]);
  assert.deepEqual(codes(variant(() => {}), withRules([{ kind: 'none' }])), []);
});

test('two steps, delete access.json then re-add it as all, are each judged: the second is a widening', () => {
  const step1 = variant(() => {});
  assert.deepEqual(codes(withRules([own]), step1), []);
  assert.deepEqual(codes(step1, withRules([{ kind: 'all' }])), [W(0)]);
});

test('a new object (absent from the base) is a new definition, not compared', () => {
  const head = variant(b => { b.objects.push({ object: { key: 'contact', labelKey: 'lead.label', pluralLabelKey: 'lead.plural', fields: [] }, access: { entity: 'contact', rules: [{ kind: 'all' }] } }); });
  assert.deepEqual(codes(variant(() => {}), head), []);
});

test('changing the ownerField of a members rule is a widening', () => {
  const members = f => ({ kind: 'members', ownerField: f });
  assert.deepEqual(codes(withRules([members('name')]), withRules([members('phone')])), [W(0)]);
});

test('a field named by its alias is the same field', () => {
  const head = variant(b => { field(b, 'lead', 'name').aliases = ['title']; obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'title' }] }; });
  assert.deepEqual(codes(withRules([own]), head), []);
});
