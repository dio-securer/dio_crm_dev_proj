// `crm verify` deletes the evidence bundles of other commits before it writes its own. That clean-up must never follow
// a symbolic link: with `.guard`, `.guard/evidence` or one entry of it replaced by a link, it would delete files that
// are not evidence at all. Each case puts a folder with files OUTSIDE the sandbox repository behind a link, runs the
// real command, and checks: exit 2, verdict ERROR, nothing deleted on either side of the link, the link still there.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { EVIDENCE_DIR, evidenceProblem, pruneEvidence, runVerify } from '../../scripts/crm/lib/verify.mjs';
import { NODE, makeSandbox, tempDir, writeFiles } from './sandbox.mjs';

const box = makeSandbox();
const GUARD_DIR = path.join(box.dir, '.guard');
const EVIDENCE = path.join(box.dir, EVIDENCE_DIR);
const OLD = '0123456789ab';
const short = () => box.git('rev-parse', 'HEAD').slice(0, 12);
const verify = (...args) => spawnSync(NODE, ['scripts/crm/cli.mjs', 'verify', ...args], { cwd: box.dir, encoding: 'utf8' });
const isLink = file => fs.lstatSync(file).isSymbolicLink();

/** Every file below `dir` with its text, links not followed: what must be the same before and after. */
function tree(dir, prefix = '') {
  const out = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const name = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) out[name] = `link -> ${fs.readlinkSync(path.join(dir, entry.name))}`;
    else if (entry.isDirectory()) Object.assign(out, { [`${name}/`]: 'folder' }, tree(path.join(dir, entry.name), `${name}/`));
    else out[name] = fs.readFileSync(path.join(dir, entry.name), 'utf8');
  }
  return out;
}

/** A folder outside the sandbox repository that looks like an evidence folder and holds files that are not evidence. */
function victim() {
  const dir = tempDir('crm-victim-');
  assert.ok(path.relative(box.dir, dir).startsWith('..'), 'the victim is outside the repository');
  writeFiles(dir, {
    'keep.txt': 'not evidence\n', 'evidence/keep.txt': 'not evidence\n', [`evidence/${OLD}/evidence.json`]: '{"verdict":"PASS"}\n',
    'evidence/photos/a.txt': 'a\n', [`${OLD}/summary.md`]: 'old\n',
  });
  return dir;
}

function fresh() {
  box.reset();
  fs.rmSync(GUARD_DIR, { recursive: true, force: true });
}

/** What is in the sandbox's own .guard folder (null when it is not a real folder). */
const inside = () => (fs.existsSync(GUARD_DIR) && fs.lstatSync(GUARD_DIR).isDirectory() ? tree(GUARD_DIR) : null);

/** Run verify both ways and check that it refused and that neither side of the link lost anything. */
function refused(label, victimDir, links) {
  const before = [tree(victimDir), inside()];
  const json = verify('--json');
  assert.equal(json.status, 2, `${label}\n${json.stdout}${json.stderr}`);
  const answer = JSON.parse(json.stdout);
  assert.deepEqual([answer.ok, answer.exitCode, answer.verdict], [false, 2, 'ERROR'], label);
  assert.match(answer.error, /링크|폴더가 아닙니다/, label);
  const text = verify();
  assert.equal(text.status, 2, `${label}\n${text.stdout}${text.stderr}`);
  assert.match(text.stdout + text.stderr, /판정: ERROR/, label);
  assert.doesNotMatch(text.stdout + text.stderr, /판정: PASS/, label);
  assert.throws(() => runVerify({ root: box.dir }), /증거 꾸러미를 만들지 않았습니다/, label);
  for (const link of links) assert.ok(isLink(link), `${label}: the link is still a link`);
  assert.deepEqual([tree(victimDir), inside()], before, label);
  assert.equal(fs.existsSync(path.join(victimDir, short())), false, `${label}: nothing was written behind the link`);
  assert.equal(fs.existsSync(path.join(victimDir, 'evidence', short())), false, `${label}: nothing was written behind the link`);
}

test('.guard is a link to a folder outside the repository: nothing is deleted or written there', () => {
  fresh();
  const dir = victim();
  fs.symlinkSync(dir, GUARD_DIR, 'dir');
  refused('.guard', dir, [GUARD_DIR]);
  fs.unlinkSync(GUARD_DIR);
  assert.equal(Object.keys(tree(dir)).length, 9);
});

