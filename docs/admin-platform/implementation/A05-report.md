# A05 기능·메뉴·화면·필드·조건·확장 필드

2026-10-21 · ADM-08~12/16~18/34 · 기준 PR #28 A04 `6a18d60`.
작업자 B 코드 검토 승인. 추가 필드 레지스트리 연결도 승인. PR은 A06–A11 후속 작업을 위해 초안 유지.

## 구현

- 기존 HQ/GLOBAL 필드 프로필을 공통 contracts로 옮기고 기존 import 경로에서 재노출한다. 원본 screen registry를 재사용하며 기존 LEGACY 화면 컴포넌트·계정 storage는 유지한다. 정적 프로필의 그룹·필드 순서를 목업의 초기 SCREEN/FIELD 설정으로 변환한다.
- `AccountDesigner`: 기능, 메뉴, 화면/탭/그룹, 필드/확장 정의, 조건 AST, 공용 목록 보기, 액션의 typed 편집. A04의 부모 pin·stable-key override·초안·검증·게시를 재사용한다. JSON/script 실행 폼은 없다.
- `AccountRuntimePort`와 거래처 목록/등록/상세/수정: 게시된 release만 적용. 화면 registry 검증, 메뉴 트리/순서/권한, 탭·그룹 순서·열 수, 필드 배치·필수·읽기전용, 목록 열/필터/정렬, 액션 표시명·확인 문구·허용 조건을 연결했다.
- 기능 registry: account/activity/contract/order, order→contract→account 의존성. 메뉴 route registry는 거래처 목록(`accounts`)과 거래처 등록(`accounts.new`)이며 임의 업무 화면을 생성하지 않는다. 액션 allowlist는 account.create/update다. ERP 요청 port는 후속 A09 capability로 남는다.
- 확장 타입 text/decimal/date/boolean/enum. Decimal은 문자열과 BigInt 기반 precision18/scale4 비교로 정밀도를 유지한다. 날짜 실존 여부, enum 코드, null/타입/길이, 누락 PATCH 보존, stable key 삭제, 값 존재 시 타입 변경을 검사한다. 비활성화해도 과거 저장값은 유지한다.
- 기준 필드 x_priority, x_nextContactDate, x_visitGroup, x_creditLimit, x_optIn. HIGH일 때 상담일 필수. US_B 초기 방문 그룹 숨김 및 SALES 신용한도 읽기/쓰기 차단.
- 서버는 기능·액션·데이터 범위·필드 권한·규칙·타입·required·revision·release를 재검사한다. readOnly422/write=false403/unknown422/CONFIG_CHANGED409. name 필수/공백 거부 및 taxId 잠금은 규칙으로 완화하지 못한다.
- Condition AST는 all/any/not/eq/ne/in/isEmpty/비교, 최대 깊이/노드 수, 엄격한 값 타입과 null/빈 배열, 회사/역할/문서 상태 문맥을 지원한다. 같은 target+effect의 상반 값과 여러 규칙의 hidden+required 조합은 조건과 무관하게 게시 거부한다. readOnly는 제한 우선 OR다.
- LAST4는 등록된 text 필드만 허용한다. 원문 대신 maskedFields를 반환하고 fieldReplacements로만 교체한다. 중복 쓰기, 마스크 필드 검색/정렬, DENY 우회, 확장 필드 권한 상한 상승을 차단한다. 생성/수정 쓰기 권한을 별도로 제공한다.
- 공용보기 작성 검증은 설정관리자의 업무조회 권한 부재와 명시적 DENY/마스킹 상한을 구분한다. 설정관리자에게 업무 레코드 읽기를 부여하지 않으며, 일반 사용자 실행 시 자신의 권한으로 열을 제거하고 금지된 필터/정렬은403이다.
- `field-registry` GET은 role.read로 key/type/active만 제공한다. 기존 역할 편집기도 게시된 확장 필드를 선택하며 text 외 LAST4 옵션을 제공하지 않는다. Runtime metadata는 비조회 필드·마스킹 기본값·민감 조건을 제외하고 기존 runtime/configuration은 FEATURE 요약만 반환한다.
- HQ TEMPLATE의 고정 프로필 기반을 resolve에도 적용해 빈 초안 게시/rebase 후 GLOBAL 화면으로 바뀌는 결함을 수정했다. API_MOCK/BROWSER_MOCK는 같은 검증/저장 엔진을 사용한다.

## 실행 검증

