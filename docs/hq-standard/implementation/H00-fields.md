# H00 필드·액션·연계 조사

기준: [화면 카탈로그](../../../spec/screens/P0-08_screen_menu_catalog.md), [ERP/심평원 인터페이스](../../../spec/interfaces/P0-07_interface_catalog.md), [공유 DTO](../../../packages/contracts/src/index.ts), [거래처 필드 계약](../../../packages/contracts/src/account-interface.ts), `frontend/src/*Page.tsx`, `backend/src/modules/*/*.controller.ts` 및 해당 service/rules다. 아래 키는 **현 코드 필드명 또는 H01에서 부여할 안정 키 후보**다. `?`는 교육 분석문서와 코드로 확정하지 못한 속성이며, 이미 코드에 있는 실행 규칙은 아래에 따로 명시했다. 별표 관찰과 서버 필수 규칙은 동일하다고 간주하지 않는다. 이번 보완은 저장소 문서·코드 대조이며 원본 교육영상 재검증이 아니다.

| 화면 묶음 | 필드 키 / 섹션·형식·원천 | 확인된 필수·기본·선택지 / 미확인 | 액션과 현재 API | 연계 |
|---|---|---|---|---|
| `SCR-HOME-001` | `home.newLeadCount`, `home.todayActivityCount`, `home.pipelineAmount`, `home.pendingApprovalCount` / 위젯·숫자·CRM 집계 | 집계 시각/범위 ?; 현 `/`는 리드 | 위젯 조회·새로고침·상세 이동: 홈 API 없음, analytics API 일부 | 없음 |
| `SCR-LEAD-001`–`003` | `lead.hospitalName`, `status`, `ownerUserId`, `phone`, `address`, `sido`, `sigungu`, `businessNo`; 키맨 성/유형/전화, 규모, 시스템, 심평원 정보, 컨택제외 사유, History / 텍스트·선택·날짜 | 단계 `NEW/FIRST_VISIT/KEYMAN_MEETING/CONTACT_EXCLUDED/CONVERTED`. PATCH 병원명은 제공 시 1자 이상; 소유자 변경은 양의 정수 ID. 나머지 API 필드·후보와 전환 조건은 아래 분리 | 검색·상세·수정·상태·소유자·전환: `GET/PATCH/POST /api/leads`; Account 신규/기존만 현 전환 API 지원, Contact/Opportunity 선택 분기는 H03 확장 | `IF-HIRA-001`, `IF-ERP-001` |
| `SCR-ACC-001`–`004` | `account.accountName`, `accountStatus`, `accountGrade`, `businessNo`, `providerNo`, `encryptedProviderNo`, `address*`, `ownerUserId`, `erpCustomerCode`, `erpApprovedYn`, `integrationStatus`; 아래 거래처 인터페이스 25개 항목 참조 | 생성 `accountName`은 trim 후 1–300자 필수. ERP 검증 13개 `requiredOut`과 실제 송신 payload는 다름. ERP 원천 읽기 전용은 목표 정책이며 현재 `cust_nm` 등 일부 편집 가능. 중복 `ACCOUNT.READ`, 병합 `ACCOUNT.MERGE` | 목록·생성·수정·중복조회·병합·ERP 요청: `GET/POST/PATCH /api/accounts`, `/api/erp-accounts/:id/request`; 승인 수신 API는 UI 연결 미완료 | `IF-HIRA-001`은 Account 갱신 미지원, `IF-ERP-002`–`003` |
| `SCR-ACT-001`–`004`, `SCR-CAL-001` | `activity.relatedType`, `relatedPublicId`, `plannedAt`, `visitPurpose`, `directWorkType`, `directWorkReason`, `status`, `inAt`, `outAt`, `consultation`; 위치 좌표 / 선택·날짜시간·텍스트·GPS | 현 계획 폼 `relatedPublicId`,`plannedAt` 필수, 직출 유형 선택 시 사유 필수. 좌표 정확도·GPS 거부 정책 ? | 단건/다건 등록·캘린더·지도·IN/OUT·상담: `/api/activities/plans`, `/plans/bulk`, `/calendar`, `/map/today`, `/:id/check-in`, `/:id/check-out`, `PATCH /:id` | `IF-ERP-012`–`013` 연관 |
| `SCR-REP-001`–`003` | `report.date`, `items.consultationSnapshot`, `futurePlan`, `status`, `branchComment`, `divisionComment`, `accompaniedYn` / 날짜·텍스트·선택 | 현 상태 `DRAFT/REQUESTED/BRANCH_APPROVED/FINAL_APPROVED`; 반려·의견만 저장·최종 필수 ? | 준비·항목수정·승인요청·지점/본부 승인: `/api/activity-reports` 하위. 현재 상세와 목록 구분 부족 | 없음 |
| `SCR-DW-001`–`002` | `directWork.type`, `reason`, `activityPublicId`, `status`, `approver`, `comment`, `erpStatus` / 선택·텍스트 | 현 상태 `DRAFT/REQUESTED/BRANCH_APPROVED/DIVISION_APPROVED/BRANCH_REJECTED/DIVISION_REJECTED`; 재할당·코멘트 필수 ? | 신청·지점/본부 결정: `/api/direct-work`; ERP 결과 UI 미연결 | `IF-ERP-012`–`013` |
| `SCR-OPP-001`–`003` | `opportunity.name`, `accountPublicId`, `expectedCloseDate`, `stage`, `successProbability`, `forecastCategory`, `reason`, `products.productPublicId`, `quantity`, `price`, `amount`; 니즈/제안/협상 섹션 | 단계 `NEEDS_ANALYSIS/PROPOSAL/NEGOTIATION/CLOSED_WON/CLOSED_LOST`; 생성 이름 1–200자·거래처 UUID 필수, 확률 0–100, 수량 1–9999 정수, 단가 0 이상. 현 협상 UI는 고정 샘플 저장 | 생성·상세·단계·협상·제품 추가/수정/삭제: `/api/opportunities`, `/api/product-packages`; 수주 시 ERP 거래처 승인 필요 | `IF-ERP-003`, `IF-ERP-006` 가격 연관 |
| `SCR-CON-001`–`002` | `contract.opportunityPublicId`, `productAmount`, `goodsAmount`, `contractAmount`, `contractName`, `contractType`, `terms`, `erpContractNo`, `status`; 계약 행·특약 | 상태 `DRAFT/ERP_REQUESTED/ERP_APPROVED/ERP_FAILED/CLOSED`; 원본 기회 UUID 및 제품/상품 금액 중 하나 필수, 합계는 기회 금액과 일치. 계약유형은 미지원 후보, 특약 API는 `specialTerms` | 생성·상세·ERP 요청·결과: `/api/contracts`, `/api/erp-results/contract` | `IF-ERP-004`–`005` |
| `SCR-COL-001` | `plan.planVersion`, `installmentNo`, `collectionMethod`, `amount`, `plannedDate`, `adjustmentType`, `isCurrent`, `erpSyncStatus`; `actual.amount`, `collectedAt`, `erpCollectionNo` | DTO `ORIGINAL/SPLIT/ARREARS_REALLOCATION`; 현 생성은 ORIGINAL, 변경은 ARREARS_REALLOCATION. 1–60행·양수 금액, 최초 합계=계약금액, 변경 합계=잔여미수. 잠금 조건은 아래 실행 규칙 참조 | 최초/변경 계획·수금 조회·대사: `/api/contracts/:id/collection-plans`, `/change`, `/collections`, `/reconciliation`; 결과 수신 `/api/erp-results/collections` | `IF-ERP-009`, `011` |
| `SCR-ORD-001`–`002` | `order.contractPublicId`, `items.productPublicId`, `quantity`, `unitPrice`, `stock`, `orderable`, `deliveryType`, `deliveryAddress`, `expressYn`, `lab`, `erpOrderNo`, `status`; 배송/반품 | 수량 현재 UI 최소 1. 유형·검색어 길이·재고 음수·잔액 초과 규칙 ?; 상태 `DRAFT/REQUESTING/ACCEPTED/PROCESSING/COMPLETED/FAILED` | 품목조회·초안·행·배송·요청·납품조회: `/api/order-products`, `/api/orders`; ERP 결과 `/api/erp-fulfillment` | `IF-ERP-006`–`008`, `014` |
| `SCR-LED-001`, `SCR-STM-001` | `accountPublicId`, `contractPublicId`, `from`, `to`, `general`, `selectedRows`; 원장 거래번호·일자·유형·금액 / 조회·파일 | 현 기간 기본값 존재, 2018-01-01 최소일. PDF/Excel 선택 범위·권한 ? | 조회·Excel·PDF: `/api/analytics/accounts/:id/ledger`, `.xlsx`, `/statements`, `/statements/pdf` | `IF-ERP-009`–`010`, `014` 반영 |
| `SCR-ANL-001` | `from`, `to`, 집계 기준·활동/기회/수주/매출/수금 지표 | 기간 기본 공백. 지표 계산식·기준시각 ? | 기간 조회·초기화: `GET /api/analytics/dashboard` | `IF-ERP-009`–`010` |
| `SCR-ADM-001`–`005` | 사용자·조직·역할·권한·범위, 코드 그룹/값, `interfaceLog` 상태·재처리 횟수, `auditLog` 행위·주체·시각 | 수정/승인 권한·PII 마스킹·보존 기간 ? | 현 main에는 `GET /api/users`, `/organizations`, `/common-codes/:group`, `/interface-logs`, `/audit-logs` 중심. 편집·재처리 UI/API 필요 | 전 인터페이스 로그 |
| `HQ-OPS-ENTRY` | `ops.status`, `checkedAt`, 오류/준비 상태 | 새로고침 간격·운영 권한 ? | `GET /api/ops/status`, 화면 새로고침 | 연계 상태 참고 |

