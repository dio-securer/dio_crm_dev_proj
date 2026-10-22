# H00 화면·업무 대응표

기준 커밋: `9e16bc20fe28457b46a7ee68ee6489130bf9f82b` · 조사일: 2026-10-22. 근거는 [P0 화면 카탈로그](../../../spec/screens/P0-08_screen_menu_catalog.md), [라우트](../../../frontend/src/app/route-config.ts), [화면 프로필](../../../frontend/src/app/screen-profile.ts), [화면 등록부](../../../frontend/src/app/screen-registry.tsx), 각 페이지와 backend controller다. 이 표의 판정은 **현재 구현 조사 결과**이며 완료 판정이 아니다. `부분`은 진입 또는 일부 동작만 확인된 상태, `미구현`은 카탈로그의 독립 업무 동작을 확인하지 못한 상태다. 실제 브라우저 조작 검증은 H03–H07에서 수행한다.

`/`는 현재 Lead 슬롯이므로 P0의 홈 대시보드가 아니다. 14개 HQ 진입점은 모두 등록되어 있지만, 카탈로그의 상세·팝업·관리자 기능을 모두 충족한다는 뜻은 아니다. 목록 내 하위 화면에는 독립 경로를 만들지 않고 부모 화면과 액션을 대응시킨다. 모바일은 `P0 우선`과 실제 구현 확인을 구분한다.

