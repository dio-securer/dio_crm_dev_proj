// validateBundle: the fixture is clean, and R01-R05 each fail on a defect and pass without it.
const { test } = require('node:test');
const { m, bundle, variant, obj, field, expectIssue, expectClean, assert } = require('./helpers.cjs');
const L = 'objects[lead]';

test('the fixture bundle is clean', () => expectClean(bundle()));
test('a bundle that does not match the schema gives M01', () => {
  const issues = m.validateBundle({ schemaVersion: 1, objects: [{ object: { key: 'Bad Key' } }] });
  assert.ok(issues.length > 0 && issues.every(i => i.code === 'M01_SCHEMA_INVALID'));
});

test('R01 payload entity that is not an object', () => {
  expectIssue(variant(b => { obj(b, 'lead').listViews.entity = 'leed'; }), 'R01_UNKNOWN_ENTITY', `${L}/listViews/entity`);
  expectIssue(variant(b => { obj(b, 'lead').screens[0].fields.entity = 'x'; }), 'R01_UNKNOWN_ENTITY', `${L}/screens[create]/fields/entity`);
  expectIssue(variant(b => { b.overlays[1].entity = 'ghost'; }), 'R01_UNKNOWN_ENTITY', 'overlays[#1]/entity');
});

test('R02 unknown field in columns, sort, filter, nested conditions, rules, workflow, actions, screens', () => {
  const cases = [
    [b => { obj(b, 'lead').listViews.views[0].columns.push('emial'); }, `${L}/listViews/views[open]/columns[#3]`],
    [b => { obj(b, 'lead').listViews.views[0].sort[0].field = 'nxt_call'; }, `${L}/listViews/views[open]/sort[#0]/field`],
    [b => { obj(b, 'lead').listViews.views[0].filter.args[1].field = 'scor'; }, `${L}/listViews/views[open]/filter/args[#1]/field`],
    [b => { obj(b, 'lead').actions.actions[1].condition.args[1].arg.field = 'nam'; }, `${L}/actions/actions[start]/condition/args[#1]/arg/field`],
    [b => { obj(b, 'lead').rules.rules[0].effects[0].target = 'fone'; }, `${L}/rules/rules[need_phone]/effects[#0]/target`],
    [b => { obj(b, 'lead').rules.rules[0].condition.field = 'stat'; }, `${L}/rules/rules[need_phone]/condition/field`],
    [b => { obj(b, 'lead').workflow.transitions[1].guard.args[0].field = 'points'; }, `${L}/workflow/transitions[#1]/guard/args[#0]/field`],
    [b => { obj(b, 'lead').screens[1].fields.fields[0].key = 'full_name'; }, `${L}/screens[detail]/fields/fields[full_name]/key`],
    [b => { obj(b, 'account').listViews.views[0].columns[2] = 'x_area'; }, 'objects[account]/listViews/views[all]/columns[#2]'],
  ];
  for (const [edit, path] of cases) expectIssue(variant(edit), 'R02_UNKNOWN_FIELD', path);
});
test('R02 extension fields resolve through FIELD.extensionDefinitions', () => {
  expectClean(variant(b => { obj(b, 'account').listViews.views[0].sort.push({ field: 'x_region', direction: 'DESC' }); }));
});

test('R03 unknown section and tab', () => {
  expectIssue(variant(b => { obj(b, 'lead').screens[1].fields.fields[2].sectionId = 'extras'; }), 'R03_UNKNOWN_SECTION', `${L}/screens[detail]/fields/fields[phone]/sectionId`);
  expectIssue(variant(b => { obj(b, 'lead').screens[1].screen.sections[1].tabId = 'other'; }), 'R03_UNKNOWN_TAB', `${L}/screens[detail]/screen/sections[extra]/tabId`);
});

test('R04 missing translation, also in the second locale only, and through a semantic key', () => {
  expectIssue(variant(b => { b.terms.translations = b.terms.translations.filter(t => t.termKey !== 'lead.phone'); }), 'R04_MISSING_TRANSLATION', `${L}/object/fields[phone]/labelKey`);
  const issues = expectIssue(variant(b => { b.terms.translations = b.terms.translations.filter(t => !(t.termKey === 'menu.opps' && t.locale === 'en-US')); }), 'R04_MISSING_TRANSLATION', 'menu/nodes[opps]/labelKey');
  assert.equal(issues.filter(i => i.code === 'R04_MISSING_TRANSLATION').length, 1);
  assert.match(issues[0].message, /en-US/);
  expectIssue(variant(b => { obj(b, 'lead').actions.actions[0].confirmKey = 'lead.action.qualify.confirmm'; }), 'R04_MISSING_TRANSLATION', `${L}/actions/actions[qualify]/confirmKey`);
  expectIssue(variant(b => { obj(b, 'lead').rules.rules[0].errorKey = 'lead.rule.typo'; }), 'R04_MISSING_TRANSLATION', `${L}/rules/rules[need_phone]/errorKey`);
  expectClean(variant(b => { obj(b, 'lead').object.labelKey = 'label.lead'; }));
});
test('R04 takes the locale list from the admin TERM schema', () => {
  const admin = require('../../packages/contracts/dist/admin');
  assert.deepEqual([...m.REQUIRED_LOCALES], admin.payloadSchemas.TERM.shape.translations.element.shape.locale.options);
});

test('R05 unknown code group', () => {
  expectIssue(variant(b => { field(b, 'lead', 'status').enumCodeGroup = 'lead_state'; }), 'R05_UNKNOWN_CODE_GROUP', `${L}/object/fields[status]/enumCodeGroup`);
  expectIssue(variant(b => { b.codes.groups.pop(); }), 'R05_UNKNOWN_CODE_GROUP', `${L}/object/fields[status]/enumCodeGroup`);
});
