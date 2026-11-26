// Edges of the runner that a weakened guard would get wrong without any rule fixture noticing: the baseline as a
// ratchet (it never goes up, whatever is asked), values that are not counts, the limits at their exact numbers, and
// the legacy text check failing closed. Every case runs the real runner in a throwaway repository.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOUND, makeSandbox, violationsOf } from './sandbox.mjs';

const OLD_BRANCH = "export const f = (x: any) => x === 'KR';\n";
const OLD = 'backend/src/svc/old.ts';
const BASELINE = 'guard-baseline.json';
const I18N = 'scripts/i18n/hardcode-check.mjs';
const box = makeSandbox({
  files: { ...BOUND.files, [OLD]: OLD_BRANCH },
  baseline: { ...BOUND.baseline, G06: { total: 1, files: { 'backend/src/svc': { 'old.ts': 1 } } } },
});
const was = BOUND.baseline.G03.files.src['old-big.ts'];
const rows = (n, row = '// x') => `${row}\n`.repeat(n);
const frozen = () => JSON.parse(box.read(BASELINE)).rules;
const statusOf = (result, id) => result.rules.find(rule => rule.id === id).status;
function after(change, ...args) {
  box.reset();
  change();
  const run = box.guard(...args);
  let result = null;
  try { result = box.result(); } catch { /* the guard stopped before it wrote a result */ }
  return { status: run.status, output: run.stdout + run.stderr, result };
}
/** The baseline with one change made to its parsed form, or to its text when `change` returns a string. */
const baselineWith = change => () => {
  const doc = JSON.parse(box.read(BASELINE));
  const text = change(doc.rules);
  box.write({ [BASELINE]: typeof text === 'string' ? text : `${JSON.stringify(doc, null, 2)}\n` });
};

test('the sandbox with three frozen violations passes', () => {
  const run = after(() => {}, '--strict');
  assert.equal(run.status, 0, run.output);
});

test('--update-baseline cannot raise a measure: fewer lines with more bytes lowers the lines and keeps the bytes', () => {
  const wider = rows(309, '// a much longer row than before');
  const run = after(() => box.write({ 'src/old-big.ts': wider }), '--update-baseline');
  assert.equal(run.status, 1, run.output);
  assert.deepEqual(violationsOf(run.result), { G03: { 'src/old-big.ts': { lines: 309, bytes: wider.length } } });
  assert.ok(wider.length > was.bytes);
  assert.deepEqual(frozen().G03.files.src['old-big.ts'], { lines: 309, bytes: was.bytes });
  assert.deepEqual(frozen().G03.total, { lines: 309, bytes: was.bytes });
  // The other way round: more lines in fewer bytes.
  const taller = rows(400, '');
  const second = after(() => box.write({ 'src/old-big.ts': taller }), '--update-baseline');
  assert.equal(second.status, 1, second.output);
  assert.deepEqual(frozen().G03.files.src['old-big.ts'], { lines: 310, bytes: taller.length });
  // A count that went up is not written either, and a file that is not frozen is never added.
  const more = after(() => box.write({ [OLD]: OLD_BRANCH.repeat(3), 'backend/src/svc/new.ts': OLD_BRANCH }), '--update-baseline');
  assert.equal(more.status, 1, more.output);
  assert.deepEqual(frozen().G06, { total: 1, files: { 'backend/src/svc': { 'old.ts': 1 } } });
});

test('--update-baseline does not touch the numbers of a rule that could not run', () => {
  const before = box.read(BASELINE);
  // G06 cannot parse one file: it found nothing, which is not the same as "everything was fixed".
  const run = after(() => box.write({ 'backend/src/svc/broken.ts': 'export const = ;\n', 'ui/old.css': 'a { margin: 0; }\n' }), '--update-baseline');
  assert.equal(run.status, 2, run.output);
  assert.equal(statusOf(run.result, 'G06'), 'ERROR');
  assert.deepEqual(frozen().G06, JSON.parse(before).rules.G06);
  // The rule that did run was lowered.
  assert.deepEqual(frozen().G05, { total: 0, files: {} });
});

