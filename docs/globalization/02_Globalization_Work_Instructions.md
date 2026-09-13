# DIO CRM 국가/다국어 적용 작업지시서

- 문서명: DIO CRM Globalization Work Instructions
- 버전: v1.0
- 작성일: 2026-09-13
- 선행문서: `docs/globalization/01_Globalization_Architecture_Design.md`
- 대상: React/Vite Frontend, NestJS Backend, SQL Server, Integration Framework, 향후 PWA/App
- 상태: `WORK INSTRUCTION BASELINE`

---

# 1. 목표

기존 Phase 0~8 CRM Source Baseline을 유지하면서 다음을 추가한다.

```text
다국어(i18n)
+ Locale Formatting
+ Company/Market Context
+ Feature/UI Profile
+ Workflow Profile
+ 국가별 Integration/Map Boundary
```

최종 목표는 국가별 Fork 없이 하나의 DIO CRM Core로 여러 국가/언어를 지원하는 것이다.

---

# 2. 공통 실행 원칙

모든 Work Package는 다음 순서를 따른다.

```text
1. Orchestrator: Work Package 생성
2. Requirement/Domain: 국가 차이와 공통규칙 분리
3. Architect: Context/Profile 경계 확인
4. Data: DB 영향분석
5. Backend: Server-side Enforcement
6. Frontend: i18n/Profile 적용
7. Integration: Adapter 경계 확인
8. QA: Locale/Market/E2E Test
9. Review: Hard-code/Bypass/Regression 검토
10. Human Gate
11. PR Merge
```

## 2.1 금지

- 국가별 Repository 또는 App Fork
- 설계 승인 없이 Production/UAT DB 변경
- 지원하지 않는 국가 업무규칙 임의 생성
- 화면 숨김만으로 국가 Feature 비활성 처리
- 새로운 한국어 문구 하드코딩
- 번역 문장을 Backend Business Rule에 사용
- 모든 국가 차이를 Component if문으로 구현

---

# 3. Branch / PR 기준

권장 Branch:

```text
globalization/foundation
```

권장 PR 제목:

```text
Globalization Foundation: i18n / Market Profiles
```

본 작업은 기존 Phase 0~8의 업무기능을 변경하는 프로젝트가 아니라 공통 Globalization Layer를 추가하는 작업으로 취급한다.

---

# 4. G0 — Globalization Specification Gate

## 목표

구현 전에 지원 범위와 미정의 사항을 확정한다.

## G0-01 Initial Locale 결정

결정 항목:

```text
- 최초 배포 Locale
- Default Locale
- Fallback Locale
- 번역 검수 책임자
```

설계가 지원할 후보:

```text
ko-KR
en-US
ja-JP
zh-CN
zh-TW
```

실제 1차 구현 범위는 Product Owner 승인으로 확정한다.

## G0-02 Initial Market 결정

각 Market에 대해 다음을 조사한다.

```text
country_code
default_locale
currency
timezone
address format
customer identifiers
feature differences
approval differences
ERP/local integrations
map requirements
```

미확정 값은 `SPEC GAP`으로 남긴다.

## G0-03 Gap Register

생성 권장:

```text
spec/gaps/globalization_open_gaps.md
```

최소 Gap:

- 국가별 승인 Workflow
- 국가별 사업자/고객 식별번호
- 국가별 ERP/현지 시스템
- 국가별 Map Provider
- 개인정보/보존정책
- 국가별 직출/직퇴 사용 여부
- 국가별 GPS 정책
- 국가별 세금/통화 Reporting 기준

## G0 완료기준

```text
[ ] Initial Locale 범위 승인
[ ] Initial Market 범위 승인
[ ] 지원/미지원 기능 구분
[ ] Open Gap 등록
[ ] Architecture Review 승인
```

---

# 5. G1 — Frontend i18n Foundation

## 목표

현재 React 화면의 직접 문구를 Locale Resource 기반으로 전환할 기반을 만든다.

## G1-01 Dependency

추가 후보:

```text
i18next
react-i18next
```

Version은 구현 시 현재 프로젝트 Node/React 버전과 호환되는 안정 버전을 선택한다.

## G1-02 Folder

생성:

```text
frontend/src/i18n/
  index.ts
  locale-resolver.ts
  locales/
    ko-KR/
      common.json
      lead.json
      account.json
      activity.json
      approval.json
      opportunity.json
      contract.json
      collection.json
      order.json
      analytics.json
      ops.json
```

승인된 Locale만 실제 Resource를 생성한다.

## G1-03 Translation Key 규칙

예:

```text
common.search
common.save
common.cancel
lead.title
account.erp.request
activity.checkIn
activity.checkOut
approval.approve
approval.reject
```

금지:

```text
t('조회')
t('활동보고 및 승인')
```

