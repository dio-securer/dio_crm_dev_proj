// P6 and row access (ADR 0007): a widening (D05) can be declared rule by rule in guard-raises.json, matched exactly,
// and shown in the summary. Nothing else in P6 (removed fields, type changes, unreadable metadata) can be declared.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { makeSandbox, root } from './sandbox.mjs';

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
const ACCESS = 'metadata/objects/lead/access.json';
const FIELDS = 'metadata/objects/lead/fields.json';
const box = makeSandbox({ files: filesUnder('metadata') });
const p6 = () => box.result('protect-result.json').rules.find(rule => rule.id === 'P6');
const dump = value => `${JSON.stringify(value, null, 2)}\n`;
const editJson = (file, change) => { const value = JSON.parse(box.read(file)); change(value); box.write({ [file]: dump(value) }); };
const declare = (...raises) => box.write({ 'guard-raises.json': dump({ raises }) });
const why = { reason: 'owner approved opening lead rows', changeId: 'F2-2' };
const ALL = { kind: 'all' };
const protect = () => box.guard('--protect', box.base);
const widen = () => editJson(ACCESS, v => { v.rules = [ALL]; });

test('a widening fails P6 and tells exactly what to declare', () => {
  box.reset();
  widen();
  const run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  assert.deepEqual(p6().violations.map(v => v.declare), [{ rule: 'P6', file: ACCESS, from: null, to: ALL }]);
});

test('the exact declaration excuses it and is shown verbatim in the summary', () => {
  box.reset();
  widen();
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  const run = protect();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(p6().status, 'PASS');
  assert.deepEqual(box.result('protect-result.json').exceptions, [{ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why }]);
  const summary = box.read('.guard/summary.md');
  assert.match(summary, /예외 선언 1건/);
  assert.match(summary, /행 권한을 넓힘/);
  assert.match(summary, /owner approved opening lead rows/);
});

const near = [
  ['another rule', { rule: 'P6', file: ACCESS, from: null, to: { kind: 'all', permission: 'company.manage' }, ...why }],
  ['another object', { rule: 'P6', file: 'metadata/objects/account/access.json', from: null, to: ALL, ...why }],
];
for (const [what, entry] of near) {
  test(`a declaration naming ${what} does not excuse it and is itself reported`, () => {
    box.reset();
    widen();
    declare(entry);
    const run = protect();
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.equal(p6().status, 'FAIL');
    assert.equal(box.result('protect-result.json').badDeclarations.length, 1);
  });
}

test('a P6 declaration with a value in from, or a file that is not access.json, is refused as malformed', () => {
  for (const entry of [{ rule: 'P6', file: ACCESS, from: { kind: 'own', ownerField: 'owner_name' }, to: ALL, ...why },
    { rule: 'P6', file: FIELDS, from: null, to: ALL, ...why }, { rule: 'P6', file: ACCESS, from: null, to: 'all', ...why }]) {
    box.reset();
    widen();
    declare(entry);
    const run = protect();
    assert.equal(run.status, 2, JSON.stringify(entry) + run.stdout + run.stderr);
    assert.match(run.stdout + run.stderr, /P6 은 행 권한 넓히기\(D05\)만 선언합니다/);
  }
});

test('a removed field (D01) cannot be excused by a P6 declaration', () => {
  box.reset();
  editJson(FIELDS, v => { v.fields = v.fields.filter(f => f.key !== 'keyman_major'); });
  declare({ rule: 'P6', file: ACCESS, from: null, to: { kind: 'own', ownerField: 'owner_name' }, ...why });
  assert.equal(protect().status, 1);
  assert.equal(p6().violations[0].declare, null);
});

test('a type change (D03) cannot be excused by a P6 declaration', () => {
  box.reset();
  editJson(FIELDS, v => { v.fields.find(f => f.key === 'updated_at').type = 'text'; });
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  assert.equal(protect().status, 1);
  assert.ok(p6().violations.every(v => v.declare === null));
});

test('unreadable metadata cannot be excused by a P6 declaration', () => {
  box.reset();
  box.write({ [FIELDS]: '{ "fields": [\n' });
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  assert.equal(protect().status, 1);
  assert.equal(p6().status, 'FAIL');
  assert.equal(p6().violations[0].declare, null);
});

test('a rename without an alias (D02) cannot be excused by a P6 declaration', () => {
  box.reset();
  editJson(FIELDS, v => { v.fields.find(f => f.key === 'keyman_major').key = 'keyman_field'; });
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  assert.equal(protect().status, 1);
  assert.ok(p6().violations.some(v => /D02_RENAMED_WITHOUT_ALIAS/.test(v.text)));
  assert.ok(p6().violations.every(v => v.declare === null));
});

test('the declaration must repeat the whole rule, field included', () => {
  const UNIT = { kind: 'unit', unitField: 'sido' };
  box.reset();
  editJson(ACCESS, v => { v.rules.push(UNIT); });
  declare({ rule: 'P6', file: ACCESS, from: null, to: { kind: 'unit' }, ...why });
  assert.equal(protect().status, 1);
  declare({ rule: 'P6', file: ACCESS, from: null, to: { kind: 'unit', unitField: 'sigungu' }, ...why });
  assert.equal(protect().status, 1);
  declare({ rule: 'P6', file: ACCESS, from: null, to: UNIT, ...why });
  const run = protect();
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('the declared file names the object that was widened', () => {
  box.reset();
  const contact = 'metadata/objects/contact';
  box.write({ [`${contact}/object.json`]: dump({ aliases: [], key: 'contact', labelKey: 'lead.label', pluralLabelKey: 'lead.plural' }),
    [`${contact}/fields.json`]: dump({ fields: [{ aliases: [], key: 'owner', labelKey: 'lead.field.phone', required: false, system: false, type: 'text' }] }),
  });
  box.git('add', '-A');
  const withContact = box.commit('[F2-3] contact without access');
  box.write({ [`${contact}/access.json`]: dump({ entity: 'contact', rules: [ALL] }) });
  declare({ rule: 'P6', file: `${contact}/access.json`, from: null, to: ALL, ...why });
  const run = box.guard('--protect', withContact);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  assert.equal(box.guard('--protect', withContact).status, 1);
});

test('a declaration whose widening is already in the base is reported as already merged', () => {
  box.reset();
  widen();
  box.git('add', '-A');
  const merged = box.commit('[F2-3] lead rows opened');
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  const run = box.guard('--protect', merged);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const [bad] = box.result('protect-result.json').badDeclarations;
  assert.match(bad.why, /이미 기준 브랜치에 반영된 선언/);
  assert.match(run.stdout, /이미 기준 브랜치에 반영된 선언/);
});

test('a declaration with no change and no rule in the base is reported as unused, not as merged', () => {
  box.reset();
  declare({ rule: 'P6', file: ACCESS, from: null, to: ALL, ...why });
  const run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(box.result('protect-result.json').badDeclarations[0].why, /해당하는 변경이 없습니다/);
});
