# RM-MKT-001 M0 — Source Inventory

- Work ID: `RM-MKT-001-M0`
- Parent: `RM-MKT-001`
- Scope: Baseline Freeze / Source Inventory
- Baseline branch: `main`
- Baseline head: `f7cbc53d88152aa8b753e4e6525df1adbe7d70d6`
- Baseline date: `2026-09-15`
- Source change: `NO`
- DB change: `NO`
- Environment change: `NO`

---

## 1. 목적

현재 `main`의 동작과 구조를 Multi-Market Refactoring의 회귀 기준선으로 고정한다.

M0는 기능을 추가하거나 화면을 변경하는 단계가 아니다. 현재 구현을 있는 그대로 목록화하고, 이후 `HQ_TEMPLATE`과 `GLOBAL_TEMPLATE`로 분리할 때 보존해야 할 경계와 위험요소를 식별한다.

---

## 2. Baseline Summary

현재 Source는 아래 기반을 이미 가진다.

```text
React + TypeScript Frontend
NestJS + TypeScript Backend
SQL Server
packages/contracts 공통 Contract
Globalization Context
Market Feature Guard
Workflow Profile
Locale / Currency / Timezone Formatting
ERP Interface Queue / Circuit Breaker
PWA Foundation
```

다만 UI Route와 Page Component 선택은 아직 고정형이며, Market에 따라 다른 Page Component를 선택하는 Screen Registry 구조는 없다.

---

## 3. Frontend Route Inventory

현재 `frontend/src/App.tsx` 기준 Route는 아래와 같다.

| Route | Page | Navigation | Feature Gate |
|---|---|---|---|
| `/` | `LeadsPage` | Lead | 없음 |
| `/accounts` | `AccountsPage` | Account | 없음 |
| `/activities` | `ActivitiesPage` | Activity | 없음 |
| `/activity-reports` | `ActivityReportsPage` | Activity Report | `ACTIVITY_APPROVAL` |
| `/direct-work` | `DirectWorkPage` | Direct Work | `DIRECT_WORK` |
| `/opportunities` | `OpportunitiesPage` | Opportunity | 없음 |
| `/pipeline` | `PipelinePage` | Pipeline | 없음 |
| `/contracts` | `ContractsPage` | Contract | 없음 |
| `/orders` | `OrdersPage` | Order | 없음 |
| `/fulfillment` | `FulfillmentPage` | Fulfillment | 없음 |
| `/ledger-statements` | `LedgerStatementsPage` | Ledger | 없음. 내부 월합명세서 기능만 Feature Gate 적용 |
| `/account360` | `Account360Page` | Account360 | 없음 |
| `/analytics` | `AnalyticsDashboardPage` | Analytics | 없음 |
| `/ops` | `OpsStatusPage` | Ops | 없음 |
| `*` | `/` redirect | - | - |

### 3.1 Route 구조 평가

현재 구조:

```text
Route → 고정 Page Component
```

예:

```text
/accounts   → AccountsPage
/activities → ActivitiesPage
```

따라서 메뉴 노출 여부는 Feature로 조절할 수 있으나, 동일 Route에서 Market별로 다른 Page를 선택하는 구조는 아직 없다.

M3에서 다음 구조로 확장할 필요가 있다.

```text
Route
  ↓
Screen Resolver
  ↓
Screen Profile
  ↓
HQ / GLOBAL / Country Override Component
```

---

## 4. Frontend Page → API Endpoint Inventory

### 4.1 Lead

`LeadsPage.tsx`

```text
GET /api/leads
GET /api/leads?search={search}
```

현재 UI는 조회 중심이다. Backend에는 Lead 상세, 수정, 상태전환, 담당자 할당, 변환 API가 있으나 현재 Lead Page에는 생성/단계전환/변환 UI가 연결되어 있지 않다.

Backend 주요 API:

```text
GET   /api/leads
GET   /api/leads/:publicId
PATCH /api/leads/:publicId
POST  /api/leads/:publicId/status
POST  /api/leads/:publicId/assign-owner
POST  /api/leads/:publicId/convert
```

### 4.2 Account

`AccountsPage.tsx`

```text
GET   /api/accounts?scope={scope}&search={search}
POST  /api/accounts
PATCH /api/accounts/:publicId
POST  /api/erp-accounts/:publicId/request
```

Backend 추가 Account API:

```text
GET  /api/accounts/:publicId
GET  /api/accounts/duplicates/:businessNo
POST /api/accounts/merge
```

HQ 전용 성격이 강한 HIRA API:

```text
POST /api/integrations/hira/hospitals/import
Feature: HIRA_IMPORT
```

### 4.3 Activity

`ActivitiesPage.tsx`

