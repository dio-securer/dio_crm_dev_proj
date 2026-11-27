# CLAUDE.md — 이 저장소에서 일하는 AI 가 작업 전에 읽는 글

## 이 저장소는 무엇인가

DIO CRM 이다. 영업 사원이 리드, 거래처, 영업기회, 계약, 주문, 수금, 활동을 관리한다.
화면은 `frontend/`(React, TypeScript), 서버는 `backend/`(NestJS), 둘이 같이 쓰는 약속은 `packages/contracts/` 에 있다.
코드는 AI 가 쓴다. 개발자가 아닌 주인 한 사람이 요약만 읽고 PR 을 승인한다.
그래서 규칙은 사람이 아니라 기계(가드, `scripts/guard/`)가 검사한다. 이 글의 규칙 표는 그 가드에서 만들어 넣은 것이다.

## 세 구역

| 구역 | 경로 | 둘 수 있는 것 |
| --- | --- | --- |
| 설정 | `metadata/` | 값만 둔다(.json .yaml .yml .md). 코드는 둘 수 없다(G01). |
| 엔진 | `packages/engine*/` | 모든 회사가 같이 쓰는 코드. 회사·국가로 갈라지지 않는다(G02, G06). 지금은 안내문만 있다. |
| 확장 | `extensions/<이름>/` | 한 회사·국가에만 필요한 코드. 자기 폴더와 `@dio-crm/contracts*`, `@dio-crm/engine*` 만 가져다 쓴다(G02). |

그 밖의 기존 화면·개체별 코드는 이관 대상(legacy)이다. 목록은 `legacy-files.json` 에 있다.
동결된 폴더에는 새 파일을 만들 수 없다(G10). 이미 있는 파일을 고치는 것은 된다.

## 일하는 순서

1. `pnpm crm classify` 를 먼저 돌려 요청 분류서를 채운다.
   유형은 A 설정 변경, B 기존 능력의 새 조합, C 새 능력, D 진짜 예외다.
2. 가장 낮은 유형으로 푼다. A 로 되면 A 다. A·B 는 설정 구역, C 는 엔진 구역, D 는 확장 구역으로 간다.
   C 와 D 는 사람 승인이 필요하다.
3. 코드를 쓰는 동안 `pnpm crm check` 로 가드를 돌린다. 실패하면 아래 규칙 표의 "대신 할 일"대로 고친다.
4. 커밋한다. 커밋 제목 형식은 아래에 있다.
5. `pnpm crm verify` 를 돌리고, 그 결과로 보고한다.

`pnpm crm new-object` 와 `pnpm crm add-field` 는 아직 인자만 검사한다(F1에서 구현). 파일을 만들지 않는다.
`pnpm` 명령은 저장소 맨 위 폴더에서 돌린다(하위 폴더에서는 `pnpm crm` 을 찾지 못한다).
하위 폴더에 있다면 `node <저장소 경로>/scripts/crm/cli.mjs verify` 처럼 node 로 직접 부른다. 결과는 같다.

## 꼭 지킬 규칙

가드가 검사한다. 기존 위반은 `guard-baseline.json` 에 숫자로 묶여 있고, 그 숫자는 줄어들 수만 있다.
줄 끝 주석으로 규칙을 끄는 방법은 없다.

<!-- guard:rules:start (node scripts/guard/run.mjs --docs 가 만든다. 직접 고치지 않는다) -->
| 규칙 | 금지하는 것 | 대신 할 일 |
| --- | --- | --- |
| G01 | `metadata/` 아래에 설정 파일이 아닌 것(코드·스크립트·스타일 등)을 두는 것 | 코드는 `packages/engine`(공통) 또는 `extensions/<이름>`(회사별)으로 옮기고, `metadata/` 에는 값만 남긴다 |
| G02 | 구역 경계를 넘는 import | 필요한 기능을 `@dio-crm/contracts` 의 계약이나 `@dio-crm/engine` 의 공개 API로 올리고 그것을 import 한다 |
| G03 | 소스 파일 하나가 300줄 또는 15000바이트를 넘는 것(둘 중 하나만 넘어도 위반) | 기능 단위로 파일을 나눈다 |
| G04 | 코드에 한글 문구를 직접 적는 것 | 문구를 `frontend/src/i18n/locales/*` 에 넣고 `t("키")` 로 쓴다 |
| G05 | 색을 날값으로 적는 것 | `var(--토큰이름)` 을 쓴다 |
| G06 | 코드 안에서 회사·국가·시장 값으로 갈라지는 것 | 차이는 `metadata/` 의 설정값이나 시장 프로필로 표현하고 코드는 그 값을 읽기만 한다 |
| G07 | 정해진 인프라 폴더 밖에서 DB나 네트워크를 직접 건드리는 것 | 허용된 인프라 계층(아래 목록)의 함수를 통해 호출한다 |
| G08 | 테스트를 꺼 두는 것 | 테스트를 켜고 실패 원인을 고친다 |
| G09 | 변경 ID 없는 커밋 | 커밋 제목에 해당 요청의 ID 를 넣는다 |
| G10 | legacy(이관 대상) 구역에 새 파일을 만드는 것 | 새 화면·객체는 `metadata/` 설정과 `packages/engine` 으로 만든다 |
| G11 | 테스트가 아닌 코드가 테스트 파일을 가져다 쓰는 것 | 운영에 필요한 코드는 테스트 이름이 아닌 일반 파일로 옮긴다(그러면 G06·G07 이 본다) |
<!-- guard:rules:end (node scripts/guard/run.mjs --docs 가 만든다. 직접 고치지 않는다) -->