## G1-04 Locale Provider

App 최상위에 Locale Provider를 구성한다.

필수:

- 초기 Locale Resolve
- Runtime 언어 변경
- local storage/cache 정책
- 로그인 후 User Preference 동기화
- Fallback

## G1 Tests

```text
[ ] Locale switching
[ ] Missing key fallback
[ ] Namespace lazy/load 여부
[ ] UI rerender
[ ] 한국어 기본 Regression
```

---

# 6. G2 — Formatting Foundation

## 목표

문구 번역과 별도로 날짜/시간/금액/숫자 표시를 표준화한다.

## 생성

```text
frontend/src/formatting/
  currency.ts
  datetime.ts
  number.ts
  address.ts
  phone.ts
```

## G2-01 Currency

`Intl.NumberFormat` 기반.

입력:

```text
locale
currencyCode
amount
```

화면에서 직접 `₩` 또는 `$`를 문자열 연결하지 않는다.

## G2-02 Date / Time

`Intl.DateTimeFormat` 기반.

구분:

```text
Date-only
Timestamp
```

Timestamp는 Timezone Context를 적용한다.

## G2-03 Numeric Input

저장값과 표시값을 분리한다.

```text
Display: 1,234.50
Domain : 1234.5
```

## G2 Tests

최소:

```text
ko-KR / KRW / Asia/Seoul
en-US / USD / US timezone
ja-JP / JPY / Asia/Tokyo
```

활성 Locale만 CI Required Test로 한다.

---

# 7. G3 — Company / Market Context

## 목표

로그인한 사용자의 회사/국가 업무 Context를 Frontend와 Backend가 동일하게 인지한다.

## G3-01 Shared Contract

`packages/contracts`에 Globalization Context Type을 추가한다.

후보:

```ts
interface GlobalizationContext {
  locale: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  marketProfileCode: string;
  workflowProfileCode?: string;
  mapProfileCode?: string;
  features: Record<string, boolean>;
}
```

실제 이름/필드는 구현 Review에서 확정한다.

## G3-02 Context API

후보:

```text
GET /api/me/context
```

반환:

```text
User
Company
Locale
Market
Currency
Timezone
Features
```

## G3-03 Context Resolver

Backend에서 `company_id`를 기준으로 Market Context를 Resolve한다.

Client가 전달한 Country 값만 신뢰하지 않는다.

## G3 Tests

- 서로 다른 company_id Context
- User preferred locale
- Invalid market profile
- Missing default locale
- Unauthorized company context switch

---

# 8. G4 — Database Globalization Foundation

## 목표

국가/Locale/Profile 정보를 저장할 Schema를 마련한다.

## 선행조건

- G0 Architecture Review 승인
- 실제 DEV/UAT DB 적용 승인과는 별도

## Migration 후보

```text
database/migrations/009_globalization_foundation.sql
database/seeds/009_globalization_seed.sql
```

## G4-01 Company 확장 후보

```text
country_code
default_locale
default_currency
default_timezone
market_profile_code
workflow_profile_code
map_profile_code
```

## G4-02 User 확장 후보

```text
preferred_locale
timezone_override
```

## G4-03 Profile 저장방식 결정

Architecture Review에서 다음 중 선택한다.

```text
A. Code-based Version Controlled Profile
B. DB Profile Table
C. Hybrid
```

초기 권장:

```text
중요 업무규칙 = Version Controlled
운영 변경 가능 설정 = DB
```

## G4-04 Existing Data Migration

기존 Company에는 명시적으로 현재 운영 기본값을 Seed한다.

예상 Baseline 후보:

```text
country_code = KR
locale = ko-KR
currency = KRW
timezone = Asia/Seoul
```

실제 회사 데이터 값은 DB 적용 전 사용자가 확인한다.

## G4 Gate

```text
[ ] Migration script review
[ ] Existing data impact review
[ ] Rollback plan
[ ] DEV apply 별도 승인
```

Production 직접 적용 금지.

---

# 9. G5 — Market / Feature Profile

## 목표

국가별 메뉴, 필드, 기능 차이를 Profile로 관리한다.

## G5-01 Type

생성 후보:

```text
frontend/src/market/types.ts
backend/src/globalization/market.types.ts
```

공유 가능한 DTO는 `packages/contracts` 사용.

## G5-02 Profile

예:

```text
market/profiles/KR.ts
market/profiles/US.ts
...
```

실제 업무확정되지 않은 Market은 Placeholder만 만들거나 생성하지 않는다.

## G5-03 Feature Policy

대표 Feature Key 후보:

```text
HIRA_IMPORT
DIRECT_WORK
GPS_CHECKIN
ACTIVITY_APPROVAL
ERP_ACCOUNT_APPROVAL
MONTHLY_STATEMENT
```

