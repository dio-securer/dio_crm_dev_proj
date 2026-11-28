// Tests of the F0-4 additions to P3: acceptance scripts, `check(...)` cases, code that can never run,
// and of the self-checks that keep the guard readable and the package.json files protected.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProtected } from '../../scripts/guard/lib/codeowners.mjs';
import { isAcceptanceScript } from '../../scripts/guard/lib/files.mjs';
import { p3 } from '../../scripts/guard/lib/protect-tests.mjs';
import { MAX_LINE, SELF_DIRS, selfCheck, unprotectedManifests } from '../../scripts/guard/lib/selfcheck.mjs';
import { testCountsOf } from '../../scripts/guard/lib/testcount.mjs';
import { parse } from '../../scripts/guard/lib/ts.mjs';

const tests = text => testCountsOf(parse('x.spec.ts', text)).tests;
const baseOf = files => ({ has: file => file in files, read: file => files[file] });
const head = files => ({ fileSet: new Set(Object.keys(files)), read: file => files[file] });
const declared = (base, now, changes) => p3(baseOf(base), head(now), changes).violations.map(item => item.declare);
const SCRIPT = [
  "async function check(number, action) { await action(); }",
  "async function main() { await check(1, async () => {}); await check(2, async () => {}); await check(3, async () => {}); }",
  'main();',
].join('\n');

test('acceptance scripts are named by family, and nothing else under scripts/ is one', () => {
  for (const file of ['scripts/hq-standard/h02-browser.mjs', 'scripts/hq-standard/h02-http.mjs', 'scripts/admin/run-account-ui.cjs',
    'scripts/smoke/pilot-smoke.mjs', 'scripts/pwa/check.mjs', 'scripts/i18n/hardcode-check.mjs', 'scripts/x/a-verification.mjs',
    'scripts/x/a-walkthrough.mjs']) assert.equal(isAcceptanceScript(file), true, file);
  for (const file of ['scripts/hq-standard/server.mjs', 'scripts/guard/run.mjs', 'frontend/src/a-browser.mjs', 'scripts/x/browser.mjs',
    'scripts/x/a-browser.md', 'scripts/x/recheck.mjs']) assert.equal(isAcceptanceScript(file), false, file);
});

test('P3 counts check(...) calls as cases: deleting an acceptance script or removing a check fails', () => {
  const file = 'scripts/hq-standard/h02-browser.mjs';
  assert.equal(tests(SCRIPT), 3);
  assert.deepEqual(declared({ [file]: SCRIPT }, {}, [{ status: 'D', path: file }]),
    [{ rule: 'P3', file, from: { tests: 3, groups: 0 }, to: null }]);
  const fewer = SCRIPT.replace(' await check(3, async () => {});', '');
  assert.deepEqual(declared({ [file]: SCRIPT }, { [file]: fewer }, [{ status: 'M', path: file }]),
    [{ rule: 'P3', file, from: { tests: 3, groups: 0 }, to: { tests: 2, groups: 0 } }]);
  assert.deepEqual(declared({ [file]: SCRIPT }, { [file]: SCRIPT }, [{ status: 'M', path: file }]), []);
});

test('P3 protects an acceptance script even when it holds no countable case, and a rename out of the family fails', () => {
  const file = 'scripts/x/order-verification.mjs';
  const body = "import assert from 'node:assert/strict'; assert.equal(1, 1);";
  const zero = { tests: 0, groups: 0 };
  assert.deepEqual(declared({ [file]: body }, {}, [{ status: 'D', path: file }]), [{ rule: 'P3', file, from: zero, to: null }]);
  assert.deepEqual(declared({ [file]: body }, { 'scripts/x/order.mjs': body }, [{ status: 'R', from: file, path: 'scripts/x/order.mjs' }]),
    [{ rule: 'P3', file, from: zero, to: null }]);
  assert.deepEqual(declared({ [file]: body }, { 'scripts/x/order-check.mjs': body }, [{ status: 'R', from: file, path: 'scripts/x/order-check.mjs' }]), []);
});

test('a test behind a constant condition is not counted', () => {
  assert.equal(tests("it('a', () => {}); it('b', () => {});"), 2);
  assert.equal(tests("it('a', () => {}); if (false) it('b', () => {});"), 1);
  assert.equal(tests("it('a', () => {}); if (0) { it('b', () => {}); }"), 1);
  assert.equal(tests("it('a', () => {}); false && it('b', () => {});"), 1);
  assert.equal(tests("it('a', () => {}); if (!true) { describe('g', () => { it('b', () => {}); }); }"), 1);
  assert.equal(tests("if (true) { it('a', () => {}); } else { it('b', () => {}); }"), 1);
  assert.equal(tests("true || it('a', () => {}); const x = false ? it('b', () => {}) : 0; while (false) { it('c', () => {}); }"), 0);
  assert.equal(tests("if (process.env.CI) it('a', () => {}); 1 && it('b', () => {});"), 2);
});

