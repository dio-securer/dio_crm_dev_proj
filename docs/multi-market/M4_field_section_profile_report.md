# RM-MKT-001 M4 — Field / Section Profile Foundation Report

- Work ID: `RM-MKT-001-M4`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m4-field-profile`
- Baseline main: M3 merged main
- Status: `SOURCE_READY / CI_PASS / HUMAN_REVIEW_APPROVED / READY_TO_MERGE`

## 1. Objective

국가별 작은 Account 화면 차이를 Page 복제나 `countryCode` 조건문이 아니라 Field / Section Profile로 표현할 수 있는 Foundation을 만든다.

M4 Pilot 대상은 `Account`이다. 기존 HQ Account 화면/필드/API 계약은 변경하지 않고, GLOBAL Account가 별도 Section 조합을 가질 수 있는 구조를 추가한다.

## 2. New Structure

```text
frontend/src/market/field-profiles/
  types.ts
  HQ_ACCOUNT.ts
  GLOBAL_ACCOUNT.ts
  field-profile-resolver.ts
  field-profile-resolver.spec.ts
```

## 3. Profile Model

Field Profile은 다음 개념을 지원한다.

```text
Section Code
Section Order
Visible
Field Code
Field Visible
Required Override
Readonly
Label Key
Validation Rule Key
```

`Required`는 Profile에서 명시하지 않으면 기존 `ACCOUNT_INTERFACE_FIELDS.requiredOut`을 상속한다.

DB Field / API Field를 UI Label과 직접 결합하지 않도록 `labelKey`와 `validationRuleKey` 확장 지점을 분리했다.

## 4. HQ Account Baseline

`HQ_FIELD_PROFILE`은 현재 `FORM_SECTIONS`와 동일한 순서/필드 구성을 유지한다.

```text
Identity
HIRA
Address
Basic
ERP
Management
```

Test에서 `HQ_ACCOUNT_FIELD_PROFILE -> legacy form sections` 변환 결과가 기존 `FORM_SECTIONS`와 동일한지 검증한다.

따라서 M4 자체는 현재 본사 Account UI를 변경하지 않는다.

## 5. GLOBAL Account Baseline

M0의 미국/멕시코 GLOBAL Account 후보를 기준으로, 현재 Shared Account Contract에 이미 존재하는 필드만 사용한다.

```text
Identity
Basic
Address
ERP
Management
```

HQ 전용 HIRA Section은 GLOBAL Profile에 포함하지 않는다.

M4에서 제외한 HQ/HIRA Field:

```text
U_Key
medical_care_no
open_dt
doctor_no
```

GLOBAL Profile은 다음 Shared Field를 재사용한다.

```text
biz_no
hosp_nm
ceo_nm
email
sal_kd
tel
fax
homepage
zip_cd
addr1
addr2
addr_prt
cust_cd
cust_nm
trade_bc
trade_bc_nm
use_yn
appr_bc
mgt_yn
stat_bc
```

새로운 국가별 Account API/Entity를 만들지 않는다.

## 6. Resolver Rule

Field Profile 선택은 `fieldProfileCode`로 수행한다.

```text
HQ_FIELD_PROFILE     -> HQ Account Field Profile
GLOBAL_FIELD_PROFILE -> GLOBAL Account Field Profile
```

Legacy KR Payload만 아래 조건에서 HQ로 fallback한다.

```text
countryCode = KR
marketProfileCode = KR_SALES
```

미국/멕시코/기타 국가가 설정 오류로 HQ Field Profile을 조용히 사용하는 것은 허용하지 않는다.

Unknown Profile은 `FIELD_PROFILE_NOT_REGISTERED` Controlled Error로 처리한다.

## 7. Runtime Scope

M4에서는 기존 `AccountsPage`를 GLOBAL 화면으로 활성화하지 않는다.

```text
Current HQ AccountsPage
  -> 기존 FORM_SECTIONS 유지
  -> HQ Profile과 구조 동일성 Test 완료

GLOBAL_ACCOUNT_FIELD_PROFILE
  -> 구성 Foundation 완료
  -> 실제 GLOBAL_ACCOUNT Renderer/View 연결은 M7 범위
```

US/MX Runtime 활성화는 M8까지 하지 않는다.

## 8. Known Boundary

현재 ERP Account outbound required validation은 HQ 기준 Shared Interface Catalog에 존재한다.

GLOBAL Profile에서 HIRA Field를 숨기더라도 M4에서는 Backend ERP Validation Rule을 변경하지 않는다. 실제 해외법인 ERP 필수 Field/Adapter 정책은 M5 Integration Profile 및 M7/M8 승인 범위에서 확정한다.

즉 M4는 UI Field/Section Composition Foundation이며 ERP 업무규칙을 임의 변경하지 않는다.

## 9. Tests

```text
HQ Field Profile == Current FORM_SECTIONS
HQ Profile covers all existing Account interface fields
GLOBAL Profile excludes HQ-only HIRA fields
GLOBAL fields are all existing shared Account contract fields
requiredOut inheritance
KR -> HQ_FIELD_PROFILE
Legacy KR -> HQ fallback
Configured GLOBAL -> GLOBAL_FIELD_PROFILE
Unknown Profile -> controlled error
```

## 10. Explicit Non-Scope

```text
Account DB Schema 변경 없음
Account API 변경 없음
Backend ERP validation 변경 없음
US/MX Runtime 활성화 없음
GLOBAL Account 실제 화면 구현 없음 (M7)
Country-specific 신규 Field 임의 생성 없음
IN/PT/TR Field Profile 생성 없음
DEV/UAT/Production 변경 없음
```

## 11. CI / Human Review

```text
CI Run       34952427201
CI Job       104326321211
CI Result    PASS
Human Review APPROVED (2026-09-15 KST)
```

## 12. Gate

```text
Field Profile Types           COMPLETE
HQ Account Profile            COMPLETE
GLOBAL Account Profile        COMPLETE
Profile Resolver              COMPLETE
HQ Compatibility Adapter      COMPLETE
Country if/else avoidance     COMPLETE
CI                            PASS
Human Review                  APPROVED
Main Merge                    READY
```
