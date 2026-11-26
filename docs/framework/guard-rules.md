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
| `node scripts/guard/run.mjs --commits <base>..<head>` | G09(변경 ID)만 돌린다. |
| `node scripts/guard/run.mjs --docs` | 이 문서를 다시 만든다. |
| `node scripts/guard/legacy-scan.mjs` | `legacy-files.json` 을 만들거나 줄인다. |

종료 코드: 0 통과, 1 위반 있음, 2 사용법 오류 또는 가드 자체 오류(규칙이 돌지 못하면 통과가 아니라 실패다).

검사 대상은 git 이 추적하는 파일과, 아직 추적하지 않았지만 무시 목록(.gitignore)에 없는 파일이다. 커밋 전에도 걸린다.

공통 한계: 기준선은 파일별 "건수"다. 같은 파일에서 위반 하나를 고치고 다른 하나를 새로 넣으면 건수가 같아 통과한다. 줄 끝 주석으로 규칙을 끄는 방법은 일부러 만들지 않았다. `guard-baseline.json`, `legacy-files.json`, `scripts/guard/` 를 고치면 무엇이든 통과시킬 수 있으므로 이 셋은 보호 파일로 다뤄야 한다.

## 규칙 한눈에 보기

| ID | 이름 | 금지하는 것 | 왜 (AI의 어떤 약점) | 고치는 법 |
| --- | --- | --- | --- | --- |
| G01 | metadata-only-config | `metadata/` 아래에 설정 파일이 아닌 것(코드·스크립트·스타일 등)을 두는 것. 허용 확장자는 .json .yaml .yml .md 와 `.gitkeep` 뿐이다. .json 은 JSON 으로 읽혀야 한다. | AI는 급하면 설정 구역에 코드를 끼워 넣는다. 설정과 코드가 섞이면 "설정만 바꿔서 화면을 만든다"는 전제가 깨진다. | 코드는 `packages/engine`(공통) 또는 `extensions/<이름>`(회사별)으로 옮기고, `metadata/` 에는 값만 남긴다. |
| G02 | zone-boundaries | 구역 경계를 넘는 import. `extensions/<이름>/` 의 코드는 자기 폴더 안 상대경로, `@dio-crm/contracts*`, `@dio-crm/engine*` 만 import 할 수 있다. `packages/engine*/` 의 코드는 `frontend/`, `backend/`, `extensions/`, legacy 파일을 import 할 수 없다. | AI는 가까이 있는 코드를 그대로 끌어다 쓴다. 엔진이 화면 코드를, 확장이 다른 회사 확장이나 DB를 직접 잡으면 한 곳을 고칠 때 전부 깨진다. | 필요한 기능을 `@dio-crm/contracts` 의 계약이나 `@dio-crm/engine` 의 공개 API로 올리고 그것을 import 한다. |
| G03 | file-size | 소스 파일 하나가 300줄을 넘는 것. 이미 넘은 파일은 지금 줄 수에 묶이고, 한 줄이라도 늘면 위반이다. | AI는 새 파일로 나누지 않고 기존 파일 끝에 계속 붙인다. 큰 파일은 AI가 한 번에 읽지 못해 같은 코드를 또 만들고, 일부만 고쳐 버그를 낸다. | 기능 단위로 파일을 나눈다. 기준선에 묶인 파일은 늘리지 말고, 새 코드는 새 파일(가능하면 engine/metadata)에 둔다. |
| G04 | hardcoded-ui-text | 화면 코드(.tsx)에 한글 문구를 직접 적는 것. 문구는 번역 리소스(i18n)에 두고 키로 불러야 한다. | AI는 번역 키를 만드는 대신 눈앞의 문자열을 그대로 적는다. 그러면 나라별 문구 교체와 용어 통일이 불가능해진다. | 문구를 `frontend/src/i18n/locales/*` 에 넣고 `t("키")` 로 쓴다. 메타데이터 화면이라면 라벨 키를 메타데이터에 둔다. |
| G05 | raw-style | 색을 날값으로 적는 것: 16진 색(#fff, #FFFFFF, #ffffff80)과 rgb()/rgba()/hsl()/hsla()/hwb()/oklab()/oklch(). 색은 디자인 토큰(CSS 변수)으로만 쓴다. | AI는 화면마다 비슷하지만 조금씩 다른 색을 새로 적는다. 그러면 화면마다 모양이 달라지고 테마 변경이 불가능해진다. | `var(--토큰이름)` 을 쓴다. 맞는 토큰이 없으면 토큰 파일에 토큰을 추가하고 그것을 쓴다. |
| G06 | company-branching | 코드 안에서 회사·국가·시장 값으로 갈라지는 것: `=== "KR"` 같은 국가/시장 코드 비교(따옴표 종류 무관), `companyCode ===`·`countryCode ===`·`market ===`·`country ===`(상대가 변수여도), 이름에 company/country/market/tenant/nation 이 든 값을 리터럴과 비교, 그런 값으로 `switch`, `case "KR":`, `.includes("KR")`, `[...].includes(countryCode)`. | AI는 "한국만 다르게" 같은 요청을 받으면 그 자리에 if 를 넣는다. 회사가 늘수록 if 가 쌓여 누구도 전체 동작을 알 수 없게 된다. | 차이는 `metadata/` 의 설정값이나 시장 프로필로 표현하고 코드는 그 값을 읽기만 한다. 설정으로 안 되는 회사 전용 동작은 `extensions/<회사>` 로 뺀다. |
| G07 | direct-io | 정해진 인프라 폴더 밖에서 DB나 네트워크를 직접 건드리는 것: DB 드라이버·ORM import(mssql, tedious, typeorm, knex, prisma, pg, mysql2, mongoose, redis …), HTTP 라이브러리·node 네트워크 모듈 import(axios, undici, http, https, net …), 그리고 `fetch(...)`, `XMLHttpRequest`, `sendBeacon`, `new WebSocket/EventSource`, `http(s).request/get(` 호출. | AI는 화면이나 서비스 코드 한가운데서 바로 DB·API를 부른다. 그러면 권한 검사·감사 기록·오류 처리·회사 격리를 건너뛰는 길이 생기고, 호출 지점이 수백 곳으로 흩어진다. | 허용된 인프라 계층(아래 목록)의 함수를 통해 호출한다. 프런트는 API 클라이언트를, 백엔드는 database/integration 계층이 내주는 인터페이스를 쓴다. |
| G08 | disabled-tests | 테스트를 꺼 두는 것: 테스트 함수의 skip / only / todo / skipIf / runIf 표시(점 주변 공백이나 `.each` 가 끼어도 잡는다), x 로 시작하는 꺼진 테스트 이름(xit, xtest, xdescribe)과 f 로 시작하는 단독 실행(fit, fdescribe), node:test 옵션의 skip·todo·only 값이 false 가 아닌 것. | AI는 테스트가 실패하면 원인을 고치는 대신 테스트를 끄거나 하나만 돌려 "통과"를 만든다. 꺼진 테스트는 아무도 다시 켜지 않는다. | 테스트를 켜고 실패 원인을 고친다. 정말 지울 테스트라면 이유를 커밋에 적고 삭제한다(끄는 것은 안 된다). |
| G09 | change-id | 변경 ID 없는 커밋. 병합 커밋을 뺀 모든 커밋 제목에 `[REQ-숫자]` 또는 `[F숫자-숫자]` 가 있어야 한다. | AI는 요청과 무관한 변경을 슬쩍 섞는다. 커밋마다 요청 번호가 없으면 "이 코드가 왜 들어왔는지"를 추적할 수 없다. | 커밋 제목에 해당 요청의 ID 를 넣는다. 예: `[REQ-12] 리드 목록 필터 추가`. |
| G10 | legacy-freeze | legacy(이관 대상) 구역에 새 파일을 만드는 것. `legacy-files.json` 에 적힌 파일만 그 구역에 있을 수 있다. 기존 파일을 고치는 것은 된다. | AI는 옆에 있는 기존 화면을 복사해 새 화면을 만든다. 그대로 두면 화면·객체별 코드가 계속 늘어 프레임워크로 옮길 양이 줄지 않는다. | 새 화면·객체는 `metadata/` 설정과 `packages/engine` 으로 만든다. 회사 전용 동작은 `extensions/` 에 둔다. |

## 규칙별 범위·예외·한계

### G01 metadata-only-config

- 범위: `metadata/` 아래 모든 파일(하위 폴더 포함, 추적 전 파일 포함).
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것): 없음
- 알려진 한계:
  - YAML 은 문법 검사를 하지 않는다(의존성 0 원칙). 확장자만 본다.
  - 허용 확장자 안에 문자열로 숨긴 코드는 잡지 못한다.

