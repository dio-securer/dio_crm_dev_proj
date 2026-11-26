// .guard/summary.md: the protect result in plain Korean for the one person who approves the PR.
// Order matters: verdict first, then what needs a human look, then the details.
import { show } from './baseline.mjs';

const MAX_FILES = 30;
// Long lists are cut so the summary stays under GitHub's size limit; the heading always carries the full count.
const MAX_ROWS = 100;
const more = (list, unit) => (list.length > MAX_ROWS ? [`- ... 외 ${list.length - MAX_ROWS}${unit} (전체는 .guard/protect-result.json)`] : []);
const WHAT = {
  P1: '기존 위반 허용 숫자(기준선)를 올림',
  P2: '이관 대상(legacy) 목록에 파일을 추가',
  P3: '테스트를 지우거나 줄임',
  P5: '변경 ID 검사의 시작점을 바꿈',
};
const TITLE = {
  P1: '기준선을 올리지 않았는가',
  P2: 'legacy 목록이 늘지 않았는가',
  P3: '테스트가 사라지지 않았는가',
  P4: '보호 파일을 건드렸는가',
  P5: '변경 ID 검사의 시작점이 그대로인가',
};
const STATUS = { PASS: '통과', FAIL: '실패', SKIPPED: '건너뜀(비교 못 함)', REVIEW: '사람 확인 필요' };
const CHANGE = { A: '추가', M: '수정', D: '삭제', R: '이름 바꿈', C: '복사', T: '종류 바뀜' };

// Reasons, file names and error texts come from the PR itself. They are flattened to one line and stripped of anything
// that could hide or restyle the rest of the summary (an HTML comment, a tag, a link, a table bar, a code fence).
const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '[': '&#91;', ']': '&#93;', '`': '&#96;', '*': '&#42;', _: '&#95;', '~': '&#126;' };
const plain = text => String(text).replace(/\s+/g, ' ').trim().replace(/[&<>|[\]`*_~]/g, ch => ENTITY[ch]);
const code = text => `\`${String(text).replace(/\s+/g, ' ').replace(/`/g, "'").replace(/\|/g, '/')}\``;
const value = v => (v === null || v === undefined ? '없음' : typeof v === 'string' && /^[0-9a-f]{40}$/.test(v) ? v.slice(0, 12) : show(v));

function delta(base, head) {
  if (base === null) return '비교 대상 없음(첫 도입)';
  if (head === null) return '없어짐';
  if (typeof base === 'number' && typeof head === 'number') return head === base ? '그대로' : head < base ? `${base - head} 줄었음` : `${head - base} 늘었음`;
  const keys = Object.keys({ ...base, ...head });
  const parts = keys.map(key => [key, (head[key] ?? 0) - (base[key] ?? 0)]).filter(([, diff]) => diff !== 0);
  return parts.length ? parts.map(([key, diff]) => `${key} ${Math.abs(diff)} ${diff < 0 ? '줄었음' : '늘었음'}`).join(', ') : '그대로';
}

export function verdictOf(result) {
  if (result.status === 'ERROR') return '오류 - 검사를 끝내지 못했습니다. 통과가 아닙니다. 승인하지 마세요.';
  const attention = result.exceptions.length + result.protectedChanges.length + result.rules.filter(rule => rule.status === 'SKIPPED').length;
  if (result.status === 'FAIL') {
    const open = result.rules.reduce((n, rule) => n + rule.violations.length, 0);
    return `실패 - 선언하지 않은 약화 ${open}건, 잘못된 예외 선언 ${result.badDeclarations.length}건. 승인하지 마세요.`;
  }
  return attention ? '통과 - 단, 아래 "사람이 확인할 것"을 읽고 승인하세요.' : '통과 - 사람이 따로 확인할 것이 없습니다.';
}