| P0 ID | 현 진입점 / 부모 화면 | 코드·API 근거 | 교육 분석 연결 | 현 판정 / 주요 차이 |
|---|---|---|---|---|
| SCR-HOME-001 | `/` 현재 `HQ_LEAD` | `LeadsPage`, analytics dashboard API 별도 | S01, S41–S43 | 미구현: 홈 위젯 화면 없음 |
| SCR-LEAD-001 | `/` `HQ_LEAD` 목록 | `LeadsPage`; `GET /api/leads` | S02–S04 | 부분: 검색·목록 중심, 신규/오늘/나의 필터 확인 필요 |
| SCR-LEAD-002 | `HQ_LEAD` 상세 | `LeadsPage`에는 상세 진입 없음; `GET/PATCH /api/leads/:id`, status/owner API만 존재 | S04–S09, S11–S12 | 미구현: 상세·편집 UI 없음 |
| SCR-LEAD-003 | `HQ_LEAD` 전환 대화상자 | `POST /api/leads/:id/convert`; 현 `LeadsPage`와 연결 확인 필요 | S12 | 미구현: 신규/기존 분기·중복 확인 UI 확인 안 됨 |
| SCR-ACC-001 | `/accounts` `HQ_ACCOUNT` | `AccountsPage`; `GET/POST /api/accounts` | S13–S14 | 부분: 목록·검색·생성 UI 있음, 범위·일괄조회 확인 필요 |
| SCR-ACC-002 | `/account360` `HQ_ACCOUNT360`, 계정 상세 | `Account360Page`, `AccountsPage`; `GET /api/analytics/accounts/:id/360` | S15–S20, S44 | 부분: 요약 조회 있음, Sales/Order/Service/Timeline/병원현황 탭 부족 |
| SCR-ACC-003 | `HQ_ACCOUNT` 상세 액션 | `AccountsPage`; `POST /api/erp-accounts/:id/request`, 중복조회 API | S17–S18 | 부분: ERP 요청 버튼 있음, 승인결과/상태 연결 미완료 |
| SCR-ACC-004 | `HQ_ACCOUNT` 관리 액션 | `POST /api/accounts/merge`; UI 연결 확인 필요 | S13–S20 중 중복 맥락 | 미구현: 최대 3개·주체/필드 선택 UI 없음 |
| SCR-ACT-001 | `/activities` `HQ_ACTIVITY` 지도 영역 | `ActivitiesPage`; `GET /api/activities/map/today` | Drive 상세 없음; P0 | 부분: 주변 조회 있음, 지도/GPS 시각·오류 처리 확인 필요 |
| SCR-ACT-002 | `HQ_ACTIVITY` 활동 상세 | `ActivitiesPage`; check-in/out, `PATCH /api/activities/:id` | Drive 상세 없음; P0 | 부분: IN/상담/OUT 버튼 있음, 상세 편집·이력 부족 |
| SCR-ACT-003 | `HQ_ACTIVITY` 계획 폼 | `ActivitiesPage`; `POST /api/activities/plans` | Drive 상세 없음; P0 | 부분: 단건 등록 있음, 상태·직출 연계 확인 필요 |
| SCR-ACT-004 | `HQ_ACTIVITY` 다건 대화상자 | `POST /api/activities/plans/bulk`; UI 확인 필요 | Drive 상세 없음; P0 | 미구현: PC 다건 선택/등록 UI 없음 |
| SCR-CAL-001 | `HQ_ACTIVITY` 캘린더 | `GET /api/activities/calendar`; `ActivitiesPage` 목록 | Drive 상세 없음; P0 | 부분: 일정 목록 있음, 월/일 캘린더 화면 부족 |
| SCR-REP-001 | `/activity-reports` `HQ_ACTIVITY_REPORT` | `ActivityReportsPage`; prepare/edit/request API | S21–S22 | 부분: 작성·요청 있음, 계획/결과 속성 대조 필요 |
| SCR-REP-002 | `HQ_ACTIVITY_REPORT` 승인 목록 | `ActivityReportsPage`; `GET /api/activity-reports` | S22 | 부분: 목록 있음, 기간·권한별 승인대상 필터 부족 |
| SCR-REP-003 | `HQ_ACTIVITY_REPORT` 승인 상세 | `ActivityReportsPage`; branch/division approve API | S22 | 부분: 버튼 있음, 상세·의견 저장·반려 구분 부족 |
| SCR-DW-001 | `/direct-work` `HQ_DIRECT_WORK` | `DirectWorkPage`; `GET /api/direct-work` | Drive 상세 없음; P0 | 부분: 목록·요청 버튼 있음, 상세/ERP 결과 부족 |
| SCR-DW-002 | `HQ_DIRECT_WORK` 승인 영역 | `DirectWorkPage`; branch/division decision API | Drive 상세 없음; P0 | 부분: 승인/반려 버튼 있음, 재할당·의견·결과 부족 |
| SCR-OPP-001 | `/opportunities`, `/pipeline` | `OpportunitiesPage`, `PipelinePage`; opportunity list/funnel API | S41–S45, S501 | 부분: 목록·단계 집계 있음, 필터/예상금액 대조 필요 |
| SCR-OPP-002 | `HQ_OPPORTUNITY` 상세 | `OpportunitiesPage`; stage/patch API | S46–S50, S502 | 부분: 단계·협상 입력 일부 있음, 니즈/제안/수주 차단 속성 부족 |
| SCR-OPP-003 | `HQ_OPPORTUNITY` 제품 영역 | `OpportunitiesPage`; product add/patch/delete API | S49–S51, S502 | 부분: 단건 추가 있음, 복수 선택·수량·패키지 계산 부족 |
| SCR-CON-001 | `/contracts` 생성 영역 | `ContractsPage`; `POST /api/contracts` | S503–S506 | 부분: 생성 폼 있음, 제품별 행·특약·종류 부족 |
| SCR-CON-002 | `HQ_CONTRACT` 상세 | `ContractsPage`; contract detail/ERP request/result API | S507–S510 | 부분: 계약·ERP 요청 있음, 승인결과/탭·잠금 부족 |
| SCR-COL-001 | `HQ_CONTRACT` 수금 영역 | `ContractsPage`; collection plan/change/reconciliation API | S511–S514 | 부분: 최초계획 일부 있음, 변경/분할/ERP 결과 UI 부족 |
| SCR-ORD-001 | `/orders` `HQ_ORDER` | `OrdersPage`; product/draft/item/delivery/submit API | S517–S524, S701–S704 | 부분: 주문 폼 있음, 검색/복수 선택·ERP 품목 제약 부족 |
| SCR-ORD-002 | `/fulfillment` `HQ_FULFILLMENT` | `FulfillmentPage`; order/fulfillment/sales API | S521–S524 | 부분: 목록·납품 조회 있음, ERP 결과·반품 상세 부족 |
| SCR-LED-001 | `/ledger-statements` `HQ_LEDGER` | `LedgerStatementsPage`; ledger/xlsx API | S515–S516 | 부분: 조회/Excel 버튼 있음, 파일·필터 검증 필요 |
| SCR-STM-001 | `HQ_LEDGER` 명세서 영역 | `LedgerStatementsPage`; statements/pdf API | S515–S516 | 부분: 조회/PDF 버튼 있음, 모바일 제한·서식 검증 필요 |
| SCR-ANL-001 | `/analytics` `HQ_ANALYTICS` | `AnalyticsDashboardPage`; dashboard API | S19, S41–S43 | 부분: 기간 조회 있음, 전체 지표·기준시각 부족 |
| SCR-ADM-001 | 별도 관리자 UI 필요 | `GET /api/users`, `/api/organizations` | Drive 상세 없음; P0 | 미구현: 사용자/조직 관리 UI 및 변경 API 없음 |
| SCR-ADM-002 | 별도 관리자 UI 필요 | 현 main의 권한 설정 화면/API 확인 안 됨 | Drive 상세 없음; P0 | 미구현: 역할·권한·범위 관리 없음 |
| SCR-ADM-003 | 별도 관리자 UI 필요 | `GET /api/common-codes/:groupCode` | Drive 상세 없음; P0 | 미구현: 코드 편집 화면/API 없음 |
| SCR-ADM-004 | 별도 관리자 UI 필요 | `GET /api/interface-logs` | Drive 상세 없음; P0 | 미구현: 연계 모니터/재처리 UI 없음 |
| SCR-ADM-005 | 별도 관리자 UI 필요 | `GET /api/audit-logs` | Drive 상세 없음; P0 | 미구현: 감사 검색/상세 UI 없음 |

