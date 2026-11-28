// diffBundles: the ADR 0004 backward-compatibility check.
const { test } = require('node:test');
const { m, bundle, variant, obj, field, assert } = require('./helpers.cjs');
const codes = (base, head) => m.diffBundles(base, head).map(i => `${i.code} ${i.path}`);

test('identical bundles and pure additions are clean', () => {
  assert.deepEqual(codes(bundle(), bundle()), []);
  const head = variant(b => {
    obj(b, 'lead').object.fields.push({ key: 'email', type: 'text', labelKey: 'lead.phone' });
    obj(b, 'lead').listViews.views.push({ ...obj(b, 'lead').listViews.views[1], key: 'mine' });
    b.menu.nodes.push({ ...b.menu.nodes[1], id: 'more' });
    b.objects.push({ object: { key: 'contact', labelKey: 'lead.label', pluralLabelKey: 'lead.plural', fields: [] } });
  });
  assert.deepEqual(codes(bundle(), head), []);
});

test('removing a field that was not deprecated is an error; deprecate first, then remove, is clean', () => {
  const removed = variant(b => { obj(b, 'lead').object.fields = obj(b, 'lead').object.fields.filter(f => f.key !== 'score'); });
  assert.deepEqual(codes(bundle(), removed), ['D01_REMOVED_WITHOUT_DEPRECATION objects[lead]/object/fields[score]']);
  const step1 = variant(b => { field(b, 'lead', 'score').deprecated = { since: '2026-11' }; });
  assert.deepEqual(codes(bundle(), step1).filter(c => !c.startsWith('D04')), []);
  const step2 = variant(b => { obj(b, 'lead').object.fields = obj(b, 'lead').object.fields.filter(f => f.key !== 'old_phone'); });
  assert.deepEqual(codes(bundle(), step2), []);
});

test('renaming a field without an alias is an error; with an alias it is clean', () => {
  const renamed = variant(b => { field(b, 'lead', 'phone').key = 'mobile'; });
  assert.ok(codes(bundle(), renamed).includes('D02_RENAMED_WITHOUT_ALIAS objects[lead]/object/fields[phone]'));
  const aliased = variant(b => { const f = field(b, 'lead', 'phone'); f.key = 'mobile'; f.aliases = ['phone']; field(b, 'lead', 'old_phone').deprecated.replacedBy = 'mobile'; });
  assert.deepEqual(codes(bundle(), aliased), []);
});

test('removing or renaming an object', () => {
  const gone = variant(b => { b.objects = b.objects.filter(o => o.object.key !== 'opportunity'); });
  assert.deepEqual(codes(bundle(), gone), ['D01_REMOVED_WITHOUT_DEPRECATION objects[opportunity]']);
  const renamed = variant(b => { obj(b, 'opportunity').object.key = 'deal'; });
  assert.deepEqual(codes(bundle(), renamed), ['D02_RENAMED_WITHOUT_ALIAS objects[opportunity]']);
  const aliased = variant(b => { const o = obj(b, 'opportunity').object; o.key = 'deal'; o.aliases = ['opportunity']; });
  assert.deepEqual(codes(bundle(), aliased), []);
  const base = variant(b => { obj(b, 'opportunity').object.deprecated = { since: '2026-11' }; });
  assert.deepEqual(codes(base, variant(b => { b.objects = b.objects.filter(o => o.object.key !== 'opportunity'); })), []);
});

test('list views, actions and menu nodes need a deprecation record before removal', () => {
  const noView = variant(b => { obj(b, 'lead').listViews.views.pop(); });
  assert.deepEqual(codes(bundle(), noView), ['D01_REMOVED_WITHOUT_DEPRECATION objects[lead]/listViews/views[hot]']);
  const recorded = variant(b => { b.deprecations.push({ kind: 'LIST_VIEW', entity: 'lead', key: 'hot', since: '2026-11' }); });
  assert.deepEqual(codes(recorded, noView), []);
  const noAction = variant(b => { obj(b, 'opportunity').actions.actions = []; });
  assert.deepEqual(codes(bundle(), noAction), ['D01_REMOVED_WITHOUT_DEPRECATION objects[opportunity]/actions/actions[close]']);
  const noMenu = variant(b => { b.menu.nodes = b.menu.nodes.filter(n => n.id !== 'leads'); });
  assert.deepEqual(codes(bundle(), noMenu), ['D01_REMOVED_WITHOUT_DEPRECATION menu/nodes[leads]']);
  const noOpps = variant(b => { b.menu.nodes = b.menu.nodes.filter(n => n.id !== 'opps'); });
  assert.deepEqual(codes(bundle(), noOpps), []);
});

test('type changes: only the safe widenings pass', () => {
  assert.deepEqual(codes(bundle(), variant(b => { field(b, 'lead', 'score').type = 'decimal'; })), []);
  assert.deepEqual(codes(bundle(), variant(b => { field(b, 'lead', 'next_call').type = 'datetime'; })), []);
  assert.deepEqual(codes(bundle(), variant(b => { field(b, 'opportunity', 'amount').type = 'integer'; delete field(b, 'opportunity', 'amount').precision; delete field(b, 'opportunity', 'amount').scale; })),
    ['D03_TYPE_CHANGED objects[opportunity]/object/fields[amount]/type']);
  const viaAlias = variant(b => { const f = field(b, 'lead', 'hot'); f.key = 'is_hot'; f.aliases = ['hot']; f.type = 'text'; });
  assert.ok(codes(bundle(), viaAlias).includes('D03_TYPE_CHANGED objects[lead]/object/fields[hot]/type'));
  assert.deepEqual(m.SAFE_TYPE_WIDENINGS.map(p => p.join('>')), ['integer>decimal', 'date>datetime']);
});

test('a new use of a deprecated field is a warning; an existing use is not reported again', () => {
  const head = variant(b => { obj(b, 'lead').listViews.views[1].columns.push('old_phone'); });
  const issues = m.diffBundles(bundle(), head);
  assert.deepEqual(issues.map(i => `${i.code} ${i.severity} ${i.path}`), ['D04_DEPRECATED_NEW_USE warning objects[lead]/listViews/views[hot]/columns[#2]']);
  assert.deepEqual(m.diffBundles(head, head), []);
});

test('a bundle that does not parse gives M01 with base: or head: in the path', () => {
  const issues = m.diffBundles(bundle(), { schemaVersion: 2, objects: [] });
  assert.ok(issues.length > 0 && issues.every(i => i.code === 'M01_SCHEMA_INVALID' && i.path.startsWith('head:')));
});
