// The guard must fail closed: when it cannot read something, or when a generated file drifted from its source, the
// run is an error (exit 2) or a failure (exit 1), never a pass. Each case runs the real runner in a throwaway repository.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { MAX_LINES as CLAUDE_MAX_LINES } from '../../scripts/guard/lib/claude-md.mjs';
import { MAX_LINE, SELF_DIRS } from '../../scripts/guard/lib/selfcheck.mjs';
import { makeSandbox, violationsOf } from './sandbox.mjs';

const box = makeSandbox();
const CODEOWNERS = '.github/CODEOWNERS';
const RULE_DOC = 'docs/framework/guard-rules.md';
const PROTECTED = 'scripts/guard/protected-paths.json';
const SYNC_FLAGS = ['docsInSync', 'codeownersInSync', 'claudeInSync'];

/** Apply one change to the clean sandbox and run the guard. */
function after(change, ...args) {
  box.reset();
  change();
  const run = box.guard(...args);
  let result = null;
  try { result = box.result(); } catch { /* the guard stopped before writing a result */ }
  return { status: run.status, output: run.stdout + run.stderr, result };
}
const flags = result => SYNC_FLAGS.filter(name => result[name] === false);
const statusOf = (result, id) => result.rules.find(rule => rule.id === id).status;

test('the clean sandbox passes', () => {
  const run = after(() => {});
  assert.equal(run.status, 0, run.output);
  assert.deepEqual(flags(run.result), []);
});

test('a code file that cannot be parsed is an error (exit 2), wherever a rule reads it', () => {
  const broken = 'export const = ;\n';
  const cases = [['backend/src/svc/broken.ts', ['G06', 'G07', 'G11']], ['tests/unit/broken.test.mjs', ['G08']], ['extensions/acme/broken.ts', ['G02', 'G04']]];
  for (const [file, rules] of cases) {
    const run = after(() => box.write({ [file]: broken }));
    assert.equal(run.status, 2, `${file}\n${run.output}`);
    assert.equal(run.result.status, 'ERROR');
    for (const id of rules) assert.equal(statusOf(run.result, id), 'ERROR', `${id} ${file}`);
  }
  // An error is not hidden by an ordinary violation next to it, and does not hide it.
  const both = after(() => box.write({ 'backend/src/svc/broken.ts': broken, 'metadata/tool.ts': 'export const a = 1;\n' }));
  assert.equal(both.status, 2);
  assert.deepEqual(Object.keys(violationsOf(both.result)), ['G01']);
});

test('a missing or unreadable baseline is an error (exit 2)', () => {
  const total = JSON.stringify({ rules: { G05: { total: 9, files: { ui: { 'a.css': 1 } } } } });
  assert.equal(after(() => box.remove('guard-baseline.json')).status, 2);
  assert.equal(after(() => box.write({ 'guard-baseline.json': '{ not json' })).status, 2);
  assert.equal(after(() => box.write({ 'guard-baseline.json': '{}' })).status, 2);
  assert.equal(after(() => box.write({ 'guard-baseline.json': total })).status, 2);
  assert.equal(after(() => {}, '--init-baseline').status, 2, 'an existing baseline is never overwritten');
  assert.equal(after(() => {}, '--no-such-option').status, 2);
  assert.equal(after(() => {}, '--strict', '--docs').status, 0, '--docs alone decides; kept as it is today');
});

test('a missing input of a rule is an error (exit 2): legacy list, the i18n script, the TypeScript parser', () => {
  const legacy = after(() => box.remove('legacy-files.json'));
  assert.equal(legacy.status, 2, legacy.output);
  assert.equal(statusOf(legacy.result, 'G10'), 'ERROR');
  const script = after(() => box.remove('scripts/i18n/hardcode-check.mjs'));
  assert.equal(script.status, 2, script.output);
  assert.equal(statusOf(script.result, 'G04'), 'ERROR');
  const changed = after(() => box.write({ 'scripts/i18n/hardcode-check.mjs': "console.error('other output');\nprocess.exit(1);\n" }));
  assert.equal(changed.status, 2, changed.output);
  // Without the parser. NODE_PATH and the home folder are emptied so that a copy installed for the whole machine is not found.
  const target = fs.readlinkSync(box.typescriptLink);
  try {
    box.reset();
    fs.unlinkSync(box.typescriptLink);
    const ran = box.guardWith({ NODE_PATH: '', HOME: box.dir, USERPROFILE: box.dir });
    const parser = { status: ran.status, output: ran.stdout + ran.stderr, result: box.result() };
    assert.equal(parser.status, 2, parser.output);
    for (const id of ['G06', 'G07', 'G08', 'G11']) assert.equal(statusOf(parser.result, id), 'ERROR', id);
  } finally { fs.symlinkSync(target, box.typescriptLink, 'junction'); }
});