### G02 zone-boundaries

- 범위: `extensions/` 와 `packages/engine*/` 아래 코드 파일(.ts .tsx .js .jsx .mjs .cjs .mts .cts). 테스트 파일도 예외 없이 본다.
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것): 없음
- 알려진 한계:
  - 명세보다 엄격한 점: 확장은 react·zod·node 내장 모듈도 직접 import 할 수 없다(명세의 "only" 그대로). 엔진은 자기 패키지 밖으로 나가는 상대경로 전부가 위반이다.
  - 명세보다 엄격한 점: 경로를 실행 중에 만드는 import()/require() 는 확인할 수 없으므로 위반으로 본다. `extensions/` 바로 아래(확장 폴더 밖)의 코드 파일도 위반이다.
  - import 문을 정규식으로 찾는다. 문자열 안의 `from "x"` 도 import 로 셀 수 있다(막는 쪽으로 틀림).
  - `@dio-crm/contracts` 의 index 를 거쳐 legacy 파일을 다시 내보내는 경우는 잡지 못한다. tsconfig paths 별칭도 풀지 않는다(별칭은 허용 목록에 없으므로 확장에서는 위반이 된다).

### G03 file-size

- 범위: 모든 .ts .tsx .js .jsx .mjs .cjs .mts .cts .css .scss 파일, 그리고 `metadata/` 아래 .json .yaml .yml. (.jsx .cjs .mts .cts 는 명세에 없지만 빠져나갈 구멍이라 넣었다.)
- 기준선: 상한을 넘은 파일의 현재 값을 기준선에 묶는다. 묶인 파일이 커지거나, 기준선에 없는 파일이 상한을 넘으면 실패한다.
- 예외(검사하지 않는 것):
  - `docs/` 아래(증빙·문서 자료)
  - 경로에 `dist/`, `generated/`, `__generated__/` 폴더가 있는 파일(생성물)
  - 경로에 `fixtures/`, `__fixtures__/` 폴더가 있는 파일(테스트 자료)
  - 잠금 파일(pnpm-lock.yaml 등)과 .sql .md .json(메타데이터 밖)은 대상 확장자가 아니다
  - 단, `metadata/`, `extensions/`, `packages/engine*/` 안에서는 위 제외를 적용하지 않는다
