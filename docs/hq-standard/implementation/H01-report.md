# H01 — HQ 표준 계약·등록부 구현 및 검증 보고

작성일: 2026-10-22 · 기준 코드: `e111138dbf50c46aca41c7097e156840fcd59069` · 작업 브랜치: `feat/hq-standard-h01-contracts`

현재 상태: **H01 구현·빌드·테스트 및 작업자 B 기능 검증 PASS / 기존 Critical 보안 취약점 5건으로 전체 CI·병합 게이트 보류**. [검토 PR #30](https://github.com/dio-securer/dio_crm_dev_proj/pull/30)은 Draft·미병합이며 H02는 시작하지 않았다. 이 문서의 등록 수량은 업무 화면 구현 완료 수량이 아니다.

## 1. 선행 승인과 변경 경계

- 작업자 B가 H00의 P1 2건·P2 3건 해소를 원본 코드와 대조하여 **H00 입력자료 PASS 및 H01 착수 승인**을 전달했다. [H00 보고서](H00-report.md)에 기록했다.
- 현재 API 지원, 미래 요구 후보, 목표 정책 및 미확정 운영규칙을 분리한 H00 문서를 입력으로 사용했다.
- 기존 HQ 14개 화면, GLOBAL 7개 프로필/컴포넌트, 기존 라우트, DB/API/시드 및 GLOBAL 데모는 변경하지 않았다.
- 사용자의 Windows 작업 트리 `backend/src/config/env.ts` 변경과 `salesforce/` 폴더는 본 작업의 대상이 아니며 업로드 목록에 포함하지 않는다.
- 별도 검토용 clone에서 작업했다. 운영 DB/ERP/심평원 접속, 실제 거래 데이터 수정은 하지 않았다.

## 2. 구현 산출물

| 파일 | 역할 |
|---|---|
| [hq-standard.ts](../../../packages/contracts/src/hq-standard.ts) | Process/Screen/Menu/Tab/Section/Field/Action/Transition/Evidence/Coverage 타입, JSON/참조 검증, 순수 정책 평가, 버전 고정 override |
| [index.ts](../../../packages/contracts/src/index.ts), [contracts package](../../../packages/contracts/package.json) | 공용 API export 및 `@dio-crm/contracts/hq-standard` 진입점 |
| [hq-standard-registry.ts](../../../frontend/src/app/hq-standard-registry.ts) | H00 근거를 담은 순수 HQ 등록부 factory. 실제 자산을 인자로 주입하며 전역 설정을 수정하지 않음 |
| [hq-standard.ts](../../../frontend/src/app/hq-standard.ts) | 기존 routes/HQ profile/manifest/Account 계약·필드 프로필/KR 기능 키를 실제로 연결 |
| [hq-standard.test.mjs](../../../scripts/hq-standard/hq-standard.test.mjs) | 외부 의존성 없는 실제 TS 실행 테스트. 타입검사와 전체 회귀의 대체물이 아님 |
| [hq-standard.spec.ts](../../../frontend/src/app/hq-standard.spec.ts) | 실제 React renderer·패키지 export와 B 회귀를 확인하는 Vitest 11개 |
| [package.json](../../../package.json), [CI](../../../.github/workflows/ci.yml) | `hq:check` 명령과 기존 CI에 동일 검사 연결. 의존성 추가/lockfile 변경 없음 |

### 등록 범위

| 항목 | 결과 |
|---|---|
| 실제 HQ 진입점 | 14개, 기존 `HQ_*` 키·경로·slot 보존 |
| 범위 대응 | P0 34개 + 추가 `HQ-OPS-ENTRY` 1개 = 35개 |
| 필드 | 168개. H00 개별 후보 122개 누락 0, 기존 Account 인터페이스 25개 재사용 |
| 액션 | 65개. 현재 UI/API/계획 액션을 구분 |
| 탭·섹션·전이 | 메타데이터 탭 14개, 섹션 43개, 전이 20개 |
| 근거 | 54개. 관찰/교육/코드/설계 가정/미확인 구분 |
| 아직 없는 renderer | 홈·관리자 6개 범위행을 `planned=true`, `enabled=false`, 경로 없음으로 보존 |
| H00 미구현 판정 | 원래 10개 유지. 기존 부모 renderer가 있는 미구현 상세/팝업을 완료로 바꾸지 않음 |

`/`는 현재 `HQ_LEAD`다. 없는 `HQ_HOME`이나 관리자 renderer를 등록했다고 주장하지 않는다. 내부 상세·대화상자·교육 슬라이드를 독립 메뉴로 만들지 않는다. H01의 탭/섹션 배치는 후속 구현의 안정 키이며 기존 화면에 새 탭을 실제로 렌더링한 결과가 아니다.

## 3. 공통 계약 동작

### 참조·구조 검사

`validateHqStandard(input, capabilities)`는 신뢰하지 않는 설정 JSON을 검사한다. 식별자 중복/공백, 미등록 HQ renderer, GLOBAL 혼입, 경로 중복/slot 불일치, 부모 누락·메뉴/프로세스 순환, 다른 화면에 속한 탭/섹션·액션, 필드/액션/전이/근거의 끊어진 참조, 카탈로그 및 현재 진입점 대응 누락을 오류 경로와 함께 반환한다. 잘못된 타입·조건 연산자·미지정 속성·비유한 숫자·순환 객체도 거부한다.

### 화면과 프로세스 액션 분리

`createHqPolicy`는 검증된 독립 스냅샷을 만들고 다음 순수 평가 함수를 제공한다.

- `screenAllowed`: 활성 소유 프로세스 중 하나 이상 + 화면 enabled + 권한 + 기능 + 장치 조건.
- `menuVisible`: 화면 조건과 모든 상위 메뉴의 enabled/권한/기능 조건. 빈 그룹은 숨김.
- `actionAllowed`: 화면 접근과 별개로 **그 액션의 소유 프로세스**, 액션 권한/기능/조건 및 입력 제약 확인.
- `transitionAllowed`: 액션 허용 + 저장된 시작 상태 + 선택한 전이 조건 + 전이별 필수 입력 확인. 사용자 선택 대상이 있는 전이는 `targetFieldKey` 값과 `toState` 일치도 검사한다.
- `fieldVisible`, `fieldWritable`, `readField`: 부모 영역, 읽기/쓰기 권한, 상태 잠금, 현재 쓰기 지원, 목표 readOnly, 마스킹을 구분. `writeActionKeys`를 지정한 입력은 해당 단계 액션 중 하나의 접근/상태/권한 조건을 충족해야 편집할 수 있다. 입력 완료 여부와 편집 가능 여부는 별개다.

컨텍스트는 단일 요청 body가 아니라 현재 업무 레코드·선택 입력을 안정 필드 키로 모은 작업 컨텍스트다. 권한·기능·활성 프로세스는 후속 서버에서 인증된 값으로 구성해야 한다. 사용자가 전달한 permission 배열을 신뢰해서는 안 된다. 평가 성공은 기존 서비스의 소유자/조직 범위·합계·중복·원자성 검사를 생략해도 된다는 뜻이 아니다.

### 필수값·원천·현재 지원

- 영상 별표 `observedRequired`와 실행 `requiredRule`, 액션별 `requiredFieldKeys`를 구분했다. ERP 거래처 요청의 13개 필수는 요청 액션에서 검사하며 거래처 생성 필수와 혼합하지 않는다.
- 필수 필드나 상태 전이 입력을 숨기거나 제거하면 검증 실패다. 부모 섹션/탭/화면을 감춰 입력을 차단하는 경우도 검사한다.
- 숨김 대체값은 형식·범위에 맞는 기본값, 확인된 대체 필드 또는 관련 프로세스 제외 조건이 있어야 한다. 대체 필드의 허용 영역은 원래 필드의 허용 영역에 포함되어야 하며 숫자 범위/정수성, 문자열·배열 길이, 선택지를 대조한다. `0`, `false`는 누락값으로 간주하지 않는다. 필드를 숨기는 행위가 원본 업무 데이터를 삭제하지 않는다.
- `current.read/write/apiField/dbField/note`에 현재 지원을 보존한다. `lead.keymanNote` 같은 후보를 현재 저장 가능으로 등록하지 않았다.
- `cust_nm`은 현재 `accountName`으로 편집·저장 가능하지만 목표 프로필은 readOnly라는 충돌을 남겼다. ERP IN 관리 필드에 기존 프로필보다 엄격한 목표 보호를 둔 경우는 설계 가정으로 표시했다. 실제 UI/API는 H01에서 바꾸지 않았다.
- `lead.targetStatus`, `opportunity.targetStage`, `directWork.decision`은 선택 입력이며 저장된 상태와 별도다.
- 전이의 저장 상태 필드는 해당 액션/프로세스 화면 소유의 읽기전용 문자열 enum이어야 한다. 시작·도착 상태가 enum에 없거나 무관한 필드를 상태 필드로 지정하면 설정 검증에서 거부한다.
- 조건식 전체의 논리적 충족 가능성을 미리 증명하지는 않는다. 유효한 상태 enum으로 바꾸더라도 요청 대상과 목적지가 다르면 실제 전이는 거부되며, 조건식이 서로 모순되면 실행할 수 없는 설정으로 남을 수 있다.
- `reference`/`date`는 현재 문자열 타입과 명시된 길이/선택지까지 검증한다. UUID 문법, 날짜 문법, 배열 원소의 UUID 유효성은 기존 API 검증이 최종 기준이며 H01이 이를 대체한다고 주장하지 않는다.

### 법인 override

`applyHqOverride`는 상위 `standardKey`와 `version`이 정확히 일치할 때만 안정 ID의 허용 속성을 변경한다. 경로/식별자/소유 프로세스/필수 규칙/권한 목록 변경, locked·readOnly·마스킹 완화, 중복 patch, 없는 ID/속성을 거부한다. 적용 결과를 전체 재검증하고 원본을 수정하지 않는다. HQ 변경은 기존 스냅샷에 자동 전파하지 않으며 부모 버전 재검증·명시적 재적용이 필요하다. 법인 편집 UI는 만들지 않았다.

## 4. 실제 검증 결과와 미실행

검토 환경: Linux, Node.js v24.19.0. [실행 원문](evidence/H01-validation.txt).

| 실행 명령/범위 | 결과 | 해석 |
|---|---|---|
| `node --experimental-strip-types --test scripts/hq-standard/hq-standard.test.mjs` | PASS 141, 실패/skip 0, exit 0 | 40개 상위·101개 하위 테스트. 실제 코어/등록부/기존 순수 TS 자산을 로드 |
| `node scripts/regression/multi-market-ui-check.mjs` | PASS 85, exit 0 | 기존 HQ/GLOBAL 소스 수준 회귀. 실기기 인수 아님 |
| `node scripts/i18n/check.mjs` | PASS 346 keys, exit 0 | ko-KR/en-US 기존 키 일치 |
| `node scripts/i18n/hardcode-check.mjs` | PASS, exit 0 | 기존 TSX 하드코딩 검사 |
| `node scripts/pwa/check.mjs` | PASS, exit 0 | manifest/installability/API cache 소스 검사 |
| `git diff --check` | PASS | 공백/패치 검사 |
| `pnpm build`, `pnpm test`, 신규 Vitest 11개 | **로컬 미실행 / 아래 신규 CI에서 PASS** | 로컬 의존성 설치는 네트워크 정책으로 차단됨. 이번 PR CI의 실제 실행으로 별도 검증했으며 과거 결과를 재사용하지 않음 |
| 브라우저/HTTP/실기기/운영 DB/실 ERP | 미실행 | H01 등록부 계약 범위와 구분. H02 이후 관련 시나리오에서 검증 |

Node native TypeScript 실행은 정적 타입검사가 아니다. 모듈 형식 미지정 경고는 출력에 보존했으며 이를 없애기 위해 기존 CommonJS 패키지 설정을 변경하지 않았다. 정식 CI는 기존 Node 22 환경에서 전체 빌드·Vitest 및 새 `hq:check`를 실행하도록 연결했다. 아래와 같이 기능 게이트는 통과했지만 보안 검사 실패로 **전체 CI 결론은 failure**다.

### 신규 CI의 기능 검증 결과

검증 소스: `af4ec78fcfec723a6c8deeb66a4313f846bcd606` · 기준 main: `e111138` · [CI run 39761348395 / job 119766018990](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39761348395/job/119766018990). PR 합성 merge `b87d1ff`로 실행됐으며 Node v22.23.3, pnpm 9.15.0 환경이다. 이후 보고서·증거 정리 커밋은 위 검증 소스를 변경하지 않는다.

| 검사 | 실제 결과 | 제한 |
|---|---|---|
| `pnpm build` | contracts/backend/frontend 모두 PASS | TypeScript 타입검사 및 프런트 빌드 포함 |
| `pnpm test` — Frontend | 15개 파일, 70개 PASS | 신규 H01 11개 포함. 기존 59개 유지 |
| `pnpm test` — Backend | 15개 suite, 59개 PASS | 기존 전체 단위 테스트 |
| `pnpm hq:check` | 141개 PASS, 실패·생략 0 | 기존 순수 TS 자산과 신규 코어/등록부 실제 실행 |
| 회귀·다국어·하드코딩·PWA | 85개 소스 회귀, 346개 번역키 및 각 명령 PASS | 실기기·DOM 동작 인수 아님 |
| `pnpm env:check` | 명령 exit 0 | migration PLAN ONLY, URL 미설정으로 runtime/Map/ERP SKIP. 실제 SQL·ERP 접속 PASS가 아님 |
| `pnpm audit:critical` | **FAIL — Critical 5건** | proxy-addr 1건, tinypool 2건, handlebars 2건. 기준 main에도 같은 패키지·버전·건수 존재 |

프런트 신규 검증은 실제 renderer·등록부를 가져오되 브라우저 API 모듈만 테스트에서 격리한다. API/다운로드 6개 함수가 호출되면 즉시 예외로 실패하며, 운영 API 파일을 변경하거나 테스트를 생략하지 않았다. 이는 등록·참조·정책 검증이며 DOM 렌더링/실제 HTTP 요청 검증은 아니다.

### 신규 CI에서 발견한 통합 보완 이력

| 검증 커밋 / CI | 실제 결과 | 조치 |
|---|---|---|
| `c099f759` / [39760732132](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39760732132) | contracts/backend 빌드 성공, frontend TS2322 2건. 이후 테스트·audit skipped | `read`/`writable` helper가 실제로 완전한 객체를 반환하므로 반환 타입을 `HqField['current']`로 정정. 런타임/검사 정책 변경 없음 |
| `bfcea5ef` / [39761004071](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39761004071) | 전체 빌드 성공. 기존 프런트 59개 통과, 신규 검증은 `window is not defined`로 수집 실패. 이후 HQ 검사·audit skipped | Node 검증 파일에서 브라우저 API 모듈만 격리. 운영 소스 변경 없이 실제 renderer·등록부 참조는 유지 |
| `af4ec78f` / [39761348395](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39761348395) | 전체 빌드·프런트 70개·백엔드 59개·HQ 141개 및 정적 회귀 PASS. audit Critical 5건 FAIL | H01 기능 검증 승인. 보안 게이트 유지, main 미병합·H02 미착수 |

위 실패를 기존 보안 감사 실패와 혼동하지 않는다. 통합 테스트가 실제로 실행되기 전에는 신규 Vitest를 PASS로 계산하지 않는다.

## 5. 작업자 B 및 다음 단계 통제

작업자 B는 1차 독립 검토에서 신규 99개 테스트를 재실행하여 통과를 확인했지만, 추가 부정검증과 기존 API 대조로 P1 1건·P2 4건을 발견하여 승인을 보류했다. 수정은 구현 담당자가 수행하며 작업자 B가 별도로 재검증한다.

| 지적 ID | 내용 | 보완 방향 | 재검증 상태 |
|---|---|---|---|
| H01-P1-01 | 전이 상태 도메인·소유/요청 대상 불일치 허용 | 상태 enum·소유 검사, 선택 대상 명시 및 런타임 일치 검사 | B 해소 확인 |
| H01-P2-01 | 병합/캘린더/지도/직접배송 필수 입력 및 ERP 재요청 제한 누락 | 기존 API 필수·조건부 필수·상태 제한과 대응 | B 해소 확인 |
| H01-P2-02 | 직출 결정 필드가 조회권한으로 편집 가능 | 단계별 승인 액션 접근 정책의 OR 결합 | B 해소 확인 |
| H01-P2-03 | 값 범위가 맞지 않는 필드 fallback 허용 | 대체 필드 허용 영역의 포함 관계 검사 | B 해소 확인 |
| H01-P2-04 | 승인 목록 근거 오연결 및 S525/S527 누락 | H00 관찰/교육 구분과 정확한 근거 연결 | B 해소 확인 |

작업자 B는 보완된 동결본에서 141개 테스트를 직접 재실행하고, 별도 코어 프로브 12개 및 API/필드권한 분담 프로브 52개와 소스 대조를 확인했다. 이후 타입 선언·테스트 경계의 최소 보완 및 `af4ec78f`의 실제 CI도 독립 조회하여 **H01 코드·표준 계약·빌드·테스트 범위 PASS**로 최종 판정했다. 각 검증은 일부 중복되므로 합산하여 고유 테스트 수로 표시하지 않는다. 기존 보안 감사 문제는 직접 기준 main 로그와 대조했으며, 보안 게이트를 포함한 전체 승인·main 병합은 계속 보류한다.

B가 확인한 SHA-256 지문:

```text
packages/contracts/src/hq-standard.ts
f3916cc2d792adea66ff51e715b7980085b2cb92916af6a10a3600a18a3371cc
frontend/src/app/hq-standard-registry.ts
a6d850880f6319218878a5eb5f5d71e4c82fb7d44bbd742526c45d773ffbae08
scripts/hq-standard/hq-standard.test.mjs
547345615dea6c352f866367c061762e89e211aefb21f77f1b47460ac3de239e
frontend/src/app/hq-standard.spec.ts
ac5906f87c96f8750a58af638d6ad7be6b68cb30320acceca252e85eca009146
```

기존 main `e111138`의 [CI 실행 39731453601](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39731453601)은 빌드·테스트·소스 회귀를 통과했으나 `pnpm audit:critical`에서 Critical 5건으로 실패했다. 새 H01 CI에서도 같은 패키지·버전·건수가 확인됐다. 의존성/lockfile은 이번 범위에서 변경하지 않았으며, 기존 문제라는 이유로 보안 검사를 제거하거나 성공으로 처리하지 않는다. 별도 의존성 보완과 CI 재검증 후 병합 게이트를 다시 판정해야 한다.

H02는 아직 시작하지 않았다. 목업 저장소·시드·ERP 어댑터, 기존 UI/서버의 실시간 정책 적용, 관리자/법인 편집기 및 34개 실제 업무 화면 완성은 해당 후속 단계의 범위다. 새로운 설정 데이터가 등록됐다는 이유로 실제 ERP 요청→결과 수신 또는 화면 동작이 구현됐다고 간주하지 않는다.

### 재현 명령

의존성이 설치된 동일 브랜치에서 실행한다. Windows PowerShell에서 실행 정책 충돌이 있으면 `pnpm.cmd`를 사용한다.

```powershell
pnpm.cmd build
pnpm.cmd test
pnpm.cmd hq:check
pnpm.cmd regression:multi-market
pnpm.cmd i18n:check
pnpm.cmd i18n:hardcode
pnpm.cmd pwa:check
```

`hq:check`는 TypeScript type-stripping을 지원하는 Node에서 실행한다. 현재 실제 검증은 위 Node 24.19.0으로 수행했다. 사용자의 2026-10-22 추가 지시에 따라 H01 게이트 통과 후 H02~H07을 순차 구현·실행 검증·작업자 B 검증으로 진행한다.


## 2026-10-22 보안 보완 및 H01 게이트 종결

위 보류 기록은 당시 결과를 보존한다. 후속 보안 수정 커밋 `e360473c5fb0b80b3a1f68a9e5f9f532bd7b1f81`의 [CI 39784369288](https://github.com/dio-securer/dio_crm_dev_proj/actions/runs/39784369288)은 전체 success다. frontend 70, backend 59, HQ 141 및 build/회귀/i18n/PWA가 통과했고 audit Critical은 0건이다. 실제 설치로 생성된 lockfile을 회수해 저장소에 반영했으며 blob SHA는 `6ca05e8a3a85e209a5cc693abbc8d6429afeaf72`이다.

작업자 B가 해당 job 119843515751 및 로그·잠금 파일을 독립 확인하여 **H01 기능·보안 게이트 PASS, H02 진행 승인**을 판정했다. High 6·Moderate 11·Low 2건 및 실 ERP/운영 환경 검증은 [별도 보안 기록](security-remediation.md)에 남겼다. H01 기능 구현을 다시 시작하지 않고 이 승인된 기준에서 H02로 이어간다.
