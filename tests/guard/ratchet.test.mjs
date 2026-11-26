// The baseline is a ratchet: a frozen number may go down, never up, and a file that is not in it is allowed nothing.
// Runs the real runner in a throwaway repository that has two old violations frozen (one count, one size).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOUND, makeSandbox, violationsOf } from './sandbox.mjs';

const box = makeSandbox(BOUND);
const HEX = '#';
const colours = n => `a { ${Array.from({ length: n }, (_, i) => `--c${i}: ${HEX}11${i}`).join('; ')}; }\n`;
const rows = (n, row = '// x') => `${row}\n`.repeat(n);
const frozen = () => JSON.parse(box.read('guard-baseline.json')).rules;
function after(files, ...args) {
  box.reset();
  box.write(files);
  const run = box.guard(...args);
  return { status: run.status, output: run.stdout + run.stderr, result: box.result() };
}

test('the frozen tree passes, also with --strict', () => {
  const run = after({}, '--strict');
  assert.equal(run.status, 0, run.output);
  assert.equal(run.result.baselineLowerable, 0);
});

test('a frozen count: the same number passes, one more fails, and another file is allowed nothing', () => {
  assert.equal(after({ 'ui/old.css': colours(2) }).status, 0);
  const more = after({ 'ui/old.css': colours(3) });
  assert.equal(more.status, 1, more.output);
  assert.deepEqual(violationsOf(more.result), { G05: { 'ui/old.css': 3 } });
  assert.equal(more.result.rules.find(rule => rule.id === 'G05').newViolations[0].baseline, 2);
  const other = after({ 'ui/old.css': colours(1), 'ui/new.css': colours(1) });
  assert.equal(other.status, 1, other.output);
  assert.deepEqual(violationsOf(other.result), { G05: { 'ui/new.css': 1 } });
});

test('a frozen size: neither lines nor bytes may grow, even when the other one shrinks', () => {
  const was = BOUND.baseline.G03.files.src['old-big.ts'];
  assert.equal(after({ 'src/old-big.ts': rows(311) }).status, 1);
  const wider = after({ 'src/old-big.ts': rows(309, '// a much longer row than before') });
  assert.equal(wider.status, 1, wider.output);
  assert.deepEqual(wider.result.rules.find(rule => rule.id === 'G03').newViolations.map(item => [item.file, item.baseline]), [['src/old-big.ts', was]]);
  assert.equal(after({ 'src/old-big.ts': rows(309) }).status, 0);
  // A file that is not frozen is held to the limit itself, not to the frozen file's numbers.
  assert.deepEqual(violationsOf(after({ 'src/other-big.ts': rows(305) }).result), { G03: { 'src/other-big.ts': { lines: 305, bytes: 1525 } } });
});

test('--strict fails while a number could be lowered; --update-baseline lowers it and never raises or adds', () => {
  const lower = { 'ui/old.css': colours(1), 'src/old-big.ts': rows(10) };
  assert.equal(after(lower).status, 0);
  const strict = after(lower, '--strict');
  assert.equal(strict.status, 1, strict.output);
  assert.equal(strict.result.baselineLowerable, 2);
  const updated = after({ ...lower, 'ui/new.css': colours(1) }, '--update-baseline');
  assert.equal(updated.status, 1, 'the new file is still a violation after the update');
  assert.deepEqual([frozen().G03, frozen().G05], [{ total: 0, files: {} }, { total: 1, files: { ui: { 'old.css': 1 } } }]);
  // The lowered number is the new ceiling: going back to the old value now fails.
  box.remove('ui/new.css');
  assert.equal(box.guard('--strict').status, 0);
  box.write({ 'ui/old.css': colours(2) });
  assert.equal(box.guard().status, 1);
  assert.equal(box.guard('--update-baseline').status, 1);
  assert.deepEqual(frozen().G05, { total: 1, files: { ui: { 'old.css': 1 } } });
});
