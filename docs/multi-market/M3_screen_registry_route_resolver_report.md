# RM-MKT-001 M3 — Screen Registry / Route Resolver Report

- Work ID: `RM-MKT-001-M3`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m3-screen-registry`
- Baseline main: `6f81949ff4b9aa835d7e086e33841b1bc89bb5c1`
- Status: `SOURCE_READY / CI_PASS / REVIEW_PENDING`

## 1. Objective

기존 `App.tsx`가 Page Component를 직접 Route에 고정하던 구조를 Screen Profile 기반 선택 구조로 전환한다.

URL/API 계약과 현재 KR 화면 동작은 유지하며, GLOBAL 화면은 M7 구현 전까지 실제 운영 활성화하지 않는다.

## 2. New Frontend Structure

```text
frontend/src/app/
  route-config.ts
  screen-profile.ts
  screen-registry.tsx
  screen-resolver.ts
  screen-resolver.spec.ts
```

## 3. Screen Profiles

### HQ_SCREEN_PROFILE

현재 본사 화면을 그대로 기존 Page Component에 연결한다.

```text
lead            -> HQ_LEAD
account         -> HQ_ACCOUNT
activity        -> HQ_ACTIVITY
activityReport  -> HQ_ACTIVITY_REPORT
directWork      -> HQ_DIRECT_WORK
opportunity     -> HQ_OPPORTUNITY
pipeline        -> HQ_PIPELINE
contract        -> HQ_CONTRACT
order           -> HQ_ORDER
fulfillment     -> HQ_FULFILLMENT
ledger          -> HQ_LEDGER
account360      -> HQ_ACCOUNT360
analytics       -> HQ_ANALYTICS
ops             -> HQ_OPS
```

### GLOBAL_SCREEN_PROFILE

미국/멕시코 GLOBAL Template이 이후 실제 화면을 연결할 수 있도록 Screen Key만 정의한다.

```text
lead            -> GLOBAL_LEAD
account         -> GLOBAL_ACCOUNT
activity        -> GLOBAL_ACTIVITY_MAP
activityReport  -> GLOBAL_ACTIVITY_REPORT
opportunity     -> GLOBAL_OPPORTUNITY
pipeline        -> GLOBAL_PIPELINE
contract        -> GLOBAL_CONTRACT
order           -> GLOBAL_ORDER
fulfillment     -> GLOBAL_FULFILLMENT
ledger          -> GLOBAL_LEDGER
account360      -> GLOBAL_ACCOUNT360
analytics       -> GLOBAL_ANALYTICS
ops             -> GLOBAL_OPS
```

해외법인에서 사용하지 않는 Direct Work는 GLOBAL Screen Profile에 등록하지 않는다.

## 4. Screen Registry

현재 실제 Component Registry에는 HQ Screen Key만 등록한다.

즉 M3에서는 기존 Page를 폐기하거나 복제하지 않는다.

```text
HQ_LEAD       -> LeadsPage
HQ_ACCOUNT    -> AccountsPage
HQ_ACTIVITY   -> ActivitiesPage
...
```

GLOBAL Screen Key는 M7 구현 전이므로 실제 Component를 임의 생성하지 않는다.

등록되지 않은 Screen Key가 Runtime에서 요청되면 `SCREEN_NOT_REGISTERED` Controlled UI를 반환한다.

## 5. Route Resolver

`App.tsx`는 더 이상 Page Component를 직접 import하지 않는다.

변경 전:

```text
Route /accounts -> AccountsPage
Route /activities -> ActivitiesPage
```

M3 이후:

```text
Globalization Context
  -> screenProfileCode
  -> Screen Profile
  -> Screen Slot
  -> Screen Key
  -> Screen Registry
  -> Component
```

기존 URL은 유지한다.

```text
/
/accounts
/activities
/activity-reports
/direct-work
/opportunities
/pipeline
/contracts
/orders
/fulfillment
/ledger-statements
/account360
/analytics
/ops
```

Navigation도 동일 `APP_ROUTES`와 Screen Profile을 사용하므로 Desktop/Mobile Navigation과 Route 선택 기준이 분리되지 않는다.

## 6. Backward Compatibility

기존 KR Context가 `screenProfileCode`를 포함하면 `HQ_SCREEN_PROFILE`을 사용한다.

이전 호환 Payload처럼 `screenProfileCode`가 없더라도 아래 조건에서만 HQ로 Fallback한다.

```text
countryCode = KR
marketProfileCode = KR_SALES
```

다른 국가/미확정 Profile을 HQ로 자동 Fallback하지 않는다.

## 7. Controlled Errors

```text
Unknown Screen Profile -> SCREEN_PROFILE_NOT_RESOLVED
Unregistered Profile   -> SCREEN_PROFILE_NOT_REGISTERED
Known but unimplemented Screen Key -> SCREEN_NOT_REGISTERED
Missing Slot -> ScreenResolutionError
```

국가 설정 오류가 발생했을 때 본사 화면으로 조용히 잘못 진입하는 것을 방지한다.

## 8. Tests

```text
KR + HQ_SCREEN_PROFILE + account -> HQ_ACCOUNT
GLOBAL_SCREEN_PROFILE + account -> GLOBAL_ACCOUNT
GLOBAL_SCREEN_PROFILE + activity -> GLOBAL_ACTIVITY_MAP
Legacy KR context -> HQ_SCREEN_PROFILE fallback
Unknown profile -> controlled ScreenResolutionError
GLOBAL directWork -> not resolved
```

첫 CI에서 `screen-registry.tsx`를 Node test 환경에서 직접 import하면서 기존 `api.ts`의 `window` 참조가 발생해 테스트가 실패했다. Registry 구현 자체의 build는 성공했으며, Resolver 단위 테스트가 UI Page import에 결합되지 않도록 테스트 경계를 수정했다.

최종 검증 대상은 branch 최종 Head에서 다시 CI를 수행한다.

## 9. Explicit Non-Scope

M3에서는 다음 작업을 하지 않는다.

```text
HQ Wrapper Page 생성 (M6)
GLOBAL 실제 화면 구현 (M7)
Field/Section Profile Renderer (M4)
Workflow/Integration 재구성 (M5)
US/MX Runtime 활성화 (M8)
DB Migration
DEV/UAT/Production 변경
```

## 10. Gate

```text
Screen Key Type              COMPLETE
Screen Profile Registry      COMPLETE
Route Config                 COMPLETE
Screen Resolver              COMPLETE
App Route Indirection        COMPLETE
KR URL/Screen Compatibility  SOURCE COMPLETE
GLOBAL Resolution Baseline   COMPLETE
CI                           PASS (pre-final-doc head); final head revalidation pending
Human Review                 PENDING
Main Merge                   NOT YET
```
