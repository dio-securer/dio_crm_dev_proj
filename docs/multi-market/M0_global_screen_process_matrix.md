# RM-MKT-001 M0 — GLOBAL Screen / Process Matrix

- Work ID: `RM-MKT-001-M0`
- 목적: 미국/멕시코 해외법인 교육자료를 기준으로 `GLOBAL_TEMPLATE`의 화면/프로세스 후보를 추출하고 현재 Source의 재사용 가능 영역과 차이를 식별
- 상태: `M0 CANDIDATE MATRIX`
- 주의: 본 문서는 US/MX 공통 후보를 정리한 것이며 아직 US/MX Country Profile을 구현한 문서가 아니다.

---

## 1. 기준 자료

해외법인 기준:

```text
Salesforce 해외법인 판매 프로세스 사용자 매뉴얼.pdf
Salesforce 해외법인 활동 프로세스 사용자 매뉴얼.pdf
디오_Salesforce CRM 국내 추가개발 및 해외법인 확장 프로젝트_사용자 교육자료(국문_판매 프로세스)_v1.0_20250724_고객발송.pdf
디오_Salesforce CRM 국내 추가개발 및 해외법인 확장 프로젝트_사용자 교육자료(국문_활동 프로세스)_v1.0_20250724_고객발송.pdf
```

현재 Source 기준:

```text
frontend/src/*.tsx
frontend/src/market/
backend/src/modules/
backend/src/globalization/
packages/contracts/
```

---

## 2. GLOBAL 판매 프로세스 기준

해외법인 교육자료의 판매 흐름은 다음과 같다.

```text
Lead
  ↓
Account / Contact
  ↓
Opportunity / Package Proposal
  ↓
Contract
  ↓
Collection Plan
  ↓
ERP Contract Registration
  ↓
Order
  ↓
ERP Order / Delivery
  ↓
Sales / Collection
```

ERP 연동 경계:

```text
Account Registration Request
Contract Registration Request
Order Registration Request
Delivery / Sales / Collection Result
```

이 흐름은 현재 DIO CRM Core Domain과 높은 수준으로 일치하므로 Domain/API Fork보다 UI/Profile 분리가 우선이다.

---

## 3. GLOBAL 활동 프로세스 기준

해외법인 교육자료의 활동 흐름:

```text
Lead / Account / Opportunity
        ↓
Activity Plan
        ↓
Activity Registration
   ┌────┴────────┐
   │             │
Activity Map   Activity Log
(GPS/Google)   (Search/No Map)
   │             │
   └────┬────────┘
        ↓
IN → Activity Input → OUT
        ↓
Activity Report
        ↓
Activity Approval
```

해외법인 명시 규칙:

```text
Direct Work / Direct Leave 미사용
Web Activity Plan = 다건생성
Mobile Activity Plan = 단건생성
동일 활동일자 계획 중복 제한
Activity Map = GPS 기반 주변 병원
Activity Log = 병원 검색 기반
Activity Report = 완료 활동 + D+5 계획
OUT 미등록 활동이 있으면 승인요청 불가
```

---

## 4. Screen / Process Matrix — Sales

