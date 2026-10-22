# H00 필드·액션·연계 조사

기준: [화면 카탈로그](../../../spec/screens/P0-08_screen_menu_catalog.md), [ERP/심평원 인터페이스](../../../spec/interfaces/P0-07_interface_catalog.md), [공유 DTO](../../../packages/contracts/src/index.ts), [거래처 필드 계약](../../../packages/contracts/src/account-interface.ts), `frontend/src/*Page.tsx`, `backend/src/modules/*/*.controller.ts`. 아래 키는 **현 코드 필드명 또는 H01에서 부여할 안정 키 후보**다. `?`는 시연 자료/코드에서 정확한 필수·최댓값·권한 규칙을 확정하지 못했다는 뜻이다. 별표 관찰과 서버 필수 규칙은 동일하다고 간주하지 않는다.

| 화면 묶음 | 필드 키 / 섹션·형식·원천 | 확인된 필수·기본·선택지 / 미확인 | 액션과 현재 API | 연계 |
|---|---|---|---|---|
| `SCR-HOME-001` | `home.newLeadCount`, `home.todayActivityCount`, `home.pipelineAmount`, `home.pendingApprovalCount` / 위젯·숫자·CRM 집계 | 집계 시각/범위 ?; 현 `/`는 리드 | 위젯 조회·새로고침·상세 이동: 홈 API 없음, analytics API 일부 | 없음 |
| `SCR-LEAD-001`–`003` | `lead.hospitalName`, `status`, `ownerUserId`, `phone`, `address`, `sido`, `sigungu`, `businessNo`; 키맨 성/유형/전화, 규모, 시스템, 심평원 정보, 컨택제외 사유, History / 텍스트·선택·날짜 | 현 공유 DTO는 요약 필드만. 단계 선택지 `NEW/FIRST_VISIT/KEYMAN_MEETING/CONTACT_EXCLUDED/CONVERTED`; 상세 필수·별표·최댓값 ? | 검색·상세·수정·상태·소유자·전환: `GET/PATCH/POST /api/leads`; 기존/신규 연결·중복 UI 미확인 | `IF-HIRA-001`, `IF-ERP-001` |
| `SCR-ACC-001`–`004` | `account.accountName`, `accountStatus`, `accountGrade`, `businessNo`, `providerNo`, `encryptedProviderNo`, `address*`, `ownerUserId`, `erpCustomerCode`, `erpApprovedYn`, `integrationStatus`; 아래 거래처 인터페이스 25개 항목 참조 | 현 생성 폼 `accountName` 필수. ERP 송신 13개 필수는 `requiredOut`이며 화면의 별표와 별도. ERP 수신 항목은 읽기 전용 원칙. 중복/병합 권한 ? | 목록·생성·수정·중복조회·병합·ERP 요청: `GET/POST/PATCH /api/accounts`, `/api/erp-accounts/:id/request`; 승인 수신 API는 UI 연결 미완료 | `IF-HIRA-001`, `IF-ERP-002`–`003` |
| `SCR-ACT-001`–`004`, `SCR-CAL-001` | `activity.relatedType`, `relatedPublicId`, `plannedAt`, `visitPurpose`, `directWorkType`, `directWorkReason`, `status`, `inAt`, `outAt`, `consultation`; 위치 좌표 / 선택·날짜시간·텍스트·GPS | 현 계획 폼 `relatedPublicId`,`plannedAt` 필수, 직출 유형 선택 시 사유 필수. 좌표 정확도·GPS 거부 정책 ? | 단건/다건 등록·캘린더·지도·IN/OUT·상담: `/api/activities/plans`, `/plans/bulk`, `/calendar`, `/map/today`, `/:id/check-in`, `/:id/check-out`, `PATCH /:id` | `IF-ERP-012`–`013` 연관 |
| `SCR-REP-001`–`003` | `report.date`, `items.consultationSnapshot`, `futurePlan`, `status`, `branchComment`, `divisionComment`, `accompaniedYn` / 날짜·텍스트·선택 | 현 상태 `DRAFT/REQUESTED/BRANCH_APPROVED/FINAL_APPROVED`; 반려·의견만 저장·최종 필수 ? | 준비·항목수정·승인요청·지점/본부 승인: `/api/activity-reports` 하위. 현재 상세와 목록 구분 부족 | 없음 |
| `SCR-DW-001`–`002` | `directWork.type`, `reason`, `activityPublicId`, `status`, `approver`, `comment`, `erpStatus` / 선택·텍스트 | 현 상태 `DRAFT/REQUESTED/BRANCH_APPROVED/DIVISION_APPROVED/BRANCH_REJECTED/DIVISION_REJECTED`; 재할당·코멘트 필수 ? | 신청·지점/본부 결정: `/api/direct-work`; ERP 결과 UI 미연결 | `IF-ERP-012`–`013` |
| `SCR-OPP-001`–`003` | `opportunity.name`, `accountPublicId`, `expectedCloseDate`, `stage`, `successProbability`, `forecastCategory`, `reason`, `products.productPublicId`, `quantity`, `price`, `amount`; 니즈/제안/협상 섹션 | 단계 `NEEDS_ANALYSIS/PROPOSAL/NEGOTIATION/CLOSED_WON/CLOSED_LOST`; 현 UI는 이름·거래처·단가 입력 위주. 별표/계산·가격목록 선택 ? | 생성·상세·단계·협상·제품 추가/수정/삭제: `/api/opportunities`, `/api/product-packages`; 수주 시 ERP 거래처 승인 필요 | `IF-ERP-003`, `IF-ERP-006` 가격 연관 |
| `SCR-CON-001`–`002` | `contract.opportunityPublicId`, `productAmount`, `goodsAmount`, `contractAmount`, `contractName`, `contractType`, `terms`, `erpContractNo`, `status`; 계약 행·특약 | 상태 `DRAFT/ERP_REQUESTED/ERP_APPROVED/ERP_FAILED/CLOSED`; 현 UI 제품/상품 금액만. 행별 금액·계약 상세 필수 ? | 생성·상세·ERP 요청·결과: `/api/contracts`, `/api/erp-results/contract` | `IF-ERP-004`–`005` |
| `SCR-COL-001` | `plan.planVersion`, `installmentNo`, `collectionMethod`, `amount`, `plannedDate`, `adjustmentType`, `isCurrent`, `erpSyncStatus`; `actual.amount`, `collectedAt`, `erpCollectionNo` | 변경유형 `ORIGINAL/SPLIT/ARREARS_REALLOCATION`; 합계·미수 검증은 서버 규칙 대조 필요. 현재 UI는 최초 날짜 중심 | 최초/변경 계획·수금 조회·대사: `/api/contracts/:id/collection-plans`, `/change`, `/collections`, `/reconciliation`; 결과 수신 `/api/erp-results/collections` | `IF-ERP-009`, `011` |
| `SCR-ORD-001`–`002` | `order.contractPublicId`, `items.productPublicId`, `quantity`, `unitPrice`, `stock`, `orderable`, `deliveryType`, `deliveryAddress`, `expressYn`, `lab`, `erpOrderNo`, `status`; 배송/반품 | 수량 현재 UI 최소 1. 유형·검색어 길이·재고 음수·잔액 초과 규칙 ?; 상태 `DRAFT/REQUESTING/ACCEPTED/PROCESSING/COMPLETED/FAILED` | 품목조회·초안·행·배송·요청·납품조회: `/api/order-products`, `/api/orders`; ERP 결과 `/api/erp-fulfillment` | `IF-ERP-006`–`008`, `014` |
| `SCR-LED-001`, `SCR-STM-001` | `accountPublicId`, `contractPublicId`, `from`, `to`, `general`, `selectedRows`; 원장 거래번호·일자·유형·금액 / 조회·파일 | 현 기간 기본값 존재, 2018-01-01 최소일. PDF/Excel 선택 범위·권한 ? | 조회·Excel·PDF: `/api/analytics/accounts/:id/ledger`, `.xlsx`, `/statements`, `/statements/pdf` | `IF-ERP-009`–`010`, `014` 반영 |
| `SCR-ANL-001` | `from`, `to`, 집계 기준·활동/기회/수주/매출/수금 지표 | 기간 기본 공백. 지표 계산식·기준시각 ? | 기간 조회·초기화: `GET /api/analytics/dashboard` | `IF-ERP-009`–`010` |
| `SCR-ADM-001`–`005` | 사용자·조직·역할·권한·범위, 코드 그룹/값, `interfaceLog` 상태·재처리 횟수, `auditLog` 행위·주체·시각 | 수정/승인 권한·PII 마스킹·보존 기간 ? | 현 main에는 `GET /api/users`, `/organizations`, `/common-codes/:group`, `/interface-logs`, `/audit-logs` 중심. 편집·재처리 UI/API 필요 | 전 인터페이스 로그 |
| `HQ-OPS-ENTRY` | `ops.status`, `checkedAt`, 오류/준비 상태 | 새로고침 간격·운영 권한 ? | `GET /api/ops/status`, 화면 새로고침 | 연계 상태 참고 |

