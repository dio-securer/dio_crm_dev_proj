import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { excerpt } from '../lib/files.mjs';

const SCRIPT = 'scripts/i18n/hardcode-check.mjs';
const LINE = /^ - (.+?):(\d+): (.*)$/;

export default {
  id: 'G04',
  name: 'hardcoded-ui-text',
  baseline: 'count',
  forbids: '화면 코드(.tsx)에 한글 문구를 직접 적는 것. 문구는 번역 리소스(i18n)에 두고 키로 불러야 한다.',
  why: 'AI는 번역 키를 만드는 대신 눈앞의 문자열을 그대로 적는다. 그러면 나라별 문구 교체와 용어 통일이 불가능해진다.',
  fix: '문구를 `frontend/src/i18n/locales/*` 에 넣고 `t("키")` 로 쓴다. 메타데이터 화면이라면 라벨 키를 메타데이터에 둔다.',
  scope: `기존 검사 \`${SCRIPT}\` 를 고치지 않고 그대로 실행해 결과를 파일별로 센다. 그 검사는 \`frontend/src\` 아래 모든 .tsx 에서 한글이 있는 줄을 찾는다(총계는 \`pnpm i18n:hardcode\` 와 같다).`,
  exclusions: [],
  limits: [
    '기존 검사의 한계를 그대로 물려받는다: .ts 파일(예: 라벨 상수 파일)과 `frontend/src` 밖은 보지 않는다. 한글이 아닌 문구(영어 등)도 보지 않는다. 주석 속 한글도 한 줄로 센다.',
    '줄 단위로 센다. 한 줄에 문구가 여러 개여도 1건이다.',
    '기존 검사 스크립트가 없거나 출력 형식이 달라지면 이 규칙은 통과가 아니라 오류로 실패한다.',
  ],
  check(ctx) {
    if (!fs.existsSync(path.join(ctx.root, SCRIPT))) throw new Error(`${SCRIPT} 가 없습니다.`);
    const run = spawnSync(process.execPath, [SCRIPT], { cwd: ctx.root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (run.error) throw run.error;
    if (run.status === 0) return [];
    if (run.status !== 1) throw new Error(`${SCRIPT} 가 예상 밖의 코드 ${run.status} 로 끝났습니다: ${excerpt(run.stderr, 200)}`);
    const rows = run.stderr.split(/\r?\n/).filter(line => line.startsWith(' - '));
    const findings = rows.map(row => {
      const m = LINE.exec(row);
      if (!m) throw new Error(`${SCRIPT} 출력 줄을 읽을 수 없습니다: ${excerpt(row, 120)}`);
      return { file: m[1].split(path.sep).join('/'), line: Number(m[2]), message: excerpt(m[3], 60) };
    });
    if (findings.length === 0) throw new Error(`${SCRIPT} 가 실패했지만 읽을 수 있는 결과가 없습니다.`);
    return findings;
  },
};
