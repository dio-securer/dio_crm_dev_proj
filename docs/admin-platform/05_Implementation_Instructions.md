# 05. 단계별 구현 작업지시서

## 0. 작업 기준
이 문서는 후속 구현 요청 시 수행할 작업지시다. 문서 작성 시점에 아래 구현을 실행한 것으로 간주하지 않는다.
기존 React/Vite + NestJS + shared contracts 구조를 유지한다. 새로운 전사 CRM이나 별도 기술스택으로 재작성하지 않는다. 실제 ERP 호출·DB 적용·운영 배포·외부 알림 발송은 범위 밖이다.
각 단계는 해당 인수 조건을 통과한 뒤 다음으로 진행한다. 모든 변경은 작업 브랜치에서 검증하고 코드 리뷰 가능한 PR로 제공한다. 아래 제안 경로는 구현 시 기존 파일/exports를 확인해 충돌 없이 생성한다.

## 1. 제안 파일 구성
| 위치 | 책임 |
|---|---|
| packages/contracts/src/admin/ | config-schema, identity, permission, condition, approval, integration 계약 |
| packages/contracts/src/admin/resolver.ts | 순수 상속/병합/검증 로직 |
| frontend/src/admin/ | 관리 화면, 폼, 상속 출처 표시, 미리보기 |
| frontend/src/admin/client/ | AdminClient + BrowserMockAdminClient + HttpAdminClient |
| frontend/src/admin/runtime/ | effective-context, field renderer, menu resolver |
| frontend/src/admin/mock/ | 버전 저장소, seed adapter, 합성 fixture |
| backend/src/modules/admin/ | controller, config service, release service, identity/role 관리 |
| backend/src/modules/approval/ | 범용 approval service, task reducer, legacy adapter |
| backend/src/integration/mock/ | mock transport, clock, scenarios, response handler |
| backend/src/repositories/ | AdminRepository/IdentityRepository 포트 및 memory adapter |
| tests/admin/ | HTTP 권한·계약 테스트, 화면 시나리오 |
| docs/admin-platform/implementation/ | 단계별 실행 보고서 (구현 시 생성) |

## 2. 단계별 지시

### A00 — 기준선 고정과 목업 데이터 인벤토리
- 선행: 이 설계 범위 확인.
- 작업: 현재 HEAD, package scripts, account sandbox storage, App 라우팅, 기존 auth 및 API/DB 의존성을 조사한다. 기존 화면 스크린샷/동작을 HQ/US/MX 기준으로 기록한다.
- 산출: baseline.md, fixture-mapping.md; 기존 account seed는 별도 원본 fixture로 보존.
- 검증: 고객명/주소로 회사 추론하지 않음, GLOBAL 미확정 승인자 기록, 신규 폴더와 기존 코드 충돌 여부.
- 완료: 모든 기존 경로와 새 모듈 연결표가 있고 실행 가능한 기존 명령/실패 원인을 기록함.
- 대상: 전체 ADM의 공통 준비.

### A01 — 공통 계약과 Repository·목업 실행 기반
- 선행: A00.
- 작업: domain별 Zod schema, publicId 변환 규칙, revision/idempotency/error envelope 작성. AdminRepository와 IdentityRepository 포트, Browser/Memory adapter 구현.
- 브라우저 저장은 schemaVersion/datasetId/revision envelope, memory는 회사 mutex와 transaction rollback.
- 기존 JWT guard를 유지하면서 API_MOCK 인증 fixture를 주입할 수 있도록 auth 저장소 접근을 분리한다.
- 모드 선택은 명시적으로 하며 production에서 mock 거부. 실제 ERP network client를 바인딩하지 않는다.
- 산출: contracts/admin, admin/client, repositories, fixture loader.
- 테스트: invalid payload 422, revision conflict 409, rollback, 새로고침 복구, API 재시작 reset, mock production 차단.
- 완료: 브라우저/API가 동일 샘플 DTO를 읽고 저장 가능. 아직 사용자-facing 전체 CRUD 완료로 보고하지 않는다.

### A02 — 법인·조직·사용자·담당자 이관
- 선행: A01.
- 대상: ADM-01~03,30.
- 작업: 회사 CRUD, organization tree, memberships, 사용자 중지/복수 회사 전환, 이관 preview/job 구현.
- 기존 user.company_id는 home company로 보존. 기존 user_role를 회사 역할로 매핑하는 fixture adapter 작성.
- 법인 전환 시 이전 회사 캐시/늦은 응답 제거. 이관 시 task 승인자는 자동 변경하지 않는다.
- 산출: CompaniesPage, OrganizationsPage, UsersPage, OwnershipTransferPage와 API.
- 테스트: 조직 순환, 타 법인 parent/target, 마지막 관리자 중지, 회원 자격 없는 회사 전환, 이관 동시 수정.
- 완료: 같은 국가 US_A/US_B가 별도 데이터와 사용자 문맥을 가짐.