| Domain | GLOBAL 화면 후보 | 해외법인 자료 기준 | Current Source | 초기 판단 |
|---|---|---|---|---|
| Lead | `GLOBAL_LEAD` | 요약, 활동, 단계/Key Field, 기본, Keyman, 병원 규모/시스템, 기타 | `LeadsPage`는 목록/검색 중심. Backend Lifecycle API 존재 | 새 Global View 필요. Core API 재사용 |
| Lead Stage | `GLOBAL_LEAD` | 신규등록 → 초도방문 → 키맨미팅 → 변환 / 컨택제외 | Backend 상태가 동일 계열 | Workflow/Field Profile 중심 재사용 |
| Lead Convert | `GLOBAL_LEAD_CONVERT` 또는 Drawer | Account + Contact + Opportunity 생성 | Backend Convert API 존재 | UI 추가, API 재사용 |
| Contact | `GLOBAL_CONTACT` | 기본정보, 추가정보, 개원정보 | 독립 Frontend Page 없음 | Screen/Domain 노출 Gap |
| Account | `GLOBAL_ACCOUNT` | 요약, ERP 연동상태, 활동, 기본, 거래상태, 관리정보, 주소, ERP 정보 | `AccountsPage` 존재하나 HIRA/HQ Section 고정 | Global View + Field Profile 필요 |
| Account ERP Request | `GLOBAL_ACCOUNT` Action | 사업자/법정대리인/의료기관/Invoice email/주소 등 입력 후 ERP 요청 | ERP Account Request API 존재 | API 재사용, Global Field Set 필요 |
| Opportunity | `GLOBAL_OPPORTUNITY` | 요약, 활동, 단계/Key Field, 기회정보, 체크사항, 예상 계약정보 | 현재 `OpportunitiesPage` Stage/Product 지원 | 높은 재사용 가능. 화면 재구성 필요 |
| Opportunity Product | `GLOBAL_OPPORTUNITY_PRODUCT` | 제품 검색 → 선택 → 가격/수량 | Product Package API 존재 | API 재사용 |
| Won | `GLOBAL_OPPORTUNITY` | 단계 진행 후 수주성공/수주실패 | 현재 CLOSED_WON/CLOSED_LOST | Core 재사용 |
| Contract | `GLOBAL_CONTRACT` | ERP 상태, 기본, 패키지, 금액, 특약, 승인, 수금계획, 관련정보 | `ContractsPage` 존재 | API 재사용 + Global View |
| Collection Plan | `GLOBAL_CONTRACT` Subview | 행 수 생성 → 수금방법/일자 입력 | Collection Plan API 존재 | UI 확장 필요 |
| Contract ERP Request | `GLOBAL_CONTRACT` Action | CRM 계약 생성 후 ERP 등록 요청 | ERP Request API 존재 | Core 재사용 |
| Order | `GLOBAL_ORDER` | Contract Package 선택 → 품목유형/분류/검색 → 제품 → 단가/수량 → 배송지 | `OrdersPage` CRUD/배송/Submit 존재 | API 재사용, Multi-step Global UI 필요 |
| Fulfillment | `GLOBAL_FULFILLMENT` | 주문/납품 현황, 반품/교환 현황 | `FulfillmentPage` 존재 | 재사용 가능 |
| Sales/Collection | `GLOBAL_SALES` 또는 Account Related | ERP 결과 조회 | 현재 Sales/Collection/Analytics Domain 존재 | 재사용 가능 |

---

## 5. Screen / Process Matrix — Activity

| Domain | GLOBAL 화면 후보 | 해외법인 자료 기준 | Current Source | 초기 판단 |
|---|---|---|---|---|
| Activity Plan | `GLOBAL_ACTIVITY_PLAN` | Lead/Account 대상, 방문일정/목적, Web 다건/Mobile 단건 | `ActivitiesPage`에 단건 Form. Backend는 다건 API 지원 | Global Screen 분리 필요 |
| Direct Work | 없음 / Hidden | 해외법인 미사용, 계획 생성 시 공백 | HQ Source에 Feature/Approval 존재 | `DIRECT_WORK=false` 후보. HQ는 유지 |
| Activity Map | `GLOBAL_ACTIVITY_MAP` | Google, GPS 현재위치, 지도 내 병원 불러오기, 예정/주변/진행/완료 리스트 | Nearby API 존재. 실제 Map Provider Renderer 미연결 | 신규 Global Map View + Map Adapter 필요 |
| Activity Map IN/OUT | `GLOBAL_ACTIVITY_MAP` | 계획 선택/신규 Activity → IN → 입력 → 저장 → OUT | Check-in/out API 존재 | Core 재사용 |
| Activity Log | `GLOBAL_ACTIVITY_LOG` | Map 없이 병원 검색, Lead/Account 최대 100건, 예정/진행/완료 리스트 | 별도 Screen 없음 | 신규 Screen 필요. Core Activity API 재사용 |
| Activity Input | 공통 Form Component 후보 | 방문목적, 상담내용, 병원정보 | Current Activity Patch는 상담/목적 중심 | Field/API Gap 분석 필요 |
| Activity Report | `GLOBAL_ACTIVITY_REPORT` | 보고자/부서, 보고일, 완료활동, D+5 계획, 활동결과 입력 | 현재 Prepare Report가 완료활동 + D+5 구현 | 높은 재사용 가능 |
| Report Approval Request | `GLOBAL_ACTIVITY_REPORT` | OUT 누락 시 승인요청 불가 | Backend 동일 Rule 구현 | Core 재사용 |
| Activity Approval | `GLOBAL_ACTIVITY_APPROVAL` | 관리자 검색 → 보고목록 → 상세 → 승인 Comment → 승인 | 현재 `ActivityReportsPage`에 작성/승인 기능 혼합 | Global에서는 Approval Screen 분리 후보 |

