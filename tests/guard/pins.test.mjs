// What the guard covers is pinned: every list, number and pattern that decides what a rule looks at or lets through
// must be equal to the snapshot in pins.json, and the generated documents must be equal to what the code renders.
// Weakening a list (one extension fewer, one more excluded folder, a wider test-file pattern) fails here until pins.json
// is changed as well, and pins.json is a protected file: the change is shown to the person who approves the PR.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { MAX_LINES as CLAUDE_MAX_LINES, claudeProblem } from '../../scripts/guard/lib/claude-md.mjs';
import { CODEOWNERS_FILE, loadProtected, renderCodeowners } from '../../scripts/guard/lib/codeowners.mjs';
import { DOCS_FILE, docsInSync, renderDocs } from '../../scripts/guard/lib/docs.mjs';
import { createContext } from '../../scripts/guard/lib/files.mjs';
import { MIN_REASON } from '../../scripts/guard/lib/raises.mjs';
import { MAX_LINE, selfCheck } from '../../scripts/guard/lib/selfcheck.mjs';
import { K, kindSet } from '../../scripts/guard/lib/ts.mjs';
import { MAX_BYTES, MAX_LINES } from '../../scripts/guard/rules/g03-file-size.mjs';
import { RULES } from '../../scripts/guard/rules/index.mjs';
import { PINS_FILE, collectPins, pinned, readPins, root, unpin } from './pins.mjs';
import { tempDir } from './sandbox.mjs';

const HOW = `The coverage of the guard changed. If a person approved this, run: node tests/guard/pins.mjs --write (and commit ${PINS_FILE}).`;
const now = await collectPins();
const frozen = readPins();

test('every module and program of the guard is in the snapshot, and nothing else is', () => {
  assert.deepEqual(Object.keys(now.modules), Object.keys(frozen.modules), HOW);
  assert.deepEqual(Object.keys(now.programs), Object.keys(frozen.programs), HOW);
  assert.deepEqual(Object.keys(now), Object.keys(frozen));
  // The collector looks at real files: every rule file is there, and so are the files of the two libraries.
  for (const rule of RULES) assert.ok(Object.keys(now.modules).some(file => file.includes(`/rules/${rule.id.toLowerCase()}-`)), rule.id);
  assert.ok(Object.keys(now.modules).length >= 30);
});

for (const file of Object.keys(frozen.modules)) {
  test(`pinned: ${file}`, () => {
    const [is, was] = [now.modules[file], frozen.modules[file]];
    assert.ok(is, `${file} is in the snapshot but not in the code. ${HOW}`);
    // Names first, so a constant that was added or removed is named in the failure.
    assert.deepEqual(Object.keys(is.values), Object.keys(was.values), `${file}: exported values. ${HOW}`);
    assert.deepEqual(is.notPinned, was.notPinned, `${file}: top-level values that are not exported. ${HOW}`);
    for (const name of Object.keys(was.values)) assert.deepEqual(is.values[name], was.values[name], `${file} ${name}. ${HOW}`);
    assert.deepEqual(is.patterns, was.patterns, `${file}: regular expressions in the source. ${HOW}`);
    assert.deepEqual(is.numbers, was.numbers, `${file}: numbers in the source. ${HOW}`);
  });
}

test('pinned: the programs (source only), the protected paths and the change-id start point', () => {
  assert.deepEqual(now.programs, frozen.programs, HOW);
  assert.deepEqual(now.data, frozen.data, HOW);
  assert.ok(frozen.data.protectedPaths.includes('/tests/guard/') && frozen.data.protectedPaths.includes('/scripts/guard/'));
});

test('the limits are these numbers, written here as numbers', () => {
  assert.equal(MAX_LINES, 300);
  assert.equal(MAX_BYTES, 15000);
  assert.equal(MAX_LINE, 160);
  assert.equal(CLAUDE_MAX_LINES, 120);
  assert.equal(MIN_REASON, 10);
  assert.equal(pinned('scripts/guard/rules/g03-file-size.mjs', 'MAX_LINES'), 300);
  assert.equal(pinned('scripts/guard/lib/selfcheck.mjs', 'MAX_LINE'), 160);
});

test('the guard, its tests and the crm command of this repository have no line over 160 characters', () => {
  assert.deepEqual(selfCheck(createContext(root)), []);
});

test('the snapshot is read back as it was written, and a syntax kind that does not exist is an error', () => {
  assert.deepEqual(unpin({ $set: ['a', { $text: ['b', 'c'] }] }), ['a', 'bc']);
  assert.equal(String(unpin({ $regex: 'a+', flags: 'i' })), '/a+/i');
  assert.throws(() => pinned('scripts/guard/lib/files.mjs', 'NO_SUCH_NAME'));
  assert.deepEqual(pinned('scripts/guard/lib/files.mjs', 'TEST_ROOTS'), ['backend/test/', 'tests/']);
  assert.deepEqual([...kindSet(['AwaitExpression'])], [K.AwaitExpression]);
  assert.throws(() => kindSet(['AwaitExpression', 'NoSuchKind']), /NoSuchKind/);
});

test('guard-rules.md, CODEOWNERS and the CLAUDE.md blocks of this repository are exactly what the code renders', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal(read(DOCS_FILE), renderDocs(RULES), 'run: node scripts/guard/run.mjs --docs');
  assert.equal(read(CODEOWNERS_FILE), renderCodeowners(loadProtected(root)), 'run: node scripts/guard/run.mjs --codeowners');
  assert.equal(claudeProblem(root, RULES), null);
  // Every rule is in the document with its own heading, its scope and its limits.
  for (const rule of RULES) {
    assert.ok(read(DOCS_FILE).includes(`\n### ${rule.id} ${rule.name}\n\n- 범위: ${rule.scope}\n`), rule.id);
    for (const item of [...rule.exclusions, ...rule.limits]) assert.ok(read(DOCS_FILE).includes(`\n  - ${item}\n`), `${rule.id}: ${item.slice(0, 40)}`);
  }
});

test('the document comparison is exact: any difference, however small, is drift', () => {
  const dir = tempDir();
  const file = path.join(dir, DOCS_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const right = renderDocs(RULES);
  const write = text => { fs.writeFileSync(file, text); return docsInSync(dir, RULES); };
  assert.equal(write(right), true);
  const wrongs = [`${right}\n`, right.slice(0, -1), right.replace(/\n/g, '\r\n'), right.replace('\n\n', '\n \n'), right.replace('G01', 'g01'), ` ${right}`,
    right.replace('한 건이라도 있으면 실패한다', '한 건이라도 있으면 경고한다'), right.replace(/\n### G11 [^]*$/, '\n'), right.toLowerCase(), `﻿${right}`, ''];
  wrongs.forEach((text, index) => { assert.notEqual(text, right, `case ${index}`); assert.equal(write(text), false, `case ${index}`); });
  fs.rmSync(file);
  assert.equal(docsInSync(dir, RULES), false);
  // A rule whose description changed gives another document.
  const edited = RULES.map((rule, index) => (index === 0 ? { ...rule, limits: [...rule.limits, 'x'] } : rule));
  assert.notEqual(renderDocs(edited), right);
  assert.equal(write(right) && !docsInSync(dir, edited), true);
});