### A03 — 역할·데이터·필드 권한과 보안 정책
- 선행: A02.
- 대상: ADM-04~06,13,28.
- 작업: 회사별 role, grants/denies, dataScopes, fieldPermissions, delegation, session 정책 UI/API 구현.
- 서버 모든 read/write 경로에 회사/범위/field 검증 연결. 일반 사용자 POST에 숨김 필드를 삽입하면 거부.
- permissionVersion 검증, 사용자 중지/role 회수 시 즉시 무효화. browser mock 권한은 시연임을 표시.
- MFA는 DEMO 챌린지와 정책 분기만 제공, 실제 MFA로 주장하지 않음.
- 테스트: deny 우선, token 재사용, URL 직접 호출, 검색/필터를 통한 숨김 값 노출, 위임 범위 초과.
- 완료: 버튼 숨김만 구현한 상태는 미완료. API 직접 호출 테스트가 통과해야 한다.

### A04 — 설정 상속·버전·게시 최소 기반
- 선행: A03.
- 대상: ADM-07,26.
- 작업: draft/version/release/validation/event, 4계층 resolver, locked path, override reset, 게시/rollback 구현.
- 초기 기능은 즉시 게시부터 시작하고 A10에서 예약/영향 분석까지 완성.
- 부모 version 고정과 stale base 오류 구현; 게시 대상 회사 active pointer 원자 교체.
- 산출: ConfigurationPage, ReleasesPage, shared resolver, release service.
- 테스트: false/0 override, 배열 key merge, 부모 변경 격리, 검증 후 수정, 충돌 게시, rollback의 보안/sequence 비회귀.
- 완료: 초안 편집이 사용자 화면에 바로 노출되지 않으며 게시 후 releaseId가 바뀜.

### A05 — 기능·메뉴·화면·그룹·필드·조건·확장 필드
- 선행: A04.
- 대상: ADM-08~12,16~18,34.
- 작업: typed 편집 화면과 registry 연결. 기존 HQ/GLOBAL screen registry 재사용. 정적 field profile을 초기 config로 변환.
- list view/feature dependency/action allowlist/condition AST 엔진 구현. 확장 필드 5개 type의 저장·조회·검증 연결.
- 거래처 화면 한 개를 수직 구현: 그룹·필드 변경→게시→목록/등록/상세·서버 검증 반영.
- 코드에 없는 일반 화면을 관리자 설정만으로 만들어 실행한다고 가정하지 않는다.
- 테스트: hidden+required 충돌, 타입 불일치, stale release 저장, 미등록 액션, extension 비활성 후 과거 값 보존.
- 완료: US_A/US_B의 같은 화면이 다른 구성으로 동작하고 HQ 원본 레이아웃 회귀 없음.

### A06 — 명칭·다국어·기준정보·번호·달력
- 선행: A05.
- 대상: ADM-14~15,33,37.
- 작업: semantic term override + translation 폼, code 관리, numbering/calendar 설정 구현.
- 기존 i18n 시스템과 locale 파일 재사용, 회사 override dictionary 추가.
- 서버 공통 코드 조회에 company/global merge 적용. 번호 미리보기와 실제 할당 분리.
- 테스트: 언어 변경 시 프로세스 불변, placeholder 누락, US_A 명칭이 US_B에 누출되지 않음, 동시 번호 유일성, 휴일 dueAt.
- 완료: ko-KR/en-US 두 언어 시연 가능. 스페인어 등 미지원 언어는 미완료로 표시.

### A07 — 프로세스 정의·승인 엔진·관리 화면
- 선행: A06.
- 대상: ADM-19~22.
- 작업: 상태·전이/정책/결재선 관리와 인스턴스/task/event 구현. APPROVAL_DEMO_DOCUMENT로 순차/병렬/반려/회수/재상신 시연.
- 문서 revision과 정의 snapshot 고정, 활성 승인자 재검증, 대결 기간/이력, 강제 재배정 권한.
- 기존 activity route는 legacy adapter로 유지. 신규 엔진 적용 feature가 켜진 문서만 새 엔진을 사용.
- 기존 글로벌 미확정 승인자에 대해서는 설정 미완료 오류. 목업 route는 DEMO_ONLY.
- 테스트: 자기승인, 빈 승인자, 동시 이중 승인, ANY/ALL, policy conflict, 승인 중 새 설정 게시, 승인자 중지.
- 완료: 단계 도식만 있는 것이 아니라 샘플 문서 상태와 승인함 task가 연결되어 동작.

