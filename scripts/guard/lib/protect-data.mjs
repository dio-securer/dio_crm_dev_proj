// Protect checks on the three protected data files, each compared with the same file at the base commit:
// P1 guard-baseline.json (no raise), P2 legacy-files.json (no growth), P5 commit-id-start.json (no move).
import { START_FILE, parseStart } from '../rules/g09-change-id.mjs';
import { BASELINE_FILE, isSet, parseBaseline, show, totalOf } from './baseline.mjs';
import { byCodeUnit } from './files.mjs';
import { GuardError } from './gitbase.mjs';
import { LEGACY_FILE, parseLegacy } from './legacy.mjs';

const BOOTSTRAP = file => `기준 브랜치에 ${file} 이 아직 없어 비교하지 못했습니다(첫 도입). 통과가 아니라 건너뜀입니다.`;
const skipped = (id, name, file) => ({ id, name, status: 'SKIPPED', note: BOOTSTRAP(file), violations: [], baseValue: () => undefined });

function parseWith(parse, text, where) {
  try { return parse(text); } catch (error) { throw new GuardError(`${where}: ${error.message}`); }
}

/** True when `now` is above `was` in any measure, or the two are not the same kind of value. */
const raised = (now, was) => (isSet(now) !== isSet(was) || (isSet(now) ? Object.keys(now).some(key => now[key] > (was[key] ?? 0)) : now > was));

/** P1: versus the base baseline, no rule removed, no per-file value raised, no new file entry. */
export function p1(base, headText) {
  const id = 'P1';
  const name = 'baseline-no-raise';
  if (!base.has(BASELINE_FILE)) {
    const totals = headText === null ? [] : Object.entries(parseWith(parseBaseline, headText, `지금의 ${BASELINE_FILE}`))
      .map(([rule, flat]) => ({ label: rule, base: null, head: totalOf(flat) }));
    return { ...skipped(id, name, BASELINE_FILE), totals };
  }
  const before = parseWith(parseBaseline, base.read(BASELINE_FILE), `기준 커밋의 ${BASELINE_FILE}`);
  const baseValue = entry => (entry.file === BASELINE_FILE ? undefined : before[entry.guardRule]?.[entry.file]);
  if (headText === null) {
    const violations = [{ file: BASELINE_FILE, text: `${BASELINE_FILE} 을 지웠습니다. 기준선이 없으면 아무것도 막지 못합니다.`, declare: null }];
    const totals = Object.keys(before).map(rule => ({ label: rule, base: totalOf(before[rule]), head: null }));
    return { id, name, status: 'FAIL', violations, baseValue, totals };
  }
  const after = parseWith(parseBaseline, headText, `지금의 ${BASELINE_FILE}`);
  const violations = [];
  const add = (guardRule, file, from, to, text) => violations.push({ file, text, declare: { rule: id, guardRule, file, from, to } });
  for (const rule of Object.keys(before).sort(byCodeUnit)) {
    if (after[rule] === undefined) add(rule, BASELINE_FILE, totalOf(before[rule]), null, `기준선에서 규칙 ${rule} 를 통째로 뺐습니다 (기준 합계 ${show(totalOf(before[rule]))}).`);
  }
  for (const rule of Object.keys(after).sort(byCodeUnit)) {
    const frozen = before[rule] ?? {};
    for (const file of Object.keys(after[rule]).sort(byCodeUnit)) {
      const now = after[rule][file];
      const was = frozen[file];
      if (was === undefined) add(rule, file, null, now, `기준선에 새 항목을 넣었습니다: ${rule} ${file} (${show(now)}). 새 위반을 허용하는 것과 같습니다.`);
      else if (raised(now, was)) add(rule, file, was, now, `기준선 숫자를 올렸습니다: ${rule} ${file} ${show(was)} -> ${show(now)}`);
    }
  }
  const rules = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(byCodeUnit);
  const totals = rules.map(rule => ({ label: rule, base: before[rule] ? totalOf(before[rule]) : null, head: after[rule] ? totalOf(after[rule]) : null }));
  return { id, name, status: violations.length ? 'FAIL' : 'PASS', violations, baseValue, totals };
}

const legacyValues = parsed => new Map([...[...parsed.frozenOther].map(file => [file, 'frozenOther']), ...parsed.ruleOf]);

/** P2: legacy-files.json has no path that the base list does not have, and no path whose classification changed. */
export function p2(base, headText) {
  const id = 'P2';
  const name = 'legacy-no-growth';
  if (!base.has(LEGACY_FILE)) {
    const now = headText === null ? null : legacyValues(parseWith(parseLegacy, headText, `지금의 ${LEGACY_FILE}`));
    const totals = now === null ? [] : [{ label: 'legacy 목록', base: null, head: now.size }];
    return { ...skipped(id, name, LEGACY_FILE), totals };
  }
  const before = legacyValues(parseWith(parseLegacy, base.read(LEGACY_FILE), `기준 커밋의 ${LEGACY_FILE}`));
  const baseValue = entry => before.get(entry.file);
  if (headText === null) {
    const violations = [{ file: LEGACY_FILE, text: `${LEGACY_FILE} 을 지웠습니다.`, declare: null }];
    return { id, name, status: 'FAIL', violations, baseValue, totals: [{ label: 'legacy 목록', base: before.size, head: null }] };
  }
  const after = legacyValues(parseWith(parseLegacy, headText, `지금의 ${LEGACY_FILE}`));
  const violations = [];
  for (const file of [...after.keys()].sort(byCodeUnit)) {
    const was = before.get(file) ?? null;
    const now = after.get(file);
    if (was === now) continue;
    const text = was === null ? `legacy 목록에 새 파일을 넣었습니다: ${file} (${now}). 목록은 줄어들 수만 있습니다.`
      : `legacy 목록에서 파일의 분류를 바꿨습니다: ${file} ${was} -> ${now}`;
    violations.push({ file, text, declare: { rule: id, file, from: was, to: now } });
  }
  const totals = [{ label: 'legacy 목록', base: before.size, head: after.size }];
  return { id, name, status: violations.length ? 'FAIL' : 'PASS', violations, baseValue, totals };
}

/** P5: once the base has a commit-id start point, it cannot change. */
export function p5(base, headText) {
  const id = 'P5';
  const name = 'commit-id-start-fixed';
  if (!base.has(START_FILE)) return skipped(id, name, START_FILE);
  const before = parseWith(parseStart, base.read(START_FILE), `기준 커밋의 ${START_FILE}`);
  const baseValue = () => before;
  if (headText === null) return { id, name, status: 'FAIL', baseValue, violations: [{ file: START_FILE, text: `${START_FILE} 을 지웠습니다.`, declare: null }] };
  const after = parseWith(parseStart, headText, `지금의 ${START_FILE}`);
  const violations = before === after ? [] : [{
    file: START_FILE, declare: { rule: id, file: START_FILE, from: before, to: after },
    text: `변경 ID 검사의 시작점을 바꿨습니다: ${before.slice(0, 12)} -> ${after.slice(0, 12)}. 그 사이 커밋이 검사에서 빠질 수 있습니다.`,
  }];
  return { id, name, status: violations.length ? 'FAIL' : 'PASS', violations, baseValue };
}