```text
GET   /api/activities/calendar?from={date}&to={date}
GET   /api/leads
GET   /api/accounts
POST  /api/activities/plans
POST  /api/activities/:publicId/check-in
PATCH /api/activities/:publicId
POST  /api/activities/:publicId/check-out
GET   /api/activities/map/today?date=...&latitude=...&longitude=...&radiusKm=10
```

현재 한 Page 안에 다음 기능이 함께 존재한다.

```text
Activity Plan
GPS IN / OUT
Consultation Update
Nearby Hospital List
Direct Work Field
```

### 4.4 Activity Report

`ActivityReportsPage.tsx`

```text
GET   /api/activity-reports
POST  /api/activity-reports/prepare
POST  /api/activity-reports/:publicId/request-approval
POST  /api/activity-reports/:publicId/approve/branch
POST  /api/activity-reports/:publicId/approve/division
PATCH /api/activity-reports/:publicId/items/:itemId
```

현재 작성/승인대기열/지점승인/본부승인이 한 Page에 함께 존재한다.

### 4.5 Direct Work

`DirectWorkPage.tsx`

```text
GET  /api/direct-work
POST /api/direct-work/:publicId/request-approval
POST /api/direct-work/:publicId/decision/branch
POST /api/direct-work/:publicId/decision/division
```

### 4.6 Opportunity

`OpportunitiesPage.tsx`

```text
GET   /api/opportunities
GET   /api/accounts
GET   /api/product-packages
POST  /api/opportunities
POST  /api/opportunities/:publicId/stage
POST  /api/opportunities/:publicId/products
PATCH /api/opportunities/:publicId
```

현재 Stage 목록은 Frontend 상수로 고정되어 있다.

```text
NEEDS_ANALYSIS
PROPOSAL
NEGOTIATION
CLOSED_WON
CLOSED_LOST
```

### 4.7 Pipeline

`PipelinePage.tsx`

```text
GET /api/opportunities/pipeline/funnel
```

### 4.8 Contract / Collection

`ContractsPage.tsx`

```text
GET  /api/contracts
GET  /api/opportunities
POST /api/contracts
POST /api/contracts/:publicId/collection-plans
POST /api/contracts/:publicId/erp-request
GET  /api/contracts/:publicId/reconciliation
```

### 4.9 Order

`OrdersPage.tsx`

```text
GET   /api/orders/eligible-contracts
GET   /api/order-products
GET   /api/orders
POST  /api/orders
POST  /api/orders/:publicId/items
PATCH /api/orders/:publicId/delivery
POST  /api/orders/:publicId/submit
```

### 4.10 Fulfillment / Sales / Return

`FulfillmentPage.tsx`

```text
GET /api/orders
GET /api/sales
GET /api/orders/:publicId/fulfillment
```

### 4.11 Ledger / Monthly Statement

`LedgerStatementsPage.tsx`

```text
GET  /api/accounts
GET  /api/analytics/accounts/:accountId/contracts
GET  /api/analytics/accounts/:accountId/ledger
GET  /api/analytics/accounts/:accountId/ledger.xlsx
GET  /api/analytics/accounts/:accountId/statements
POST /api/analytics/accounts/:accountId/statements/pdf
```

`MONTHLY_STATEMENT`는 Statement 조회/PDF 기능에 적용되어 있다.

### 4.12 Account360

`Account360Page.tsx`

```text
GET /api/accounts
GET /api/analytics/accounts/:accountId/360
```

Customer Center / Service는 현재 구현되지 않은 상태를 명시적으로 반환하는 구조다.

### 4.13 Analytics

`AnalyticsDashboardPage.tsx`

```text
GET /api/analytics/dashboard?from={from}&to={to}
```

### 4.14 Ops

`OpsStatusPage.tsx`

```text
GET /api/ops/status
```

### 4.15 Globalization Context

`GlobalizationProvider`

```text
GET /api/me/context
```

로그인 토큰이 존재하면 회사/사용자 기준 Globalization Context를 조회한다.

---

## 5. Current Market / Workflow / Feature Profile Inventory

### 5.1 Contract

현재 `GlobalizationContext`:

```text
locale
countryCode
currencyCode
timezone
marketProfileCode
workflowProfileCode
mapProfileCode
features
```

### 5.2 Market Profile

현재 Backend Registry에 등록된 Profile은 하나다.

```text
KR_SALES
```

값:

```text
countryCode         KR
currencyCode        KRW
timezone            Asia/Seoul
marketProfileCode   KR_SALES
workflowProfileCode KR_SALES_APPROVAL
mapProfileCode      KR_DEFAULT
defaultLocale       ko-KR
```

Frontend `profiles/`에도 현재 `KR.ts`만 존재한다.

### 5.3 Feature Keys

현재 공통 Contract에 정의된 Feature:

```text
HIRA_IMPORT
DIRECT_WORK
GPS_CHECKIN
ACTIVITY_APPROVAL
ERP_ACCOUNT_APPROVAL
MONTHLY_STATEMENT
```

현재 `KR_SALES`에서는 모두 `true`다.

### 5.4 Workflow Profile

현재 Registry:

```text
KR_SALES_APPROVAL
```

Activity Report:

```text
1. BRANCH_MANAGER
2. DIVISION_MANAGER
```

Direct Work:

```text
1. BRANCH_MANAGER
2. DIVISION_MANAGER
```

### 5.5 Locale

현재 Frontend Locale Resource:

```text
ko-KR
en-US
```

`en-US`는 해외법인 프로세스 전체가 구현됐다는 의미가 아니라 기술적 Reference Locale이다.

### 5.6 Map

`MapRenderer` / `MapAdapterProps` 추상화는 존재한다.

현재 실제 Provider Component는 연결되어 있지 않으며 기본 구현은 `UnconfiguredMap`이다.

`ActivitiesPage`는 현재 브라우저 Geolocation과 `/api/activities/map/today` 응답을 이용해 주변 병원을 List로 출력한다.

---

## 6. Backend Module Inventory

`AppModule` 기준 주요 Module/Controller:

```text
Auth
Platform / Common Code
Customer
  - Lead
  - Account
  - HIRA
Activity
  - Activity
  - Activity Report
  - Direct Work
  - Approval Route
Opportunity
  - Opportunity
  - Product / Package
Contract
  - Contract
  - ERP Account
  - ERP Result
Order
  - Order Product
  - Order
  - Sales
  - ERP Fulfillment
Analytics
Ops / Health
Globalization
Integration
```

Multi-Market Refactoring은 위 Domain Module 자체를 국가별로 복제하지 않고 Profile Resolver를 통해 동작 차이를 주는 것을 원칙으로 한다.

---

## 7. DB Migration Baseline

### 7.1 실제 main에 존재하는 Migration

현재 main에는 `001~010`이 존재한다.

```text
001_phase1_foundation.sql
002_phase2_customer.sql
003_phase3_activity.sql
004_phase4_opportunity.sql
005_phase5_contract_collection.sql
006_phase6_order_delivery_sales.sql
007_phase7_analytics.sql
008_phase8_hardening.sql
009_globalization_foundation.sql
010_account_interface_fields.sql
```

### 7.2 중요 발견사항

기존 RM-MKT-001 작업지시서는 M0에서 `001~009`를 고정하고 M9에서 `010` 신규 Migration을 만드는 방향으로 작성되어 있다.

그러나 실제 main에는 이미:

```text
010_account_interface_fields.sql
```

이 존재한다.

따라서 M0 기준으로 다음을 확정한다.

```text
001~010 기존 Migration 수정 금지
```

향후 RM-MKT-001 DB Foundation 신규 Migration 번호는 충돌 방지를 위해 기본적으로:

```text
011_market_template_foundation.sql
```

후보로 사용해야 한다.

M9 진입 전 설계/작업지시서의 Migration 번호를 정정한다.

### 7.3 Migration Runner 확인

`devuat-migration-plan.mjs`는 디렉터리의 `NNN_*.sql` 파일을 정렬하여 모두 실행한다.

`expected` 배열은 `001~009` 누락 여부만 검사하지만 실제 실행 Loop에는 `010`도 포함된다.

따라서 DEV/UAT Migration을 실제 실행할 경우 현재 Source 기준으로 `010`도 실행 대상이다.

---

## 8. Market Refactoring Risk Inventory

### R-01 Fixed Route → Fixed Page

현재 `App.tsx`는 Profile과 무관하게 Page가 고정되어 있다.

영향:

```text
HQ Account와 Global Account가 크게 달라도 동일 AccountsPage를 사용하게 됨
```

조치 단계: `M3`

---

### R-02 KR Fallback가 전역 기본값

Frontend `GlobalizationProvider`는 Server Context를 얻지 못하면 `KR_MARKET_PROFILE`을 Fallback으로 사용한다.

Multi-Market 도입 시 인증 전/Context 오류 시 해외법인 사용자가 KR 기능을 잘못 보지 않도록 Fallback 정책을 검토해야 한다.

조치 단계: `M1~M2`

---

### R-03 Account Field / Section가 HQ 중심으로 고정

현재 Account Form에는 다음과 같은 국내/HQ 성격 Field가 함께 들어 있다.

```text
HIRA
providerNo
encryptedProviderNo
doctorLicenseNo
businessNo
ERP Trade / Approval
```

Section도 다음처럼 정적으로 선언된다.

```text
identity
hira
address
basic
erp
manage
```

조치 단계: `M4`, `M6`, `M7`

---

### R-04 Activity UI가 HQ 기능을 함께 포함

