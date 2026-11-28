// F2-7: the published settings (metadata/security) give grants and the hierarchy; the request cannot.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('../dist');
const { readMetadata } = require('./metadata-files.cjs');

const model = e.loadRuntimeModel(readMetadata()).model;
const rules = model.rowAccess('lead');
const owners = ['v-dom-head', 'v-reg-cap-head', 'v-div-cap-1-head', 'v-div-cap-2-head', 'v-br-gangnam-head', 'v-br-jongno-head',
  'v-br-bundang-head', 'v-sales-gangnam-1', 'v-sales-gangnam-2', 'v-sales-jongno-1', 'v-sales-bundang-1', 'outsider'];
const rows = owners.map((owner_name, i) => ({ id: i + 1, owner_name }));
const actor = (userId, roles = ['SALES_REP'], companyId = -1) => e.secureActor({ userId, permissions: [], roles }, model.bundle, companyId);
const seen = (userId, roles, companyId) => e.filterRows(rules, actor(userId, roles, companyId), rows).map(r => r.owner_name).sort();

test('the settings hold the virtual domestic sales org for synthetic company -1 and the lead subtree rule', () => {
  const chart = e.orgChartFromMetadata(model.bundle, -1);
  assert.ok(chart);
  assert.deepEqual(e.checkOrgChart(chart), []);
  assert.equal(e.orgChartFromMetadata(model.bundle, 1), undefined);
  assert.ok(rules.some(r => r.kind === 'subtree'));
});

test('salespeople see their own rows only, never a sibling in the same or another branch', () => {
  assert.deepEqual(seen('v-sales-gangnam-1'), ['v-sales-gangnam-1']);
  assert.deepEqual(seen('v-sales-jongno-1'), ['v-sales-jongno-1']);
});

test('a branch head sees the branch, a division head the division, a region head the region', () => {
  assert.deepEqual(seen('v-br-gangnam-head', ['BRANCH_MANAGER']), ['v-br-gangnam-head', 'v-sales-gangnam-1', 'v-sales-gangnam-2']);
  assert.deepEqual(seen('v-div-cap-1-head', ['BRANCH_MANAGER']), ['v-br-gangnam-head', 'v-br-jongno-head', 'v-div-cap-1-head', 'v-sales-gangnam-1', 'v-sales-gangnam-2', 'v-sales-jongno-1']);
  const region = seen('v-reg-cap-head', ['BRANCH_MANAGER']);
  assert.ok(region.includes('v-sales-bundang-1') && region.includes('v-sales-jongno-1'));
  assert.ok(!region.includes('v-dom-head') && !region.includes('outsider'));
});

test('the hierarchy never crosses companies, and a token cannot bring its own subtree or grants', () => {
  assert.deepEqual(seen('v-reg-cap-head', ['BRANCH_MANAGER'], 7), ['v-reg-cap-head']);
  const forged = e.secureActor({ userId: 'v-sales-gangnam-1', permissions: [], roles: ['SALES_REP'], subtreeIds: ['v-sales-jongno-1'],
    grants: { sets: [{ key: 'x', objects: { lead: { delete: true } } }] } }, model.bundle, -1);
  assert.deepEqual(forged.subtreeIds, []);
  assert.equal(e.canObject(forged.grants, 'lead', 'delete'), false);
});

test('members and unit rules are not widened by the org chart', () => {
  const a = actor('v-reg-cap-head', ['BRANCH_MANAGER']);
  assert.deepEqual(a.memberIds ?? [], []);
  assert.deepEqual(a.unitIds ?? [], []);
  assert.deepEqual(e.filterRows([{ kind: 'members', ownerField: 'owner_name' }], a, rows), []);
});

test('profiles: a role gets its sets; a role no profile names gets nothing (closed by default)', () => {
  assert.equal(e.canObject(actor('u', ['SALES_REP']).grants, 'lead', 'create'), true);
  assert.equal(e.canObject(actor('u', ['SALES_REP']).grants, 'lead', 'delete'), false);
  assert.equal(e.canObject(actor('u', ['BRANCH_MANAGER']).grants, 'lead', 'delete'), true);
  assert.equal(e.canObject(actor('u', ['GUEST']).grants, 'lead', 'read'), false);
  assert.equal(e.canObject(actor('u', []).grants, 'lead', 'read'), false);
});

test('restrictions win over grants from the settings', () => {
  const bundle = structuredClone(model.bundle);
  bundle.permissionSets.push({ key: 'no_edit', name: 'n', objects: { lead: { edit: true } }, fields: {} });
  bundle.profiles.find(p => p.key === 'sales').restrictions.push('no_edit');
  const g = e.grantsFromMetadata(bundle, ['SALES_REP']);
  assert.equal(e.canObject(g, 'lead', 'edit'), false);
  assert.equal(e.canObject(g, 'lead', 'read'), true);
});

test('a present but empty profiles list denies everyone; only an absent profiles file narrows nothing', () => {
  const empty = { ...model.bundle, profiles: [] };
  assert.equal(e.canObject(e.grantsFromMetadata(empty, ['CRM_ADMIN']), 'lead', 'read'), false);
  const absent = { ...model.bundle, profiles: undefined };
  assert.equal(e.grantsFromMetadata(absent, ['CRM_ADMIN']), undefined);
});
