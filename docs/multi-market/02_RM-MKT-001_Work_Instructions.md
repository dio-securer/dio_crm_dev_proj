# RM-MKT-001 — Multi-Market UI Architecture Refactoring 작업지시서

- Work ID: `RM-MKT-001`
- 설계 기준: `docs/multi-market/01_RM-MKT-001_Multi-Market_UI_Architecture_Design.md`
- 대상: DIO CRM
- 상태: `WORK_INSTRUCTION_BASELINE`
- 목표: 기존 본사 CRM을 보호하면서 미국/멕시코 기준 GLOBAL Template을 추가하고, 인도/포르투갈/튀르키예 등 추가 법인을 Profile 기반으로 수용 가능한 구조로 Refactoring

---

## 1. 작업 원칙

본 작업은 기존 소스를 폐기하거나 국가별로 Fork하는 작업이 아니다.

기본 원칙:

```text
기존 업무 Logic 보존
        +
Globalization Foundation 유지
        +
Market Template Layer 추가
        +
Screen / Field / Feature / Workflow / Integration Profile 분리
```

절대 금지:

```text
국가별 Repository 분리
국가코드 if/else 확산
기존 Migration 001~009 수정
미확정 인도/포르투갈/튀르키예 업무규칙 임의 구현
Production DB/ERP 직접 변경
```

모든 Source 변경은 Branch → PR → CI → Human Review → Merge 절차로 진행한다.

---

## 2. 전체 단계

```text
M0  Baseline Freeze / Source Inventory
M1  Multi-Market Contract 확장
M2  Market Template / Country Profile Foundation
M3  Screen Registry / Route Resolver
M4  Field / Section Profile Foundation
M5  Feature / Workflow / Integration Profile 정리
M6  HQ Template 보호 및 기존화면 이관
M7  GLOBAL Template 구현
M8  US / MX Country Profile 연결
M9  DB Migration 010 Foundation
M10 Regression / Responsive / PWA 검증
M11 India Fit/Gap 준비
M12 Additional Country Onboarding Framework
M13 Documentation / CI / Human Review
```

M0~M10은 `RM-MKT-001` Source Refactoring 범위다.

M11~M12는 향후 국가 확장을 위한 준비 범위이며 실제 인도/포르투갈/튀르키예 업무 프로세스를 임의 구현하지 않는다.

---

# M0 — Baseline Freeze / Source Inventory

## 목적

현재 main의 동작을 Refactoring 기준선으로 확정하고 Regression 기준을 만든다.

## 작업

1. 현재 main Head 기록
2. 현재 Frontend Route 목록 정리
3. 현재 Market/Workflow/Feature Profile 목록 정리
4. 현재 Page별 API 사용 Endpoint 정리
5. 현재 DB Migration `001~009` 목록 고정
6. HQ 기능 중 반드시 유지할 기능 체크리스트 작성
7. 미국/멕시코 교육자료에서 GLOBAL 화면/프로세스 후보 추출

## 산출물

```text
docs/multi-market/M0_source_inventory.md
docs/multi-market/M0_hq_regression_baseline.md
docs/multi-market/M0_global_screen_process_matrix.md
```

## 완료 기준

```text
현재 Route 목록       COMPLETE
현재 Profile 목록     COMPLETE
HQ Regression 기준    COMPLETE
GLOBAL Source Matrix  COMPLETE
```

---

# M1 — Multi-Market Contract 확장

## 목적

Frontend/Backend가 공통으로 사용할 Multi-Market Context Contract를 정의한다.

## 대상

```text
packages/contracts
backend/src/globalization
frontend/src/market
```

## 추가 Contract 후보

```ts
MarketTemplateCode
ScreenProfileCode
FieldProfileCode
FeatureProfileCode
IntegrationProfileCode
```

`GlobalizationContext` 확장 후보:

```ts
{
  countryCode,
  locale,
  currencyCode,
  timezone,
  marketTemplateCode,
  marketProfileCode,
  screenProfileCode,
  fieldProfileCode,
  featureProfileCode,
  workflowProfileCode,
  integrationProfileCode,
  mapProfileCode,
  features
}
```

## 중요 조건

- 기존 `marketProfileCode`, `workflowProfileCode`, `mapProfileCode` 제거 금지
- 기존 `/api/me/context` Contract를 가능한 Backward-compatible하게 확장
- 기존 KR Context Test가 계속 PASS해야 함

## Test

```text
KR Context Resolve
Fallback Context
Unknown Profile Reject
Contract Schema Validation
```

---

# M2 — Market Template / Country Profile Foundation

## 목적

국가와 Template을 분리한다.

## Backend 대상 구조

```text
backend/src/globalization/
  market-template.ts
  country-profile.ts
  profile-resolver.ts
```

