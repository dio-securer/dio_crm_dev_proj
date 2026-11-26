import { git } from '../lib/files.mjs';

export const CHANGE_ID = /\[(?:REQ-\d+|F\d+-\d+)\]/;

export default {
  id: 'G09',
  name: 'change-id',
  baseline: 'none',
  defaultRun: false,
  forbids: '변경 ID 없는 커밋. 병합 커밋을 뺀 모든 커밋 제목에 `[REQ-숫자]` 또는 `[F숫자-숫자]` 가 있어야 한다.',
  why: 'AI는 요청과 무관한 변경을 슬쩍 섞는다. 커밋마다 요청 번호가 없으면 "이 코드가 왜 들어왔는지"를 추적할 수 없다.',
  fix: '커밋 제목에 해당 요청의 ID 를 넣는다. 예: `[REQ-12] 리드 목록 필터 추가`.',
  scope: '`node scripts/guard/run.mjs --commits <base>..<head>` 로 범위를 줄 때만 돈다. 기본 실행(`pnpm guard`)에는 포함되지 않는다.',
  exclusions: ['병합 커밋(부모가 둘 이상)'],
  limits: ['ID 형식만 본다. 그 요청이 실제로 있는지, 변경 내용이 요청과 맞는지는 확인하지 않는다.', '과거 커밋은 ID 가 없으므로 범위를 이 규칙 도입 이후로 잡아야 한다.'],
  /** Returns { commits, findings } for a revision range. Throws on an invalid range. */
  checkRange(root, range) {
    if (!/^[\w./~^@{}-]+\.\.\.?[\w./~^@{}-]+$/.test(range)) throw new Error(`커밋 범위 형식이 잘못되었습니다: "${range}" (예: origin/main..HEAD)`);
    const out = git(root, ['log', '--no-merges', '--format=%H%x09%s', range, '--']);
    const commits = out.split('\n').filter(Boolean).map(row => ({ sha: row.slice(0, row.indexOf('\t')), subject: row.slice(row.indexOf('\t') + 1) }));
    const findings = commits.filter(commit => !CHANGE_ID.test(commit.subject))
      .map(commit => ({ file: commit.sha.slice(0, 12), line: 0, message: `변경 ID 없음: "${commit.subject}"` }));
    return { commits, findings };
  },
};