export function renderSummary(result) {
  const out = ['# 가드 보호 검사 요약', '', `**판정: ${verdictOf(result)}**`, ''];
  if (result.base?.mergeBase) out.push(`비교: 기준 ${code(result.base.ref)} (공통 조상 ${result.base.mergeBase.slice(0, 12)}) 과 지금 작업 내용.`, '');
  if (result.status === 'ERROR') {
    out.push('## 오류', '', `- ${plain(result.error)}`, '', '검사 자체가 돌지 못했습니다. 기준 브랜치를 읽을 수 없거나 보호 파일의 형식이 깨진 경우입니다.', '');
    return `${out.join('\n')}${evidence(result)}`;
  }

  const open = result.rules.flatMap(rule => rule.violations.map(item => ({ ...item, id: rule.id })));
  if (open.length || result.badDeclarations.length) {
    out.push('## 실패한 이유', '');
    for (const item of open.slice(0, MAX_ROWS)) out.push(`- ${item.id}: ${plain(item.text)}${item.declare ? '' : ' (예외로 선언할 수 없는 변경입니다)'}`);
    out.push(...more(open, '건'));
    for (const item of result.badDeclarations.slice(0, MAX_ROWS)) {
      out.push(`- 잘못된 예외 선언 (${code(`${item.entry.rule} ${item.entry.file}`)}): ${plain(item.why)}`);
    }
    out.push(...more(result.badDeclarations, '건'), '');
  }

  out.push('## 사람이 확인할 것', '', `### 예외 선언 ${result.exceptions.length}건 - 사람 확인 필요`, '');
  if (result.exceptions.length) {
    out.push('이 PR 은 아래 약화를 "예외"로 선언했습니다. 이유가 납득될 때만 승인하세요.', '');
    out.push('| 무엇을 | 어디 | 전 → 후 | 적어 둔 이유 | 변경 ID |', '| --- | --- | --- | --- | --- |');
    for (const item of result.exceptions.slice(0, MAX_ROWS)) {
      const where = item.guardRule ? `${item.guardRule} ${item.file}` : item.file;
      const change = `${value(item.from)} → ${value(item.to)}`;
      out.push(`| ${WHAT[item.rule]} | ${code(where)} | ${plain(change)} | ${plain(item.reason)} | ${plain(item.changeId)} |`);
    }
    if (result.exceptions.length > MAX_ROWS) out.push('', ...more(result.exceptions, '건'), '- 예외가 이렇게 많은 PR 은 그 자체로 이상합니다. 전체 목록을 확인하기 전에는 승인하지 마세요.');
  } else out.push('없습니다.');
  out.push('', `### 보호 파일 변경 ${result.protectedChanges.length}건`, '');
  if (result.protectedChanges.length) {
    out.push('가드·기준선·CI 설정처럼 "검사하는 쪽"을 바꾼 PR 입니다. 이 검사 결과도 바뀐 코드가 낸 것이므로, 왜 바꿨는지 설명을 확인하세요.', '');
    const groups = new Map();
    for (const item of result.protectedChanges) {
      if (!groups.has(item.protectedBy)) groups.set(item.protectedBy, { what: item.what, files: [] });
      groups.get(item.protectedBy).files.push(item);
    }
    for (const [root, group] of groups) {
      out.push(`- ${code(root)} (${plain(group.what)}) ${group.files.length}개`);
      for (const item of group.files.slice(0, MAX_FILES)) out.push(`  - ${CHANGE[item.status] ?? item.status}: ${code(item.file)}`);
      if (group.files.length > MAX_FILES) out.push(`  - ... 외 ${group.files.length - MAX_FILES}개 (전체는 .guard/protect-result.json)`);
    }
  } else out.push('없습니다.');
  const skippedRules = result.rules.filter(rule => rule.status === 'SKIPPED');
  if (skippedRules.length) {
    out.push('', `### 비교하지 못한 검사 ${skippedRules.length}건`, '');
    for (const rule of skippedRules) out.push(`- ${rule.id} ${TITLE[rule.id]}: ${plain(rule.note)}`);
  }

  out.push('', '## 검사별 결과', '', '| 검사 | 무엇을 보나 | 결과 | 비고 |', '| --- | --- | --- | --- |');
  for (const rule of result.rules) {
    const notes = [rule.note, rule.violations.length ? `위반 ${rule.violations.length}건` : '', rule.excused ? `예외로 선언됨 ${rule.excused}건` : ''];
    out.push(`| ${rule.id} | ${TITLE[rule.id]} | ${STATUS[rule.status]} | ${plain(notes.filter(Boolean).join(' / ') || '-')} |`);
  }

  out.push('', '## 기준선 합계 (기준 브랜치 → 지금)', '', '숫자는 "아직 남아 있는 기존 위반"입니다. 줄어드는 것이 좋은 방향이고, 늘어나면 안 됩니다.', '');
  if (result.totals.length) {
    out.push('| 항목 | 기준 브랜치 | 지금 | 변화 |', '| --- | --- | --- | --- |');
    for (const row of result.totals) out.push(`| ${plain(row.label)} | ${plain(value(row.base))} | ${plain(value(row.head))} | ${delta(row.base, row.head)} |`);
  } else out.push('기준선 파일이 없습니다.');
  out.push('');
  return `${out.join('\n')}${evidence(result)}`;
}

function evidence(result) {
  return ['', '## 증빙 종류', '', `- evidenceKind: ${result.evidenceKind}`, `- ${plain(result.evidenceNote)}`,
    `- 검사한 커밋: ${result.commit}${result.workingTreeDirty ? ' (커밋하지 않은 변경 포함)' : ''}`, ''].join('\n');
}