## 개별 필드 재고

다음 행은 화면·섹션별 안정 키 후보를 개별로 나눈 것이다. 형식은 현재 UI 또는 공유 DTO의 값 형식이다. `미확인`은 별표 관찰, 실제 필수, 기본값, 전체 선택지 또는 쓰기 권한을 확인하지 못했음을 뜻한다. 표의 `R/W`는 현재 API의 읽기/쓰기 가능성을 가리키며 사용자별 최종 권한은 [화면 권한표](H00-coverage.md#화면별-실행-위치권한장치-조사)와 함께 확인한다. 외부 원천 데이터는 원칙적으로 `R`이다.

| 화면·섹션 | fieldKey / 라벨 | 형식·기본/선택지 | 관찰 필수 / 실행 필수 | 권한·원천·의존 / 근거 |
|---|---|---|---|---|
| 리드 목록 | `lead.search` / 검색 | 텍스트·빈값 | 없음 / 없음 | R·CRM / `LeadsPage` |
| 리드 기본 | `lead.hospitalName` / 병원명 | 텍스트·미확인 | 별표 관찰 / 미확인 | R/W·CRM / 1차 S05·S11, 현 DTO |
| 리드 기본 | `lead.status` / 리드상태 | 선택·`NEW/FIRST_VISIT/KEYMAN_MEETING/CONTACT_EXCLUDED/CONVERTED` | 별표 관찰 / 상태 전이별 미확인 | R/W·CRM / S04·S05, `LeadStatus` |
| 리드 기본 | `lead.ownerUserId` / 소유자 | 사용자 참조·미확인 | 미확인 / 미확인 | R/W는 `LEAD.MANAGE`·CRM / S12 |
| 리드 기본 | `lead.phone` / 전화 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / 현 DTO |
| 리드 기본 | `lead.address` / 주소 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM·심평원 / S07 |
| 리드 기본 | `lead.sido` / 시도 | 텍스트/코드·미확인 | 미확인 / 미확인 | R/W·심평원·지역 배정 의존 / 현 DTO |
| 리드 기본 | `lead.sigungu` / 시군구 | 텍스트/코드·미확인 | 미확인 / 미확인 | R/W·심평원·지역 배정 의존 / 현 DTO |
| 리드 기본 | `lead.businessNo` / 사업자번호 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / 현 DTO |
| 리드 키맨 | `lead.keymanSurname` / 성 | 텍스트·미확인 | 별표 관찰 / 미확인 | R/W·CRM / S05·S11 |
| 리드 키맨 | `lead.keymanType` / 유형 | 선택·전체값 미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanMobile` / 휴대폰 | 전화 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanEmail` / 이메일 | 이메일·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanSchool` / 출신교 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanClassYear` / 기수 | 텍스트/숫자·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanMajor` / 전공 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanNote` / 특이사항 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 제외 | `lead.exclusionReason` / 컨택제외 사유 | 선택·전체값 미확인 | 미확인 / 미확인 | R/W·CRM·제외 상태 의존 / S06 |
| 리드 제외 | `lead.exclusionDetail` / 상세사유 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM·사유 의존 / S06 |
| 리드 제외 | `lead.mapExcluded` / 지도조회제외 | 체크·미확인 | 미확인 / 미확인 | R/W·CRM·지도 노출 의존 / S06 |
| 리드 인입 | `lead.hiraExcluded` / 심평원 연동제외 | 체크·미확인 | 미확인 / 미확인 | R/W 정책 미확인·심평원 / S07 |
| 리드 인입 | `lead.hiraCheckNeeded` / 연동체크 확인필요 | 계산/상태 | 없음 / 없음 | R·심평원/CRM 계산 / S07 |
| 리드 마케팅 | `lead.engagementScore` / 점수 | 숫자·미확인 | 없음 / 없음 | R·외부 마케팅 / S08 |
| 리드 이력 | `lead.history` / 변경내역 | 행·시각/사용자/이전·새값 | 없음 / 없음 | R·CRM 감사 / S09 |
| 리드 전환 | `conversion.accountMode` / 신규·기존 거래처 | 선택·신규/기존 | 미확인 / 미확인 | W·CRM·거래처 참조 / S10 |
| 리드 전환 | `conversion.contactMode` / 신규·기존 연락처 | 선택·신규/기존 | 미확인 / 미확인 | W·CRM·거래처 의존 / S10 |
| 리드 전환 | `conversion.opportunityMode` / 생성·기존·생략 | 선택·3분기 | 미확인 / 미확인 | W·CRM·기회 참조 / S10 |
| 리드 전환 | `conversion.ownerUserId` / 변환 소유자 | 사용자 참조·미확인 | 미확인 / 미확인 | W·CRM / S10 |
| 거래처 관련 | `account.contactName` / 연락처명 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM·거래처 의존 / S15 |
| 거래처 병원 | `account.hospitalSize` / 규모 | 숫자/선택·미확인 | 미확인 / 미확인 | R/W·CRM / S16 |
| 거래처 병원 | `account.mainSystem` / 메인 시스템 | 선택·전체값 미확인 | 미확인 / 미확인 | R/W·CRM / S16 |
| 거래처 병원 | `account.subSystem` / 서브 시스템 | 선택·전체값 미확인 | 미확인 / 미확인 | R/W·CRM / S16 |
| 거래처 병원 | `account.dioProductUsage` / 디오 사용현황 | 선택/표·미확인 | 미확인 / 미확인 | R/W·CRM / S16·S20 |
| 활동 계획 | `activity.relatedType` / 대상 유형 | 선택·`LEAD/ACCOUNT` 현 UI | 없음 / 필수로 보임 | W·CRM·대상 ID 의존 / `ActivitiesPage` |
| 활동 계획 | `activity.relatedPublicId` / 병원 | 참조 선택·빈값 | 현 UI 별표 / HTML required | W·CRM / `ActivitiesPage` |
| 활동 계획 | `activity.plannedAt` / 예정시간 | 날짜시간·오늘 09:00 | 현 UI 별표 / HTML required | W·CRM / `ActivitiesPage` |
| 활동 계획 | `activity.visitPurpose` / 방문목적 | 텍스트·빈값 | 없음 / 미확인 | W·CRM / `ActivitiesPage` |
| 활동 계획 | `activity.directWorkType` / 직출직퇴 | 선택·없음/직출/직퇴 | 없음 / 미확인 | W·CRM·기능 플래그 / `ActivitiesPage` |
| 활동 계획 | `activity.directWorkReason` / 사유 | 텍스트·빈값 | 유형 선택 시 표시 / HTML required | W·CRM·직출 유형 의존 / `ActivitiesPage` |
| 활동 상세 | `activity.status` / 진행 상태 | `PLANNED/IN_PROGRESS/COMPLETED` | 없음 / 전이 규칙 | R/W·CRM / 공유 DTO |
| 활동 상세 | `activity.inAt` / IN 시각 | 날짜시간·없음 | 없음 / GPS 조건 미확인 | R·CRM/GPS / 공유 DTO |
| 활동 상세 | `activity.outAt` / OUT 시각 | 날짜시간·없음 | 없음 / IN 선행 | R·CRM/GPS / 공유 DTO |
| 활동 상세 | `activity.consultation` / 상담내용 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM / `ActivitiesPage` |
| 활동 지도 | `activity.latitude` / 위도 | 숫자·좌표 없을 수 있음 | 없음 / 없음 | R·GPS/심평원 / 지도 API |
| 활동 지도 | `activity.longitude` / 경도 | 숫자·좌표 없을 수 있음 | 없음 / 없음 | R·GPS/심평원 / 지도 API |
| 보고 작성 | `report.date` / 보고일 | 날짜·오늘 | 미확인 / 미확인 | R/W·CRM / `ActivityReportsPage` |
| 보고 작성 | `report.consultationSnapshot` / 활동결과 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM / `ActivityReportsPage` |
| 보고 작성 | `report.futurePlan` / 향후 계획 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM / S22 |
| 보고 승인 | `report.status` / 승인 상태 | `DRAFT/REQUESTED/BRANCH_APPROVED/FINAL_APPROVED` | 없음 / 전이 규칙 | R·CRM / 공유 DTO |
| 보고 승인 | `report.branchComment` / 지점장 의견 | 장문·빈값 | 미확인 / 미확인 | 지점장 W·CRM / S22 |
| 보고 승인 | `report.divisionComment` / 본부장 의견 | 장문·빈값 | 미확인 / 미확인 | 본부장 W·CRM / S22 |
| 보고 승인 | `report.accompaniedYn` / 동행 여부 | 체크·미확인 | 미확인 / 미확인 | 승인자 W 정책 미확인·CRM / S22 |
| 직출직퇴 | `directWork.type` / 유형 | 직출/직퇴 | 미확인 / 미확인 | R/W·CRM / P0 |
| 직출직퇴 | `directWork.reason` / 사유 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM / P0 |
| 직출직퇴 | `directWork.status` / 승인 상태 | 공유 DTO의 6개 상태 | 없음 / 전이 규칙 | R·CRM / 공유 DTO |
| 직출직퇴 | `directWork.comment` / 의견 | 장문·미확인 | 미확인 / 미확인 | 승인자 W·CRM / P0 |
| 직출직퇴 | `directWork.erpStatus` / ERP 상태 | 상태·미확인 | 없음 / 없음 | R·ERP / P0·IF-ERP-013 |
| 기회 기본 | `opportunity.name` / 기회명 | 텍스트·빈값 | 미확인 / 생성 API 확인 필요 | R/W·CRM / `OpportunitiesPage` |
| 기회 기본 | `opportunity.accountPublicId` / 거래처 | 참조 선택·첫 옵션 | 미확인 / 생성 API 확인 필요 | R/W·CRM / 현 UI |
| 기회 기본 | `opportunity.expectedCloseDate` / 마감일 | 날짜·미확인 | 미확인 / 미확인 | R/W·CRM / 공유 DTO·S501 |
| 기회 기본 | `opportunity.stage` / 단계 | 5개 `OpportunityStage` | 미확인 / 상태 전이 | R/W·CRM·ERP 거래처 승인 의존 / 공유 DTO |
| 기회 기본 | `opportunity.successProbability` / 성공확률 | 백분율·미확인 | 미확인 / 미확인 | R/W·CRM / 공유 DTO |
| 기회 기본 | `opportunity.forecastCategory` / 예상 범주 | 4개 `forecast_category` | 미확인 / 미확인 | R/W·CRM / 공유 DTO |
| 기회 기본 | `opportunity.reason` / 단계 사유 | 텍스트·빈값 | 미확인 / 상태별 미확인 | W·CRM / 현 UI |
| 기회 제품 | `opportunity.productPublicId` / 제품 | 참조 선택·첫 옵션 | 미확인 / 미확인 | W·CRM/ERP 품목·기회 의존 / 현 UI |
| 기회 제품 | `opportunity.quantity` / 수량 | 정수·미확인 | 미확인 / 미확인 | W·CRM / S49 |
| 기회 제품 | `opportunity.price` / 단가 | 통화·제품 기준가 | 미확인 / 미확인 | W·CRM/ERP 단가 / 현 UI |
| 계약 기본 | `contract.opportunityPublicId` / 원본 기회 | 참조 선택·첫 옵션 | 미확인 / 미확인 | W·CRM / 현 UI |
| 계약 기본 | `contract.productAmount` / 제품 금액 | 통화·기회 금액 | 교육상 필수 / API 확인 필요 | W·CRM / S503 |
| 계약 기본 | `contract.goodsAmount` / 상품 금액 | 통화·0 | 교육상 필수 / API 확인 필요 | W·CRM / S503 |
| 계약 기본 | `contract.contractAmount` / 계약 금액 | 계산·제품+상품 | 교육상 필수 / 합계 검증 | R·CRM / S503 |
| 계약 기본 | `contract.contractDate` / 계약일자 | 날짜·미확인 | 교육상 필수 / API 확인 필요 | R/W·CRM / S503 |
| 계약 기본 | `contract.contractType` / 계약유형 | 선택·전체값 미확인 | 미확인 / 미확인 | R/W·CRM / S503 |
| 계약 기본 | `contract.terms` / 특약 | 장문·미확인 | 미확인 / 미확인 | R/W·CRM / S503 |
| 계약 ERP | `contract.erpContractNo` / ERP 계약번호 | 식별자·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 계약 ERP | `contract.status` / 계약 상태 | 5개 `ContractStatus` | 없음 / 전이 규칙 | R·CRM/ERP / 공유 DTO |
| 수금계획 | `plan.planVersion` / 버전 | 정수·최초 1 추정 | 없음 / 계산 | R·CRM / 공유 DTO |
| 수금계획 | `plan.installmentNo` / 회차 | 정수·미확인 | 없음 / 행 생성 규칙 | R·CRM / 공유 DTO |
| 수금계획 | `plan.collectionMethod` / 방법 | 선택·전체값 미확인 | 별표 관찰 / 미확인 | R/W·CRM / S511 |
| 수금계획 | `plan.amount` / 금액 | 통화·미확인 | 별표 관찰 / 합계 검증 | R/W·CRM / S511–S514 |
| 수금계획 | `plan.plannedDate` / 일자 | 날짜·미확인 | 별표 관찰 / 미확인 | R/W·CRM / S511–S514 |
| 수금계획 | `plan.adjustmentType` / 조정유형 | `ORIGINAL/SPLIT/ARREARS_REALLOCATION` | 없음 / 상태 의존 | R·CRM / 공유 DTO |
| 수금실적 | `actual.erpCollectionNo` / ERP 수금번호 | 식별자·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 수금실적 | `actual.amount` / 수금액 | 통화·0 | 없음 / 없음 | R·ERP / 공유 DTO |
| 수금실적 | `actual.collectedAt` / 수금일 | 날짜·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 주문 품목 | `order.itemType` / 품목 유형 | `PACKAGE/PRODUCT`·미선택 | 필수 경고 관찰 / 검색 선행 | W·ERP 기준정보 / S517 |
| 주문 품목 | `order.category` / 분류 | 선택·전체값 미확인 | 미확인 / 미확인 | W·ERP 기준정보 / S517 |
| 주문 품목 | `order.search` / 검색어 | 텍스트·빈값 | 교육상 3자 / 미확인 | W·UI / S517 |
| 주문 품목 | `order.productPublicId` / 품목 | 참조 선택·첫 옵션 | 미확인 / 제출 시 필수 | W·ERP 품목 / 현 UI |
| 주문 품목 | `order.quantity` / 수량 | 정수·1 | 미확인 / 현 UI 최소 1 | W·CRM / 현 UI |
| 주문 품목 | `order.unitPrice` / 단가 | 통화·ERP 값 | 없음 / 금액 검증 | R·ERP / 공유 DTO |
| 주문 품목 | `order.stockQty` / 재고 | 정수·ERP 값 | 없음 / 주문 가능 의존 | R·ERP / 공유 DTO |
| 주문 품목 | `order.orderAvailableYn` / 주문 가능 | 불리언·ERP 값 | 없음 / 주문 가능 의존 | R·ERP / 공유 DTO |
| 주문 배송 | `order.deliveryAddressType` / 배송 유형 | `ACCOUNT/DIRECT` 현 UI; 기공소 등 교육 확인 | 교육상 필수 / API 확인 필요 | W·CRM / 현 UI·S519 |
| 주문 배송 | `order.deliveryAddress` / 배송지 | 텍스트·빈값 | 유형 의존 / 미확인 | W·CRM / 현 UI |
| 주문 배송 | `order.lab` / 기공소 | 참조 선택·미확인 | 기공소 직송 시 / 미확인 | W·CRM / S519 |
| 주문 배송 | `order.expressYn` / 특송 | 체크·false | 없음 / 없음 | W·CRM / 현 UI |
| 주문 배송 | `order.note` / 비고 | 장문·미확인 | 미확인 / 미확인 | W·CRM / 공유 DTO |
| 주문 결과 | `order.status` / 주문 상태 | 6개 `OrderStatus` | 없음 / 전이 규칙 | R·CRM/ERP / 공유 DTO |
| 주문 결과 | `order.erpOrderNo` / ERP 주문번호 | 식별자·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 납품 결과 | `delivery.erpDeliveryNo` / 납품번호 | 식별자·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 납품 결과 | `delivery.deliveryStatus` / 납품상태 | 상태·미확인 | 없음 / 없음 | R·ERP / 공유 DTO |
| 매출 결과 | `sales.erpSalesNo` / 매출번호 | 식별자·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 매출 결과 | `sales.amount` / 매출액 | 통화·0 | 없음 / 없음 | R·ERP / 공유 DTO |
| 반품 결과 | `return.transactionType` / 반품·교환 | `RETURN/EXCHANGE` | 없음 / 없음 | R·ERP / 공유 DTO |
| 원장 조건 | `ledger.accountPublicId` / 거래처 | 참조 선택·첫 옵션 | 미확인 / 조회 필수 | R·CRM / 현 UI |
| 원장 조건 | `ledger.contractPublicId` / 계약 | 참조 선택·첫 옵션 | 일반거래 제외 / 조회 조건 | R·CRM / 현 UI |
| 원장 조건 | `ledger.from` / 시작일 | 날짜·기간 기본값 | 미확인 / 최소 2018-01-01 현 UI | R·CRM / 현 UI |
| 원장 조건 | `ledger.to` / 종료일 | 날짜·기간 기본값 | 미확인 / 최소 2018-01-01 현 UI | R·CRM / 현 UI |
| 원장 조건 | `ledger.general` / 일반 거래 | 체크·false | 없음 / 조회 조건 | R·CRM / 현 UI |
| 명세서 | `statement.selectedRows` / 선택 행 | ID 목록·빈값 | 없음 / 출력 범위 미확인 | R·CRM / 현 UI |
| 분석 조건 | `analytics.from` / 시작일 | 날짜·빈값 | 없음 / 없음 | R·CRM / 현 UI |
| 분석 조건 | `analytics.to` / 종료일 | 날짜·빈값 | 없음 / 없음 | R·CRM / 현 UI |
| 관리자 | `admin.userId` / 사용자 | ID·미확인 | 미확인 / 미확인 | R·DB / P0·`USER.READ` |
| 관리자 | `admin.organizationId` / 조직 | ID·미확인 | 미확인 / 미확인 | R·DB / P0·`ORG.READ` |
| 관리자 | `admin.permissionCode` / 권한 | 코드·미확인 | 미확인 / 미확인 | R·DB / P0 |
| 관리자 | `admin.scope` / 조회범위 | `SELF/BRANCH/DIVISION/ALL/SYSTEM` | 미확인 / 미확인 | R·DB / `AuthUser` |
| 관리자 | `admin.commonCode` / 공통코드 | 코드·미확인 | 미확인 / 미확인 | R·DB / P0 |
| 관리자 | `admin.interfaceStatus` / 연계 상태 | 상태·미확인 | 없음 / 없음 | R·DB / `INTERFACE.READ` |
| 관리자 | `admin.auditAt` / 감사 시각 | 날짜시간·미확인 | 없음 / 없음 | R·DB / `AUDIT.READ` |

### 거래처 인터페이스 필드의 개별 원천과 필수성

아래 거래처 25개 행의 입력 형식은 `AccountsPage.renderFieldInput`과 HQ 필드 프로필을 근거로 한다. 기본값·전체 코드 선택지는 `ACCOUNT_TYPE_CODES`/`ERP_TRADE_CODES`/`ERP_APPROVAL_CODES`/`ACCOUNT_STAT_CODES` 이외에는 미확인이다. `IN` 필드의 현 UI 일부가 입력 컨트롤로 보이는 점과 교육자료의 읽기 전용 설명은 권한 결정 전까지 충돌로 남긴다.

이 표의 `필수 송신`은 [코드의 `requiredOut`](../../../packages/contracts/src/account-interface.ts)만 뜻한다. 화면에서 보인 별표와 실제 생성 필수는 별도다. `OUT`은 CRM 작성/심평원 인입 후 ERP 송신, `IN`은 ERP 수신, `DERIVED`는 파생값이다. 형식의 최대 길이·정규식은 `미확인`이다.

| fieldKey (ERP 코드) | 라벨 | CRM 필드 | 방향/원천 | 필수 송신 |
|---|---|---|---|---|
| co_cd | 법인코드 | company_code | DERIVED/CRM | 예 |
| U_Key | 암호화요양기호 | encrypted_provider_no | OUT/심평원 | 예 |
| hosp_nm | 사업자명 | business_name | OUT/CRM·심평원 | 예 |
| biz_no | 사업자번호 | business_no | OUT/CRM | 예 |
| ceo_nm | 대표자명 | ceo_name | OUT/CRM | 예 |
| zip_cd | 우편번호 | zip_code | OUT/CRM·주소 | 예 |
| addr1 | 주소1 | address_line1 | OUT/CRM·주소 | 예 |
| addr2 | 주소2 | address_line2 | OUT/CRM·주소 | 아니오 |
| addr_prt | 병원주소 | hospital_address | OUT/CRM·심평원 | 예 |
| medical_care_no | 요양기관번호 | provider_no | OUT/심평원 | 예 |
| open_dt | 개원일자 | open_date | OUT/심평원 | 예 |
| doctor_no | 의사면허번호 | doctor_license_no | OUT/CRM·심평원 | 아니오 |
| email | 계산서 발행 이메일 | tax_email | OUT/CRM | 예 |
| sal_kd | 거래처유형 | account_type | OUT/CRM | 예 |
| tel | 대표전화 | phone | OUT/CRM | 예 |
| fax | 대표Fax | fax | OUT/CRM | 아니오 |
| homepage | 홈페이지 | homepage | OUT/CRM | 아니오 |
| cust_cd | ERP 거래처코드 | erp_customer_code | IN/ERP | 아니오 |
| cust_nm | 거래처 이름 | account_name | IN/ERP | 아니오 |
| trade_bc | ERP 거래여부 | erp_trade_code | IN/ERP | 아니오 |
| trade_bc_nm | ERP 거래여부명 | 파생 | DERIVED/ERP 코드 | 아니오 |
| use_yn | 사용여부 | use_yn | IN/ERP | 아니오 |
| appr_bc | 승인여부 | erp_approval_code | IN/ERP | 아니오 |
| mgt_yn | 이탈가능 | churn_risk_yn | IN/ERP | 아니오 |
| stat_bc | 거래처 상태코드 | account_stat_code | IN/ERP | 아니오 |

화면별 표시·입력 형식과 기본값: `co_cd`는 파생 표시 `DIO`; `U_Key/hosp_nm/biz_no/ceo_nm/zip_cd/addr1/addr2/addr_prt/medical_care_no/email/tel/fax/homepage/doctor_no`는 현 폼의 텍스트 입력(기본 빈값); `open_dt`는 날짜 입력(기본 빈값); `sal_kd`는 선택(`BC505600` 기본, `BC505800` 가능); `use_yn`은 선택(`1` 기본, `0` 가능); `mgt_yn`은 선택(`0` 기본, `1` 가능); `stat_bc`는 선택(`0` 기본, `1/2/3` 가능). `cust_cd/cust_nm/trade_bc/trade_bc_nm/appr_bc`는 현 폼에서 읽기 전용 표시다. 별도 기본 필드 `accountName`은 텍스트·빈값·HTML required, `accountStatus`는 선택·`ACTIVE` 기본, `accountGrade`는 선택·`GENERAL` 기본이다. 현 HQ 프로필에서 25개 인터페이스 필드는 모두 보이지만 각 `OUT` 항목의 화면 쓰기 가능 여부는 프로필과 폼 구현을 함께 적용해야 한다. 사용자별 읽기·쓰기 권한과 최댓값·정규식은 미확인이다.

## 화면 액션·상태 전이 조사

현재 UI가 없는 액션은 `UI 없음`이라고 적었다. `?`는 성공/실패 응답·다음 화면이 코드/영상에서 확정되지 않은 것이다. API 자체가 있어도 UI 동작을 검증한 것으로 간주하지 않는다.

| 화면·actionKey | 시작 상태·입력 → 요청 | 성공 상태·다음 화면 | 실패/현 차이 |
|---|---|---|---|
| HOME.refresh | 홈·필터 → 집계 조회 | 같은 홈 수치 갱신 | 홈 UI 없음; API 오류 표시 ? |
| LEAD.search | 목록·검색어 → `GET /api/leads` | 필터된 목록 | API 오류 안내 있음 |
| LEAD.open | 목록·리드 ID → `GET /api/leads/:id` | 상세 | UI 없음; API 오류 ? |
| LEAD.create | 목록·병원/키맨 → 생성 | 신규 상세 | UI·생성 API 없음; 입력 오류 ? |
| LEAD.save | 상세·필드 → `PATCH /api/leads/:id` | 저장 상세·History | UI 없음; 권한/필수 오류 ? |
| LEAD.changeStage | 상세·상태 → `POST /api/leads/:id/status` | 새 단계·이력 | UI 없음; 금지 전이 서버 검사 있음 |
| LEAD.assignOwner | 상세·사용자 → `POST /api/leads/:id/assign-owner` | 새 소유자 상세 | UI 없음; 권한/대상 오류 ? |
| LEAD.convert | 상세·신규/기존 대상 → `POST /api/leads/:id/convert` | 거래처·연락처·기회 링크 | UI 없음; 원자성/중복 오류 ? |
| ACC.search/open | 목록·검색/ID → `GET /api/accounts`, `/:id` | 목록/상세 | 요청 오류 안내; 상세 모바일/PC 별도 |
| ACC.create/save | 폼·계정 값 → `POST/PATCH /api/accounts` | 상세/목록 갱신 | 계정명 필수 UI; 행별 오류 보존 확인 필요 |
| ACC.erpRequest | 미승인 계정·필수 송신값 → `POST /api/erp-accounts/:id/request` | `REQUESTING`, 상세/로그 | ERP 필수값 누락 오류; 승인 결과 자동 수신 없음 |
| ACC.merge | 후보 2–3개·주체/필드 → `POST /api/accounts/merge` | 대표 거래처 상세 | UI 없음; 오류/이력 ? |
| ACT.planOne | 대상·일정 → `POST /api/activities/plans` | 계획 목록/캘린더 | HTML 필수 검사, 서버 오류 안내 |
| ACT.planBulk | PC 다건·일정 → `POST /api/activities/plans/bulk` | 다건 계획 목록 | UI 없음; 부분 실패 정책 ? |
| ACT.map | 오늘 활동·위치 → `GET /api/activities/map/today` | 주변 목록/지도 | 지도 시각·좌표 오류 처리 부족 |
| ACT.checkIn | PLANNED·GPS → `POST /api/activities/:id/check-in` | IN_PROGRESS·상세 | 위치/권한 실패 ? |
| ACT.consultation | IN_PROGRESS·상담 → `PATCH /api/activities/:id` | 상세 업데이트 | 입력 보존/오류 ? |
| ACT.checkOut | IN_PROGRESS·GPS → `POST /api/activities/:id/check-out` | COMPLETED·보고 가능 | OUT 선행/실패 ? |
| REP.prepare/edit | 날짜·활동 → `POST /api/activity-reports/prepare`, `PATCH .../items/:id` | DRAFT·작성 화면 | 빈 활동/저장 실패 ? |
| REP.request | DRAFT → `POST .../request-approval` | REQUESTED·승인 목록 | 재요청 금지/권한 오류 ? |
| REP.approveBranch | REQUESTED·의견 → `POST .../approve/branch` | BRANCH_APPROVED·상세 | 의견만 저장/반려 UI 없음 |
| REP.approveDivision | BRANCH_APPROVED·의견 → `POST .../approve/division` | FINAL_APPROVED·상세 | 영상 최종 승인 성공 미확인 |
| DW.request | DRAFT/반려 → `POST /api/direct-work/:id/request-approval` | REQUESTED·목록 | 중복/권한 오류 ? |
| DW.decision | REQUESTED/BRANCH_APPROVED·승인/거부 → decision API | 승인/반려 상태·목록 | 재할당·ERP 결과 UI 없음 |
| OPP.create | 거래처·이름 → `POST /api/opportunities` | 기회 목록/상세 | 필수·중복 오류 ? |
| OPP.stage | 기회·단계/사유 → `POST /api/opportunities/:id/stage` | 새 단계·파이프라인 | ERP 미승인 수주 거부; 입력 보존 확인 필요 |
| OPP.product | 기회·품목/가격 → products POST/PATCH/DELETE | 제품 목록·금액 갱신 | 복수 선택·수량 UI 없음 |
| CON.create | 수주 기회·금액 → `POST /api/contracts` | DRAFT·계약 목록 | 행별 계약·특약 UI 없음 |
| CON.erpRequest | DRAFT·최초 계획 → `POST /api/contracts/:id/erp-request` | ERP_REQUESTED·계약 상세 | 승인 결과는 별도; 중복·실패 ? |
| COL.planOriginal | 계약·회차/금액/일자 → collection-plans POST | 원본 계획·재조회 | 합계 불일치/입력 보존 ? |
| COL.planChange | 승인 계약·변경/분할 → collection-plans/change POST | 변경 계획·ERP 전송 상태 | UI 없음; 잘못된 합계 거부 필요 |
| ORD.catalog | 승인 계약·검색/분류 → `GET /api/order-products` | ERP 품목·단가·재고 | 분류/검색 UI 부족; 0재고 규칙 ? |
| ORD.draft/items | 승인 계약·품목/수량 → orders POST/items POST/DELETE | 초안/장바구니 | 주문불가·잔액 오류 ? |
| ORD.delivery | 초안·유형/주소 → `PATCH /api/orders/:id/delivery` | 배송정보 저장 | 기공소 종속 유형 UI 없음 |
| ORD.submit | 초안·배송정보 → `POST /api/orders/:id/submit` | REQUESTING·납품현황 | ERP 성공/실패는 별도 결과; 중복 제출 금지 필요 |
| FUL.open | 주문 ID → `GET /api/orders/:id/fulfillment` | 납품·매출·반품 상세 | 결과 없는 상태/오류 ? |
| LED.search/export | 거래처·계약·기간 → ledger GET/xlsx | 원장 행/Excel 파일 | 0건/내보내기 오류 ? |
| STM.search/export | 거래처·계약·기간 → statements GET/pdf POST | 명세서 행/PDF 파일 | 모바일 선택 행 제한·0건 오류 ? |
| ANL.search | 기간 → `GET /api/analytics/dashboard` | 집계 위젯 갱신 | 기준시각/집계식 ? |
| ADM.read/edit | 관리자 검색·수정 → users/org/code/interface/audit API | 목록·수정 결과 | 현 main에는 읽기 API 일부만, 편집/재처리 UI 없음 |
| OPS.refresh | `/ops` → `GET /api/ops/status` | 운영 상태 갱신 | 요청 오류 표시 |

ERP 수신 `IF-ERP-003/005/008/009/010/013/014`의 성공·실패는 각각 해당 원천 데이터와 `InterfaceLog`를 갱신하는 별도 이벤트로 취급한다. 현재 실제 ERP endpoint·응답 형식·재시도 정책은 [인터페이스 카탈로그 §6](../../../spec/interfaces/P0-07_interface_catalog.md)에 `미확정`이다.

## 인터페이스별 화면·결과 대응

| IF | 입력/수신 화면 | 결과 상태·데이터 | 현 구현 조사 |
|---|---|---|---|
| IF-HIRA-001 | 리드·거래처 인입 | Lead/Account 병원 정보 갱신 | `/api/integrations/hira/hospitals/import` 존재 |
| IF-ERP-001 | 리드 배정 | 지역 담당자·소유자 | 화면 연동 미확인 |
| IF-ERP-002 | 거래처 ERP 요청 | 요청중·로그 | 요청 API/버튼 존재 |
| IF-ERP-003 | 거래처 상세·기회 | ERP 거래처코드·승인·수주 가능 | 결과 API 존재, 화면 자동 반영 미확인 |
| IF-ERP-004 | 계약 상세 | 계약 요청중·로그 | 요청 API/버튼 존재 |
| IF-ERP-005 | 계약·주문 | ERP 계약번호·승인·주문 가능 | 결과 API 존재, 화면 자동 반영 미확인 |
| IF-ERP-006 | 기회 제품·주문 품목 | 품목·단가·재고·주문가능 | 상품조회 API 존재, 실제 조회 원천 미확인 |
| IF-ERP-007 | 주문 | 요청중·로그 | 주문 제출 API/버튼 존재 |
| IF-ERP-008 | 주문·납품현황 | ERP 주문번호·출고·납품 | 결과 API 존재, 화면 연동 일부 |
| IF-ERP-009 | 계약 수금·원장·분석 | 수금 행·잔여 미수 | 결과 API 존재 |
| IF-ERP-010 | 납품·원장·분석 | 매출 행·합계 | 결과 API 존재 |
| IF-ERP-011 | 수금계획 | 변경계획 전송·동기화 상태 | 변경 API 존재, ERP 송신 확인 필요 |
| IF-ERP-012 | 직출직퇴 | 전송요청·로그 | 업무 승인 API 존재, ERP 송신 확인 필요 |
| IF-ERP-013 | 직출직퇴 | ERP 승인/연계 상태 | 결과 화면/API 확인 필요 |
| IF-ERP-014 | 납품·반품 | 반품/교환 행·원장 | 결과 API 존재, 화면 범위 확인 필요 |

## 액션 계약 조사 원칙

각 단계 구현 시 `시작 상태 → 입력 → 요청 → 성공/실패 → 새 상태 → 다음 화면`을 위 표의 액션별로 채운다. 현재 API가 있다는 이유만으로 화면 액션을 `충족`으로 판정하지 않는다. 인증 실패·필드 오류 시 입력 보존, 목록/상세 동기화, 직접 API 접근 제한은 H03–H07의 검증 항목이다. 출처가 없는 권한·필수·잠금·계산 규칙은 본사 운영 정책으로 확정하지 않고 `미확인` 또는 실행 가능한 `설계 가정`으로 기록한다.
