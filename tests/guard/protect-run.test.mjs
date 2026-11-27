// The protect check (P1-P6) through the real runner, in a throwaway repository: every weakening exits 1, the same
// weakening with an exact declaration exits 0, and an inexact declaration does not pass. The comparison logic itself
// is tested on in-memory pairs in protect.test.mjs and protect-tests.test.mjs; this file adds the runner and its exit codes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOUND, makeSandbox } from './sandbox.mjs';

const box = makeSandbox(BOUND);
const BASELINE = 'guard-baseline.json';
const LEGACY = 'legacy-files.json';
const START = 'scripts/guard/commit-id-start.json';
const RAISES = 'guard-raises.json';
const SAMPLE = 'tests/sample.test.mjs';
const SCRIPT = 'scripts/x/order-check.mjs';
const SIGNED = { reason: 'approved by the owner for this trial', changeId: 'F0-5' };
const json = (file, change) => () => { const doc = JSON.parse(box.read(file)); change(doc); box.write({ [file]: `${JSON.stringify(doc, null, 2)}\n` }); };
const edit = (file, text) => () => box.write({ [file]: text });
const OTHER_SHA = 'c'.repeat(40);
const wasBig = BOUND.baseline.G03.files.src['old-big.ts'];
const two = { tests: 2, groups: 1 };

/** Run the protect check on the sandbox after `change`, with `declared` written to guard-raises.json. */
function protect(change, declared = null) {
  box.reset();
  change();
  if (declared) box.write({ [RAISES]: JSON.stringify({ raises: declared.map(entry => ({ ...entry, ...SIGNED })) }) });
  const run = box.guard('--protect', 'HEAD');
  return { status: run.status, output: run.stdout + run.stderr, result: box.result('protect-result.json'), summary: box.read('.guard/summary.md') };
}
const ruleOf = (result, id) => result.rules.find(rule => rule.id === id);

// Every weakening that can be declared: [what, change, the declaration the guard asks for].
const TRIALS = {
  P1: [
    ['a raised count', json(BASELINE, doc => { doc.rules.G05.total = 3; doc.rules.G05.files.ui['old.css'] = 3; }),
      { rule: 'P1', guardRule: 'G05', file: 'ui/old.css', from: 2, to: 3 }],
    ['a raised size', json(BASELINE, doc => { doc.rules.G03.total.bytes += 1; doc.rules.G03.files.src['old-big.ts'].bytes += 1; }),
      { rule: 'P1', guardRule: 'G03', file: 'src/old-big.ts', from: wasBig, to: { ...wasBig, bytes: wasBig.bytes + 1 } }],
    ['a new entry', json(BASELINE, doc => { doc.rules.G05.total = 3; doc.rules.G05.files.ui['new.css'] = 1; }),
      { rule: 'P1', guardRule: 'G05', file: 'ui/new.css', from: null, to: 1 }],
    ['a new rule entry', json(BASELINE, doc => { doc.rules.G06 = { total: 1, files: { 'backend/src': { 'a.ts': 1 } } }; }),
      { rule: 'P1', guardRule: 'G06', file: 'backend/src/a.ts', from: null, to: 1 }],
    ['a removed rule', json(BASELINE, doc => { delete doc.rules.G05; }), { rule: 'P1', guardRule: 'G05', file: BASELINE, from: 2, to: null }],
  ],
  P2: [
    ['a new legacy file', json(LEGACY, doc => { doc.files[0].names.push('NewPage.tsx'); }),
      { rule: 'P2', file: 'frontend/src/NewPage.tsx', from: null, to: 'L1' }],
    ['a new frozen-other file', json(LEGACY, doc => { doc.frozenOther[0].names.push('extra.ts'); }),
      { rule: 'P2', file: 'frontend/src/extra.ts', from: null, to: 'frozenOther' }],
    ['a changed classification', json(LEGACY, doc => { doc.files[0].rule = 'L2'; }), { rule: 'P2', file: 'frontend/src/HomePage.tsx', from: 'L1', to: 'L2' }],
  ],
  P3: [
    ['a deleted test file', () => box.remove(SAMPLE), { rule: 'P3', file: SAMPLE, from: two, to: null }],
    ['one case fewer', edit(SAMPLE, "describe('g', () => { it('a', () => {}); });\n"), { rule: 'P3', file: SAMPLE, from: two, to: { tests: 1, groups: 1 } }],
    ['a group fewer', edit(SAMPLE, "it('a', () => {}); it('b', () => {});\n"), { rule: 'P3', file: SAMPLE, from: two, to: { tests: 2, groups: 0 } }],
    ['a case behind a constant condition', edit(SAMPLE, "describe('g', () => { it('a', () => {}); if (false) it('b', () => {}); });\n"),
      { rule: 'P3', file: SAMPLE, from: two, to: { tests: 1, groups: 1 } }],
    ['a case in a function nobody calls', edit(SAMPLE, "describe('g', () => { it('a', () => {}); });\nfunction later() { it('b', () => {}); }\n"),
      { rule: 'P3', file: SAMPLE, from: two, to: { tests: 1, groups: 1 } }],
    ['a rename to a name that is not a test', () => box.git('mv', SAMPLE, 'sample-old.mjs'), { rule: 'P3', file: SAMPLE, from: two, to: null }],
    ['a check removed from an acceptance script', edit(SCRIPT, box.read(SCRIPT).replace('await check(2, async () => {});\n', '')),
      { rule: 'P3', file: SCRIPT, from: { tests: 2, groups: 0 }, to: { tests: 1, groups: 0 } }],
    ['a deleted acceptance script', () => box.remove(SCRIPT), { rule: 'P3', file: SCRIPT, from: { tests: 2, groups: 0 }, to: null }],
  ],
  P4: [],
  P5: [
    ['a moved start point', json(START, doc => { doc.lastExemptCommit = OTHER_SHA; }), { rule: 'P5', file: START, from: box.exempt, to: OTHER_SHA }],
  ],
  // P6 (metadata compatibility) cannot be declared; its trials are in metadata.test.mjs.
  P6: [],
};

