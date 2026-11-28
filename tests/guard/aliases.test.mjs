// Behaviour behind names: a constant built from a constant declared later, a require alias of an alias, a test-function
// alias of an alias, a plain scripts/ file whose test() calls P3 counts, and guard modes that cannot be combined.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importsOf } from '../../scripts/guard/lib/imports.mjs';
import { p3 } from '../../scripts/guard/lib/protect-tests.mjs';
import { constsOf, parse } from '../../scripts/guard/lib/ts.mjs';
import { disabledOf } from '../../scripts/guard/rules/g08-disabled-tests.mjs';
import { makeSandbox } from './sandbox.mjs';

const fakeCtx = (file, text) => ({ memo: (_kind, _file, make) => make(), ast: () => parse(file, text) });

test('the constant table follows a constant built from one declared after it', () => {
  const consts = constsOf(parse('x.ts', "const B = A + '-x';\nconst A = 'a';\n"));
  assert.equal(consts.get('A'), 'a');
  assert.equal(consts.get('B'), 'a-x');
});

test('G08 follows a mode name from a later constant and a runner alias of a later alias', () => {
  assert.equal(disabledOf(parse('a.test.ts', "const M = P;\nconst P = 'skip';\nit[M]('x', () => {});\n")).length, 1);
  const later = "function f() { const b = a; const s = b.skip; return s; }\nconst a = it;\n";
  assert.equal(disabledOf(parse('b.test.ts', later)).length, 1);
  assert.equal(disabledOf(parse('c.test.ts', later.replace('const a = it;', 'const a = {};'))).length, 0);
});

test('require aliases are followed through an alias declared later', () => {
  const text = "function f() { const r2 = r1; return r2('pg'); }\nconst r1 = require;\n";
  assert.deepEqual(importsOf(fakeCtx('a.cjs', text), 'a.cjs').map(item => item.specifier), ['pg']);
});

test('P3 counts test() calls in a plain scripts/ file whose name says nothing about tests', () => {
  const file = 'scripts/foo.mjs';
  const body = "import { test } from 'node:test';\ntest('a', () => {});\ntest('b', () => {});\n";
  const base = { has: name => name === file, read: () => body };
  const head = files => ({ fileSet: new Set(Object.keys(files)), read: name => files[name] });
  const declared = (now, changes) => p3(base, head(now), changes).violations.map(item => item.declare);
  assert.deepEqual(declared({}, [{ status: 'D', path: file }]), [{ rule: 'P3', file, from: { tests: 2, groups: 0 }, to: null }]);
  assert.deepEqual(declared({ [file]: body.replace("test('b', () => {});\n", '') }, [{ status: 'M', path: file }]),
    [{ rule: 'P3', file, from: { tests: 2, groups: 0 }, to: { tests: 1, groups: 0 } }]);
});

test('the guard refuses two modes at once', () => {
  const box = makeSandbox();
  for (const args of [['--docs', '--codeowners'], ['--update-baseline', '--docs']]) {
    const run = box.guard(...args);
    assert.equal(run.status, 2, `${args.join(' ')}\n${run.stdout}${run.stderr}`);
    assert.match(run.stdout + run.stderr, /함께 쓸 수 없는 옵션/);
  }
});
