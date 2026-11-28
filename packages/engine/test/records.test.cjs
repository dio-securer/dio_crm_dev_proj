// Write checks of the automatic API (F2-4): field types, required, system and read-only fields, aliases, owner default.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRuntimeModel, validateWrite, readOnlyFields, withOwnerDefault } = require('../dist');
const { readMetadata, editJson } = require('./metadata-files.cjs');

const FIELDS = 'metadata/objects/lead/fields.json';
const extra = (key, type, more = {}) => ({ aliases: [], key, labelKey: 'lead.field.phone', required: false, system: false, type, ...more });
function model(edit) {
  let files = editJson(readMetadata(), FIELDS, d => {
    d.fields.push(extra('visits', 'integer'), extra('amount', 'decimal', { precision: 5, scale: 2 }), extra('vip', 'boolean'),
      extra('opened_on', 'date'), extra('met_at', 'datetime'), extra('account_ref', 'reference', { referenceObject: 'lead' }), extra('memo', 'text', { maxLength: 5 }),
      extra('legacy_no', 'text', { aliases: ['old_no'] }), extra('sync_key', 'text', { system: true }));
  });
  if (edit) files = edit(files);
  const loaded = loadRuntimeModel(files);
  assert.deepEqual(loaded.issues.filter(i => i.severity === 'error'), []);
  return loaded.model;
}
const m = model();
const base = { hospital_name: 'H1', status: 'NEW' };
const errorsOf = (input, mode = 'create') => { const r = validateWrite(m, 'lead', input, mode); return r.ok ? [] : r.errors; };
const codes = (input, mode) => errorsOf(input, mode).map(e => `${e.code}:${e.field ?? ''}`);

test('a valid create returns the values by field key', () => {
  const r = validateWrite(m, 'lead', { ...base, phone: null, visits: 3, amount: 12.5, vip: true, opened_on: '2026-02-28', met_at: '2026-01-02T03:04:05+09:00' }, 'create');
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { ...base, phone: null, visits: 3, amount: 12.5, vip: true, opened_on: '2026-02-28', met_at: '2026-01-01T18:04:05.000Z' });
});

test('required fields are needed on create, may be left out on update, and may not be blanked', () => {
  assert.deepEqual(codes({}), ['REQUIRED:hospital_name', 'REQUIRED:status']);
  assert.deepEqual(codes({ ...base, hospital_name: '' }), ['REQUIRED:hospital_name']);
  assert.deepEqual(codes({ phone: '1' }, 'update'), []);
  assert.deepEqual(codes({ status: null }, 'update'), ['REQUIRED:status']);
  assert.deepEqual(codes({}, 'update'), ['EMPTY:']);
});

test('system and read-only fields cannot be written', () => {
  assert.deepEqual([...readOnlyFields(m, 'lead')], ['updated_at']);
  assert.deepEqual(codes({ ...base, updated_at: '2026-01-01T00:00:00Z' }), ['SYSTEM_FIELD:updated_at']);
  assert.deepEqual(codes({ sync_key: 'x' }, 'update'), ['SYSTEM_FIELD:sync_key']);
  const ro = model(files => editJson(files, 'metadata/objects/lead/screens/detail.json', d => { d.fields.fields.find(f => f.key === 'phone').readOnly = true; }));
  const r = validateWrite(ro, 'lead', { phone: '010' }, 'update');
  assert.deepEqual(r.errors, [{ code: 'READ_ONLY_FIELD', field: 'phone' }]);
  assert.equal(validateWrite(ro, 'lead', { phone: null }, 'update').ok, false, 'a read-only field cannot be cleared either');
});

test('unknown fields, prototype keys and duplicated aliases are refused', () => {
  assert.deepEqual(codes({ ...base, nope: 1 }), ['UNKNOWN_FIELD:nope']);
  assert.deepEqual(codes(JSON.parse('{"__proto__": {"x": 1}, "constructor": 1}'), 'update'), ['UNKNOWN_FIELD:__proto__', 'UNKNOWN_FIELD:constructor']);
  assert.deepEqual(validateWrite(m, 'lead', { old_no: 'A' }, 'update').values, { legacy_no: 'A' });
  assert.deepEqual(codes({ old_no: 'A', legacy_no: 'B' }, 'update'), ['DUPLICATE_FIELD:legacy_no']);
});

test('a body that is not a plain object, or an unknown object, is refused', () => {
  for (const body of [null, [], 'x', 3, new Date()]) assert.deepEqual(codes(body), ['NOT_OBJECT:']);
  assert.equal(validateWrite(m, 'no_such', base, 'create').ok, false);
});

