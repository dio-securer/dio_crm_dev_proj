# CRM-DEMO-001 — Lead / Account A+B 복합형 Prototype 작업지시서 v2

## 0. 목적 / 현재 Gate

해외법인 판매 프로세스 교육자료 p.4~12를 기준으로 Lead → Account / Contact 업무흐름을 `A. Split Workspace + B. Step Form / Progressive Detail` UI로 재구성한다.

이번 문서는 `화면설계 확정 전 구현지시서`다.

현재 Gate:

```text
Source 분석           COMPLETE
A/B UI 방향 결정      COMPLETE
PC/Mobile 설계문서    COMPLETE
상세 작업지시서       COMPLETE
이미지 시안           NEXT
Prototype 재구현      HOLD until image review
main merge             NOT APPROVED
```

Concept C는 현재 운영화면 구현 대상이 아니며 향후 Dashboard / Account 360에 사용한다.

---

# 1. Source Basis / 변경금지 업무사실

다음은 교육자료에서 확인된 내용이므로 Prototype UI가 임의로 변경하면 안 된다.

## Lead

- 잠재고객 관리
- 단계: `신규등록 → 초도방문 → 키맨미팅 → 변환` / `컨택제외`
- 요약정보
- 활동정보
- 단계 및 Key Field
- 기본정보
- Keyman 정보
- 병원 규모 및 시스템 정보
- 기타정보
- 변환 시 Account / Contact / Opportunity 연결

## Contact

- Account의 담당자/관련 인원
- 기본정보
- 추가정보
- 개원정보
- 활동 연결

## Account

- 기존 거래 중 또는 향후 거래 예정 병원정보
- 요약정보
- 활동정보
- 거래처 기본정보
- 거래상태
- 관리정보
- 주소정보
- ERP 연동정보

## ERP Registration Request Required Source Fields

1. 사업주 이름
2. 사업자번호
3. 법정대리인 성명
4. 의료기관 코드
5. 송장 발행 이메일
6. 고객 유형
7. 전화번호
8. 우편번호
9. 병원주소
10. 개원일자

교육자료에 없는 India/PT/TR 등 국가별 필수값, 승인자, ERP Provider는 임의 구현 금지.

---

# 2. UI Architecture 결정

## 2.1 Browse / Detail

`Split Workspace` 사용.

```text
Desktop
List / Search / Filter | Selected Detail / Sections / Related
```

## 2.2 Create / Edit

`Quick Create + Progressive Detail` 사용.

```text
Quick Registration
        ↓ save
Progressive Detail Sections
        ↓
Process Action / Convert / ERP Readiness
```

## 2.3 Mobile

PC Split Workspace의 세로 적층 금지.

```text
List → Full Detail → Editor → Same Detail
```

## 2.4 Dashboard

Concept C 화면은 이번 Work Item에서 구현하지 않는다.

---

# 3. 구현 전 Code Refactor 지시

현재 `frontend/src/demo/LeadAccountDemoScreens.tsx`가 Lead/Account를 한 파일에 많이 포함하고 있으므로 최종 UI 구현 시 역할별로 분리한다.

권장 구조:

```text
frontend/src/demo/lead-account/
  model.ts
  demo-store.ts
  i18n-keys.ts

  lead/
    LeadWorkspacePage.tsx
    LeadListPane.tsx
    LeadDetailPane.tsx
    LeadEditor.tsx
    LeadStageFlow.tsx
    LeadConversionReview.tsx

  account/
    AccountWorkspacePage.tsx
    AccountListPane.tsx
    AccountDetailPane.tsx
    AccountEditor.tsx
    AccountSummary.tsx
    AccountContacts.tsx
    AccountTradeStatus.tsx
    AccountManagement.tsx
    AccountAddress.tsx
    AccountErpReadiness.tsx
    AccountActivity.tsx
    AccountRelated.tsx

  contact/
    ContactList.tsx
    ContactEditor.tsx

  shared/
    WorkspaceSplit.tsx
    DetailTabs.tsx
    ProgressiveSection.tsx
    ReferenceLink.tsx
    StatusBadge.tsx
    StickyFormActions.tsx
```

실제 파일명은 기존 프로젝트 conventions와 충돌하지 않도록 구현 시 조정 가능하다. 중요한 것은 `한 컴포넌트에 전체 Entity UI를 몰아넣지 않는 것`이다.

