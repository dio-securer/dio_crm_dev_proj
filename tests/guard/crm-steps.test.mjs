// What each step of `crm verify` really runs. The step list is fixed, so its exact commands are pinned here: a step that
// silently runs something weaker (the guard without --strict, protect against HEAD, one guard test file instead of all,
// another pnpm script) makes this file go red. Also: guard exit code 2 is an ERROR, and HEAD moving during a run is seen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { STATUS } from '../../scripts/crm/lib/run.mjs';
import { DEFAULT_STEPS } from '../../scripts/crm/lib/steps.mjs';
import { VERDICT, runVerify, verdictOf } from '../../scripts/crm/lib/verify.mjs';
import { NODE, makeSandbox, root, tempDir } from './sandbox.mjs';

const step = id => DEFAULT_STEPS.find(item => item.id === id);
const argvOf = (id, context) => step(id).prepare({ root, base: { ref: null, source: null }, ...context }).argv;
const GUARD = 'scripts/guard/run.mjs';

test('the step list is exactly guard, protect, guard-tests, build, test, hq-check', () => {
  assert.deepEqual(DEFAULT_STEPS.map(item => item.id), ['guard', 'protect', 'guard-tests', 'build', 'test', 'hq-check']);
});

test('guard runs with --strict, protect compares with the given base (not HEAD), the pnpm steps run their own scripts', () => {
  const base = { ref: '0123456789abcdef0123456789abcdef01234567', source: '--base' };
  assert.deepEqual(argvOf('guard'), [process.execPath, GUARD, '--strict']);
  assert.deepEqual(argvOf('protect', { base }), [process.execPath, GUARD, '--protect', base.ref]);
  assert.deepEqual(argvOf('protect', { base: { ref: 'origin/main', source: 'default' } }), [process.execPath, GUARD, '--protect', 'origin/main']);
  assert.ok(step('protect').prepare({ root, base: { ref: null, source: null } }).notRun);
  assert.deepEqual(argvOf('build'), ['pnpm', 'build']);
  assert.deepEqual(argvOf('test'), ['pnpm', 'test']);
  assert.deepEqual(argvOf('hq-check'), ['pnpm', 'hq:check']);
});

test('guard-tests runs every tests/guard/*.test.mjs file, including the pins and protect files', () => {
  const listed = fs.readdirSync(path.join(root, 'tests/guard')).filter(name => /\.test\.mjs$/.test(name)).sort().map(name => `tests/guard/${name}`);
  for (const name of ['pins', 'protect', 'protect-git', 'crm-steps']) assert.ok(listed.includes(`tests/guard/${name}.test.mjs`), name);
  assert.deepEqual(argvOf('guard-tests'), [process.execPath, '--test', ...listed]);
});

test('guard and protect treat exit code 2 as ERROR, not as an ordinary failure', () => {
  for (const id of ['guard', 'protect']) assert.deepEqual(step(id).errorCodes, [2], id);
  const box = makeSandbox();
  const outDir = tempDir('crm-test-');
  const exit = code => ({ argv: [NODE, '-e', `process.exit(${code})`] });
  const steps = [
    { ...step('guard'), prepare: () => exit(2) },
    { ...step('protect'), prepare: () => exit(2) },
    { ...step('guard'), id: 'guard-1', prepare: () => exit(1) },
  ];
  const { evidence } = runVerify({ root: box.dir, steps, outDir });
  assert.deepEqual(evidence.steps.map(row => row.status), [STATUS.ERROR, STATUS.ERROR, STATUS.FAIL]);
});

test('HEAD moving during a run is recorded and keeps the verdict from PASS', () => {
  const box = makeSandbox();
  const outDir = tempDir('crm-test-');
  const steps = [{ id: 'moves-head', title: 'x', prepare: () => { box.commit('[F0-5] made during the run'); return { argv: [NODE, '-e', ''] }; } }];
  const { evidence } = runVerify({ root: box.dir, steps, outDir });
  assert.equal(evidence.steps[0].status, STATUS.PASS);
  assert.equal(evidence.headMovedDuringRun, true);
  assert.notEqual(evidence.verdict, VERDICT.PASS);
  const still = runVerify({ root: box.dir, steps: [{ id: 'still', title: 'x', prepare: () => ({ argv: [NODE, '-e', ''] }) }], outDir });
  assert.equal(still.evidence.headMovedDuringRun, false);
  const passed = [{ status: STATUS.PASS }];
  assert.equal(verdictOf(passed, { injected: false, headMoved: true }), VERDICT.ERROR);
  assert.equal(verdictOf(passed, { injected: false, headMoved: false }), VERDICT.PASS);
});
