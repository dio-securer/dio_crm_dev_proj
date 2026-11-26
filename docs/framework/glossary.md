# 용어집

업무에서 쓰는 말과 코드에서 쓰는 이름을 짝지어 둔 표다. 새 이름을 짓기 전에 여기서 먼저 찾는다.

- "코드 이름"은 저장소에 실제로 있는 이름이다. 지어낸 이름은 없다. 코드가 아직 없는 용어는 "미구현"이라고 적었다.
- "정의 위치"의 파일을 열면 그 이름이 있다. 한 용어가 여러 곳에 있으면 줄을 나눴다.
- 같은 것을 가리키는 이름이 층마다 다르다. DB 표는 `crm_` 로 시작하고, 서버 API 는 `…Controller`, HQ 목업 자료는 복수형(`accounts`)이다.
- 이 파일은 보호 경로다. 바꾸면 PR 요약의 "보호 파일 변경"에 나온다.

## 영업 업무

| 한국어 용어 | 코드 이름 | 뜻 | 정의 위치 |
| --- | --- | --- | --- |
| 리드 (Lead) | `crm_lead` | 아직 거래처가 아닌 잠재 고객(신규 병원). DB 표. | `database/migrations/002_phase2_customer.sql` |
| 리드 | `LeadController` | 리드를 다루는 서버 API(`api/leads`). | `backend/src/modules/customer/customer.controller.ts` |
| 리드 | `leads` | HQ 목업 자료의 리드 묶음. | `backend/src/hq-mock/model.ts` |
| 거래처 (Account) | `crm_account` | 거래하는 고객사(병원 등). DB 표. | `database/migrations/002_phase2_customer.sql` |
| 거래처 | `AccountController` | 거래처를 다루는 서버 API(`api/accounts`). | `backend/src/modules/customer/customer.controller.ts` |
| 거래처 | `accounts` | HQ 목업 자료의 거래처 묶음. | `backend/src/hq-mock/model.ts` |
| 연락처 | `crm_contact` | 거래처에 속한 사람(담당자). DB 표. | `database/migrations/002_phase2_customer.sql` |
| 연락처 | `contacts` | HQ 목업 자료의 연락처 묶음. | `backend/src/hq-mock/model.ts` |
| 영업기회 (Opportunity) | `crm_opportunity` | 계약으로 이어질 수 있는 판매 건. DB 표. | `database/migrations/002_phase2_customer.sql` |
| 영업기회 | `OpportunityController` | 영업기회를 다루는 서버 API(`api/opportunities`). | `backend/src/modules/opportunity/opportunity.controller.ts` |
| 영업기회 | `opportunities` | HQ 목업 자료의 영업기회 묶음. | `backend/src/hq-mock/model.ts` |
| 영업기회 단계 이력 | `crm_opportunity_stage_history` | 영업기회의 단계가 바뀐 기록. DB 표. | `database/migrations/004_phase4_opportunity.sql` |
| 계약 | `crm_contract` | 거래처와 맺은 판매 계약. DB 표. | `database/migrations/005_phase5_contract_collection.sql` |
| 계약 | `ContractController` | 계약을 다루는 서버 API(`api/contracts`). | `backend/src/modules/contract/contract.controller.ts` |
| 계약 | `contracts` | HQ 목업 자료의 계약 묶음. | `backend/src/hq-mock/model.ts` |
| 계약 품목 | `crm_contract_product` | 계약에 든 품목. DB 표. | `database/migrations/005_phase5_contract_collection.sql` |
| 패키지 (상품 묶음) | `crm_product_package` | 여러 품목을 묶어 파는 상품. DB 표. | `database/migrations/004_phase4_opportunity.sql` |
| 패키지 | `ProductPackageController` | 패키지를 다루는 서버 API(`api/product-packages`). | `backend/src/modules/opportunity/opportunity.controller.ts` |
| 패키지 원장 | `packageLedger` | 한 거래처의 계약별 매출·수금·반품 내역을 날짜순으로 모은 것. 조회 함수. | `backend/src/modules/analytics/analytics.service.ts` |
| 패키지 원장 (권한) | `LEDGER.READ`, `LEDGER.EXPORT` | 원장을 보는 권한과 내려받는 권한. | `backend/src/modules/analytics/analytics.controller.ts` |
| 패키지 원장 (화면) | `HQ_LEDGER` | HQ 목업의 원장 화면 이름. | `backend/src/hq-mock/analytics-routes.ts` |
| 패키지 원장 (합계) | `salesAmount`, `collectionAmount`, `returnExchangeCount` | 원장 요약의 매출 합, 수금 합, 반품·교환 건수. | `backend/src/modules/analytics/analytics.service.ts` |
| 패키지 잔액 | 미구현 | 패키지에서 아직 쓰지 않고 남은 금액·수량. 이 값을 담는 이름이 코드에 없다. | 미구현 |
| 패키지 이월 | 미구현 | 남은 잔액을 다음 기간으로 넘기는 것. 코드에 없다. | 미구현 |
| 미수 잔액 (계약) | `outstandingAmount` | 계약 금액에서 실제 수금액을 뺀 값. 패키지 잔액과 다른 것이다. | `backend/src/modules/contract/contract.service.ts` |
| 주문 | `crm_order`, `crm_order_item` | 거래처의 주문과 주문 품목. DB 표. | `database/migrations/006_phase6_order_delivery_sales.sql` |
| 주문 | `OrderController` | 주문을 다루는 서버 API(`api/orders`). | `backend/src/modules/order/order.controller.ts` |
| 주문 | `orders` | HQ 목업 자료의 주문 묶음. | `backend/src/hq-mock/model.ts` |
| 납품 | `crm_delivery` | 주문한 품목을 보낸 기록. DB 표. | `database/migrations/006_phase6_order_delivery_sales.sql` |
| 매출 | `crm_sales` | 확정된 판매 기록. DB 표. | `database/migrations/006_phase6_order_delivery_sales.sql` |
| 매출 | `SalesController` | 매출을 다루는 서버 API(`api/sales`). | `backend/src/modules/order/order.controller.ts` |
| 반품·교환 | `crm_return_exchange` | 반품과 교환 기록. DB 표. | `database/migrations/006_phase6_order_delivery_sales.sql` |
| 수금 계획 | `crm_collection_plan` | 계약 금액을 언제 얼마씩 받을지 정한 계획. DB 표. | `database/migrations/005_phase5_contract_collection.sql` |
| 수금 계획 | `plans` | HQ 목업 자료의 수금 계획 묶음. | `backend/src/hq-mock/model.ts` |
| 수금 실적 | `crm_collection_actual` | 실제로 받은 돈의 기록. DB 표. | `database/migrations/005_phase5_contract_collection.sql` |
| 수금 (권한) | `COLLECTION.READ`, `COLLECTION.PLAN.WRITE` | 수금을 보는 권한과 수금 계획을 고치는 권한. | `backend/src/modules/contract/contract.controller.ts` |
| 활동 | `crm_activity` | 영업 사원의 방문 등 활동 한 건. DB 표. | `database/migrations/003_phase3_activity.sql` |
| 활동 | `ActivityController` | 활동을 다루는 서버 API(`api/activities`). | `backend/src/modules/activity/activity.controller.ts` |
| 활동계획 | `ActivityStatus`, `PLANNED` | 상태가 "예정"인 활동. 계획만 따로 담는 개체는 없다. | `backend/src/modules/activity/activity.rules.ts` |
| 일일활동보고 | `crm_activity_report`, `crm_activity_report_item` | 하루 활동을 모아 올리는 보고와 그 항목. DB 표. | `database/migrations/003_phase3_activity.sql` |
| 일일활동보고 | `ActivityReportController` | 활동보고를 다루는 서버 API(`api/activity-reports`). | `backend/src/modules/activity/activity.controller.ts` |
| 일일활동보고 | `reports` | HQ 목업 자료의 활동보고 묶음. | `backend/src/hq-mock/model.ts` |
| 직출·직퇴 | `crm_direct_work` | 사무실을 거치지 않는 출근·퇴근 신청. DB 표. | `database/migrations/003_phase3_activity.sql` |
| 직출·직퇴 | `DirectWorkController` | 직출·직퇴를 다루는 서버 API(`api/direct-work`). | `backend/src/modules/activity/activity.controller.ts` |

