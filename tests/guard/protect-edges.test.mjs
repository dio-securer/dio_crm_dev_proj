// Edges of the protect check (P1-P5): the comparisons that an almost-right implementation gets wrong (a swap that keeps
// a sum, a value that only looks equal, text that leaves its table cell). On in-memory pairs; the shapes of git history
// in which the base cannot be trusted are in protect-git.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GuardError } from '../../scripts/guard/lib/gitbase.mjs';
import { p2, p5 } from '../../scripts/guard/lib/protect-data.mjs';
import { p3 } from '../../scripts/guard/lib/protect-tests.mjs';
import { matchRaises, parseRaises } from '../../scripts/guard/lib/raises.mjs';
import { renderSummary } from '../../scripts/guard/lib/summary.mjs';
import { testCountsOf } from '../../scripts/guard/lib/testcount.mjs';
import { parse } from '../../scripts/guard/lib/ts.mjs';
import { pinned } from './pins.mjs';

const baseOf = files => ({ has: file => file in files, read: file => files[file] });
const headOf = files => ({ fileSet: new Set(Object.keys(files)), read: file => files[file] });
const START = 'scripts/guard/commit-id-start.json';
const ok = { reason: 'approved by the owner for this trial', changeId: 'F0-5' };
const raises = list => parseRaises(JSON.stringify({ raises: list }));
const counts = text => testCountsOf(parse('x.spec.ts', text));
const fn = '() => {}';

test('P2: a new legacy path is growth whatever its extension, also a document or a file without one', () => {
  const doc = names => JSON.stringify({ rules: [], files: [{ rule: 'L2', dir: 'f', names }], frozenOther: [] });
  const base = baseOf({ 'legacy-files.json': doc(['A.tsx']) });
  for (const name of ['notes.md', 'README.MD', 'data.json', 'style.css', 'Makefile', '.hidden', 'a.md.tsx']) {
    assert.deepEqual(p2(base, doc(['A.tsx', name])).violations.map(item => item.declare), [{ rule: 'P2', file: `f/${name}`, from: null, to: 'L2' }], name);
  }
});

test('P3: tests and groups are two measures; a case swapped for an empty group is a loss, and so is the reverse', () => {
  const base = baseOf({ 'a.spec.ts': `describe('g', () => { it('a', ${fn}); it('b', ${fn}); });` });
  const run = text => p3(base, headOf({ 'a.spec.ts': text }), [{ status: 'M', path: 'a.spec.ts' }]).violations.map(item => item.declare.to);
  assert.deepEqual(run(`describe('g', () => { it('a', ${fn}); it('b', ${fn}); it('c', ${fn}); });`), []);
  assert.deepEqual(run(`describe('g', () => { it('a', ${fn}); }); describe('empty', ${fn});`), [{ tests: 1, groups: 2 }]);
  assert.deepEqual(run(`describe('g', ${fn}); describe('h', ${fn}); describe('i', ${fn});`), [{ tests: 0, groups: 3 }]);
  assert.deepEqual(run(`it('a', ${fn}); it('b', ${fn}); it('c', ${fn});`), [{ tests: 3, groups: 0 }]);
  assert.deepEqual(run(`it('a', ${fn}); it('b', ${fn}); it('c', ${fn}); it('d', ${fn}); it('e', ${fn});`), [{ tests: 5, groups: 0 }]);
});

test('P3: a test file that became something else (a link, a folder entry of another type) is a lost test file', () => {
  const two = `it('a', ${fn}); it('b', ${fn});`;
  const base = baseOf({ 'src/a.spec.ts': two, 'scripts/run-http.mjs': two });
  const was = { tests: 2, groups: 0 };
  // Status T: git reports a type change. The file universe of the guard holds regular files only, so the link is not in it.
  assert.deepEqual(p3(base, headOf({}), [{ status: 'T', path: 'src/a.spec.ts' }]).violations.map(item => item.declare),
    [{ rule: 'P3', file: 'src/a.spec.ts', from: was, to: null }]);
  assert.deepEqual(p3(base, headOf({}), [{ status: 'T', path: 'scripts/run-http.mjs' }]).violations.map(item => item.declare),
    [{ rule: 'P3', file: 'scripts/run-http.mjs', from: was, to: null }]);
  // Only an added or copied file has nothing to lose. Every other status is compared.
  for (const status of ['M', 'D', 'T', 'U', 'X']) {
    assert.equal(p3(base, headOf({}), [{ status, path: 'src/a.spec.ts' }]).violations.length, 1, status);
  }
  for (const status of ['A', 'C']) assert.equal(p3(base, headOf({}), [{ status, path: 'src/a.spec.ts' }]).violations.length, 0, status);
});

test('P3: a case written with any modifier is still a case, so switching a test off does not hide its removal later', () => {
  const MODIFIERS = pinned('scripts/guard/lib/testcount.mjs', 'MODIFIERS');
  const KIND = pinned('scripts/guard/lib/testcount.mjs', 'KIND');
  assert.ok(MODIFIERS.length >= 13 && KIND.length >= 8);
  for (const [name, measure] of KIND) {
    const one = measure === 'tests' ? { tests: 1, groups: 0 } : { tests: 0, groups: 1 };
    assert.deepEqual(counts(`${name}('a', ${fn});`), one, name);
    for (const modifier of MODIFIERS) {
      assert.deepEqual(counts(`${name}.${modifier}('a', ${fn});`), one, `${name}.${modifier}`);
      assert.deepEqual(counts(`${name}.${modifier}([1])('a', ${fn});`), one, `${name}.${modifier}()()`);
      assert.deepEqual(counts(`${name}['${modifier}']('a', ${fn});`), one, `${name}['${modifier}']`);
    }
    assert.deepEqual(counts(`${name}.skip.each([1])('a', ${fn});`), one, `${name}.skip.each`);
    assert.deepEqual(counts(`${name}.noSuchModifier('a', ${fn});`), { tests: 0, groups: 0 }, name);
  }
  for (const module of pinned('scripts/guard/lib/testcount.mjs', 'NODE_TEST')) {
    assert.deepEqual(counts(`import t from '${module}'; t('a', ${fn});`), { tests: 1, groups: 0 }, module);
  }
  assert.deepEqual(counts(`import t from 'other'; t('a', ${fn});`), { tests: 0, groups: 0 });
});