## 개별 필드 재고

다음 행은 화면·섹션별 안정 키 후보를 개별로 나눈 것이다. 형식은 현재 UI·공유 DTO 또는 교육 분석의 요구 형식이다. `미확인`은 해당 속성을 확정하지 못했다는 뜻이다. `R/W`는 읽기/쓰기 방향을 나타내되 **현재 API 지원이 확인된 항목과 목표 후보를 구분**한다. `미지원 후보`는 등록부의 요구 목록에만 보존하며 현재 API payload에 그대로 보내지 않는다. API 이름이 다른 안정 키는 아래 매핑표로 연결한다. API/DB 근거 없는 교육/P0 요구 행은 현재 지원으로 간주하지 않는다. 사용자별 권한은 [화면 권한표](H00-coverage.md#화면별-실행-위치권한장치-조사)와 대조한다. 외부 원천 데이터의 읽기 전용은 목표 정책이며 현 구현과의 충돌을 별도 기록한다.

| 화면·섹션 | fieldKey / 라벨 | 형식·기본/선택지 | 관찰 필수 / 실행 필수 | 권한·원천·의존 / 근거 |
|---|---|---|---|---|
| 리드 목록 | `lead.search` / 검색 | 텍스트·빈값 | 없음 / 없음 | R·CRM / `LeadsPage` |
| 리드 기본 | `lead.hospitalName` / 병원명 | 텍스트·미확인 | 별표 관찰 / PATCH 제공 시 1자 이상, API 최대 길이 없음 | 현 R/W·CRM / S05·S11, `updateLeadSchema` |
| 리드 기본 | `lead.status` / 리드상태 | 선택·`NEW/FIRST_VISIT/KEYMAN_MEETING/CONTACT_EXCLUDED/CONVERTED` | 별표 관찰 / `toStatus` 필수, 역방향은 권한·사유 필요 | 현 상태 API R/W·CRM / S04·S05, `customer.rules` |
| 리드 기본 | `lead.ownerUserId` / 소유자 | 사용자 참조·미확인 | 미확인 / 변경 요청은 양의 정수 ID 필수 | 현 소유자 API R/W·`LEAD.MANAGE`·CRM / S12 |
| 리드 기본 | `lead.phone` / 전화 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / 현 DTO |
| 리드 기본 | `lead.address` / 주소 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM·심평원 / S07 |
| 리드 기본 | `lead.sido` / 시도 | 텍스트/코드·미확인 | 미확인 / HIRA 인입 선택값 | 현 R·HIRA 인입으로만 갱신; 수동 PATCH 미지원 / `importHira` |
| 리드 기본 | `lead.sigungu` / 시군구 | 텍스트/코드·미확인 | 미확인 / HIRA 인입 선택값 | 현 R·HIRA 인입으로만 갱신; 수동 PATCH 미지원 / `importHira` |
| 리드 기본 | `lead.businessNo` / 사업자번호 | 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / 현 DTO |
| 리드 키맨 | `lead.keymanSurname` / 성 | 텍스트·미확인 | 별표 관찰 / 현 `keymanName`은 nullable·선택 | 후보 키; 현 API `keymanName`/DB `keyman_name`은 이름이며 성 분리 아님 / S05·S11·H03 |
| 리드 키맨 | `lead.keymanType` / 유형 | 선택·전체값 미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanMobile` / 휴대폰 | 전화 텍스트·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanEmail` / 이메일 | 이메일·미확인 | 미확인 / 미확인 | R/W·CRM / S05 |
| 리드 키맨 | `lead.keymanSchool` / 출신교 | 텍스트·미확인 | 미확인 / nullable·선택 | 현 R/W, API `school`/DB `school` / S05 |
| 리드 키맨 | `lead.keymanClassYear` / 기수 | 텍스트·미확인 | 미확인 / nullable·선택 | 현 R/W, API `cohort`/DB `cohort` / S05 |
| 리드 키맨 | `lead.keymanMajor` / 전공 | 텍스트·미확인 | 미확인 / nullable·선택 | 현 R/W, API `major`/DB `major` / S05 |
| 리드 키맨 | `lead.keymanNote` / 특이사항 | 장문·미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 W, 현 PATCH/DB 매핑 없음 / S05·H03 |
| 리드 병원 | `lead.mainSystem` / 메인 시스템 | 텍스트·미확인 | 미확인 / nullable·선택 | 현 R/W, API `mainSystem`/DB `main_system` |
| 리드 병원 | `lead.subSystem` / 서브 시스템 | 텍스트·미확인 | 미확인 / nullable·선택 | 현 R/W, API `subSystem`/DB `sub_system` |
| 리드 제외 | `lead.exclusionReason` / 컨택제외 사유 | 텍스트·코드 선택지 미확인 | 미확인 / PATCH nullable·선택 | 현 R/W, API `contactExcludeReason`/DB `contact_exclude_reason`; 상태 API `reason`도 사용 / S06 |
| 리드 제외 | `lead.exclusionDetail` / 상세사유 | 장문·미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 W, 별도 PATCH/DB 매핑 없음 / S06·H03 |
| 리드 제외 | `lead.mapExcluded` / 지도조회제외 | 체크·미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 W, PATCH/DB 매핑 없음 / S06·H03 |
| 리드 인입 | `lead.hiraExcluded` / 심평원 연동제외 | 체크·DB 기본 false | 미확인 / 수동 변경 API 없음 | 현 상세 DB `hira_sync_exclude_yn` R, import 시 제외 조건만 적용; 목표 W는 H03 |
| 리드 인입 | `lead.hiraCheckNeeded` / 연동체크 확인필요 | 계산/상태 | 없음 / 현 계산 계약 없음 | 미지원 후보·목표 R, 계산/응답 경로 미확인 / S07·H03 |
| 리드 마케팅 | `lead.engagementScore` / 점수 | 숫자·미확인 | 없음 / 현 실행 계약 없음 | 미지원 후보·목표 R, 현재 조회 원천 미확인 / S08·H03 |
| 리드 이력 | `lead.history` / 변경내역 | 행·시각/사용자/이전·새값 | 없음 / 없음 | 목표 R; 현 상태/전환 이력 저장은 있으나 getLead는 단일 DB 행, 상세 이력 응답 연결 필요 / S09·H03 |
| 리드 전환 | `conversion.accountMode` / 신규·기존 거래처 | 선택·`NEW/EXISTING` | 미확인 / 필수, EXISTING이면 기존 거래처 UUID 필요 | 현 W, API `accountMode`·`existingAccountPublicId` / S10 |
| 리드 전환 | `conversion.contactMode` / 신규·기존 연락처 | 선택·신규/기존 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 W; 현 keyman_name 있으면 신규 Contact만 생성 / S10·H03 |
| 리드 전환 | `conversion.opportunityMode` / 생성·기존·생략 | 선택·3분기 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 W; 현 항상 신규 Opportunity 생성 / S10·H03 |
| 리드 전환 | `conversion.ownerUserId` / 변환 소유자 | 사용자 참조·미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 W; 현 신규 Account/Opportunity는 Lead 소유자 승계 / S10·H03 |
| 거래처 관련 | `account.contactName` / 연락처명 | 텍스트·미확인 | 미확인 / 독립 연락처 작성 계약 없음 | 미지원 후보·목표 R/W; 현재 전환 시 Contact 생성과 별개 / S15·H03 |
| 거래처 병원 | `account.hospitalSize` / 규모 | 숫자/선택·미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 R/W; Account 쓰기 API/DB 갱신 매핑 없음 / S16·H03 |
| 거래처 병원 | `account.mainSystem` / 메인 시스템 | 선택·전체값 미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 R/W; Lead 동명 API와 구분 / S16·H03 |
| 거래처 병원 | `account.subSystem` / 서브 시스템 | 선택·전체값 미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 R/W; Lead 동명 API와 구분 / S16·H03 |
| 거래처 병원 | `account.dioProductUsage` / 디오 사용현황 | 선택/표·미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보·목표 R/W; Account 쓰기 API/DB 갱신 매핑 없음 / S16·S20·H03 |
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
| 기회 기본 | `opportunity.name` / 기회명 | 텍스트·빈값 | 미확인 / 생성 필수 1–200자, 수정 시 선택 | 현 R/W·API `opportunityName`·DB `opportunity_name` |
| 기회 기본 | `opportunity.accountPublicId` / 거래처 | 참조 선택·첫 옵션 | 미확인 / 생성 필수 UUID | 현 생성 W·조회 R, PATCH 거래처 변경 미지원 |
| 기회 기본 | `opportunity.expectedCloseDate` / 마감일 | 날짜·미확인 | 미확인 / 생성 선택 string, 수정 nullable·선택; API 날짜 정규식 없음 | 현 R/W·CRM / `opportunity.controller`·S501 |
| 기회 기본 | `opportunity.stage` / 단계 | 5개 `OpportunityStage` | 미확인 / 상태 전이 | R/W·CRM·ERP 거래처 승인 의존 / 공유 DTO |
| 기회 기본 | `opportunity.successProbability` / 성공확률 | 숫자·0–100 | 미확인 / nullable·선택 | 현 R/W·CRM / `updateOpportunitySchema` |
| 기회 기본 | `opportunity.forecastCategory` / 예상 범주 | `PIPELINE/BEST_CASE/COMMIT/OMITTED` | 미확인 / nullable·선택 | 현 R/W·CRM / `updateOpportunitySchema` |
| 기회 기본 | `opportunity.reason` / 단계 사유 | 텍스트·빈값 | 미확인 / 최대 1000자; 역전이·재오픈 시 trim 비공백 필수 | 현 W·CRM / `opportunity.rules` |
| 기회 제품 | `opportunity.productPublicId` / 제품 | 참조 선택·첫 옵션 | 미확인 / 추가 시 `packagePublicId` UUID 필수 | 현 W·API 명칭/제품행 ID 구분 / 현 UI |
| 기회 제품 | `opportunity.quantity` / 수량 | 정수·추가 기본 1 | 미확인 / 1–9999 정수; 수정은 선택 | 현 W·CRM / `add/updateProductSchema`·S49 |
| 기회 제품 | `opportunity.price` / 단가 | 통화·제품 기준가 | 미확인 / 추가 시 0 이상 필수, 수정 선택 | 현 W·API `proposedUnitPrice` / 현 UI |
| 계약 기본 | `contract.opportunityPublicId` / 원본 기회 | 참조 선택·첫 옵션 | 미확인 / 생성 필수 UUID, 수주·ERP 거래처 승인·미생성·제품 1개 이상 | 현 생성 W·CRM / `contractCreate`·rules |
| 계약 기본 | `contract.productAmount` / 제품 금액 | 통화·미제공 시 기회금액−상품금액(하한 0) | 교육상 필수 / 0 이상, 제품/상품 중 적어도 하나 필수 | 현 생성 W·CRM / `contractCreate`·service·S503 |
| 계약 기본 | `contract.goodsAmount` / 상품 금액 | 통화·미제공 시 기회금액−제품금액(하한 0) | 교육상 필수 / 0 이상, 제품/상품 중 적어도 하나 필수 | 현 생성 W·CRM / `contractCreate`·service·S503 |
| 계약 기본 | `contract.contractAmount` / 계약 금액 | 기회 금액을 복사 | 교육상 필수 / 제품+상품 합계와 기회 금액 차이 절댓값 0.005 미만 | 현 R·서버 계산 / `sameMoney`·S503 |
| 계약 기본 | `contract.contractDate` / 계약일자 | 날짜 문자열·미제공 null | 교육상 필수 / 생성 API 선택 string, 날짜 정규식 없음 | 현 생성 W·조회 R; 별도 계약 PATCH 없음 / S503 |
| 계약 기본 | `contract.contractType` / 계약유형 | 선택·전체값 미확인 | 미확인 / 현 실행 계약 없음 | 미지원 후보; `packageClassification`과 같은 뜻으로 확정하지 않음 / S503·H05 |
| 계약 기본 | `contract.terms` / 특약 | 장문·미제공 시 기회 특약 승계 | 미확인 / 생성 선택, 최대 4000자 | 현 생성 W·조회 R, API `specialTerms` / S503 |
| 계약 ERP | `contract.erpContractNo` / ERP 계약번호 | 식별자·없음 | 없음 / 없음 | R·ERP / 공유 DTO |
| 계약 ERP | `contract.status` / 계약 상태 | 5개 `ContractStatus` | 없음 / 전이 규칙 | R·CRM/ERP / 공유 DTO |
| 수금계획 | `plan.planVersion` / 버전 | 정수·최초 1, 변경은 MAX+1 | 없음 / 서버 계산 | 현 R·CRM / `replaceInitialPlan/changePlan` |
| 수금계획 | `plan.installmentNo` / 회차 | 양의 정수 | 없음 / 각 행 필수 | 현 R/W·API `installmentNo` / `collectionPlanRow` |
| 수금계획 | `plan.collectionMethod` / 방법 | 텍스트·업무 코드 선택지 미확인 | 별표 관찰 / 각 행 필수 1–100자 | 현 R/W·CRM / `collectionPlanRow`·S511 |
| 수금계획 | `plan.amount` / 금액 | 양수 금액 | 별표 관찰 / 각 행 필수, 유한 양수·전체 합계 검증 | 현 R/W·CRM / rules·S511–S514 |
| 수금계획 | `plan.plannedDate` / 일자 | 날짜 문자열 | 별표 관찰 / 각 행 필수 8–30자; API 날짜 정규식 없음 | 현 R/W·CRM / `collectionPlanRow`·S511–S514 |
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

### 현재 API와 안정 키·목표 정책의 경계

H01은 아래 구분을 등록부에 보존하고 현재 API 지원을 새로 구현한 것으로 표시하지 않는다. 후보 필드를 payload에 추가하는 것만으로 지원된다고 간주하지 않으며 H02 저장소/어댑터와 해당 업무 단계에서 구현·검증한다.

| 안정 키·업무 | 현재 요청/DB 매핑과 지원 상태 | 목표 정책·후속 단계 |
|---|---|---|
| Lead 기본·키맨 | PATCH 허용 키는 `hospitalName→hospital_name`, `phone→phone`, `address→address`, `businessNo→business_no`, `keymanName→keyman_name`, `keymanType→keyman_type`, `keymanMobile→keyman_mobile`, `keymanEmail→keyman_email`, `school→school`, `cohort→cohort`, `major→major`, `mainSystem→main_system`, `subSystem→sub_system`, `contactExcludeReason→contact_exclude_reason`이다. `hospitalName` 외 항목은 nullable·선택 string; controller에 최대 길이·이메일 정규식은 없다. | `keymanSurname/School/ClassYear/Major/exclusionReason`은 그대로 전송하는 API 키가 아니다. 이름/성 의미 차이는 H03에서 해결; 기존 필드의 DB 제약과 UI 검증도 별도로 대조 |
| Lead 미지원 후보 | `keymanNote`, `exclusionDetail`, `mapExcluded`는 위 PATCH schema와 서비스 허용 매핑에 없다. `hiraCheckNeeded`, `engagementScore`도 현재 계산/조회 계약을 확인하지 못했다. | 교육 분석 요구를 삭제하지 않고 H03 확장 대상으로 보존; 근거 없는 R/W·계산식 확정 금지 |
| HIRA 원천 | `sido/sigungu`는 import에서 갱신되지만 일반 Lead PATCH에는 없다. 상세의 `hira_sync_exclude_yn`은 인입 제외 조건에 사용되며 수동 변경 API는 없다. | H02 인입/목업 경계, H03 원천·수동 수정 정책 |
| Lead 전환 | 현재 요청은 `accountMode`, `existingAccountPublicId`, `opportunityName`뿐. 신규 Contact는 `keyman_name`이 있을 때만 만들고 신규 Opportunity는 항상 생성한다. 신규 Account와 Opportunity는 Lead 소유자를 사용한다. | `contactMode/opportunityMode/ownerUserId`는 현재 미지원. 기존 연락처·기회 연결/기회 생략·소유자 선택은 H03 확장 및 원자성 테스트 대상 |
| Account 병원현황·연락처 | `hospitalSize/mainSystem/subSystem/dioProductUsage/contactName`은 Account 쓰기 schema/서비스 매핑에 없다. Lead의 `mainSystem/subSystem` 지원을 Account 지원으로 전용하지 않는다. | H03 병원현황·연락처 모델/저장·관련 목록 구현 |
| ERP 수신 이름 `cust_nm` | 계약상 `account_name`이고 `CRM_FORM_KEY.account_name=accountName`; `AccountsPage.fieldInput(field,false)`는 현재 편집 가능, Account POST/PATCH도 저장한다. | ERP 원천 읽기 전용 목표와 현재 편집 가능 구현의 차이를 H03에서 정책으로 해소; H01이 조용히 읽기 전용으로 단정하지 않음 |
| ERP 수신 관리값 | `useYn/churnRiskYn/accountStatCode`는 현재 폼·서비스에서 쓸 수 있다. `erpTradeCode/erpApprovalCode`는 schema에는 있으나 `accountWriteValues`/INSERT·UPDATE에 없어 일반 쓰기로 저장되지 않는다. | 현재 수용 schema·실제 영속·목표 원천권한을 각각 유지, H03 정책·API 일치 검증 |

### 거래처 인터페이스 필드의 개별 원천과 필수성

아래 거래처 25개 행의 입력 형식은 `AccountsPage.fieldInput`과 HQ 필드 프로필을 근거로 한다. 기본값·전체 코드 선택지는 `ACCOUNT_TYPE_CODES`/`ERP_TRADE_CODES`/`ERP_APPROVAL_CODES`/`ACCOUNT_STAT_CODES` 이외에는 미확인이다. `IN` 필드의 현 UI 일부가 입력 컨트롤인 사실과 교육 분석/작업지시서의 읽기 전용 목표는 권한 결정 전까지 충돌로 남긴다.

이 표의 `필수 송신`은 [코드의 `requiredOut`](../../../packages/contracts/src/account-interface.ts)만 뜻하며 **현 송신 payload에 13개가 모두 들어간다는 뜻이 아니다**. 화면 별표·실제 생성 필수도 별도다. `OUT`은 CRM 작성/심평원 인입 후 ERP 송신이라는 계약 방향, `IN`은 ERP 수신, `DERIVED`는 파생값이다. 현재 API 길이는 아래 실행 규칙에 기록했고, 코드에 없는 업무 정규식은 미확인으로 남긴다.

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

화면별 표시·입력 형식과 기본값: `co_cd`는 파생 표시 `DIO`; `U_Key/hosp_nm/biz_no/ceo_nm/zip_cd/addr1/addr2/addr_prt/medical_care_no/email/tel/fax/homepage/doctor_no`는 현 폼의 텍스트 입력(기본 빈값); `open_dt`는 날짜 입력(기본 빈값); `sal_kd`는 선택(`BC505600` 기본, `BC505800` 가능); `use_yn`은 선택(`1` 기본, `0` 가능); `mgt_yn`은 선택(`0` 기본, `1` 가능); `stat_bc`는 선택(`0` 기본, `1/2/3` 가능). `cust_cd/trade_bc/trade_bc_nm/appr_bc`는 현 폼에서 읽기 전용이다. **`cust_nm`은 `accountName`에 연결되어 현재 편집 가능**하다. 별도 기본 필드 `accountName`은 텍스트·빈값·HTML required, `accountStatus`는 선택·`ACTIVE` 기본, `accountGrade`는 선택·`GENERAL` 기본이다. 현 HQ 프로필에서 25개 인터페이스 필드는 모두 보이지만 필드 표시와 실제 API 저장은 별도다. 현재 생성/수정 API 권한과 최대 길이는 아래와 같으며 본사 운영 권한의 최종 확정·업무 정규식은 별도 검증 대상이다.

### 코드에서 확인한 실행 규칙 — 본사 운영정책 확정과 구분

근거: `customer.controller.ts`/`customer.service.ts`/`customer.rules.ts`, `opportunity.controller.ts`/`opportunity.rules.ts`, `contract.controller.ts`/`contract.service.ts`/`contract.rules.ts`. 아래는 현재 코드의 제약이지 교육 별표로 유추한 정책이 아니다. DB 오류·브라우저 상호작용을 실행 확인한 결과와도 구분한다.

| 대상 | 현재 실행 계약 | 후속 검증 |
|---|---|---|
| Lead 수정·전환 | 수정은 `LEAD.WRITE` 및 소유자 또는 `LEAD.MANAGE`, CONVERTED 수정 불가. 전환은 `LEAD.CONVERT`, KEYMAN_MEETING 및 소유자 존재 필수, 이미 전환된 리드 거부. NEW는 사업자번호 중복 검사, EXISTING은 기존 거래처 필수. Account/Contact/Opportunity·이력·리드 상태는 한 DB transaction 안에서 처리 | H03 전환 분기 확장·중복/실패/권한·UI 연결 |
| Lead 상태 | 순방향은 NEW→FIRST_VISIT/CONTACT_EXCLUDED, FIRST_VISIT→KEYMAN_MEETING/CONTACT_EXCLUDED, KEYMAN_MEETING→CONVERTED/CONTACT_EXCLUDED. CONVERTED는 종료 상태. 다른 방향은 `LEAD.STATUS.REVERSE` 및 비공백 사유 필요; 같은 상태 요청은 CONVERTED 외 허용 | 상태 API의 CONVERTED 전이와 실제 전환 작업의 일관성은 H03 검증 대상; 같은 기능이라고 간주하지 않음 |
| Account 생성·수정 | 생성 `accountName` trim 후 1–300자 필수, PATCH는 partial로 제공한 필드만 schema 검사. `ACCOUNT.WRITE`, 수정은 소유자 또는 `ACCOUNT.MERGE`, MERGED 수정 불가, 사업자번호 중복 차단 | H03 폼·서버·원천 권한 일치 |
| Account 문자열 최대 길이 | 모두 trim 후 검사: `businessNo/zipCode/accountType` 20, `accountName/businessName` 300, `ceoName/phone/fax/providerNo` 50, `homepage/taxEmail/encryptedProviderNo` 100, `address` 500, `addressLine1/addressLine2/hospitalAddress` 400, `openDate` 10, `doctorLicenseNo` 500, `accountGrade` 30, `erpTradeCode/erpApprovalCode` 10. `accountName` 외 nullable·선택. schema에 날짜·이메일·사업자번호 정규식은 없음 | DB 길이와 업무 형식·원천값 허용정책은 H03에서 대조. schema 수용과 실제 저장은 위 매핑표 참조 |
| Account 선택지·기본 | `accountStatus`는 ACTIVE/NEW/NON_TRADING/NON_TRADING_OPP/CHURN_RISK/CHURNED/CLOSED, `useYn` 0/1, `accountStatCode` 0/1/2/3, `churnRiskYn` boolean. 서비스 기본 ACTIVE/GENERAL/BC505600/1/false/0. `accountType` 등 코드표와 문자열 API 허용범위는 같지 않음 | H03 코드 원천·허용값 일치 |
| 기회 생성·수정 | 생성 거래처 UUID·이름 1–200자 필수, recordType NEW/EXISTING/RECONTRACT(기본 EXISTING), ownerUserId 양의 정수 선택. 수정 확률 0–100, 예상범주 PIPELINE/BEST_CASE/COMMIT/OMITTED(각 nullable·선택). interestProduct 500, specialTerms 4000, paymentMethod 100, competitorUsage/ownedEquipment/treatmentFeeInfo 각 2000자, installmentMonths 0–120 정수 | H05 자유 입력 UI와 서버 계약 연결; 고정 샘플 액션과 구분 |
| 기회 상태·제품 | 단계 사유 최대 1000자. 역방향/재오픈은 비공백 사유 필요, 재오픈 권한 및 계약생성 후 수주 재오픈 차단. 제품 추가 `packagePublicId` UUID, 수량 1–9999 정수(기본 1), 단가 0 이상 필수, note 최대 1000자. 제품 수정은 선택 입력 | H05 ERP 미승인 수주 차단·가격 계산·상태/입력 오류 보존 |
| 계약 생성·금액 | CLOSED_WON·ERP 승인 거래처·기존 계약 미생성·기회 제품 1개 이상. 제품/상품 금액 중 하나 이상 제공하며 각각 0 이상. 빠진 금액은 기회금액에서 다른 금액을 뺀 값의 하한 0. 두 금액 합계와 기회금액의 차이 절댓값이 0.005 미만이어야 함 | H05 중복 계약·한쪽/양쪽 금액·경계값 |
| 계약 선택 입력 | contractName은 제공 시 1–200자, 미제공/서비스 trim 빈값이면 기회명+` 계약`; contractDate 선택 string·미제공 null(현 API 날짜필수 아님), packageClassification 최대 100, specialTerms 최대 4000자·미제공은 기회 특약 승계 | 교육상 필수와 현재 API 선택의 차이는 H05 정책으로 해결 |
| 최초 수금계획 | rows 1–60개. 각 행 installmentNo 양의 정수, collectionMethod 1–100자, amount 양수, plannedDate 8–30자 string. 금액은 유한 양수, 전체 합계와 계약금액 차이 절댓값 0.005 미만. 버전 1을 교체하고 ORIGINAL로 저장 | H05 중복 회차·실제 날짜 형식은 별도 결정, 기존 API보다 강한 규칙을 이미 구현됐다고 기록하지 않음 |
| 최초 계획 잠금·ERP 요청/재시도 | 최초 계획 수정은 ERP_REQUESTED/ERP_APPROVED/CLOSED에서 거부. 계약 ERP 요청은 DRAFT/ERP_FAILED에서만, ERP 승인 거래처 및 계약금액과 일치하는 현재 계획 필요. 성공 결과는 ERP_APPROVED·버전1 locked_yn=1, 실패는 ERP_FAILED. 이는 업무 재요청 허용이며 실제 ERP 전송 재시도 보장 아님 | H02 어댑터 결과/실패·H05 UI 잠금/재요청 |
| 변경 수금계획 | ERP_APPROVED 계약만 허용, 미수=MAX(0, 계약금액−실수금 합계)>0. 행 합계가 잔여미수 전체와 0.005 미만 차이여야 함. 이전 is_current 해제, MAX버전+1·ARREARS_REALLOCATION 저장 후 IF-ERP-011 큐·REQUESTING | H02/H05 변경계획 요청·결과·중복/실패·전체미수 배분 |


## 화면 액션·상태 전이 조사

현재 UI가 없는 액션은 `UI 없음`이라고 적었다. `?`는 성공/실패 응답·다음 화면이 코드/영상에서 확정되지 않은 것이다. API 자체가 있어도 UI 동작을 검증한 것으로 간주하지 않는다.

| 화면·actionKey | 시작 상태·입력 → 요청 | 성공 상태·다음 화면 | 실패/현 차이 |
|---|---|---|---|
| HOME.refresh | 홈·필터 → 집계 조회 | 같은 홈 수치 갱신 | 홈 UI 없음; API 오류 표시 ? |
| LEAD.search | 목록·검색어 → `GET /api/leads` | 필터된 목록 | API 오류 안내 있음 |
| LEAD.open | 목록·리드 ID → `GET /api/leads/:id` | 상세 | UI 없음; API 오류 ? |
| LEAD.create | 목록·병원/키맨 → 생성 | 신규 상세 | UI·생성 API 없음; 입력 오류 ? |
| LEAD.save | 상세·허용 필드 → `PATCH /api/leads/:id` | 저장 Lead 단일행 반환; 상세 재표시 목표 | UI 없음; CONVERTED/소유자·관리자 검사 존재. 일반 PATCH의 필드별 History 저장은 현 코드에 없음 |
| LEAD.changeStage | 상세·상태 → `POST /api/leads/:id/status` | 새 단계·이력 | UI 없음; 금지 전이 서버 검사 있음 |
| LEAD.assignOwner | 상세·양의 정수 사용자 ID → `POST /api/leads/:id/assign-owner` | public_id·새 owner_user_id 반환 | UI 없음; LEAD.MANAGE, CONVERTED 또는 미존재 대상은 Editable lead not found |
| LEAD.convert | KEYMAN_MEETING·소유자 존재·Account 신규/기존 → `POST /api/leads/:id/convert` | leadPublicId/accountPublicId/contactId/opportunityPublicId 반환, Lead CONVERTED; 링크 UI 목표 | UI 없음; 기존 전환 차단·사업자 중복·DB transaction 있음. Contact/Opportunity 선택·기회 생략·별도 소유자 입력 미지원 |
| ACC.search/open | 목록·검색/ID → `GET /api/accounts`, `/:id` | 목록/상세 | 요청 오류 안내; 상세 모바일/PC 별도 |
| ACC.create/save | 폼·계정 값 → `POST /api/accounts`, `PATCH /api/accounts/:id` | 상세/목록 갱신 | 생성 계정명 1–300자·중복 사업자번호·수정 소유자/MERGED 검사; 행별 오류 보존 확인 필요 |
| ACC.erpRequest | 미승인 계정·필수 송신값 → `POST /api/erp-accounts/:id/request` | `REQUESTING`, 상세/로그 | ERP 필수값 누락 오류; 승인 결과 자동 수신 없음 |
| ACC.merge | 대표 1개·중복 1–2개 UUID → `POST /api/accounts/merge` | 대표 publicId 반환, Contact/Opportunity 이전·병합 이력 | UI 없음; 서로 다른 ERP 코드 병합 거부, transaction 있음. 사용자별 필드 선택 병합은 현재 요청 schema에 없음 |
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
| DW.decision | REQUESTED/BRANCH_APPROVED·승인/거부 → decision API | 승인/반려 상태·목록 | 재할당·ERP 결과 UI 없음. 본부승인+활동 COMPLETED(OUT)+ERP NOT_REQUESTED일 때만 요청 로그 생성 |
| OPP.create | 거래처 UUID·이름 1–200자 → `POST /api/opportunities` | 기회 목록/상세 | UI는 거래처/비공백 이름 검사; API 검증 오류 표시, 업무 중복 기준은 미확인 |
| OPP.stage | 기회·단계/사유 → `POST /api/opportunities/:id/stage` | 새 단계·파이프라인 | ERP 미승인 수주 거부; 입력 보존 확인 필요 |
| OPP.saveNegotiation | 선택된 기회 → `PATCH /api/opportunities/:id`, `forecastCategory='PIPELINE'`, `successProbability`는 현재 단계 NEGOTIATION이면 70, 그 외 30 | 샘플 저장 안내 후 `load()`로 목록·거래처·제품목록 재조회, 같은 화면 | `OpportunitiesPage.saveNegotiation`/버튼 존재; 실패 String(e) 안내. 자유로운 협상 입력이 아닌 고정값 샘플이며 H05 확장 대상 |
| OPP.product | 기회·packagePublicId/가격 → products POST/PATCH/DELETE | 제품 목록·금액 갱신 | 현재 UI 추가 quantity=1 고정, API는 1–9999 지원; 복수 선택·수량/행수정 UI 부족 |
| CON.create | 수주·ERP 승인·미계약·제품 존재 기회, 금액 → `POST /api/contracts` | DRAFT·계약 목록 | 금액 합계 불일치/중복 생성 서버 거부; 행별 계약·특약 UI 없음 |
| CON.erpRequest | DRAFT 또는 ERP_FAILED·정상 수금계획 → `POST /api/contracts/:id/erp-request` | ERP_REQUESTED·계약 상세 | 다른 상태 재요청 거부; ERP 미승인 거래처·계획 합계 불일치 거부. 승인/실패는 결과 수신 후 반영 |
| COL.planOriginal | 잠기지 않은 계약·1–60행 → collection-plans POST | 버전1 ORIGINAL 계획·재조회 | 양수·전체합계 검증 및 ERP_REQUESTED/ERP_APPROVED/CLOSED 잠금 존재; 입력 보존은 미검증 |
| COL.planChange | ERP_APPROVED 계약·미수 전체 재배분 → collection-plans/change POST | 새 버전 ARREARS_REALLOCATION·IF-ERP-011 큐·REQUESTING | UI 없음; 미수 0·잘못된 합계·미승인 계약은 서버가 거부. 임의 SPLIT 입력 API로 단정하지 않음 |
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

ERP 수신 `IF-ERP-003/005/008/009/010/013/014`의 성공·실패를 원천 데이터와 `InterfaceLog`에 연결하는 것은 H02 이후 목표다. 현재 모든 수신 경로가 같은 방식으로 구현됐다는 뜻은 아니다. 예를 들어 거래처/계약 결과는 `requestId`가 제공될 때만 해당 로그를 완료 처리한다. 현재 실제 ERP endpoint·응답 형식·전송 재시도 정책은 [인터페이스 카탈로그 §6](../../../spec/interfaces/P0-07_interface_catalog.md)에 `미확정`이며 위의 업무 재요청 허용 조건과 구분한다.

## 인터페이스별 화면·결과 대응

| IF | 입력/수신 화면 | 결과 상태·데이터 | 현 구현 조사 |
|---|---|---|---|
| IF-HIRA-001 | 리드·거래처 인입 목표 | 목표 Lead/Account 병원 갱신; 현재는 Lead만 | `/api/integrations/hira/hospitals/import`: inbox 기록 후 crm_lead INSERT/UPDATE만. 기존 Lead는 hira_sync_exclude_yn=0일 때 갱신, Account 갱신 없음. H02/H03 보완 |
| IF-ERP-001 | 리드 배정 | 지역 담당자·소유자 | HIRA 신규 Lead는 로컬 crm_sales_area_owner의 회사/시도/시군구·활성·priority를 조회해 배정. ERP로부터 배정표를 새로 수신하는 실행 경로는 미확인; H02/H03 |
| IF-ERP-002 | 거래처 ERP 요청 | REQUESTING·요청 ID·큐/로그 | 요청 API/버튼 및 13필수 검증은 존재하나 payload는 부분 필드. 아래 차이 명세를 H02/H03 인계; 실제 ERP 송신 검증 아님 |
| IF-ERP-003 | 거래처 상세·기회 | ERP 거래처코드·승인·수주 가능 | 결과 API 존재, 화면 자동 반영 미확인 |
| IF-ERP-004 | 계약 상세 | 계약 요청중·로그 | 요청 API/버튼 존재 |
| IF-ERP-005 | 계약·주문 | ERP 계약번호·승인·주문 가능 | 결과 API 존재, 화면 자동 반영 미확인 |
| IF-ERP-006 | 기회 제품·주문 품목 | 품목·단가·재고·주문가능 | 상품조회 API 존재, 실제 조회 원천 미확인 |
| IF-ERP-007 | 주문 | 요청중·로그 | 주문 제출 API/버튼 존재 |
| IF-ERP-008 | 주문·납품현황 | ERP 주문번호·출고·납품 | 결과 API 존재, 화면 연동 일부 |
| IF-ERP-009 | 계약 수금·원장·분석 | 수금 행·잔여 미수 | 결과 API 존재 |
| IF-ERP-010 | 납품·원장·분석 | 매출 행·합계 | 결과 API 존재 |
| IF-ERP-011 | 수금계획 | 변경계획 요청·동기화 상태 | 변경 API가 새 버전 저장 후 enqueuePending·REQUESTING 처리. 실제 ERP 전송/결과 연결은 H02/H05 검증 필요 |
| IF-ERP-012 | 직출직퇴 | 전송요청·로그 | 본부승인 DIVISION_APPROVED + 활동 COMPLETED(OUT) + erp_sync_status NOT_REQUESTED 모두 충족 시에만 REQUESTING·요청로그 기록. 실제 ERP 송신 보장은 아님; H02/H04 |
| IF-ERP-013 | 직출직퇴 | ERP 승인/연계 상태 | 결과 화면/API 확인 필요 |
| IF-ERP-014 | 납품·반품 | 반품/교환 행·원장 | 결과 API 존재, 화면 범위 확인 필요 |

### ERP/HIRA 현재 차이와 구현 인계

1. `ContractService.requestErpAccount`는 `missingErpAccountFields`의 13필수(`co_cd/U_Key/hosp_nm/biz_no/ceo_nm/zip_cd/addr1/addr_prt/medical_care_no/open_dt/email/sal_kd/tel`)를 검사한다. `company_code`는 DIO로 주입한다. 실제 enqueue payload는 `accountPublicId/accountName/businessName/businessNo/ceoName/providerNo/taxEmail/phone/address/ownerUserId` 10키다. 따라서 필수 중 `co_cd/U_Key/zip_cd/addr1/addr_prt/open_dt/sal_kd`의 명시적 대응 필드는 없다. 일반 `address`를 `addr1/addr_prt` 모두와 동등하다고 간주하지 않는다. H02 어댑터 DTO·H03 거래처 요청에서 검증 필드와 payload를 맞추고 누락 테스트를 추가한다.
2. `CustomerService.importHira`는 Inbox와 Lead만 갱신한다. Account 동기화·변경 충돌·원천 필드 잠금은 H02/H03의 미구현 범위다. 기존 Lead가 인입 제외되어 실제 UPDATE가 없어도 현재 `updated` 카운터는 증가하므로 해당 카운트를 실변경 건수로 단정하지 않는다.
3. `ActivityService.queueDirectWorkErpIfReady`는 OUT 처리와 본부 승인 처리에서 호출된다. 어느 이벤트가 먼저여도 위 3조건이 모두 갖춰져야 요청 ID를 만들고 직출 ERP 상태/`crm_interface_log`를 REQUESTING으로 기록한다. payload는 `directWorkPublicId/activityPublicId/workType/reason`이며 외부 전송은 이 함수에 없다. H02/H04에서 양 이벤트 순서·미완료 차단·결과 수신·실패 후 재처리·중복을 검증한다. 현 NOT_REQUESTED 조건만으로 모든 재시도/동시성 보장이 구현됐다고 판정하지 않는다.

## 액션 계약 조사 원칙

각 단계 구현 시 `시작 상태 → 입력 → 요청 → 성공/실패 → 새 상태 → 다음 화면`을 위 표의 액션별로 채운다. 현재 API가 있다는 이유만으로 화면 액션을 `충족`으로 판정하지 않는다. 인증 실패·필드 오류 시 입력 보존, 목록/상세 동기화, 직접 API 접근 제한은 H03–H07의 검증 항목이다. 출처가 없는 권한·필수·잠금·계산 규칙은 본사 운영 정책으로 확정하지 않고 `미확인` 또는 실행 가능한 `설계 가정`으로 기록한다.