## 법인, 국가, 시장

| 한국어 용어 | 코드 이름 | 뜻 | 정의 위치 |
| --- | --- | --- | --- |
| 법인 (Company) | `crm_company` | CRM 을 쓰는 회사 하나. 자료는 법인별로 나뉜다. DB 표. | `database/migrations/001_phase1_foundation.sql` |
| 법인 | `companySchema`, `Company`, `COMPANY_IDS` | admin 계약에서 법인의 형식과 목업 법인 번호. | `packages/contracts/src/admin/core.ts` |
| 조직 | `crm_organization` | 법인 안의 조직 단위. DB 표. | `database/migrations/001_phase1_foundation.sql` |
| 국가 | `countryCode` | 법인이 속한 나라. 두 글자 코드. | `packages/contracts/src/admin/core.ts` |
| 국가 프로필 | `CountryProfileDefinition`, `getCountryProfile` | 나라 하나의 준비 상태와, 그 나라가 쓰는 시장 템플릿·시장 프로필. | `backend/src/globalization/country-profile.ts` |
| 시장 (Market) | `MarketProfileDefinition`, `getMarketProfile` | 한 나라의 영업 방식을 정하는 묶음. 어느 템플릿, 화면, 필드, 기능, 업무 흐름, 연동 프로필을 쓰는지 적는다. | `backend/src/globalization/market-profile.ts` |
| 시장 기능 | `MARKET_FEATURE_KEYS`, `MarketFeatureKey` | 시장마다 켜고 끌 수 있는 기능 이름. | `packages/contracts/src/globalization.ts` |
| 시장 템플릿 | `HQ_TEMPLATE`, `GLOBAL_TEMPLATE` | 본사용과 해외 법인용 기본 틀. | `backend/src/globalization/market-template.ts` |
| 템플릿 코드 | `templateCode` | 법인이 쓰는 틀. 값은 `HQ` 또는 `GLOBAL`. | `packages/contracts/src/admin/core.ts` |

