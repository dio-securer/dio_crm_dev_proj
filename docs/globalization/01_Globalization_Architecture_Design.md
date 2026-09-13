# DIO CRM 국가/다국어 Globalization Architecture Design

- 문서명: DIO CRM Globalization Architecture Design
- 버전: v1.0
- 작성일: 2026-09-13
- 대상: DIO CRM Web / Mobile PWA / 향후 Android·iOS App
- 상태: `DESIGN BASELINE`
- 목적: 하나의 CRM Core를 유지하면서 언어, 국가, 통화, 시간대, 주소, 업무규칙, UI 차이, 외부연동 차이를 안전하게 분리한다.

---

# 1. 배경

현재 DIO CRM Source Baseline은 한국 영업 프로세스를 중심으로 Phase 0~8까지 구현되어 있다. 향후 해외 법인과 현지 영업사원이 사용하게 될 경우 단순 문구 번역만으로는 충분하지 않다.

국가별로 다음이 달라질 수 있다.

- 표시 언어
- 날짜/시간 형식
- 통화/금액 표시
- 주소체계
- 전화번호 형식
- 조직구조
- 승인단계
- GPS/지도 Provider
- 직출/직퇴 사용 여부
- 병원/고객 Master 필드
- ERP/현지 시스템 연동
- 세금/사업자 식별번호
- 화면 내 필드/탭/버튼 노출

따라서 `Language`와 `Country/Market`을 같은 개념으로 취급하지 않는다.

---

# 2. 핵심 설계 원칙

## 2.1 One Core, Multiple Markets

국가별 소스 Fork를 만들지 않는다.

```text
금지
CRM-KR
CRM-US
CRM-JP
CRM-CN

권장
DIO CRM Core
  + Locale
  + Market Profile
  + Feature Profile
  + Workflow Profile
  + Integration Adapter
```

공통 업무 로직은 Core에 유지하고 국가별 차이만 Profile/Adapter/Component Extension으로 분리한다.

## 2.2 Locale과 Market 분리

예:

```text
사용 법인      : US
Market         : US
사용자 언어    : ko-KR
통화           : USD
Timezone       : America/Los_Angeles
```

위 사용자는 미국 업무규칙과 미국 금액/시간을 사용하지만 화면 문구는 한국어로 볼 수 있어야 한다.

## 2.3 Frontend 숨김은 보안/업무규칙이 아니다

국가별 Feature가 비활성화되어도 Frontend 메뉴만 숨기는 것으로 끝내지 않는다.

```text
Frontend
- 메뉴/필드/버튼 노출 제어

Backend
- Feature 활성 여부 검증
- Workflow/Business Rule 검증
- 권한 검증
```

## 2.4 Country if문 확산 금지

다음 패턴을 업무 코드에 반복하지 않는다.

```ts
if (country === 'KR') ...
if (country === 'US') ...
if (country === 'JP') ...
```

국가 차이는 Profile Resolver 또는 Strategy/Adapter 계층으로 집중시킨다.

---

# 3. 개념 모델

## 3.1 Locale

사용자에게 보이는 언어와 표시형식을 결정한다.

초기 후보:

```text
ko-KR
 en-US
ja-JP
zh-CN
zh-TW
```

실제 지원 Locale은 번역 검수와 국가 Pilot 승인 후 활성화한다.

Locale이 담당하는 범위:

- 메뉴/버튼/라벨
- Validation Message
- 날짜 표시
- 숫자 그룹/소수점 표시
- 통화 표시
- 월/요일명
- Export 제목/표시문구

## 3.2 Market

법인/국가 기준 업무 환경을 결정한다.

예:

```text
KR
US
JP
CN
TW
```

Market이 담당하는 범위:

- 사용가능 Feature
- 필수 필드
- 주소입력 구조
- 고객 식별번호
- 승인 Workflow
- ERP Adapter
- Map Provider
- 기본 통화
- 기본 Timezone
- 데이터/정책 Profile

## 3.3 Company

Market 적용의 기본 단위는 Company이다.

권장 속성:

