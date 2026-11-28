// guard-raises.json: the only way to allow a raise, a growth or a test loss. Every entry must match one change EXACTLY
// (same rule, same file, same before and after values). No wildcards, no ranges, no "at most".
import { CHANGE_ID } from '../rules/g09-change-id.mjs';
import { byCodeUnit } from './files.mjs';
import { GuardError } from './gitbase.mjs';

export const RAISES_FILE = 'guard-raises.json';
export const RAISE_RULES = ['P1', 'P2', 'P3', 'P5', 'P6'];
/** P6 can excuse only a row access widening (D05): one rule of one object's access.json, written out in full. */
export const ACCESS_FILE = /^metadata\/objects\/[a-z][a-z0-9_]*\/access\.json$/;
export const KEYS = ['rule', 'guardRule', 'file', 'from', 'to', 'reason', 'changeId'];
export const MIN_REASON = 10;
export const ID_ONLY = new RegExp(`^${CHANGE_ID.source.replace(/^\\\[/, '').replace(/\\\]$/, '')}$`);

/** JSON with sorted keys, so two equal values always give the same text. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(byCodeUnit).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

/** The identity of a change: what a declaration must repeat exactly. */
export const keyOf = item => canonical({ rule: item.rule, guardRule: item.guardRule ?? null, file: item.file, from: item.from, to: item.to });
export const targetOf = item => canonical({ rule: item.rule, guardRule: item.guardRule ?? null, file: item.file });

const isValue = value => value === null || typeof value === 'string' || (Number.isInteger(value) && value >= 0)
  || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 && Object.values(value).every(n => Number.isInteger(n) && n >= 0));

/** A row access rule as written in access.json: a `kind` and only string values. */
const isAccessRule = value => !!value && typeof value === 'object' && !Array.isArray(value) && typeof value.kind === 'string'
  && Object.values(value).every(v => typeof v === 'string' && v !== '');

/** Parse and validate. `text === null` (no file) means no declarations. Throws GuardError on any malformed entry. */
export function parseRaises(text) {
  if (text === null) return [];
  let doc;
  try { doc = JSON.parse(text); } catch (error) { throw new GuardError(`${RAISES_FILE} 을 읽을 수 없습니다(JSON 오류: ${error.message})`); }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.raises)) throw new GuardError(`${RAISES_FILE} 형식이 잘못되었습니다. { "raises": [ ... ] } 이어야 합니다.`);
  return doc.raises.map((entry, index) => {
    const bad = why => { throw new GuardError(`${RAISES_FILE} 의 ${index + 1}번째 선언이 잘못되었습니다: ${why}`); };
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) bad('객체가 아닙니다.');
    const extra = Object.keys(entry).filter(key => !KEYS.includes(key));
    if (extra.length) bad(`알 수 없는 항목 ${extra.join(', ')} (쓸 수 있는 항목: ${KEYS.join(', ')})`);
    if (!RAISE_RULES.includes(entry.rule)) bad(`rule 은 ${RAISE_RULES.join(' / ')} 중 하나여야 합니다.`);
    if (entry.rule === 'P1' ? !/^G\d{2}$/.test(entry.guardRule ?? '') : entry.guardRule !== undefined) bad('guardRule 은 P1 에만, 규칙 ID(예: "G03")로 적습니다.');
    if (typeof entry.file !== 'string' || entry.file === '') bad('file 이 없습니다.');
    if (/[*?[\]{}]/.test(entry.file)) bad(`file 에 와일드카드를 쓸 수 없습니다: ${entry.file}`);
    if (entry.rule === 'P6' && !(ACCESS_FILE.test(entry.file) && entry.from === null && isAccessRule(entry.to))) {
      bad('P6 은 행 권한 넓히기(D05)만 선언합니다: file 은 metadata/objects/<개체>/access.json, from 은 null, to 는 넓어진 규칙 그대로.');
    }
    const values = 'from' in entry && 'to' in entry && isValue(entry.from) && isValue(entry.to);
    if (entry.rule !== 'P6' && !values) bad('from / to 는 바뀌기 전과 후의 값을 그대로 적습니다(숫자, 글자, 숫자 묶음, null).');
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < MIN_REASON) bad(`reason 은 사람이 읽을 이유를 ${MIN_REASON}자 이상 적습니다.`);
    if (typeof entry.changeId !== 'string' || !ID_ONLY.test(entry.changeId)) bad('changeId 는 REQ-숫자 또는 F숫자-숫자 형식입니다.');
    return entry;
  });
}

/**
 * Pair declarations with violations. A violation is excused only by a declaration with the same identity.
 * Returns { excused: [{ violation, entry }], open: [violation], unused: [{ entry, near }] } where `near`
 * is an open violation on the same target with different values (an inexact declaration), if any.
 */
export function matchRaises(violations, entries) {
  const pool = new Map();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (!pool.has(key)) pool.set(key, []);
    pool.get(key).push(entry);
  }
  const excused = [];
  const open = [];
  for (const violation of violations) {
    const entry = violation.declare ? pool.get(keyOf(violation.declare))?.shift() : undefined;
    if (entry) excused.push({ violation, entry }); else open.push(violation);
  }
  const unused = [...pool.values()].flat().map(entry => ({
    entry, near: open.find(violation => violation.declare && targetOf(violation.declare) === targetOf(entry)) ?? null,
  }));
  return { excused, open, unused };
}
