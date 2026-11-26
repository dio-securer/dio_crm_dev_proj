import { branchingOf } from '../lib/branching.mjs';
import { CODE_EXT, TEST_ROOTS, hasExt, isTestFile } from '../lib/files.mjs';

export const SCOPE = ['frontend/src/', 'backend/src/', 'packages/'];
// Files that are skipped. Explicit file paths only, never a whole directory: a new file is always checked.
// Empty on purpose: the files that define markets do not branch, and the few that do are in the baseline.
export const EXCLUDED_FILES = [];

export const inScope = file => hasExt(file, CODE_EXT)
  && SCOPE.some(prefix => file.startsWith(prefix))
  && !isTestFile(file)
  && !EXCLUDED_FILES.includes(file);

const roots = TEST_ROOTS.map(root => `\`${root}\``).join(', ');

export default {
  id: 'G06',
  name: 'company-branching',
  baseline: 'count',
  forbids: '코드 안에서 회사·국가·시장 값으로 갈라지는 것. (1) 국가/시장 코드와 비교: `x === "KR"`, `"KR" !== x`, `==`, `!=`, 코드 상수 비교(`=== Market.KR`), '
    + '`case "KR":`. (2) 이름에 company/country/market/tenant/nation 이 든 값을 문자열·숫자 리터럴과 비교: `companyCode === "x"`, `o["countryCode"] == 3`. '
    + '(3) 그런 값으로 `switch`, 인라인 객체 조회(`{KR: a}[country]`). (4) 포함·일치 검사: `.includes("KR")`, `["KR","US"].includes(x)`, '
    + '`new Set(["a"]).has(companyCode)`, `/KR/.test(x)`, `Object.is(x, "KR")`. '
    + '괄호, `as`, `<T>`, `!`, `satisfies`, 따옴표 종류, 템플릿 문자열, 문자열 이어 붙이기, 대괄호 접근은 모두 같은 것으로 본다.',
  why: 'AI는 "한국만 다르게" 같은 요청을 받으면 그 자리에 if 를 넣는다. 회사가 늘수록 if 가 쌓여 누구도 전체 동작을 알 수 없게 된다.',
  fix: '차이는 `metadata/` 의 설정값이나 시장 프로필로 표현하고 코드는 그 값을 읽기만 한다. 설정으로 안 되는 회사 전용 동작은 `extensions/<회사>` 로 뺀다.',
  scope: '`frontend/src/`, `backend/src/`, `packages/` 의 코드 파일 중 테스트가 아닌 것. (명세는 frontend/src·backend/src 만 말하지만 엔진·계약 패키지도 넣었다.) '
    + '`extensions/` 는 원래 회사별 코드라 대상이 아니다. TypeScript 구문 트리(AST)로 검사하므로 주석과 일반 문자열 안의 글자는 세지 않는다.',
  exclusions: [
    EXCLUDED_FILES.length
      ? `제외 파일(정확한 경로): ${EXCLUDED_FILES.map(file => `\`${file}\``).join(', ')}`
      : '제외하는 폴더·파일은 없다. 시장·국가를 정의하는 곳(`frontend/src/market/`, `backend/src/globalization/`, '
        + '`packages/contracts/src/globalization.ts`)도 검사하며, 기존 건수는 기준선에 묶인다',
    `테스트 파일: 이름이 \`*.spec.*\`·\`*.test.*\` 인 파일과, 정해진 테스트 폴더 ${roots} 뿐이다. 다른 곳의 \`test/\`·\`__tests__/\` 폴더는 제외되지 않는다. `
      + '테스트 이름을 붙인 파일을 일반 코드가 import 하면 G11 이 막는다',
  ],
  limits: [
    '변수끼리의 비교(`a.market === b.market`, `row.companyCode === actor.companyCode`, `allowed.includes(countryCode)`)는 위반이 아니다. '
      + '같은 파일의 `const`(한 번만 선언된 이름), const 객체의 멤버, enum 멤버에 담긴 문자열은 따라가서 잡는다(`const t = "KR"; x === t`). '
      + '그러나 다른 파일에서 import 한 상수, `let` 변수, 함수 인자로 받은 값, 함수가 돌려준 값에 담긴 코드는 잡지 못한다.',
    '코드 리터럴은 ISO 두 글자 국가코드(대문자)와 UK/EU/HQ/GLOBAL/APAC/EMEA/LATAM, 그리고 `ko-KR` 꼴 로캘이다. '
      + '국가코드와 글자가 같은 문자열·상수 비교는 뜻과 상관없이 센다(막는 쪽으로 틀림). 기준선에도 이런 거짓 양성이 들어 있다(예: 입출고 방향 `direction === "IN"`).',
    '숫자 비교도 센다(`companyId === 3`, `marketCount === 0`). 명세는 문자열 리터럴만 말하지만 숫자 회사 ID 로 갈라지는 길을 막으려고 넣었다.',
    '이름으로 판단한다. 값이 회사/국가/시장인지는 이름에 그 단어가 있을 때만 안다. `const c = row.countryCode` 처럼 같은 파일에서 바로 옮겨 담은 이름은 따라가지만, '
      + '함수 인자 `(c) => c === "acme"` 처럼 이름에 단서가 없고 코드 리터럴도 아닌 비교는 잡지 못한다. 소문자 코드(`"kr"`)도 같다.',
    '잡지 못하는 것: 변수에 담아 둔 조회표(`const T = {KR: a}; T[country]`), 미리 만든 불리언(`isKorea`)으로 갈라지기, 크기 비교(`<`, `>`), '
      + '정규식 객체를 변수에 담아 쓰는 검사, 실행 중에 만든 문자열(`atob`, `split` 결과 등).',
    '타입 정보 없이 구문만 본다. 같은 파일 안에서 이름이 같은 다른 변수는 구분하지 못한다(막는 쪽으로 틀림).',
  ],
  check(ctx) {
    const findings = [];
    for (const file of ctx.files) {
      if (!inScope(file)) continue;
      for (const hit of branchingOf(ctx.ast(file))) findings.push({ file, ...hit });
    }
    return findings;
  },
};
