// The trial of every guard rule: files that the rule must report and near-misses that it must leave alone.
// This is the permanent form of "break each rule on purpose and see that it is blocked". rules.test.mjs writes the
// files into a throwaway repository (sandbox.mjs), runs the real guard there and compares what it reported.
//
// Format of one trial: { id, fail, pass, overlap? }.
//   fail    { path: text } or { path: [text, n] }: every file must be reported by rule `id` (with exactly n findings when given).
//   pass    { path: text }: none of these may be reported by any rule.
//   overlap [path]: failing files that another rule reports as well (and may).
// G09 reads commit subjects instead of files: { id, fail: [subject], pass: [subject] }.
// A rule that is registered in scripts/guard/rules/index.mjs without a trial here fails the suite (the meta test).
import { g06 } from './branching.mjs';
import { g08 } from './disabled.mjs';
import { g07 } from './io.mjs';
import { g11 } from './test-imports.mjs';
import { g04, g05 } from './text.mjs';
import { g01, g02, g03, g10 } from './zones.mjs';

export const g09 = {
  id: 'G09',
  fail: ['add a filter to the lead list', '[req-12] lower-case id', 'REQ-12 without brackets', '[F1] half an id', '[REQ-] no number', '[F-1-2] misplaced dash',
    '(F1-2) round brackets', '[REQ 12] space instead of a dash'],
  pass: ['[REQ-12] add a filter to the lead list', '[F1-2] glossary', 'follow-up [REQ-7] id in the middle', '[F10-25] two digits'],
};

export const TRIALS = [g01, g02, g03, g04, g05, g06, g07, g08, g09, g10, g11];
export const MIN_FAIL = 3;
export const MIN_PASS = 1;
