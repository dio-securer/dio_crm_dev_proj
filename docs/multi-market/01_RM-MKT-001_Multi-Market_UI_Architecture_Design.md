# RM-MKT-001 — Multi-Market UI Architecture Refactoring 설계서

- Work ID: `RM-MKT-001`
- 문서유형: Architecture / Refactoring Design
- 대상 시스템: DIO CRM
- 상태: `DESIGN_BASELINE`
- 작성 목적: 본사 CRM과 해외법인 CRM의 화면/필드/프로세스 차이를 수용하면서도 국가별 소스 복제를 방지하는 Multi-Market UI 구조 정의

---

## 1. 배경

DIO CRM은 향후 본사뿐 아니라 미국, 멕시코, 인도, 포르투갈, 튀르키예 등 다수 법인에 배포될 예정이다.

현재 확인된 기준은 다음과 같다.

### 1.1 본사 CRM

초기 사용자 교육자료를 기준으로 본사 판매/활동 프로세스가 존재한다.

대표 특성:

- 본사 기준 Lead / Account / Contact / Opportunity / Contract / Order 흐름
- 활동계획 / GPS IN·OUT / 활동보고 / 승인
- 직출·직퇴 사용
- HIRA/국내 병원정보 및 본사 ERP 연계 기준

### 1.2 미국·멕시코 해외법인 CRM

해외법인 판매/활동 사용자 교육자료에서 본사와 다른 화면과 업무 흐름이 확인됐다.

판매 기준:

```text
Lead
 → Account / Contact
 → Opportunity
 → Contract / Collection Plan
 → ERP 등록요청
 → Order
 → ERP Order / Delivery / Sales / Collection
```

활동 기준:

```text
Activity Plan
 → Activity Registration
    ├─ Sales Activity Map (Google/GPS)
    └─ Sales Activity Log (검색 기반)
 → Activity Report
 → Activity Approval
```

확인된 차이 예:

- 해외법인은 직출·직퇴 기능 미사용
- 영업활동 등록에 지도 방식과 검색 기반 업무일지 방식이 별도로 존재
- Account / Contract 화면의 ERP 연동 상태와 필수 필드 구성이 본사와 다를 수 있음
- PC/Mobile 화면구조가 본사 CRM과 상이함

### 1.3 인도 및 향후 국가

인도 법인은 현재 외부 CRM을 사용하고 있으며 향후 DIO CRM으로 통합할 예정이다.

인도, 포르투갈, 튀르키예 등은 아직 상세 프로세스가 확정되지 않았으므로 본 문서에서 국가별 업무규칙을 임의 정의하지 않는다.

원칙:

```text
확인된 요구사항     → Profile / Template로 정의
미확정 국가 요구사항 → GAP / Analysis 대상
```

---

## 2. 현재 Source 구조 평가

현재 Source에는 Multi-Market 기반이 일부 구현되어 있다.

### 2.1 이미 구현된 기반

Backend:

```text
backend/src/globalization/
  market-profile.ts
  workflow-profile.ts
  globalization.service.ts
  feature.guard.ts
```

현재 `KR_SALES` Market Profile은 아래 Context를 가진다.

```text
countryCode
currencyCode
timezone
marketProfileCode
workflowProfileCode
mapProfileCode
features
```

`GlobalizationService`는 `crm_company` 및 `crm_user`를 기반으로 회사/사용자별 Locale, Country, Currency, Timezone, Market, Workflow, Map Profile을 Resolve한다.

Frontend:

```text
frontend/src/market/globalization-context.tsx
frontend/src/market/profiles/KR.ts
frontend/src/i18n/
```

현재 Frontend는 `/api/me/context`를 통해 Market Context와 Feature Toggle을 사용할 수 있다.

### 2.2 현재 구조의 한계

현재 `frontend/src/App.tsx`는 페이지 컴포넌트를 직접 Route에 연결한다.

```text
/accounts       → AccountsPage
/activities     → ActivitiesPage
/opportunities  → OpportunitiesPage
/contracts      → ContractsPage
...
```

따라서 현재 구조는 다음은 가능하다.

- 메뉴 On/Off
- Feature On/Off
- Locale 변경

하지만 다음은 구조적으로 부족하다.