### A08 — 알림과 운영 이벤트
- 선행: A07.
- 대상: ADM-23.
- 작업: event bus/outbox 계약, IN_APP, mock EMAIL, 번역 template/수신자 미리보기 구현.
- 승인/반려/기한 경과/게시 이벤트 연결. 캘린더 dueAt을 fake clock으로 검사.
- 테스트: 이벤트 재수신 중복 제거, 권한 없는 수신자 제외, placeholder escape, 언어 고정.
- 완료: 승인 요청 후 해당 승인자에게만 알림 1건. 실제 외부 전송 0건.

### A09 — ERP 연동 가정 구현
- 선행: A08.
- 대상: ADM-24~25.
- 작업: 기존 interfaceCode와 account/contract/order 결과 핸들러를 조사하고 mock adapter 연결. 04 문서의 7 transport 시나리오 구현.
- 거래처 UI에는 ERP 요청→모의 승인/반려→상태 갱신을 실제 연결한다. 계약/주문/수금/납품은 합성 fixture 기반 관리 시연으로 제공.
- 기존 enqueuePending 호출을 전역 자동 성공으로 바꾸지 않는다. mode=MOCK일 때만 결과를 적용.
- 로그에서 mode/scenario/businessOutcome/attempt/requestId가 조회돼야 한다.
- 테스트: 성공, 반려, 실패 후 재처리, timeout late response, duplicate, out-of-order, 타 회사 응답, payload hash 충돌.
- 완료: mocked transport가 기존 domain handler 또는 명시된 sample handler를 호출하고 업무 상태가 정확히 1회 반영. 실제 ERP egress 0건.

### A10 — 설정 적용 운영·미리보기 완성
- 선행: A09.
- 대상: ADM-26 최종, 전 영역 연계.
- 작업: multi-domain 게시, 영향 회사/필드/승인 미리보기, 예약·취소·복원, cache 갱신, 변경 이력, 모바일 편집 흐름 구현.
- 법인 관리자가 설정 가능한 경로만 보이게 하고 server에서도 동일하게 제한한다.
- 테스트: 예약 당시와 실행 시 active 변경 충돌, 비활성 회사, 미등록 registry 참조, rollback, 시연 reset 범위.
- 완료: 메뉴/필드/승인 규칙이 한 release로 일관되게 적용되고 기존 진행 건은 이전 정의 유지.

### A11 — 전체 인수검증·사용 안내
- 선행: A10.
- 작업: 06의 모든 acceptance case 실행, HQ/US_A/US_B/MX_A 회귀, browser/API 두 모드의 차이를 보고.
- 산출: 실행 보고서, 실패/미구현 목록, 화면 캡처, 테스트 로그, 시연 계정/시나리오 사용 안내.
- 완료: 31개 영역에 PASS/FAIL/BLOCKED를 개별 표시. UI 생성만으로 PASS 처리하지 않는다.

## 3. 검증 명령
기존 package.json에서 확인한 명령:
~~~sh
pnpm build
pnpm test
pnpm regression:multi-market
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
~~~
A01에서 admin contract test, A03에서 API negative test, A05에서 browser interaction test 실행 명령을 추가한다. 새 명령 이름은 package.json에 실제 등록한 뒤 보고한다. DB/외부 연결을 요구하는 env:check 결과와 목업 기능 통과를 분리한다.
문서만 작성하는 이번 변경에는 위 코드 테스트를 실행했다고 기재하지 않는다.

## 4. 단계 보고 양식
- 단계/대상 ADM/기준 commit/작업 commit
- 변경 파일 및 기존 경로와의 연결
- 수행한 사용자 시나리오와 캡처
- 명령·결과·실패 원인
- mock 실행 모드/실제 외부 호출 여부
- 남은 제한·회귀·다음 단계 선행 조건

## 5. 회귀와 중단
기존 HQ 화면 또는 API가 깨지면 다음 단계 확장 전에 복구한다. DB/ERP credentials가 없어서 API_MOCK 검증을 못 한다는 구조는 허용하지 않는다.
변경 중 중단하면 단계, 마지막 완료 테스트, 미완료 파일, 목업 schemaVersion, 재개 명령을 보고서에 남긴다.
