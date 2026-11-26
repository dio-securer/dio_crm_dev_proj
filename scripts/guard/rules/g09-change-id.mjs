import fs from 'node:fs';
import path from 'node:path';
import { git } from '../lib/files.mjs';

export const CHANGE_ID = /\[(?:REQ-\d+|F\d+-\d+)\]/;
// Commits made before this rule existed carry no ID. The start point names the LAST exempt commit; it and its
// ancestors are skipped, every other commit in the range is checked. Protect check P5 forbids changing it.
export const START_FILE = 'scripts/guard/commit-id-start.json';

/** Returns the full hash of the last exempt commit. Throws when the file is malformed. */
export function parseStart(text) {
  const doc = JSON.parse(text);
  if (!/^[0-9a-f]{40}$/.test(doc?.lastExemptCommit ?? '')) throw new Error(`${START_FILE}: lastExemptCommit 은 40자 커밋 해시여야 합니다.`);
  return doc.lastExemptCommit;
}

export default {
  id: 'G09',
  name: 'change-id',
  baseline: 'none',
  defaultRun: false,
  forbids: '변경 ID 없는 커밋. 병합 커밋을 뺀 모든 커밋 제목에 `[REQ-숫자]` 또는 `[F숫자-숫자]` 가 있어야 한다.',
  why: 'AI는 요청과 무관한 변경을 슬쩍 섞는다. 커밋마다 요청 번호가 없으면 "이 코드가 왜 들어왔는지"를 추적할 수 없다.',
  fix: '커밋 제목에 해당 요청의 ID 를 넣는다. 예: `[REQ-12] 리드 목록 필터 추가`.',
  scope: '`node scripts/guard/run.mjs --commits <base>..<head>` 로 범위를 줄 때만 돈다. 기본 실행(`pnpm guard`)에는 포함되지 않는다.',
  exclusions: [
    '병합 커밋(부모가 둘 이상)',
    `규칙 도입 전 커밋: \`${START_FILE}\` 의 lastExemptCommit 과 그 조상. 그 밖의 커밋은 모두 검사한다(시작점의 후손이 아닌 곁가지 커밋도 검사한다).`,
  ],
  limits: [
    'ID 형식만 본다. 그 요청이 실제로 있는지, 변경 내용이 요청과 맞는지는 확인하지 않는다.',
    `시작점 파일은 지금 작업 트리의 것을 읽는다. 시작점을 뒤로 옮겨 커밋을 빼는 것은 이 규칙이 아니라 보호 검사(\`--protect\` 의 P5)가 막는다.`,
  ],
  /** Returns { commits, findings, exempt, start } for a revision range. Throws on an invalid range or an unusable start point. */
  checkRange(root, range) {
    if (!/^[\w./~^@{}-]+\.\.\.?[\w./~^@{}-]+$/.test(range)) throw new Error(`커밋 범위 형식이 잘못되었습니다: "${range}" (예: origin/main..HEAD)`);
    const file = path.join(root, START_FILE);
    if (!fs.existsSync(file)) throw new Error(`${START_FILE} 이 없습니다.`);
    const start = parseStart(fs.readFileSync(file, 'utf8'));
    git(root, ['cat-file', '-e', `${start}^{commit}`]);
    const list = extra => git(root, ['log', '--no-merges', '--format=%H%x09%s', range, ...extra, '--']).split('\n').filter(Boolean)
      .map(row => ({ sha: row.slice(0, row.indexOf('\t')), subject: row.slice(row.indexOf('\t') + 1) }));
    const all = list([]);
    const commits = list([`^${start}`]);
    const findings = commits.filter(commit => !CHANGE_ID.test(commit.subject))
      .map(commit => ({ file: commit.sha.slice(0, 12), line: 0, message: `변경 ID 없음: "${commit.subject}"` }));
    return { commits, findings, exempt: all.length - commits.length, start };
  },
};