- HQ Account와 Global Account의 완전히 다른 화면 선택
- 동일 Entity에 국가별 Section 순서 차이
- 국가별 Field Set 차이
- 국가별 다른 Activity Entry UI
- 국가별 다른 Order UI
- 국가별 다른 ERP Adapter 선택

`AccountsPage.tsx`와 `account-model.ts`도 현재 Field/Section이 정적으로 정의돼 있어 국가가 증가하면 국가별 조건문이 누적될 위험이 있다.

---

## 3. 핵심 설계 원칙

### 3.1 국가별 소스 Fork 금지

금지 구조:

```text
crm-kr
crm-us
crm-mx
crm-in
crm-pt
crm-tr
```

이 구조는 시간이 지나면 서로 다른 시스템이 되고 공통 수정사항의 동기화 비용이 급증한다.

권장 구조:

```text
DIO CRM Core
   ↓
Market Template
   ↓
Country Profile
   ↓
Screen / Field / Feature / Workflow / Integration Profile
```

### 3.2 Country와 Locale 분리

예:

```text
countryCode = US
locale      = ko-KR
currency    = USD
timezone    = America/Los_Angeles
```

UI 언어와 업무국가를 동일 개념으로 취급하지 않는다.

### 3.3 차이의 종류를 분리

국가별 차이는 반드시 다음으로 분류한다.

| 구분 | 예 | 처리 방식 |
|---|---|---|
| Language | 한국어/영어/스페인어 | Locale/i18n |
| Formatting | 날짜/통화/숫자 | Locale Profile |
| Field | Tax ID, VAT, 사업자번호 | Field Profile |
| Screen | Map 중심 / List 중심 | Screen Profile |
| Feature | 직출·직퇴, HIRA | Feature Profile |
| Workflow | 승인단계 | Workflow Profile |
| Integration | ERP/API/Map Provider | Integration Profile |

### 3.4 공통 Entity와 UI 표현을 분리

예:

```text
Account Entity
   │
   ├─ HQ_ACCOUNT_VIEW
   ├─ GLOBAL_ACCOUNT_VIEW
   └─ INDIA_ACCOUNT_VIEW (필요한 경우만)
```

Entity/API를 국가별로 복제하지 않는다.

---

## 4. 목표 Architecture

```text
                         DIO CRM CORE
 ┌───────────────────────────────────────────────────────────┐
 │ Auth / RBAC / Audit / Entity / API / Integration Queue   │
 │ Lead / Account / Contact / Activity / Opportunity        │
 │ Contract / Collection / Order / Sales / Analytics        │
 └──────────────────────────┬────────────────────────────────┘
                            │
                            ▼
                  MARKET TEMPLATE LAYER
         ┌──────────────────┴──────────────────┐
         │                                     │
       HQ_TEMPLATE                       GLOBAL_TEMPLATE
         │                                     │
         ▼                                     ▼
       KR Profile                    US / MX / PT / TR / ...
                                               │
                                               ▼
                                      Country Overrides
                                               │
                              ┌────────────────┼──────────────┐
                              │                │              │
                          Screen Profile   Field Profile   Workflow
                              │                │              │
                              └────────────┬───┴──────────────┘
                                           ▼
                                      React Renderer
                                           │
                                  PC / Mobile / PWA
```

---

## 5. Market Template 모델

국가 자체보다 상위의 `Market Template`을 둔다.

초기 Template 후보:

```text
HQ_TEMPLATE
GLOBAL_TEMPLATE
```

향후 인도 분석 결과 필요하면:

```text
GLOBAL_DISTRIBUTOR_TEMPLATE
```

등을 추가할 수 있다.

단, 인도 자료 분석 전에는 별도 Template을 선행 확정하지 않는다.

### 5.1 Market Template 책임

Market Template은 다음의 기본값을 가진다.

```ts
interface MarketTemplate {
  code: string;
  screenProfileCode: string;
  fieldProfileCode: string;
  featureProfileCode: string;
  workflowProfileCode: string;
  integrationProfileCode: string;
  mapProfileCode: string;
}
```

Country Profile은 Template을 상속하고 필요한 항목만 Override한다.

---

## 6. Country Profile 모델

예시:

