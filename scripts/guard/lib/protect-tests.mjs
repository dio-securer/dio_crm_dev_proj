// Protect check P3: no test may quietly disappear. Compared with the base commit, a test file may not be
// deleted or renamed to a non-test name, and its number of test cases may not go down.
import { CODE_EXT, hasExt, isTestFile, looksLikeTest } from './files.mjs';
import { GuardError } from './gitbase.mjs';
import { testCountsOf } from './testcount.mjs';
import { parse } from './ts.mjs';

/** Always a test file: named `*.spec.*` / `*.test.*`, or inside a test root (backend/test/, tests/). */
const isTest = isTestFile;
/** May hold tests (the same wide net as G08): protected when it holds at least one test at the base. */
const mayHoldTests = file => hasExt(file, CODE_EXT) && (looksLikeTest(file) || file.startsWith('scripts/'));

function countsOf(file, text, where) {
  if (!hasExt(file, CODE_EXT)) return { tests: 0, groups: 0 };
  try { return testCountsOf(parse(file, text)); } catch (error) { throw new GuardError(`${where} ${error.message}`); }
}

const pair = (before, after) => `테스트 ${before.tests} -> ${after.tests}, 묶음 ${before.groups} -> ${after.groups}`;

export function p3(base, ctx, changes) {
  const id = 'P3';
  const name = 'no-test-loss';
  const baseCounts = file => countsOf(file, base.read(file), '기준 커밋의');
  const violations = [];
  let checked = 0;
  for (const change of changes) {
    if (change.status === 'A' || change.status === 'C') continue;
    const old = change.status === 'R' ? change.from : change.path;
    if (!base.has(old) || !(isTest(old) || mayHoldTests(old))) continue;
    const before = baseCounts(old);
    if (!isTest(old) && before.tests + before.groups === 0) continue;
    checked += 1;
    // Where the file is now. A test file must stay a test file by the same definition (name or test root).
    let now = old;
    if (change.status === 'R') now = (isTest(old) ? isTest(change.path) : isTest(change.path) || mayHoldTests(change.path)) ? change.path : null;
    if (now !== null && !ctx.fileSet.has(now)) now = null;
    if (now === null) {
      const text = change.status === 'R' ? `테스트 파일을 테스트가 아닌 이름으로 바꿨습니다: ${old} -> ${change.path}` : `테스트 파일을 지웠습니다: ${old}`;
      violations.push({ file: old, text: `${text} (테스트 ${before.tests}개, 묶음 ${before.groups}개)`, declare: { rule: id, file: old, from: before, to: null } });
      continue;
    }
    const after = countsOf(now, ctx.read(now), '지금의');
    if (after.tests >= before.tests && after.groups >= before.groups) continue;
    const moved = now === old ? '' : ` (새 이름 ${now})`;
    violations.push({ file: old, text: `테스트가 줄었습니다: ${old}${moved} ${pair(before, after)}`, declare: { rule: id, file: old, from: before, to: after } });
  }
  const baseValue = entry => (base.has(entry.file) ? baseCounts(entry.file) : null);
  return { id, name, status: violations.length ? 'FAIL' : 'PASS', violations, baseValue, note: `바뀐 테스트 파일 ${checked}개를 비교했습니다.` };
}