test('a legacy list written for other rules than the guard has is a G10 failure', () => {
  const run = after(() => box.write({ 'legacy-files.json': JSON.stringify({ ...JSON.parse(box.read('legacy-files.json')), rules: [] }) }));
  assert.equal(run.status, 1, run.output);
  assert.deepEqual(violationsOf(run.result), { G10: { 'legacy-files.json': 1 } });
});

test('CODEOWNERS, CLAUDE.md or guard-rules.md that drifted from the guard fails (exit 1), each named by its own flag', () => {
  const edited = file => () => box.write({ [file]: `${box.read(file)}\nextra line\n` });
  const drift = [
    [edited(CODEOWNERS), ['codeownersInSync']],
    [() => box.remove(CODEOWNERS), ['codeownersInSync']],
    [edited(RULE_DOC), ['docsInSync']],
    // The rule document is a protected path itself, and CLAUDE.md marks protected paths that do not exist: both drift.
    [() => box.remove(RULE_DOC), ['docsInSync', 'claudeInSync']],
    [() => box.write({ [RULE_DOC]: box.read(RULE_DOC).replace('G01', 'G00') }), ['docsInSync']],
    [() => box.write({ 'CLAUDE.md': box.read('CLAUDE.md').replace('| G01 |', '| G01 (off) |') }), ['claudeInSync']],
    [() => box.write({ 'CLAUDE.md': box.read('CLAUDE.md').replace('`/CLAUDE.md`, ', '') }), ['claudeInSync']],
    [() => box.write({ 'CLAUDE.md': box.read('CLAUDE.md').replace('<!-- guard:rules:end', '<!-- guard:rules:gone') }), ['claudeInSync']],
    [() => box.write({ 'CLAUDE.md': `${box.read('CLAUDE.md')}${'more\n'.repeat(CLAUDE_MAX_LINES)}` }), ['claudeInSync']],
    [() => box.remove('CLAUDE.md'), ['claudeInSync']],
    // A path added to the protected list without regenerating the two files made from it.
    [() => {
      const list = JSON.parse(box.read(PROTECTED));
      list.paths.push({ path: '/new/protected.txt', what: 'trial' });
      box.write({ [PROTECTED]: JSON.stringify(list, null, 2) });
    }, ['codeownersInSync', 'claudeInSync']],
  ];
  drift.forEach(([change, expected], index) => {
    const run = after(change);
    assert.equal(run.status, 1, `case ${index}\n${run.output}`);
    assert.equal(run.result.status, 'FAIL');
    assert.deepEqual(flags(run.result), expected, `case ${index}`);
    assert.deepEqual(violationsOf(run.result), {}, `case ${index}`);
  });
  // Regenerating brings the sandbox back to a pass.
  box.reset();
  box.write({ [CODEOWNERS]: 'x\n', [RULE_DOC]: 'x\n', 'CLAUDE.md': box.read('CLAUDE.md').replace('| G01 |', '| G01 (off) |') });
  assert.equal(box.guard('--docs').status, 0);
  assert.equal(box.guard('--codeowners').status, 0);
  assert.equal(box.guard().status, 0);
});

test('a package.json that is not on the protected list fails (exit 1)', () => {
  const run = after(() => box.write({ 'packages/new/package.json': '{}\n' }));
  assert.equal(run.status, 1, run.output);
  assert.deepEqual(run.result.unprotectedManifests, ['packages/new/package.json']);
  assert.deepEqual(flags(run.result), []);
});

test(`a line over ${MAX_LINE} characters in the guard, its tests or the crm command is a guard error (exit 2)`, () => {
  const long = `//${'x'.repeat(MAX_LINE - 1)}\n`;
  for (const dir of SELF_DIRS) {
    const run = after(() => box.write({ [`${dir}trial-long.mjs`]: long }));
    assert.equal(run.status, 2, `${dir}\n${run.output}`);
    assert.deepEqual(run.result.selfCheck.tooLong.map(item => item.file), [`${dir}trial-long.mjs`]);
    assert.equal(after(() => box.write({ [`${dir}trial-long.mjs`]: long.slice(0, 2) + long.slice(3) })).status, 0, `${dir}: exactly ${MAX_LINE}`);
  }
  assert.equal(after(() => box.write({ 'scripts/other/trial-long.mjs': long })).status, 0);
});