```ts
interface CountryProfile {
  code: string;
  countryCode: string;
  marketTemplateCode: string;
  defaultLocale: string;
  currencyCode: string;
  timezone: string;

  screenOverrides?: Record<string, string>;
  fieldOverrides?: Record<string, string>;
  featureOverrides?: Record<string, boolean>;
  workflowProfileCode?: string;
  integrationProfileCode?: string;
  mapProfileCode?: string;
}
```

초기 운영 원칙:

```text
KR → HQ_TEMPLATE
US → GLOBAL_TEMPLATE
MX → GLOBAL_TEMPLATE
IN → 분석 후 결정
PT → 분석 후 결정
TR → 분석 후 결정
```

미확정 국가는 코드로 임의 구현하지 않는다.

---

## 7. Screen Profile / Screen Registry

### 7.1 목적

현재 `App.tsx`의 고정 Page import/route 구조를 Market별 Component 선택 구조로 전환한다.

### 7.2 Registry

```ts
const screenRegistry = {
  HQ_LEAD: HqLeadPage,
  GLOBAL_LEAD: GlobalLeadPage,

  HQ_ACCOUNT: HqAccountPage,
  GLOBAL_ACCOUNT: GlobalAccountPage,

  HQ_ACTIVITY: HqActivityPage,
  GLOBAL_ACTIVITY_MAP: GlobalActivityMapPage,
  GLOBAL_ACTIVITY_LOG: GlobalActivityLogPage,

  HQ_OPPORTUNITY: HqOpportunityPage,
  GLOBAL_OPPORTUNITY: GlobalOpportunityPage
};
```

### 7.3 Profile 예

```text
HQ_SCREEN_PROFILE
 lead        = HQ_LEAD
 account     = HQ_ACCOUNT
 activity    = HQ_ACTIVITY
 opportunity = HQ_OPPORTUNITY

GLOBAL_SCREEN_PROFILE
 lead        = GLOBAL_LEAD
 account     = GLOBAL_ACCOUNT
 activity    = GLOBAL_ACTIVITY_MAP
 opportunity = GLOBAL_OPPORTUNITY
```

### 7.4 Override 원칙

예를 들어 인도에서 Account만 구조가 크게 다를 경우:

```text
INDIA_PROFILE
 account = INDIA_ACCOUNT
```

나머지는 Global Component를 재사용한다.

---

## 8. Field / Section Profile

모든 차이를 별도 React Page로 만들지 않는다.

작은 차이는 Field/Section Profile로 처리한다.

예:

```ts
interface ScreenSectionProfile {
  screen: 'ACCOUNT';
  sections: Array<{
    code: string;
    visible: boolean;
    order: number;
    fields: string[];
  }>;
}
```

HQ 예:

```text
Summary
HIRA
Hospital Information
Address
ERP
Management
```

Global 예:

```text
Summary
Business Information
Address
Contacts
Activities
ERP Status
Related Sales
```

국가 특수 Field는 Profile에서 노출 여부를 결정한다.

---

## 9. Feature Profile

현재 Feature Toggle 구조는 유지·확장한다.

현재 예:

```text
HIRA_IMPORT
DIRECT_WORK
GPS_CHECKIN
ACTIVITY_APPROVAL
ERP_ACCOUNT_APPROVAL
MONTHLY_STATEMENT
```

해외법인 교육자료 기준으로 확인된 규칙:

```text
DIRECT_WORK = false
GPS_CHECKIN = true
ACTIVITY_APPROVAL = true
```

단, 실제 US/MX Profile 활성화 값은 기존 운영 요구사항 및 상세 분석 후 확정한다.

Frontend 메뉴 숨김뿐 아니라 Backend Guard에서도 동일 Feature를 검증해야 한다.

---

## 10. Workflow Profile

현재 `KR_SALES_APPROVAL`을 확장 가능한 Registry로 유지한다.

금지:

```ts
if (country === 'US') ...
if (country === 'MX') ...
```

권장:

```text
workflowProfileCode
  ↓
Workflow Registry
  ↓
Activity Approval / Contract Approval / Other Approval
```

국가별 승인 단계가 확인되기 전에는 임의 생성하지 않는다.

---

## 11. Integration Profile

국가에 따라 ERP Endpoint, Interface Contract, Map Provider 등이 다를 수 있으므로 `Integration Profile`을 별도 계층으로 둔다.

