# RM-MKT-001 M1 — Multi-Market Contract Extension Report

- Work ID: `RM-MKT-001-M1`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m1-contract`
- Baseline main: `5ac77bac171ba5ce16d1faf016cc832e9df23e73`
- Status: `SOURCE_READY / REVIEW_PENDING`

## 1. Objective

Frontend/Backend가 공통으로 사용할 Multi-Market Context Contract를 기존 KR 동작을 깨지 않도록 확장한다.

본 단계는 Screen Registry, US/MX Profile, DB Migration을 구현하지 않는다. 해당 작업은 M2 이후 단계의 책임이다.

## 2. Contract Extension

`packages/contracts/src/globalization.ts`에 다음 Profile Code 타입을 추가했다.

```text
MarketTemplateCode
ScreenProfileCode
FieldProfileCode
FeatureProfileCode
IntegrationProfileCode
WorkflowProfileCode
MapProfileCode
```

`GlobalizationContext`에는 다음 신규 필드를 추가했다.

```text
marketTemplateCode
screenProfileCode
fieldProfileCode
featureProfileCode
integrationProfileCode
```

기존 필드는 유지한다.

```text
marketProfileCode
workflowProfileCode
mapProfileCode
```

신규 필드는 모두 Optional로 정의하여 기존 `/api/me/context` Payload와 Type Contract의 하위 호환성을 유지한다.

## 3. KR Compatibility Baseline

현재 승인된 KR Profile은 기존 `KR_SALES` 코드를 유지하면서 아래 확장 코드 값을 제공한다.

```text
marketProfileCode      = KR_SALES
marketTemplateCode     = HQ_TEMPLATE
screenProfileCode      = HQ_SCREEN_PROFILE
fieldProfileCode       = HQ_FIELD_PROFILE
featureProfileCode     = HQ_FEATURE_PROFILE
workflowProfileCode    = KR_SALES_APPROVAL
integrationProfileCode = HQ_INTEGRATION_PROFILE
mapProfileCode         = KR_DEFAULT
```

기존 KR Feature는 변경하지 않았다.

```text
HIRA_IMPORT          = true
DIRECT_WORK          = true
GPS_CHECKIN          = true
ACTIVITY_APPROVAL    = true
ERP_ACCOUNT_APPROVAL = true
MONTHLY_STATEMENT    = true
```

## 4. Backend Changes

`GlobalizationService.resolveCompany()`이 기존 DB Column을 그대로 사용하면서 신규 Profile Code는 승인된 Market Profile Definition에서 Resolve하도록 확장했다.

따라서 M1에서는 DB Schema 변경이 없다.

기존 동작:

```text
company/user DB context
  + KR_SALES market profile
  → locale/country/currency/timezone/features
```

M1 이후:

```text
company/user DB context
  + KR_SALES market profile
  → locale/country/currency/timezone
  → market/template/screen/field/feature/workflow/integration/map profile codes
  → features
```

## 5. Frontend Changes

Frontend의 `MarketProfile`은 Shared Contract의 Profile Code 타입을 사용하도록 정리했다.

KR fallback context에도 신규 Profile Code를 포함하여 인증 전/Context 조회 실패 시에도 HQ Baseline을 유지한다.

Screen 선택 로직 자체는 아직 변경하지 않는다. `App.tsx` Route 구조는 M3에서 변경한다.

## 6. Runtime Contract Guard

`isGlobalizationContext()`를 Shared Contract에 추가했다.

검증 범위:

- 필수 locale/country/currency/timezone/marketProfileCode 문자열
- 기존 및 신규 Optional Profile Code가 존재할 경우 non-empty string
- 모든 `MarketFeatureKey` 값이 boolean인지 확인

신규 Profile Code가 없는 기존 호환 Payload도 Valid로 처리한다.

## 7. Tests

추가/확장 Test:

```text
Backend
- KR profile extended code baseline
- KR feature baseline unchanged
- KR two-step workflow unchanged
- company context extended profile resolution
- locale/timezone override preservation
- unknown market rejection

Frontend
- KR feature baseline unchanged
- KR extended profile-code baseline
- extended context runtime validation
- legacy-compatible context runtime validation
- malformed profile/feature rejection
```

## 8. Explicit Non-Scope

M1에서는 다음 작업을 하지 않는다.

```text
US/MX Market Profile 생성
GLOBAL_TEMPLATE Registry 구현
Screen Registry 구현
Field Section Renderer 구현
Workflow 변경
ERP Adapter 변경
DB Migration 생성/실행
DEV/UAT/Production 변경
```

## 9. Gate

M1 완료 조건:

```text
Shared Contract Extension       COMPLETE
KR Context Compatibility        COMPLETE
Runtime Contract Validation     COMPLETE
Source Build/Test               PENDING CI
Human Review                    PENDING
Main Merge                      NOT YET
```
