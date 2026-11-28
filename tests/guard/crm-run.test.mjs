// `crm verify` end to end in a throwaway repository: the fixed step list really runs, the bundle of the current commit
// is the only one left afterwards, and the command gives the same result when it is started from a subfolder.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { EVIDENCE_DIR, pruneEvidence, runVerify } from '../../scripts/crm/lib/verify.mjs';
import { NODE, makeSandbox, root, tempDir } from './sandbox.mjs';

const box = makeSandbox();
const SUB = 'frontend/src/hq-mock';
const bundles = () => fs.readdirSync(path.join(box.dir, EVIDENCE_DIR)).sort();
const short = () => box.git('rev-parse', 'HEAD').slice(0, 12);
const statuses = evidence => evidence.steps.map(step => [step.id, step.status]);
// In the sandbox the guard and its tests really run; there is no origin/main, and the pnpm steps are refused because
// the sandbox has no package.json with the pinned scripts. Nothing is reported as passed that did not run.
const EXPECTED = [['guard', 'PASS'], ['protect', 'NOT_RUN'], ['guard-tests', 'PASS'], ['build', 'ERROR'], ['test', 'ERROR'], ['hq-check', 'ERROR']];
const cli = (cwd, script, ...args) => spawnSync(NODE, [script, ...args], { cwd, encoding: 'utf8' });

test('pruneEvidence removes everything but the bundle it is told to keep', () => {
  const dir = tempDir('crm-test-');
  for (const name of ['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'cccccccccccc']) fs.mkdirSync(path.join(dir, name, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'stray.txt'), 'x');
  assert.deepEqual(pruneEvidence(dir, 'bbbbbbbbbbbb'), ['aaaaaaaaaaaa', 'cccccccccccc', 'stray.txt']);
  assert.deepEqual(fs.readdirSync(dir), ['bbbbbbbbbbbb']);
  assert.deepEqual(pruneEvidence(dir, 'bbbbbbbbbbbb'), []);
  assert.deepEqual(pruneEvidence(path.join(dir, 'missing'), 'x'), []);
});

test('verify keeps only the bundle of the current commit and deletes the bundles of other commits', () => {
  box.reset();
  const old = path.join(box.dir, EVIDENCE_DIR, '0123456789ab');
  fs.mkdirSync(old, { recursive: true });
  fs.writeFileSync(path.join(old, 'evidence.json'), JSON.stringify({ verdict: 'PASS', commit: '0123456789ab' }));
  const first = runVerify({ root: box.dir });
  assert.deepEqual(first.removed, ['0123456789ab']);
  assert.deepEqual(bundles(), [short()]);
  assert.deepEqual(statuses(first.evidence), EXPECTED);
  assert.deepEqual([first.evidence.stepSet, first.evidence.verdict, first.evidence.exitCode, first.evidence.dirty], ['DEFAULT', 'ERROR', 2, false]);
  // The same commit again: its own bundle is replaced, nothing else is there to remove.
  assert.deepEqual(runVerify({ root: box.dir }).removed, []);
  // After a new commit the previous commit's bundle is the old one.
  const before = short();
  box.commit('[F0-5] another commit');
  try {
    assert.deepEqual(runVerify({ root: box.dir }).removed, [before]);
    assert.deepEqual(bundles(), [short()]);
  } finally { box.reset(); }
});

test('the command works from a subfolder: same steps, same bundle in the repository, nothing written where it was started', () => {
  box.reset();
  const sub = path.join(box.dir, SUB);
  const script = path.join(box.dir, 'scripts/crm/cli.mjs');
  for (const [cwd, how] of [[sub, script], [sub, path.relative(sub, script)], [box.dir, 'scripts/crm/cli.mjs']]) {
    fs.rmSync(path.join(box.dir, '.guard'), { recursive: true, force: true });
    const run = cli(cwd, how, 'verify', '--json', '--base', 'HEAD');
    assert.equal(run.status, 2, `${how}\n${run.stdout}${run.stderr}`);
    const evidence = JSON.parse(run.stdout);
    assert.deepEqual(statuses(evidence), EXPECTED.map(([id, status]) => [id, id === 'protect' ? 'PASS' : status]), how);
    assert.deepEqual(evidence, JSON.parse(box.read(`${EVIDENCE_DIR}/${short()}/evidence.json`)));
    assert.equal(evidence.dirty, false);
    assert.equal(fs.existsSync(path.join(sub, '.guard')), false);
  }
  const check = cli(sub, path.relative(sub, script), 'check', '--json');
  assert.deepEqual([check.status, JSON.parse(check.stdout).ok], [0, true]);
  box.write({ 'metadata/tool.ts': 'export const a = 1;\n' });
  assert.equal(cli(sub, script, 'check').status, 1);
  box.reset();
});

test('the other commands give the same answer from a subfolder of this repository, and the help says where pnpm must run', () => {
  const sub = path.join(root, 'frontend/src');
  const script = path.join(root, 'scripts/crm/cli.mjs');
  for (const args of [['classify'], ['classify', '--json'], ['help'], ['new-object', 'visit_plan', '--json'], ['add-field', 'a_b', 'c_d', 'date', '--json'],
    ['no-such-command', '--json']]) {
    const here = cli(root, script, ...args);
    const there = cli(sub, path.relative(sub, script), ...args);
    assert.deepEqual([there.status, there.stdout], [here.status, here.stdout], args.join(' '));
  }
  assert.match(cli(sub, script, 'help').stdout, /pnpm 명령은 저장소 맨 위 폴더에서 돌린다/);
  assert.match(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), /`pnpm` 명령은 저장소 맨 위 폴더에서 돌린다/);
});