## 설정 (admin 계약)

설정 도메인은 17개다. 이름 목록은 `packages/contracts/src/admin/core.ts` 의 `domains` 에, 도메인마다의 형식은 `schemas.ts` 의 `payloadSchemas` 에 있다.

| 한국어 용어 | 코드 이름 | 뜻 | 정의 위치 |
| --- | --- | --- | --- |
| 설정 도메인 | `domains` | 설정을 종류별로 나눈 17개 칸의 이름 목록. | `packages/contracts/src/admin/core.ts` |
| 설정 범위 | `COMMON`, `TEMPLATE`, `COUNTRY`, `COMPANY` | 설정이 적용되는 넓이. 공통, 템플릿, 국가, 법인 순으로 좁아진다. | `packages/contracts/src/admin/drafts.ts` |
| 초안 | `draftInputSchema`, `createDraft` | 게시하기 전의 설정 변경. | `packages/contracts/src/admin/drafts.ts` |
| 조건식 | `conditionSchema` | 규칙과 목록에서 쓰는 조건의 형식. 등록된 연산자만 쓴다. | `packages/contracts/src/admin/schemas.ts` |
| 확장 필드 | `extensionDefinitions` | 법인이 추가한 필드. 이름은 `x_` 로 시작한다. | `packages/contracts/src/admin/schemas.ts` |
| 실행 모드 | `executionMode` | 실제 DB 로 돌지 목업으로 돌지. 값은 `LEGACY`, `API_MOCK`, `BROWSER_MOCK`. | `packages/contracts/src/admin/core.ts` |
| 법인 기본값 (도메인) | `COMPANY_PROFILE` | 법인의 기본 언어, 통화, 시간대, 템플릿. | `packages/contracts/src/admin/schemas.ts` |
| 기능 (도메인) | `FEATURE` | 기능을 켜고 끄는 설정. | `packages/contracts/src/admin/schemas.ts` |
| 메뉴 (도메인) | `MENU` | 메뉴의 항목과 순서. | `packages/contracts/src/admin/schemas.ts` |
| 화면 (도메인) | `SCREEN` | 화면의 탭과 구성. | `packages/contracts/src/admin/schemas.ts` |
| 필드 (도메인) | `FIELD` | 개체의 필드와 확장 필드. | `packages/contracts/src/admin/schemas.ts` |
| 규칙 (도메인) | `RULE` | 저장·표시·동작 때 적용하는 조건과 효과. | `packages/contracts/src/admin/schemas.ts` |
| 용어 (도메인) | `TERM` | 화면에 쓰는 말과 그 번역. | `packages/contracts/src/admin/schemas.ts` |
| 코드 (도메인) | `CODE` | 선택 목록에 쓰는 공통 코드 묶음. | `packages/contracts/src/admin/schemas.ts` |
| 목록 보기 (도메인) | `LIST_VIEW` | 목록의 열, 거르기, 정렬. | `packages/contracts/src/admin/schemas.ts` |
| 동작 (도메인) | `ACTION` | 화면의 버튼과 동작. | `packages/contracts/src/admin/schemas.ts` |
| 업무 흐름 (도메인) | `WORKFLOW` | 업무 상태의 흐름. | `packages/contracts/src/admin/schemas.ts` |
| 승인 (도메인) | `APPROVAL` | 승인 정책과 승인 경로. | `packages/contracts/src/admin/schemas.ts` |
| 알림 (도메인) | `NOTIFICATION` | 어떤 일에 누구에게 알릴지. | `packages/contracts/src/admin/schemas.ts` |
| 번호 규칙 (도메인) | `NUMBERING` | 문서 번호를 매기는 방식. | `packages/contracts/src/admin/schemas.ts` |
| 달력 (도메인) | `CALENDAR` | 시간대, 근무 요일, 휴일. | `packages/contracts/src/admin/schemas.ts` |
| 연동 (도메인) | `INTEGRATION` | 외부 시스템 연동 설정. 지금은 모의(`MOCK`)만 된다. | `packages/contracts/src/admin/schemas.ts` |
| 보안 (도메인) | `SECURITY` | 세션 시간, 로그인 실패 잠금 같은 보안 값. | `packages/contracts/src/admin/schemas.ts` |

