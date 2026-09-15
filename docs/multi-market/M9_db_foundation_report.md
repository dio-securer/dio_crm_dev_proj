# RM-MKT-001 M9 — DB Foundation Report

- Work ID: `RM-MKT-001-M9`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m9-db-foundation`
- Baseline main: M8 merged main (`007c70fb8a627c97a7ac5f39d7b748c51a9f1b91`)
- Status: `SOURCE_READY / CI_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

Multi-Market Profile Code를 `crm_company`에 저장할 수 있도록 Schema를 Backward-compatible하게 확장한다.

M0에서 Repository에 이미 `010_account_interface_fields.sql`이 존재함을 확인했으므로, 기존 작업지시서의 M9 Migration 번호 `010`은 사용하지 않는다.

M9 신규 Migration:

```text
database/migrations/011_multi_market_foundation.sql
```

기존 `001~010` Migration은 수정하지 않는다.

## 2. Added crm_company Columns

M9는 아래 Nullable Column만 추가한다.

```text
market_template_code      varchar(50) NULL
screen_profile_code       varchar(50) NULL
field_profile_code        varchar(50) NULL
feature_profile_code      varchar(50) NULL
integration_profile_code  varchar(50) NULL
```

기존 Globalization Column은 유지한다.

```text
country_code
default_locale
default_currency
default_timezone
market_profile_code
workflow_profile_code
map_profile_code
```

## 3. Backfill Policy

M9 Source는 이미 승인된 Architecture Mapping만 NULL Column에 Backfill한다.

```text
KR
  HQ_TEMPLATE
  HQ_SCREEN_PROFILE
  HQ_FIELD_PROFILE
  HQ_FEATURE_PROFILE
  HQ_INTEGRATION_PROFILE

US / MX
  GLOBAL_TEMPLATE
  GLOBAL_SCREEN_PROFILE
  GLOBAL_FIELD_PROFILE
  GLOBAL_FEATURE_PROFILE
  GLOBAL_INTEGRATION_PROFILE
```

기존 Non-NULL 값은 덮어쓰지 않는다.

다음 값은 M9에서 추정하거나 Backfill하지 않는다.

```text
locale
currency
timezone
workflow actor / approver organization
map profile/provider
ERP provider/endpoint
Customer Master provider
Product provider
```

US/MX의 위 운영값은 M8 정책대로 `crm_company` 및 Environment Configuration에서 별도 확인되어야 한다.

## 4. Future Country Safety

`IN / PT / TR` 등 아직 Fit/Gap이 완료되지 않은 국가는 M9 Migration에서 Profile을 생성하거나 강제하지 않는다.

또한 현재 Registry 값만 허용하는 Check Constraint를 만들지 않는다. 향후 승인된 Country/Profile을 Migration 수정 없이 추가할 수 있어야 하기 때문이다.

## 5. Account Market Attribute Decision

작업지시서의 후보였던 아래 Generic Table은 M9에서 생성하지 않는다.

```text
crm_account_market_attribute
```

이유:

- 현재 승인된 Country-specific Account Attribute 요구가 없음
- 요구가 확정되기 전에 Generic EAV 구조를 만들면 데이터 계약이 불명확해짐
- India Fit/Gap 이후 실제 요구를 기준으로 별도 설계하는 것이 안전함

## 6. Index

Multi-Market Rollout/진단을 위해 다음 Index Source를 추가한다.

```text
IX_crm_company_multi_market_profile
(country_code, market_template_code)
INCLUDE (
  market_profile_code,
  screen_profile_code,
  field_profile_code,
  feature_profile_code,
  integration_profile_code
)
```

## 7. Migration Plan Guard

`scripts/deploy/devuat-migration-plan.mjs`의 필수 Migration Prefix를 `001~011`로 확장한다.

따라서 CI `pnpm env:check`는 `010` 또는 `011`이 누락되면 실패한다.

기존 실행 안전장치는 유지한다.

```text
Target: DEV / UAT only
Default: PLAN ONLY
Execution: --execute 필요
Mutation Gate: CRM_ALLOW_DB_MUTATION=YES 필요
DB Credential 필요
Production target 거부
```

## 8. Environment Execution Status

M9에서는 SQL Source만 작성한다.

```text
DEV DB Apply        NOT EXECUTED
UAT DB Apply        NOT EXECUTED
Production Apply    NOT EXECUTED / PROHIBITED
Backup/Snapshot     NOT VERIFIED IN M9
Post Migration DB Verification  NOT EXECUTED
```

실제 DEV/UAT 적용은 별도 Environment Gate에서 Backup/Snapshot과 대상 DB를 확인한 후 수행한다.

## 9. Post-Migration Verification Plan

실제 DEV/UAT 적용 후 아래 항목을 확인해야 한다.

```sql
SELECT
  company_id,
  company_code,
  country_code,
  market_profile_code,
  market_template_code,
  screen_profile_code,
  field_profile_code,
  feature_profile_code,
  workflow_profile_code,
  integration_profile_code,
  map_profile_code
FROM dbo.crm_company
ORDER BY company_id;
```

Column 확인:

```sql
SELECT c.name, t.name AS type_name, c.max_length, c.is_nullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.crm_company')
  AND c.name IN (
    'market_template_code',
    'screen_profile_code',
    'field_profile_code',
    'feature_profile_code',
    'integration_profile_code'
  )
ORDER BY c.column_id;
```

Index 확인:

```sql
SELECT name
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.crm_company')
  AND name = 'IX_crm_company_multi_market_profile';
```

## 10. Acceptance

M9 Source Acceptance:

```text
011 Migration Source created                 PASS
Existing 001~010 unchanged                   PASS
5 Multi-Market company columns defined       PASS
KR/HQ approved mapping backfill defined      PASS
US/MX GLOBAL approved mapping backfill       PASS
Unknown countries untouched                  PASS
Generic EAV table not introduced             PASS
Migration plan requires 001~011              PASS
Actual DB mutation                           NOT PERFORMED
Production mutation                          NOT PERFORMED
```

## 11. Next

M9 Human Review / Merge 후 다음 단계는:

```text
M10 — Regression / Responsive / PWA 검증
```

M10에서도 실제 DEV/UAT DB Migration이 자동으로 수행되었다고 간주하지 않는다. Source Regression과 Environment Execution Gate는 분리해서 관리한다.
