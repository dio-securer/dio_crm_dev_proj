// F2-7: role hierarchy on the existing row rules, object and field permissions, admin-only metadata versions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('../dist');
const { readMetadata, editJson } = require('./metadata-files.cjs');
const { COMPANY_ID, chart, rows } = require('./virtual-org.cjs');

const model = e.loadRuntimeModel(readMetadata()).model;
const rules = model.rowAccess('lead');
const actor = userId => e.withHierarchy({ userId, permissions: [] }, chart);
const seen = userId => e.filterRows(rules, actor(userId), rows).map(r => r.owner_name).sort();

test('the virtual organisation is synthetic and well formed', () => {
  assert.ok(COMPANY_ID < 0);
  assert.deepEqual(e.checkOrgChart(chart), []);
});

test('a salesperson sees only their own rows, not a sibling in the same or another branch', () => {
  assert.deepEqual(seen('s-1a-1'), ['s-1a-1']);
  assert.deepEqual(seen('s-1b-1'), ['s-1b-1']);
});

test('a branch head sees their branch only', () => {
  assert.deepEqual(seen('h-br-cap-1a'), ['h-br-cap-1a', 's-1a-1', 's-1a-2']);
  assert.ok(!seen('h-br-cap-1a').includes('s-1b-1'));
});

test('a division head and a region head see their whole subtree and nothing beside it', () => {
  assert.deepEqual(seen('h-div-cap-1'), ['h-br-cap-1a', 'h-div-cap-1', 's-1a-1', 's-1a-2', 's-1b-1']);
  assert.deepEqual(seen('h-reg-cap'), ['h-br-cap-1a', 'h-div-cap-1', 'h-reg-cap', 's-1a-1', 's-1a-2', 's-1b-1']);
  assert.ok(!seen('h-reg-cap').includes('s-south-1'));
  assert.deepEqual(seen('h-dom'), [...rows.map(r => r.owner_name)].sort());
});

test('a broken chart (cycle, unknown parent) opens nothing', () => {
  const cyc = { units: [{ id: 'a', parentId: 'b', headUserId: 'x' }, { id: 'b', parentId: 'a' }], members: [{ userId: 'y', unitId: 'b' }] };
  assert.deepEqual(e.checkOrgChart(cyc).map(i => i.code), ['CYCLE', 'CYCLE']);
  assert.deepEqual(e.hierarchyScope(cyc, 'x'), { unitIds: [], memberIds: [] });
  const orphan = { units: [{ id: 'a', parentId: 'zz', headUserId: 'x' }], members: [] };
  assert.deepEqual(e.checkOrgChart(orphan), [{ code: 'UNKNOWN_PARENT', id: 'a' }]);
});

const sales = { key: 'sales', objects: { lead: { read: true, create: true, edit: true } }, fields: { lead: { '*': { read: true, edit: true }, phone: { read: true } } } };
const hidePhone = { key: 'pii', fields: { lead: { business_no: { read: true } } } };

test('object permissions are closed by default and a restriction wins', () => {
  assert.equal(e.canObject({ sets: [] }, 'lead', 'read'), false);
  assert.equal(e.canObject({ sets: [sales] }, 'lead', 'read'), true);
  assert.equal(e.canObject({ sets: [sales] }, 'lead', 'delete'), false);
  assert.equal(e.canObject({ sets: [sales], restrictions: [{ key: 'r', objects: { lead: { edit: true } } }] }, 'lead', 'edit'), false);
});

test('field permissions: unreadable fields are stripped and cannot be written; read-only fields cannot be written', () => {
  const grants = { sets: [sales], restrictions: [hidePhone] };
  const access = e.fieldAccessOf(grants, 'lead');
  assert.deepEqual(access('business_no'), { read: false, edit: false });
  assert.deepEqual(access('phone'), { read: true, edit: false });
  assert.deepEqual(e.readableValues({ hospital_name: 'H', business_no: '1', phone: '2' }, access), { hospital_name: 'H', phone: '2' });
  const r = e.validateWrite(model, 'lead', { hospital_name: 'H', status: 'NEW', business_no: '9', phone: '1' }, 'create', access);
  assert.deepEqual(r.errors, [{ code: 'FIELD_FORBIDDEN', field: 'business_no' }, { code: 'READ_ONLY_FIELD', field: 'phone' }]);
  assert.equal(e.validateWrite(model, 'lead', { hospital_name: 'H', status: 'NEW' }, 'create', access).ok, true);
  // No object grant: every field is closed.
  assert.deepEqual(e.fieldAccess({ sets: [{ key: 'f', fields: { lead: { '*': { read: true, edit: true } } } }] }, 'lead', 'phone'), { read: false, edit: false });
});

test('the screen model loses unreadable fields and marks uneditable ones read-only', () => {
  const ui = e.buildUiModel(model, 'lead', 'en-US');
  const narrowed = e.restrictUiModel(ui, e.fieldAccessOf({ sets: [sales], restrictions: [hidePhone] }, 'lead'));
  assert.ok(!JSON.stringify(narrowed.fields).includes('"business_no"'));
  assert.ok(narrowed.screens.every(s => s.fields.every(f => f.key !== 'business_no')));
  assert.equal(narrowed.fields.find(f => f.key === 'phone').readOnly, true);
  assert.equal(e.restrictUiModel(ui, undefined), ui);
});

test('only admins stage, publish, discard and roll back metadata versions', async () => {
  const svc = new e.AdminVersions(new e.MetadataVersions(e.memoryVersionStore(), () => '2026-11-28T00:00:00Z'));
  const user = { userId: 'u', permissions: ['config.read'] }, editor = { userId: 'ed', permissions: ['config.edit'] };
  const admin = { userId: 'ad', permissions: ['config.edit', 'config.publish'] };
  const forbidden = p => assert.rejects(p, x => x instanceof e.VersionError && x.code === 'FORBIDDEN');
  await forbidden(svc.stage(readMetadata(), user));
  await forbidden(svc.stage(readMetadata(), undefined));
  const id = await svc.stage(readMetadata(), editor);
  await forbidden(svc.publish(id, editor));
  await forbidden(svc.publish(id, user));
  await svc.publish(id, admin);
  const id2 = await svc.stage(editJson(readMetadata(), 'metadata/terms/en-US/lead.json', d => { d['lead.label'] = 'X'; }), admin);
  await svc.publish(id2, admin);
  await forbidden(svc.rollback(user));
  await forbidden(svc.rollback(editor));
  assert.equal((await svc.rollback(admin)).id, id);
  await forbidden(svc.discard(await svc.stage(readMetadata(), admin), user));
});
