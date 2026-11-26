// Ratcheting baseline: frozen per-rule, per-file counts that may only go down.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit, flattenDirs, groupByDir, stableJson } from './files.mjs';

export const BASELINE_FILE = 'guard-baseline.json';
const NOTE = '기존 위반을 묶어 둔 기준선. 숫자는 줄어들 수만 있다(--update-baseline). 숫자를 올리거나 파일을 추가하려면 사람이 직접 고쳐야 한다(보호 파일).';

const sum = flat => Object.values(flat).reduce((a, b) => a + b, 0);

/** Returns null when the file does not exist. Throws when it is malformed or internally inconsistent. */
export function loadBaseline(root) {
  const file = path.join(root, BASELINE_FILE);
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!doc || typeof doc.rules !== 'object') throw new Error(`${BASELINE_FILE} 형식이 잘못되었습니다.`);
  const rules = {};
  for (const [id, entry] of Object.entries(doc.rules)) {
    const flat = flattenDirs(entry.files);
    for (const [name, value] of Object.entries(flat)) {
      if (!Number.isInteger(value) || value <= 0) throw new Error(`${BASELINE_FILE}: ${id} ${name} 의 값이 양의 정수가 아닙니다.`);
    }
    if (entry.total !== sum(flat)) throw new Error(`${BASELINE_FILE}: ${id} 의 total(${entry.total})이 파일별 합(${sum(flat)})과 다릅니다.`);
    rules[id] = flat;
  }
  return rules;
}

export function writeBaseline(root, rules) {
  const doc = { schemaVersion: 1, note: NOTE, rules: {} };
  for (const id of Object.keys(rules).sort(byCodeUnit)) doc.rules[id] = { total: sum(rules[id]), files: groupByDir(rules[id]) };
  fs.writeFileSync(path.join(root, BASELINE_FILE), `${stableJson(doc, 4)}\n`);
}

/** Per-file value of a rule run: number of findings, or the measured value for `max` rules. */
export function countsOf(rule, findings) {
  const counts = {};
  for (const finding of findings) {
    if (rule.baseline === 'max') counts[finding.file] = Math.max(counts[finding.file] ?? 0, finding.value);
    else counts[finding.file] = (counts[finding.file] ?? 0) + 1;
  }
  return counts;
}

/** Compare one rule's findings with its frozen counts. Anything above the frozen count is a new violation. */
export function compare(rule, findings, frozen = {}) {
  const counts = countsOf(rule, findings);
  const byFile = new Map();
  for (const finding of findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push({ line: finding.line, message: finding.message });
  }
  const newViolations = [];
  for (const file of Object.keys(counts).sort(byCodeUnit)) {
    const allowed = frozen[file] ?? 0;
    if (counts[file] > allowed) newViolations.push({ file, baseline: allowed, current: counts[file], locations: byFile.get(file) });
  }
  const lowerable = Object.keys(frozen).filter(file => (counts[file] ?? 0) < frozen[file]).sort(byCodeUnit)
    .map(file => ({ file, baseline: frozen[file], current: counts[file] ?? 0 }));
  return { counts, baselineTotal: sum(frozen), currentTotal: sum(counts), newViolations, lowerable };
}

/** Lower-only update: min(frozen, current) per file, entries that reached zero are dropped, nothing is added. */
export function lowered(frozen, counts) {
  const next = {};
  for (const [file, value] of Object.entries(frozen)) {
    const now = Math.min(value, counts[file] ?? 0);
    if (now > 0) next[file] = now;
  }
  return next;
}