test('a baseline entry for a rule that allows nothing is an error (exit 2), not an allowance', () => {
  const cases = {
    G01: ['metadata/tool.mjs', 'export const a = 1;\n'],
    G02: ['extensions/acme/pkg.ts', "import x from 'zod';\nexport default x;\n"],
    G10: ['frontend/src/New.tsx', 'export const New = () => <i />;\n'],
    G11: ['backend/src/svc/uses.ts', "import x from './a.spec';\nexport default x;\n"],
  };
  for (const [id, [file, text]] of Object.entries(cases)) {
    const dir = file.slice(0, file.lastIndexOf('/'));
    const name = file.slice(dir.length + 1);
    // Without the entry the file is a violation of that rule.
    const plain = after(() => box.write({ [file]: text }));
    assert.equal(plain.status, 1, `${id}\n${plain.output}`);
    assert.deepEqual(Object.keys(violationsOf(plain.result)[id]), [file]);
    const run = after(() => { box.write({ [file]: text }); baselineWith(rules => { rules[id] = { total: 1, files: { [dir]: { [name]: 1 } } }; })(); });
    assert.equal(run.status, 2, `${id}\n${run.output}`);
    assert.match(run.output, new RegExp(id));
    // An empty entry is refused as well: the rule has no baseline at all.
    assert.equal(after(baselineWith(rules => { rules[id] = { total: 0, files: {} }; })).status, 2, id);
  }
  // A rule id that no rule has, and G09 (which never runs by default).
  for (const id of ['G00', 'G09', 'G12', 'G99']) assert.equal(after(baselineWith(rules => { rules[id] = { total: 0, files: {} }; })).status, 2, id);
});

test('a baseline number must be a positive whole number that can be counted to', () => {
  const count = value => text => text.replace('"old.css": 2', `"old.css": ${value}`).replace('"total": 2', `"total": ${value}`);
  const withCount = value => baselineWith(() => count(value)(box.read(BASELINE)));
  assert.equal(after(withCount('2')).status, 0);
  for (const value of ['1e999', '-1e999', '1e300', '9007199254740992', '2.5', '0.5', '-2', '0', '-0', '"2"', 'null', 'true', '[2]', '1e-7']) {
    const run = after(withCount(value));
    assert.equal(run.status, 2, `${value}\n${run.output}`);
  }
  // The same for one measure of a size, whatever the other measure is.
  for (const value of ['1e999', '1e300', '310.5', '-310', '0', '"310"', 'null']) {
    const run = after(baselineWith(() => box.read(BASELINE).replaceAll('"lines": 310', `"lines": ${value}`)));
    assert.equal(run.status, 2, `lines ${value}\n${run.output}`);
  }
  // A value of the other kind: a size under a rule that counts, a count under the rule that measures.
  const size = { lines: 9999, bytes: 99999 };
  assert.equal(after(baselineWith(rules => { rules.G05 = { total: size, files: { ui: { 'old.css': size } } }; })).status, 2);
  assert.equal(after(baselineWith(rules => { rules.G03 = { total: 99999, files: { src: { 'old-big.ts': 99999 } } }; })).status, 2);
  // A size with one measure left out allows nothing for that measure: the frozen file is a violation again.
  assert.equal(after(baselineWith(rules => { rules.G03.files.src['old-big.ts'] = { lines: 310 }; rules.G03.total = { lines: 310 }; })).status, 1);
  assert.equal(after(baselineWith(rules => { rules.G03.files.src['old-big.ts'] = {}; rules.G03.total = {}; })).status, 2);
  // A total that is not the sum of the files.
  assert.equal(after(baselineWith(rules => { rules.G05.total = 3; })).status, 2);
});