---

## 6. 상세 Candidate — GLOBAL Lead

해외법인 Lead 화면 Section 후보:

```text
Summary
Activity History
Stage / Key Fields
Basic Information
Keyman Information
Hospital Scale / Systems
Other Information
```

Stage 후보:

```text
NEW
FIRST_VISIT
KEYMAN_MEETING
CONTACT_EXCLUDED
CONVERTED
```

### Current Source Reuse

```text
Lead List
Lead Detail API
Lead Update API
Lead Status API
Lead Assign API
Lead Convert API
```

### Gap

현재 `LeadsPage`에는 상세/편집/단계전환/변환 UI가 없다.

따라서 GLOBAL Template 구현 시 API를 새로 복제하지 말고 Frontend View를 확장한다.

---

## 7. 상세 Candidate — GLOBAL Account

해외법인 Account 화면 후보:

```text
Summary
ERP Integration Status
Activity History
Basic Information
Trade Status
Management Information
Address
ERP Information
Related Sales Data
```

### HQ와의 차이

현재 HQ Account Form은 다음 Section이 고정되어 있다.

```text
Identity
HIRA
Address
Basic
ERP
Management
```

GLOBAL에서 HIRA Section을 삭제하는 방식으로 기존 Page를 수정하지 않는다.

```text
HQ_ACCOUNT
  └─ HIRA / HQ Field Set

GLOBAL_ACCOUNT
  └─ Global Business / ERP Field Set
```

으로 분리한다.

---

## 8. 상세 Candidate — GLOBAL Opportunity

해외법인 Stage:

```text
니즈파악
제안
협상
수주성공
수주실패
```

현재 Source Stage와 의미상 대응:

```text
NEEDS_ANALYSIS
PROPOSAL
NEGOTIATION
CLOSED_WON
CLOSED_LOST
```

GLOBAL Opportunity 추가 Field/Section 후보:

```text
관심제품
타사사용현황
보유장비정보
수가정보
설명
특약사항
결제수단
결제일자
할부개월수
```

현재 Source에는 제품/금액/확률/Forecast 중심 기능이 있으므로 Field Profile과 View 확장이 필요하다.

---

## 9. 상세 Candidate — GLOBAL Contract / Collection

해외법인 Contract Section:

```text
ERP Integration Status
Contract Basic Information
Package Information
Contract Amount
Special Terms
Approval Information
ERP Information
Collection Plan
Related Information
```

현재 `ContractsPage`는 Contract 생성, 단일 수금계획, ERP 요청, Reconciliation을 제공한다.

GLOBAL 화면에서는 자료 기준의 Section 구조와 다건 수금계획 UX가 필요하지만 Core Service/API는 최대한 재사용한다.

---

## 10. 상세 Candidate — GLOBAL Activity Map

해외법인 매뉴얼의 Map UI는 단순 주변병원 List가 아니다.

필수 Candidate:

```text
Current Position Reset
Map Pan/Zoom
Load Hospitals In Current View
Marker
Today Planned Hospitals
Nearby Hospitals
Today In-Progress Hospitals
Today Completed Hospitals
Activity Registration Panel
```

현재 Source:

```text
navigator.geolocation
/api/activities/map/today
Unconfigured Map Adapter Boundary
```

따라서 M7에서:

