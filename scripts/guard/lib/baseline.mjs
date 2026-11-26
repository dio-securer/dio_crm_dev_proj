// Ratcheting baseline: frozen per-rule, per-file counts that may only go down.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit, flattenDirs, groupByDir, stableJson } from './files.mjs';

export const BASELINE_FILE = 'guard-baseline.json';
const NOTE = '기존 위반을 묶어 둔 기준선. 숫자는 줄어들 수만 있다(--update-baseline). 숫자를 올리거나 파일을 추가하려면 사람이 직접 고쳐야 한다(보호 파일).';

// A frozen value is a count (number) or, for `max` rules, a set of measures such as { lines, bytes }.
export const isSet = value => value !== null && typeof value === 'object';
const keysOf = (a, b) => [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort(byCodeUnit);
const validNumber = value => Number.isInteger(value) && value > 0;

/** Sum of a rule's values: a number, or one sum per measure. */
export function totalOf(flat) {
  const values = Object.values(flat);
  if (!values.some(isSet)) return values.reduce((a, b) => a + b, 0);
  const total = {};
  for (const value of values) for (const key of Object.keys(value)) total[key] = (total[key] ?? 0) + value[key];
  return total;
}

/** True when `now` is above `frozen` (in ANY measure). A missing frozen value means zero allowed. */
const above = (now, frozen) => (isSet(now)
  ? frozen === undefined || keysOf(now, frozen).some(key => (now[key] ?? 0) > (frozen[key] ?? 0))
  : now > (frozen ?? 0));
const below = (now, frozen) => now === undefined || (isSet(frozen) ? keysOf(now, frozen).some(key => (now[key] ?? 0) < frozen[key]) : now < frozen);
const least = (now, frozen) => (isSet(frozen)
  ? Object.fromEntries(Object.keys(frozen).map(key => [key, Math.min(frozen[key], now[key] ?? 0)]))
  : Math.min(frozen, now));
export const show = (value, sorted = false) => (isSet(value)
  ? (sorted ? keysOf(value) : Object.keys(value)).map(key => `${key} ${value[key]}`).join(', ')
  : String(value));

/** Parse baseline text into { ruleId: { file: value } }. Throws when it is malformed or internally inconsistent. */
export function parseBaseline(text) {
  const doc = JSON.parse(text);
  if (!doc || typeof doc.rules !== 'object' || doc.rules === null) throw new Error(`${BASELINE_FILE} 형식이 잘못되었습니다.`);
  const rules = {};
  for (const [id, entry] of Object.entries(doc.rules)) {
    const flat = flattenDirs(entry.files);
    for (const [name, value] of Object.entries(flat)) {
      const ok = isSet(value) ? Object.keys(value).length > 0 && Object.values(value).every(validNumber) : validNumber(value);
      if (!ok) throw new Error(`${BASELINE_FILE}: ${id} ${name} 의 값이 양의 정수가 아닙니다.`);
    }
    if (show(entry.total, true) !== show(totalOf(flat), true)) {
      throw new Error(`${BASELINE_FILE}: ${id} 의 total(${show(entry.total)})이 파일별 합(${show(totalOf(flat))})과 다릅니다.`);
    }
    rules[id] = flat;
  }
  return rules;
}

/** Returns null when the file does not exist. Throws when it is malformed or internally inconsistent. */
export function loadBaseline(root) {
  const file = path.join(root, BASELINE_FILE);
  return fs.existsSync(file) ? parseBaseline(fs.readFileSync(file, 'utf8')) : null;
}

export function writeBaseline(root, rules) {
  const doc = { schemaVersion: 2, note: NOTE, rules: {} };
  for (const id of Object.keys(rules).sort(byCodeUnit)) doc.rules[id] = { total: totalOf(rules[id]), files: groupByDir(rules[id]) };
  fs.writeFileSync(path.join(root, BASELINE_FILE), `${stableJson(doc, 4)}\n`);
}

/** Per-file value of a rule run: number of findings, or the measured values for `max` rules. */
export function countsOf(rule, findings) {
  const counts = {};
  for (const finding of findings) {
    if (rule.baseline === 'max') counts[finding.file] = finding.value;
    else counts[finding.file] = (counts[finding.file] ?? 0) + 1;
  }
  return counts;
}

/** Compare one rule's findings with its frozen values. Anything above the frozen value is a new violation. */
export function compare(rule, findings, frozen = {}) {
  const counts = countsOf(rule, findings);
  const byFile = new Map();
  for (const finding of findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push({ line: finding.line, message: finding.message });
  }
  const newViolations = [];
  for (const file of Object.keys(counts).sort(byCodeUnit)) {
    if (above(counts[file], frozen[file])) newViolations.push({ file, baseline: frozen[file] ?? 0, current: counts[file], locations: byFile.get(file) });
  }
  const lowerable = Object.keys(frozen).filter(file => below(counts[file], frozen[file])).sort(byCodeUnit)
    .map(file => ({ file, baseline: frozen[file], current: counts[file] ?? 0 }));
  return { counts, baselineTotal: totalOf(frozen), currentTotal: totalOf(counts), newViolations, lowerable };
}

/** Lower-only update: the smaller of frozen and current per file (per measure); fixed files are dropped; nothing is added or raised. */
export function lowered(frozen, counts) {
  const next = {};
  for (const [file, value] of Object.entries(frozen)) {
    if (counts[file] === undefined) continue;
    const now = least(counts[file], value);
    if (isSet(now) || now > 0) next[file] = now;
  }
  return next;
}
