// validateBundle: R06-R10, overlays and deterministic order.
const { test } = require('node:test');
const { m, bundle, variant, obj, field, expectIssue, expectClean, assert } = require('./helpers.cjs');
const L = 'objects[lead]';

test('R06 unknown reference object', () => {
  expectIssue(variant(b => { field(b, 'lead', 'account').referenceObject = 'acount'; }), 'R06_UNKNOWN_REFERENCE_OBJECT', `${L}/object/fields[account]/referenceObject`);
});

test('R07 closed universes: actions, features, permissions, workflow states, menu parents', () => {
  expectIssue(variant(b => { obj(b, 'lead').workflow.transitions[0].actionKey = 'begin'; }), 'R07_UNKNOWN_ACTION', `${L}/workflow/transitions[#0]/actionKey`);
  expectIssue(variant(b => { obj(b, 'lead').rules.rules[0].effects[1].target = 'qualfy'; }), 'R07_UNKNOWN_ACTION', `${L}/rules/rules[need_phone]/effects[#1]/target`);
  expectIssue(variant(b => { b.menu.nodes[1].featureKey = 'leads'; }), 'R07_UNKNOWN_FEATURE', 'menu/nodes[leads]/featureKey');
  expectIssue(variant(b => { obj(b, 'lead').actions.actions[0].featureKey = 'crm'; }), 'R07_UNKNOWN_FEATURE', `${L}/actions/actions[qualify]/featureKey`);
  expectIssue(variant(b => { obj(b, 'lead').actions.actions[0].permission = 'lead.qualify'; }), 'R07_UNKNOWN_PERMISSION', `${L}/actions/actions[qualify]/permission`);
  expectIssue(variant(b => { b.menu.nodes[0].permission = 'sales.read'; }), 'R07_UNKNOWN_PERMISSION', 'menu/nodes[sales]/permission');
  expectIssue(variant(b => { obj(b, 'lead').workflow.transitions[1].to = 'WON'; }), 'R07_UNKNOWN_STATE', `${L}/workflow/transitions[#1]/to`);
  expectIssue(variant(b => { obj(b, 'lead').workflow.startState = 'OPEN'; }), 'R07_UNKNOWN_STATE', `${L}/workflow/startState`);
  expectIssue(variant(b => { b.menu.nodes[2].parentId = 'sale'; }), 'R07_UNKNOWN_MENU_PARENT', 'menu/nodes[opps]/parentId');
});

test('R08 duplicate keys, including a key colliding with an alias', () => {
  expectIssue(variant(b => { b.objects.push(structuredClone(b.objects[0])); }), 'R08_DUPLICATE_KEY', 'objects[account]/object/key');
  expectIssue(variant(b => { obj(b, 'lead').object.fields.push({ ...field(b, 'lead', 'phone') }); }), 'R08_DUPLICATE_KEY', `${L}/object/fields[phone]/key`);
  expectIssue(variant(b => { field(b, 'lead', 'phone').aliases = ['company']; }), 'R08_DUPLICATE_KEY', `${L}/object/fields[phone]/aliases[#0]`);
  expectIssue(variant(b => { field(b, 'lead', 'phone').aliases = ['score']; }), 'R08_DUPLICATE_KEY', `${L}/object/fields[phone]/aliases[#0]`);
  expectIssue(variant(b => { obj(b, 'account').object.aliases = ['lead']; }), 'R08_DUPLICATE_KEY', 'objects[account]/object/aliases[#0]');
  expectIssue(variant(b => { const v = obj(b, 'lead').listViews.views; v.push({ ...v[0] }); }), 'R08_DUPLICATE_KEY', `${L}/listViews/views[open]`);
  expectIssue(variant(b => { const a = obj(b, 'lead').actions.actions; a.push({ ...a[0] }); }), 'R08_DUPLICATE_KEY', `${L}/actions/actions[qualify]`);
  expectIssue(variant(b => { const r = obj(b, 'lead').rules.rules; r.push({ ...r[0] }); }), 'R08_DUPLICATE_KEY', `${L}/rules/rules[need_phone]`);
  expectIssue(variant(b => { b.menu.nodes.push({ ...b.menu.nodes[1] }); }), 'R08_DUPLICATE_KEY', 'menu/nodes[leads]');
});

test('R09 deprecation integrity', () => {
  expectIssue(variant(b => { field(b, 'lead', 'old_phone').deprecated.replacedBy = 'mobile'; }), 'R09_REPLACED_BY_MISSING', `${L}/object/fields[old_phone]/deprecated/replacedBy`);
  expectIssue(variant(b => { field(b, 'lead', 'phone').deprecated = { since: '2026-11' }; }), 'R09_REPLACED_BY_DEPRECATED', `${L}/object/fields[old_phone]/deprecated/replacedBy`);
  expectIssue(variant(b => { b.deprecations[0].replacedBy = 'nowhere'; }), 'R09_REPLACED_BY_MISSING', 'deprecations[#0]/replacedBy');
  const required = variant(b => { obj(b, 'lead').screens[1].fields.fields.push({ key: 'old_phone', sectionId: 'extra', visible: true, required: true, readOnly: false, labelKey: 'lead.old_phone', order: 9 }); });
  expectIssue(required, 'R09_DEPRECATED_REQUIRED', `${L}/screens[detail]/fields/fields[old_phone]/required`);
  const used = expectIssue(variant(b => { obj(b, 'lead').listViews.views[1].columns.push('old_phone'); }), 'R09_DEPRECATED_USE', `${L}/listViews/views[hot]/columns[#2]`);
  assert.equal(used.find(i => i.code === 'R09_DEPRECATED_USE').severity, 'warning');
  const alias = expectIssue(variant(b => { obj(b, 'lead').listViews.views[1].columns.push('company'); }), 'R09_ALIAS_USE', `${L}/listViews/views[hot]/columns[#2]`);
  assert.equal(alias.find(i => i.code === 'R09_ALIAS_USE').severity, 'warning');
});

