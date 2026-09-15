# RM-MKT-001 M8 — US / MX Country Profile Connection Report

- Work ID: `RM-MKT-001-M8`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m8-us-mx-country-profile`
- Baseline main: M7 merged main (`266e9587705a75cac07ab41fbf7f9ea1b425e21b`)
- Status: `SOURCE_READY / CI_PASS / HUMAN_REVIEW_PENDING`

## 1. Objective

M7에서 구현한 `GLOBAL_TEMPLATE`을 미국/멕시코 Country Profile을 통해 Runtime Context와 연결한다.

```text
US Country Profile
  → US_SALES
  → GLOBAL_TEMPLATE
  → GLOBAL_SCREEN_PROFILE
  → GLOBAL_FIELD_PROFILE
  → GLOBAL_FEATURE_PROFILE
  → GLOBAL_SALES_APPROVAL_BASELINE
  → GLOBAL_INTEGRATION_PROFILE

MX Country Profile
  → MX_SALES
  → 동일 GLOBAL Baseline
```

미국/멕시코 간 차이가 사용자 교육자료에서 확인되지 않은 부분은 별도 Override를 만들지 않는다.

## 2. Source Boundary

기준 자료:

- 해외법인 판매 프로세스 사용자 교육자료
- 해외법인 활동 프로세스 사용자 교육자료
- 2025-07-24 해외법인 확장 프로젝트 판매/활동 사용자 교육자료

자료에서 확인된 공통 Process는 M7에 반영되어 있다.

```text
Lead → Account / Contact → Opportunity → Contract / Collection Plan → Order
Activity Plan → Sales Activity Map / Log → GPS IN/OUT → Activity Report → Approval
Direct Work / Direct Leave 미사용
```

반면 다음 운영값은 교육자료에서 미국/멕시코별 값이 확인되지 않았다.

```text
locale
currency
timezone
구체적인 Map Profile Code / Provider
ERP Provider / Endpoint
Activity Report 승인자 조직/Role
HIRA Import 적용 여부
Monthly Statement 적용 여부
```

따라서 M8은 위 값을 국가 상식으로 추정하여 Source에 하드코딩하지 않는다.

## 3. Country Profile Status

US/MX는 `BASELINE_ONLY`에서 `ACTIVE_WITH_GAPS`로 전환한다.

```text
US → GLOBAL_TEMPLATE / US_SALES / ACTIVE_WITH_GAPS
MX → GLOBAL_TEMPLATE / MX_SALES / ACTIVE_WITH_GAPS
```

`ACTIVE_WITH_GAPS`의 의미:

- Country → GLOBAL Runtime 선택은 활성화
- 문서로 확인된 Feature만 Runtime 허용
- 미확정 Feature는 Fail Closed
- 미확정 Workflow/Integration 값은 GAP으로 유지
- 운영 locale/currency/timezone/map profile은 `crm_company` 설정을 사용

## 4. Runtime Market Profile

신규 Runtime Market Profile:

```text
US_SALES
MX_SALES
```

공통 연결:

```text
marketTemplateCode     GLOBAL_TEMPLATE
screenProfileCode      GLOBAL_SCREEN_PROFILE
fieldProfileCode       GLOBAL_FIELD_PROFILE
featureProfileCode     GLOBAL_FEATURE_PROFILE
workflowProfileCode    GLOBAL_SALES_APPROVAL_BASELINE
integrationProfileCode GLOBAL_INTEGRATION_PROFILE
```

US/MX Profile에는 다음 값을 하드코딩하지 않는다.

```text
defaultLocale
currencyCode
timezone
mapProfileCode
```

해당 값은 기존 `crm_company`의 아래 필드에서 공급되어야 한다.

```text
default_locale
default_currency
default_timezone
map_profile_code
```

사용자별 locale/timezone override는 기존 동작을 유지한다.

## 5. Country Profile as Runtime Selector

M8부터 Runtime Market Profile 선택 기준은 Country Profile이다.

```text
crm_company.country_code
        ↓
Country Profile Registry
        ↓
US → US_SALES
MX → MX_SALES
KR → KR_SALES
        ↓
Market Profile
        ↓
