# RM-MKT-001 M11 — India Fit/Gap Matrix

- Work ID: `RM-MKT-001-M11`
- Comparison Baseline: `HQ_TEMPLATE` / `GLOBAL_TEMPLATE` / `INDIA CURRENT`
- Status: `PREPARED / INDIA_EVIDENCE_PENDING`

## 1. 판정 코드

| Code | 의미 | 후속 방향 |
| --- | --- | --- |
| `GLOBAL_REUSE` | GLOBAL Template을 그대로 재사용 가능 | Country Profile 연결 중심 |
| `GLOBAL_OVERRIDE` | GLOBAL 구조는 재사용하되 화면/필드/기능/Workflow/Integration 일부 Override 필요 | 최소 Override 설계 |
| `HQ_REUSE` | HQ Template 또는 HQ 공통 Component가 더 적합 | 재사용 근거 검토 |
| `COMMON_CORE_REUSE` | UI Template과 무관하게 공통 Domain/API/Contract 재사용 | Core 유지 |
| `NEW_TEMPLATE_REQUIRED` | 구조적 차이가 커 별도 Market Template 필요 | 신규 Template 설계 Gate |
| `NOT_APPLICABLE` | 인도에서 사용하지 않는 기능 | Profile 미노출 |
| `EVIDENCE_REQUIRED` | 자료 부족으로 판정 불가 | 구현 금지, 자료 요청 |

## 2. 분석 원칙

```text
1. Country = Locale 로 보지 않는다.
2. 화면 차이와 업무규칙 차이를 분리한다.
3. 작은 차이는 Profile/Override로 처리한다.
4. 구조적으로 큰 UI 차이만 별도 Component/Template 후보로 본다.
5. 기존 DIO CRM Domain/API를 우선 재사용한다.
6. 자료가 없는 항목은 EVIDENCE_REQUIRED로 남긴다.
7. 국가코드 if/else 추가는 해법으로 인정하지 않는다.
```

## 3. Process Fit/Gap

| Area | HQ_TEMPLATE | GLOBAL_TEMPLATE | INDIA CURRENT | Evidence | Decision | Gap / Action |
| --- | --- | --- | --- | --- | --- | --- |
| Lead | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Lead Conversion | Existing | Account + Contact + Opportunity | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Account / Contact | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Opportunity | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Contract | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Collection Plan | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Order | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Activity Plan | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Map / Activity Log | HQ activity flow | GLOBAL map/log baseline | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| GPS IN / OUT | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Activity Report | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Activity Approval | Existing | Existing | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |
| Direct Work / Leave | HQ only | Not exposed in GLOBAL baseline | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 자료수집 |

## 4. Screen Fit/Gap

| Screen Slot | HQ Screen | GLOBAL Screen | INDIA CURRENT | Decision | Required Override |
| --- | --- | --- | --- | --- | --- |
| lead | `HQ_LEAD` | `GLOBAL_LEAD` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| account | `HQ_ACCOUNT` | `GLOBAL_ACCOUNT` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| activity | `HQ_ACTIVITY` | `GLOBAL_ACTIVITY_MAP` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| activityReport | `HQ_ACTIVITY_REPORT` | `GLOBAL_ACTIVITY_REPORT` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| opportunity | `HQ_OPPORTUNITY` | `GLOBAL_OPPORTUNITY` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| contract | `HQ_CONTRACT` | `GLOBAL_CONTRACT` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| order | `HQ_ORDER` | `GLOBAL_ORDER` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |
| other | HQ additional screens | GLOBAL not yet proven | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | - |

## 5. Field / Section Fit/Gap

| Entity | Baseline Profile | INDIA CURRENT | Difference Type | Decision | Evidence |
| --- | --- | --- | --- | --- | --- |
| Account | `HQ_ACCOUNT` / `GLOBAL_ACCOUNT` | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Lead | Current screen model | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Opportunity | Current common contract | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Contract | Current common contract | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Order | Current common contract | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Activity | Current common contract | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |

Difference Type은 아래 중 하나로 기록한다.

```text
LABEL_ONLY
ORDER_ONLY
VISIBILITY
REQUIRED
READONLY
VALIDATION
NEW_FIELD
NEW_SECTION
STRUCTURAL_SCREEN_DIFFERENCE
```

## 6. Feature / Workflow Fit/Gap

| Category | DIO CRM Baseline | INDIA CURRENT | Decision | Open Question |
| --- | --- | --- | --- | --- |
| Feature Profile | HQ/GLOBAL 분리 | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 어떤 기능이 실제 사용되는가 |
| Approval Route | HQ/GLOBAL profile boundary | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 승인자/단계/반려가 어떻게 되는가 |
| Lock after Approval | Core rule exists for relevant flows | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 인도 승인 후 수정 정책 |
| GPS Policy | Configurable baseline | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 사용 여부/반경/정확도 정책 |
| Direct Work | HQ baseline only | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | 인도 사용 여부 |

## 7. Integration / SOR Fit/Gap

| Interface | DIO CRM Boundary | INDIA CURRENT | SOR | Decision | Evidence |
| --- | --- | --- | --- | --- | --- |
| ERP | Integration Adapter | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Customer Master | Adapter boundary | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Product | Adapter boundary | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Map | Map Profile/Adapter | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Notification | Not yet India-defined | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Other | - | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |

## 8. Localization Fit/Gap

아래는 기술적으로 지원 범위를 검토할 항목이며, 실제 India 값은 자료 확인 후 기록한다.

| Item | Current Framework | INDIA CURRENT | Decision |
| --- | --- | --- | --- |
| Locale | Globalization Context | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Currency | Globalization Context | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Timezone | Globalization Context | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Date/Time Format | Formatting layer | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Number Format | Formatting layer | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Address Format | Formatting layer | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Phone Format | Formatting layer | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |

## 9. Data Migration Fit/Gap

| Entity / Data | Source Count | History Needed | Attachment | Mapping Needed | Retention | Status |
| --- | ---: | --- | --- | --- | --- | --- |
| Lead | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Account/Contact | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Opportunity | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Activity | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |
| Contract/Order | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED | EVIDENCE_REQUIRED |

## 10. 최종 Template 판정 Gate

인도 자료 분석 후 아래 셋 중 하나로 결론낸다.

```text
A. GLOBAL_REUSE
   → GLOBAL_TEMPLATE + IN Country Profile

B. GLOBAL_OVERRIDE
   → GLOBAL_TEMPLATE + IN Country Profile + 최소 Screen/Field/Feature/Workflow/Integration Override

C. NEW_TEMPLATE_REQUIRED
   → 공통 Domain/API는 유지하고 별도 Market Template 설계
```

`NEW_TEMPLATE_REQUIRED`는 단순 필드/레이블 차이가 아니라 구조적 UI 또는 업무흐름 차이가 반복적으로 확인될 때만 선택한다.

현재 결론:

```text
INDIA_TEMPLATE_DECISION = EVIDENCE_REQUIRED
NO_INDIA_SOURCE_IMPLEMENTATION
```
