// Row access rules read from metadata/objects/<o>/access.json into the runtime model and used by the evaluator.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRuntimeModel, filterRows, accessPredicate } = require('../dist');
const { readMetadata, editJson } = require('./metadata-files.cjs');

const ACCESS = 'metadata/objects/lead/access.json';
const rows = [{ id: 1, owner_name: 'u1' }, { id: 2, owner_name: 'u2' }, { id: 3, owner_name: 'u3' }];

test('the lead rules of access.json reach the evaluator', () => {
  const { model, issues } = loadRuntimeModel(readMetadata());
  assert.deepEqual(issues.filter(i => i.severity === 'error'), []);
  assert.deepEqual(model.rowAccess('lead'), [{ kind: 'own', ownerField: 'owner_name' }, { kind: 'members', ownerField: 'owner_name' }]);
  const rules = model.rowAccess('lead');
  assert.deepEqual(filterRows(rules, { userId: 'u1', permissions: [] }, rows).map(r => r.id), [1]);
  assert.deepEqual(filterRows(rules, { userId: 'u1', memberIds: ['u3'], permissions: [] }, rows).map(r => r.id), [1, 3]);
});

test('an object without access.json has no rules, so every row is denied', () => {
  const files = readMetadata().filter(f => f.path !== ACCESS);
  const { model } = loadRuntimeModel(files);
  assert.deepEqual(model.rowAccess('lead'), []);
  assert.deepEqual(model.rowAccess('no_such'), []);
  assert.deepEqual(accessPredicate(model.rowAccess('lead'), { userId: 'u1', permissions: [] }), { kind: 'none' });
});

test('a rule naming a field alias is read by the field key', () => {
  let files = editJson(readMetadata(), 'metadata/objects/lead/fields.json', d => { d.fields.find(x => x.key === 'owner_name').aliases = ['owner']; });
  files = editJson(files, ACCESS, d => { d.rules = [{ kind: 'own', ownerField: 'owner' }]; });
  const { model, issues } = loadRuntimeModel(files);
  assert.ok(issues.some(i => i.code === 'R09_ALIAS_USE'));
  assert.deepEqual(model.rowAccess('lead'), [{ kind: 'own', ownerField: 'owner_name' }]);
});

test('a rule naming an unknown field or permission stops the model', () => {
  for (const [rule, code] of [[{ kind: 'own', ownerField: 'no_such' }, 'R02_UNKNOWN_FIELD'], [{ kind: 'all', permission: 'lead.no_such' }, 'R07_UNKNOWN_PERMISSION']]) {
    const { model, issues } = loadRuntimeModel(editJson(readMetadata(), ACCESS, d => { d.rules = [rule]; }));
    assert.equal(model, undefined);
    assert.ok(issues.some(i => i.code === code), code);
  }
});
