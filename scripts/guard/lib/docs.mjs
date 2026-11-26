// docs/framework/guard-rules.md is generated from rule metadata so the document cannot drift.
import fs from 'node:fs';
import path from 'node:path';

export const DOCS_FILE = 'docs/framework/guard-rules.md';
const cell = text => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const BASELINE_LABEL = {
  none: '기준선 없음. 한 건이라도 있으면 실패한다.',
  count: '파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.',
  max: '상한을 넘은 파일의 현재 값(줄 수와 바이트 수)을 기준선에 묶는다. 묶인 파일이 어느 쪽으로든 커지거나, 기준선에 없는 파일이 상한을 넘으면 실패한다.',
};

export function renderDocs(rules) {
  const out = [
    '# 가드 규칙',
    '',
    '> 이 문서는 `node scripts/guard/run.mjs --docs` 가 규칙 코드의 설명에서 만든다. 직접 고치지 않는다.',
    '> 문서가 규칙과 다르면 `pnpm guard` 가 실패한다.',
    '',
    '가드는 AI가 쓴 코드가 프레임워크 규칙에서 벗어나는 것을 기계로 막는다. 기존 위반은 고치지 않고 `guard-baseline.json` 에 지금 숫자로 묶어 두며, 그 숫자는 줄어들 수만 있다.',
    '',
    '## 실행',
    '',
    '| 명령 | 하는 일 |',
    '| --- | --- |',
    '| `pnpm guard` | G09 를 뺀 모든 규칙을 돌린다. 기준선보다 늘어난 위반이 있으면 종료 코드 1. 결과는 `.guard/guard-result.json` 에 남는다. |',
    '| `pnpm guard --update-baseline` | 줄어든 숫자만 기준선에 반영한다. 숫자를 올리거나 파일을 추가하지 않는다. |',
    '| `pnpm guard --init-baseline` | 기준선을 처음 만든다. 이미 있으면 거부한다. |',
    '| `pnpm guard --strict` | 기준선을 더 내릴 수 있는데 안 내린 경우도 실패로 본다. |',
    '| `node scripts/guard/run.mjs --commits <base>..<head>` | G09(변경 ID)만 돌린다. 범위 안에 커밋이 하나도 없으면 통과가 아니라 오류(종료 코드 2)다. |',
    '| `node scripts/guard/run.mjs --docs` | 이 문서를 다시 만든다. |',
    '| `node scripts/guard/legacy-scan.mjs` | `legacy-files.json` 을 만들거나 줄인다. |',
    '',
    '종료 코드: 0 통과, 1 위반 있음, 2 사용법 오류 또는 가드 자체 오류(규칙이 돌지 못하면 통과가 아니라 실패다).',
    '',
    '검사 대상은 git 이 추적하는 파일과, 아직 추적하지 않았지만 무시 목록(.gitignore)에 없는 파일이다. 커밋 전에도 걸린다.',
    '',
    '## 공통 한계',
    '',
    '- 기준선은 파일별 "건수"다. 같은 파일에서 위반 하나를 고치고 다른 하나를 새로 넣으면 건수가 같아 통과한다(바꿔치기).',
    '- 기준선에는 거짓 양성도 들어 있다. 예: G06 의 `direction === "IN"`(입출고 방향이지 인도가 아니다), G05 의 색처럼 보이는 글자, G08 의 테스트와 무관한 skip 속성. 건수가 곧 실제 문제의 수는 아니다.',
    '- 테스트 예외는 두 가지뿐이다: 이름이 `*.spec.*`·`*.test.*` 인 파일, 그리고 정해진 테스트 폴더 `backend/test/`, `tests/`. 폴더 이름만 test 로 짓는 것은 예외가 아니다. 예외 목록(테스트 폴더, G03 제외 폴더, G07 허용 계층)은 모두 코드에 경로 그대로 적혀 있고, 늘리려면 `scripts/guard/` 를 고쳐야 한다.',
    '- G06·G07·G11 은 `frontend/`, `backend/`, `packages/`, `extensions/` 만 본다. 저장소 맨 위에 새 폴더를 만들어 코드를 두면 이 셋은 보지 않는다(G03·G05 는 저장소 전체를 본다). 작업 공간(pnpm-workspace.yaml)에 없는 폴더는 빌드에 들어가지 않는다.',
    '- 줄 끝 주석으로 규칙을 끄는 방법은 일부러 만들지 않았다.',
    '- `guard-baseline.json`, `legacy-files.json`, `scripts/guard/` 를 고치면 무엇이든 통과시킬 수 있다. 두 JSON 을 지우고 다시 만드는 것도 같다. 이 셋은 보호 파일로 다뤄야 하며, 그 보호(기준 브랜치와 비교)는 CI 에서 한다(다음 단계 F0-3). 지금 가드 혼자서는 막지 못한다.',
    '- 모든 규칙은 정규식으로 글자 모양을 본다. 문자열을 이어 붙이거나 이름을 바꿔 우회하려고 마음먹으면 피할 수 있다. 목적은 무심코 생기는 이탈을 막는 것이다.',
    '',
    '## 규칙 한눈에 보기',
    '',
    '| ID | 이름 | 금지하는 것 | 왜 (AI의 어떤 약점) | 고치는 법 |',
    '| --- | --- | --- | --- | --- |',
    ...rules.map(rule => `| ${rule.id} | ${rule.name} | ${cell(rule.forbids)} | ${cell(rule.why)} | ${cell(rule.fix)} |`),
    '',
    '## 규칙별 범위·예외·한계',
  ];
  for (const rule of rules) {
    out.push('', `### ${rule.id} ${rule.name}`, '', `- 범위: ${rule.scope}`, `- 기준선: ${BASELINE_LABEL[rule.baseline]}`);
    out.push(rule.exclusions.length ? '- 예외(검사하지 않는 것):' : '- 예외(검사하지 않는 것): 없음');
    for (const item of rule.exclusions) out.push(`  - ${item}`);
    out.push('- 알려진 한계:');
    for (const item of rule.limits) out.push(`  - ${item}`);
  }
  return `${out.join('\n')}\n`;
}

export function writeDocs(root, rules) {
  const file = path.join(root, DOCS_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderDocs(rules));
}

export function docsInSync(root, rules) {
  const file = path.join(root, DOCS_FILE);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === renderDocs(rules);
}