test('R10 type compatibility', () => {
  expectIssue(variant(b => { field(b, 'lead', 'score').maxLength = 5; }), 'R10_OPTION_NOT_ALLOWED', `${L}/object/fields[score]/maxLength`);
  expectIssue(variant(b => { obj(b, 'lead').screens[1].fields.fields[3].maxLength = 5; }), 'R10_OPTION_NOT_ALLOWED', `${L}/screens[detail]/fields/fields[score]/maxLength`);
  expectIssue(variant(b => { delete field(b, 'lead', 'status').enumCodeGroup; }), 'R10_ENUM_NEEDS_GROUP', `${L}/object/fields[status]`);
  expectIssue(variant(b => { delete field(b, 'lead', 'account').referenceObject; }), 'R10_REFERENCE_NEEDS_OBJECT', `${L}/object/fields[account]`);
  expectIssue(variant(b => { obj(b, 'lead').listViews.views[1].filter = { op: 'gt', field: 'hot', value: 1 }; }), 'R10_OPERATOR_TYPE', `${L}/listViews/views[hot]/filter/op`);
  expectIssue(variant(b => { obj(b, 'lead').rules.rules[0].condition = { op: 'not', arg: { op: 'lt', field: 'name', value: 'a' } }; }), 'R10_OPERATOR_TYPE', `${L}/rules/rules[need_phone]/condition/arg/op`);
  expectIssue(variant(b => { obj(b, 'lead').screens[0].fields.fields[1].visible = false; }), 'R10_REQUIRED_HIDDEN', `${L}/screens[create]/fields/fields[status]`);
  expectIssue(variant(b => { obj(b, 'opportunity').screens[0].fields.fields.pop(); }), 'R10_REQUIRED_HIDDEN', 'objects[opportunity]/screens[create]/fields/fields[account]');
});

test('overlays: a defect that only exists after an overlay is reported under the overlay layer', () => {
  const hidden = variant(b => { b.overlays.push({ scope: 'COMPANY', scopeKey: '10000000-0000-4000-8000-000000000003', domain: 'FIELD', entity: 'lead', screenKey: 'create', overrides: [{ op: 'REMOVE_ITEM', path: [{ property: 'fields' }, { itemKey: 'status' }] }] }); });
  expectIssue(hidden, 'R10_REQUIRED_HIDDEN', 'overlays/COMPANY/10000000-0000-4000-8000-000000000003/objects[lead]/screens[create]/fields/fields[status]');
  const column = variant(b => { b.overlays[2].overrides = [{ op: 'SET', path: [{ property: 'views' }, { itemKey: 'hot' }, { property: 'columns' }], value: ['name', 'ghost'] }]; });
  expectIssue(column, 'R02_UNKNOWN_FIELD', 'overlays/COUNTRY/HQ:KR/objects[lead]/listViews/views[hot]/columns[#1]');
  expectIssue(variant(b => { b.overlays[0].overrides[0].path[1].itemKey = 'nope'; }), 'M02_OVERLAY_INVALID', 'overlays[#0]/overrides');
  expectIssue(variant(b => { b.overlays[0].scopeKey = 'not-a-uuid'; }), 'M02_OVERLAY_INVALID', 'overlays[#0]');
  expectIssue(variant(b => { b.overlays[1].screenKey = 'edit'; }), 'M03_OVERLAY_TARGET_MISSING', 'overlays[#1]/screenKey');
  expectIssue(variant(b => { b.overlays[0].domain = 'CODE'; b.codes = undefined; obj(b, 'lead').object.fields = obj(b, 'lead').object.fields.filter(f => f.type !== 'enum'); obj(b, 'account').object.fields = obj(b, 'account').object.fields.filter(f => f.type !== 'enum'); }), 'M03_OVERLAY_TARGET_MISSING', 'overlays[#0]');
});

test('issue order is deterministic whatever the order of the input', () => {
  const broken = () => variant(b => {
    obj(b, 'lead').listViews.views[0].columns.push('a1', 'a2');
    field(b, 'lead', 'status').enumCodeGroup = 'nope';
    b.menu.nodes[0].permission = 'x.y';
    b.terms.translations = b.terms.translations.filter(t => t.locale !== 'en-US');
  });
  const first = m.validateBundle(broken());
  assert.ok(first.length > 10);
  for (let seed = 1; seed <= 20; seed += 1) {
    const b = broken();
    let s = seed;
    const shuffle = list => { for (let i = list.length - 1; i > 0; i -= 1) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [list[i], list[j]] = [list[j], list[i]]; } };
    shuffle(b.terms.translations); shuffle(b.codes.groups); shuffle(b.features.items);
    assert.deepEqual(m.validateBundle(b), first);
    assert.deepEqual(m.validateBundle(b), m.validateBundle(structuredClone(b)));
  }
  const sorted = [...first].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  assert.deepEqual(first.map(i => i.path + i.code), sorted.map(i => i.path + i.code));
});

test('every issue code has a severity, and only R09 use and D04 are warnings', () => {
  const warnings = Object.entries(m.ISSUE_CODES).filter(([, v]) => v.severity === 'warning').map(([k]) => k).sort();
  assert.deepEqual(warnings, ['D04_DEPRECATED_NEW_USE', 'R09_ALIAS_USE', 'R09_DEPRECATED_USE']);
  assert.deepEqual(Object.keys(m.ISSUE_CODES).sort(), Object.keys(m.ISSUE_MESSAGES).sort());
});