```text
company_id
company_code
country_code
default_locale
default_currency
default_timezone
market_profile_code
workflow_profile_code
map_profile_code
```

## 3.4 User Preference

사용자는 회사 기본 Locale을 Override할 수 있다.

```text
preferred_locale
timezone_override (optional)
```

Market 자체는 사용자가 임의 변경하지 않는다. Market은 현재 소속/법인 Context에서 결정한다.

---

# 4. Locale 결정 규칙

권장 우선순위:

```text
1. crm_user.preferred_locale
2. crm_company.default_locale
3. Browser locale
4. ko-KR fallback
```

로그인 이전 화면은 브라우저 Locale 또는 저장된 마지막 Locale을 사용할 수 있다.

로그인 이후에는 서버에서 반환한 User/Company Context를 기준으로 확정한다.

---

# 5. Market Context 결정

Backend Request에는 인증된 사용자와 Company Context가 있어야 한다.

```text
JWT / Session
  ├─ userId
  ├─ companyId
  ├─ roles
  └─ scopes

companyId
  ↓
Company
  ↓
Market Profile
```

Frontend가 전달하는 country 값만 신뢰하지 않는다.

---

# 6. Frontend 구조

현재 React + TypeScript + Vite 구조에 다음 계층을 추가하는 것을 기준으로 한다.

```text
frontend/src/
  i18n/
    index.ts
    locale-resolver.ts
    locales/
      ko-KR/
        common.json
        lead.json
        account.json
        activity.json
        opportunity.json
        contract.json
        order.json
        analytics.json
      en-US/
      ja-JP/
      zh-CN/
      zh-TW/

  market/
    types.ts
    resolver.ts
    profiles/
      KR.ts
      US.ts
      JP.ts
      CN.ts
      TW.ts

  workflow/
    types.ts
    resolver.ts

  formatting/
    currency.ts
    datetime.ts
    number.ts
    address.ts
    phone.ts

  map/
    Map.tsx
    provider.ts
    adapters/
      GoogleMapAdapter.tsx
      KakaoMapAdapter.tsx
      NaverMapAdapter.tsx

  features/
    lead/
    account/
    activity/
    opportunity/
    contract/
    order/
    analytics/

  market-components/
    KR/
    US/
    JP/
```

실제 지원하지 않는 Provider/국가 Component는 미리 구현하지 않는다. 구조만 열어둔다.

---

# 7. i18n 설계

권장 Library:

- `i18next`
- `react-i18next`

## 7.1 Translation Key 정책

문구 자체를 Key로 사용하지 않는다.

```text
금지
"활동보고 및 승인"

권장
activityReport.title
activityReport.requestApproval
common.search
common.save
```

## 7.2 Namespace

업무별 Namespace를 분리한다.

```text
common
lead
account
activity
approval
opportunity
contract
collection
order
analytics
ops
```

## 7.3 코드 예

```tsx
const { t } = useTranslation('activity');

<h1>{t('report.title')}</h1>
<button>{t('report.requestApproval')}</button>
```

## 7.4 Backend Error

Backend는 번역된 문장보다 안정적인 Error Code를 반환한다.

```json
{
  "code": "ACTIVITY_OUT_REQUIRED",
  "message": "optional technical message"
}
```

Frontend:

```text
errors.ACTIVITY_OUT_REQUIRED
```

Locale에 맞는 사용자 메시지로 변환한다.

---

# 8. 날짜/시간 설계

## 8.1 저장

업무 Timestamp는 Timezone 손실이 없도록 UTC 기준 저장/전송을 원칙으로 한다.

표시할 때 Company/User Timezone으로 변환한다.

예:

```text
DB/API        : 2026-09-13T00:30:00Z
KR 표시       : 2026-09-13 09:30
US Pacific    : 2026-09-12 17:30
```

기존 SQL Schema가 Local `datetime2` 전제를 가진 영역은 Migration 전에 별도 영향분석을 한다.

## 8.2 날짜만 의미하는 필드

계약일, 예정일처럼 시간대 변환으로 날짜가 바뀌면 안 되는 값은 Date-only 의미를 유지한다.

```text
planned_date
contract_date
collection_due_date
```

