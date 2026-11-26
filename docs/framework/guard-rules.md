# 가드 규칙

> 이 문서는 `node scripts/guard/run.mjs --docs` 가 규칙 코드의 설명에서 만든다. 직접 고치지 않는다.
> 문서가 규칙과 다르면 `pnpm guard` 가 실패한다.

가드는 AI가 쓴 코드가 프레임워크 규칙에서 벗어나는 것을 기계로 막는다. 기존 위반은 고치지 않고 `guard-baseline.json` 에 지금 숫자로 묶어 두며, 그 숫자는 줄어들 수만 있다.

## 실행

| 명령 | 하는 일 |
| --- | --- |
| `pnpm guard` | G09 를 뺀 모든 규칙을 돌린다. 기준선보다 늘어난 위반이 있으면 종료 코드 1. 결과는 `.guard/guard-result.json` 에 남는다. |
| `pnpm guard --update-baseline` | 줄어든 숫자만 기준선에 반영한다. 숫자를 올리거나 파일을 추가하지 않는다. |
| `pnpm guard --init-baseline` | 기준선을 처음 만든다. 이미 있으면 거부한다. |
| `pnpm guard --strict` | 기준선을 더 내릴 수 있는데 안 내린 경우도 실패로 본다. |
| `node scripts/guard/run.mjs --commits <base>..<head>` | G09(변경 ID)만 돌린다. 범위 안에 커밋이 하나도 없으면 통과가 아니라 오류(종료 코드 2)다. |
| `node scripts/guard/run.mjs --protect <기준 ref>` | 보호 검사(P1~P5). 기준 브랜치와 비교해 기준선·legacy 목록·테스트·변경 ID 시작점이 약해졌는지 본다. 결과는 `.guard/protect-result.json` 과 `.guard/summary.md`. 자세한 내용은 `docs/framework/ci-gates.md`. |
| `node scripts/guard/run.mjs --docs` | 이 문서를 다시 만든다. |
| `node scripts/guard/run.mjs --codeowners` | `.github/CODEOWNERS` 를 보호 경로 목록(`scripts/guard/protected-paths.json`)에서 다시 만든다. 파일이 목록과 다르면 `pnpm guard` 가 실패한다. |
| `node scripts/guard/legacy-scan.mjs` | `legacy-files.json` 을 만들거나 줄인다. |

종료 코드: 0 통과, 1 위반 있음, 2 사용법 오류 또는 가드 자체 오류(규칙이 돌지 못하면 통과가 아니라 실패다).

검사 대상은 git 이 추적하는 파일과, 아직 추적하지 않았지만 무시 목록(.gitignore)에 없는 파일이다. 커밋 전에도 걸린다.

## 공통 한계

- 기준선은 파일별 "건수"다. 같은 파일에서 위반 하나를 고치고 다른 하나를 새로 넣으면 건수가 같아 통과한다(바꿔치기).
- 기준선에는 거짓 양성도 들어 있다. 예: G06 의 `direction === "IN"`(입출고 방향이지 인도가 아니다), G05 의 색처럼 보이는 글자, G08 의 테스트와 무관한 skip 속성. 건수가 곧 실제 문제의 수는 아니다.
- 테스트 예외는 두 가지뿐이다: 이름이 `*.spec.*`·`*.test.*` 인 파일, 그리고 정해진 테스트 폴더 `backend/test/`, `tests/`. 폴더 이름만 test 로 짓는 것은 예외가 아니다. 예외 목록(테스트 폴더, G03 제외 폴더, G07 허용 계층)은 모두 코드에 경로 그대로 적혀 있고, 늘리려면 `scripts/guard/` 를 고쳐야 한다.
- G06·G07·G11 은 `frontend/`, `backend/`, `packages/`, `extensions/` 만 본다. 저장소 맨 위에 새 폴더를 만들어 코드를 두면 이 셋은 보지 않는다(G03·G05 는 저장소 전체를 본다). 작업 공간(pnpm-workspace.yaml)에 없는 폴더는 빌드에 들어가지 않는다.
- 줄 끝 주석으로 규칙을 끄는 방법은 일부러 만들지 않았다.
- `guard-baseline.json`, `legacy-files.json`, `scripts/guard/` 를 고치면 무엇이든 통과시킬 수 있다. 두 JSON 을 지우고 다시 만드는 것도 같다. 그래서 이 셋은 보호 파일이다. `pnpm guard` 혼자서는 막지 못하고, CI 의 보호 검사(`--protect`)가 기준 브랜치와 비교해 막는다: 숫자를 올리거나 항목을 추가하면 실패하고, `scripts/guard/` 를 고치면 요약 맨 위에 "보호 파일 변경"으로 나온다(`docs/framework/ci-gates.md`).
- 코드 구조를 보는 규칙(G02·G06·G07·G08·G11, G04 의 새 구역 부분)은 TypeScript 구문 트리(AST)로 검사한다. 그래서 괄호, `as`·`<T>`·`!`·`satisfies`, 따옴표 종류, 템플릿 문자열, 문자열 이어 붙이기, 대괄호 접근, 줄바꿈·공백처럼 뜻이 같은 다른 표기는 같은 것으로 본다. 주석과 일반 문자열 안의 글자는 세지 않는다.
- AST 는 구문만 본다(타입 검사·다른 파일 추적 없음). 다른 파일에서 가져온 값, 함수 인자, 실행 중에 만든 문자열은 따라가지 못한다. 이름으로 판단하는 규칙은 이름을 바꾸면 피할 수 있다. 목적은 무심코 생기는 이탈과 흔한 우회 표기를 막는 것이다.
- 코드 파일이 구문 오류로 읽히지 않으면 그 파일을 보는 규칙은 통과가 아니라 오류(ERROR, 종료 코드 2)가 된다. TypeScript 패키지가 설치되지 않은 경우도 같다(`pnpm install` 필요).
- G01·G03·G05·G10 과 CSS 파일, G04 의 기존 화면 부분은 구문이 아니라 경로·크기·글자 모양을 본다(정규식).
- 가드 자신의 코드와 테스트, 프레임워크 명령(`scripts/guard/`, `tests/guard/`, `scripts/crm/`)은 한 줄이 160자를 넘으면 가드 오류(종료 코드 2)가 된다.