Key는 영구 식별자로 관리한다.

## G5-04 Frontend

Profile에 따라:

- 메뉴 표시
- 탭 표시
- 필드 표시
- Required 여부
- Button 표시

를 결정한다.

## G5-05 Backend Enforcement

Feature disabled인데 API 직접호출 시 거부되어야 한다.

예시 Error Code:

```text
FEATURE_NOT_AVAILABLE_FOR_MARKET
```

## G5 Tests

- UI Hidden
- API Bypass blocked
- Market feature matrix
- Permission + Feature 동시검증

---

# 10. G6 — Workflow Profile

## 목표

현재 한국 승인경로를 국가별 확장 가능한 형태로 분리한다.

## 대상

- Activity Report Approval
- Direct Work Approval
- 향후 Opportunity/Contract Approval

## G6-01 Existing KR Baseline 보존

현재 승인된 한국 Baseline은 Regression 없이 유지한다.

```text
영업담당자 → 지점장 → 본부장
```

## G6-02 Profile Resolution

코드에 Country 조건을 넣는 대신:

```text
company
 → workflow_profile_code
 → workflow_definition
 → approver resolution
```

## G6-03 Request Snapshot

기존 원칙 유지:

- 승인요청 시 승인자 Snapshot
- 진행 중 조직 변경으로 자동 변경 금지
- 재지정/대리 Audit

## G6 Tests

- KR current workflow regression
- 1-step sample workflow
- approver missing
- feature disabled
- resubmit/approval history

실제 해외 Workflow는 Requirement 승인 전 Production Profile로 등록하지 않는다.

---

# 11. G7 — Address / Customer Identifier / Map Boundary

## G7-01 Address

현재 한국 주소 필드 사용처를 조사한다.

영향대상:

```text
Lead
Account
Delivery Address
Activity Map
Statement/Export
```

공통 Address Model로 확장하되 기존 한국 데이터 Migration을 고려한다.

## G7-02 Customer Identifier

한국 전용 사업자/심평원 필드와 글로벌 식별자 모델의 경계를 정의한다.

현지 Identifier Rule이 없는 국가는 구현 금지.

## G7-03 Map Adapter

공통 Interface 예:

```text
<Map locations={} currentLocation={} />
```

Activity Business Rule은 Provider 독립 상태 유지.

Provider/API Key는 Environment Secret/Config로 관리한다.

## G7 Tests

- 주소 표시순서
- 지도 Provider 미설정
- 병원좌표 누락
- GPS 거리검증 Regression

---

# 12. G8 — Existing UI String Migration

## 목표

현재 구현된 모든 사용자 화면의 직접 문자열을 Translation Key로 옮긴다.

## 우선순위

```text
1. App Shell / Navigation
2. Login/Auth UI (추가 시)
3. Lead
4. Account
5. Activity / GPS
6. Activity Report / Approval
7. Direct Work
8. Opportunity
9. Pipeline
10. Contract / Collection
11. Order
12. Fulfillment
13. Ledger / Statement
14. Account 360
15. Analytics
16. Ops
```

## G8-01 Hard-code Scan

CI 또는 Script로 `.tsx/.ts`의 사용자 표시 문자열을 점검한다.

모든 한국어 문자열이 오류는 아니다.

허용 예:

- 내부 주석
- Test fixture
- 명시된 기술로그

금지:

- 사용자 라벨
- 버튼
- 상태명
- Validation Message

## G8-02 Status Label

DB/API Status Code는 번역하지 않는다.

```text
PLANNED
IN_PROGRESS
COMPLETED
```

UI에서만 번역한다.

## G8 Tests

각 주요 화면을 최소 2 Locale로 Render 검증한다.

---

# 13. G9 — Export / PDF / Excel Localization

## 대상

- Package Ledger XLSX
- Monthly Statement PDF
- 향후 다운로드 문서

## 요구

- Locale별 Header
- Currency Format
- Date Format
- Company Timezone
- CJK Font
- File name policy

## 중요

현재 PDF Font Adapter/영구 Storage가 별도 Environment Gate인 기존 원칙을 유지한다.

번역과 Font가 준비되지 않은 Locale에서 문서 생성을 성공으로 위장하지 않는다.

---

# 14. G10 — UI Completion / Responsive / PWA 연계

Globalization Foundation 완료 후 완성형 UI 디자인을 적용한다.

순서:

```text
Globalization Foundation
 → 공통 DIO Design System
 → Desktop UI Completion
 → Mobile Responsive
 → PWA
 → 필요 시 Capacitor
```

## 이유

UI를 먼저 전부 완성한 뒤 다국어를 적용하면 모든 화면의 Text Width, Field Layout, Button Width를 다시 수정해야 한다.

## Responsive Test

최소:

```text
Desktop 1440+
Tablet
Mobile 360~430
```

