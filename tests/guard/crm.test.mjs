// Tests of the framework command line (scripts/crm): exit codes, the evidence bundle, and that it cannot report
// a pass for something that did not run. Steps are injected through runVerify's `steps` argument, which the command
// line never passes; an injected run is marked INJECTED, never gets the verdict PASS, and may not write into the repo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TYPES, classifyData, renderClassify } from '../../scripts/crm/lib/classify.mjs';
import { STATUS, runCommand, statusOf } from '../../scripts/crm/lib/run.mjs';
import { FIELD_TYPES, planAddField, planNewObject } from '../../scripts/crm/lib/scaffold.mjs';
import { DEFAULT_STEPS, PINNED_SCRIPTS, resolveBase, scriptProblems } from '../../scripts/crm/lib/steps.mjs';
import { EVIDENCE_KIND, VERDICT, exitCodeOf, runVerify, verdictOf } from '../../scripts/crm/lib/verify.mjs';
import { tempDir } from './sandbox.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NODE = process.execPath;
const cli = (...args) => spawnSync(NODE, ['scripts/crm/cli.mjs', ...args], { cwd: root, encoding: 'utf8' });
// Deleted when the test process ends (sandbox.mjs).
const tmp = () => tempDir('crm-test-');
const exits = code => ({ argv: [NODE, '-e', `process.exit(${code})`] });
const step = (id, prepare, more = {}) => ({ id, title: id, prepare, ...more });

/** A throwaway git repository with one commit, for the cases that need another tree than this one. */
function tempRepo(files) {
  const dir = tmp();
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', '[F0-4] test fixture');
  return dir;
}

test('a status is PASS only for a process that ran and exited 0', () => {
  assert.equal(statusOf({ exitCode: 0 }), STATUS.PASS);
  assert.equal(statusOf({ exitCode: 1 }), STATUS.FAIL);
  assert.equal(statusOf({ exitCode: 2 }, [2]), STATUS.ERROR);
  assert.equal(statusOf({ exitCode: null }), STATUS.ERROR);
  assert.equal(statusOf({ exitCode: undefined }), STATUS.ERROR);
  assert.equal(statusOf({ exitCode: '0' }), STATUS.ERROR);
  assert.equal(statusOf({ exitCode: 0, signal: 'SIGKILL' }), STATUS.ERROR);
  assert.equal(statusOf({ exitCode: 0, spawnError: 'ENOENT' }), STATUS.ERROR);
});

test('runCommand passes the exit code on, and a command that cannot start is an error', () => {
  assert.equal(runCommand([NODE, '-e', 'process.exit(7)'], { cwd: root }).exitCode, 7);
  assert.equal(runCommand([NODE, '-e', ''], { cwd: root }).exitCode, 0);
  const missing = runCommand(['crm-no-such-command-xyz'], { cwd: root });
  assert.equal(missing.exitCode, null);
  assert.equal(missing.spawnError, 'ENOENT');
  assert.equal(statusOf(missing), STATUS.ERROR);
  const slow = runCommand([NODE, '-e', 'setTimeout(() => {}, 60000)'], { cwd: root, timeoutMs: 200 });
  assert.equal(statusOf(slow), STATUS.ERROR);
});

test('the verdict is PASS only when every step passed; exit code 0 only for PASS', () => {
  const rows = (...list) => list.map(status => ({ status }));
  const real = { injected: false, headMoved: false };
  assert.equal(verdictOf(rows('PASS', 'PASS'), real), VERDICT.PASS);
  assert.equal(verdictOf(rows('PASS', 'FAIL', 'ERROR'), real), VERDICT.FAIL);
  assert.equal(verdictOf(rows('PASS', 'ERROR'), real), VERDICT.ERROR);
  assert.equal(verdictOf(rows('PASS', 'NOT_RUN'), real), VERDICT.INCOMPLETE);
  assert.equal(verdictOf(rows('PASS', 'SOMETHING_ELSE'), real), VERDICT.INCOMPLETE);
  assert.equal(verdictOf([], real), VERDICT.INCOMPLETE);
  assert.equal(verdictOf(rows('PASS'), { injected: false, headMoved: true }), VERDICT.ERROR);
  assert.equal(verdictOf(rows('PASS'), { injected: true, headMoved: false }), VERDICT.TEST_ONLY);
  assert.deepEqual(Object.values(VERDICT).map(exitCodeOf), [0, 1, 2, 2, 2]);
});