test('CLAUDE.md may be 120 lines long and not 121', () => {
  const text = box.read('CLAUDE.md');
  const lines = text.split('\n').length - 1;
  const padded = n => `${text}${'more\n'.repeat(n - lines)}`;
  assert.ok(lines < 120);
  const at = after(() => box.write({ 'CLAUDE.md': padded(120) }));
  assert.equal(at.status, 0, at.output);
  assert.equal(padded(120).split('\n').length - 1, 120);
  const over = after(() => box.write({ 'CLAUDE.md': padded(121) }));
  assert.equal(over.status, 1, over.output);
  assert.equal(over.result.claudeInSync, false);
  assert.match(over.output, /121/);
  // The last line counts whether or not it ends with a line break.
  assert.equal(after(() => box.write({ 'CLAUDE.md': `${padded(120)}more` })).status, 1);
  assert.equal(after(() => box.write({ 'CLAUDE.md': padded(120).slice(0, -1) })).status, 0);
});

test('a line of the guard may be 160 characters long and not 161, in every folder of the guard however deep', () => {
  const row = n => `//${'x'.repeat(n - 2)}\n`;
  assert.equal(row(160).length - 1, 160);
  const dirs = ['scripts/guard/', 'scripts/guard/lib/', 'scripts/guard/rules/deep/er/', 'tests/guard/', 'tests/guard/trials/', 'tests/guard/trials/deep/er/',
    'scripts/crm/', 'scripts/crm/lib/'];
  const files = n => Object.fromEntries(dirs.map(dir => [`${dir}trial-long.mjs`, row(n)]));
  const at = after(() => box.write(files(160)));
  assert.equal(at.status, 0, at.output);
  const over = after(() => box.write(files(161)));
  assert.equal(over.status, 2, over.output);
  assert.deepEqual(over.result.selfCheck.tooLong.map(item => [item.file, item.line, item.length]), Object.keys(files(161)).sort().map(file => [file, 1, 161]));
  assert.equal(over.result.selfCheck.maxLineLength, 160);
  // Any kind of file, any line of it, with either kind of line break.
  const others = [['data.json', `{}\n"${'x'.repeat(160)}"\n`], ['notes.md', `a\r\n${'x'.repeat(161)}\r\n`], ['last.txt', `a\n${'x'.repeat(161)}`]];
  for (const [name, text] of others) {
    const run = after(() => box.write({ [`tests/guard/trials/${name}`]: text }));
    assert.equal(run.status, 2, `${name}\n${run.output}`);
    assert.deepEqual(run.result.selfCheck.tooLong.map(item => item.line), [2]);
  }
  assert.equal(after(() => box.write({ 'tests/guard/trials/crlf.mjs': `${'x'.repeat(160)}\r\n` })).status, 0);
});

test('G04 fails closed when the legacy text check gives rows it cannot read or ends in another way', () => {
  const script = body => () => box.write({ [I18N]: `${body}\n`, 'frontend/src/App.tsx': 'export const App = () => <main />;\n' });
  const good = " - frontend/src/App.tsx:1: export const App = () => <main />;";
  const rowsOf = list => `console.error(${JSON.stringify(`[i18n] found\n${list.join('\n')}`)});`;
  const counted = after(script(`${rowsOf([good])} process.exit(1);`));
  assert.equal(counted.status, 1, counted.output);
  assert.deepEqual(violationsOf(counted.result), { G04: { 'frontend/src/App.tsx': 1 } });
  const errors = [
    `${rowsOf([good, ' - a row without a place'])} process.exit(1);`,
    `${rowsOf([' - frontend/src/App.tsx:x: not a line number'])} process.exit(1);`,
    `${rowsOf([' - :1: no file'])} process.exit(1);`,
    `${rowsOf(['[i18n] found and no rows'])} process.exit(1);`,
    'process.exit(1);',
    `${rowsOf([good])} process.exit(2);`,
    `${rowsOf([good])} process.exit(3);`,
    'process.exit(255);',
    "process.kill(process.pid, 'SIGKILL'); setTimeout(() => {}, 5000);",
    'throw new Error("broken");',
    'this is not JavaScript',
  ];
  for (const body of errors) {
    const run = after(script(body));
    assert.equal(run.status, 2, `${body}\n${run.output}`);
    assert.equal(statusOf(run.result, 'G04'), 'ERROR', body);
  }
  assert.equal(after(script('process.exit(0);')).status, 0);
});