규칙마다 범위, 예외, 알려진 한계가 있다. 전부 `docs/framework/guard-rules.md` 에 있다.

## 커밋 제목

모든 커밋 제목에 변경 ID 를 넣는다(G09). 형식은 `[REQ-숫자]` 또는 `[F숫자-숫자]` 다.
예: `[REQ-12] 리드 목록 필터 추가`, `[F0-4] 용어집 추가`. 요청과 상관없는 변경을 같은 커밋에 섞지 않는다.

## 완료를 말하는 법

완료는 `pnpm crm verify`의 증거 꾸러미로만 말한다 — 합성/실증을 구분해 적는다.

- 증거 꾸러미는 `.guard/evidence/<커밋 앞 12자>/` 의 `evidence.json` 과 `summary.md` 다. 단계마다 기록 파일이 하나씩 있다.
  `verify` 는 시작할 때 다른 커밋의 꾸러미를 지운다. 폴더에는 지금 커밋의 꾸러미만 남는다.
- `pnpm crm verify` 가 만드는 증거는 언제나 합성(SYNTHETIC)이다. 가짜 데이터로 돌린 검사라는 뜻이다.
- 실제 DB 나 운영 환경에서 확인하지 않은 것을 "실증"이라고 쓰지 않는다. 확인하지 않은 것은 "확인하지 않음"이라고 쓴다.
- 판정이 통과(PASS)가 아니면 완료가 아니다. 실패한 단계를 숨기거나 "원래 실패하던 것"이라며 빼지 않는다. 그대로 적는다.
- 커밋하지 않은 변경이 섞인 채 돌린 증거(`dirty: true`)는 커밋의 증거가 아니다. 커밋한 뒤 다시 돌린다.

## 보호 파일

초록불을 만들려고 아래 파일을 고치지 않는다. 검사가 실패하면 검사가 아니라 코드를 고친다.
이 파일들을 바꾸면 PR 요약 맨 위 "보호 파일 변경"에 나오고, 지정된 사람의 승인이 있어야 한다.
목록의 원본은 `scripts/guard/protected-paths.json` 이다. "아직 없음"은 앞으로 생길 파일을 미리 보호해 둔 것이다.

<!-- guard:protected:start (node scripts/guard/run.mjs --docs 가 만든다. 직접 고치지 않는다) -->
`/.github/`, `/scripts/guard/`, `/tests/guard/`, `/guard-baseline.json`, `/legacy-files.json`, `/guard-raises.json`,
`/CLAUDE.md`, `/docs/framework/adr/`, `/packages/contracts/src/metadata/`, `/scripts/crm/`,
`/scripts/i18n/hardcode-check.mjs`, `/docs/framework/glossary.md`, `/docs/framework/README.md`,
`/docs/framework/ci-gates.md`, `/docs/framework/guard-rules.md`, `/package.json`, `/backend/package.json`,
`/frontend/package.json`, `/packages/contracts/package.json`, `/pnpm-workspace.yaml`, `/pnpm-lock.yaml`,
`/.npmrc` (아직 없음), `/.pnpmfile.cjs` (아직 없음), `/backend/jest.config.cjs`, `/backend/jest.customization.config.cjs`,
`/frontend/vite.config.ts`, `/scripts/hq-standard/run-browser.mjs`, `/scripts/admin/run-all.cjs`,
`/scripts/admin/run-web-test.cjs`, `/scripts/admin-customization/run-stage-checks.mjs`
<!-- guard:protected:end (node scripts/guard/run.mjs --docs 가 만든다. 직접 고치지 않는다) -->

## 규칙이 정당한 작업을 막을 때

1. 먼저 규칙의 "대신 할 일"로 풀 수 있는지 본다. 대부분은 풀린다.
2. 정말 안 되면 멈추고 사람에게 묻는다. 규칙을 피해 가는 표기를 찾지 않는다.
3. 사람이 허락한 약화만 `guard-raises.json` 에 선언한다. 선언할 수 있는 것은 네 가지다:
   기준선 숫자를 올림, legacy 목록에 파일을 넣음, 테스트를 지우거나 줄임, 변경 ID 시작점을 바꿈.
4. 선언에는 이유(`reason`)와 변경 ID(`changeId`)를 적는다. 실제 변경과 글자 그대로 같아야 한다.
5. 선언은 PR 요약 맨 위 "예외 선언"에 그대로 나온다. 사람이 이유를 읽고 승인하거나 거절한다.

쓰는 법과 예시는 `docs/framework/ci-gates.md` 의 "예외를 선언하는 법"에 있다.

## 더 읽을 것

- `docs/framework/README.md` : 지금 기준이 되는 문서가 무엇인지.
- `docs/framework/adr/` : 프레임워크 결정 기록(ADR). 왜 이렇게 정했는지.
- `docs/framework/glossary.md` : 업무 용어와 코드 이름. 새 이름을 짓기 전에 여기서 찾는다.
- `docs/framework/guard-rules.md` : 가드 규칙 전체.
- `docs/framework/ci-gates.md` : CI 가 막는 것, 승인하는 사람이 보는 것.
