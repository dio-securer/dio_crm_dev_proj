// Plain-Korean rendering of a `crm verify` result: summary.md for the evidence bundle and lines for the terminal.
import { STATUS } from './run.mjs';

const STATUS_KO = { PASS: '통과', FAIL: '실패', ERROR: '오류(돌지 못함)', NOT_RUN: '돌리지 않음' };
const VERDICT_KO = {
  PASS: '통과 - 모든 단계가 돌았고 모두 통과했습니다.',
  FAIL: '실패 - 통과하지 못한 단계가 있습니다. 완료가 아닙니다.',
  ERROR: '오류 - 돌지 못한 단계가 있어 결과를 알 수 없습니다. 통과가 아닙니다.',
  INCOMPLETE: '미완 - 돌리지 않은 단계가 있습니다. 통과가 아닙니다.',
  TEST_ONLY: '시험용 - 도구 자체를 시험하려고 넣은 단계 목록입니다. 실제 검증 결과가 아닙니다.',
};
// Branch names and notes can hold any text. Keep them on one line and unable to restyle the summary.
const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '[': '&#91;', ']': '&#93;', '`': '&#96;', '*': '&#42;', _: '&#95;', '~': '&#126;' };
const plain = text => String(text ?? '').replace(/\s+/g, ' ').trim().replace(/[&<>|[\]`*_~]/g, ch => ENTITY[ch]);
const seconds = ms => `${(ms / 1000).toFixed(1)}초`;
const code = step => (step.exitCode === null ? '-' : String(step.exitCode));

export function stepLine(step) {
  const head = `${STATUS_KO[step.status].padEnd(8)} ${step.title}  (종료 코드 ${code(step)}, ${seconds(step.durationMs)})`;
  return step.note ? `${head}\n         ${step.note}` : head;
}

export function notPassedLine(evidence) {
  const rows = evidence.steps.filter(step => step.status !== STATUS.PASS);
  if (rows.length === 0) return '통과하지 못한 단계: 없음';
  return `통과하지 못한 단계 ${rows.length}개: ${rows.map(step => `${step.title} = ${STATUS_KO[step.status]}(종료 코드 ${code(step)})`).join(', ')}`;
}

export function renderSummary(evidence) {
  const dirty = evidence.dirty ? `예 - 커밋하지 않은 변경 ${evidence.dirtyFileCount}개가 섞인 상태에서 돌렸습니다. 이 증거는 커밋 그대로의 증거가 아닙니다.` : '아니오';
  const out = [
    '# crm verify 증거 요약', '',
    `**판정: ${VERDICT_KO[evidence.verdict]}**`, '',
    `- ${plain(notPassedLine(evidence))}`,
    `- 증거 종류(evidenceKind): ${evidence.evidenceKind}`,
    `- ${plain(evidence.evidenceNote)}`,
    `- 커밋: ${plain(evidence.commit)} (브랜치 ${plain(evidence.branch)})`,
    `- 커밋하지 않은 변경이 있었나: ${dirty}`,
    ...(evidence.headMovedDuringRun ? ['- 실행 중에 커밋이 바뀌었습니다. 이 결과는 어느 커밋의 것인지 알 수 없습니다.'] : []),
    `- 보호 검사의 기준: ${evidence.base.ref ? plain(evidence.base.ref) : '없음'}`,
    `- 실행 시각: ${evidence.startedAt} ~ ${evidence.finishedAt} (${seconds(evidence.durationMs)})`,
    ...(evidence.stepSet === 'DEFAULT' ? [] : ['- 단계 목록: 시험용(INJECTED). 정해진 단계 목록이 아닙니다.']),
    '', '## 단계별 결과', '',
    '| 순서 | 단계 | 명령 | 결과 | 종료 코드 | 걸린 시간 | 기록 |', '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  evidence.steps.forEach((step, index) => {
    const result = [STATUS_KO[step.status], code(step), seconds(step.durationMs), plain(step.logPath ?? '-')];
    const cells = [index + 1, plain(step.title), plain(step.command ?? '-'), ...result];
    out.push(`| ${cells.join(' | ')} |`);
  });
  const notes = evidence.steps.filter(step => step.note);
  if (notes.length) {
    out.push('', '## 비고', '');
    for (const step of notes) out.push(`- ${plain(step.title)}: ${plain(step.note)}`);
  }
  out.push('', '## 읽는 법', '',
    '- "통과"는 그 명령이 실제로 돌았고 종료 코드 0 으로 끝났다는 뜻입니다. 그 밖의 경우는 통과로 적지 않습니다.',
    '- 이 증거는 합성(SYNTHETIC)입니다. 실제 DB 나 운영 환경에서 확인한 실증 증거가 아닙니다. 이 명령은 실증 증거를 만들 수 없습니다.',
    '- 이 파일은 서명되어 있지 않습니다. 병합 판단에는 CI 가 올린 요약을 쓰고, 이 꾸러미는 작업자의 보고 근거로 씁니다.', '');
  return out.join('\n');
}