DateTime과 Date-only를 구분한다.

---

# 9. Currency / Number 설계

금액의 의미와 표시를 분리한다.

권장:

```text
amount
currency_code
```

표시는 JavaScript `Intl.NumberFormat`을 사용한다.

```ts
new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: currencyCode
}).format(amount);
```

환율 변환은 단순 표시 기능에 포함하지 않는다. 환율이 필요한 Dashboard는 별도 Finance/Reporting Rule로 정의한다.

---

# 10. 주소 설계

한국식 `시/도 + 시/군/구`만 전제로 하지 않는다.

권장 공통 모델:

```text
country_code
postal_code
region
city
district
address_line1
address_line2
latitude
longitude
```

국가별 UI에서는 Market Profile이 라벨, 필수여부, 표시순서를 결정한다.

예:

```text
KR
시/도 → 시/군/구 → 주소

US
State → City → ZIP → Street

JP
都道府県 → 市区町村 → 番地
```

실제 현지 Address Validation 방식은 국가별 Pilot 전에 결정한다.

---

# 11. 고객/병원 식별정보

현재 한국 전용 속성을 글로벌 공통 필드로 오해하지 않는다.

예:

```text
KR
- 사업자등록번호
- 심평원 관련 코드

US
- Tax/Business Identifier 후보

JP/CN/TW
- 현지 사업자/법인 식별체계
```

국가별 실제 식별번호 명칭/검증 Rule은 각 Market Requirement 승인 전에는 임의 구현하지 않는다.

공통 Core는 다음 형태를 권장한다.

```text
identifier_type
identifier_value
country_code
verified_yn
```

또는 기존 필드를 유지하면서 Market-specific extension table을 사용할 수 있다. 실제 Migration 방식은 데이터 영향분석 후 확정한다.

---

# 12. Market Profile

Market Profile 예시 구조:

```ts
export interface MarketProfile {
  code: string;
  countryCode: string;
  defaultLocale: string;
  currency: string;
  timezone: string;
  features: FeatureProfile;
  account: AccountUiProfile;
  activity: ActivityUiProfile;
  workflowProfileCode: string;
  mapProfileCode: string;
}
```

## 12.1 Feature Profile

예시:

```json
{
  "hira": true,
  "directWork": true,
  "gpsCheckIn": true,
  "activityApproval": true,
  "erpAccountApproval": true,
  "monthlyStatement": true
}
```

이 값은 예시 Schema이며 실제 국가별 true/false 값은 현지 업무 확인 후 승인한다.

## 12.2 UI Field Profile

예시:

```json
{
  "account": {
    "fields": {
      "businessIdentifier": { "visible": true, "required": true },
      "hiraCode": { "visible": true, "required": false },
      "postalCode": { "visible": true, "required": false }
    }
  }
}
```

---

# 13. 국가별 UI Variation 전략

모든 국가 화면을 개별 Component로 만들지 않는다.

3단계로 판단한다.

## Level 1 — 문구/형식 차이

같은 Component + Locale.

예:

```text
조회 / Search / 検索
```

## Level 2 — 필드/버튼 일부 차이

같은 Component + Market Profile.

예:

```text
KR: 심평원 코드 표시
US: 해당 Field 숨김
```

## Level 3 — 업무 구조 자체 차이

공통 Interface를 유지하고 Market Component를 별도 구현한다.

```text
AccountTaxSection
  ├─ KRAccountTaxSection
  └─ USAccountTaxSection
```

분리 기준:

- DOM/화면 구조가 과도하게 조건문으로 복잡해짐
- 업무 단계가 다름
- 입력 Validation이 본질적으로 다름
- 별도 외부서비스가 필요함

---

# 14. Workflow Profile

현재 한국 Baseline 승인 흐름 중 일부는 해외와 달라질 수 있다.

예:

```text
KR Activity Approval
Sales Rep → Branch Manager → Division Manager
```

국가별로 코드에 하드코딩하지 않고 Workflow Profile을 사용한다.

권장 구조:

```text
workflow_profile
workflow_definition
workflow_step
approval_route
```

개념 예:

