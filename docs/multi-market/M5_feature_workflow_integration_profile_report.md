# RM-MKT-001 M5 — Feature / Workflow / Integration Profile Report

- Work ID: `RM-MKT-001-M5`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m5-profile-boundaries`
- Baseline main: M4 merged main
- Status: `SOURCE_READY / CI_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

현재 Market Profile에 섞여 있던 Feature 결정 책임을 분리하고, Workflow / Integration을 독립 Profile Boundary로 정리한다.

기존 KR 운영 기준은 그대로 유지하고 GLOBAL은 해외법인 교육자료에서 확인된 범위만 Baseline 후보로 기록한다. 미확정 운영값은 Runtime 활성화하지 않는다.

## 2. Feature Profile

신규 Backend 구조:

```text
backend/src/globalization/feature-profile.ts
```

### HQ_FEATURE_PROFILE

현재 KR 운영값을 그대로 유지한다.

```text
HIRA_IMPORT          true
DIRECT_WORK          true
GPS_CHECKIN          true
ACTIVITY_APPROVAL    true
ERP_ACCOUNT_APPROVAL true
MONTHLY_STATEMENT    true
```

Status: `ACTIVE`

### GLOBAL_FEATURE_PROFILE

해외법인 교육자료에서 명시적으로 확인된 범위만 Candidate로 기록한다.

```text
DIRECT_WORK          false
GPS_CHECKIN          true
ACTIVITY_APPROVAL    true
ERP_ACCOUNT_APPROVAL true
```

아래 항목은 자료만으로 운영값을 확정하지 않는다.

```text
HIRA_IMPORT          UNCONFIRMED
MONTHLY_STATEMENT    UNCONFIRMED
```

Status: `BASELINE_ONLY`

`BASELINE_ONLY` Profile은 Runtime Boolean Feature Map으로 변환할 수 없도록 차단한다.

## 3. Market Profile Responsibility Separation

변경 전:

```text
KR Market Profile
  + locale/currency/timezone
  + screen/field/workflow/integration profile code
  + feature boolean values
```

M5 이후:

```text
KR Market Profile
  -> featureProfileCode = HQ_FEATURE_PROFILE

HQ_FEATURE_PROFILE
  -> actual feature decisions
```

`GlobalizationService`는 `featureProfileCode`를 통해 Server-side Feature Map을 Resolve하며, Backend Feature Guard 역시 독립 Feature Profile을 기준으로 확인한다.

## 4. Frontend Feature Visibility

Frontend는 Server가 Resolve한 `globalization.features`만 사용한다.

```text
frontend/src/market/feature-visibility.ts
```

`isFeatureVisible()`을 공통 Boundary로 두고 `GlobalizationProvider.featureEnabled()`에서 사용한다.

Frontend가 Country Code 또는 Feature Profile 후보값을 자체 추정하지 않는다.

## 5. Workflow Profile

기존 `KR_SALES_APPROVAL`은 그대로 유지한다.

```text
Activity Report
  1 BRANCH_MANAGER
  2 DIVISION_MANAGER

Direct Work
  1 BRANCH_MANAGER
  2 DIVISION_MANAGER
```

Status: `ACTIVE`

GLOBAL에는 `GLOBAL_SALES_APPROVAL_BASELINE`을 추가한다.

교육자료에서 확인되는 내용:

```text
Activity Report Approval = 존재
Direct Work               = 미사용
```

확인되지 않은 내용:

```text
승인자 조직/Role/단계 수
```

따라서 승인자 Actor를 임의 생성하지 않고 다음 GAP을 남긴다.

```text
ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED
```

Status: `BASELINE_ONLY`

## 6. Integration Profile

신규 Boundary:

```text
ERP Adapter
Map Adapter
Customer Master Adapter
Product Adapter
```

신규 파일:

```text
backend/src/globalization/integration-profile.ts
```

Profile:

```text
HQ_INTEGRATION_PROFILE     ACTIVE
GLOBAL_INTEGRATION_PROFILE BASELINE_ONLY
```

Provider/Endpoint를 Source에 Hard-code하지 않는다.

환경설정 Boundary:

```text
ERP_ADAPTER_PROVIDER
ERP_ADAPTER_ENDPOINT
MAP_ADAPTER_PROVIDER
MAP_ADAPTER_ENDPOINT
CUSTOMER_MASTER_ADAPTER_PROVIDER
CUSTOMER_MASTER_ADAPTER_ENDPOINT
PRODUCT_ADAPTER_PROVIDER
PRODUCT_ADAPTER_ENDPOINT
```

현재 실제 ERP Transport가 연결되었다고 간주하지 않는다. 기존 `InterfaceService`의 Pending/Audit Boundary는 그대로 유지한다.

## 7. Tests

```text
HQ Feature Profile Runtime Resolve
GLOBAL Feature Baseline-only Guard
Frontend Feature Visibility
Backend Feature Guard
KR Workflow Regression
GLOBAL Workflow GAP Preservation
Integration Profile Resolver
Provider/Endpoint Environment Injection
Unknown Integration Profile Reject
```

## 8. Explicit Non-Scope

```text
GLOBAL Runtime 활성화 없음
US/MX Country Runtime 연결 없음 (M8)
GLOBAL 실제 화면 구현 없음 (M7)
실제 ERP Provider 선택/Endpoint 확정 없음
실제 Map Provider 선택/Key 설정 없음
Customer Master/Product Provider 확정 없음
DB Migration 없음
DEV/UAT/Production 변경 없음
IN/PT/TR 운영규칙 생성 없음
```

## 9. Gate

```text
Feature Profile Separation       COMPLETE
HQ Feature Regression            SOURCE COMPLETE
GLOBAL Feature Baseline          COMPLETE
Frontend Visibility Boundary     COMPLETE
Backend Feature Guard Boundary   COMPLETE
KR Workflow Preservation         COMPLETE
GLOBAL Workflow GAP              COMPLETE
Integration Adapter Boundary     COMPLETE
Environment Config Boundary      COMPLETE
CI                               PENDING
Human Review                     PENDING
Main Merge                       NOT YET
```
