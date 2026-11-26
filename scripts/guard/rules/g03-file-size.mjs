import { CODE_EXT, STYLE_EXT, countLines, hasExt } from '../lib/files.mjs';

export const MAX_LINES = 300;
export const MAX_BYTES = 15000;
export const METADATA_EXT = ['.json', '.yaml', '.yml'];
// The ONLY directories that are skipped. Explicit, concrete paths that exist today: a folder that is
// merely named fixtures/, generated/ or dist/ somewhere else is checked like any other folder.
export const EXCLUDED_DIRS = [
  ['docs/admin-platform/implementation/evidence/', '증빙 자료'],
  ['docs/admin-platform/implementation/ui-improvement/evidence/', '증빙 자료'],
  ['docs/hq-standard/implementation/evidence/', '증빙 자료'],
  ['docs/admin-platform/implementation/fixtures/', '테스트 자료'],
];

export const inScope = file => {
  if (file.startsWith('metadata/')) return hasExt(file, [...METADATA_EXT, ...CODE_EXT, ...STYLE_EXT]);
  return hasExt(file, [...CODE_EXT, ...STYLE_EXT]) && !EXCLUDED_DIRS.some(([dir]) => file.startsWith(dir));
};

export default {
  id: 'G03',
  name: 'file-size',
  baseline: 'max',
  forbids: `소스 파일 하나가 ${MAX_LINES}줄 또는 ${MAX_BYTES}바이트를 넘는 것(둘 중 하나만 넘어도 위반). 이미 넘은 파일은 지금의 줄 수와 바이트 수에 묶이고, 둘 중 어느 쪽이든 조금이라도 늘면 위반이다.`,
  why: 'AI는 새 파일로 나누지 않고 기존 파일 끝에 계속 붙인다. 큰 파일은 AI가 한 번에 읽지 못해 같은 코드를 또 만들고, 일부만 고쳐 버그를 낸다. 줄 수만 세면 한 줄에 길게 이어 붙여 피하므로 바이트도 센다.',
  fix: '기능 단위로 파일을 나눈다. 기준선에 묶인 파일은 늘리지 말고, 새 코드는 새 파일(가능하면 engine/metadata)에 둔다.',
  scope: `저장소 전체의 .ts .tsx .js .jsx .mjs .cjs .mts .cts .css .scss 파일, 그리고 \`metadata/\` 아래 .json .yaml .yml. `
    + `가드 자신의 코드(\`scripts/guard/\`)와 테스트 파일도 대상이다. 상한: ${MAX_LINES}줄, ${MAX_BYTES}바이트(파일 크기 그대로).`,
  exclusions: [
    ...EXCLUDED_DIRS.map(([dir, reason]) => `\`${dir}\` (${reason}; 지금은 대상 확장자 파일이 없다)`),
    '위 목록은 지금 실제로 있는 폴더를 그대로 적은 것이다. 이름이 `fixtures/`·`generated/`·`dist/` 인 다른 폴더는 제외되지 않는다',
    '잠금 파일(pnpm-lock.yaml 등)과 .sql .md .json(메타데이터 밖)은 대상 확장자가 아니다',
  ],
  limits: [
    '기준선에 묶인 파일은 줄 수와 바이트 수를 따로 본다. 줄을 줄여도 바이트가 늘면 위반이다. 한 글자 고치는 수정도 바이트가 늘면 막힌다(의도된 동작: 고치면서 줄여야 한다).',
    '파일 여러 개로 잘게 쪼개 같은 코드를 늘리는 것은 이 규칙이 막지 못한다.',
    '대상 확장자가 아닌 파일(.json .sql .html .md 등, `metadata/` 밖)에 코드를 넣으면 보지 않는다.',
    '기준선은 파일 경로에 묶인다. 큰 파일의 이름을 바꾸거나 옮기면 새 파일로 보아 위반이 된다(의도된 동작).',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      const lines = countLines(ctx.read(file));
      const bytes = ctx.size(file);
      if (lines <= MAX_LINES && bytes <= MAX_BYTES) continue;
      findings.push({ file, line: 0, value: { lines, bytes }, message: `${lines}줄, ${bytes}바이트 (상한 ${MAX_LINES}줄, ${MAX_BYTES}바이트)` });
    }
    return findings;
  },
};