- 알려진 한계:
  - 줄 수만 센다. 한 줄에 코드를 길게 이어 붙이면 통과한다(기존 CSS·일부 TS가 이미 그런 모양이다). 글자 수 상한은 아직 없다.
  - `fixtures/`·`generated/` 라는 폴더 이름을 쓰면 세 구역 밖에서는 검사를 피할 수 있다. 현재 그런 폴더는 없다.
  - 기준선은 파일 경로에 묶인다. 큰 파일의 이름을 바꾸거나 옮기면 새 파일로 보아 위반이 된다(의도된 동작).

### G04 hardcoded-ui-text

- 범위: 기존 검사 `scripts/i18n/hardcode-check.mjs` 를 고치지 않고 그대로 실행해 결과를 파일별로 센다. 그 검사는 `frontend/src` 아래 모든 .tsx 에서 한글이 있는 줄을 찾는다(총계는 `pnpm i18n:hardcode` 와 같다).
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것): 없음
- 알려진 한계:
  - 기존 검사의 한계를 그대로 물려받는다: .ts 파일(예: 라벨 상수 파일)과 `frontend/src` 밖은 보지 않는다. 한글이 아닌 문구(영어 등)도 보지 않는다. 주석 속 한글도 한 줄로 센다.
  - 줄 단위로 센다. 한 줄에 문구가 여러 개여도 1건이다.
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

