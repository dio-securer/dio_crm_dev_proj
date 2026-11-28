// Row access rules (access.json, F2-2): schema, cross-reference checks and the file layout.
const { test } = require('node:test');
const { m, variant, obj, expectIssue, expectClean, assert } = require('./helpers.cjs');
const A = 'objects[lead]/access';
const withRules = (rules, entity = 'lead') => variant(b => { obj(b, 'lead').access = { entity, rules }; });
const codes = input => m.validateBundle(input).map(i => `${i.code} ${i.path}`);

test('every rule kind on a text or reference field with a known permission is clean', () => {
  expectClean(withRules([{ kind: 'own', ownerField: 'name' }, { kind: 'members', ownerField: 'account' },
    { kind: 'unit', unitField: 'company_name', permission: 'account.read' }, { kind: 'all', permission: 'company.manage' }]));
  expectClean(withRules([{ kind: 'none' }]));
});

test('schema: rules must not be empty, kinds are closed, none takes no permission, no extra keys', () => {
  for (const rules of [[], [{ kind: 'some' }], [{ kind: 'none', permission: 'account.read' }], [{ kind: 'own' }], [{ kind: 'all', field: 'x' }]]) {
    assert.ok(codes(withRules(rules)).some(c => c.startsWith('M01_SCHEMA_INVALID objects/1/access')), JSON.stringify(rules));
  }
});

test('R01 access entity must be the object key', () => {
  expectIssue(withRules([{ kind: 'own', ownerField: 'name' }], 'leed'), 'R01_UNKNOWN_ENTITY', `${A}/entity`);
});

test('R02 owner and unit fields must exist; R09 warns on alias and deprecated fields', () => {
  expectIssue(withRules([{ kind: 'own', ownerField: 'owner' }]), 'R02_UNKNOWN_FIELD', `${A}/rules[#0]/ownerField`);
  expectIssue(withRules([{ kind: 'members', ownerField: 'owner' }]), 'R02_UNKNOWN_FIELD', `${A}/rules[#0]/ownerField`);
  expectIssue(withRules([{ kind: 'all' }, { kind: 'unit', unitField: 'unit' }]), 'R02_UNKNOWN_FIELD', `${A}/rules[#1]/unitField`);
  expectIssue(withRules([{ kind: 'own', ownerField: 'company' }]), 'R09_ALIAS_USE', `${A}/rules[#0]/ownerField`);
  expectIssue(withRules([{ kind: 'own', ownerField: 'old_phone' }]), 'R09_DEPRECATED_USE', `${A}/rules[#0]/ownerField`);
});

test('R07 a rule permission must be in the permission catalog', () => {
  expectIssue(withRules([{ kind: 'all', permission: 'lead.readAll' }]), 'R07_UNKNOWN_PERMISSION', `${A}/rules[#0]/permission`);
  expectIssue(withRules([{ kind: 'own', ownerField: 'name', permission: 'nope' }]), 'R07_UNKNOWN_PERMISSION', `${A}/rules[#0]/permission`);
});

test('R11_ACCESS_FIELD_TYPE owner and unit fields must hold an id (text or reference)', () => {
  expectIssue(withRules([{ kind: 'own', ownerField: 'score' }]), 'R11_ACCESS_FIELD_TYPE', `${A}/rules[#0]/ownerField`);
  expectIssue(withRules([{ kind: 'unit', unitField: 'status' }]), 'R11_ACCESS_FIELD_TYPE', `${A}/rules[#0]/unitField`);
  expectIssue(withRules([{ kind: 'members', ownerField: 'next_call' }]), 'R11_ACCESS_FIELD_TYPE', `${A}/rules[#0]/ownerField`);
  assert.ok(!codes(withRules([{ kind: 'own', ownerField: 'account' }])).some(c => c.startsWith('R11')));
});

test('R11_ACCESS_NONE_MIXED none cannot sit next to other rules', () => {
  expectIssue(withRules([{ kind: 'own', ownerField: 'name' }, { kind: 'none' }]), 'R11_ACCESS_NONE_MIXED', `${A}/rules`);
  assert.ok(!codes(withRules([{ kind: 'none' }])).some(c => c.startsWith('R11')));
});

test('access.json is read and written at metadata/objects/<o>/access.json', () => {
  const b = withRules([{ kind: 'own', ownerField: 'name' }]);
  const files = m.filesFromBundle(b);
  const file = files.find(f => f.path === 'metadata/objects/lead/access.json');
  assert.ok(file);
  assert.deepEqual(JSON.parse(file.content), { entity: 'lead', rules: [{ kind: 'own', ownerField: 'name' }] });
  const loaded = m.bundleFromFiles(files);
  assert.deepEqual(loaded.issues, []);
  assert.deepEqual(obj(loaded.bundle, 'lead').access, obj(b, 'lead').access);
  assert.deepEqual(m.filesFromBundle(loaded.bundle), files);
  const broken = files.map(f => (f === file ? { ...f, content: '{"entity":"lead","rules":[]}' } : f));
  assert.ok(m.bundleFromFiles(broken).issues.some(i => i.code === 'M01_SCHEMA_INVALID' && i.path.startsWith('metadata/objects/lead/access.json')));
});

test('schema: an extra top-level key in access.json is M01', () => {
  const b = variant(x => { obj(x, 'lead').access = { entity: 'lead', rules: [{ kind: 'own', ownerField: 'name' }], extra: true }; });
  assert.ok(codes(b).some(c => c.startsWith('M01_SCHEMA_INVALID objects/1/access')), codes(b).join('\n'));
});
