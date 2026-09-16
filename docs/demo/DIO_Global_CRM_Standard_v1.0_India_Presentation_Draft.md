# DIO Global CRM Standard v1.0 — India Presentation Draft

## 1. 제시 목적

India에 완성된 India 전용 업무규칙을 제시하는 문서가 아니다.

미국/멕시코 해외법인 자료를 기반으로 구현한 DIO의 GLOBAL CRM 표준 화면과 공통 Process를 먼저 제시하고, India 현재 CRM(Zoho)과의 차이를 Fit/Gap 방식으로 확인하기 위한 기준안이다.

## 2. GLOBAL Standard Menu

```text
Sales
- Lead
- Account
- Opportunity
- Contract
- Order

Activity
- Activity
- Activity Report
```

현재 GLOBAL 기준에서는 Direct Work / Direct Leave를 사용하지 않는다.

## 3. 표준 Process

### Sales

```text
Lead
 → Account / Contact
 → Opportunity
 → Contract / Collection Plan
 → Order
```

### Activity

```text
Activity Plan
 → Map / Activity Log
 → GPS IN
 → Consultation
 → GPS OUT
 → Activity Report
 → Approval Request
```

승인자 조직/Role과 실제 Integration Provider는 India 자료 확인 전 확정하지 않는다.

## 4. Standard UI Interaction

기준정보 및 Transaction의 Business Key는 관련 상세정보로 연결 가능한 구조를 사용한다.

```text
Order
 → Account Code
 → Contract No.
 → Product Code

Contract
 → Account Code
 → Opportunity No.
```

Prototype에서는 Account / Contract / Product 일부 Reference를 실제 시연한다.

## 5. India Fit/Gap 확인 항목

India 담당자는 GLOBAL Standard를 기준으로 각 항목을 다음과 같이 판정한다.

```text
USE AS-IS
FIELD ADD / REMOVE
SCREEN OVERRIDE
WORKFLOW CHANGE
APPROVAL CHANGE
LOCAL MASTER REQUIRED
INTEGRATION CHANGE
REPORT REQUIRED
NOT APPLICABLE
```

확인 영역:

```text
Lead
Account / Contact
Opportunity
Contract / Collection Plan
Order
Activity
Activity Report
Field / Section
Approval
Role / Permission
Zoho / ERP / External Integration
Report
Mobile
Localization
Data Migration
```

## 6. India 방향 결정 기준

```text
A. GLOBAL_REUSE
   GLOBAL_TEMPLATE을 그대로 사용

B. GLOBAL_OVERRIDE
   GLOBAL_TEMPLATE + India에 필요한 부분만 Override

C. NEW_TEMPLATE_REQUIRED
   실제 Fit/Gap 결과가 GLOBAL과 구조적으로 크게 다를 때만 검토
```

현재 단계에서는 A/B/C를 선행 확정하지 않는다.

## 7. Prototype와 실제 구축의 경계

Prototype:

```text
UI / Navigation
Mock Account CRUD
Representative Drill-down
Responsive PC / Mobile
```

실제 구축 단계:

```text
India 실제 사용자/조직
India Field
India Approval
India ERP / Zoho Interface
Data Migration
운영 Locale / Currency / Timezone
운영 Security / Permission
DEV / UAT / Production Deployment
```

## 8. Workshop 결과물

India 시연 후 아래 자료를 확보한다.

```text
Screen별 As-Is / To-Be
Field 목록
Status / Transition
Approval Flow
User / Role
Integration 목록
Report 목록
Mobile 사용방식
Data Migration 대상
Gap 우선순위
```

이 결과를 `India_FitGap_Matrix.md`에 반영하여 India 구현 범위를 확정한다.