## 카탈로그 외 현재 진입점

| 추가 ID | 진입점 | 근거 | 처리 |
|---|---|---|---|
| HQ-OPS-ENTRY | `/ops` `HQ_OPS` | `OpsStatusPage`, `GET /api/ops/status` | 현재 사용 진입점. 운영 상태 조회·새로고침을 표준 등록부에 포함하고 H07에서 동작 확인. |

`HQ_PIPELINE`, `HQ_ACCOUNT360`, `HQ_FULFILLMENT`는 각각 기회 목록, 거래처 360, 주문/납품의 독립 라우트이지만 P0 업무 ID에 대응한다. `HQ_OPS`만 P0 카탈로그의 업무 화면에 직접 대응하지 않는다. `SCR-HOME-001`은 현재 `/`와 충돌하므로 H01에서는 가상 상세 화면으로 명시하고 실제 홈 진입점 변경은 H07에서 처리한다.

## 화면별 실행 위치·권한·장치 조사

`DB`는 현재 Nest 서비스가 `DatabaseService`를 통해 접근하는 저장소다. `AccountsPage`는 별도의 로컬 시험 저장 모드(`dio_crm_test_accounts_v2`)도 제공한다. 읽기/쓰기 권한은 controller의 `@RequirePermission` 값이며, 화면에서 같은 조건이 적용되는지는 아직 검증되지 않았다. `모바일 우선/PC 전용`은 P0 규칙이고, 그 밖의 `반응형 확인`은 현 CSS/실기기 검증이 필요한 상태다. 사용자는 [P0 카탈로그](../../../spec/screens/P0-08_screen_menu_catalog.md)의 사용자 열을 따른다.

