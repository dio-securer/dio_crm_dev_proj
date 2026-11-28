// Two things that keep the trial honest.
// (1) Canaries: the guard makes no exception for itself. A violating file in the guard's own folders, in its tests, in
//     the crm command, in docs/, and in zone folders that only carry such a name, is reported like any other file.
// (2) The fixtures are tied to the pinned snapshot: a list in tests/guard/trials that says "one per member" really has
//     one per member of the pinned list, so a member cannot be added to the code without a fixture for it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTestFile, isTestName, looksLikeTest } from '../../scripts/guard/lib/files.mjs';
import { RULES } from '../../scripts/guard/rules/index.mjs';
import { pinned } from './pins.mjs';
import { BASE_FILES, makeSandbox, violationsOf } from './sandbox.mjs';
import { CANARIES, DOCS, INNER, OWN } from './trials/canaries.mjs';
import { CODE_EXT, KEY_WORDS, LEGACY_CONTRACTS, NOT_TESTISH, SYNTAX, TESTISH, UNWRAP_KINDS, WRAPPED, keyPattern } from './trials/members.mjs';
import { NOT_TEST_DIRS, NOT_TEST_NAMES } from './trials/shapes-code.mjs';
import { HANGUL_BLOCKS, LEAF_SOURCE, LEAVES, hangulPattern } from './trials/shapes-zones.mjs';

const box = makeSandbox();
const sorted = list => [...list].sort();
const lib = (file, name) => pinned(`scripts/guard/lib/${file}.mjs`, name);
const rule = (file, name) => pinned(`scripts/guard/rules/${file}.mjs`, name);

test('canaries: a violation in the guard itself, its tests, the crm command, docs/ or a look-alike folder is reported', () => {
  box.reset();
  const paths = Object.values(CANARIES).flatMap(files => Object.keys(files));
  assert.equal(new Set(paths).size, paths.length, 'one canary per path');
  box.write(Object.assign({}, ...Object.values(CANARIES)));
  const run = box.guard();
  assert.equal(run.status, 1, run.stdout + run.stderr);
  const found = violationsOf(box.result());
  for (const [id, files] of Object.entries(CANARIES)) assert.deepEqual(sorted(Object.keys(found[id] ?? {})), sorted(Object.keys(files)), id);
  assert.deepEqual(sorted(Object.keys(found)), sorted(Object.keys(CANARIES)));
  // Every rule of a default run has canaries, and every protected place of the guard is among them.
  assert.deepEqual(sorted(Object.keys(CANARIES)), sorted(RULES.filter(item => item.defaultRun !== false).map(item => item.id)));
  for (const dir of lib('selfcheck', 'SELF_DIRS')) assert.ok(OWN.includes(dir), dir);
  for (const dir of lib('files', 'TEST_ROOTS')) assert.ok(INNER.includes(dir.replace(/\/$/, '')), dir);
  for (const id of ['G03', 'G05', 'G08']) {
    for (const dir of [...OWN, ...DOCS]) assert.ok(Object.keys(CANARIES[id]).some(file => file.startsWith(dir)), `${id} ${dir}`);
  }
});

test('canaries: each one alone is enough to fail the run (no canary hides behind another)', () => {
  for (const [id, files] of Object.entries(CANARIES)) {
    // One per rule and place is run alone: the first and the last of each rule.
    const names = Object.keys(files);
    for (const file of [names[0], names[names.length - 1]]) {
      box.reset();
      box.write({ [file]: files[file] });
      const run = box.guard();
      assert.equal(run.status, 1, `${id} ${file}\n${run.stdout}`);
      assert.deepEqual(Object.keys(violationsOf(box.result())[id] ?? {}), [file], `${id} ${file}`);
    }
  }
});