## Frontend 대상 구조

```text
frontend/src/market/
  templates/
    HQ.ts
    GLOBAL.ts
  profiles/
    KR.ts
    US.ts
    MX.ts
```

## 초기 Template

```text
HQ_TEMPLATE
GLOBAL_TEMPLATE
```

## 초기 Country Mapping

```text
KR → HQ_TEMPLATE
US → GLOBAL_TEMPLATE
MX → GLOBAL_TEMPLATE
```

## 주의

다음은 아직 만들지 않는다.

```text
IN → ?
PT → ?
TR → ?
```

해당 국가는 Requirement 확보 후 결정한다.

## 완료 기준

```text
Template Registry       PASS
Country Profile Resolve PASS
KR Compatibility        PASS
US/MX Config Baseline   PASS
```

---

# M3 — Screen Registry / Route Resolver

## 목적

현재 `App.tsx`의 고정 Page Route를 Profile 기반 Screen 선택 구조로 변경한다.

## 신규 구조 후보

```text
frontend/src/app/
  screen-registry.ts
  screen-resolver.ts
  route-config.ts
```

## Registry 예

```ts
const screenRegistry = {
  HQ_LEAD: HqLeadPage,
  GLOBAL_LEAD: GlobalLeadPage,
  HQ_ACCOUNT: HqAccountPage,
  GLOBAL_ACCOUNT: GlobalAccountPage,
  HQ_ACTIVITY: HqActivityPage,
  GLOBAL_ACTIVITY_MAP: GlobalActivityMapPage,
  GLOBAL_ACTIVITY_LOG: GlobalActivityLogPage
};
```

## 작업 순서

1. Screen Key Type 정의
2. Registry 구현
3. Market Context에서 Screen Profile Resolve
4. Route가 직접 Page를 import하지 않도록 단계적 전환
5. Unknown Screen Key에 대한 Fail-safe 처리

## 중요 조건

- URL은 가능하면 유지
- `/accounts`, `/activities` 등의 API/링크 계약을 깨지 않는다
- Mobile Navigation도 동일 Screen Profile을 사용

## Test

```text
KR → HQ_ACCOUNT Resolve
US → GLOBAL_ACCOUNT Resolve
MX → GLOBAL_ACCOUNT Resolve
Unknown Key → Controlled Error
```

---

# M4 — Field / Section Profile Foundation

## 목적

국가별 작은 화면 차이를 Component 복제가 아니라 Field/Section Profile로 처리한다.

## 우선 대상

`Account` 화면을 Pilot 대상으로 한다.

현재 정적 요소:

```text
FORM_SECTIONS
CRM_FORM_KEY
ACCOUNT_INTERFACE_FIELDS
```

## 신규 구조 후보

```text
frontend/src/market/field-profiles/
  HQ_ACCOUNT.ts
  GLOBAL_ACCOUNT.ts
```

## Profile 요소

```text
Section Code
Section Order
Visible
Field Code
Required
Readonly
Label Key
Validation Rule Key
```

## 원칙

- DB Field명을 UI Label과 분리
- 표시 순서/필수여부/노출여부를 Profile화
- Backend 필수 Validation은 Frontend 설정과 별개로 유지

## Pilot Acceptance

```text
HQ Account 화면 기존 필드 유지
GLOBAL Account는 해외법인 기준 Section 구성 가능
같은 Account API 사용
Country if/else 미사용
```

---

# M5 — Feature / Workflow / Integration Profile 정리

## 목적

현재 Market Profile에 섞여 있는 역할을 분리한다.

## M5-1 Feature Profile

현재 Feature:

```text
HIRA_IMPORT
DIRECT_WORK
GPS_CHECKIN
ACTIVITY_APPROVAL
ERP_ACCOUNT_APPROVAL
MONTHLY_STATEMENT
```

초기 구조:

```text
HQ_FEATURE_PROFILE
GLOBAL_FEATURE_PROFILE
```

해외법인 교육자료에서 명시적으로 확인된 규칙은 Global Baseline 후보로 기록하되 실제 운영값은 승인 후 확정한다.

## M5-2 Workflow Profile

현재 `KR_SALES_APPROVAL` 유지.

GLOBAL Workflow는 교육자료/운영 확인 범위만 정의한다.

승인자 조직구조가 문서로 확인되지 않은 부분은 GAP 처리한다.

## M5-3 Integration Profile

신규 Boundary:

```text
ERP Adapter
Map Adapter
Customer Master Adapter
Product Adapter
```

Provider/Endpoint는 환경변수 또는 Environment Config로 주입한다.

## Test

```text
Feature Frontend Visibility
Feature Backend Guard
Workflow Resolver
Integration Profile Resolver
```