## 규칙 한눈에 보기

| ID | 이름 | 금지하는 것 | 왜 (AI의 어떤 약점) | 고치는 법 |
| --- | --- | --- | --- | --- |
| G01 | metadata-only-config | `metadata/` 아래에 설정 파일이 아닌 것(코드·스크립트·스타일 등)을 두는 것. 허용 확장자는 .json .yaml .yml .md 와 `.gitkeep` 뿐이다. .json 은 JSON 으로 읽혀야 한다. | AI는 급하면 설정 구역에 코드를 끼워 넣는다. 설정과 코드가 섞이면 "설정만 바꿔서 화면을 만든다"는 전제가 깨진다. | 코드는 `packages/engine`(공통) 또는 `extensions/<이름>`(회사별)으로 옮기고, `metadata/` 에는 값만 남긴다. |
| G02 | zone-boundaries | 구역 경계를 넘는 import. `extensions/<이름>/` 의 코드는 자기 폴더 안 상대경로, `@dio-crm/contracts*`, `@dio-crm/engine*`, `react`, `react/jsx-runtime` 만 import 할 수 있다. 확장 안의 테스트 파일(`*.spec.*`, `*.test.*`)은 여기에 `vitest`, `node:test`, `node:assert`, `node:assert/strict` 를 더 쓸 수 있다. `packages/engine*/` 의 코드는 `frontend/`, `backend/`, `extensions/`, legacy 파일을 import 할 수 없다. | AI는 가까이 있는 코드를 그대로 끌어다 쓴다. 엔진이 화면 코드를, 확장이 다른 회사 확장이나 DB를 직접 잡으면 한 곳을 고칠 때 전부 깨진다. | 필요한 기능을 `@dio-crm/contracts` 의 계약이나 `@dio-crm/engine` 의 공개 API로 올리고 그것을 import 한다. |
| G03 | file-size | 소스 파일 하나가 300줄 또는 15000바이트를 넘는 것(둘 중 하나만 넘어도 위반). 이미 넘은 파일은 지금의 줄 수와 바이트 수에 묶이고, 둘 중 어느 쪽이든 조금이라도 늘면 위반이다. | AI는 새 파일로 나누지 않고 기존 파일 끝에 계속 붙인다. 큰 파일은 AI가 한 번에 읽지 못해 같은 코드를 또 만들고, 일부만 고쳐 버그를 낸다. 줄 수만 세면 한 줄에 길게 이어 붙여 피하므로 바이트도 센다. | 기능 단위로 파일을 나눈다. 기준선에 묶인 파일은 늘리지 말고, 새 코드는 새 파일(가능하면 engine/metadata)에 둔다. |
| G04 | hardcoded-ui-text | 코드에 한글 문구를 직접 적는 것. 문구는 번역 리소스(i18n)나 메타데이터의 라벨 키에 두고 키로 불러야 한다. 기존 화면(.tsx)은 기준선에 묶이고, 새 구역(`extensions/`, `packages/engine*/`)은 한 건도 허용하지 않는다. | AI는 번역 키를 만드는 대신 눈앞의 문자열을 그대로 적는다. 그러면 나라별 문구 교체와 용어 통일이 불가능해진다. | 문구를 `frontend/src/i18n/locales/*` 에 넣고 `t("키")` 로 쓴다. 메타데이터 화면이라면 라벨 키를 메타데이터에 둔다. |
| G05 | raw-style | 색을 날값으로 적는 것: 16진 색(#fff, #FFFFFF, #ffffff80)과 rgb()/rgba()/hsl()/hsla()/hwb()/oklab()/oklch(). 색은 디자인 토큰(CSS 변수)으로만 쓴다. | AI는 화면마다 비슷하지만 조금씩 다른 색을 새로 적는다. 그러면 화면마다 모양이 달라지고 테마 변경이 불가능해진다. | `var(--토큰이름)` 을 쓴다. 맞는 토큰이 없으면 토큰 파일에 토큰을 추가하고 그것을 쓴다. |
| G06 | company-branching | 코드 안에서 회사·국가·시장 값으로 갈라지는 것. (1) 국가/시장 코드와 비교: `x === "KR"`, `"KR" !== x`, `==`, `!=`, 코드 상수 비교(`=== Market.KR`), `case "KR":`. (2) 이름에 company/country/market/tenant/nation 이 든 값을 문자열·숫자 리터럴과 비교: `companyCode === "x"`, `o["countryCode"] == 3`. (3) 그런 값으로 `switch`, 인라인 객체 조회(`{KR: a}[country]`). (4) 포함·일치 검사: `.includes("KR")`, `["KR","US"].includes(x)`, `new Set(["a"]).has(companyCode)`, `/KR/.test(x)`, `Object.is(x, "KR")`. 괄호, `as`, `<T>`, `!`, `satisfies`, 따옴표 종류, 템플릿 문자열, 문자열 이어 붙이기, 대괄호 접근은 모두 같은 것으로 본다. | AI는 "한국만 다르게" 같은 요청을 받으면 그 자리에 if 를 넣는다. 회사가 늘수록 if 가 쌓여 누구도 전체 동작을 알 수 없게 된다. | 차이는 `metadata/` 의 설정값이나 시장 프로필로 표현하고 코드는 그 값을 읽기만 한다. 설정으로 안 되는 회사 전용 동작은 `extensions/<회사>` 로 뺀다. |
| G07 | direct-io | 정해진 인프라 폴더 밖에서 DB나 네트워크를 직접 건드리는 것. (1) DB 드라이버·ORM import(mssql, tedious, typeorm, knex, prisma, pg, mysql2, mongoose, redis …), HTTP 라이브러리·node 네트워크 모듈 import(axios, undici, http, https, net …). import 문, `require()`, `import()`, `import x = require()`, `createRequire()()`, 타입 import 모두 같다. (2) `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `axios` 라는 전역 이름을 쓰는 것: `fetch(...)`, `window.top.fetch(...)`, `globalThis["fetch"](...)`, `const { fetch: go } = window`, `const f = fetch`. (3) `http(s).request/get(` 호출. (4) 확인할 수 없는 것: 경로를 실행 중에 만드는 import()/require(), `window[이름]`, 글자로 코드를 만들어 실행하는 `eval(…)`·`new Function(…)`. | AI는 화면이나 서비스 코드 한가운데서 바로 DB·API를 부른다. 그러면 권한 검사·감사 기록·오류 처리·회사 격리를 건너뛰는 길이 생기고, 호출 지점이 수백 곳으로 흩어진다. | 허용된 인프라 계층(아래 목록)의 함수를 통해 호출한다. 프런트는 API 클라이언트를, 백엔드는 database/integration 계층이 내주는 인터페이스를 쓴다. |
| G08 | disabled-tests | 테스트를 꺼 두는 것. (1) 테스트 함수의 skip / only / todo / skipIf / runIf / fixme: `it.skip(...)`, `it . skip`, 줄바꿈 뒤 `.skip`, `it["skip"](...)`, `describe["only"](...)`, `it?.todo("a")`, `describe.each(x).only`, `const { skip } = it`, `import { skip } from "node:test"`. (2) 받는 쪽이 무엇이든 `.skip(...)`·`.only(...)`·`.todo(...)` 호출(`t.skip()`, `this.skip()`). (3) x 로 시작하는 꺼진 테스트 이름(xit, xtest, xdescribe …)과 f 로 시작하는 단독 실행(fit, fdescribe). (4) 옵션 객체의 skip·todo·only 값이 꺼짐(false, null, undefined, 0, 빈 문자열)이 아닌 것: `{ skip: true }`, `{ ["skip"]: true }`, `{ skip }`, `opts.skip = true`. | AI는 테스트가 실패하면 원인을 고치는 대신 테스트를 끄거나 하나만 돌려 "통과"를 만든다. 꺼진 테스트는 아무도 다시 켜지 않는다. | 테스트를 켜고 실패 원인을 고친다. 정말 지울 테스트라면 이유를 커밋에 적고 삭제한다(끄는 것은 안 된다). |
| G09 | change-id | 변경 ID 없는 커밋. 병합 커밋을 뺀 모든 커밋 제목에 `[REQ-숫자]` 또는 `[F숫자-숫자]` 가 있어야 한다. | AI는 요청과 무관한 변경을 슬쩍 섞는다. 커밋마다 요청 번호가 없으면 "이 코드가 왜 들어왔는지"를 추적할 수 없다. | 커밋 제목에 해당 요청의 ID 를 넣는다. 예: `[REQ-12] 리드 목록 필터 추가`. |
| G10 | legacy-freeze | legacy(이관 대상) 구역에 새 파일을 만드는 것. `legacy-files.json` 에 적힌 파일만 그 구역에 있을 수 있다. 기존 파일을 고치는 것은 된다. | AI는 옆에 있는 기존 화면을 복사해 새 화면을 만든다. 그대로 두면 화면·객체별 코드가 계속 늘어 프레임워크로 옮길 양이 줄지 않는다. | 새 화면·객체는 `metadata/` 설정과 `packages/engine` 으로 만든다. 회사 전용 동작은 `extensions/` 에 둔다. |
| G11 | no-test-imports | 테스트가 아닌 코드가 테스트 파일을 가져다 쓰는 것: 이름이 `*.spec.*`·`*.test.*` 인 파일(확장자를 생략한 `./x.spec`, 질의·해시를 붙인 `./x.spec?raw` 포함)이나 테스트 폴더 안의 파일을 import·require·re-export·`import()`·`import.meta.glob`·`new URL(…, import.meta.url)` 로 가리키는 것. 경로를 실행 중에 만드는 import()/require() 도 위반이다. | G06·G07 은 테스트 파일을 검사하지 않는다. AI가 운영 코드를 `gateway.spec.ts` 같은 이름으로 만들어 두고 일반 코드에서 불러 쓰면 그 검사를 통째로 피한다. 이 규칙이 그 길을 막는다. | 운영에 필요한 코드는 테스트 이름이 아닌 일반 파일로 옮긴다(그러면 G06·G07 이 본다). 테스트끼리 나눠 쓰는 도우미는 테스트 파일에서만 import 한다. |

## 규칙별 범위·예외·한계

### G01 metadata-only-config

- 범위: `metadata/` 아래 모든 파일(하위 폴더 포함, 추적 전 파일 포함).
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것): 없음
- 알려진 한계:
  - YAML 은 문법 검사를 하지 않는다(의존성 0 원칙). 확장자만 본다.
  - 허용 확장자 안에 문자열로 숨긴 코드는 잡지 못한다.

### G02 zone-boundaries

- 범위: `extensions/` 와 `packages/engine*/` 아래 코드 파일(.ts .tsx .js .jsx .mjs .cjs .mts .cts). 테스트 파일도 예외 없이 본다. import 는 TypeScript 구문 트리(AST)에서 찾는다: import/export 문, `import x = require()`, `import()`, `require()` 와 그 별칭, `require.resolve()`, `createRequire()()`, 타입 안의 `import("x")`, `import.meta.glob`, `new URL(x, import.meta.url)`, `/// <reference path>`.
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것): 없음
- 알려진 한계:
  - 허용 목록은 글자 그대로 비교한다. 확장은 `react-dom`, `react/jsx-dev-runtime`, zod, node 내장 모듈(테스트용 넷 제외)을 직접 import 할 수 없다. 엔진은 자기 패키지 밖으로 나가는 상대경로 전부가 위반이다. 경로 뒤의 `?질의`·`#해시` 는 떼고 비교한다.
  - `@dio-crm/contracts*`·`@dio-crm/engine*` 는 앞부분만 본다. `@dio-crm/contracts-x` 같은 이름의 패키지를 새로 만들면 통과한다(패키지 추가는 lockfile 변경으로 드러난다). 경로 안에 `.`·`..`·빈 마디가 든 것(`@dio-crm/contracts/../api`)은 위반이다.
  - 테스트용 허용은 파일 이름으로 정한다. 확장 안에서 일반 코드가 테스트 파일을 import 하는 것은 G11 이 막는다.
  - 명세보다 엄격한 점: 경로를 실행 중에 만드는 import()/require() 는 확인할 수 없으므로 위반으로 본다. `extensions/` 바로 아래(확장 폴더 밖)의 코드 파일도 위반이다.
  - legacy 계약 파일은 `@dio-crm/contracts/lead-grid-columns` 를 확장자(.js/.ts) 유무, `/src/`·`/dist/` 경유, 대소문자와 상관없이 같은 파일로 본다. 그러나 `@dio-crm/contracts` 의 index 를 거쳐 legacy 파일을 다시 내보내는 경우는 잡지 못한다. tsconfig paths 별칭도 풀지 않는다(별칭은 허용 목록에 없으므로 확장에서는 위반이 된다).

### G03 file-size

- 범위: 저장소 전체의 .ts .tsx .js .jsx .mjs .cjs .mts .cts .css .scss 파일, 그리고 `metadata/` 아래 .json .yaml .yml. 가드 자신의 코드(`scripts/guard/`)와 테스트 파일도 대상이다. 상한: 300줄, 15000바이트(파일 크기 그대로).
- 기준선: 상한을 넘은 파일의 현재 값(줄 수와 바이트 수)을 기준선에 묶는다. 묶인 파일이 어느 쪽으로든 커지거나, 기준선에 없는 파일이 상한을 넘으면 실패한다.
- 예외(검사하지 않는 것):
  - `docs/admin-platform/implementation/evidence/` (증빙 자료; 지금은 대상 확장자 파일이 없다)
  - `docs/admin-platform/implementation/ui-improvement/evidence/` (증빙 자료; 지금은 대상 확장자 파일이 없다)
  - `docs/hq-standard/implementation/evidence/` (증빙 자료; 지금은 대상 확장자 파일이 없다)
  - `docs/admin-platform/implementation/fixtures/` (테스트 자료; 지금은 대상 확장자 파일이 없다)
  - 위 목록은 지금 실제로 있는 폴더를 그대로 적은 것이다. 이름이 `fixtures/`·`generated/`·`dist/` 인 다른 폴더는 제외되지 않는다
  - 잠금 파일(pnpm-lock.yaml 등)과 .sql .md .json(메타데이터 밖)은 대상 확장자가 아니다
- 알려진 한계:
  - 기준선에 묶인 파일은 줄 수와 바이트 수를 따로 본다. 줄을 줄여도 바이트가 늘면 위반이다. 한 글자 고치는 수정도 바이트가 늘면 막힌다(의도된 동작: 고치면서 줄여야 한다).
  - 파일 여러 개로 잘게 쪼개 같은 코드를 늘리는 것은 이 규칙이 막지 못한다.
  - 대상 확장자가 아닌 파일(.json .sql .html .md 등, `metadata/` 밖)에 코드를 넣으면 보지 않는다.
  - 기준선은 파일 경로에 묶인다. 큰 파일의 이름을 바꾸거나 옮기면 새 파일로 보아 위반이 된다(의도된 동작).

### G04 hardcoded-ui-text

- 범위: 두 부분이다. (1) 기존 검사 `scripts/i18n/hardcode-check.mjs` 를 고치지 않고 그대로 실행해 결과를 파일별로 센다. 그 검사는 `frontend/src` 아래 모든 .tsx 에서 한글이 있는 줄을 찾는다(이 부분의 총계는 `pnpm i18n:hardcode` 와 같다). (2) `extensions/` 와 `packages/engine*/` 아래 코드 파일(.ts .tsx .js .jsx .mjs .cjs .mts .cts, 테스트 파일 포함)은 가드가 직접 본다: 문자열·템플릿 문자열·JSX 글자·정규식·이름에 한글이 든 줄은 모두 위반이다(TypeScript 구문 트리로 찾는다).
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - 새 구역에서 주석 안의 한글은 세지 않는다(구문 트리에서 주석은 코드가 아니다). 그 밖의 예외는 없다.
- 알려진 한계:
  - 기존 검사의 한계를 그대로 물려받는다(부분 1): `frontend/src` 의 .ts 파일(예: 라벨 상수 파일)과 `backend/`·`packages/contracts` 는 보지 않는다. 주석 속 한글도 한 줄로 센다.
  - 한글만 본다. 영어 등 다른 언어 문구를 직접 적는 것은 잡지 못한다.
  - 줄 단위로 센다. 한 줄에 문구가 여러 개여도 1건이다.
  - 새 구역(부분 2): 유니코드 이스케이프(`"\uD55C"`)와 JSX 의 숫자 문자 참조(`&#xD55C;`)는 풀어서 본다. 그러나 실행 중에 조합한 글자(`String.fromCharCode(…)`, 서버에서 받은 문구)는 잡지 못한다.
  - 기존 검사 스크립트가 없거나 출력 형식이 달라지면 이 규칙은 통과가 아니라 오류로 실패한다.

### G05 raw-style

- 범위: 저장소 전체의 .ts .tsx .js .jsx .css .scss 파일(테스트 파일 포함). 건수는 줄이 아니라 나타난 횟수로 센다.
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - `frontend/src/styles/tokens.css` (디자인 토큰을 정의하는 유일한 파일)
- 알려진 한계:
  - 색 이름(red, white 등)과 문자열을 이어 붙여 만든 색("#" + "fff")은 잡지 못한다.
  - 16진수처럼 보이는 3·4·6·8자 글자(예: CSS id 선택자 `#add`, 문자열 "#1234")도 색으로 센다(막는 쪽으로 틀림). 주석 속 색도 센다.
  - 다른 CSS 파일 안에서 정의한 지역 변수(`--x:#fff`)는 토큰으로 인정하지 않는다. 토큰 파일은 위 목록 하나뿐이다.
  - 크기·간격(px) 날값은 이 규칙이 보지 않는다.

### G06 company-branching

- 범위: `frontend/src/`, `backend/src/`, `packages/` 의 코드 파일 중 테스트가 아닌 것. (명세는 frontend/src·backend/src 만 말하지만 엔진·계약 패키지도 넣었다.) `extensions/` 는 원래 회사별 코드라 대상이 아니다. TypeScript 구문 트리(AST)로 검사하므로 주석과 일반 문자열 안의 글자는 세지 않는다.
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - 제외하는 폴더·파일은 없다. 시장·국가를 정의하는 곳(`frontend/src/market/`, `backend/src/globalization/`, `packages/contracts/src/globalization.ts`)도 검사하며, 기존 건수는 기준선에 묶인다
  - 테스트 파일: 이름이 `*.spec.*`·`*.test.*` 인 파일과, 정해진 테스트 폴더 `backend/test/`, `tests/` 뿐이다. 다른 곳의 `test/`·`__tests__/` 폴더는 제외되지 않는다. 테스트 이름을 붙인 파일을 일반 코드가 import 하면 G11 이 막는다
- 알려진 한계:
  - 변수끼리의 비교(`a.market === b.market`, `row.companyCode === actor.companyCode`, `allowed.includes(countryCode)`)는 위반이 아니다. 같은 파일의 `const`(한 번만 선언된 이름), const 객체의 멤버, enum 멤버에 담긴 문자열은 따라가서 잡는다(`const t = "KR"; x === t`). 그러나 다른 파일에서 import 한 상수, `let` 변수, 함수 인자로 받은 값, 함수가 돌려준 값에 담긴 코드는 잡지 못한다.
  - 코드 리터럴은 ISO 두 글자 국가코드(대문자)와 UK/EU/HQ/GLOBAL/APAC/EMEA/LATAM, 그리고 `ko-KR` 꼴 로캘이다. 국가코드와 글자가 같은 문자열·상수 비교는 뜻과 상관없이 센다(막는 쪽으로 틀림). 기준선에도 이런 거짓 양성이 들어 있다(예: 입출고 방향 `direction === "IN"`).
  - 숫자 비교도 센다(`companyId === 3`, `marketCount === 0`). 명세는 문자열 리터럴만 말하지만 숫자 회사 ID 로 갈라지는 길을 막으려고 넣었다.
  - 이름으로 판단한다. 값이 회사/국가/시장인지는 이름에 그 단어가 있을 때만 안다. `const c = row.countryCode` 처럼 같은 파일에서 바로 옮겨 담은 이름은 따라가지만, 함수 인자 `(c) => c === "acme"` 처럼 이름에 단서가 없고 코드 리터럴도 아닌 비교는 잡지 못한다. 소문자 코드(`"kr"`)도 같다.
  - 잡지 못하는 것: 변수에 담아 둔 조회표(`const T = {KR: a}; T[country]`), 미리 만든 불리언(`isKorea`)으로 갈라지기, 크기 비교(`<`, `>`), 정규식 객체를 변수에 담아 쓰는 검사, 실행 중에 만든 문자열(`atob`, `split` 결과 등).
  - 타입 정보 없이 구문만 본다. 같은 파일 안에서 이름이 같은 다른 변수는 구분하지 못한다(막는 쪽으로 틀림).

### G07 direct-io

- 범위: `frontend/`, `backend/`, `packages/`, `extensions/` 의 코드 파일 중 테스트가 아닌 것. import 한 건, 이름을 쓴 곳 한 군데를 각각 1건으로 센다. TypeScript 구문 트리(AST)로 검사하므로 주석과 문자열 안의 글자는 세지 않는다.
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - `backend/src/database/` (DB 연결과 트랜잭션(mssql)을 가진 유일한 곳)
  - `backend/src/integration/` (외부 시스템 연동 어댑터)
  - `frontend/src/api.ts` (프런트 공용 API 클라이언트)
  - `frontend/src/admin/client/` (관리자 화면 API 클라이언트)
  - 테스트 파일: 이름이 `*.spec.*`·`*.test.*` 인 파일과, 정해진 테스트 폴더 `backend/test/`, `tests/` 뿐이다(테스트는 띄운 서버를 직접 호출해야 한다). 다른 곳의 `test/`·`__tests__/`·`e2e/` 폴더는 제외되지 않는다
  - `scripts/`, `tests/` 는 검사·실행 도구라 대상 밖이다
  - 허용 목록은 지금 실제로 IO 를 가진 곳만 넣었다. 엔진의 데이터 접근 계층이 생기면 사람이 이 목록에 추가해야 한다.
- 알려진 한계:
  - 이름으로 판단한다. `fetch` 라는 이름이면 직접 만든 함수·인자여도 센다(막는 쪽으로 틀림). 멤버 `.fetch` 는 전역 객체(window, globalThis, self, global, top, parent, frames, opener, document, 그리고 같은 파일에서 그것을 담은 변수)에서 꺼낼 때만 세고, `repo.fetch()` 같은 자기 객체의 메서드는 세지 않는다. `["fetch"]` 대괄호 접근은 어떤 객체든 센다.
  - 날 SQL 은 보지 않는다. `DatabaseService.query("INSERT …")` 처럼 허용 계층이 내준 객체로 SQL 문자열을 직접 실행하는 것은 import 도 네트워크 호출도 아니라서 잡지 못한다. 기존 서비스 코드 대부분이 이렇게 되어 있고, 새 코드가 그렇게 해도 통과한다.
  - 잡지 못하는 것: `setTimeout("코드")` 처럼 다른 이름으로 실행하는 글자 코드, 허용 계층이나 다른 파일이 내보낸 fetch 를 받아 쓰는 것(`import { go } from "./x"`), 함수 인자로 전역 객체를 받아 쓰는 것(`(w) => w.fetch()`), `<img>`·`<script>`·`<form>` 으로 나가는 요청.
  - 파일 읽기/쓰기(fs), 자식 프로세스 실행은 대상이 아니다.
  - 테스트 이름(`*.spec.ts`)을 붙인 파일은 검사하지 않는다. 그런 파일을 일반 코드가 import 하면 G11 이 막지만, import 없이 실행되는 경로(자동 탐색·빌드 설정)는 막지 못한다.

### G08 disabled-tests

- 범위: 테스트 파일(이름이 `*.spec.*`·`*.test.*` 이거나, 경로 어디든 `test/`·`tests/`·`__tests__/`·`e2e/`·`spec/`·`specs/`·`__mocks__/` 폴더 안에 있는 파일)과 `scripts/` 아래 모든 코드 파일(검사 스크립트). 이 규칙은 검사를 하는 쪽이라 폴더 이름을 넓게 잡는다(다른 규칙의 테스트 예외는 정해진 폴더만 인정한다). TypeScript 구문 트리(AST)로 검사하므로 주석과 문자열 안의 글자("Test only: …")는 세지 않는다.
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - 없음. 가드 자신의 코드(`scripts/guard/`)도 검사 대상이다.
- 알려진 한계:
  - 주석 처리해서 끈 테스트, 본문 첫 줄의 `return`, 조건문으로 감싼 테스트, 설정 파일의 제외 패턴(testPathIgnorePatterns 등), 명령줄 옵션(`--test-only`, `--test-skip-pattern`, `-t`)은 잡지 못한다.
  - `scripts/`·테스트 파일 안에서는 테스트와 무관한 객체의 skip·todo·only 속성(예: 페이지 건너뛰기 값 `{ skip: 20 }`)과 `.skip()` 메서드 호출도 센다(막는 쪽으로 틀림). `fit`·`xit` 같은 이름의 변수를 값으로 쓰는 것도 센다. 타입 선언(`skip: boolean`)은 값이 아니므로 세지 않는다.
  - 옵션 값이 변수면 켜진 것으로 본다(`{ skip: flag }`). 값을 따지지 않는다.
  - 옵션 객체를 다른 파일에서 만들어 가져오면 잡지 못한다. 실행 중에 만든 이름으로 고르는 것(`it[name]`)은 확인할 수 없으므로 위반으로 센다.
  - 테스트 파일 이름 규칙과 `scripts/` 밖에 둔 테스트(예: 임의 이름의 .mjs)는 대상이 아니다.

### G09 change-id

- 범위: `node scripts/guard/run.mjs --commits <base>..<head>` 로 범위를 줄 때만 돈다. 기본 실행(`pnpm guard`)에는 포함되지 않는다.
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것):
  - 병합 커밋(부모가 둘 이상)
  - 규칙 도입 전 커밋: `scripts/guard/commit-id-start.json` 의 lastExemptCommit 과 그 조상. 그 밖의 커밋은 모두 검사한다(시작점의 후손이 아닌 곁가지 커밋도 검사한다).