- 범위: `frontend/src/`, `backend/src/`, `packages/` 의 코드 파일 중 테스트가 아닌 것. (명세는 frontend/src·backend/src 만 말하지만 엔진·계약 패키지도 넣었다.) `extensions/` 는 원래 회사별 코드라 대상이 아니다.
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - `frontend/src/market/profiles/` (시장·국가를 정의하는 곳)
  - `frontend/src/market/field-profiles/` (시장·국가를 정의하는 곳)
  - `backend/src/globalization/` (시장·국가를 정의하는 곳)
  - `packages/contracts/src/globalization.ts` (국가/시장 계약 정의)
  - 테스트 파일(`*.spec.*`, `*.test.*`, `test/`·`tests/`·`__tests__/`·`e2e/` 폴더)
  - `frontend/src/market/` 의 나머지(해석기·템플릿 화면)와 `frontend/src/i18n/` 은 제외하지 않았다. 기존 건수는 기준선에 묶인다.
- 알려진 한계:
  - 같은 회사인지 확인하는 비교(`row.company_id === actor.companyId`)는 위반이 아니다. 이름에 company/tenant 가 들어도 상대가 변수면 세지 않는다. 다만 이름이 정확히 country/market 이거나 company/country/market…Code 꼴이면 상대가 변수여도 위반으로 센다(명세 그대로).
  - 코드 리터럴은 ISO 두 글자 국가코드(대문자)와 UK/EU/HQ/GLOBAL/APAC/EMEA/LATAM, 그리고 `ko-KR` 꼴 로캘이다. `"IN"`, `"ID"`, `"NO"` 처럼 국가코드와 같은 대문자 두 글자 문자열 비교는 뜻과 상관없이 센다(막는 쪽으로 틀림).
  - 잡지 못하는 것: 객체 조회로 갈라지기(`{KR: a, US: b}[country]`), 미리 만든 불리언(`isKorea`)으로 갈라지기, 소문자 코드(`"kr"`)를 이름에 단서가 없는 변수와 비교, 숫자 회사 ID 를 단서 없는 변수와 비교.
  - 정규식 검사라 주석·문자열 안의 같은 모양도 센다.

### G07 direct-io

- 범위: `frontend/`, `backend/`, `packages/`, `extensions/` 의 코드 파일 중 테스트가 아닌 것. import 한 건, 호출 한 건을 각각 1건으로 센다.
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - `backend/src/database/` (DB 연결과 트랜잭션(mssql)을 가진 유일한 곳)
  - `backend/src/integration/` (외부 시스템 연동 어댑터)
  - `frontend/src/api.ts` (프런트 공용 API 클라이언트)
  - `frontend/src/admin/client/` (관리자 화면 API 클라이언트)
  - 테스트 파일(`*.spec.*`, `*.test.*`, `test/`·`tests/`·`__tests__/`·`e2e/` 폴더): 테스트는 띄운 서버를 직접 호출해야 한다
  - `scripts/`, `tests/` 는 검사·실행 도구라 대상 밖이다
  - 허용 목록은 지금 실제로 IO 를 가진 곳만 넣었다. 엔진의 데이터 접근 계층이 생기면 사람이 이 목록에 추가해야 한다.
