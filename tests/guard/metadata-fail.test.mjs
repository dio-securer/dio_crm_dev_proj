// G12 and P6 fail closed: a validator that is there but cannot load is an ERROR (exit 2), never a pass, and P6 fails
// when either side of the comparison cannot be read. Each case kills a mutant that the happy-path tests let live.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { VALIDATOR_FILES, makeSandbox, root } from './sandbox.mjs';

const ENTRY = 'packages/contracts/src/metadata/index.ts';
const FIELDS = 'metadata/objects/lead/fields.json';
const LEAD = Object.fromEntries(['fields.json', 'list-views.json', 'object.json'].map(name => `metadata/objects/lead/${name}`)
  .concat(['metadata/codes/lead_status.json', 'metadata/terms/en-US/lead.json', 'metadata/terms/ko-KR/lead.json'])
  .map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const box = makeSandbox({ files: LEAD });
const g12 = () => box.result().rules.find(rule => rule.id === 'G12');
const p6 = () => box.result('protect-result.json').rules.find(rule => rule.id === 'P6');
const restore = () => { box.reset(); box.write(VALIDATOR_FILES); };

const broken = [
  // Transpile reports a diagnostic, yet the emitted JavaScript still runs: only the diagnostics check catches it.
  ['has transpile diagnostics', `let notAType: = 1;\n${VALIDATOR_FILES[ENTRY]}`],
  // No diagnostic, but the emitted code is not valid JavaScript.
  ['has a syntax error', `${VALIDATOR_FILES[ENTRY]}\nexport function twice(a, a) {}\n`],
  ['imports a file that does not exist', `${VALIDATOR_FILES[ENTRY]}\nexport * from './nope';\n`],
  ['lacks the exported functions', 'export const bundleFromFiles = () => ({ bundle: null, issues: [] });\n'],
];
for (const [what, text] of broken) {
  test(`G12 is an ERROR (exit 2) when the validator ${what}`, () => {
    restore();
    box.write({ [ENTRY]: text });
    const run = box.guard();
    assert.equal(run.status, 2, run.stdout + run.stderr);
    assert.equal(g12().status, 'ERROR');
  });
}

test('protect exits 2, not PASS, when the base has metadata and the validator is missing', () => {
  restore();
  box.remove('packages/contracts/src/metadata');
  const run = box.guard('--protect', box.base);
  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.doesNotMatch(run.stdout, /P6 metadata-compat\s+PASS/);
});

test('protect exits 2, not PASS, when the base has metadata and the validator is broken', () => {
  restore();
  box.write({ [ENTRY]: `let notAType: = 1;\n${VALIDATOR_FILES[ENTRY]}` });
  const run = box.guard('--protect', box.base);
  assert.equal(run.status, 2, run.stdout + run.stderr);
  assert.doesNotMatch(run.stdout, /P6 metadata-compat\s+PASS/);
});

test('P6 fails when the base metadata cannot be loaded', () => {
  restore();
  box.write({ [FIELDS]: '{ "fields": [\n' });
  box.git('add', '-A');
  const brokenBase = box.commit('[F1-2] broken base metadata');
  box.write(LEAD);
  box.git('add', '-A');
  box.commit('[F1-2] fixed metadata');
  const run = box.guard('--protect', brokenBase);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  assert.match(p6().violations[0].text, /기준 커밋/);
});

test('P6 fails when the head metadata cannot be loaded', () => {
  restore();
  box.write({ [FIELDS]: '{ "fields": [\n' });
  const run = box.guard('--protect', box.base);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  assert.match(p6().violations[0].text, /지금의 metadata/);
});

test('P6 reads the head file list: a file only the head has is seen', () => {
  restore();
  box.write({ 'metadata/objects/lead/extra.json': '{ "broken": \n' });
  const run = box.guard('--protect', box.base);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  assert.match(p6().violations[0].text, /지금의 metadata/);
});

// P6 "cannot load" is never declarable: the violation carries no identity (declare is null), and a guard-raises.json
// entry shaped like one (file metadata/, no values) does not turn the run green.
test('P6 "cannot load" cannot be excused by a guard-raises.json entry', () => {
  restore();
  box.write({ [FIELDS]: '{ "fields": [\n' });
  const reason = { reason: 'trying to excuse unreadable metadata', changeId: 'F1-3' };
  const raises = [{ rule: 'P5', file: 'metadata/', from: null, to: null, ...reason }];
  box.write({ 'guard-raises.json': `${JSON.stringify({ raises }, null, 2)}\n` });
  const run = box.guard('--protect', box.base);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.equal(p6().status, 'FAIL');
  assert.match(p6().violations[0].text, /지금의 metadata/);
  assert.equal(p6().violations[0].declare, null);
});
