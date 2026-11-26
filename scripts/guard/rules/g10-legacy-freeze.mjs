import { matcher } from '../lib/files.mjs';
import { LEGACY_FILE, LEGACY_RULES, allowedTestCheck, loadLegacy } from '../lib/legacy.mjs';

export default {
  id: 'G10',
  name: 'legacy-freeze',
  baseline: 'none',
  forbids: `legacy(이관 대상) 구역에 새 파일을 만드는 것. \`${LEGACY_FILE}\` 에 적힌 파일만 그 구역에 있을 수 있다. 기존 파일을 고치는 것은 된다.`,
  why: 'AI는 옆에 있는 기존 화면을 복사해 새 화면을 만든다. 그대로 두면 화면·객체별 코드가 계속 늘어 프레임워크로 옮길 양이 줄지 않는다.',
  fix: '새 화면·객체는 `metadata/` 설정과 `packages/engine` 으로 만든다. 회사 전용 동작은 `extensions/` 에 둔다.',
  scope: `동결 구역: ${LEGACY_RULES.flatMap(rule => rule.freeze).filter((glob, i, all) => all.indexOf(glob) === i).map(glob => `\`${glob}\``).join(', ')}.`,
  exclusions: [
    '목록에 있는 파일의 테스트(같은 폴더, 같은 이름에 `.spec`/`.test` 가 붙은 파일)는 새로 만들 수 있다',
    `\`${LEGACY_FILE}\` 의 frozenOther 에 적힌 기존 파일(동결 구역 안에 있지만 이관 대상은 아닌 파일, 예: App.tsx)`,
  ],
  limits: [
    '동결 구역 밖의 새 폴더(예: `frontend/src/screens/`)에 화면별 코드를 만드는 것은 이 규칙이 막지 못한다. G03·G04·G05·G06 이 간접적으로 막는다.',
    '리드 전용 파일(L4)은 폴더가 아니라 이름 패턴으로 묶었다. 이름에 lead 를 넣지 않으면 피할 수 있다.',
    `\`${LEGACY_FILE}\` 을 직접 고쳐 파일을 추가하면 통과한다. 이 파일은 보호 파일로 다뤄야 한다. 스캔 스크립트는 목록을 늘리지 않는다.`,
    '기존 파일의 테스트 이름을 빌려 새 코드를 넣는 것(`기존이름.spec.tsx` 안에 화면 코드)은 잡지 못한다.',
  ],
  check(ctx) {
    const legacy = loadLegacy(ctx.root);
    const findings = [];
    if (!legacy.rulesInSync) findings.push({ file: LEGACY_FILE, line: 0, message: '파일 안의 규칙이 scripts/guard/lib/legacy.mjs 와 다릅니다. 사람이 확인한 뒤 목록을 다시 만들어야 합니다.' });
    const frozen = matcher(LEGACY_RULES.flatMap(rule => rule.freeze));
    const known = new Set([...legacy.files, ...legacy.frozenOther]);
    const allowedTest = allowedTestCheck(known);
    for (const file of ctx.files) {
      if (!frozen(file) || known.has(file) || allowedTest(file)) continue;
      findings.push({ file, line: 0, message: 'legacy 구역의 새 파일 (목록에 없음)' });
    }
    return findings;
  },
};