- 알려진 한계:
  - ID 형식만 본다. 그 요청이 실제로 있는지, 변경 내용이 요청과 맞는지는 확인하지 않는다.
  - 시작점 파일은 지금 작업 트리의 것을 읽는다. 시작점을 뒤로 옮겨 커밋을 빼는 것은 이 규칙이 아니라 보호 검사(`--protect` 의 P5)가 막는다.

### G10 legacy-freeze

- 범위: 동결 구역: `frontend/src/*`, `frontend/src/hq-mock/**`, `frontend/src/demo/**`, `frontend/src/market/templates/**`, `packages/contracts/src/lead-*`, `backend/src/customization/*lead-*`, `frontend/src/customization/*Lead*`, `frontend/src/customization/lead-*`, `frontend/src/styles/*`, `backend/src/hq-mock/**`, `backend/src/modules/{activity,analytics,contract,customer,opportunity,order}/**`, `frontend/src/customization/Configured*.tsx`. 경로는 대소문자를 가리지 않고 맞춘다(`Hq-Mock/`, `Lead-x.ts` 도 걸린다).
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것):
  - 목록에 있는 파일의 테스트(같은 폴더, 같은 이름에 `.spec`/`.test` 가 붙은 파일)는 새로 만들 수 있다
  - `legacy-files.json` 의 frozenOther 에 적힌 기존 파일(동결 구역 안에 있지만 이관 대상은 아닌 파일, 예: App.tsx)