```text
GLOBAL_ACTIVITY_MAP
        ↓
Map Adapter
        ↓
Configured Provider
```

구조를 사용한다.

매뉴얼은 Google 기반 화면을 보여주지만 실제 신규 DIO CRM Provider 선택/계약/키는 별도 Integration 결정사항이다.

---

## 11. 상세 Candidate — GLOBAL Activity Log

해외법인에는 지도 사용이 어려운 경우를 위한 별도 `영업 업무일지` 화면이 있다.

Candidate 기능:

```text
Hospital Search
Lead / Account Search Result
Today Planned List
Today In-Progress List
Today Completed List
Activity Selection
IN / OUT
Activity Input
```

현재 별도 Screen이 없으므로 `GLOBAL_ACTIVITY_LOG` 신규 View가 필요하다.

동일 Activity Domain을 사용하고 별도 Activity Entity를 만들지 않는다.

---

## 12. GLOBAL Feature Candidate

교육자료로 확인되는 범위에서만 후보를 정의한다.

| Feature | GLOBAL 후보 | 근거/상태 |
|---|---:|---|
| `HIRA_IMPORT` | false 후보 | 해외법인 자료에 HIRA 프로세스 없음 |
| `DIRECT_WORK` | false | 해외법인 활동계획에서 미사용 명시 |
| `GPS_CHECKIN` | true | Activity Map IN/OUT 사용 |
| `ACTIVITY_APPROVAL` | true | Activity Report Approval 존재 |
| `ERP_ACCOUNT_APPROVAL` | true | Account ERP 등록/승인 흐름 존재 |
| `MONTHLY_STATEMENT` | 미확정 | 제공된 해외법인 판매 매뉴얼 범위에 기능 확인 안 됨 |

주의:

`미확정`은 `false`와 다르다. US/MX 실제 운영 Requirement 확인 전 코드값을 확정하지 않는다.

---

## 13. GLOBAL Workflow Candidate

교육자료에는 활동보고 승인 프로세스가 존재하지만 실제 승인 조직 Role 명칭과 단계 수를 국가별로 동일하다고 확정할 근거는 부족하다.

따라서 M0에서는:

```text
GLOBAL Activity Approval = REQUIRED
GLOBAL Approval Actor Mapping = GAP
```

으로 둔다.

KR의:

```text
BRANCH_MANAGER → DIVISION_MANAGER
```

를 US/MX에 그대로 복사하지 않는다.

---

## 14. GLOBAL Integration Candidate

| Integration | 상태 |
|---|---|
| ERP Account | 필요 확인 |
| ERP Contract | 필요 확인 |
| ERP Order | 필요 확인 |
| ERP Delivery/Sales/Collection | 필요 확인 |
| Map | 필요. 해외법인 매뉴얼은 Google 화면 기준 |
| HIRA | 해외법인 기준 불필요 후보 |
| Product/Package Master | 필요하나 실제 Source/Endpoint 계약 추가 확인 |

실제 US/MX ERP Endpoint나 Payload는 제공된 교육자료만으로 확정할 수 없다.

따라서 Integration Profile은 Adapter Code까지만 설계하고 Endpoint/Secret을 임의 생성하지 않는다.

---

## 15. GLOBAL Screen Profile — Initial Candidate

아래는 M0 Candidate이며 M3/M7에서 확정한다.

```text
GLOBAL_SCREEN_PROFILE

lead              GLOBAL_LEAD
account           GLOBAL_ACCOUNT
contact           GLOBAL_CONTACT
activityPlan      GLOBAL_ACTIVITY_PLAN
activityMap       GLOBAL_ACTIVITY_MAP
activityLog       GLOBAL_ACTIVITY_LOG
activityReport    GLOBAL_ACTIVITY_REPORT
activityApproval  GLOBAL_ACTIVITY_APPROVAL
opportunity       GLOBAL_OPPORTUNITY
contract          GLOBAL_CONTRACT
order             GLOBAL_ORDER
fulfillment       GLOBAL_FULFILLMENT
```

Pipeline / Analytics / Account360은 공통 Page 재사용 가능성이 높으나 Field/Section Profile 검토 후 확정한다.

