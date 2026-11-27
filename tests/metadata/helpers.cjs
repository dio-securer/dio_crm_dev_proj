// Shared helpers for the metamodel tests.
const assert = require('node:assert/strict');
const m = require('../../packages/contracts/dist/metadata');
const { bundle } = require('./fixture.cjs');

/** A fresh fixture changed by `edit`. */
function variant(edit) { const b = bundle(); edit(b); return b; }
const obj = (b, key) => b.objects.find(o => o.object.key === key);
const field = (b, entity, key) => obj(b, entity).object.fields.find(f => f.key === key);

/** Asserts that the bundle reports `code` at exactly `path` (and at least one issue at all). */
function expectIssue(input, code, path) {
  const issues = m.validateBundle(input);
  const hit = issues.find(i => i.code === code && i.path === path);
  assert.ok(hit, `expected ${code} at ${path}, got:\n${issues.map(i => `${i.code} ${i.path}`).join('\n')}`);
  assert.equal(typeof hit.message, 'string');
  assert.ok(hit.message.length > 0);
  return issues;
}
function expectClean(input) {
  const issues = m.validateBundle(input);
  assert.deepEqual(issues.map(i => `${i.code} ${i.path}`), []);
}
module.exports = { m, bundle, variant, obj, field, expectIssue, expectClean, assert };
