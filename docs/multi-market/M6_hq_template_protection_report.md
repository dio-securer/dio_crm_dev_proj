# RM-MKT-001 M6 — HQ Template 보호 및 기존화면 이관 Report

- Work ID: `RM-MKT-001-M6`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m6-hq-template-protection`
- Baseline main: M5 merged main
- Status: `SOURCE_READY / CI_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

현재 운영 기준인 본사 CRM 화면을 다시 작성하지 않고 `HQ_TEMPLATE` 소유 Screen Wrapper 뒤로 이동시켜, M7 GLOBAL 화면 구현 시 본사 화면과 해외 화면이 서로 직접 결합되지 않도록 보호한다.

M6는 UI 재설계 단계가 아니라 **기존 HQ 동작을 보존하는 구조적 경계 생성 단계**다.

## 2. Before / After

### Before

```text
Screen Registry
  HQ_ACCOUNT -> AccountsPage
  HQ_LEAD    -> LeadsPage
  ...
```

Screen Registry가 기존 Page를 직접 참조했다.

### After

```text
Screen Registry
  HQ_ACCOUNT -> HqAccountPage  -> AccountsPage
  HQ_LEAD    -> HqLeadPage     -> LeadsPage
  ...
```

이제 Registry는 HQ 전용 Wrapper만 참조하며, 기존 Page는 Wrapper 내부의 HQ Regression Baseline으로 보존된다.

## 3. New Structure

```text
frontend/src/market/templates/hq/
  HqScreens.tsx
  hq-screen-manifest.ts
  hq-screen-manifest.spec.ts
```

`HqScreens.tsx`는 현재 구현된 모든 HQ 화면을 명시적 HQ Component 이름으로 감싼다.

```text
HqLeadPage
HqAccountPage
HqActivityPage
HqActivityReportPage
HqDirectWorkPage
HqOpportunityPage
HqPipelinePage
HqContractPage
HqOrderPage
HqFulfillmentPage
HqLedgerPage
HqAccount360Page
HqAnalyticsPage
HqOpsPage
```

## 4. HQ Screen Ownership

`HQ_SCREEN_KEYS` Manifest는 `HQ_SCREEN_PROFILE`의 14개 Screen Key를 모두 소유한다.

```text
HQ_LEAD
HQ_ACCOUNT
HQ_ACTIVITY
HQ_ACTIVITY_REPORT
HQ_DIRECT_WORK
HQ_OPPORTUNITY
HQ_PIPELINE
HQ_CONTRACT
HQ_ORDER
HQ_FULFILLMENT
HQ_LEDGER
HQ_ACCOUNT360
HQ_ANALYTICS
HQ_OPS
```

GLOBAL Screen Key는 HQ Manifest에 포함하지 않는다.

## 5. Regression Strategy

Wrapper는 의도적으로 별도 Business Logic을 추가하지 않는다.

```text
API 호출          기존 Page 유지
React Query       기존 Page 유지
Write Payload     기존 Page 유지
Validation        기존 Page 유지
Status Mapping    기존 Page 유지
Form State        기존 Page 유지
Error / Loading   기존 Page 유지
i18n              기존 Page 유지
Responsive        기존 Page 유지
PWA Route         기존 Route 유지
```

따라서 M6에서 HQ 화면의 기능적 동작을 변경하지 않는다.

공통 Hook/API/Model 추출은 GLOBAL 구현 과정에서 실제 공통점이 확인되는 범위만 단계적으로 수행한다. 공통화를 위해 기존 HQ Logic을 선제적으로 재작성하지 않는다.

## 6. Route / Screen Contract

기존 URL과 Screen Key는 유지한다.

```text
/accounts          -> HQ_ACCOUNT -> HqAccountPage
/activities        -> HQ_ACTIVITY -> HqActivityPage
/activity-reports  -> HQ_ACTIVITY_REPORT
/direct-work       -> HQ_DIRECT_WORK
/opportunities     -> HQ_OPPORTUNITY
/contracts         -> HQ_CONTRACT
/orders            -> HQ_ORDER
...
```

M3에서 만든 Screen Profile / Route Resolver Contract는 변경하지 않는다.

## 7. M4 / M5 Compatibility

M4의 `HQ_FIELD_PROFILE`과 M5의 `HQ_FEATURE_PROFILE`, `KR_SALES_APPROVAL`, `HQ_INTEGRATION_PROFILE`은 그대로 유지한다.

M6 Wrapper는 Profile 값을 재정의하지 않는다.

```text
KR
 -> HQ_TEMPLATE
 -> HQ_SCREEN_PROFILE
 -> HQ_FIELD_PROFILE
 -> HQ_FEATURE_PROFILE
 -> KR_SALES_APPROVAL
 -> HQ_INTEGRATION_PROFILE
```

## 8. Tests

M6에서 추가한 보호 Test:

```text
HQ_SCREEN_PROFILE 전체 Key == HQ_SCREEN_KEYS Manifest
HQ Screen Count = 14
HQ Manifest에 GLOBAL_* Key 없음
```

기존 CI의 build/test/i18n/hardcode/PWA/env/audit도 함께 통과해야 한다.

## 9. Explicit Non-Scope

```text
기존 HQ Page 재작성 없음
HQ Business Rule 변경 없음
API Contract 변경 없음
DB Migration 없음
GLOBAL 실제 UI 구현 없음 (M7)
US/MX Runtime 활성화 없음 (M8)
IN/PT/TR 규칙 생성 없음
DEV/UAT/Production 변경 없음
```

## 10. Gate

```text
HQ Wrapper Layer             COMPLETE
HQ Screen Registry Migration COMPLETE
HQ Screen Ownership Manifest COMPLETE
HQ Compatibility Test        COMPLETE
CI                           PENDING
Human Review                 PENDING
Main Merge                   NOT YET
```