```ts
interface IntegrationProfile {
  code: string;
  erpAdapterCode: string;
  mapAdapterCode: string;
  customerMasterAdapterCode?: string;
  productAdapterCode?: string;
}
```

예:

```text
KR → HQ_ERP_ADAPTER
US → GLOBAL_ERP_ADAPTER
MX → GLOBAL_ERP_ADAPTER
```

실제 국가별 Adapter Mapping은 환경/인터페이스 명세가 확인된 후 정의한다.

---

## 12. Frontend 목표 구조

```text
frontend/src/

app/
  routes/
  screen-registry.ts

market/
  templates/
    HQ.ts
    GLOBAL.ts
  profiles/
    KR.ts
    US.ts
    MX.ts
  screen-profiles/
  field-profiles/
  feature-profiles/

features/
  lead/
    api/
    model/
    hooks/
    views/
      HqLeadPage.tsx
      GlobalLeadPage.tsx

  account/
    api/
    model/
    hooks/
    views/
      HqAccountPage.tsx
      GlobalAccountPage.tsx

  activity/
    api/
    model/
    hooks/
    views/
      HqActivityPage.tsx
      GlobalActivityMapPage.tsx
      GlobalActivityLogPage.tsx

  opportunity/
  contract/
  order/
```

핵심 원칙:

```text
API / Query / Model / Validation = 공통
View                          = Template별 분리 가능
```

---

## 13. Backend 목표 구조

```text
backend/src/globalization/
  market-template.ts
  country-profile.ts
  feature-profile.ts
  workflow-profile.ts
  integration-profile.ts
  profile-resolver.ts
```

`GlobalizationService`는 향후 다음 Context를 반환하도록 확장한다.

```text
countryCode
locale
currencyCode
timezone
marketTemplateCode
marketProfileCode
screenProfileCode
fieldProfileCode
featureProfileCode
workflowProfileCode
integrationProfileCode
mapProfileCode
```

---

## 14. DB 변경 원칙

기존 Migration `001~009`는 수정하지 않는다.

Multi-Market 구조는 신규 Migration에서 확장한다.

후보:

```text
010_multi_market_foundation.sql
```

예상 확장 대상:

```text
crm_company
  market_template_code
  screen_profile_code
  field_profile_code
  feature_profile_code
  integration_profile_code
```

Profile을 DB Master로 둘지 Source Registry로 둘지는 M1~M2 단계에서 결정한다.

### 14.1 국가별 Column 누적 금지

금지 예:

```text
kr_business_no
us_tax_id
mx_rfc
in_gstin
pt_vat
tr_tax_no
```

공통 필드는 Core Entity에 유지하고 국가 특수 Field는 Extension/Attribute Model을 사용한다.

후보:

```text
crm_account_market_attribute
  account_id
  attribute_code
  attribute_value
  country_code
```

또는 요구가 안정화된 경우 Template Extension Table을 검토한다.

---

## 15. HQ 보호 전략

이번 Refactoring의 최우선 요구사항은 기존 본사 기능 Regression 방지다.

원칙:

```text
현재 구현된 화면/기능
        ↓
HQ Template으로 먼저 감싼다
        ↓
동작 동일성 확인
        ↓
Global Template 분리
```

즉 기존 본사 페이지를 즉시 삭제/재작성하지 않는다.

초기에는 Adapter/Wrapper 방식으로 기존 Component를 HQ Registry에 연결하고 테스트를 통과한 후 내부 공통 Hook/Model을 점진적으로 추출한다.

---

## 16. GLOBAL Template 기준

GLOBAL Template의 최초 Source of Truth는 미국/멕시코 해외법인 판매/활동 교육자료로 한다.

### 16.1 판매 Template

```text
Lead
Account / Contact
Opportunity
Contract
Collection Plan
Order
ERP Integration Status
```

### 16.2 활동 Template

```text
Activity Plan
Activity Map
Activity Log
GPS IN / OUT
Activity Report
Activity Approval
```

확인된 해외법인 특성만 반영하며 문서에 없는 국가별 예외는 만들지 않는다.

---

## 17. 인도 통합 전략

인도는 현재 외부 CRM을 사용하고 있으므로 바로 개발하지 않고 먼저 Fit/Gap 분석한다.