| 묶음 | 결과 | 증거 |
|---|---|---|
| pnpm build | PASS | evidence/a05-build.log |
| pnpm test | 기존 단위131 PASS: frontend57/backend74 | evidence/a05-unit.log |
| A04 공통7 + A05 공통9 | 16 PASS | evidence/a05-tests.log |
| 기존 HTTP40 + A04 HTTP1 + A05 HTTP12 | 53 PASS | evidence/a05-tests.log |
| pnpm test:admin:ui | 실제 Chromium 양 모드 PASS | evidence/a05-ui.log |
| Browser 공통 엔진 경계 | 29 검사 PASS | evidence/a05-ui.log |
| A04 UI 회귀 | 양 모드 게시/RESET/rollback, Browser CAS/T56 PASS | evidence/a05-a04-ui.log |
| 작업자 B 독립 검증 | 당시 A05 17/17 및 추가 registry1/1, 집중 불변식/문맥 재현 PASS | evidence/a05-worker-b.log, 본 보고 |
| git diff --check | PASS | 커밋 전 확인 |

중복 제외 총 단위147(131+7+9), HTTP53(40+1+12). `a05-tests.log`의69는 공통16+HTTP53이다. Browser29와 UI 시나리오는 별도이며 위 단위/HTTP 합계에 넣지 않는다. B는 UI를 독립 재실행하지 않았고 A의 실행 증거를 기준으로 검토했다.

실제 HTTP 요청/응답 예시는 `evidence/a05-http-payloads.jsonl`에 저장했다. 합성 데이터만 포함하며 인증 헤더·암호는 기록하지 않는다. 재현 명령:

```sh
pnpm build
pnpm test
pnpm test:admin:account
CHROMIUM_PATH=/path/to/chromium pnpm test:admin:ui
```

UI: typed FIELD/LIST_VIEW/ACTION/SCREEN/MENU 편집→초안→검증→게시→sales1 등록(HIGH 상담일 누락 거부 후 성공)→상세/수정. 메뉴 순서/목록 열/액션 문구/그룹 순서/3열 반영, US_B 숨김/권한, HQ 기존 프로필을 확인했다. 마지막에는 역할 편집기에서 확장 필드 선택 및 text 전용 LAST4 옵션을 확인했다. 외부 egress0.

캡처는 양 모드 각각 `a05-designer-*`, `a05-create-*`, `a05-runtime-*`(목록+상세), `a05-us-b-*`, `a05-hq-*`다. 신규 편집 UI 검증 중 대기 조건과 잘못된 HQ 필드 test selector를 수정했으며 최종 고정 코드 재실행이 통과했다. 추가 registry API는 generic GET 라우트에 연결해 우선 매칭 오류를 수정했다.

| 인수 항목 | 증거 및 결과 |
|---|---|
| T46 | 초안 불변·회사별 게시 격리, 목록/액션/확장 필드 양 모드 반영 PASS |
| T47 | readOnly/write/unknown/null/누락 PATCH 및 거부 시 보존 PASS |
| T48 | 상반 effect·교차 hidden+required, readOnly/업무 필수 불변식 PASS |
| T67 | LAST4 원문 미노출·누락 보존·허용 교체·검색/values/중복 거부 PASS |
| T71 | 의존성422·기능OFF API403·메뉴 숨김과 권한 분리 PASS |
| T72 | 중복 route·cycle·unknown screen422, 그룹/메뉴 순서와 HQ 유지 PASS |
| T75 | 등록 액션/권한, 공용보기 읽기 검증·열 제거·검색 차단 PASS |
| T28/T50 | A05 확장 타입/조건 범위 검증 완료. 번호/승인 등 후속 통합을 전체 PASS로 처리하지 않음 |
| T83 | 전체 모바일 인수는 A11 후속. 이번 완료 선언 대상 아님 |

## 검토 지적과 조치

B가 독립 재현한 HQ 템플릿 손실, readOnly 완화, 확장 권한 상승을 수정했다. 추가 지적인 LAST4 타입/공용보기 권한/nullable 정렬/AST 문맥/확장 key/생성 전용 권한/탭·열·메뉴·액션 반영도 보완했다. 마지막 name 필수값 우회와 공용보기 문맥 필터 실행 불일치는 회귀 테스트를 추가하고 집중 재검증했다. B의 최종 코드 승인 후 필드 레지스트리 UI 연동도 별도 승인받았다.

## 후속 범위

A05는 목업 거래처 한 화면의 수직 구현이다. 임의 화면 코드 생성, 실제 OTP/SSO/ERP/DB 연동, 운영 배포, 외부 발송은 하지 않았다. SECURITY 정책 게시 통합·예약 게시·회사 템플릿 전환 통합은 A10이다. 기존 A04 스냅샷에는 A05 SCREEN이 없을 때만 프로필 기반 호환 어댑터를 적용하고 기존 계정 저장소를 초기화하지 않는다. 빌드의 500KB 청크 경고는 비차단이다.

다음 단계: A06 명칭·다국어·기준정보·번호·달력.