| ID | 실제 경로·screenKey / 부모 | 유형 | 저장소·API 권한 | 장치 기준 |
|---|---|---|---|---|
| SCR-HOME-001 | `/`는 `HQ_LEAD`; 목표 `HQ_HOME` 미등록 | 대시보드 | DB 분석 집계; `ANALYTICS.READ` 참고 | 반응형 확인 |
| SCR-LEAD-001 | `/` `HQ_LEAD` | 목록 | DB Lead; `LEAD.READ` | 모바일 기본조회 |
| SCR-LEAD-002 | `/` `HQ_LEAD` 내부 미구현 | 상세·탭 | DB Lead; `LEAD.READ/WRITE/MANAGE` | 모바일 기본조회 |
| SCR-LEAD-003 | `HQ_LEAD` 내부 미구현 | 대화상자 | DB Lead/Account/Contact/Opportunity; `LEAD.CONVERT` | 반응형 확인 |
| SCR-ACC-001 | `/accounts` `HQ_ACCOUNT` | 목록·폼 | DB Account 또는 별도 로컬 시험 저장; `ACCOUNT.READ/WRITE` | 모바일 기본조회 |
| SCR-ACC-002 | `/account360` `HQ_ACCOUNT360`, `/accounts` 상세 | 상세·탭 | DB Account/analytics; `ACCOUNT360.READ`, `ACCOUNT.READ` | 모바일 기본조회 |
| SCR-ACC-003 | `HQ_ACCOUNT` 상세 액션 | 대화상자·상태 | DB Account/InterfaceLog; `ERP_ACCOUNT.REQUEST` | 모바일 기본조회 |
| SCR-ACC-004 | `HQ_ACCOUNT` 내부 미구현 | 대화상자 | DB Account; `ACCOUNT.MERGE` | 반응형 확인 |
| SCR-ACT-001 | `/activities` `HQ_ACTIVITY` | 지도·목록 | DB Activity/Lead/Account; `ACTIVITY.READ` | 모바일 우선 |
| SCR-ACT-002 | `HQ_ACTIVITY` 내부 | 상세·IN/OUT | DB Activity; `ACTIVITY.READ/WRITE/CHECKIN/CHECKOUT` | 모바일 우선 |
| SCR-ACT-003 | `HQ_ACTIVITY` 내부 | 단건 폼 | DB Activity; `ACTIVITY.WRITE` | 모바일 우선 |
| SCR-ACT-004 | `HQ_ACTIVITY` 내부 미구현 | 다건 대화상자 | DB Activity; `ACTIVITY.WRITE` | PC 전용 |
| SCR-CAL-001 | `HQ_ACTIVITY` 내부 | 캘린더 | DB Activity; `ACTIVITY.READ` | 모바일 우선 |
| SCR-REP-001 | `/activity-reports` `HQ_ACTIVITY_REPORT` | 작성·목록 | DB ActivityReport; `ACTIVITY.REPORT` | 모바일 우선 |
| SCR-REP-002 | `HQ_ACTIVITY_REPORT` 내부 | 승인 목록 | DB ActivityReport; `ACTIVITY.REPORT` | 모바일 우선 |
| SCR-REP-003 | `HQ_ACTIVITY_REPORT` 내부 | 승인 상세 | DB ActivityReport; `ACTIVITY.REPORT.APPROVE.BRANCH/DIVISION` | 모바일 우선 |
| SCR-DW-001 | `/direct-work` `HQ_DIRECT_WORK` | 목록·상세 | DB DirectWork; `DIRECT_WORK.READ/REQUEST` | 모바일 우선 |
| SCR-DW-002 | `HQ_DIRECT_WORK` 내부 | 승인 상세 | DB DirectWork; `DIRECT_WORK.APPROVE.BRANCH/DIVISION` | 모바일 우선 |
| SCR-OPP-001 | `/opportunities` `HQ_OPPORTUNITY`, `/pipeline` `HQ_PIPELINE` | 목록·파이프라인 | DB Opportunity; `OPPORTUNITY.READ`, `PIPELINE.READ` | 반응형 확인 |
| SCR-OPP-002 | `HQ_OPPORTUNITY` 내부 | 상세·탭 | DB Opportunity; `OPPORTUNITY.READ/WRITE/STAGE` | 반응형 확인 |
| SCR-OPP-003 | `HQ_OPPORTUNITY` 내부 | 제품 대화상자 | DB OpportunityProduct; `OPPORTUNITY.PRODUCT.WRITE` | 반응형 확인 |
| SCR-CON-001 | `/contracts` `HQ_CONTRACT` | 생성 폼 | DB Contract; `CONTRACT.WRITE` | 반응형 확인 |
| SCR-CON-002 | `HQ_CONTRACT` 내부 | 상세·탭 | DB Contract; `CONTRACT.READ/ERP_REQUEST` | 반응형 확인 |
| SCR-COL-001 | `HQ_CONTRACT` 내부 | 대화상자·표 | DB CollectionPlan/Actual; `COLLECTION.READ/PLAN.WRITE` | 반응형 확인 |
| SCR-ORD-001 | `/orders` `HQ_ORDER` | 주문 폼·대화상자 | DB Order/Product; `ORDER.READ/WRITE/SUBMIT`, `PRODUCT_ORDER.READ` | 모바일 우선 |
| SCR-ORD-002 | `/fulfillment` `HQ_FULFILLMENT` | 목록·상세 | DB Order/Delivery/Return; `ORDER.READ`, `SALES.READ` | 반응형 확인 |
| SCR-LED-001 | `/ledger-statements` `HQ_LEDGER` | 조회·Excel | DB Sales/Collection/Return; `LEDGER.READ/EXPORT` | PC Excel 전용 |
| SCR-STM-001 | `HQ_LEDGER` 내부 | 조회·PDF | DB Sales/Collection; `STATEMENT.READ/EXPORT` | 모바일 전체내역 PDF만 |
| SCR-ANL-001 | `/analytics` `HQ_ANALYTICS` | 대시보드 | DB 집계; `ANALYTICS.READ` | 반응형 확인 |
| SCR-ADM-001 | 현 route 없음 | 관리자 목록·폼 | DB User/Organization; `USER.READ`, `ORG.READ`; 쓰기 권한/API 미확인 | 반응형 확인 |
| SCR-ADM-002 | 현 route 없음 | 관리자 목록·폼 | DB Permission/Scope; API·권한 미확인 | 반응형 확인 |
| SCR-ADM-003 | 현 route 없음 | 관리자 목록·폼 | DB CommonCode; 현 `GET`은 AuthGuard, 쓰기 미확인 | 반응형 확인 |
| SCR-ADM-004 | 현 route 없음 | 연계 로그·재처리 | DB InterfaceLog; `INTERFACE.READ`, 재처리 권한/API 미확인 | 반응형 확인 |
| SCR-ADM-005 | 현 route 없음 | 감사 조회·상세 | DB AuditLog; `AUDIT.READ` | 반응형 확인 |
| HQ-OPS-ENTRY | `/ops` `HQ_OPS` | 운영 상태 조회 | DB/서비스 상태; `OPS.READ` | 반응형 확인 |