분석 단위:

```text
Screen
Field
Status
Workflow
Approval
Integration
Report
Mobile Journey
```

판정 결과는 각 기능을 다음 세 가지로 분류한다.

```text
A. GLOBAL_REUSE
B. GLOBAL_OVERRIDE
C. NEW_TEMPLATE_REQUIRED
```

`NEW_TEMPLATE_REQUIRED`는 GLOBAL Template으로 해결하기 어려운 구조적 차이가 확인된 경우에만 사용한다.

---

## 18. 추가 국가 Onboarding 원칙

포르투갈, 튀르키예 등 신규 법인이 추가될 때 개발팀은 처음부터 Page를 만들지 않는다.

표준 순서:

```text
Country Requirement
 → GLOBAL Fit/Gap
 → Template 선택
 → Locale 설정
 → Field Override
 → Feature Override
 → Workflow 선택
 → Integration 선택
 → Screen Override 최소화
 → UAT
```

목표:

```text
신규 국가 배포 = 신규 CRM 개발
```

이 아니라:

```text
신규 국가 배포 = Profile 구성 + 최소 Override
```

가 되도록 한다.

---

## 19. Migration / Compatibility 전략

이번 Refactoring은 Big-Bang 방식으로 하지 않는다.

```text
Step 1  기존 기능 Baseline Test
Step 2  Market Template Context 추가
Step 3  Screen Registry 추가
Step 4  현재 Page를 HQ Registry로 연결
Step 5  Common Logic 추출
Step 6  GLOBAL Template 추가
Step 7  US/MX Profile 연결
Step 8  Regression Test
Step 9  신규 국가 Fit/Gap
```

기존 API Contract는 가능한 유지한다.

DB Schema 변경이 필요한 경우 Backward-compatible Migration을 우선한다.

---

## 20. 테스트 전략

필수 자동검증:

```text
Market Context Resolution
Screen Registry Resolution
Feature Guard
Workflow Resolution
Field Profile Resolution
HQ Regression
GLOBAL Template Rendering
Locale Switching
Responsive Mobile/PWA
```

Profile 조합 Test 예:

```text
KR + HQ_TEMPLATE
US + GLOBAL_TEMPLATE
MX + GLOBAL_TEMPLATE
```

인도/포르투갈/튀르키예는 요구사항 확정 전 CI Profile에 넣지 않는다.

---

## 21. 금지사항

다음 구현을 금지한다.

```text
1. 국가별 Repository Fork
2. 국가코드 if/else의 화면 전역 확산
3. Country별 Core Entity 복제
4. Country별 API Endpoint 복제
5. 미확정 국가 Workflow 추정 구현
6. Frontend에서만 Feature 제한
7. 기존 Migration 001~009 직접 수정
8. 인도 분석 전 INDIA Template 선행 개발
```

---

## 22. 완료 상태 정의

RM-MKT-001 Architecture Refactoring은 아래 조건 충족 시 Source 완료로 본다.

```text
Market Template Model          PASS
Country Profile Model          PASS
Screen Registry                PASS
Field/Section Profile          PASS
Feature Profile                PASS
Workflow Profile               PASS
Integration Profile Boundary   PASS
HQ Existing UI Regression      PASS
GLOBAL Template Baseline       PASS
US/MX Profile Baseline         PASS
Responsive/PWA Regression      PASS
CI                             PASS
Human Review                   APPROVED
```

실제 인도 CRM 통합 완료는 RM-MKT-001의 완료조건에 포함하지 않는다. 인도는 별도 Fit/Gap 및 Country Onboarding Work Item으로 진행한다.

---

## 23. 최종 설계 결론

DIO CRM은 `국가별 CRM`이 아니라 `Multi-Market CRM Platform`으로 전환한다.

```text
Core Business Logic
        +
Market Template
        +
Country Profile
        +
Screen Profile
        +
Field Profile
        +
Feature Profile
        +
Workflow Profile
        +
Integration Profile
        +
Locale Profile
```

현재 구현된 Globalization Foundation을 폐기하지 않고 상위 구조를 확장하며, 기존 본사 기능을 HQ Template으로 보호한 뒤 미국/멕시코 기준 GLOBAL Template을 추가하는 방식으로 Refactoring한다.