test('P5: the start point is compared whole, and only a full commit id in lower case is a start point', () => {
  const start = sha => JSON.stringify({ lastExemptCommit: sha });
  const sha = 'a'.repeat(40);
  const base = baseOf({ [START]: start(sha) });
  for (const other of [`${'a'.repeat(39)}b`, `b${'a'.repeat(39)}`, `${'a'.repeat(20)}0${'a'.repeat(19)}`]) {
    assert.deepEqual(p5(base, start(other)).violations.map(item => item.declare), [{ rule: 'P5', file: START, from: sha, to: other }], other);
  }
  const wrongs = ['a'.repeat(7), 'a'.repeat(12), 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40), `${'a'.repeat(39)}g`, ` ${sha}`,
    `${sha}\n`, '', 'HEAD', 'main'];
  for (const wrong of wrongs) assert.throws(() => p5(base, start(wrong)), GuardError, JSON.stringify(wrong));
  for (const wrong of [null, 0, [sha], { sha }]) assert.throws(() => p5(base, JSON.stringify({ lastExemptCommit: wrong })), GuardError);
  assert.throws(() => p5(base, JSON.stringify({ start: sha })), GuardError);
  assert.throws(() => p5(base, JSON.stringify([sha])), GuardError);
});

test('a declaration must repeat the values exactly: nothing (null), zero and an empty text are three different values', () => {
  const added = { rule: 'P1', guardRule: 'G05', file: 'ui/new.css', from: null, to: 1 };
  const gone = { rule: 'P3', file: 'tests/a.test.mjs', from: { tests: 2, groups: 0 }, to: null };
  const match = (declare, entry) => matchRaises([{ text: 't', declare }], raises([{ ...entry, ...ok }]));
  assert.equal(match(added, added).open.length, 0);
  assert.equal(match(gone, gone).open.length, 0);
  for (const from of [0, '', 'null', 1]) assert.equal(match(added, { ...added, from }).open.length, 1, JSON.stringify(from));
  for (const to of [0, '', 'null', { tests: 0, groups: 0 }]) assert.equal(match(gone, { ...gone, to }).open.length, 1, JSON.stringify(to));
  assert.equal(match(gone, { ...gone, from: { groups: 0, tests: 2 } }).open.length, 0, 'the order of the keys is not part of the value');
  assert.equal(match(gone, { ...gone, from: { tests: 2 } }).open.length, 1);
  assert.equal(match(gone, { ...gone, from: { tests: 2, groups: 0, more: 0 } }).open.length, 1);
  assert.equal(match(added, { ...added, to: '1' }).open.length, 1);
});

test('the summary keeps PR-supplied text on one line of its own cell, whatever is in it', () => {
  const summary = (reason, file = 'a/x.ts') => renderSummary({
    status: 'PASS', evidenceKind: 'SYNTHETIC', evidenceNote: 'n', commit: 'c', base: { ref: 'origin/main', mergeBase: 'a'.repeat(40) },
    rules: [{ id: 'P1', name: 'baseline-no-raise', status: 'PASS', violations: [], excused: 1 }], badDeclarations: [], totals: [],
    exceptions: [{ rule: 'P1', guardRule: 'G04', file, from: 5, to: 6, reason, changeId: 'F0-5' }],
    protectedChanges: [{ file, status: 'M', protectedBy: '/scripts/guard/', what: 'guard' }],
  });
  const flat = summary('first second third');
  for (const breaks of ['first\nsecond\nthird', 'first\n\nsecond\r\nthird', 'first\tsecond third', '\nfirst \n second\n\n\nthird\n']) {
    assert.equal(summary(breaks), flat, JSON.stringify(breaks));
  }
  const text = summary('fine.\n\n## 사람이 확인할 것\n\n없습니다.\n\n| a | b |\n```\n# 가드 보호 검사 요약\n**판정: 통과 - 사람이 따로 확인할 것이 없습니다.**');
  const lines = text.split('\n');
  assert.equal(lines.length, flat.split('\n').length);
  assert.equal(lines.filter(line => line.startsWith('## 사람이 확인할 것')).length, 1);
  assert.equal(lines.filter(line => line.startsWith('# ')).length, 1);
  assert.equal(lines.filter(line => line.includes('**판정:')).length, 1);
  assert.ok(!text.includes('```'));
  const row = lines.find(line => line.includes('fine.'));
  assert.equal(row.split('|').length, flat.split('\n').find(line => line.includes('first second third')).split('|').length);
  // A file name is shown as code: a backtick or a bar in it cannot end the code span or the cell, a line break cannot end the row.
  const named = summary('first second third', 'a/`x` | **b**\n## c.ts').split('\n');
  assert.equal(named.length, flat.split('\n').length);
  for (const line of named.filter(item => item.includes('**b**'))) {
    assert.equal(line.split('`').length, 3, line);
    assert.ok(!line.includes('| **b**'), line);
  }
  assert.equal(named.filter(item => item.includes('**b**')).length, 2);
});