```text
KR_ACTIVITY_APPROVAL
  Step 1: BRANCH_MANAGER
  Step 2: HQ_MANAGER
```

미국/일본 등 실제 승인 단계는 해당 Market Requirement가 확정되기 전에는 정의하지 않는다.

---

# 15. Role / Permission / Data Scope

Role명도 국가 UI 문구와 실제 Permission ID를 분리한다.

```text
Permission ID
ACTIVITY.REPORT.APPROVE.BRANCH

Display label
ko-KR: 활동보고 지점장 승인
en-US: Approve Activity Report
```

Backend는 Permission ID를 사용하고 Locale에 의존하지 않는다.

국가별 조직구조가 다를 경우 Role 이름 자체보다 Capability 기반 Permission을 우선한다.

---

# 16. Map/GPS 설계

Activity Domain은 특정 지도 SDK에 종속시키지 않는다.

```text
Activity UI
  ↓
Map Component Interface
  ↓
Map Provider Adapter
```

Provider Profile 예:

```text
map_profile_code
provider
api_key_reference
geocoding_enabled
route_enabled
```

GPS IN 핵심 Business Rule(거리 계산)은 Provider와 분리한다.

```text
현재위치 좌표
병원 좌표
  ↓
Backend/Domain Distance Validation
```

지도 화면은 표현 계층이다.

---

# 17. Integration Adapter

국가별 ERP 또는 현지 시스템 차이는 Integration Adapter로 격리한다.

```text
CRM Domain
  ↓
Integration Contract
  ↓
Company/Market Adapter Resolver
  ├─ Korea ERP Adapter
  ├─ US ERP Adapter
  └─ Future Adapter
```

Domain Service가 국가별 API URL/Payload를 직접 알지 않도록 한다.

Interface Log에는 최소 다음 Context를 남긴다.

```text
company_id
market_code
interface_code
adapter_code
request_id
status
```

---

# 18. DB 설계 Baseline

Globalization Migration 후보는 Phase 1~8 Migration 이후 별도 번호로 관리한다.

예상 Migration:

```text
database/migrations/009_globalization_foundation.sql
database/seeds/009_globalization_seed.sql
```

단, 설계 승인 전 Migration을 생성/적용하지 않는다.

## 18.1 crm_company 확장 후보

```text
country_code
default_locale
default_currency
default_timezone
market_profile_code
workflow_profile_code
map_profile_code
```

## 18.2 crm_user 확장 후보

```text
preferred_locale
timezone_override
```

## 18.3 신규 Configuration 후보

```text
crm_market_profile
crm_feature_policy
crm_workflow_profile
crm_workflow_step
crm_map_profile
```

실제 테이블 분할 수준은 Profile을 Code Config로 둘지 DB Admin 설정으로 둘지 Architecture Review에서 확정한다.

---

# 19. API Context

로그인/사용자 Context API에서 다음 정보를 반환하도록 한다.

```json
{
  "user": {
    "publicId": "...",
    "preferredLocale": "ko-KR"
  },
  "company": {
    "countryCode": "KR",
    "defaultLocale": "ko-KR",
    "currency": "KRW",
    "timezone": "Asia/Seoul",
    "marketProfile": "KR_SALES"
  },
  "features": {
    "directWork": true,
    "gpsCheckIn": true
  }
}
```

이 JSON의 실제 계약은 구현 단계에서 Shared Contract로 확정한다.

---

# 20. Export / PDF / Excel

UI 번역과 Export 번역을 분리하지 않는다.

Export 생성 시 다음 Context를 받는다.

```text
locale
currency
timezone
market
```

PDF Font는 Locale별 Glyph 지원 여부를 검증해야 한다.

특히:

- 한글
- 일본어
- 중국어 간체
- 중국어 번체

를 모두 지원하는 Font 전략이 필요하다.

Font 파일 자체는 Repository에 무조건 포함하지 않고 라이선스 및 배포정책을 별도 검토한다.

---

# 21. Mobile / PWA / App

PC, Mobile PWA, 향후 Capacitor App은 동일 Globalization Context를 사용한다.

