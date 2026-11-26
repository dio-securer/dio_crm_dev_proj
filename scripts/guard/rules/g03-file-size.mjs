import { CODE_EXT, STYLE_EXT, countLines, hasExt } from '../lib/files.mjs';

export const MAX_LINES = 300;
const METADATA_EXT = ['.json', '.yaml', '.yml'];
// Directory segments that are skipped. Never applied inside the three zones.
const EXCLUDED_SEGMENT = /(^|\/)(dist|generated|__generated__|fixtures|__fixtures__)\//;
const ZONE = /^(metadata|extensions|packages\/engine[^/]*)\//;

export const inScope = file => {
  if (file.startsWith('metadata/')) return hasExt(file, [...METADATA_EXT, ...CODE_EXT, ...STYLE_EXT]);
  if (!hasExt(file, [...CODE_EXT, ...STYLE_EXT])) return false;
  if (ZONE.test(file)) return true;
  return !file.startsWith('docs/') && !EXCLUDED_SEGMENT.test(file);
};

export default {
  id: 'G03',
  name: 'file-size',
  baseline: 'max',
  forbids: `소스 파일 하나가 ${MAX_LINES}줄을 넘는 것. 이미 넘은 파일은 지금 줄 수에 묶이고, 한 줄이라도 늘면 위반이다.`,
  why: 'AI는 새 파일로 나누지 않고 기존 파일 끝에 계속 붙인다. 큰 파일은 AI가 한 번에 읽지 못해 같은 코드를 또 만들고, 일부만 고쳐 버그를 낸다.',
  fix: '기능 단위로 파일을 나눈다. 기준선에 묶인 파일은 늘리지 말고, 새 코드는 새 파일(가능하면 engine/metadata)에 둔다.',
  scope: '모든 .ts .tsx .js .jsx .mjs .cjs .mts .cts .css .scss 파일, 그리고 `metadata/` 아래 .json .yaml .yml. (.jsx .cjs .mts .cts 는 명세에 없지만 빠져나갈 구멍이라 넣었다.)',
  exclusions: [
    '`docs/` 아래(증빙·문서 자료)',
    '경로에 `dist/`, `generated/`, `__generated__/` 폴더가 있는 파일(생성물)',
    '경로에 `fixtures/`, `__fixtures__/` 폴더가 있는 파일(테스트 자료)',
    '잠금 파일(pnpm-lock.yaml 등)과 .sql .md .json(메타데이터 밖)은 대상 확장자가 아니다',
    '단, `metadata/`, `extensions/`, `packages/engine*/` 안에서는 위 제외를 적용하지 않는다',
  ],
  limits: [
    '줄 수만 센다. 한 줄에 코드를 길게 이어 붙이면 통과한다(기존 CSS·일부 TS가 이미 그런 모양이다). 글자 수 상한은 아직 없다.',
    '`fixtures/`·`generated/` 라는 폴더 이름을 쓰면 세 구역 밖에서는 검사를 피할 수 있다. 현재 그런 폴더는 없다.',
    '기준선은 파일 경로에 묶인다. 큰 파일의 이름을 바꾸거나 옮기면 새 파일로 보아 위반이 된다(의도된 동작).',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      const lines = countLines(ctx.read(file));
      if (lines > MAX_LINES) findings.push({ file, line: 0, value: lines, message: `${lines}줄 (상한 ${MAX_LINES}줄)` });
    }
    return findings;
  },
};