test('the unchanged sandbox passes, and the protect check has exactly the rules that are tried here', () => {
  const run = protect(() => {});
  assert.equal(run.status, 0, run.output);
  assert.deepEqual(run.result.rules.map(rule => [rule.id, rule.status]), Object.keys(TRIALS).map(id => [id, 'PASS']));
  assert.deepEqual(run.result.protectedChanges, []);
  assert.match(run.summary, /\*\*판정: 통과 - 사람이 따로 확인할 것이 없습니다\.\*\*/);
});

for (const [id, cases] of Object.entries(TRIALS)) {
  for (const [what, change, declaration] of cases) {
    test(`${id}: ${what} exits 1, the exact declaration exits 0, an inexact one does not pass`, () => {
      const bare = protect(change);
      assert.equal(bare.status, 1, bare.output);
      assert.equal(ruleOf(bare.result, id).status, 'FAIL');
      assert.deepEqual(bare.result.rules.flatMap(rule => rule.violations.map(item => item.declare)), [declaration]);
      assert.match(bare.summary, /\*\*판정: 실패 - 선언하지 않은 약화 1건, 잘못된 예외 선언 0건/);
      const exact = protect(change, [declaration]);
      assert.equal(exact.status, 0, exact.output);
      assert.deepEqual([ruleOf(exact.result, id).status, ruleOf(exact.result, id).excused, exact.result.exceptions.length], ['PASS', 1, 1]);
      assert.match(exact.summary, /예외 선언 1건 - 사람 확인 필요/);
      // Every part of a declaration must match. All three parts are tried on the first case of a rule, one on the others.
      const wrongs = [{ ...declaration, to: declaration.to === null ? 1 : null }, { ...declaration, from: declaration.from === null ? 1 : null },
        { ...declaration, file: `${declaration.file}.other` }];
      for (const wrong of wrongs.slice(0, cases[0][0] === what ? 3 : 1)) {
        const inexact = protect(change, [wrong]);
        assert.equal(inexact.status, 1, `${JSON.stringify(wrong)}\n${inexact.output}`);
        assert.equal(inexact.result.badDeclarations.length, 1);
        assert.equal(ruleOf(inexact.result, id).violations.length, 1);
      }
    });
  }
}

test('weakenings that cannot be declared: a deleted baseline, legacy list or start point exits 1', () => {
  for (const [id, file] of [['P1', BASELINE], ['P2', LEGACY], ['P5', START]]) {
    const run = protect(() => box.remove(file));
    assert.equal(run.status, 1, `${file}\n${run.output}`);
    assert.deepEqual(ruleOf(run.result, id).violations.map(item => [item.file, item.declare]), [[file, null]]);
  }
});

test('changes that weaken nothing pass: a lowered number, a shorter legacy list, more tests, a rename that keeps the tests', () => {
  const harmless = [
    json(BASELINE, doc => { doc.rules.G05.total = 1; doc.rules.G05.files.ui['old.css'] = 1; }),
    json(LEGACY, doc => { doc.files.shift(); }),
    edit(SAMPLE, "describe('g', () => { it('a', () => {}); it('b', () => {}); it('c', () => {}); });\n"),
    () => box.git('mv', SAMPLE, 'tests/renamed.test.mjs'),
    edit('tests/new.test.mjs', "it('a', () => {});\n"),
  ];
  harmless.forEach((change, index) => {
    const run = protect(change);
    assert.equal(run.status, 0, `case ${index}\n${run.output}`);
    assert.deepEqual(run.result.rules.flatMap(rule => rule.violations), [], `case ${index}`);
  });
});

