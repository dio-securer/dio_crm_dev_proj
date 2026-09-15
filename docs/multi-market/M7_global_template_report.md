# RM-MKT-001 M7 — GLOBAL Template Implementation Report

- Work ID: `RM-MKT-001-M7`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m7-global-template`
- Baseline main: M6 merged main
- Status: `SOURCE_READY / CI_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

미국/멕시코 해외법인 사용자 교육자료를 기준으로 GLOBAL Sales / Activity 화면을 구현한다.

M7은 국가별 US/MX Runtime 값을 활성화하는 단계가 아니다. 실제 Country Profile 연결은 M8에서 수행한다.

## 2. Source-derived GLOBAL Process

### Sales

```text
Lead
  → Account / Contact
  → Opportunity
  → Contract / Collection Plan
  → Order
  → ERP Integration Status
```

Lead 상태:

```text
NEW
FIRST_VISIT
KEYMAN_MEETING
CONTACT_EXCLUDED
CONVERTED
```

Lead Convert는 기존 Backend Core의 `/api/leads/:publicId/convert`를 사용한다. Backend는 신규/기존 Account를 연결하고, Keyman 정보가 존재하면 Contact를 생성하며, Opportunity를 `NEEDS_ANALYSIS` 상태로 생성한다.

Opportunity 단계:

```text
NEEDS_ANALYSIS
PROPOSAL
NEGOTIATION
CLOSED_WON
CLOSED_LOST
```

Contract는 Won Opportunity에서 생성하고 Collection Plan 및 ERP Request 흐름을 기존 Core API로 재사용한다.

Order는 ERP 승인/사용 가능 Contract를 기준으로 Draft → Product → Delivery → Submit 흐름을 기존 Core API로 재사용한다.

### Activity

```text
Activity Plan
  → Sales Activity Map 또는 Sales Activity Log
  → GPS IN
  → Consultation
  → GPS OUT
  → Activity Report
  → Approval Request
```

GLOBAL Activity 기준:

```text
Direct Work / Direct Leave 미사용
Map 기반 등록 지원
검색 기반 Activity Log 지원 (최대 100개 후보 표시)
IN / OUT GPS 사용
OUT 누락 Activity가 있으면 Report 승인요청 불가: Backend Rule 사용
Report는 완료 Activity + D+5 Plan: Backend Report Service 사용
```

GLOBAL 승인자 조직/Role은 교육자료만으로 확정할 수 없으므로 M5 GAP을 유지한다. 따라서 M7 GLOBAL Activity Report는 승인요청까지만 제공하고 HQ의 Branch/Division 승인 버튼을 재사용하지 않는다.

## 3. New Frontend Structure

```text
frontend/src/market/templates/global/
  GlobalLeadPage.tsx
  GlobalAccountPage.tsx
  GlobalActivityPage.tsx
  GlobalActivityReportPage.tsx
  GlobalScreens.tsx
  global-screen-manifest.ts
  global-screen-manifest.spec.ts
```

## 4. Screen Registry

M7에서 실제 등록하는 GLOBAL Screen:

```text
GLOBAL_LEAD
GLOBAL_ACCOUNT
GLOBAL_ACTIVITY_MAP
GLOBAL_ACTIVITY_REPORT
GLOBAL_OPPORTUNITY
GLOBAL_CONTRACT
GLOBAL_ORDER
```

`screen-registry.tsx`에 위 Screen을 등록한다.

기존 공통 Core와 업무 규칙이 일치하는 Opportunity / Contract / Order는 기존 Page를 GLOBAL Wrapper 뒤에서 재사용한다.

Lead / Account / Activity / Activity Report는 해외 교육자료 차이가 명확하여 별도 GLOBAL Screen을 사용한다.

## 5. GLOBAL Navigation Scope

M3에서 후보로 생성했던 GLOBAL Screen Key 중 해외 교육자료에서 M7 범위가 확인되지 않은 아래 Route는 GLOBAL Screen Profile에서 노출하지 않는다.

```text
pipeline
fulfillment
ledger
account360
analytics
ops
```

이는 기능 삭제가 아니라 `not proven for GLOBAL yet` 처리다. 향후 Country Requirement가 확보되면 별도 승인 후 Profile에 추가한다.

`directWork`는 해외 활동 교육자료에서 미사용이 명시되어 있으므로 GLOBAL Profile에 포함하지 않는다.

## 6. GLOBAL Account

`GLOBAL_ACCOUNT_FIELD_PROFILE` 기반으로 Section/Field를 렌더링한다.

```text
Identity
Basic
Address
ERP
Management
```

같은 `/api/accounts` API와 Shared Account Contract를 재사용한다.

M4에서 승인된 GLOBAL Field Profile을 그대로 사용하며, 국가별 신규 DB Field는 만들지 않는다.

현재 Backend ERP Account outbound required validation은 HQ 기준 Shared Interface Catalog를 사용하므로 M7은 GLOBAL 전용 ERP 필수 Field Rule을 임의 변경하지 않는다. Account 화면에서는 Integration Status를 표시하고, 실제 해외 ERP Request Policy는 M8 이후 Integration Profile 승인 범위에서 확정한다.

## 7. GLOBAL Lead

GLOBAL Lead 화면에서 다음을 지원한다.

```text
Lead 목록 / 검색
Status Transition
Contact Excluded Reason
KEYMAN_MEETING 이후 Convert
NEW Account Convert
EXISTING Account Convert
Opportunity Name 입력
```

Convert Core 결과:

```text
Account linked/created
Contact created when Keyman exists
Opportunity created
Lead → CONVERTED
```

## 8. GLOBAL Activity

GLOBAL Activity 화면은 두 진입 방식을 명시적으로 분리한다.

```text
Sales Activity Map
Sales Activity Log
```

Map:
- Device GPS 사용
- `/api/activities/map/today`
- Nearby Lead/Account 조회
- 대상 선택 후 Log/Plan 등록으로 연결

Log:
- Lead / Account 검색
- 최대 100개 후보
- Activity Plan 저장
- Direct Work / Direct Leave Field 없음

Today Activity:
- PLANNED → IN
- IN_PROGRESS → Consultation / OUT

## 9. GLOBAL Activity Report

```text
Report Date
Prepare
Completed Activity + Next 5 Days Plan
Consultation Edit
Request Approval
Report Status List
```

GLOBAL 승인자 조직/Role이 미확정이므로 HQ `branch/division` 승인 UI는 노출하지 않는다.

## 10. Compatibility / Safety

```text
HQ Template 변경 없음
HQ 14 Screen Wrapper 유지
기존 API Contract 유지
DB Migration 없음
US/MX Runtime 활성화 없음 (M8)
IN/PT/TR 규칙 생성 없음
DEV/UAT/Production 변경 없음
```

## 11. Test / Gate

M7 테스트는 GLOBAL Screen Manifest와 Profile 범위를 검증한다.

```text
GLOBAL 7 Screen Manifest
GLOBAL Screen Profile 일치
Direct Work 미노출
미확정 Route 미노출
HQ Screen Key 혼입 금지
```

CI:

```text
pnpm build
pnpm test
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
pnpm env:check
pnpm audit:critical
```

최종 상태는 PR CI 완료 후 갱신한다.
