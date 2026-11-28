// buildUiModel (F2-5): the published model of one object as the screens need it. Checked with the repository's lead
// settings in both languages and with a second object that refers to lead.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRuntimeModel, buildUiModel, isUiLocale } = require('../dist');
const { readMetadata, editJson } = require('./metadata-files.cjs');

const term = (locale, file, key) => JSON.parse(readMetadata().find(f => f.path === `metadata/terms/${locale}/${file}.json`).content)[key];
const visit = [
  { path: 'metadata/objects/visit/object.json', content: JSON.stringify({ aliases: [], key: 'visit', labelKey: 'lead.tab.basic', pluralLabelKey: 'lead.tab.keyman' }) },
  { path: 'metadata/objects/visit/fields.json', content: JSON.stringify({ fields: [
    { aliases: [], key: 'lead_ref', labelKey: 'lead.label', required: true, system: false, type: 'reference', referenceObject: 'lead' },
    { aliases: [], key: 'old_ref', labelKey: 'lead.label', required: false, system: false, type: 'reference', referenceObject: 'lead', deprecated: { since: '2026-11' } },
    { aliases: [], key: 'self_ref', labelKey: 'lead.plural', required: false, system: false, type: 'reference', referenceObject: 'visit' },
  ] }) },
];
function load(files = readMetadata()) {
  const loaded = loadRuntimeModel(files);
  assert.deepEqual(loaded.issues.filter(i => i.severity === 'error'), []);
  return loaded.model;
}

test('lead in en-US: object, fields with options, screens and views in display order', () => {
  const ui = buildUiModel(load(), 'lead', 'en-US');
  assert.deepEqual(ui.object, { key: 'lead', label: 'Lead', pluralLabel: 'Leads' });
  assert.equal(ui.locale, 'en-US');
  const status = ui.fields.find(f => f.key === 'status');
  assert.deepEqual({ type: status.type, label: status.label, required: status.required, readOnly: status.readOnly }, { type: 'enum', label: 'Status', required: true, readOnly: false });
  assert.deepEqual(status.options[0], { code: 'NEW', label: 'New' });
  assert.ok(status.options.every(o => o.label && !o.label.startsWith('lead.')));
  assert.deepEqual(ui.fields.find(f => f.key === 'updated_at'), { key: 'updated_at', type: 'datetime', label: 'Updated at', required: false, system: true, readOnly: true, deprecated: false });
  const detail = ui.screens.find(s => s.key === 'detail'), create = ui.screens.find(s => s.key === 'create');
  assert.deepEqual([detail.create, create.create], [false, true]);
  assert.deepEqual(detail.tabs, [{ id: 'basic', label: 'Basics', order: 0 }, { id: 'keyman', label: 'Key person', order: 1 }]);
  assert.deepEqual(detail.sections.map(s => `${s.tabId}/${s.id}/${s.title}/${s.columns}`), ['basic/info/General/2', 'keyman/keyman/Key person details/2', 'basic/region/Region/2', 'keyman/system/Systems in use/2']);
  assert.deepEqual(create.fields.filter(f => f.sectionId === 'info').slice(0, 2).map(f => [f.key, f.label, f.required, f.order]), [['hospital_name', 'Hospital name', true, 0], ['status', 'Status', true, 1]]);
  assert.deepEqual(ui.listViews.map(v => [v.key, v.label, v.pageSize, v.sort]), [['hq_default', 'All leads', 25, [{ field: 'updated_at', direction: 'DESC' }]], ['excluded', 'Excluded leads', 25, [{ field: 'updated_at', direction: 'DESC' }]]]);
  assert.deepEqual(ui.listViews[1].columns, ['hospital_name', 'status', 'owner_name', 'exclusion_reason', 'updated_at']);
  assert.deepEqual(ui.related, []);
});