- 알려진 한계:
  - 동결 구역 밖의 새 폴더(예: `frontend/src/screens/`)에 화면별 코드를 만드는 것은 이 규칙이 막지 못한다. G03·G04·G05·G06 이 간접적으로 막는다.
  - 리드 전용 파일(L4)과 Configured 화면(L8)은 폴더가 아니라 이름 패턴으로 묶었다. 이름에 lead·Configured 를 넣지 않으면 피할 수 있다(예: `frontend/src/customization/OrderScreen.tsx`).
  - 대소문자를 가리지 않으므로 `frontend/src/customization/` 에서 이름에 lead 가 든 파일(예: misleading.ts)은 뜻과 상관없이 막힌다(막는 쪽으로 틀림).
  - `legacy-files.json` 을 직접 고쳐 파일을 추가하면 통과한다. 이 파일은 보호 파일로 다뤄야 한다. 스캔 스크립트는 목록을 늘리지 않는다.
  - 기존 파일의 테스트 이름을 빌려 새 코드를 넣는 것(`기존이름.spec.tsx` 안에 화면 코드)은 잡지 못한다.

### G11 no-test-imports

- 범위: `frontend/`, `backend/`, `packages/`, `extensions/` 의 코드 파일 중 테스트가 아닌 것(G07 과 같은 범위). 테스트 폴더는 `backend/test/`, `tests/` 로 정해져 있다. import 는 TypeScript 구문 트리(AST)에서 찾는다.
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것):
  - 없음. 기존 위반이 없어 기준선도 없다.
- 알려진 한계:
  - 경로를 실행 중에 만드는 import()/require() 는 대상을 알 수 없으므로 위반으로 센다(명세보다 엄격한 점). 지금 이 범위에 그런 import 는 없다.
  - `import.meta.glob("./**/*")` 처럼 테스트 이름을 적지 않고 폴더 전체를 싣는 패턴, 프레임워크의 자동 탐색, 빌드 설정(entry)으로 테스트 이름 파일을 싣는 것은 잡지 못한다.
  - tsconfig paths 별칭은 풀지 않는다. 다만 별칭이어도 경로 끝이 `.spec`/`.test` 이면 잡는다.
  - `scripts/` 와 `tests/` 의 실행 도구는 대상이 아니다(테스트를 돌리는 것이 일이다).
