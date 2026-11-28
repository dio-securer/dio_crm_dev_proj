// Protect mode (`--protect <base-ref>`): compares the working tree with the merge-base of <base-ref> and HEAD,
// so that weakening the guard's own inputs (baseline, legacy list, tests, start point) cannot pass unnoticed.
// Exit codes: 0 ok, 1 undeclared weakening or a bad declaration, 2 the check itself could not run.
import fs from 'node:fs';
import path from 'node:path';
import { START_FILE } from '../rules/g09-change-id.mjs';
import { BASELINE_FILE } from './baseline.mjs';
import { PROTECTED_FILE, loadProtected, parseProtected, protectedEntry } from './codeowners.mjs';
import { byCodeUnit, createContext } from './files.mjs';
import { baseReader, changesSince, resolveBase } from './gitbase.mjs';
import { LEGACY_FILE } from './legacy.mjs';
import { p1, p2, p5 } from './protect-data.mjs';
import { p6 } from './protect-metadata.mjs';
import { p3 } from './protect-tests.mjs';
import { RAISES_FILE, canonical, matchRaises, parseRaises } from './raises.mjs';
import { renderSummary, verdictOf } from './summary.mjs';

export const PROTECT_RESULT = 'protect-result.json';
export const SUMMARY_FILE = 'summary.md';

/** P4: every changed path under a protected path. Informational (REVIEW): CODEOWNERS enforces the approval. */
function p4(root, base, changes) {
  // A path stays protected for this comparison even when the PR itself removes it from the list.
  const lists = [loadProtected(root), ...(base.has(PROTECTED_FILE) ? [parseProtected(base.read(PROTECTED_FILE))] : [])];
  const found = new Map();
  for (const change of changes) {
    for (const file of change.from && change.status === 'R' ? [change.from, change.path] : [change.path]) {
      const entry = lists.map(list => protectedEntry(list, file)).find(Boolean);
      if (entry) found.set(file, { file, status: change.status, protectedBy: entry.path, what: entry.what });
    }
  }
  const protectedChanges = [...found.values()].sort((a, b) => byCodeUnit(a.protectedBy, b.protectedBy) || byCodeUnit(a.file, b.file));
  const note = protectedChanges.length ? `보호 파일 ${protectedChanges.length}개가 바뀌었습니다. 실패는 아니지만 사람이 확인해야 합니다.` : '바뀐 보호 파일이 없습니다.';
  return { row: { id: 'P4', name: 'protected-changes', status: protectedChanges.length ? 'REVIEW' : 'PASS', note, violations: [] }, protectedChanges };
}

function whyUnused(item, rows) {
  if (item.near) {
    const real = item.near.declare;
    return `선언한 값이 실제 변경과 다릅니다. 실제: from ${canonical(real.from)}, to ${canonical(real.to)}. 선언은 실제 변경과 글자 그대로 같아야 합니다.`;
  }
  const baseValue = rows.find(row => row.id === item.entry.rule)?.baseValue(item.entry);
  if (baseValue !== undefined && canonical(baseValue ?? null) === canonical(item.entry.to)) {
    return '이미 기준 브랜치에 반영된 선언입니다(to 값이 기준 브랜치의 값과 같음). 병합이 끝난 선언은 지워야 합니다.';
  }
  return '이 선언에 해당하는 변경이 없습니다. 쓰이지 않는 선언은 둘 수 없습니다.';
}

function evaluate(root, ref) {
  const base = resolveBase(root, ref);
  const reader = baseReader(root, base.mergeBase);
  const ctx = createContext(root);
  const changes = changesSince(root, base.mergeBase, ctx);
  const head = file => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null);
  const entries = parseRaises(head(RAISES_FILE));
  const { row: p4row, protectedChanges } = p4(root, reader, changes);
  const rows = [
    p1(reader, head(BASELINE_FILE)), p2(reader, head(LEGACY_FILE)), p3(reader, ctx, changes), p4row, p5(reader, head(START_FILE)),
    p6(root, reader, ctx),
  ];
  const { excused, open, unused } = matchRaises(rows.flatMap(row => row.violations), entries);
  const badDeclarations = unused.map(item => ({ entry: item.entry, why: whyUnused(item, rows) }));
  const stillOpen = new Set(open);
  const rules = rows.map(({ baseValue, totals, ...row }) => {
    const violations = row.violations.filter(item => stillOpen.has(item));
    const status = row.status === 'FAIL' && violations.length === 0 ? 'PASS' : row.status;
    return { ...row, status, violations, excused: row.violations.length - violations.length };
  });
  const failed = open.length > 0 || badDeclarations.length > 0;
  return {
    status: failed ? 'FAIL' : 'PASS', base, rules, exceptions: excused.map(item => item.entry), badDeclarations, protectedChanges,
    totals: rows.flatMap(row => row.totals ?? []),
  };
}

function print(result) {
  for (const rule of result.rules ?? []) {
    const notes = [rule.note, rule.excused ? `예외 선언 ${rule.excused}건` : ''].filter(Boolean).join(' / ');
    console.log(`${rule.id} ${rule.name.padEnd(22)} ${rule.status.padEnd(7)} ${notes}`);
    for (const item of rule.violations) {
      console.log(`    ${item.text}`);
      if (item.declare) console.log(`      사람이 허락한 변경이라면 ${RAISES_FILE} 에 그대로 선언: ${JSON.stringify(item.declare)} + reason, changeId`);
      else console.log('      예외로 선언할 수 없는 변경입니다.');
    }
  }
  for (const item of result.badDeclarations ?? []) console.log(`DECL 잘못된 예외 선언 ${JSON.stringify(item.entry)}\n    ${item.why}`);
  for (const item of result.protectedChanges ?? []) console.log(`    보호 파일 ${item.status} ${item.file}  (${item.protectedBy})`);
  if (result.exceptions?.length) console.log(`[guard] 예외 선언 ${result.exceptions.length}건 - 사람 확인 필요`);
}

/** Runs the protect check, writes .guard/protect-result.json and .guard/summary.md, returns the exit code. */
export function runProtect(root, ref, meta, resultDir) {
  let result;
  try { result = evaluate(root, ref); } catch (error) {
    // Anything unexpected is a guard error: no result may be read as a pass.
    const error1 = String(error.message ?? error).split('\n')[0];
    result = { status: 'ERROR', error: error1, base: { ref }, rules: [], exceptions: [], badDeclarations: [], protectedChanges: [], totals: [] };
  }
  const full = { ...meta(), ...result, verdict: '' };
  full.verdict = verdictOf(full);
  fs.mkdirSync(path.join(root, resultDir), { recursive: true });
  fs.writeFileSync(path.join(root, resultDir, PROTECT_RESULT), `${JSON.stringify(full, null, 2)}\n`);
  fs.writeFileSync(path.join(root, resultDir, SUMMARY_FILE), renderSummary(full));
  print(full);
  if (full.status === 'ERROR') console.error(`[guard] 보호 검사를 돌릴 수 없습니다: ${full.error}`);
  console.log(`[guard] 보호 검사 ${full.status}: ${full.verdict}  (결과: ${resultDir}/${PROTECT_RESULT}, ${resultDir}/${SUMMARY_FILE})`);
  return full.status === 'ERROR' ? 2 : full.status === 'FAIL' ? 1 : 0;
}
