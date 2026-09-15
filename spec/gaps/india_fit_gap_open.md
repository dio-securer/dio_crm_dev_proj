# India CRM Fit/Gap — Open Scope

- Work ID: `RM-MKT-001-M11`
- Country: `IN`
- Status: `OPEN / EVIDENCE_REQUIRED`
- Implementation Status: `NOT_STARTED`

## Purpose

인도에서 현재 사용 중인 외부 CRM을 DIO CRM으로 통합/대체하기 위한 Fit/Gap 분석을 시작하기 전에, 미확정 요구사항을 명시적으로 Open Scope로 관리한다.

## Required Evidence

```text
Process
Screen
Field
Status / Transition
Approval
Role / Permission
Integration
Report
Mobile
Localization
Master / SOR
Data Migration
Security / Audit
Exception Flow
```

## Allowed Decisions

자료 확보 후 각 항목을 아래 중 하나로 분류한다.

```text
GLOBAL_REUSE
GLOBAL_OVERRIDE
HQ_REUSE
COMMON_CORE_REUSE
NEW_TEMPLATE_REQUIRED
NOT_APPLICABLE
EVIDENCE_REQUIRED
```

## Current Open Questions

1. 인도 CRM의 실제 Lead→Account/Contact→Opportunity→Contract→Order 흐름은 무엇인가?
2. Activity Plan / GPS / Map / IN-OUT / Report / Approval을 사용하는가?
3. 화면 구조가 GLOBAL Template과 어느 정도 동일한가?
4. 필드/Section 차이는 Profile 수준인가, 별도 Screen Component가 필요한가?
5. 승인자 조직구조와 반려/재승인/잠금 규칙은 무엇인가?
6. ERP/Customer/Product/Map 등 외부 시스템의 실제 SOR와 Interface는 무엇인가?
7. 모바일/Offline/PWA 요구는 무엇인가?
8. 기존 CRM 데이터를 어느 범위까지 이관해야 하는가?
9. 현지화/보안/감사 요구는 무엇인가?

## Guardrails

```text
- 인도 자료 없이 IN Country Profile 운영값 확정 금지
- INDIA_* Screen/Workflow/Integration 추정 구현 금지
- countryCode if/else 추가 금지
- Production/ERP 운영 변경 금지
- DB Migration 실제 적용 금지
```

관련 문서:

```text
docs/multi-market/onboarding/India_Source_Intake_Checklist.md
docs/multi-market/onboarding/India_FitGap_Matrix.md
```