test('verify keeps going after a failure and reports each step honestly in the evidence bundle', () => {
  const outDir = tmp();
  const steps = [
    step('ok', () => exits(0)),
    step('fails', () => exits(3)),
    step('missing', () => ({ argv: ['crm-no-such-command-xyz'] })),
    step('cannot', () => ({ cannotRun: '돌릴 파일이 없습니다.' })),
    step('not-run', () => ({ notRun: '기준이 없습니다.' })),
    step('throws', () => { throw new Error('boom'); }),
    step('guard-error', () => exits(2), { errorCodes: [2] }),
    step('after', () => exits(0)),
  ];
  const { evidence } = runVerify({ root, steps, outDir });
  assert.deepEqual(evidence.steps.map(row => row.status), ['PASS', 'FAIL', 'ERROR', 'ERROR', 'NOT_RUN', 'ERROR', 'ERROR', 'PASS']);
  assert.deepEqual(evidence.steps.map(row => row.exitCode), [0, 3, null, null, null, null, 2, 0]);
  assert.deepEqual(evidence.notPassed.map(row => row.id), ['fails', 'missing', 'cannot', 'not-run', 'throws', 'guard-error']);
  assert.equal(evidence.stepSet, 'INJECTED');
  assert.equal(evidence.verdict, VERDICT.TEST_ONLY);
  assert.equal(evidence.exitCode, 2);
  const saved = JSON.parse(fs.readFileSync(path.join(outDir, 'evidence.json'), 'utf8'));
  assert.deepEqual(saved, evidence);
  assert.deepEqual(Object.keys(saved), ['schemaVersion', 'tool', 'evidenceKind', 'evidenceNote', 'stepSet', 'verdict', 'exitCode', 'commit', 'branch',
    'dirty', 'dirtyAtStart', 'dirtyAtEnd', 'dirtyFiles', 'dirtyFileCount', 'headMovedDuringRun', 'base', 'startedAt', 'finishedAt', 'durationMs',
    'environment', 'notPassed', 'steps']);
  assert.deepEqual(Object.keys(saved.steps[0]), ['id', 'title', 'command', 'status', 'exitCode', 'signal', 'durationMs', 'logPath', 'note']);
  assert.match(saved.commit, /^[0-9a-f]{40}$/);
  assert.equal(typeof saved.dirty, 'boolean');
  assert.ok(!Number.isNaN(Date.parse(saved.startedAt)) && saved.durationMs >= 0);
  assert.ok(fs.existsSync(path.join(outDir, saved.steps[0].logPath)) && fs.existsSync(path.join(outDir, saved.steps[1].logPath)));
  assert.equal(saved.steps[3].logPath, null);
  const summary = fs.readFileSync(path.join(outDir, 'summary.md'), 'utf8');
  assert.match(summary, /\*\*판정: 시험용/);
  assert.match(summary, /통과하지 못한 단계 6개/);
  assert.match(summary, /evidenceKind\): SYNTHETIC/);
});