---

## 16. Current Source Reuse Matrix

| Current Component | HQ | GLOBAL | 판단 |
|---|---|---|---|
| `LeadsPage` | 유지 | 직접 재사용 부족 | Core List 로직 분리 후보 |
| `AccountsPage` | HQ 기준선 | 직접 재사용 위험 | API/Hook 분리 후 별도 Global View |
| `ActivitiesPage` | HQ 기준선 | 구조 차이 큼 | Activity Core/Hook 분리 필요 |
| `ActivityReportsPage` | HQ 기준선 | 일부 재사용 | 작성/승인 Screen 분리 검토 |
| `DirectWorkPage` | 유지 | 미사용 | HQ Only |
| `OpportunitiesPage` | 유지 | 높은 재사용 | View/Profile 확장 |
| `PipelinePage` | 유지 | 높은 재사용 | Currency/Locale 이미 대응 |
| `ContractsPage` | 유지 | 높은 API 재사용 | Global Layout 필요 |
| `OrdersPage` | 유지 | 높은 API 재사용 | Global Multi-step Layout 필요 |
| `FulfillmentPage` | 유지 | 높은 재사용 | 상태/문구 Profile 검토 |
| `LedgerStatementsPage` | 유지 | 미확정 | Country Feature 결정 필요 |
| `Account360Page` | 유지 | 재사용 후보 | Service Gap 유지 |
| `AnalyticsDashboardPage` | 유지 | 재사용 후보 | Metrics Profile 검토 |
| `OpsStatusPage` | 공통 | 공통 | System Screen |

---

## 17. Fit / Gap Summary

### 높은 Fit

```text
Domain Entity
REST API Foundation
Auth/RBAC/Audit
Lead Status
Opportunity Stage
Contract Core
Collection Core
Order Core
Fulfillment
Activity IN/OUT Rule
Activity Report D+5
Localization Formatting
```

### UI Gap

```text
GLOBAL Lead Detail
GLOBAL Contact
GLOBAL Account Layout
GLOBAL Activity Plan Web/Mobile 차이
GLOBAL Activity Map
GLOBAL Activity Log
GLOBAL Activity Approval 별도 화면
GLOBAL Opportunity 상세 Field
GLOBAL Contract Section Layout
GLOBAL Order Multi-step UX
```

### Profile Gap

```text
Market Template
Country Profile
Screen Profile
Field Profile
Workflow Profile
Integration Profile
```

### Requirement Gap

```text
US/MX 실제 승인 조직/Role Mapping
US/MX ERP Endpoint / Payload / Error Contract
US/MX Product/Package Master Source
MONTHLY_STATEMENT 사용여부
각 법인 Map Provider 계약/키/도메인
```

---

## 18. India / Portugal / Türkiye 처리 원칙

M0에서는 아래 국가의 Screen/Workflow를 만들지 않는다.

```text
IN
PT
TR
```

추후 Requirement 자료를 받아:

```text
GLOBAL_TEMPLATE Fit
        │
        ├─ Fit → Country Profile만 추가
        └─ Gap → 필요한 Screen/Field/Workflow만 Override
```

방식으로 판단한다.

---

## 19. M0 GLOBAL Matrix Result

```text
GLOBAL 판매 흐름 추출          COMPLETE
GLOBAL 활동 흐름 추출          COMPLETE
Screen Candidate 추출          COMPLETE
Current Source Reuse 분석      COMPLETE
HQ/GLOBAL 차이 식별            COMPLETE
Feature Candidate 정리         COMPLETE
Workflow/Integration GAP 정리  COMPLETE
```

### M0 결론

US/MX 해외법인 프로세스는 현재 Core Domain을 상당 부분 재사용할 수 있다.

가장 큰 변경은 Domain 재개발이 아니라:

```text
Screen Registry
Field / Section Profile
HQ / GLOBAL View 분리
Workflow Profile
Integration Adapter
```

이다.

M1에서는 이 Matrix를 기반으로 공통 Contract에 Multi-Market Profile Code를 추가한다.