---

# M6 — HQ Template 보호 및 기존화면 이관

## 목적

현재 구현된 본사 화면을 `HQ_TEMPLATE` 아래로 보호한다.

## 원칙

첫 단계에서 화면을 전부 다시 작성하지 않는다.

## 작업 방식

```text
현재 LeadsPage
   ↓ Wrapper
HqLeadPage

현재 AccountsPage
   ↓ Wrapper / Refactor
HqAccountPage
```

이후 공통 API/Hook/Model을 추출한다.

## 공통화 대상

```text
React Query
API 호출
Write Payload
Validation
Status Mapping
Form State
Error/Loading
```

## 화면별 순서

1. Account
2. Lead
3. Activity
4. Opportunity
5. Contract/Collection
6. Order/Fulfillment
7. Ledger/Statement
8. Account360
9. Analytics/Ops

## Acceptance

```text
KR Route 동작 동일
KR Feature 동작 동일
KR i18n 동일
KR Responsive 동일
KR PWA Regression 없음
```

---

# M7 — GLOBAL Template 구현

## 목적

미국/멕시코 해외법인 사용자 교육자료를 Source of Truth로 GLOBAL Template을 구현한다.

## M7-1 GLOBAL Sales

구현 범위:

```text
Lead
Account / Contact
Opportunity
Contract
Collection Plan
Order
ERP Integration Status
```

### Lead

기준 상태:

```text
신규등록
초도방문
키맨미팅
컨택제외
변환
```

Lead Convert:

```text
Lead → Account + Contact + Opportunity
```

### Account

포함 영역:

```text
Summary
Activity
Basic Information
Trade Status
Management Information
Address
ERP Integration
```

### Opportunity

기준 상태:

```text
니즈파악
제안
협상
수주성공
수주실패
```

### Contract / Collection

```text
Won Opportunity
 → Contract
 → Collection Plan
 → ERP Registration Request
```

### Order

```text
Account
 → Contract Package
 → Product Type
 → Category/Search
 → Product
 → Price/Quantity
 → Delivery Address
 → Order
```

## M7-2 GLOBAL Activity

구현 범위:

```text
Activity Plan
Sales Activity Map
Sales Activity Log
GPS IN / OUT
Activity Report
Activity Approval
```

교육자료 기준 확인사항:

```text
해외법인 직출·직퇴 미사용
동일 활동일자 계획 중복 제한
IN 시각 자동생성
OUT 미등록 Activity가 있으면 보고 승인요청 불가
보고일 기준 완료 Activity + D+5 Plan 조회
```

## 중요

미국/멕시코 문서에 없는 업무규칙은 생성하지 않는다.

---

# M8 — US / MX Country Profile 연결

## 목적

GLOBAL Template이 실제 Country Profile을 통해 선택되는지 확인한다.

## US Profile

필수 설정 영역:

```text
countryCode
locale
currency
timezone
marketTemplateCode
screenProfileCode
fieldProfileCode
featureProfileCode
workflowProfileCode
integrationProfileCode
mapProfileCode
```

## MX Profile

동일 구조로 정의한다.

## 주의

미국/멕시코 간 차이가 문서상 확인되지 않은 부분은 동일 GLOBAL Baseline을 사용하고 추정 Override를 추가하지 않는다.

## Test Matrix

```text
US Login Context
US Navigation
US Account
US Activity
US Opportunity
US Contract/Order

MX Login Context
MX Navigation
MX Account
MX Activity
MX Opportunity
MX Contract/Order
```

---

# M9 — DB Migration 010 Foundation

## 목적

Multi-Market Profile Code를 DB에 저장할 수 있도록 Schema를 Backward-compatible하게 확장한다.

## 신규 Migration

```text
database/migrations/010_multi_market_foundation.sql
```

## 검토 대상

`crm_company` 추가 후보:

```text
market_template_code
screen_profile_code
field_profile_code
feature_profile_code
integration_profile_code
```

기존 값:

```text
country_code
default_locale
default_currency
default_timezone
market_profile_code
workflow_profile_code
map_profile_code
```

은 유지한다.

## 국가 특수 Attribute

필요하면 신규 Table 후보:

```text
crm_account_market_attribute
```

단, 실제 Field 요구가 확정되기 전 불필요한 Generic EAV 구조를 과도하게 만들지 않는다.

## Safety

```text
Migration Source 작성만 수행
DEV/UAT 실제 적용은 별도 Environment Gate
Production 적용 금지
```

---

# M10 — Regression / Responsive / PWA 검증

## 목적

Architecture Refactoring으로 기존 UI Completion 및 PWA 기능이 깨지지 않았는지 검증한다.

## CI 필수 항목

```text
pnpm build
pnpm test
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
pnpm env:check
pnpm audit:critical
```