Globalization Context
```

기존 `crm_company.market_profile_code` 값이 존재하면 Country Profile과 일치하는지 검증한다.

불일치 예:

```text
country_code = US
market_profile_code = MX_SALES
```

위 구성은 자동 보정하지 않고 `COUNTRY_MARKET_PROFILE_MISMATCH`로 거부한다.

기존 컬럼 값이 비어 있으면 Country Profile의 승인된 Market Profile Code를 사용한다.

## 6. Feature Runtime Policy

`GLOBAL_FEATURE_PROFILE`은 `ACTIVE_CONFIRMED_ONLY` 모드로 전환한다.

문서 확인 Feature:

```text
GPS_CHECKIN          true
ACTIVITY_APPROVAL    true
ERP_ACCOUNT_APPROVAL true
DIRECT_WORK          false
```

미확정 Feature:

```text
HIRA_IMPORT       UNCONFIRMED
MONTHLY_STATEMENT UNCONFIRMED
```

Runtime에서는 `UNCONFIRMED`를 임의로 `false`라는 업무정책으로 확정하지 않는다. 대신 화면/Backend Guard에서 Fail Closed 처리하여 승인 전까지 사용할 수 없게 한다.

## 7. Workflow / Integration Gaps

Workflow:

```text
GLOBAL_SALES_APPROVAL_BASELINE
Activity Report Approval Required = true
Approver Actor = 미확정
Direct Work = false
```

M7 GLOBAL Activity Report는 승인 요청까지만 제공하며 HQ Branch/Division 승인 UI를 재사용하지 않는다.

Integration:

```text
GLOBAL_INTEGRATION_PROFILE
ERP / MAP / CUSTOMER_MASTER / PRODUCT Adapter Boundary 유지
Provider / Endpoint 하드코딩 없음
```

## 8. M8 Test Matrix

Backend:

```text
KR Login Context → HQ 유지
US Login Context → GLOBAL
MX Login Context → GLOBAL
Country Profile → Market Profile 선택
Legacy market_profile_code 빈 값 → Country Profile fallback
Country/Market mismatch → Reject
US/MX configured locale/currency/timezone/map → 그대로 Context에 사용
GLOBAL GPS / Activity Approval → 허용
GLOBAL HIRA / Monthly Statement → Fail Closed
```

Frontend:

```text
US → GLOBAL_TEMPLATE
MX → GLOBAL_TEMPLATE
US/MX → GLOBAL_SCREEN_PROFILE
US/MX → GLOBAL_FIELD_PROFILE
US/MX → GLOBAL_FEATURE_PROFILE
US/MX → GLOBAL_INTEGRATION_PROFILE

Navigation:
Lead
Account
Activity
Activity Report
Opportunity
Contract
Order

미노출:
Direct Work
Pipeline
Fulfillment
Ledger
Account360
Analytics
Ops
```

## 9. Safety

M8에서는 다음을 수행하지 않는다.

```text
DB Migration 실행
US/MX 운영 DB 값 변경
ERP Provider/Endpoint 설정
Map Provider/Endpoint 설정
Production 배포
IN/PT/TR Profile 생성
미확정 업무규칙 추정 구현
```

## 10. CI

초기 M8 Source Head `d021194a16edfe977f7d30ff8bdf9f11f06464d7`에서 CI Run `34970265083`, Job `104384547793`가 PASS했다.

```text
pnpm build          PASS
pnpm test           PASS
pnpm i18n:check     PASS
pnpm i18n:hardcode  PASS
pnpm pwa:check      PASS
pnpm env:check      PASS
pnpm audit:critical PASS
```

본 문서 상태 갱신 Commit에 대해서도 PR 최종 CI를 다시 확인한 후 Human Review Gate로 유지한다.

## 11. Next

M8 Human Review / Merge 후 다음 단계는 M9 DB Foundation이다.

M0에서 실제 Repository에 `010_account_interface_fields.sql`이 이미 존재함을 확인했으므로, 작업지시서의 기존 `010_multi_market_foundation.sql` 번호는 사용하지 않고 M9에서는 `011_multi_market_foundation.sql`로 작성해야 한다.