test('a test inside a function that the file never uses is not counted', () => {
  assert.equal(tests("function unused() { it('a', () => {}); } it('b', () => {});"), 1);
  assert.equal(tests("const unused = () => { it('a', () => {}); }; it('b', () => {});"), 1);
  assert.equal(tests("function suite() { it('a', () => {}); } suite(); it('b', () => {});"), 2);
  assert.equal(tests("function suite() { it('a', () => {}); } describe('g', suite);"), 1);
  // Used only from dead code, only from itself, or only exported: still never run by this file.
  assert.equal(tests("function w() { it('a', () => {}); } if (false) w();"), 0);
  assert.equal(tests("function w() { it('a', () => {}); } function u() { w(); }"), 0);
  assert.equal(tests("function w() { it('a', () => {}); w(); }"), 0);
  assert.equal(tests("export function w() { it('a', () => {}); } function z() { it('b', () => {}); } export { z };"), 0);
  assert.equal(tests("function w() { it('a', () => {}); } function u() { w(); } u();"), 1);
  assert.equal(tests("o.w(); const p = { w: 1 }; function w() { it('a', () => {}); }"), 0);
});

test('the shapes that docs/framework/ci-gates.md lists as not recognised are still counted (change the document with this test)', () => {
  const shapes = ["if (1 > 2) it('a', () => {});", "const off = false; if (off) it('a', () => {});", "function s() { return; it('a', () => {}); } s();",
    "for (const x of []) it('a', () => {});", "[].forEach(() => it('a', () => {}));", "class A { m() { it('a', () => {}); } }",
    "const o = { m() { it('a', () => {}); } };", "if (process.env.X) it('a', () => {});", "function f() { it('a', () => {}); } void f;"];
  for (const shape of shapes) assert.equal(tests(shape), 1, shape);
});

test('P3 fails when a live test is turned into dead code', () => {
  const file = 'src/a.spec.ts';
  const live = "it('a', () => {}); it('b', () => {});";
  const was = { tests: 2, groups: 0 };
  for (const dead of ["it('a', () => {}); if (false) it('b', () => {});", "it('a', () => {}); function later() { it('b', () => {}); }"]) {
    assert.deepEqual(declared({ [file]: live }, { [file]: dead }, [{ status: 'M', path: file }]),
      [{ rule: 'P3', file, from: was, to: { tests: 1, groups: 0 } }]);
  }
});

test('the line-length self-check covers the guard, its tests and the crm command', () => {
  assert.deepEqual(SELF_DIRS, ['scripts/guard/', 'tests/guard/', 'scripts/crm/']);
  const long = `// ${'x'.repeat(MAX_LINE)}\n`;
  const files = {
    'scripts/guard/a.mjs': long, 'tests/guard/a.test.mjs': long, 'scripts/crm/a.mjs': long, 'scripts/other/a.mjs': long, 'scripts/crm/b.mjs': '// ok\n',
  };
  const found = selfCheck({ files: Object.keys(files), read: file => files[file] });
  assert.deepEqual(found.map(item => item.file), ['scripts/guard/a.mjs', 'tests/guard/a.test.mjs', 'scripts/crm/a.mjs']);
});

test('every package.json must be on the protected list', () => {
  const paths = [{ path: '/package.json', what: 'w' }, { path: '/backend/package.json', what: 'w' }];
  const list = parseProtected(JSON.stringify({ owner: '@someone', paths }));
  const ctx = { files: ['package.json', 'backend/package.json', 'packages/new/package.json', 'docs/package.json.md'] };
  assert.deepEqual(unprotectedManifests(ctx, list), ['packages/new/package.json']);
});

test('CLAUDE.md blocks are filled between markers, and a missing or repeated marker is refused', async () => {
  const { fill } = await import('../../scripts/guard/lib/claude-md.mjs');
  const mark = (name, edge) => `<!-- guard:${name}:${edge} (node scripts/guard/run.mjs --docs 가 만든다. 직접 고치지 않는다) -->`;
  const page = ['# t', mark('rules', 'start'), 'old', mark('rules', 'end'), 'kept', mark('protected', 'start'), mark('protected', 'end'), ''].join('\n');
  const filled = fill(page, { rules: ['| G01 |'], protected: ['`/a`'] });
  const expected = ['# t', mark('rules', 'start'), '| G01 |', mark('rules', 'end'), 'kept', mark('protected', 'start'), '`/a`', mark('protected', 'end'), ''];
  assert.equal(filled, expected.join('\n'));
  assert.equal(fill(filled, { rules: ['| G01 |'], protected: ['`/a`'] }), filled);
  assert.equal(fill(page.replace(mark('rules', 'end'), ''), { rules: [], protected: [] }), null);
  assert.equal(fill(`${page}${mark('rules', 'start')}\n`, { rules: [], protected: [] }), null);
});
