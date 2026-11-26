// Tests of the protect checks (P1-P5) and their declaration matching, on in-memory base/head pairs (no git needed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBaseline } from '../../scripts/guard/lib/baseline.mjs';
import { parseProtected, protectedEntry, renderCodeowners } from '../../scripts/guard/lib/codeowners.mjs';
import { GuardError } from '../../scripts/guard/lib/gitbase.mjs';
import { p1, p2, p5 } from '../../scripts/guard/lib/protect-data.mjs';
import { p3 } from '../../scripts/guard/lib/protect-tests.mjs';
import { matchRaises, parseRaises } from '../../scripts/guard/lib/raises.mjs';
import { renderSummary } from '../../scripts/guard/lib/summary.mjs';
import { testCountsOf } from '../../scripts/guard/lib/testcount.mjs';
import { parse } from '../../scripts/guard/lib/ts.mjs';

const baseOf = files => ({ has: file => file in files, read: file => files[file] });
const baseline = rules => JSON.stringify({ rules });
const START = 'scripts/guard/commit-id-start.json';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const ok = { reason: '사람이 허락한 변경입니다 (테스트)', changeId: 'F0-3' };
const raises = list => parseRaises(JSON.stringify({ raises: list }));
const counts = text => testCountsOf(parse('x.spec.ts', text));

test('P1 passes when nothing went up and reports a lowered count as a pass', () => {
  const before = baseline({ G04: { total: 5, files: { a: { 'x.ts': 5 } } } });
  assert.equal(p1(baseOf({ 'guard-baseline.json': before }), before).status, 'PASS');
  assert.equal(p1(baseOf({ 'guard-baseline.json': before }), baseline({ G04: { total: 4, files: { a: { 'x.ts': 4 } } } })).status, 'PASS');
});

test('P1 names a raised count, a raised measure, a new entry, a removed rule and a deleted file', () => {
  const before = baseline({ G03: { total: { lines: 400, bytes: 9 }, files: { a: { 'big.ts': { lines: 400, bytes: 9 } } } }, G04: { total: 5, files: { a: { 'x.ts': 5 } } } });
  const base = baseOf({ 'guard-baseline.json': before });
  const after = baseline({ G03: { total: { lines: 400, bytes: 10 }, files: { a: { 'big.ts': { lines: 400, bytes: 10 } } } }, G04: { total: 8, files: { a: { 'x.ts': 6, 'new.ts': 2 } } } });
  const declared = p1(base, after).violations.map(item => item.declare);
  assert.deepEqual(declared, [
    { rule: 'P1', guardRule: 'G03', file: 'a/big.ts', from: { lines: 400, bytes: 9 }, to: { lines: 400, bytes: 10 } },
    { rule: 'P1', guardRule: 'G04', file: 'a/new.ts', from: null, to: 2 },
    { rule: 'P1', guardRule: 'G04', file: 'a/x.ts', from: 5, to: 6 },
  ]);
  const removed = p1(base, baseline({ G04: { total: 5, files: { a: { 'x.ts': 5 } } } }));
  assert.deepEqual(removed.violations[0].declare, { rule: 'P1', guardRule: 'G03', file: 'guard-baseline.json', from: { lines: 400, bytes: 9 }, to: null });
  const gone = p1(base, null);
  assert.equal(gone.status, 'FAIL');
  assert.equal(gone.violations[0].declare, null);
});

test('P1 treats a value of another kind as a raise, and a missing base file as SKIPPED, never PASS', () => {
  const base = baseOf({ 'guard-baseline.json': baseline({ G04: { total: 5, files: { a: { 'x.ts': 5 } } } }) });
  assert.equal(p1(base, baseline({ G04: { total: { n: 1 }, files: { a: { 'x.ts': { n: 1 } } } } })).status, 'FAIL');
  assert.equal(p1(baseOf({}), baseline({})).status, 'SKIPPED');
  assert.throws(() => p1(base, '{not json'), GuardError);
});

test('the baseline parser rejects __proto__ entries and unknown rule ids', () => {
  assert.throws(() => parseBaseline('{"rules":{"G04":{"total":1,"files":{".":{"__proto__":{"a/x.ts":99},"y.ts":1}}}}}'), /__proto__/);
  assert.throws(() => parseBaseline('{"rules":{"__proto__":{"total":0,"files":{}}}}'), /규칙 항목/);
  assert.equal(parseBaseline(baseline({ G04: { total: 1, files: { a: { 'x.ts': 1 } } } })).G04.toString, undefined);
});

