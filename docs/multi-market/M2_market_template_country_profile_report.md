# RM-MKT-001 M2 — Market Template / Country Profile Foundation Report

- Work ID: `RM-MKT-001-M2`
- Parent: `RM-MKT-001`
- Baseline main: `237458df3738c6d88fd2db83c9535450431505bc`
- Branch: `rm-mkt-001-m2-foundation`
- Status: `SOURCE_READY / CI_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

국가 코드와 UI/Process Template을 분리하여 국가가 늘어나도 국가별 Source Fork나 country if/else 확산 없이 Template/Profile 조합으로 확장할 수 있는 Foundation을 만든다.

## 2. Initial Template Registry

초기 Template은 작업지시서 기준 두 개만 등록한다.

```text
HQ_TEMPLATE
GLOBAL_TEMPLATE
```

각 Template은 M1에서 정의한 Profile Code Contract를 사용한다.

```text
HQ_TEMPLATE
  screenProfileCode      = HQ_SCREEN_PROFILE
  fieldProfileCode       = HQ_FIELD_PROFILE
  featureProfileCode     = HQ_FEATURE_PROFILE
  integrationProfileCode = HQ_INTEGRATION_PROFILE

GLOBAL_TEMPLATE
  screenProfileCode      = GLOBAL_SCREEN_PROFILE
  fieldProfileCode       = GLOBAL_FIELD_PROFILE
  featureProfileCode     = GLOBAL_FEATURE_PROFILE
  integrationProfileCode = GLOBAL_INTEGRATION_PROFILE
```

M2에서는 Screen Registry, Field Renderer, Feature/Workflow/Integration 실제 구현은 하지 않는다. 각 단계는 M3~M5의 책임이다.

## 3. Country Mapping

초기 Mapping은 작업지시서에 명시된 범위만 구현한다.

```text
KR -> HQ_TEMPLATE
US -> GLOBAL_TEMPLATE
MX -> GLOBAL_TEMPLATE
```

KR은 현재 승인된 Runtime Market Profile인 `KR_SALES`를 유지한다.

US/MX는 `BASELINE_ONLY` 상태로 등록한다. 즉 GLOBAL Template 선택 관계만 정의하고, 아직 승인되지 않은 다음 값은 만들지 않는다.

```text
US/MX runtime marketProfileCode
locale/currency/timezone 운영값
workflowProfileCode
mapProfileCode
ERP/Map Provider endpoint
국가별 Override Business Rule
```

해당 운영 값은 M8 Country Profile 연결 단계에서 승인된 요구사항을 기준으로 확정한다.

## 4. Unapproved Countries

다음 국가는 M2에서 등록하지 않는다.

```text
IN
PT
TR
```

Requirement/Fit-Gap 없이 Template을 추정하지 않는다는 RM-MKT-001 원칙을 유지한다.

## 5. Backend Structure

추가 파일:

```text
backend/src/globalization/market-template.ts
backend/src/globalization/country-profile.ts
backend/src/globalization/profile-resolver.ts
backend/src/globalization/profile-resolver.spec.ts
```

역할:

- `market-template.ts`: HQ/GLOBAL Template Registry
- `country-profile.ts`: KR/US/MX Country Mapping Registry
- `profile-resolver.ts`: Country -> Template Resolver
- `profile-resolver.spec.ts`: Template/Country/Unknown-country Regression

기존 `market-profile.ts`의 `KR_SALES` Runtime Profile은 유지한다. US/MX Runtime Market Profile을 아직 추가하지 않는다.

## 6. Frontend Structure

추가/변경 구조:

```text
frontend/src/market/
  templates/
    HQ.ts
    GLOBAL.ts
  profiles/
    KR.ts
    US.ts
    MX.ts
  template-registry.ts
  country-profile-resolver.ts
  country-profile.spec.ts
  types.ts
```

KR은 기존 `KR_MARKET_PROFILE`을 그대로 유지하면서 `KR_COUNTRY_PROFILE`을 추가한다.

US/MX 파일은 GLOBAL Template Mapping만 포함한다.

## 7. Compatibility

M2는 다음 기존 동작을 변경하지 않는다.

```text
/api/me/context runtime resolution
KR_SALES feature baseline
KR_SALES_APPROVAL workflow
현재 App.tsx route/page selection
현재 Account/Activity/Opportunity/Contract/Order logic
DB schema/migrations
```

따라서 실제 화면 선택은 여전히 기존 KR 고정 Route 방식이며 M3에서 Screen Registry / Route Resolver로 전환한다.

## 8. Test Matrix

```text
Template Registry
  HQ_TEMPLATE resolve
  GLOBAL_TEMPLATE resolve

Country Resolve
  KR -> HQ_TEMPLATE
  US -> GLOBAL_TEMPLATE
  MX -> GLOBAL_TEMPLATE

KR Compatibility
  KR marketProfileCode = KR_SALES
  status = ACTIVE

US/MX Baseline
  status = BASELINE_ONLY
  runtime marketProfileCode = undefined

Unknown Country Safety
  IN -> undefined
  PT -> undefined
  TR -> undefined
```

## 9. Explicit Non-Scope

```text
Screen Registry 구현
Route Resolver 구현
Field/Section Renderer 구현
GLOBAL 실제 UI 구현
US/MX Runtime Context 활성화
US/MX Workflow 승인 구조 추정
DB Migration 작성/실행
DEV/UAT/Production 변경
India/Portugal/Turkiye Template 추정
```

## 10. Gate

```text
Template Registry       COMPLETE
Country Profile Resolve COMPLETE
KR Compatibility        COMPLETE
US/MX Config Baseline   COMPLETE
Source Build/Test       PENDING CI
Human Review            PENDING
Main Merge              NOT YET
```