```text
React Core
  ├─ Desktop Layout
  ├─ Mobile Layout
  └─ Capacitor Shell (future)

공통
  LocaleProvider
  MarketProvider
  FeatureProvider
```

모바일 전용 메뉴/화면 구조는 가능하지만 업무 데이터와 Rule은 동일 Backend Domain을 사용한다.

---

# 22. 테스트 전략

## 22.1 Translation Test

- Key 누락
- Fallback 동작
- 한국어 하드코딩 탐지
- 긴 영어/독일어 수준의 Text Overflow 대비
- CJK Font 표시

## 22.2 Locale Format Test

- Date
- Timezone
- Currency
- Decimal/Thousands separator
- Negative number

## 22.3 Market Test

- Feature ON/OFF
- Required Field
- Hidden Field
- Workflow Route
- Backend bypass 차단

## 22.4 Cross-market E2E

최소 각 활성 Market에 대해:

```text
Login
 → Lead/Account
 → Activity
 → Opportunity
 → Contract/Order (해당 시)
```

을 검증한다.

---

# 23. 운영/관리 화면

장기적으로 CRM Admin에 다음 관리 기능을 제공할 수 있다.

```text
Company
Market Profile
Locale Default
Feature Policy
Workflow Profile
Map Profile
Translation Version
```

하지만 시스템 안정성을 위해 모든 Profile을 즉시 자유편집 가능하게 하지 않는다.

초기에는 Version-controlled Config + Seed를 권장하고, 운영 안정화 후 Admin UI 범위를 확정한다.

---

# 24. 초기 Market/Locale 지원 정책

설계 구조는 여러 국가를 지원할 수 있게 만들되 실제 활성화는 별도 Gate로 한다.

```text
Structure Ready ≠ Country Ready
```

예를 들어 `US` Profile 파일이 존재한다고 미국 업무가 승인되었다는 의미가 아니다.

각 국가는 다음 절차를 거친다.

```text
Country Requirement
 → Legal/Business Review
 → Market Profile
 → Translation Review
 → Integration Review
 → UAT
 → Pilot
 → Activate
```

---

# 25. 금지사항

- 국가별 Repository Fork
- UI 문구 직접 하드코딩 신규 추가
- `country === 'XX'` 조건문을 Domain 전체에 확산
- Frontend Hidden만으로 Feature 차단
- 통화 Symbol만 변경하고 Currency 의미를 무시
- DateTime/Date-only 구분 없이 Timezone 변환
- 현지 사업자번호 Rule을 추정하여 구현
- 해외 승인 Workflow를 임의 생성
- 지도 Provider를 Activity Domain에 직접 결합
- 운영 DB에 설계 승인 전 Migration 적용

---

# 26. 권장 구현 순서

```text
G0 Globalization Design Approval
 ↓
G1 i18n Foundation
 ↓
G2 Locale / Formatting
 ↓
G3 Company / Market Context
 ↓
G4 Feature / UI Profile
 ↓
G5 Workflow / Backend Enforcement
 ↓
G6 Address / Map / Integration Adapter Boundary
 ↓
G7 Existing Screen String Migration
 ↓
UI Completion
 ↓
Responsive / PWA
 ↓
Country Pilot
```

---

# 27. Human Gate

Globalization Foundation은 다음 승인 없이는 완료로 간주하지 않는다.

```text
[ ] Architecture Review
[ ] Initial Locale 범위 승인
[ ] Initial Market 범위 승인
[ ] DB 변경 승인
[ ] Feature Policy 승인
[ ] Workflow 정책 승인
[ ] Translation QA
[ ] Cross-market E2E PASS
```

---

# 28. 현재 결정

현재 문서는 Globalization을 위한 **설계 Baseline**이다.

아직 다음을 완료한 것으로 간주하지 않는다.

- i18next/react-i18next 설치
- 실제 번역파일 작성 완료
- DB Migration 009 생성/적용
- 국가별 Workflow 확정
- 국가별 ERP Adapter 구현
- 지도 Provider 연결
- UI Completion
- Responsive/PWA/App

실제 구현은 `02_Globalization_Work_Instructions.md` 순서로 진행한다.