test('lead in ko-KR takes every label and fixed text from the ko-KR terms', () => {
  const ui = buildUiModel(load(), 'lead', 'ko-KR');
  assert.equal(ui.object.label, term('ko-KR', 'lead', 'lead.label'));
  assert.equal(ui.fields.find(f => f.key === 'hospital_name').label, term('ko-KR', 'lead', 'lead.field.hospital_name'));
  assert.equal(ui.fields.find(f => f.key === 'status').options[0].label, term('ko-KR', 'lead', 'lead.status.NEW'));
  assert.equal(ui.texts['engine.action.save'], term('ko-KR', 'engine', 'engine.action.save'));
  assert.notEqual(ui.texts['engine.action.save'], buildUiModel(load(), 'lead', 'en-US').texts['engine.action.save']);
  assert.ok(Object.keys(ui.texts).length > 20 && Object.keys(ui.texts).every(k => k.startsWith('engine.')));
});

test('it carries settings only: no rows, no access rules, nothing outside the object', () => {
  const ui = buildUiModel(load(), 'lead', 'en-US');
  assert.deepEqual(Object.keys(ui).sort(), ['fields', 'listViews', 'locale', 'object', 'related', 'screens', 'texts']);
  assert.doesNotMatch(JSON.stringify(ui), /ownerField|"rules"|"access"|"filter"/);
});

test('keys are canonical: an alias used by a screen, a view column or a sort becomes the field key', () => {
  let files = editJson(readMetadata(), 'metadata/objects/lead/fields.json', d => { const f = d.fields.find(x => x.key === 'phone'); f.key = 'phone_number'; f.aliases = ['phone']; });
  files = editJson(files, 'metadata/objects/lead/list-views.json', d => { d.views[0].sort = [{ field: 'phone', direction: 'ASC' }]; });
  const ui = buildUiModel(load(files), 'lead', 'en-US');
  assert.ok(ui.screens.every(s => s.fields.every(f => f.key !== 'phone')));
  assert.ok(ui.screens.find(s => s.key === 'create').fields.some(f => f.key === 'phone_number'));
  assert.ok(ui.listViews[0].columns.includes('phone_number') && !ui.listViews[0].columns.includes('phone'));
  assert.deepEqual(ui.listViews[0].sort, [{ field: 'phone_number', direction: 'ASC' }]);
});

test('a field that some screen shows read-only is read-only for the form, as the API refuses it', () => {
  const files = editJson(readMetadata(), 'metadata/objects/lead/screens/detail.json', d => { d.fields.fields.find(f => f.key === 'phone').readOnly = true; });
  const ui = buildUiModel(load(files), 'lead', 'en-US');
  assert.equal(ui.fields.find(f => f.key === 'phone').readOnly, true);
  assert.equal(ui.fields.find(f => f.key === 'sido').readOnly, false);
});

test('related lists come from reference fields of other objects that point here (deprecated ones left out)', () => {
  const model = load([...readMetadata(), ...visit]);
  assert.deepEqual(buildUiModel(model, 'lead', 'en-US').related, [{ object: 'visit', field: 'lead_ref', label: 'Key person', fieldLabel: 'Lead' }]);
  assert.deepEqual(buildUiModel(model, 'visit', 'en-US').related, [{ object: 'visit', field: 'self_ref', label: 'Key person', fieldLabel: 'Leads' }]);
  assert.equal(buildUiModel(model, 'visit', 'en-US').fields[0].referenceObject, 'lead');
  assert.deepEqual(buildUiModel(model, 'visit', 'en-US').listViews, []);
});

test('an unknown object or a language that is not a required one gives no model', () => {
  const model = load();
  assert.equal(buildUiModel(model, 'nope', 'en-US'), undefined);
  for (const locale of ['fr-FR', 'en', '', '__proto__']) assert.equal(buildUiModel(model, 'lead', locale), undefined);
  assert.deepEqual([isUiLocale('ko-KR'), isUiLocale('en-US'), isUiLocale('xx'), isUiLocale(undefined), isUiLocale(['ko-KR'])], [true, true, false, false, false]);
});
