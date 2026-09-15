# RM-MKT-001 M11 — India Fit/Gap Preparation Report

- Work ID: `RM-MKT-001-M11`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m11-india-fitgap-prep`
- Baseline main: M10 merged main (`bd449bd8e6068b50508fe1626d6d41ab94ae02b3`)
- Status: `PREPARATION_READY / INDIA_INPUT_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

인도에서 현재 사용 중인 외부 CRM을 DIO CRM으로 통합/대체하기 전에 개발을 시작하지 않고, 실제 운영자료를 기반으로 `HQ_TEMPLATE / GLOBAL_TEMPLATE / INDIA CURRENT`를 비교할 수 있는 Fit/Gap 분석 구조를 먼저 준비한다.

이번 M11의 목적은 India 기능 구현이 아니라 **증거 수집 → 비교 → 재사용/Override/신규 Template 판정**을 위한 분석 기반을 만드는 것이다.

## 2. Prepared Artifacts

### 2.1 India Source Intake Checklist

```text
docs/multi-market/onboarding/India_Source_Intake_Checklist.md
```

수집 대상:

```text
System Overview
Process
Screen
Field
Status
Approval
Role/Permission
Integration
API/File Interface
Report
Mobile
Localization
Master/SOR
Data Migration
Audit/Security
Exception Flow
```

### 2.2 India Fit/Gap Matrix

```text
docs/multi-market/onboarding/India_FitGap_Matrix.md
```

비교 기준:

```text
HQ_TEMPLATE
GLOBAL_TEMPLATE
INDIA CURRENT
```

판정 코드:

```text
GLOBAL_REUSE
GLOBAL_OVERRIDE
HQ_REUSE
COMMON_CORE_REUSE
NEW_TEMPLATE_REQUIRED
NOT_APPLICABLE
EVIDENCE_REQUIRED
```

### 2.3 Open Gap Register

```text
spec/gaps/india_fit_gap_open.md
```

인도 요구사항을 자료 없이 구현하지 않도록 Open Question과 Guardrail을 명시했다.

## 3. Decision Flow

실제 인도 자료가 들어오면 다음 순서로 진행한다.

```text
India CRM 자료 수집
        ↓
Process 비교
        ↓
Screen 비교
        ↓
Field / Section 비교
        ↓
Feature 비교
        ↓
Workflow / Approval 비교
        ↓
Integration / SOR 비교
        ↓
Report / Mobile / Localization 비교
        ↓
Data Migration 비교
        ↓
Template Decision
```

Template Decision은 아래 셋 중 하나가 된다.

```text
A. GLOBAL_REUSE
   GLOBAL_TEMPLATE + IN Country Profile

B. GLOBAL_OVERRIDE
   GLOBAL_TEMPLATE + IN Country Profile + 최소 Override

C. NEW_TEMPLATE_REQUIRED
   공통 Domain/API 유지 + 별도 Market Template 설계
```

## 4. Important Boundary

현재 인도 CRM의 실제 화면/필드/상태/승인/연동 자료가 Repository에 없으므로 다음은 수행하지 않았다.

```text
IN Country Profile 운영값 확정
INDIA_ACCOUNT Screen 구현
INDIA_ACTIVITY Screen 구현
INDIA_ORDER Screen 구현
INDIA Workflow 구현
INDIA Integration 구현
DB Schema 확장
Data Migration Mapping 확정
```

즉, 이번 M11은 `PREPARATION` 단계이며 실제 Fit/Gap 판정은 India 자료가 확보된 후 수행한다.

## 5. Evidence Policy

인도 항목은 아래 등급으로 관리한다.

```text
CONFIRMED
OBSERVED
ASSUMPTION
EVIDENCE_REQUIRED
```

`ASSUMPTION` 및 `EVIDENCE_REQUIRED`는 구현 근거로 사용하지 않는다.

## 6. Source Safety

이번 작업은 문서/Spec 준비만 수행한다.

```text
Application Source Change        NONE
DB Migration Source Change       NONE
DEV DB Apply                     NOT EXECUTED
UAT DB Apply                     NOT EXECUTED
ERP Runtime Connection           NOT EXECUTED
Production                       NOT TOUCHED
India Business Rule              NOT IMPLEMENTED
```

## 7. M11 Acceptance

```text
[x] India Input Checklist 준비
[x] India Fit/Gap Matrix 준비
[x] Evidence 등급 정의
[x] Template Decision 기준 정의
[x] Process/Screen/Field/Feature/Workflow/Integration 비교 틀 준비
[x] Report/Mobile/Localization/Data Migration 분석 틀 준비
[x] Open Gap Register 작성
[x] 미확정 India Rule 구현 금지 명시
[ ] India 실제 자료 확보
[ ] India 실제 Fit/Gap 분석
[ ] India Template Decision
[ ] India Country Profile 구현
```

따라서 M11 준비 단계의 결과는:

```text
M11_PREPARATION_READY
INDIA_INPUT_PENDING
NO_INDIA_RULE_IMPLEMENTED
PRODUCTION_NOT_TOUCHED
```

## 8. Next Gate

Human Review 승인 후 본 문서들을 main에 병합한다.

그 다음 실제 India CRM 자료가 제공되면 동일 M11 분석 틀을 사용해 Fit/Gap을 채운다. 자료가 확보되기 전에는 M12의 일반 국가 Onboarding Framework로 넘어가더라도 India 전용 기능은 구현하지 않는다.