---

# 4. Data Model / Demo Store 작업

Prototype은 Local Storage를 유지한다.

## 4.1 Lead Model

교육자료 속성을 수용할 수 있어야 한다.

Group:

- Identity / Basic
- Stage
- Keyman
- Hospital / System
- Exclusion
- Conversion Reference

## 4.2 Account Model

현재 단순 DemoAccount를 `Account Core + Account Profile` 개념으로 유지하거나 단일 Demo View Model로 재정리할 수 있다.

필수 수용영역:

- Identity
- Trade Status
- Management
- Address
- ERP Integration
- Source Lead

## 4.3 Contact Model

- Account reference
- Source Lead reference optional
- Basic
- Additional
- Opening

## 4.4 Relationship

```text
Lead.convertedAccountId / Code
Account.sourceLeadId / Code
Contact.accountId / Code
Contact.sourceLeadId / Code
```

화면 표시 Business Key와 내부 Navigation ID를 분리할 수 있도록 구조 유지.

## 4.5 Demo Persistence

- Local Storage schema version을 올릴 경우 기존 seed와 충돌하지 않도록 새 key version 사용
- Reset Demo는 Lead / Account / Contact / conversion state를 함께 초기화
- 실제 credential / server info를 local storage에 저장하지 않는다.

---

# 5. Lead PC 구현지시

## L-PC-01 Workspace Header

구현:

- Title: Lead
- Search
- Stage Filter
- Owner Filter 또는 확장점
- More Filters
- Primary `+ New Lead`

Acceptance:

- 검색과 필터를 사용해도 선택 Record context가 예측 가능해야 함
- 다국어에서 action button text가 잘리지 않아야 함

## L-PC-02 List Pane

Default columns:

- Hospital / Lead Code
- Stage
- Keyman
- Phone
- Owner

행 클릭 → Detail 선택.

Lead Code 또는 Hospital Name을 Reference interaction 대상으로 사용할 수 있으나 row click과 충돌하지 않게 한다.

## L-PC-03 Detail Header

표시:

- Hospital Name
- Lead Code
- Stage
- Owner
- Phone / Email
- Interest

Actions:

- Edit
- Convert
- More

Converted / Contact Excluded 상태에서는 Convert 비활성 또는 미노출.

## L-PC-04 Stage Flow

4 main stages + exclusion branch.

Stage Flow는 시각화이며 단순 클릭 즉시 전환 금지.

## L-PC-05 Detail Sections

- Summary
- Keyman
- Hospital / System
- Activity
- Other / Exclusion
- Conversion / Source relation

Section에 값이 없을 때 `-`만 대량 표시하지 말고 Empty State 또는 `Not entered`를 적절히 사용.

## L-PC-06 New / Edit

Quick Registration을 첫 화면에서 펼친다.

상세 Section은 Accordion.

Save validation:

- Source에서 확정되지 않은 Required를 임의 강제하지 않는다.
- Prototype 최소 저장조건은 UI 시연 목적에 필요한 이름 등 최소 범위만 사용하고 문서에 `prototype-only`로 표시.

## L-PC-07 Convert Review

변환 전 mapping 확인:

- Account destination
- Contact destination
- Opportunity seed

Convert 결과:

- Lead stage CONVERTED
- Account 생성
- Contact 생성
- Source Lead reference
- Account Detail로 navigation

---

# 6. Lead Mobile 구현지시

## L-M-01 List

Table 금지. Compact Card/Row.

Card priority:

- Hospital
- Stage
- Lead Code
- Keyman
- Phone
- Owner

## L-M-02 Filter

Mobile Filter는 Drawer/Bottom Sheet 형태 후보.

이미지 시안에서 최종 확정 전 source 구현 금지.

## L-M-03 Detail

- Top Summary
- Compact Stage Stepper
- Accordion Sections
- Edit / Convert sticky or reachable actions

## L-M-04 Editor

- 1 column
- >=44px controls
- Accordion
- Sticky Save / Cancel
- safe-area

---

# 7. Account PC 구현지시

## A-PC-01 Header / Filter

- Search
- Status
- Grade
- ERP Status
- Country/Company Context
- Owner
- `+ New Account`

## A-PC-02 List Pane

Default columns:

- Account Code / Name
- Status
- Grade
- ERP Status
- Owner
- Phone

Column priority:

```text
P1 Code/Name
P1 Status
P1 ERP Status
P1 Owner
P2 Grade
P2 Phone
```

화면폭 감소 시 P2부터 감춘다.

## A-PC-03 Detail Header

- Account Name
- Account Code Reference Link
- Status
- Grade
- ERP Status
- Owner
- Phone / Email
- Country/Customer Type
- Source Lead Reference

Action:

- Edit
- More

## A-PC-04 Detail Tabs

Desktop 기본:

1. Summary
2. Contacts
3. Trade Status
4. Management
5. Address
6. ERP
7. Activity
8. Related

Tab이 화면폭을 넘으면 Horizontal Scroll 또는 `More`를 사용한다. 텍스트를 과도하게 축소하지 않는다.

## A-PC-05 Summary

5초 정보파악 화면.

- Core identity
- Status badges
- Contact summary
- Address summary
- Source Lead
- Activity summary
- Related counts

여기에서 20+ 속성을 전부 표시하지 않는다.

## A-PC-06 Contacts

- Contact List
- Create Contact
- Edit Contact
- Source Lead link

Contact fields는 교육자료의 Basic / Additional / Opening을 모두 수용.

## A-PC-07 Trade Status

교육자료 상태정보 그룹.

## A-PC-08 Management

사업자/대표자/개원정보.

## A-PC-09 Address

Postal / Address.

Country-specific address formatter/fields는 Profile 확장점으로 남긴다.

## A-PC-10 ERP

ERP Readiness 10개 source fields.

UI:

```text
ERP Readiness  7 / 10
[Missing 3 fields]

Integration Status
ERP Customer Code
Approval Status

[Request Registration]
```

Prototype button은 mock transition only.

## A-PC-11 Activity

Visits / Calls relation summary.

## A-PC-12 Related

Opportunity / Contract / Order.

Business Key click → Drill-down.

---

# 8. Account Mobile 구현지시

## A-M-01 List

- Card / Compact Row
- Name
- Code
- Status
- Grade
- ERP Status
- Owner

## A-M-02 Detail Top Summary

- Name / Code
- Status badges
- Owner
- Call / Email quick actions

## A-M-03 Navigation

이미지 시안에서 다음 둘 중 비교 후 확정:

### Candidate 1

```text
Summary / Contacts / ERP / Related / More
```

### Candidate 2

Horizontal scroll tabs:

```text
Summary / Contacts / Trade / Management / Address / ERP / Activity / Related
```

정보량과 다국어 label length를 고려하면 Candidate 1을 기본 후보로 한다.

## A-M-04 More

- Trade Status
- Management
- Address
- Activity

## A-M-05 Edit

Accordion Progressive Form + Sticky actions.

---

# 9. i18n / Globalization 구현지시

## I18N-01 Hard-coded UI string 제거

최종 Prototype 재구현 시 새 UI의 visible string은 locale resource를 사용한다.

한국어도 Resource 사용.

## I18N-02 Key namespace

권장:

```text
crm.common.*
crm.lead.*
crm.account.*
crm.contact.*
crm.erp.*
crm.activity.*
```

Example:

```text
crm.lead.stage.new
crm.lead.section.keyman
crm.account.section.management
crm.account.integration.beforeRequest
crm.common.action.save
```

## I18N-03 Locale Support

Prototype에서 실제로 제공할 번역언어 수는 별도 승인 대상.

구조적으로:

- `ko-KR` 포함 필수
- `en-*` 계열 지원 가능
- Mexico/India/Portugal/Türkiye 등은 실제 법인 운영언어 확인 후 추가

국가코드만 보고 언어를 임의 결정하지 않는다.

## I18N-04 Formatting

- date → locale formatter
- currency → context currency formatter
- number → locale formatter
- timezone → globalization context

## I18N-05 Layout Test

다국어 검증 시 긴 test label을 사용해:

- button overflow
- tab overflow
- grid header
- form label
- mobile width

을 확인한다.

---

# 10. Styling / Responsive 구현지시

기존 DIO CRM token / global style을 유지하고 demo 전용 CSS는 최소화한다.

## Desktop

- list 38~42%
- detail 58~62%
- detail min width 보호
- list horizontal scroll에 의존하지 않도록 core column 수 제한

## Tablet

- compressed split 또는 context-preserving layout
- 이미지 시안 승인 후 확정

## Mobile

