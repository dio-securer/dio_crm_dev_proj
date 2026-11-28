// P6 and the security settings (F2-7): a user of an org chart who now sees more people (D07) and a role allowed more
// actions (D08) can be declared one by one in guard-raises.json, matched exactly like a row rule (D05).
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
const ORG = 'metadata/security/org/virtual_domestic_sales.json';
const PROFILES = 'metadata/security/profiles.json';
const box = makeSandbox({ files: filesUnder('metadata') });
const result = () => box.result('protect-result.json');
const p6 = () => result().rules.find(rule => rule.id === 'P6');
const dump = value => `${JSON.stringify(value, null, 2)}\n`;
const editJson = (file, change) => { const value = JSON.parse(box.read(file)); change(value); box.write({ [file]: dump(value) }); };
const declare = (...raises) => box.write({ 'guard-raises.json': dump({ raises }) });
const why = { reason: 'owner approved this widening of access', changeId: 'F2-7' };
const protect = () => box.guard('--protect', box.base);
const chart = () => JSON.parse(box.read(ORG));
/** Move the first member of one branch into another branch; the second branch's head now sees them. */
function moveMember() {
  const c = chart();
  const [a, b] = c.members.map(m => m.unitId).filter((u, i, all) => all.indexOf(u) === i);
  const mover = c.members.find(m => m.unitId === a);
  editJson(ORG, v => { v.members.find(m => m.userId === mover.userId).unitId = b; });
  return mover.userId;
}
const addRole = role => editJson(PROFILES, v => { (Array.isArray(v) ? v : v.profiles ?? v.items)[0].roles.push(role); });

test('the starting metadata passes P6 against itself', () => {
  box.reset();
  const run = protect();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(p6().status, 'PASS');
});

test('an undeclared org chart widening fails P6 and tells exactly what to declare', () => {
  box.reset();
  const mover = moveMember();
  const run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const declares = p6().violations.map(v => v.declare);
  assert.ok(declares.length >= 1);
  for (const d of declares) {
    assert.equal(d.file, ORG);
    assert.equal(d.from, null);
    assert.equal(d.to.kind, 'org-widened');
    assert.ok(d.to.gained.split(', ').includes(mover), JSON.stringify(d));
  }
});

test('the exact org chart declarations excuse it and are shown in the summary', () => {
  box.reset();
  moveMember();
  protect();
  const declares = p6().violations.map(v => v.declare);
  declare(...declares.map(d => ({ ...d, ...why })));
  const run = protect();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(p6().status, 'PASS');
  assert.equal(result().exceptions.length, declares.length);
  assert.match(box.read('.guard/summary.md'), /owner approved this widening of access/);
});

test('an org chart declaration with another gained list, user or file does not excuse it and is reported', () => {
  for (const change of [d => ({ ...d, to: { ...d.to, gained: `${d.to.gained}, someone-else` } }),
    d => ({ ...d, to: { ...d.to, user: 'nobody' } }),
    d => ({ ...d, to: { ...d.to, companyId: '7' } }),
    d => ({ ...d, file: 'metadata/security/org/other_chart.json' })]) {
    box.reset();
    moveMember();
    protect();
    const [first, ...rest] = p6().violations.map(v => v.declare);
    declare(change({ ...first, ...why }), ...rest.map(d => ({ ...d, ...why })));
    const run = protect();
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.equal(p6().status, 'FAIL');
    assert.equal(result().badDeclarations.length, 1);
  }
});

test('an unused org chart declaration fails', () => {
  box.reset();
  declare({ rule: 'P6', file: ORG, from: null, to: { kind: 'org-widened', companyId: '-1', user: 'nobody', gained: 'someone' }, ...why });
  const run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(result().badDeclarations.length, 1);
});

test('a role added to a profile (D08) fails undeclared and passes with the exact declaration', () => {
  box.reset();
  addRole('ANYONE');
  let run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const declares = p6().violations.map(v => v.declare);
  assert.equal(declares.length, 1);
  assert.equal(declares[0].file, PROFILES);
  assert.deepEqual({ kind: declares[0].to.kind, role: declares[0].to.role }, { kind: 'grant-widened', role: 'ANYONE' });
  declare({ ...declares[0], ...why });
  run = protect();
  assert.equal(run.status, 0, run.stdout + run.stderr);
  declare({ ...declares[0], to: { ...declares[0].to, role: 'OTHER' }, ...why });
  run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(result().badDeclarations.length, 1);
});

test('security declarations with a wrong shape are refused as malformed', () => {
  for (const entry of [
    { rule: 'P6', file: ORG, from: null, to: { kind: 'all' }, ...why },
    { rule: 'P6', file: ORG, from: null, to: { kind: 'org-widened', user: 'a' }, ...why },
    { rule: 'P6', file: ORG, from: null, to: { kind: 'org-widened', user: 'a', gained: 'b' }, ...why },
    { rule: 'P6', file: ORG, from: null, to: { kind: 'org-widened', companyId: 'x', user: 'a', gained: 'b' }, ...why },
    { rule: 'P6', file: ORG, from: null, to: { kind: 'org-widened', companyId: '-1', user: 'a', gained: 'b', extra: 'c' }, ...why },
    { rule: 'P6', file: ORG, from: 'x', to: { kind: 'org-widened', companyId: '-1', user: 'a', gained: 'b' }, ...why },
    { rule: 'P6', file: PROFILES, from: null, to: { kind: 'org-widened', user: 'a', gained: 'b' }, ...why },
    { rule: 'P6', file: 'metadata/objects/lead/access.json', from: null, to: { kind: 'grant-widened', role: 'a', gained: 'b' }, ...why },
    { rule: 'P6', file: 'metadata/security/permission-sets.json', from: null, to: { kind: 'grant-widened', role: 'a', gained: 'b' }, ...why },
  ]) {
    box.reset();
    declare(entry);
    const run = protect();
    assert.equal(run.status, 2, JSON.stringify(entry) + run.stdout + run.stderr);
    assert.match(run.stdout + run.stderr, /P6 은 권한 넓히기만 선언합니다/);
  }
});

test('a user id with a bracket cannot make a declaration name fewer people: the chart is refused as unreadable', () => {
  box.reset();
  // The probe: a member whose id would end the bracketed list of a message, so a text-derived declaration named only part.
  editJson(ORG, v => { const unit = v.members[0].unitId; v.members.push({ userId: 'zz(evil', unitId: unit }); });
  let run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  assert.deepEqual(p6().violations.map(v => v.declare), [null]);
  declare({ rule: 'P6', file: ORG, from: null, to: { kind: 'org-widened', companyId: '-1', user: 'x', gained: 'evil' }, ...why });
  run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
});

test('a chart moved to another company is not excused by the declarations of its old company', () => {
  box.reset();
  const old = Object.entries(JSON.parse(fs.readFileSync(path.join(root, 'guard-raises.json'), 'utf8')).raises)
    .map(([, entry]) => entry).filter(entry => entry.file === ORG);
  assert.equal(old.length, 7);
  editJson(ORG, v => { v.companyId = 7; });
  declare(...old);
  const run = protect();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  for (const d of p6().violations.map(v => v.declare)) assert.equal(d.to.companyId, '7');
  assert.equal(result().badDeclarations.length, 7);
});