영어/CJK Locale에서 Overflow를 함께 확인한다.

---

# 15. QA Matrix

최소 테스트 축:

| 축 | 값 |
|---|---|
| Locale | 승인된 Locale |
| Market | 승인된 Market |
| Device | Desktop / Mobile |
| Role | Sales / Manager / Admin |
| Feature | ON / OFF |
| Timezone | Company Default / Override |

전체 Cartesian Product를 모두 E2E로 돌리기보다 Risk 기반 Pairwise + 핵심 Market Full E2E를 사용한다.

---

# 16. CI Gate

Globalization PR에서 필수:

```text
[ ] pnpm install
[ ] shared contracts build
[ ] backend build
[ ] frontend build
[ ] existing Jest tests
[ ] i18n tests
[ ] formatting tests
[ ] market profile tests
[ ] backend feature enforcement tests
[ ] missing translation key check
[ ] critical dependency audit
```

가능하면 Translation Resource Schema Validation을 CI에 포함한다.

---

# 17. Agent File Ownership

충돌 방지를 위해 권장 담당:

```text
Requirement/Domain Agent
  docs/globalization/
  spec/gaps/globalization_*

Frontend Agent
  frontend/src/i18n/
  frontend/src/formatting/
  frontend/src/market/

Backend Agent
  backend/src/globalization/

Data Agent
  database/migrations/009_*
  database/seeds/009_*

Integration Agent
  integration / adapter profile

QA Agent
  tests/globalization/
```

기존 업무화면 변경은 Orchestrator가 화면 단위로 배정한다.

---

# 18. PR Checklist

```text
[ ] Locale/Market 변경 범위 명시
[ ] Translation Key 신규 목록
[ ] Hard-coded UI string 없음
[ ] Currency/Date formatting helper 사용
[ ] Country if문 무분별 추가 없음
[ ] Feature Backend Enforcement 있음
[ ] Existing KR Workflow Regression PASS
[ ] DB Migration 영향 확인
[ ] API Contract 영향 확인
[ ] Export 영향 확인
[ ] Mobile layout 영향 확인
[ ] Open SPEC GAP 명시
[ ] Rollback 방법
```

---

# 19. Human Gate

## Gate GL0 — Design

승인대상:

- Locale/Market 개념
- Profile Architecture
- DB 후보변경

## Gate GL1 — Foundation

승인대상:

- i18n
- Formatting
- Context Resolver

## Gate GL2 — Market Rules

승인대상:

- Feature Matrix
- Workflow Profile
- Address/Identifier

## Gate GL3 — UI Migration

승인대상:

- 전체 기존 화면 Translation Migration
- UI Regression

## Gate GL4 — Country Activation

국가마다 별도 승인:

```text
Requirement
Translation
Workflow
Integration
UAT
Pilot
```

---

# 20. 완료기준

Globalization Foundation 완료로 인정하려면:

```text
[ ] Locale Provider 적용
[ ] 최소 승인 Locale Resource 완성
[ ] 모든 주요 UI Translation Key 전환
[ ] Locale-aware Date/Number/Currency
[ ] Company Market Context
[ ] Backend Feature Enforcement
[ ] Market Profile
[ ] Workflow Profile Foundation
[ ] Address/Map Adapter Boundary
[ ] Export Localization Baseline
[ ] CI PASS
[ ] Human Review APPROVED
```

국가별 업무가 모두 완료됐다는 뜻은 아니다.

---

# 21. 첫 실행 지시

```text
WORK: CRM-GL-001
TITLE: DIO CRM Globalization Foundation

SOURCE OF TRUTH
1. docs/globalization/01_Globalization_Architecture_Design.md
2. docs/globalization/02_Globalization_Work_Instructions.md
3. 기존 Phase 0~8 Canonical Spec
4. 현재 main Source

실행순서
1. G0 Locale/Market 범위 및 Gap 정리
2. G1 i18n Foundation
3. G2 Formatting
4. G3 Company/Market Context
5. G4 DB Migration Draft
6. G5 Feature Profile
7. G6 Workflow Profile
8. G7 Address/Map Boundary
9. G8 Existing UI Migration
10. G9 Export Localization
11. CI
12. Human Review

RULES
- 국가별 업무규칙을 추정하지 않는다.
- Production DB/ERP에 직접 적용하지 않는다.
- 한국 기존 기능 Regression을 허용하지 않는다.
- Frontend hide만으로 Feature를 제어하지 않는다.
- 각 Gap은 명시적으로 기록한다.
```

---

# 22. 다음 단계

Globalization Foundation 승인 이후:

```text
DIO UI Completion
 → Responsive Mobile UI
 → PWA
 → DEV/UAT
 → 국가별 ERP/Map 연동
 → Country Pilot
 → Production Rollout
```
