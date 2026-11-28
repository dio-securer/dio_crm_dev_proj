// validateBundle and canonicalJson: cases that pin individual checks (each fails if that check is removed).
const { test } = require('node:test');
const { m, variant, obj, field, expectIssue, expectClean, assert } = require('./helpers.cjs');
const L = 'objects[lead]';
const codes = (input, code) => m.validateBundle(input).filter(i => i.code === code).map(i => i.path);

test('R01 screen entity and deprecation entity that are not objects', () => {
  expectIssue(variant(b => { obj(b, 'lead').screens[1].screen.entity = 'leed'; }), 'R01_UNKNOWN_ENTITY', `${L}/screens[detail]/screen/entity`);
  expectIssue(variant(b => { b.deprecations.push({ kind: 'ACTION', entity: 'ghost', key: 'qualify', since: '2026-11' }); }), 'R01_UNKNOWN_ENTITY', 'deprecations[#1]/entity');
  expectClean(variant(b => { b.deprecations.push({ kind: 'ACTION', entity: 'lead', key: 'qualify', since: '2026-11' }); }));
});

test('R04 plural label and code value labels need every translation', () => {
  expectIssue(variant(b => { b.terms.translations = b.terms.translations.filter(t => t.termKey !== 'lead.plural'); }), 'R04_MISSING_TRANSLATION', `${L}/object/pluralLabelKey`);
  expectIssue(variant(b => { b.terms.translations = b.terms.translations.filter(t => !(t.termKey === 'code.tier.a' && t.locale === 'ko-KR')); }), 'R04_MISSING_TRANSLATION', 'codes/groups[account_tier]/values[A]/labelKey');
});

test('R08 an extension field key that collides with a data field alias', () => {
  // A data field key cannot start with x_ (schema), so the reachable collision is a data field alias.
  expectIssue(variant(b => { field(b, 'account', 'employees').aliases = ['x_region']; }), 'R08_DUPLICATE_KEY', 'objects[account]/screens[detail]/fields/extensionDefinitions[#0]');
});

test('R10 referenceObject on a non-reference field, and gte/lte on non-comparable types', () => {
  expectIssue(variant(b => { field(b, 'lead', 'score').referenceObject = 'account'; }), 'R10_OPTION_NOT_ALLOWED', `${L}/object/fields[score]/referenceObject`);
  expectIssue(variant(b => { obj(b, 'lead').listViews.views[1].filter = { op: 'gte', field: 'hot', value: 1 }; }), 'R10_OPERATOR_TYPE', `${L}/listViews/views[hot]/filter/op`);
  expectIssue(variant(b => { obj(b, 'lead').listViews.views[1].filter = { op: 'lte', field: 'hot', value: 1 }; }), 'R10_OPERATOR_TYPE', `${L}/listViews/views[hot]/filter/op`);
});

test('R10_DECIMAL_SCALE: the scale, written or default (4), cannot be larger than the precision, written or default (18)', () => {
  const P = 'objects[account]/object/fields[revenue]';
  expectIssue(variant(b => { Object.assign(field(b, 'account', 'revenue'), { precision: 3, scale: 4 }); }), 'R10_DECIMAL_SCALE', `${P}/scale`);
  const byDefault = variant(b => { const f = field(b, 'account', 'revenue'); f.precision = 3; delete f.scale; });
  assert.match(expectIssue(byDefault, 'R10_DECIMAL_SCALE', `${P}/precision`).find(i => i.code === 'R10_DECIMAL_SCALE').message, /"revenue".*\(4\).*\(3\)/);
  expectIssue(variant(b => { const f = field(b, 'account', 'revenue'); delete f.precision; f.scale = 18; f.precision = 17; }), 'R10_DECIMAL_SCALE', `${P}/scale`);
  for (const [precision, scale] of [[4, 4], [5, 4], [1, 0], [38, 18]]) expectClean(variant(b => { Object.assign(field(b, 'account', 'revenue'), { precision, scale }); }));
  expectClean(variant(b => { const f = field(b, 'account', 'revenue'); delete f.precision; f.scale = 18; }));
  expectClean(variant(b => { const f = field(b, 'account', 'revenue'); f.precision = 4; delete f.scale; }));
  expectClean(variant(b => { const f = field(b, 'account', 'revenue'); delete f.precision; delete f.scale; }));
});

test('R10_REQUIRED_HIDDEN is skipped with several create screens, and system fields are exempt', () => {
  const two = variant(b => {
    const s = structuredClone(obj(b, 'lead').screens[0]);
    s.screen.screenKey = 'create_quick';
    s.fields.fields = s.fields.fields.filter(f => f.key !== 'status');
    obj(b, 'lead').screens.push(s);
  });
  assert.deepEqual(codes(two, 'R10_REQUIRED_HIDDEN'), []);
  expectClean(variant(b => { obj(b, 'opportunity').object.fields.push({ key: 'created_at', type: 'datetime', labelKey: 'opportunity.title', system: true, required: true }); }));
  expectIssue(variant(b => { obj(b, 'opportunity').object.fields.push({ key: 'created_at', type: 'datetime', labelKey: 'opportunity.title', required: true }); }), 'R10_REQUIRED_HIDDEN', 'objects[opportunity]/screens[create]/fields/fields[created_at]');
});

test('a COUNTRY layer is checked on top of its TEMPLATE layer', () => {
  const b = variant(x => { x.overlays[1] = { scope: 'TEMPLATE', scopeKey: 'HQ', domain: 'FIELD', entity: 'lead', screenKey: 'create', overrides: [{ op: 'SET', path: [{ property: 'fields' }, { itemKey: 'status' }, { property: 'visible' }], value: false }] }; });
  const paths = codes(b, 'R10_REQUIRED_HIDDEN');
  assert.ok(paths.includes('overlays/TEMPLATE/HQ/objects[lead]/screens[create]/fields/fields[status]'), paths.join('\n'));
  assert.ok(paths.includes('overlays/COUNTRY/HQ:KR/objects[lead]/screens[create]/fields/fields[status]'), paths.join('\n'));
});

test('a layer with an invalid overlay is not checked further', () => {
  const b = variant(x => {
    x.overlays.push({ scope: 'COMPANY', scopeKey: '10000000-0000-4000-8000-000000000003', domain: 'FIELD', entity: 'lead', screenKey: 'create', overrides: [{ op: 'REMOVE_ITEM', path: [{ property: 'fields' }, { itemKey: 'status' }] }] });
    x.overlays.push({ scope: 'COMPANY', scopeKey: '10000000-0000-4000-8000-000000000003', domain: 'MENU', overrides: [{ op: 'REMOVE_ITEM', path: [{ property: 'nodes' }, { itemKey: 'nope' }] }] });
  });
  const issues = m.validateBundle(b);
  assert.ok(issues.some(i => i.code === 'M02_OVERLAY_INVALID' && i.path === 'overlays[#4]/overrides'), issues.map(i => `${i.code} ${i.path}`).join('\n'));
  assert.deepEqual(issues.filter(i => i.path.startsWith('overlays/COMPANY/10000000-0000-4000-8000-000000000003/')), []);
});

test('canonicalJson sorts keys at every level and keeps array order', () => {
  const input = { z: 1, a: { y: [{ d: 1, c: 2 }, 3], b: undefined, x: null } };
  assert.equal(m.canonicalJson(input), '{\n  "a": {\n    "x": null,\n    "y": [\n      {\n        "c": 2,\n        "d": 1\n      },\n      3\n    ]\n  },\n  "z": 1\n}\n');
});
