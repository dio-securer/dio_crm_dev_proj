// Security settings (F2-7): permission sets, profiles, org charts (S01..S11), the `subtree` rule, file layout, D05.
const { test } = require('node:test');
const { m, variant, obj, expectIssue, expectClean, assert } = require('./helpers.cjs');
const codes = input => m.validateBundle(input).map(i => `${i.code} ${i.path}`);
const set = (key, extra = {}) => ({ key, name: key, ...extra });
const unit = (id, parentId) => ({ id, name: id, ...(parentId ? { parentId } : {}) });
const chart = (key, companyId, units, members = []) => ({ key, companyId, units, members });
const sec = patch => variant(b => Object.assign(b, patch));

test('a coherent set, profile and chart are clean; subtree on a text field is clean', () => {
  expectClean(sec({
    permissionSets: [set('s1', { objects: { lead: { read: true } }, fields: { lead: { '*': { read: true }, name: { edit: true } } } })],
    profiles: [{ key: 'p1', name: 'p', roles: ['SALES'], permissionSets: ['s1'], restrictions: [] }],
    orgCharts: [chart('c1', -1, [unit('a'), unit('b', 'a')], [{ userId: 'u1', unitId: 'b' }])],
  }));
  expectClean(variant(b => { obj(b, 'lead').access = { entity: 'lead', rules: [{ kind: 'subtree', ownerField: 'name' }] }; }));
});

test('S01..S05: duplicate or unknown sets, objects, fields and profiles', () => {
  expectIssue(sec({ permissionSets: [set('s1'), set('s1')] }), 'S01_DUPLICATE_PERMISSION_SET', 'permissionSets[s1]');
  expectIssue(sec({ permissionSets: [set('s1')], profiles: [{ key: 'p', name: 'p', roles: ['X'], permissionSets: ['nope'] }] }), 'S02_UNKNOWN_PERMISSION_SET', 'profiles[p]/permissionSets[#0]');
  expectIssue(sec({ permissionSets: [set('s1')], profiles: [{ key: 'p', name: 'p', roles: ['X'], restrictions: ['nope'] }] }), 'S02_UNKNOWN_PERMISSION_SET', 'profiles[p]/restrictions[#0]');
  expectIssue(sec({ permissionSets: [set('s1', { objects: { ghost: { read: true } } })] }), 'S03_UNKNOWN_OBJECT', 'permissionSets[s1]/objects/ghost');
  expectIssue(sec({ permissionSets: [set('s1', { fields: { ghost: { '*': { read: true } } } })] }), 'S03_UNKNOWN_OBJECT', 'permissionSets[s1]/fields/ghost');
  expectIssue(sec({ permissionSets: [set('s1', { fields: { lead: { ghost_field: { read: true } } } })] }), 'S04_UNKNOWN_FIELD', 'permissionSets[s1]/fields/lead/ghost_field');
  const p = { key: 'p', name: 'p', roles: ['X'] };
  expectIssue(sec({ profiles: [p, p] }), 'S05_DUPLICATE_PROFILE', 'profiles[p]');
});

test('S06..S11: broken org charts', () => {
  expectIssue(sec({ orgCharts: [chart('a', 1, [unit('x')]), chart('b', 1, [unit('y')])] }), 'S06_DUPLICATE_ORG_CHART', 'orgCharts[b]');
  expectIssue(sec({ orgCharts: [chart('a', 1, [unit('x'), unit('x')])] }), 'S07_DUPLICATE_UNIT', 'orgCharts[a]/units[#1]');
  expectIssue(sec({ orgCharts: [chart('a', 1, [unit('x', 'gone')])] }), 'S08_UNKNOWN_PARENT', 'orgCharts[a]/units[x]');
  expectIssue(sec({ orgCharts: [chart('a', 1, [unit('x', 'y'), unit('y', 'x')])] }), 'S09_ORG_CYCLE', 'orgCharts[a]/units[x]');
  expectIssue(sec({ orgCharts: [chart('a', 1, [unit('x')], [{ userId: 'u', unitId: 'nope' }])] }), 'S10_UNKNOWN_UNIT', 'orgCharts[a]/members[#0]');
  expectIssue(sec({ orgCharts: [chart('a', 1, [unit('x')], [{ userId: 'u', unitId: 'x' }, { userId: 'u', unitId: 'x' }])] }), 'S11_DUPLICATE_MEMBER', 'orgCharts[a]/members[#1]');
});

test('schema: closed shapes, a profile needs a role, a field key is snake or *', () => {
  for (const patch of [
    { profiles: [{ key: 'p', name: 'p', roles: [] }] },
    { permissionSets: [set('s', { objects: { lead: { read: true, own: true } } })] },
    { permissionSets: [set('s', { fields: { lead: { 'Bad-Key': { read: true } } } })] },
    { orgCharts: [chart('c', 1, [])] },
    { orgCharts: [{ ...chart('c', 1, [unit('x')]), extra: 1 }] },
  ]) assert.ok(codes(sec(patch)).some(c => c.startsWith('M01_SCHEMA_INVALID')), JSON.stringify(patch));
});

test('files: security files round-trip; an unknown file under security/ and a misnamed chart are refused', () => {
  const bundle = m.metadataBundleSchema.parse(sec({
    permissionSets: [set('s1', { objects: { lead: { read: true } } })],
    profiles: [{ key: 'p1', name: 'p', roles: ['SALES'], permissionSets: ['s1'] }],
    orgCharts: [chart('c1', -1, [unit('a')])],
  }));
  const files = m.filesFromBundle(bundle);
  for (const p of ['metadata/security/permission-sets.json', 'metadata/security/profiles.json', 'metadata/security/org/c1.json']) assert.ok(files.some(f => f.path === p), p);
  const back = m.bundleFromFiles(files);
  assert.deepEqual(back.issues, []);
  for (const k of ['permissionSets', 'profiles', 'orgCharts']) assert.deepEqual(back.bundle[k], bundle[k], k);
  const extra = m.bundleFromFiles([...files, { path: 'metadata/security/roles.json', content: '{}' }]);
  assert.ok(extra.issues.some(i => i.code === 'F01_UNKNOWN_FILE' && i.path === 'metadata/security/roles.json'));
  const renamed = files.map(f => (f.path.endsWith('org/c1.json') ? { ...f, path: 'metadata/security/org/c2.json' } : f));
  assert.ok(m.bundleFromFiles(renamed).issues.some(i => i.code === 'F02_MISPLACED_FILE'));
});

test('D05: adding subtree is a widening; members does not cover subtree; same subtree is clean', () => {
  const withRules = rules => variant(b => { obj(b, 'lead').access = { entity: 'lead', rules }; });
  const d = (a, b) => m.diffBundles(a, b).map(i => i.code);
  const own = { kind: 'own', ownerField: 'name' }, sub = { kind: 'subtree', ownerField: 'name' };
  assert.deepEqual(d(withRules([own, { kind: 'members', ownerField: 'name' }]), withRules([own, sub])), ['D05_ACCESS_WIDENED']);
  assert.deepEqual(d(withRules([own, sub]), withRules([own, sub])), []);
  assert.deepEqual(d(withRules([own, sub]), withRules([own])), []);
});
