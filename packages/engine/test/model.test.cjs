// loadRuntimeModel against the real metadata/ folder and against broken input.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRuntimeModel } = require('../dist');
const { readMetadata } = require('./metadata-files.cjs');

test('the real metadata/ loads into a model with no errors', () => {
  const { model, issues } = loadRuntimeModel(readMetadata());
  assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
  assert.ok(model);
  assert.ok(model.objectKeys().includes('lead'));
  assert.equal(model.field('lead', 'status').enumCodeGroup, 'lead_status');
  assert.equal(model.field('lead', 'no_such_field'), undefined);
  assert.equal(model.object('no_such'), undefined);
  assert.deepEqual(model.codeValues('no_such'), []);
  assert.equal(model.term('lead.label', 'en-US'), 'Lead');
  assert.ok(model.term('lead.label', 'ko-KR'));
  assert.equal(model.term('lead.no_such_key', 'en-US'), undefined);
  const codes = model.codeValues('lead_status');
  assert.ok(codes.length > 1);
  assert.deepEqual(codes.map(c => c.order), [...codes.map(c => c.order)].sort((a, b) => a - b));
});

test('fields are found by alias', () => {
  const files = readMetadata().map(f => {
    if (f.path !== 'metadata/objects/lead/fields.json') return f;
    const doc = JSON.parse(f.content);
    doc.fields.find(x => x.key === 'owner_name').aliases = ['owner'];
    return { ...f, content: JSON.stringify(doc) };
  });
  const { model, issues } = loadRuntimeModel(files);
  assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
  assert.equal(model.field('lead', 'owner').key, 'owner_name');
});

test('broken metadata gives issues and no model', () => {
  const files = [...readMetadata(), { path: 'metadata/codes/broken.json', content: '{ not json' }];
  const { model, issues } = loadRuntimeModel(files);
  assert.equal(model, undefined);
  assert.ok(issues.some(i => i.code === 'F03_INVALID_JSON'));
});

test('a reference to an unknown term is a validation error and no model', () => {
  const files = readMetadata().map(f => f.path === 'metadata/objects/lead/object.json'
    ? { ...f, content: JSON.stringify({ ...JSON.parse(f.content), labelKey: 'lead.missing_label' }) } : f);
  const { model, issues } = loadRuntimeModel(files);
  assert.equal(model, undefined);
  assert.ok(issues.some(i => i.severity === 'error'));
});

test('field lookup is per object and code values come back sorted by order', () => {
  const files = readMetadata().map(f => {
    if (f.path !== 'metadata/codes/lead_status.json') return f;
    const doc = JSON.parse(f.content);
    doc.values.reverse();
    return { ...f, content: JSON.stringify(doc) };
  });
  files.push({ path: 'metadata/objects/contact/object.json', content: JSON.stringify({ key: 'contact', labelKey: 'lead.label', pluralLabelKey: 'lead.plural', aliases: [] }) });
  files.push({ path: 'metadata/objects/contact/fields.json', content: JSON.stringify({ fields: [{ key: 'status', type: 'text', labelKey: 'lead.field.status', required: false, system: false, aliases: [] }] }) });
  const { model, issues } = loadRuntimeModel(files);
  assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
  assert.equal(model.field('contact', 'status').type, 'text');
  assert.equal(model.field('lead', 'status').type, 'enum');
  assert.equal(model.field('contact', 'hospital_name'), undefined);
  const orders = model.codeValues('lead_status').map(c => c.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  assert.notDeepEqual(orders, JSON.parse(files.find(f => f.path === 'metadata/codes/lead_status.json').content).values.map(v => v.order));
});