## 추가 Test

```text
Market Template Resolver
Country Profile Resolver
Screen Resolver
Field Profile Resolver
Feature Guard
Workflow Resolver
HQ Regression
GLOBAL Render
```

## Responsive Matrix

```text
Desktop 1440+
Laptop
Tablet
Mobile Android viewport
Mobile iOS viewport
```

## PWA 확인

```text
Manifest
Service Worker
API Cache Exclusion
Installability Baseline
Safe Area
Mobile Navigation
```

---

# M11 — India Fit/Gap 준비

## 목적

인도 외부 CRM을 DIO CRM으로 통합할 때 개발보다 분석을 먼저 수행한다.

## 입력자료

```text
인도 CRM 화면 캡처
사용자 매뉴얼
Field List
Status List
Approval Flow
Integration List
Report List
Mobile Process
```

## 비교 기준

```text
HQ_TEMPLATE
GLOBAL_TEMPLATE
INDIA CURRENT
```

## 산출 결과 분류

```text
GLOBAL_REUSE
GLOBAL_OVERRIDE
NEW_TEMPLATE_REQUIRED
```

## 금지

인도 자료 확보 전:

```text
INDIA_ACCOUNT
INDIA_ORDER
INDIA_WORKFLOW
```

등을 추정 구현하지 않는다.

---

# M12 — Additional Country Onboarding Framework

## 대상

```text
Portugal
Türkiye
기타 신규 법인
```

## Onboarding 표준

```text
1. 자료수집
2. Process 비교
3. Screen 비교
4. Field 비교
5. Feature 비교
6. Workflow 비교
7. Integration 비교
8. Template 선택
9. Override 최소화
10. UAT
```

## Country Onboarding 문서 Template 생성

후속 Source에서 다음 문서 양식을 만든다.

```text
docs/multi-market/onboarding/Country_FitGap_Template.md
docs/multi-market/onboarding/Country_Profile_Template.md
```

---

# M13 — Documentation / CI / Human Review

## 실행보고서

생성:

```text
docs/multi-market/03_RM-MKT-001_Execution_Report.md
```

## PR 상태

완료 Source는 별도 Branch에서 PR을 생성한다.

권장 Branch:

```text
architecture/multi-market-ui
```

## PR 필수 내용

```text
Architecture Scope
HQ Regression Result
GLOBAL Template Result
US/MX Profile Result
Migration 010 Status
CI Run ID
Known GAP
Environment Not Executed Statement
```

## Human Gate

Source/CI 완료 후 상태:

```text
RM-MKT-001
SOURCE_COMPLETE
CI_PASS
HUMAN_REVIEW_PENDING
ENVIRONMENT_NOT_EXECUTED
PRODUCTION_NOT_TOUCHED
```

사용자의 명시적 승인 후에만 main에 병합한다.

---

# 3. 단계별 실행 순서 요약

```text
M0  기존 Source와 HQ 동작 기준 고정
 ↓
M1  Multi-Market Contract 확장
 ↓
M2  Market Template / Country Profile
 ↓
M3  Screen Registry
 ↓
M4  Field / Section Profile
 ↓
M5  Feature / Workflow / Integration Profile
 ↓
M6  기존 본사 UI를 HQ Template으로 보호
 ↓
M7  미국/멕시코 기준 GLOBAL Template
 ↓
M8  US/MX Country Profile 연결
 ↓
M9  Migration 010 Source
 ↓
M10 전체 Regression / Responsive / PWA / CI
 ↓
M13 Human Review

인도 자료 확보 후
 ↓
M11 India Fit/Gap
 ↓
필요한 Override 또는 신규 Template

추가 국가
 ↓
M12 Country Onboarding 표준 적용
```

---

# 4. 최종 Acceptance Criteria

`RM-MKT-001` Source 완료 조건:

```text
[ ] 기존 KR/HQ 업무 동작 보존
[ ] HQ_TEMPLATE 구현
[ ] GLOBAL_TEMPLATE 구현
[ ] US Profile 구현
[ ] MX Profile 구현
[ ] Screen Registry 적용
[ ] Field/Section Profile 적용
[ ] Feature Profile 분리
[ ] Workflow Profile Resolver 적용
[ ] Integration Profile Boundary 적용
[ ] Migration 010 Source 작성
[ ] 국가 if/else 확산 없음
[ ] Build PASS
[ ] Test PASS
[ ] i18n Check PASS
[ ] PWA Check PASS
[ ] Critical Audit PASS
[ ] 실행보고서 작성
[ ] Human Review 승인
```

인도/포르투갈/튀르키예의 실제 업무 구현은 해당 국가 요구사항 분석 후 별도 Work Item으로 수행한다.