- 알려진 한계:
  - `fetch` 라는 이름이면 직접 만든 함수여도 센다(막는 쪽으로 틀림). 반대로 `const f = globalThis["fe"+"tch"]` 같은 우회는 잡지 못한다.
  - 허용 계층이 내준 연결 객체로 SQL 문자열을 직접 실행하는 것(`domain.query("INSERT …")`)은 import 가 아니라서 잡지 못한다. 기존 코드에 이런 곳이 많다.
  - 파일 읽기/쓰기(fs)는 대상이 아니다. 테스트 파일 이름(`*.spec.ts`)을 붙이면 검사를 피할 수 있다.
  - 정규식 검사라 주석·문자열 안의 같은 모양도 센다.

### G08 disabled-tests

- 범위: 테스트 파일(`*.spec.*`, `*.test.*`, `test/`·`tests/`·`__tests__/`·`e2e/` 폴더)과 `scripts/` 아래 모든 코드 파일(검사 스크립트).
- 기준선: 파일별 건수를 기준선에 묶는다. 어떤 파일이든 묶인 건수보다 늘면 실패한다. 기준선에 없는 파일은 0건이어야 한다.
- 예외(검사하지 않는 것):
  - 없음. 가드 자신의 코드(`scripts/guard/`)도 검사 대상이다.
- 알려진 한계:
  - 주석 처리해서 끈 테스트, 본문 첫 줄의 `return`, 조건문으로 감싼 테스트, 설정 파일의 제외 패턴(testPathIgnorePatterns 등)은 잡지 못한다.
  - `scripts/`·테스트 파일 안에서는 테스트와 무관한 skip 속성(예: 페이지 건너뛰기 값)과 타입 선언의 skip 속성도 센다(막는 쪽으로 틀림).
  - 테스트 파일 이름 규칙과 `scripts/` 밖에 둔 테스트(예: 임의 이름의 .mjs)는 대상이 아니다.

### G09 change-id

- 범위: `node scripts/guard/run.mjs --commits <base>..<head>` 로 범위를 줄 때만 돈다. 기본 실행(`pnpm guard`)에는 포함되지 않는다.
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것):
  - 병합 커밋(부모가 둘 이상)
- 알려진 한계:
  - ID 형식만 본다. 그 요청이 실제로 있는지, 변경 내용이 요청과 맞는지는 확인하지 않는다.
  - 과거 커밋은 ID 가 없으므로 범위를 이 규칙 도입 이후로 잡아야 한다.

### G10 legacy-freeze

- 범위: 동결 구역: `frontend/src/*`, `frontend/src/hq-mock/**`, `frontend/src/demo/**`, `frontend/src/market/templates/**`, `packages/contracts/src/lead-*`, `backend/src/customization/*lead-*`, `frontend/src/customization/*Lead*`, `frontend/src/customization/lead-*`, `frontend/src/styles/*`, `backend/src/hq-mock/**`, `backend/src/modules/{activity,analytics,contract,customer,opportunity,order}/**`.
- 기준선: 기준선 없음. 한 건이라도 있으면 실패한다.
- 예외(검사하지 않는 것):
  - 목록에 있는 파일의 테스트(같은 폴더, 같은 이름에 `.spec`/`.test` 가 붙은 파일)는 새로 만들 수 있다
  - `legacy-files.json` 의 frozenOther 에 적힌 기존 파일(동결 구역 안에 있지만 이관 대상은 아닌 파일, 예: App.tsx)
- 알려진 한계:
  - 동결 구역 밖의 새 폴더(예: `frontend/src/screens/`)에 화면별 코드를 만드는 것은 이 규칙이 막지 못한다. G03·G04·G05·G06 이 간접적으로 막는다.
  - 리드 전용 파일(L4)은 폴더가 아니라 이름 패턴으로 묶었다. 이름에 lead 를 넣지 않으면 피할 수 있다.
  - `legacy-files.json` 을 직접 고쳐 파일을 추가하면 통과한다. 이 파일은 보호 파일로 다뤄야 한다. 스캔 스크립트는 목록을 늘리지 않는다.
  - 기존 파일의 테스트 이름을 빌려 새 코드를 넣는 것(`기존이름.spec.tsx` 안에 화면 코드)은 잡지 못한다.
