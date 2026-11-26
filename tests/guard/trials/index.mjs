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
//
// The fixtures of one rule come from three places and are joined here:
//   the first set (branching, disabled, io, test-imports, text, zones): the main shapes, written by hand;
//   shapes-code / shapes-zones: one file for every further shape the rule document says is caught;
//   members: made from the pinned lists (tests/guard/pins.json), one finding per member of each list.
import { g06 as branching } from './branching.mjs';
import { g08 as disabled } from './disabled.mjs';
import { g07 as io } from './io.mjs';
import * as members from './members.mjs';
import * as code from './shapes-code.mjs';
import * as zone from './shapes-zones.mjs';
import { g11 as imports } from './test-imports.mjs';
import { g04, g05 } from './text.mjs';
import { g01, g02, g03, g10 } from './zones.mjs';

const first = {
  id: 'G09',
  fail: ['add a filter to the lead list', '[req-12] lower-case id', 'REQ-12 without brackets', '[F1] half an id', '[REQ-] no number', '[F-1-2] misplaced dash',
    '(F1-2) round brackets', '[REQ 12] space instead of a dash'],
  pass: ['[REQ-12] add a filter to the lead list', '[F1-2] glossary', 'follow-up [REQ-7] id in the middle', '[F10-25] two digits'],
};
export const g09 = { id: 'G09', fail: [...first.fail, ...zone.g09.fail], pass: [...first.pass, ...zone.g09.pass] };

/** Join the parts of one trial. A path that two parts both use is an error: one would silently replace the other. */
function join(trial, ...parts) {
  const out = { id: trial.id, fail: {}, pass: {}, overlap: [] };
  for (const part of [trial, ...parts]) {
    for (const kind of ['fail', 'pass']) {
      for (const [file, value] of Object.entries(part[kind] ?? {})) {
        if (file in out.fail || file in out.pass) throw new Error(`${trial.id}: two fixtures at ${file}`);
        out[kind][file] = value;
      }
    }
    out.overlap.push(...(part.overlap ?? []));
  }
  return out;
}
const lookalikes = part => ({ fail: part.lookalikes });

export const TRIALS = [
  join(g01, zone.g01),
  join(g02, zone.g02, members.g02),
  join(g03, members.g03, lookalikes(members.g03)),
  join(g04, zone.g04),
  join(g05, zone.g05, members.g05, lookalikes(members.g05)),
  join(branching, code.g06, members.g06),
  join(io, code.g07, members.g07),
  join(disabled, code.g08, members.g08),
  g09,
  join(g10, zone.g10),
  join(imports, code.g11, members.g11),
];
export const MIN_FAIL = 3;
export const MIN_PASS = 1;