test('the evidence kind is always SYNTHETIC and the other kind cannot be produced', () => {
  assert.equal(EVIDENCE_KIND, 'SYNTHETIC');
  const outDir = tmp();
  const { evidence } = runVerify({ root, steps: [step('ok', () => exits(0))], outDir, base: 'REAL' });
  assert.equal(evidence.evidenceKind, 'SYNTHETIC');
  const kinds = fs.readFileSync(path.join(outDir, 'summary.md'), 'utf8').split('\n').filter(row => row.includes('evidenceKind'));
  assert.deepEqual(kinds, ['- 증거 종류(evidenceKind): SYNTHETIC']);
  // No source file of the command holds the reserved kind as a value, and none reads the environment.
  const dir = path.join(root, 'scripts/crm');
  const sources = [path.join(dir, 'cli.mjs'), ...fs.readdirSync(path.join(dir, 'lib')).map(name => path.join(dir, 'lib', name))];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/REAL/.test(text), `${file} mentions the reserved kind`);
    assert.ok(!/process\s*\.\s*env|process\[/.test(text), `${file} reads the environment`);
  }
});

test('an injected step list can never pass and cannot write into the repository', () => {
  const allPass = [step('a', () => exits(0)), step('b', () => exits(0))];
  const { evidence } = runVerify({ root, steps: allPass, outDir: tmp() });
  assert.equal(evidence.verdict, VERDICT.TEST_ONLY);
  assert.notEqual(evidence.exitCode, 0);
  assert.throws(() => runVerify({ root, steps: allPass }), /저장소 밖/);
  assert.throws(() => runVerify({ root, steps: allPass, outDir: path.join(root, '.guard/evidence/x') }), /저장소 밖/);
  // A copy of the real list is still an injected list: only the frozen list itself counts as the default.
  assert.throws(() => runVerify({ root, steps: [...DEFAULT_STEPS] }), /저장소 밖/);
});

test('the fixed step list is the six steps in order, frozen, with the protect step not run when there is no base', () => {
  assert.deepEqual(DEFAULT_STEPS.map(item => item.id), ['guard', 'protect', 'guard-tests', 'build', 'test', 'hq-check']);
  assert.ok(Object.isFrozen(DEFAULT_STEPS) && DEFAULT_STEPS.every(Object.isFrozen) && Object.isFrozen(PINNED_SCRIPTS));
  assert.throws(() => { DEFAULT_STEPS.push({}); }, TypeError);
  const repo = tempRepo({ 'a.txt': 'a\n' });
  assert.deepEqual(resolveBase(repo, null), { ref: null, source: null });
  assert.deepEqual(resolveBase(repo, 'main'), { ref: 'main', source: '--base' });
  assert.ok(DEFAULT_STEPS[1].prepare({ root: repo, base: resolveBase(repo, null) }).notRun);
  assert.ok(DEFAULT_STEPS[2].prepare({ root: repo }).cannotRun);
  assert.deepEqual(DEFAULT_STEPS[4].prepare({ root }).argv, ['pnpm', 'test']);
});