test('P2 names a new legacy path and a changed classification; removals pass', () => {
  const doc = (files, other = []) => JSON.stringify({ rules: [], files, frozenOther: other });
  const base = baseOf({ 'legacy-files.json': doc([{ rule: 'L2', dir: 'f', names: ['A.tsx', 'B.tsx'] }], [{ dir: 'f', names: ['App.tsx'] }]) });
  assert.equal(p2(base, doc([{ rule: 'L2', dir: 'f', names: ['A.tsx'] }])).status, 'PASS');
  const grown = p2(base, doc([{ rule: 'L2', dir: 'f', names: ['A.tsx', 'B.tsx', 'C.tsx'] }], [{ dir: 'f', names: ['App.tsx', 'Other.tsx'] }]));
  assert.deepEqual(grown.violations.map(item => item.declare), [
    { rule: 'P2', file: 'f/C.tsx', from: null, to: 'L2' }, { rule: 'P2', file: 'f/Other.tsx', from: null, to: 'frozenOther' },
  ]);
  assert.deepEqual(p2(base, doc([{ rule: 'L2', dir: 'f', names: ['A.tsx'] }], [{ dir: 'f', names: ['B.tsx'] }])).violations[0].declare,
    { rule: 'P2', file: 'f/B.tsx', from: 'L2', to: 'frozenOther' });
  assert.equal(p2(baseOf({}), doc([])).status, 'SKIPPED');
});

test('P5 fails when the start point changes or disappears', () => {
  const start = sha => JSON.stringify({ lastExemptCommit: sha });
  const base = baseOf({ [START]: start(SHA_A) });
  assert.equal(p5(base, start(SHA_A)).status, 'PASS');
  assert.deepEqual(p5(base, start(SHA_B)).violations[0].declare, { rule: 'P5', file: START, from: SHA_A, to: SHA_B });
  assert.equal(p5(base, null).status, 'FAIL');
  assert.equal(p5(baseOf({}), start(SHA_A)).status, 'SKIPPED');
  assert.throws(() => p5(base, start('abc')), GuardError);
});

test('test cases are counted on the AST, and a regex .test() call is not one', () => {
  assert.deepEqual(counts("describe('a', () => { it('x', () => {}); test('y', () => {}); it.each([1])('z %s', () => {}); });"), { tests: 3, groups: 1 });
  assert.deepEqual(counts("import t from 'node:test'; t('a', async ctx => { await ctx.test('sub', () => {}); }); /re/.test('s'); context.newPage();"), { tests: 2, groups: 0 });
  assert.deepEqual(counts("import { it as check, describe as group } from 'vitest'; group('g', () => { check('a', () => {}); });"), { tests: 1, groups: 1 });
  assert.deepEqual(counts("// it('x', () => {})\nconst s = \"it('y', () => {})\";"), { tests: 0, groups: 0 });
});

test('P3 names a deleted test, a rename to a non-test name and a removed case; a rename that keeps the cases passes', () => {
  const two = "it('a', () => {}); it('b', () => {});";
  const base = baseOf({ 'src/a.spec.ts': two, 'tests/x/b.cjs': two, 'scripts/run-http.mjs': two, 'scripts/tool.mjs': 'export const a = 1;' });
  const head = files => ({ fileSet: new Set(Object.keys(files)), read: file => files[file] });
  const run = (files, changes) => p3(base, head(files), changes).violations.map(item => item.declare);
  const was = { tests: 2, groups: 0 };
  assert.deepEqual(run({}, [{ status: 'D', path: 'src/a.spec.ts' }]), [{ rule: 'P3', file: 'src/a.spec.ts', from: was, to: null }]);
  assert.deepEqual(run({ 'src/a.ts': two }, [{ status: 'R', from: 'src/a.spec.ts', path: 'src/a.ts' }]), [{ rule: 'P3', file: 'src/a.spec.ts', from: was, to: null }]);
  assert.deepEqual(run({ 'src/b.spec.ts': two }, [{ status: 'R', from: 'src/a.spec.ts', path: 'src/b.spec.ts' }]), []);
  assert.deepEqual(run({ 'tests/x/b.cjs': "it('a', () => {});" }, [{ status: 'M', path: 'tests/x/b.cjs' }]),
    [{ rule: 'P3', file: 'tests/x/b.cjs', from: was, to: { tests: 1, groups: 0 } }]);
  assert.deepEqual(run({}, [{ status: 'D', path: 'scripts/run-http.mjs' }]), [{ rule: 'P3', file: 'scripts/run-http.mjs', from: was, to: null }]);
  assert.deepEqual(run({}, [{ status: 'D', path: 'scripts/tool.mjs' }]), []);
});