- view transition
- card list
- full detail
- single-column editor
- safe-area

---

# 11. State / Navigation 지시

## PC

Detail 이동 후 유지:

- search
- filter
- selected row
- list scroll

## Mobile

Back 시 유지:

- search/filter
- scroll
- previous selection

## Reference Link

Account Code, Source Lead, Contract No., Opportunity No. 등은 공통 Reference Link 규칙을 따른다.

URL에 DB identity를 직접 노출하는 구조는 피하고 public/navigation id 구조를 유지한다.

---

# 12. Prototype Demo Data 지시

- US / MX mock data 유지 가능
- India mock은 `fit-gap discussion seed`임을 명확히 표시
- 실제 회사/개인정보처럼 보이는 민감 데이터 사용 금지
- `demo` domain / fictitious values 사용
- ERP success/failure 예시를 적절히 seed
- Lead NEW / FIRST_VISIT / KEYMAN_MEETING / CONVERTED 상태 예시 포함

---

# 13. Automated Test 지시

최종 source 반영 시 최소 테스트:

## Unit

- Lead create/update
- Lead conversion relationship
- Account create/update
- Contact create/update
- ERP readiness count
- Local storage migration/reset
- Reference navigation helper

## Regression

```text
[ ] GLOBAL screen manifest unchanged unless approved
[ ] Direct Work remains hidden in GLOBAL
[ ] HQ template unaffected
[ ] Demo mode only overrides GLOBAL demo screens
```

## CI

```text
[ ] pnpm build
[ ] pnpm test
[ ] pnpm regression:multi-market
[ ] pnpm i18n:check
[ ] pnpm i18n:hardcode
[ ] pnpm pwa:check
[ ] pnpm env:check
[ ] pnpm audit:critical
```

---

# 14. Manual Review Scenario

## Lead PC

1. List 검색/필터
2. Lead 선택
3. 단계/요약 확인
4. Section 탐색
5. Edit
6. 신규등록
7. Convert Review
8. Convert → Account

## Account PC

1. 변환된 Account 확인
2. Source Lead click
3. Contacts 확인
4. Contact 신규
5. Trade / Management / Address 확인
6. ERP readiness 확인
7. Related Business Key drill-down

## Mobile

1. Lead List → Detail
2. Lead Detail → Edit
3. Back context 유지
4. Account List → Detail
5. Account detail sections
6. Sticky Save
7. Tab/More 사용성

## i18n

1. ko-KR
2. en locale
3. 긴 label stress test
4. date/number/currency formatting

---

# 15. Image Review Gate — 다음 작업

이 작업지시서가 완료된 뒤 `코드 구현보다 먼저` 이미지 시안을 만든다.

필수 4종:

1. PC Lead
2. Mobile Lead
3. PC Account
4. Mobile Account

이미지에서 사용자 승인받을 내용:

```text
[ ] Split ratio
[ ] 정보밀도
[ ] Section 그룹
[ ] Tab 구조
[ ] Quick Create 영역
[ ] Mobile Navigation
[ ] Status/Badge 표현
[ ] Primary Action 위치
[ ] 다국어 확장 시 Layout
```

이미지 승인 후 구현 단계로 넘어간다.

---

# 16. 구현 단계 Gate

이미지 승인 이후에만 아래 순서로 진행한다.

```text
P1 Shared Workspace Components
P2 Lead PC
P3 Lead Mobile
P4 Account / Contact PC
P5 Account / Contact Mobile
P6 i18n Resource 적용
P7 Demo data / Drill-down
P8 Automated Test / CI
P9 Human Screen Review
P10 PR merge approval
```

각 단계에서 실제 India 업무규칙을 새로 만들지 않는다.

---

# 17. 완료 정의

`CRM-DEMO-001 Lead/Account A+B UI`가 완료됐다고 말하려면 모두 만족해야 한다.

- Source p.4~12의 Lead/Account/Contact 관리영역 수용
- Lead → Account / Contact conversion 동작
- PC Split Workspace
- Quick Create + Progressive Edit
- Mobile List → Detail → Edit
- Account 다수속성 Tab/Section 구조
- ERP readiness 10개 source field
- Reference drill-down
- 한국어 포함 i18n 구조
- HQ regression pass
- GLOBAL regression pass
- CI pass
- 실제 화면 Human Review 승인

그 전에는 `Prototype Complete`라고 표현하지 않는다.