`ActivitiesPage`는 `DIRECT_WORK` Feature가 켜진 경우 직출/직퇴 입력을 같은 Form에 노출한다.

해외법인 매뉴얼은 직출·직퇴를 사용하지 않으므로 GLOBAL 화면에서는 Feature 비활성화뿐 아니라 화면 배치 자체가 다를 수 있다.

조치 단계: `M5~M7`

---

### R-05 Approval Actor가 UI에도 고정

`ActivityReportsPage`와 `DirectWorkPage`는 `branch`, `division`을 직접 호출하고 Label도 지점/본부 단계에 맞춰져 있다.

Backend Workflow Profile만 변경해도 Frontend Approval UI가 자동으로 바뀌는 구조가 아니다.

조치 단계: `M5`

---

### R-06 Opportunity Stage UI 상수 고정

현재 Opportunity Stage 배열이 Page에 직접 선언되어 있다.

향후 Market별 단계가 다르면 Profile 기반 Stage/Workflow 구성이 필요하다.

단, US/MX 매뉴얼의 기본 단계는 현재 Source와 큰 틀에서 유사하므로 우선 공통화 가능성이 높다.

조치 단계: `M4~M7`

---

### R-07 Map Adapter Boundary는 있으나 실제 Screen에서 미사용

Provider-independent Map Adapter Type은 존재하지만 `ActivitiesPage`는 실제 Map Renderer를 사용하지 않는다.

해외법인 매뉴얼의 Google 기반 영업활동지도 UI를 구현하려면 Screen Profile + Map Adapter 결합이 필요하다.

조치 단계: `M5~M7`

---

### R-08 Account Sandbox Fallback

`AccountsPage`는 API Error 발생 시 Local Sandbox Account 데이터로 전환되는 경로가 있다.

실환경에서 API 장애를 데이터 정상조회처럼 오인할 수 있으므로 DEV Demo 기능인지 운영기능인지 향후 분리 판단이 필요하다.

M0에서는 기능을 변경하지 않는다.

---

## 9. Reuse Boundary — Initial Classification

| 영역 | Core 재사용 | HQ Template | GLOBAL Template | 추가 분석 |
|---|---|---|---|---|
| Auth/RBAC/Audit | 높음 | 공통 | 공통 | 낮음 |
| Lead Domain/API | 높음 | HQ View | GLOBAL View | 중간 |
| Account Domain/API | 높음 | HQ/HIRA View | Global Business View | 높음 |
| Activity Domain/API | 높음 | Direct Work 포함 | Map/Log 중심 | 높음 |
| Opportunity Domain/API | 높음 | HQ View | Global View | 중간 |
| Contract/Collection | 높음 | HQ View | Global View | 중간 |
| Order/Fulfillment | 높음 | HQ View | Global View | 중간 |
| Analytics | 높음 | Profile 필요 | Profile 필요 | 중간 |
| HIRA | 낮음 | HQ 전용 | 기본 비노출 후보 | 낮음 |
| Direct Work | 낮음 | HQ 전용 | 해외법인 미사용 | 낮음 |
| Monthly Statement | Domain 재사용 가능 | HQ 요구 확인됨 | 해외 매뉴얼 미확정 | 중간 |
| Map Provider | Adapter 재사용 | Provider 미연결 | Google 매뉴얼 기준 후보 | 높음 |

---

## 10. M0 Source Inventory Result

```text
현재 main Head 기록        COMPLETE
Frontend Route 목록         COMPLETE
Market Profile 목록         COMPLETE
Workflow Profile 목록       COMPLETE
Feature Profile 목록        COMPLETE
Page/API Endpoint 목록      COMPLETE
Migration Baseline          COMPLETE
Risk Inventory              COMPLETE
```

### M0 주요 결론

1. 현재 Globalization Foundation은 Multi-Market 확장 기반으로 재사용 가능하다.
2. 가장 큰 구조변경 대상은 Frontend Screen 선택과 Field/Section 구성이다.
3. Domain/API를 국가별로 Fork할 필요는 없다.
4. HQ 기능은 Feature Toggle만으로 보호하기 부족하며 `HQ_TEMPLATE` 화면 기준선이 필요하다.
5. US/MX는 별도 Repository가 아니라 `GLOBAL_TEMPLATE + Country Profile`로 수용할 수 있는 가능성이 높다.
6. 실제 Migration은 이미 `010`까지 존재한다. RM-MKT-001 신규 Migration은 `011`부터 시작해야 한다.
7. 인도/포르투갈/튀르키예는 M0에서 임의 구현하지 않는다.

---

## 11. 다음 단계

M0 산출물 3종 Review 완료 후:

```text
RM-MKT-001 M1 — Multi-Market Contract 확장
```

으로 진행한다.