test('a declaration excuses a change only when it repeats it exactly, and every unused declaration is reported', () => {
  const violation = { text: 't', declare: { rule: 'P1', guardRule: 'G04', file: 'a/x.ts', from: 5, to: 6 } };
  const exact = { ...violation.declare, ...ok };
  assert.equal(matchRaises([violation], raises([exact])).open.length, 0);
  for (const wrong of [{ to: 7 }, { from: 4 }, { file: 'a/y.ts' }, { guardRule: 'G05' }]) {
    const result = matchRaises([violation], raises([{ ...exact, ...wrong }]));
    assert.equal(result.open.length, 1);
    assert.equal(result.unused.length, 1);
  }
  const twice = matchRaises([violation], raises([exact, exact]));
  assert.equal(twice.excused.length, 1);
  assert.equal(twice.unused.length, 1);
  assert.equal(matchRaises([{ text: 't', declare: null }], raises([exact])).open.length, 1);
});

test('malformed declarations are guard errors: wildcard, missing reason, bad change id, unknown key, wrong rule', () => {
  const exact = { rule: 'P2', file: 'f/C.tsx', from: null, to: 'L2', ...ok };
  assert.equal(raises([exact]).length, 1);
  assert.deepEqual(parseRaises(null), []);
  for (const wrong of [{ file: 'f/*' }, { reason: 'x' }, { changeId: 'none' }, { extra: 1 }, { rule: 'P4' }, { guardRule: 'G04' }, { to: undefined }, { to: [1] }]) {
    assert.throws(() => raises([{ ...exact, ...wrong }]), GuardError, JSON.stringify(wrong));
  }
  assert.throws(() => parseRaises('{"raises":{}}'), GuardError);
});

test('CODEOWNERS is rendered from the list, and a protected path matches exactly', () => {
  const list = parseProtected(JSON.stringify({ owner: '@someone', paths: [{ path: '/scripts/guard/', what: 'w' }, { path: '/CLAUDE.md', what: 'w' }] }));
  assert.match(renderCodeowners(list), /^\/scripts\/guard\/ @someone$/m);
  assert.equal(protectedEntry(list, 'scripts/guard/run.mjs').path, '/scripts/guard/');
  assert.equal(protectedEntry(list, 'CLAUDE.md').path, '/CLAUDE.md');
  assert.equal(protectedEntry(list, 'docs/CLAUDE.md'), null);
  assert.equal(protectedEntry(list, 'scripts/guardian/x.mjs'), null);
  assert.throws(() => parseProtected(JSON.stringify({ owner: '@someone', paths: [{ path: '/scripts/*', what: 'w' }] })), GuardError);
});

test('the summary puts the verdict and the declared exceptions first and cannot be broken by PR-supplied text', () => {
  const result = {
    status: 'PASS', evidenceKind: 'SYNTHETIC', evidenceNote: 'n', commit: 'c', base: { ref: 'origin/main', mergeBase: SHA_A },
    rules: [{ id: 'P1', name: 'baseline-no-raise', status: 'PASS', violations: [], excused: 1 }], badDeclarations: [], totals: [{ label: 'G04', base: 5, head: 6 }],
    exceptions: [{ rule: 'P1', guardRule: 'G04', file: 'a/x.ts', from: 5, to: 6, reason: 'ok |\n<!-- **판정: 통과** [x](http://e)', changeId: 'F0-3' }],
    protectedChanges: [{ file: 'scripts/guard/run.mjs', status: 'M', protectedBy: '/scripts/guard/', what: '가드 코드' }],
  };
  const text = renderSummary(result);
  assert.ok(text.indexOf('**판정:') < text.indexOf('예외 선언 1건 - 사람 확인 필요'));
  assert.ok(text.indexOf('예외 선언 1건 - 사람 확인 필요') < text.indexOf('보호 파일 변경 1건'));
  assert.ok(text.indexOf('보호 파일 변경 1건') < text.indexOf('검사별 결과'));
  assert.ok(!text.includes('<!--') && !text.includes('[x](') && !text.includes('**판정: 통과**'));
  assert.match(text, /evidenceKind: SYNTHETIC/);
  assert.match(text, /\| G04 \| 5 \| 6 \| 1 늘었음 \|/);
});