test('a pnpm step whose package.json script was rewritten is an error and is not run', () => {
  assert.deepEqual(scriptProblems(root, [['package.json', 'test'], ['frontend/package.json', 'test'], ['backend/package.json', 'test']]), []);
  const repo = tempRepo({ 'package.json': JSON.stringify({ scripts: { test: 'echo ok' } }) });
  assert.equal(scriptProblems(repo, [['package.json', 'test']]).length, 1);
  assert.equal(scriptProblems(repo, [['package.json', 'build']]).length, 1);
  const marker = path.join(tmp(), 'ran');
  const touch = () => ({ argv: [NODE, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, '')`] });
  const pinned = step('test', touch, { pinned: [['package.json', 'test']] });
  const { evidence } = runVerify({ root: repo, steps: [pinned], outDir: tmp() });
  assert.equal(evidence.steps[0].status, STATUS.ERROR);
  assert.match(evidence.steps[0].note, /스크립트가 기대와 다릅니다/);
  assert.equal(fs.existsSync(marker), false);
});

test('the dirty flag is true when anything is uncommitted, before or during the run', () => {
  const repo = tempRepo({ 'a.txt': 'a\n' });
  const clean = runVerify({ root: repo, steps: [step('ok', () => exits(0))], outDir: tmp() }).evidence;
  assert.equal(clean.dirty, false);
  const writes = step('writes', () => ({ argv: [NODE, '-e', "require('fs').writeFileSync('made-by-step.txt', '')"] }));
  const during = runVerify({ root: repo, steps: [writes], outDir: tmp() }).evidence;
  assert.deepEqual([during.dirtyAtStart, during.dirtyAtEnd, during.dirty], [false, true, true]);
  const before = runVerify({ root: repo, steps: [step('ok', () => exits(0))], outDir: tmp() }).evidence;
  assert.deepEqual([before.dirtyAtStart, before.dirty, before.dirtyFiles], [true, true, ['made-by-step.txt']]);
});

test('the command line: help lists the commands, unknown input exits 2, and no option reaches the step list', () => {
  const help = cli('help');
  assert.equal(help.status, 0);
  for (const name of ['check', 'verify', 'classify', 'new-object', 'add-field', 'help']) assert.match(help.stdout, new RegExp(`^  ${name}`, 'm'));
  assert.equal(cli('no-such-command').status, 2);
  assert.equal(cli().status, 2);
  const refused = [['verify', '--steps', 'x'], ['verify', '--steps=x'], ['verify', '--kind=REAL'], ['verify', '--base'], ['verify', 'extra'],
    ['check', '--strict']];
  for (const args of refused) assert.equal(cli(...args).status, 2, args.join(' '));
  assert.equal(JSON.parse(cli('no-such-command', '--json').stdout).exitCode, 2);
});

test('crm check exits with the same code as the guard', () => {
  const guard = spawnSync(NODE, ['scripts/guard/run.mjs'], { cwd: root, encoding: 'utf8' });
  const check = cli('check', '--json');
  assert.equal(check.status, guard.status);
  const body = JSON.parse(check.stdout);
  assert.equal(body.exitCode, guard.status);
  assert.equal(body.ok, guard.status === 0);
  assert.equal(body.guard.evidenceKind, 'SYNTHETIC');
});

test('classify prints the four types as a form and as data', () => {
  assert.deepEqual(TYPES.map(type => [type.id, type.name]), [['A', '설정 변경'], ['B', '기존 능력의 새 조합'], ['C', '새 능력'], ['D', '진짜 예외']]);
  const text = cli('classify');
  assert.equal(text.status, 0);
  assert.equal(text.stdout, `${renderClassify()}\n`);
  for (const type of TYPES) assert.match(text.stdout, new RegExp(`^\\| ${type.id} \\| ${type.name} \\|`, 'm'));
  assert.deepEqual(JSON.parse(cli('classify', '--json').stdout), JSON.parse(JSON.stringify(classifyData())));
  assert.ok(classifyData().types.every(type => type.zonePath && type.evidence.length > 0));
});

test('new-object and add-field check their arguments, exit 3 and create no file', () => {
  const snapshot = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
    + fs.readdirSync(path.join(root, 'metadata'), { recursive: true }).sort().join('\n');
  const before = snapshot();
  const made = cli('new-object', 'visit_plan');
  assert.equal(made.status, 3);
  assert.match(made.stderr, /F1에서 구현/);
  const field = cli('add-field', 'visit_plan', 'planned_on', 'date', '--json');
  assert.equal(field.status, 3);
  assert.deepEqual(JSON.parse(field.stdout).filesCreated, []);
  for (const args of [['new-object'], ['new-object', 'Visit'], ['new-object', 'visit-plan'], ['new-object', '../x'], ['new-object', 'a', 'b'],
    ['add-field', 'visit_plan', 'planned_on'], ['add-field', 'visit_plan', 'planned_on', 'money'], ['add-field', 'visit_plan', 'Planned', 'date']]) {
    assert.equal(cli(...args).status, 2, args.join(' '));
  }
  assert.equal(snapshot(), before);
  assert.equal(planNewObject(['visit_plan']).ok, true);
  assert.deepEqual(FIELD_TYPES.map(type => planAddField(['a_b', 'c_d', type]).ok), FIELD_TYPES.map(() => true));
});