## 기존 체계와 프레임워크

| 한국어 용어 | 코드 이름 | 뜻 | 정의 위치 |
| --- | --- | --- | --- |
| HQ 표준 | `HqStandard`, `HqScreen`, `HqField`, `HqAction` | 본사(HQ) 화면·필드·동작을 적은 기존 표준 형식. | `packages/contracts/src/hq-standard.ts` |
| HQ 목업 자료 묶음 | `HQ_COLLECTION_NAMES` | HQ 목업이 가진 자료 묶음의 이름 목록. | `backend/src/hq-mock/model.ts` |
| 연동 번호 | `HQ_INTERFACE_CODES` | 외부 시스템(ERP 등) 연동 하나하나의 번호. | `backend/src/hq-mock/model.ts` |
| 관리자 작성 로직 | `LogicEventDescriptor`, `runtimeStatus` | 관리자가 쓴 코드를 붙일 수 있는 자리의 목록. 실행하지 않는다(ADR 0003). | `packages/contracts/src/logic-events.ts` |
| 설정 구역 | `metadata/` | 값만 두는 폴더. 규칙 G01 이 지킨다. | `scripts/guard/rules/g01-metadata-only-config.mjs` |
| 엔진 구역 | `packages/engine` | 공통 코드를 둘 폴더. 지금은 안내문만 있다. | `packages/engine/README.md` |
| 확장 구역 | `extensions/` | 회사 전용 코드를 둘 폴더. 지금은 안내문만 있다. | `extensions/README.md` |
| 이관 대상 (legacy) | `LEGACY_RULES` | 프레임워크로 옮길 기존 코드를 고르는 규칙. 목록은 `legacy-files.json`. | `scripts/guard/lib/legacy.mjs` |
| 가드 | `RULES` | 프레임워크 규칙 G01~G11 을 검사하는 프로그램. | `scripts/guard/rules/index.mjs` |
| 기준선 | `BASELINE_FILE` | 기존 위반을 숫자로 묶어 둔 파일(`guard-baseline.json`)의 이름. | `scripts/guard/lib/baseline.mjs` |
| 보호 경로 | `PROTECTED_FILE` | 바꾸면 사람 승인이 필요한 경로 목록 파일의 이름. | `scripts/guard/lib/codeowners.mjs` |
| 예외 선언 | `RAISES_FILE` | 사람이 허락한 약화를 적는 파일(`guard-raises.json`)의 이름. | `scripts/guard/lib/raises.mjs` |
| 변경 ID | `START_FILE` | 커밋 제목의 `[REQ-숫자]`, `[F숫자-숫자]`. 검사 시작점 파일의 이름. | `scripts/guard/rules/g09-change-id.mjs` |
| 증거 꾸러미 | `EVIDENCE_DIR` | `pnpm crm verify` 가 만드는 결과 폴더. | `scripts/crm/lib/verify.mjs` |
| 합성 증거 | `EVIDENCE_KIND` | 가짜 데이터로 돌린 검사의 증거. 값은 `SYNTHETIC`. | `scripts/crm/lib/verify.mjs` |
| 실증 증거 | 미구현 | 실제 DB·운영 환경에서 확인한 증거. 만드는 도구가 아직 없다(ADR 0005). | 미구현 |
| 요청 유형 | `TYPES` | 요청 분류 A·B·C·D. | `scripts/crm/lib/classify.mjs` |
