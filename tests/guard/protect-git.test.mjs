// The protect check compares with a base commit read from git. These are the shapes of history and of the working tree
// in which a naive comparison would be wrong: a test file replaced by a link, two common ancestors, a shallow clone.
// Each shape is built in a throwaway repository and run through the real runner: it must be a failure or an error, never a pass.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { GuardError, resolveBase } from '../../scripts/guard/lib/gitbase.mjs';
import { BOUND, NODE, makeSandbox, tempDir } from './sandbox.mjs';

const SAMPLE = 'tests/sample.test.mjs';
const box = makeSandbox(BOUND);
const protect = ref => { const run = box.guard('--protect', ref); return { status: run.status, output: run.stdout + run.stderr }; };
const result = () => box.result('protect-result.json');

test('a test file replaced by a link to the same text is a lost test file (through the runner)', () => {
  box.reset();
  box.write({ 'notes/sample-copy.txt': box.read(SAMPLE) });
  fs.rmSync(path.join(box.dir, SAMPLE));
  fs.symlinkSync('../notes/sample-copy.txt', path.join(box.dir, SAMPLE));
  assert.equal(fs.readFileSync(path.join(box.dir, SAMPLE), 'utf8'), box.read('notes/sample-copy.txt'));
  const run = protect('HEAD');
  assert.equal(run.status, 1, run.output);
  assert.deepEqual(result().rules.find(rule => rule.id === 'P3').violations.map(item => item.declare),
    [{ rule: 'P3', file: SAMPLE, from: { tests: 2, groups: 1 }, to: null }]);
  box.reset();
});

test('two common ancestors (a criss-cross merge) are an error (exit 2): the guard does not pick one', () => {
  box.reset();
  const home = box.git('rev-parse', '--abbrev-ref', 'HEAD');
  const merge = (subject, what) => box.git('merge', '-q', '--no-ff', '--no-verify', '-m', subject, what);
  try {
    box.git('checkout', '-q', '-b', 'left');
    const left = box.commit('[F0-5] left');
    box.git('checkout', '-q', '-b', 'right', box.base);
    const right = box.commit('[F0-5] right');
    merge('[F0-5] right takes left', left);
    box.git('checkout', '-q', 'left');
    merge('[F0-5] left takes right', right);
    assert.deepEqual(box.git('merge-base', '--all', 'left', 'right').split('\n').sort(), [left, right].sort());
    const run = protect('right');
    assert.equal(run.status, 2, run.output);
    assert.equal(result().status, 'ERROR');
    assert.match(run.output, /2개/);
    assert.throws(() => resolveBase(box.dir, 'right'), GuardError);
    // With one common ancestor the same repository is compared normally.
    assert.equal(protect(left).status, 0);
    assert.equal(resolveBase(box.dir, left).mergeBase, left);
    assert.equal(protect(box.base).status, 0);
  } finally {
    box.git('checkout', '-q', '-f', home);
    box.git('branch', '-q', '-D', 'left', 'right');
    box.reset();
  }
});

test('a shallow clone whose history is cut at or after the common ancestor is an error (exit 2)', () => {
  box.reset();
  const made = [box.commit('[F0-5] one'), box.commit('[F0-5] two'), box.commit('[F0-5] three')];
  try {
    const clone = path.join(tempDir(), 'clone');
    execFileSync('git', ['clone', '-q', '--depth', '2', `file://${box.dir}`, clone], { stdio: 'ignore' });
    const link = path.relative(box.dir, box.typescriptLink);
    fs.mkdirSync(path.dirname(path.join(clone, link)), { recursive: true });
    fs.symlinkSync(fs.readlinkSync(box.typescriptLink), path.join(clone, link), 'junction');
    const git = (...args) => execFileSync('git', args, { cwd: clone, encoding: 'utf8' }).trim();
    assert.equal(git('rev-parse', '--is-shallow-repository'), 'true');
    assert.equal(git('rev-list', '--count', 'HEAD'), '2');
    // The clone holds the guard itself (it is committed in the sandbox), so its own runner is started there.
    const run = ref => spawnSync(NODE, ['scripts/guard/run.mjs', '--protect', ref], { cwd: clone, encoding: 'utf8' }).status;
    const at = ref => {
      try { return resolveBase(clone, ref).mergeBase; } catch (error) { assert.ok(error instanceof GuardError, String(error)); return 'ERROR'; }
    };
    // HEAD is whole. HEAD~1 is where the history was cut: its parents are missing, so what looks like the ancestor may not be it.
    assert.deepEqual([at('HEAD'), at('HEAD~1'), at(made[1])], [made[2], 'ERROR', 'ERROR']);
    assert.deepEqual([run('HEAD'), run('HEAD~1'), run(made[1]), run(made[0])], [0, 2, 2, 2]);
    assert.throws(() => resolveBase(clone, made[0]), GuardError, 'a commit the clone does not have');
    // The same clone with its whole history fetched is compared normally.
    git('fetch', '-q', '--unshallow');
    assert.equal(git('rev-parse', '--is-shallow-repository'), 'false');
    assert.deepEqual([at('HEAD'), at('HEAD~1'), at(made[0])], [made[2], made[1], made[0]]);
    assert.deepEqual([run('HEAD'), run('HEAD~1'), run(made[0])], [0, 0, 0]);
    // A cut that hides the real ancestor without touching the one git then finds: the other branch reaches `middle`
    // only through `part`, and with `part` cut off git answers with the older commit `made[2]`.
    const as = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid'];
    const commit = subject => { git(...as, 'commit', '-q', '--allow-empty', '--no-verify', '-m', subject); };
    const head = () => git('rev-parse', 'HEAD');
    git('checkout', '-q', '-b', 'mine');
    commit('[F0-5] middle');
    const middle = head();
    commit('[F0-5] mine');
    git('checkout', '-q', '-b', 'part-side', middle);
    commit('[F0-5] part');
    const part = head();
    git('checkout', '-q', '-b', 'theirs', made[2]);
    commit('[F0-5] theirs');
    git(...as, 'merge', '-q', '--no-ff', '--no-verify', '-m', '[F0-5] theirs takes part', part);
    git('checkout', '-q', 'mine');
    assert.equal(at('theirs'), middle);
    fs.writeFileSync(path.join(clone, '.git/shallow'), `${part}\n`);
    assert.equal(git('merge-base', '--all', 'theirs', 'HEAD'), made[2], 'git itself now names the older commit');
    assert.equal(at('theirs'), 'ERROR');
    assert.equal(run('theirs'), 2);
    // A cut that is not between the two tips and their ancestor changes nothing.
    fs.writeFileSync(path.join(clone, '.git/shallow'), `${made[1]}\n`);
    assert.equal(at('HEAD~1'), middle);
    assert.equal(run('HEAD~1'), 0);
  } finally { box.reset(); }
});