test('.guard/evidence is a link to a folder outside the repository: nothing is deleted or written there', () => {
  fresh();
  const dir = victim();
  fs.mkdirSync(GUARD_DIR);
  fs.symlinkSync(path.join(dir, 'evidence'), EVIDENCE, 'dir');
  refused('.guard/evidence', dir, [EVIDENCE]);
  // A relative link, and a link to a link.
  fs.unlinkSync(EVIDENCE);
  fs.symlinkSync(path.relative(GUARD_DIR, path.join(dir, 'evidence')), EVIDENCE, 'dir');
  refused('.guard/evidence (relative)', dir, [EVIDENCE]);
  fs.unlinkSync(EVIDENCE);
  fs.symlinkSync(path.join(dir, 'evidence'), path.join(GUARD_DIR, 'hop'), 'dir');
  fs.symlinkSync('hop', EVIDENCE, 'dir');
  refused('.guard/evidence (link to a link)', dir, [EVIDENCE, path.join(GUARD_DIR, 'hop')]);
});

test('an entry of .guard/evidence is a link: the run stops before it deletes anything, the real old bundle included', () => {
  const kinds = {
    'a folder outside': dir => dir,
    'a file outside': dir => path.join(dir, 'keep.txt'),
    'nothing (a dangling link)': dir => path.join(dir, 'no-such-file'),
    'the repository itself': () => box.dir,
  };
  for (const [what, target] of Object.entries(kinds)) {
    for (const name of ['aaaaaaaaaaaa', short(), 'zzz']) {
      fresh();
      const dir = victim();
      writeFiles(EVIDENCE, { [`${OLD}/evidence.json`]: '{"verdict":"PASS"}\n', 'stray.txt': 'x\n' });
      fs.symlinkSync(target(dir), path.join(EVIDENCE, name));
      refused(`${name} -> ${what}`, dir, [path.join(EVIDENCE, name)]);
      assert.deepEqual(fs.readdirSync(EVIDENCE).sort(), [OLD, name, 'stray.txt'].sort());
      assert.equal(box.read('CLAUDE.md').length > 0, true);
    }
  }
});

test('.guard or .guard/evidence is a file: an error, and the file is left alone', () => {
  fresh();
  const dir = victim();
  fs.writeFileSync(GUARD_DIR, 'a file\n');
  refused('.guard is a file', dir, []);
  assert.equal(fs.readFileSync(GUARD_DIR, 'utf8'), 'a file\n');
  fs.rmSync(GUARD_DIR);
  writeFiles(GUARD_DIR, { evidence: 'a file\n' });
  refused('.guard/evidence is a file', dir, []);
  assert.equal(fs.readFileSync(EVIDENCE, 'utf8'), 'a file\n');
});

test('pruneEvidence itself refuses a link (the folder or an entry) and deletes nothing; without links it works as before', () => {
  const dir = victim();
  const home = tempDir('crm-prune-');
  const link = path.join(home, 'evidence');
  fs.symlinkSync(path.join(dir, 'evidence'), link, 'dir');
  const before = tree(dir);
  assert.throws(() => pruneEvidence(link, 'none'), /심볼릭 링크/);
  assert.match(evidenceProblem(home, link), /심볼릭 링크/);
  fs.unlinkSync(link);
  writeFiles(link, { 'aaa/evidence.json': '{}\n', 'bbb/evidence.json': '{}\n' });
  fs.symlinkSync(dir, path.join(link, 'ccc'), 'dir');
  assert.throws(() => pruneEvidence(link, 'bbb'), /ccc/);
  assert.deepEqual(fs.readdirSync(link).sort(), ['aaa', 'bbb', 'ccc']);
  assert.deepEqual(tree(dir), before);
  // The link is the entry to keep: still refused.
  assert.throws(() => pruneEvidence(link, 'ccc'), /ccc/);
  assert.deepEqual(tree(dir), before);
  fs.unlinkSync(path.join(link, 'ccc'));
  assert.equal(evidenceProblem(home, link), null);
  assert.deepEqual(pruneEvidence(link, 'bbb'), ['aaa']);
  // A folder that is not below the root it is checked against.
  assert.match(evidenceProblem(link, dir), /밖/);
  assert.match(evidenceProblem(link, link), /밖/);
});

test('without any link the same sandbox is verified normally: the old bundle goes, the new one is written', () => {
  fresh();
  writeFiles(EVIDENCE, { [`${OLD}/evidence.json`]: '{"verdict":"PASS"}\n' });
  assert.equal(evidenceProblem(box.dir, EVIDENCE), null);
  const run = runVerify({ root: box.dir });
  assert.deepEqual(run.removed, [OLD]);
  assert.deepEqual(fs.readdirSync(EVIDENCE), [short()]);
});
