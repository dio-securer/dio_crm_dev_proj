// The permanent trial of every guard rule (G01-G12): the fixtures of tests/guard/trials are written into a throwaway
// repository, the real runner is started there, and its exit code and report are compared with what must be caught.
// Weakening a rule makes one of its failing fixtures pass, or one of its near-misses fail, and this file goes red.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from '../../scripts/guard/rules/index.mjs';
import { makeSandbox, violationsOf } from './sandbox.mjs';
import { MIN_FAIL, MIN_PASS, TRIALS } from './trials/index.mjs';

const box = makeSandbox();
const textOf = value => (Array.isArray(value) ? value[0] : value);
const texts = map => Object.fromEntries(Object.entries(map).map(([file, value]) => [file, textOf(value)]));
const fileTrials = TRIALS.filter(trial => !Array.isArray(trial.fail));
const sorted = list => [...list].sort();

test('every registered rule has a trial, and every trial belongs to a registered rule', () => {
  assert.deepEqual(TRIALS.map(trial => trial.id).sort(), RULES.map(rule => rule.id).sort());
  assert.equal(new Set(TRIALS.map(trial => trial.id)).size, TRIALS.length);
  for (const trial of TRIALS) {
    const size = part => (Array.isArray(part) ? part.length : Object.keys(part).length);
    assert.ok(size(trial.fail) >= MIN_FAIL, `${trial.id}: at least ${MIN_FAIL} failing fixtures`);
    assert.ok(size(trial.pass) >= MIN_PASS, `${trial.id}: at least ${MIN_PASS} near-miss`);
  }
});

test('the untouched sandbox passes, so every failure below comes from a fixture', () => {
  const run = box.guard('--strict');
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.deepEqual(box.result().rules.map(rule => rule.id).sort(), RULES.filter(rule => rule.defaultRun !== false).map(rule => rule.id).sort());
  assert.deepEqual(box.result().rules.map(rule => rule.status), box.result().rules.map(() => 'PASS'));
});

for (const trial of fileTrials) {
  test(`${trial.id} reports every failing fixture and nothing else`, () => {
    box.reset();
    box.write({ ...texts(trial.pass), ...texts(trial.fail) });
    const run = box.guard();
    assert.equal(run.status, 1, run.stdout + run.stderr);
    const result = box.result();
    assert.equal(result.status, 'FAIL');
    const found = violationsOf(result);
    assert.deepEqual(sorted(Object.keys(found[trial.id] ?? {})), sorted(Object.keys(trial.fail)), `${trial.id}: reported files`);
    for (const [file, value] of Object.entries(trial.fail)) {
      if (Array.isArray(value)) assert.equal(found[trial.id][file], value[1], `${trial.id}: findings in ${file}`);
    }
    const others = Object.entries(found).filter(([id]) => id !== trial.id).flatMap(([id, files]) => Object.keys(files).map(file => `${id} ${file}`));
    const allowed = RULES.flatMap(rule => (trial.overlap ?? []).map(file => `${rule.id} ${file}`));
    assert.deepEqual(others.filter(item => !allowed.includes(item)), [], `${trial.id}: fixtures reported by another rule`);
    assert.equal(result.rules.find(rule => rule.id === trial.id).status, 'FAIL');
  });
}

test('all near-misses together pass every rule', () => {
  box.reset();
  const files = fileTrials.flatMap(trial => Object.keys(trial.pass));
  assert.equal(new Set(files).size, files.length, 'near-miss paths are unique across trials');
  box.write(Object.assign({}, ...fileTrials.map(trial => texts(trial.pass))));
  const run = box.guard();
  assert.deepEqual(violationsOf(box.result()), {});
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('G09: a commit without a change ID fails, IDs in both forms pass, an empty range is an error', () => {
  const trial = TRIALS.find(item => item.id === 'G09');
  const commits = name => box.result('guard-commits-result.json').rules[0][name];
  box.reset();
  const range = `${box.first}..HEAD`;
  // An empty range is an error. A range that holds only the exempt commit is not empty: nothing to check, nothing wrong.
  assert.equal(box.guard('--commits', 'HEAD..HEAD').status, 2);
  assert.equal(box.guard('--commits', `${box.first}..${box.exempt}`).status, 0);
  assert.deepEqual([commits('checkedCommits'), commits('exemptCommits')], [0, 1]);
  for (const subject of trial.pass) box.commit(subject);
  let run = box.guard('--commits', range);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.deepEqual([commits('checkedCommits'), commits('exemptCommits'), commits('newViolations').length], [trial.pass.length + 1, 1, 0]);
  const bad = trial.fail.map(subject => box.commit(subject).slice(0, 12));
  run = box.guard(`--commits=${range}`);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.deepEqual(sorted(commits('newViolations').map(item => item.file)), sorted(bad));
  assert.equal(commits('checkedCommits'), trial.pass.length + trial.fail.length + 1);
  // One bad commit is enough, and a later good commit does not hide it.
  box.reset();
  box.commit(trial.fail[0]);
  box.commit(trial.pass[0]);
  assert.equal(box.guard('--commits', range).status, 1);
  assert.equal(box.guard('--commits', 'HEAD~1..HEAD').status, 0);
  // A merge commit is not checked, the commits it brings in are.
  box.reset();
  box.git('checkout', '-q', '-b', 'side');
  box.commit(trial.pass[0]);
  box.git('checkout', '-q', '-');
  box.commit(trial.pass[1]);
  box.git('merge', '-q', '--no-ff', '--no-verify', '-m', 'merge without an id', 'side');
  assert.equal(box.guard('--commits', range).status, 0);
  assert.equal(commits('checkedCommits'), 3);
  // Unusable input is an error, never a pass.
  for (const wrong of ['HEAD', 'no-such-ref..HEAD', '--all..HEAD']) assert.equal(box.guard('--commits', wrong).status, 2, wrong);
  box.remove('scripts/guard/commit-id-start.json');
  assert.equal(box.guard('--commits', range).status, 2);
  box.write({ 'scripts/guard/commit-id-start.json': `${JSON.stringify({ lastExemptCommit: 'f'.repeat(40) })}\n` });
  assert.equal(box.guard('--commits', range).status, 2);
});