test('the fixtures follow the pinned lists: syntax kinds, key words, Hangul blocks, extensions, test folders', () => {
  // Every kind `unwrap` looks through has source text here; the one that cannot be written is named.
  assert.deepEqual(sorted(Object.keys(WRAPPED)), sorted(UNWRAP_KINDS));
  assert.deepEqual(Object.keys(WRAPPED).filter(kind => WRAPPED[kind] === null), ['PartiallyEmittedExpression']);
  for (const kind of [...lib('branching', 'EQUALITY'), ...lib('branching', 'EITHER'), ...rule('g08-disabled-tests', 'ASSIGN')]) {
    assert.equal(typeof SYNTAX[kind], 'string', kind);
  }
  assert.deepEqual(sorted(Object.keys(SYNTAX)), sorted(new Set([...lib('branching', 'EQUALITY'), ...lib('branching', 'EITHER'),
    ...rule('g08-disabled-tests', 'ASSIGN')])));
  // The patterns are rebuilt here from plain lists and must be the pinned patterns, character for character.
  assert.equal(lib('branching', 'KEY').source, keyPattern);
  assert.equal(lib('branching', 'KEY').flags, '');
  assert.deepEqual(KEY_WORDS, ['company', 'country', 'market', 'tenant', 'nation']);
  assert.equal(rule('g04-hardcoded-ui-text', 'HANGUL').source, hangulPattern);
  assert.equal(rule('g04-hardcoded-ui-text', 'HANGUL').flags, '');
  assert.deepEqual(HANGUL_BLOCKS, [[0x1100, 0x11FF], [0x3130, 0x318F], [0xA960, 0xA97F], [0xAC00, 0xD7FF]]);
  assert.deepEqual(sorted(Object.keys(LEAF_SOURCE)), sorted(LEAVES));
  assert.equal(LEAVES.length, 9);
  assert.deepEqual(CODE_EXT, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
  assert.deepEqual(lib('files', 'STYLE_EXT'), ['.css', '.scss']);
  assert.deepEqual(rule('g01-metadata-only-config', 'ALLOWED'), ['.json', '.yaml', '.yml', '.md']);
  assert.deepEqual(rule('g01-metadata-only-config', 'ALLOWED_NAMES'), ['.gitkeep']);
  assert.deepEqual(rule('g03-file-size', 'METADATA_EXT'), ['.json', '.yaml', '.yml']);
  assert.deepEqual(rule('g05-raw-style', 'EXT'), ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);
  assert.deepEqual(rule('g05-raw-style', 'TOKEN_SOURCES'), ['frontend/src/styles/tokens.css']);
  assert.deepEqual(rule('g06-company-branching', 'EXCLUDED_FILES'), []);
  assert.equal(rule('g07-direct-io', 'ALLOWED').length, 4);
  assert.equal(rule('g03-file-size', 'EXCLUDED_DIRS').length, 4);
  for (const name of LEGACY_CONTRACTS) assert.ok(`packages/contracts/src/${name}` in BASE_FILES, name);
});

test('what counts as a test file: two name forms and two folders, and nothing that only looks like them', () => {
  const TESTISH_DIR = lib('files', 'TESTISH_DIR');
  const TEST_NAME = lib('files', 'TEST_NAME');
  assert.equal(String(TESTISH_DIR), String.raw`/(^|\/)(__tests__|tests?|e2e|specs?|__mocks__)\//i`);
  assert.equal(String(TEST_NAME), String.raw`/\.(spec|test)\.[cm]?[jt]sx?$/i`);
  assert.deepEqual(lib('files', 'TEST_ROOTS'), ['backend/test/', 'tests/']);
  for (const dir of TESTISH) {
    for (const file of [`${dir}/a.js`, `x/${dir}/a.js`, `x/y/${dir}/z/a.js`]) assert.ok(TESTISH_DIR.test(file) && looksLikeTest(file), file);
    assert.ok(!TESTISH_DIR.test(`x/${dir}.js`) && !TESTISH_DIR.test(`x/a${dir}/a.js`) && !TESTISH_DIR.test(`x/${dir}a/a.js`), dir);
  }
  for (const dir of NOT_TESTISH) assert.ok(!TESTISH_DIR.test(`x/${dir}/a.js`) && !looksLikeTest(`x/${dir}/a.js`), dir);
  for (const ext of CODE_EXT) {
    for (const word of ['spec', 'test', 'SPEC', 'Test']) assert.ok(TEST_NAME.test(`src/a.${word}${ext}`) && isTestName(`src/a.${word}${ext}`), `${word}${ext}`);
    // A mock, a story, a fixture or a helper is ordinary code: every rule looks at it.
    for (const word of ['mock', 'mocks', 'stories', 'fixture', 'testing', 'tests', 'specs', 'e2e', 'bench', 'test-utils']) {
      const file = `backend/src/a.${word}${ext}`;
      assert.ok(!TEST_NAME.test(file) && !isTestName(file) && !isTestFile(file) && !looksLikeTest(file), file);
    }
  }
  for (const file of ['a.test.ts.bak', 'a.test.json', 'a.spec.md', 'test.ts', 'spec.js', 'atest.ts', 'a.test.d.ts', 'a.test/b.ts', 'a_test.ts', 'a-spec.ts']) {
    assert.ok(!isTestName(`backend/src/${file}`), file);
  }
  for (const file of ['backend/test/a.ts', 'tests/a.ts', 'tests/deep/er/a.ts']) assert.ok(isTestFile(file), file);
  for (const file of ['backend/tests/a.ts', 'backend/src/test/a.ts', 'x/tests/a.ts', 'testsx/a.ts', 'backend/testing/a.ts', 'frontend/test/a.ts',
    'Tests/a.ts', 'BACKEND/TEST/a.ts', 'backend/test.ts', 'tests.ts']) assert.ok(!isTestFile(file), file);
  // The fixtures of trials/shapes-code.mjs use these names and folders as ordinary code.
  assert.ok(NOT_TEST_NAMES.includes('unit.mock.ts') && NOT_TEST_NAMES.length >= 4 && NOT_TEST_DIRS.length >= 4);
  for (const name of NOT_TEST_NAMES) assert.ok(!isTestFile(`backend/src/${name}`), name);
  for (const dir of NOT_TEST_DIRS) assert.ok(!isTestFile(`${dir}/a.ts`), dir);
});