test('P4 lists every changed protected file for the approver, and only those; it does not fail the run', () => {
  const listed = run => run.result.protectedChanges.map(item => [item.status, item.file, item.protectedBy]);
  const edited = protect(() => box.write({ 'CLAUDE.md': `${box.read('CLAUDE.md')}\nmore\n`, 'frontend/src/feature/free.ts': 'export const a = 1;\n' }));
  assert.equal(edited.status, 0, edited.output);
  assert.equal(ruleOf(edited.result, 'P4').status, 'REVIEW');
  assert.deepEqual(listed(edited), [['M', 'CLAUDE.md', '/CLAUDE.md']]);
  assert.match(edited.summary, /\*\*판정: 통과 - 단, 아래 "사람이 확인할 것"을 읽고 승인하세요\.\*\*/);
  assert.match(edited.summary, /### 보호 파일 변경 1건\n\n[^\n]+\n\n- `\/CLAUDE\.md` \([^\n]+\) 1개\n {2}- 수정: `CLAUDE\.md`/);
  const many = protect(() => {
    box.write({ 'scripts/guard/rules/g99-new.mjs': 'export default {};\n', '.github/workflows/ci.yml': 'name: ci\n' });
    box.remove('scripts/guard/legacy-scan.mjs');
    box.git('mv', 'tests/guard/base.test.mjs', 'tests/moved-out.test.mjs');
  });
  assert.deepEqual(listed(many), [['A', '.github/workflows/ci.yml', '/.github/'], ['D', 'scripts/guard/legacy-scan.mjs', '/scripts/guard/'],
    ['A', 'scripts/guard/rules/g99-new.mjs', '/scripts/guard/'], ['R', 'tests/guard/base.test.mjs', '/tests/guard/']]);
  // Taking a path off the protected list in the same change does not hide the change to it.
  const unlisted = protect(() => {
    json('scripts/guard/protected-paths.json', doc => { doc.paths = doc.paths.filter(item => item.path !== '/CLAUDE.md'); })();
    box.write({ 'CLAUDE.md': `${box.read('CLAUDE.md')}\nmore\n` });
  });
  assert.deepEqual(listed(unlisted), [['M', 'CLAUDE.md', '/CLAUDE.md'], ['M', 'scripts/guard/protected-paths.json', '/scripts/guard/']]);
  const free = protect(() => box.write({ 'frontend/src/feature/free.ts': 'export const a = 1;\n', 'docs/notes.md': 'x\n' }));
  assert.deepEqual([free.status, ruleOf(free.result, 'P4').status, listed(free)], [0, 'PASS', []]);
});

test('a declaration that matches no change fails, and a check that cannot run is an error (exit 2)', () => {
  const unused = protect(() => {}, [TRIALS.P1[0][2]]);
  assert.equal(unused.status, 1, unused.output);
  assert.equal(unused.result.badDeclarations.length, 1);
  const twice = protect(TRIALS.P1[0][1], [TRIALS.P1[0][2], TRIALS.P1[0][2]]);
  assert.equal(twice.status, 1, 'one declaration excuses one change');
  for (const broken of [edit(RAISES, '{ not json'), edit(RAISES, JSON.stringify({ raises: [{ rule: 'P1', file: '*' }] })), edit(BASELINE, '{ not json'),
    edit(LEGACY, '{}'), edit(START, '{}')]) {
    const run = protect(broken);
    assert.equal(run.status, 2, run.output);
    assert.equal(run.result.status, 'ERROR');
    assert.match(run.summary, /\*\*판정: 오류/);
  }
  box.reset();
  for (const ref of ['no-such-ref', '--all', '']) assert.equal(box.guard('--protect', ref).status, 2, ref);
});

test('the base is the commit the branch started from: weakening that is already committed is still seen', () => {
  box.reset();
  box.remove(SAMPLE);
  box.git('add', '-A');
  box.commit('[F0-5] delete a test');
  try {
    assert.equal(box.guard('--protect', 'HEAD').status, 0, 'compared with itself nothing changed');
    assert.equal(box.guard('--protect', box.base).status, 1);
    assert.deepEqual(ruleOf(box.result('protect-result.json'), 'P3').violations.map(item => item.file), [SAMPLE]);
  } finally { box.reset(); }
});
