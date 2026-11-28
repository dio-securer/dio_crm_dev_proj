// loadRuntimeModel against the real metadata/ folder and against broken input.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadRuntimeModel } = require('../dist');

const repo = path.resolve(__dirname, '../../..');
function readMetadata() {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel); else out.push({ path: rel, content: fs.readFileSync(path.join(repo, rel), 'utf8') });
    }
  };
  walk('metadata');
  return out;
}

test('the real metadata/ loads into a model with no errors', () => {
  const { model, issues } = loadRuntimeModel(readMetadata());
  assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
  assert.ok(model);
  assert.ok(model.objectKeys().includes('lead'));
  assert.equal(model.field('lead', 'status').enumCodeGroup, 'lead_status');
  assert.equal(model.field('lead', 'no_such_field'), undefined);
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
