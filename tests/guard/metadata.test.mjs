// G12 (metadata/ must pass the metamodel validator) and P6 (no backward-incompatible metadata change vs the base),
// run through the real runner in a sandbox that holds a copy of the repository's validator and of its lead metadata.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { VALIDATOR_FILES, makeSandbox, root } from './sandbox.mjs';

function filesUnder(dir) {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const next = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(root, next), 'utf8');
    }
  };
  walk(dir);
  return out;
}
const LEAD = filesUnder('metadata');
const FIELDS = 'metadata/objects/lead/fields.json';
const VIEWS = 'metadata/objects/lead/list-views.json';
const KO = 'metadata/terms/ko-KR/lead.json';
const json = text => JSON.parse(text);
const dump = value => `${JSON.stringify(value, null, 2)}\n`;

function sandbox(withMetadata = true) {
  return makeSandbox({ files: withMetadata ? LEAD : {} });
}
const g12 = box => box.result().rules.find(rule => rule.id === 'G12');
const messages = box => g12(box).newViolations.flatMap(item => item.locations.map(spot => `${item.file} ${spot.message}`)).join('\n');
const p6 = box => box.result('protect-result.json').rules.find(rule => rule.id === 'P6');
const editJson = (box, file, change) => { const value = json(box.read(file)); change(value); box.write({ [file]: dump(value) }); };

const box = sandbox();

test('G12 passes on the lead metadata as committed', () => {
  box.reset();
  box.guard();
  assert.equal(g12(box).status, 'PASS', messages(box));
});

const defects = [
  ['an unknown file', b => b.write({ 'metadata/objects/lead/notes.json': '{}\n' }), /F01_UNKNOWN_FILE/],
  ['a field of an unknown type', b => editJson(b, FIELDS, v => { v.fields[0].type = 'blob'; }), /M01_SCHEMA_INVALID/],
  ['a list-view column that is not a field', b => editJson(b, VIEWS, v => { v.views[0].columns.push('hospital_nam'); }), /R02/],
  ['a label with no Korean translation', b => editJson(b, KO, v => { delete v['lead.field.phone']; }), /R04/],
  ['an enum on a missing code group', b => editJson(b, FIELDS, v => { v.fields.find(f => f.key === 'status').enumCodeGroup = 'nope'; }), /R05/],
];
for (const [what, apply, code] of defects) {
  test(`G12 fails on ${what}`, () => {
    box.reset();
    apply(box);
    const run = box.guard();
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.equal(g12(box).status, 'FAIL');
    assert.match(messages(box), code);
    assert.match(run.stdout, /G12 metadata-valid\s+FAIL/);
  });
}

test('a file that is not JSON is reported once, by G01, and G12 does not report it again', () => {
  box.reset();
  box.write({ [FIELDS]: '{ "fields": [\n' });
  assert.equal(box.guard().status, 1);
  const g01 = box.result().rules.find(rule => rule.id === 'G01');
  assert.deepEqual(g01.newViolations.map(item => item.file), [FIELDS]);
  assert.ok(!g12(box).newViolations.some(item => item.file === FIELDS), messages(box));
});

test('G12 is an ERROR (exit 2), never a pass, when the validator is missing', () => {
  box.reset();
  box.remove('packages/contracts/src/metadata');
  const run = box.guard();
  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.equal(g12(box).status, 'ERROR');
  box.write(VALIDATOR_FILES);
});

test('P6 fails when a field is removed without being deprecated first, and cannot be declared away', () => {
  box.reset();
  editJson(box, FIELDS, v => { v.fields = v.fields.filter(f => f.key !== 'keyman_major'); });
  const run = box.guard('--protect', box.base);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6(box).status, 'FAIL');
  assert.equal(p6(box).violations[0].declare, null);
  assert.match(p6(box).violations[0].text, /keyman_major/);
});

test('P6 fails when a field changes type outside the safe widenings', () => {
  box.reset();
  editJson(box, FIELDS, v => { v.fields.find(f => f.key === 'updated_at').type = 'text'; });
  assert.equal(box.guard('--protect', box.base).status, 1);
  assert.equal(p6(box).status, 'FAIL');
});

test('P6 passes when a field is only added or deprecated', () => {
  box.reset();
  editJson(box, FIELDS, v => {
    v.fields.push({ aliases: [], key: 'memo', labelKey: 'lead.field.phone', required: false, system: false, type: 'text' });
    v.fields.find(f => f.key === 'keyman_major').deprecated = { since: '2026-11' };
  });
  const run = box.guard('--protect', box.base);
  assert.equal(p6(box).status, 'PASS', JSON.stringify(p6(box)));
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('P6 passes with nothing to compare when the base has no metadata', () => {
  const empty = sandbox(false);
  empty.write(LEAD);
  empty.guard('--protect', empty.base);
  assert.equal(p6(empty).status, 'PASS');
  assert.match(p6(empty).note, /비교할 것이 없습니다/);
});