const table = [
  ['visits', 1.5, 'TYPE'], ['visits', '3', 'TYPE'], ['visits', 2 ** 60, 'TYPE'],
  ['amount', 1000, 'OUT_OF_RANGE'], ['amount', 1.234, 'OUT_OF_RANGE'], ['amount', Infinity, 'TYPE'], ['amount', '1', 'TYPE'],
  ['vip', 'true', 'TYPE'], ['vip', 1, 'TYPE'],
  ['opened_on', '2026-02-30', 'TYPE'], ['opened_on', '2026-2-3', 'TYPE'], ['opened_on', '2026-02-03T00:00:00Z', 'TYPE'],
  ['opened_on', '0000-01-01', 'TYPE'], ['met_at', '0000-06-01T00:00:00Z', 'TYPE'], ['met_at', '0001-01-01T00:00:00+01:00', 'TYPE'], ['met_at', '9999-12-31T23:59:59-01:00', 'TYPE'],
  ['met_at', '2026-01-02T03:04:05', 'TYPE'], ['met_at', '2026-01-02T25:00:00Z', 'TYPE'], ['met_at', 1700000000000, 'TYPE'],
  ['status', 'WON', 'BAD_ENUM'], ['status', 1, 'TYPE'],
  ['account_ref', 'x'.repeat(101), 'TOO_LONG'], ['memo', '123456', 'TOO_LONG'], ['phone', 10, 'TYPE'],
  ['phone', 'x'.repeat(4001), 'TOO_LONG'], ['phone', { a: 1 }, 'TYPE'],
];
for (const [field, value, code] of table) {
  test(`${field} = ${JSON.stringify(value)?.slice(0, 30)} is refused with ${code}`, () => {
    assert.deepEqual(errorsOf({ [field]: value }, 'update'), [{ code, field }]);
  });
}

test('values at the edges are accepted', () => {
  const ok = { amount: 999.99, visits: Number.MAX_SAFE_INTEGER, memo: '12345', account_ref: 'a', opened_on: '2024-02-29', met_at: '2026-01-02T03:04Z' };
  assert.equal(validateWrite(m, 'lead', ok, 'update').ok, true);
});

test('dates and date-times of any year from 0001 to 9999 are accepted, with exact milliseconds', () => {
  const r = validateWrite(m, 'lead', { opened_on: '0001-01-01', met_at: '1000-01-01T00:00:00.001Z' }, 'update');
  assert.deepEqual(r.values, { opened_on: '0001-01-01', met_at: '1000-01-01T00:00:00.001Z' });
  assert.deepEqual(validateWrite(m, 'lead', { opened_on: '0099-12-31', met_at: '9999-12-31T23:59:59.999Z' }, 'update').values, { opened_on: '0099-12-31', met_at: '9999-12-31T23:59:59.999Z' });
});

test('an inactive code is refused', () => {
  const off = model(files => editJson(files, 'metadata/codes/lead_status.json', d => { d.values.find(v => v.code === 'CONVERTED').active = false; }));
  assert.deepEqual(validateWrite(off, 'lead', { status: 'CONVERTED' }, 'update').errors, [{ code: 'BAD_ENUM', field: 'status' }]);
});

test('every error is reported, not only the first', () => {
  assert.deepEqual(codes({ nope: 1, updated_at: 'x', visits: 'y' }), ['UNKNOWN_FIELD:nope', 'SYSTEM_FIELD:updated_at', 'TYPE:visits', 'REQUIRED:hospital_name', 'REQUIRED:status']);
});

test('the owner default fills an applicable own rule only when the owner was not sent', () => {
  const actor = { userId: 'u1', permissions: [] };
  const own = [{ kind: 'own', ownerField: 'owner_name' }];
  assert.deepEqual(withOwnerDefault(own, actor, { a: 1 }), { a: 1, owner_name: 'u1' });
  assert.deepEqual(withOwnerDefault(own, actor, { owner_name: 'u2' }), { owner_name: 'u2' });
  assert.deepEqual(withOwnerDefault(own, actor, { owner_name: null }), { owner_name: 'u1' }, 'an owner sent as null (or blank, which is null by then) is filled too');
  assert.deepEqual(withOwnerDefault([{ kind: 'own', ownerField: 'owner_name', permission: 'p' }], actor, {}), {});
  assert.deepEqual(withOwnerDefault([{ kind: 'members', ownerField: 'owner_name' }], actor, {}), {});
});