## 교육 분석 단위 개별 대응

아래 명칭은 Drive의 1차·04·05 원문 제목을 기준으로 옮겼다. `02·03`은 1차의 구간 분할, `06·07`은 05의 구간 분할이므로 같은 S 단위를 중복 화면으로 등록하지 않는다. `S505`, `S506`, `S525`–`S527`은 교육 설명으로 분류한다. `S701`–`S704`는 07의 후반 모바일 설명을 가리키는 작업설계서 표기이며, 이번에 확인한 05 원문의 고유 S ID는 `S520`–`S524`이므로 별도 화면 수에 더하지 않는다.

| 분석 ID·내용 | 대응 P0 화면 / 영역 | 근거 유형 |
|---|---|
| S01 영업 홈과 앱 전환 | SCR-HOME-001 | 시연 |
| S02 리드 목록보기 선택 | SCR-LEAD-001 / 목록 필터 | 시연 |
| S03 리드 목록에서 상세 조회 | SCR-LEAD-001 → 002 | 시연 |
| S04 리드 단계 경로와 상태 변경 | SCR-LEAD-002 / 단계 | 시연 |
| S05 리드 기본정보와 키맨 편집 | SCR-LEAD-002 / 편집 | 시연 |
| S06 컨택제외와 지도 표시 관리 | SCR-LEAD-002 / 제외 | 시연 |
| S07 심평원 인입정보 확인과 수정 | SCR-LEAD-002 / 인입 | 시연 |
| S08 마케팅 정보 조회 | SCR-LEAD-002 / 마케팅 탭 | 시연 |
| S09 변경 이력과 활동 기록 조회 | SCR-LEAD-002 / 이력·활동 | 시연 |
| S10 리드 전환 조건 입력 | SCR-LEAD-003 | 시연 |
| S11 리드 수동 생성 | SCR-LEAD-002 / 신규 폼 | 시연 |
| S12 리드 소유자 변경 | SCR-LEAD-002 / 소유자 액션 | 시연 |
| S13 전환 결과와 거래처 최초 확인 | SCR-LEAD-003 → SCR-ACC-002 | 시연 |
| S14 거래처 세부사항 수정 | SCR-ACC-002 / 기본·ERP | 시연·교육 설명 분리 |
| S15 거래처 연락처 생성 | SCR-ACC-002 / 관련 연락처 | 시연 |
| S16 병원현황 개별 수정 | SCR-ACC-002 / 병원현황 | 시연 |
| S17 Sales 관련 목록 조회 | SCR-ACC-002 / Sales | 시연 |
| S18 Order와 Service 조회 | SCR-ACC-002 / Order·Service | 시연 |
| S19 거래처 현황분석과 Timeline | SCR-ACC-002 / 현황분석·Timeline | 시연 |
| S20 거래처관리대장 목록 편집 | SCR-ACC-001 / 관리대장 | 시연 |
| S21 활동보고 승인 대상 조회 | SCR-REP-002 | 시연 |
| S22 활동보고 상세와 의견 입력 | SCR-REP-003 | 시연; 최종 승인 성공 미확인 |
| S41 판매 대시보드 조회 | SCR-HOME-001, SCR-ANL-001 | 시연 |
| S42 대시보드 목록 | SCR-HOME-001, SCR-ANL-001 | 시연 |
| S43 위젯 표시 단위 편집 | SCR-HOME-001 / 위젯 | 시연 |
| S44 거래처에서 기회 상세 진입 | SCR-ACC-002 → SCR-OPP-002 | 시연 |
| S45 기회 단계 경로·키 필드 | SCR-OPP-002 / 단계 | 시연 |
| S46 기회 세부사항 조회 | SCR-OPP-002 | 시연 |
| S47 가격 목록 선택 | SCR-OPP-003 / 가격 | 시연 |
| S48 제품 검색·복수 선택 | SCR-OPP-003 / 제품 | 시연 |
| S49 선택된 제품 수량·금액 저장 | SCR-OPP-003 / 금액 | 시연 |
| S50 기회 마감 선택 | SCR-OPP-002 / 수주 | 시연 |
| S51 ERP 미완료에 따른 수주 차단 | SCR-OPP-002 / 오류 | 시연 |
| S501 기회 신규 등록 | SCR-OPP-002 / 신규 폼 | 시연 |
| S502 기회 제품 등록·수주 성공 | SCR-OPP-002–003 | 시연 |
| S503 계약 생성 입력 | SCR-CON-001 / 계약 행 | 시연 |
| S504 계약 생성 확인·결과 | SCR-CON-001 → 002 | 시연 |
| S505 거래처 ERP 등록 교육 | SCR-ACC-003 / 업무 규칙 | 교육 설명 |
| S506 기회 단계·계약 매핑 교육 | SCR-OPP-002, SCR-CON-001 / 매핑 | 교육 설명 |
| S507 계약 목록·전역검색 | SCR-CON-002 / 목록 | 시연 |
| S508 승인 계약 상세 | SCR-CON-002 | 시연 |
| S509 수금계획 조회 | SCR-COL-001 / 관련 목록 | 시연 |
| S510 수금현황 연동 조회 | SCR-CON-002, SCR-COL-001 | 시연 |
| S511 최초 수금계획 생성·저장 | SCR-COL-001 / 최초 | 시연 |
| S512 최초 계획 재편집·행 추가 | SCR-COL-001 / 최초 수정 | 시연 |
| S513 계약 등록요청 | SCR-CON-002 / ERP 요청 | 시연 |
| S514 승인 후 수금계획 분할 | SCR-COL-001 / 변경 | 시연; 저장 성공 미확인 |
| S515 거래명세서 조회 | SCR-STM-001 | 시연 |
| S516 거래처 패키지원장 조회 | SCR-LED-001 | 시연 |
| S517 PC 주문 조건·검색 | SCR-ORD-001 / 조건 | 시연 |
| S518 PC 주문 품목·수량·삭제 | SCR-ORD-001 / 장바구니 | 시연 |
| S519 배송 정보 입력 | SCR-ORD-001 / 배송 | 시연 |
| S520 모바일 메뉴·계약 진입 | SCR-ACC-002 → SCR-CON-002 | 시연 |
| S521 모바일 품목 선택·수량 | SCR-ORD-001 / 모바일 | 시연 |
| S522 모바일 주문 요청 성공 | SCR-ORD-001 → 002 | 시연; ERP 완료 아님 |
| S523 모바일 관련 주문항목 확인 | SCR-ORD-002 | 시연 |
| S524 매출 조회·주문반품 탭 | SCR-CON-002, SCR-ORD-002 | 시연 |
| S525 수금계획 관리 교육 | SCR-COL-001 / 업무 규칙 | 교육 설명 |
| S526 계약 등록·실적 연동 교육 | SCR-CON-002 / 업무 규칙 | 교육 설명 |
| S527 주문 교육·후속 재조회 | SCR-ORD-001–002 / 업무 규칙 | 교육 설명과 후속 재조회 분리 |

## 장치·권한 근거

모바일 우선: 지도·활동/IN-OUT·보고·직출직퇴·리드/거래처 기본조회·명세서 파일 확인. PC 전용: 활동계획 다건, 원장 Excel. 모바일 명세서는 전체 내역 PDF만 허용한다는 P0 제약이 있다. 현재 각 페이지가 이 제약을 실제로 지키는지 H03–H07 검증 대상이다. 역할은 P0의 사용자 열을 원칙으로 하되, 실제 권한 판정은 `backend` guard/rules 및 H00-fields의 `미확인`을 확인한 후 확정한다.
