# CRM-DEMO-001 — Lead / Account PC 화면설계

## 1. 설계 목적

모바일 Salesforce 화면의 정보구조를 PC에서 업무처리가 빠른 형태로 재해석한다. 모바일의 Section/단계/속성은 유지하되, PC에서는 한 화면에서 목록과 상세를 함께 보고 등록·수정·변환할 수 있도록 한다.

## 2. Lead 화면

### 2.1 목록 + 상세

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Lead  [Search] [Stage Filter]                           [+ New Lead] │
├─────────────────────────────────┬────────────────────────────────────┤
│ Lead / Hospital                 │ Selected Lead                     │
│ Stage                           │ Stage Flow                        │
│ Keyman                          │ NEW > FIRST VISIT > KEYMAN ...    │
│ Phone                           │                                    │
│ Owner                           │ Summary                           │
│                                 │ Keyman / Hospital & System / Other│
│                                 │                     [Edit][Convert]│
└─────────────────────────────────┴────────────────────────────────────┘
```

목록에서는 다건 비교에 필요한 정보만 노출한다. 상세에서 전체 속성을 Section으로 확인한다.

### 2.2 신규/편집

상단 `Quick registration` 영역에 자주 필요한 필드를 먼저 배치한다.

- Hospital / Account name
- Country
- Stage
- Phone
- Email
- Address
- Owner
- Interest

그 아래 접이식 Section:

- Keyman
- Hospital scale & system
- Business / Exclusion

따라서 최초에는 최소정보로 빠르게 저장하고, 영업 진행 중 상세정보를 보완할 수 있다.

### 2.3 변환

`Convert` 버튼은 별도 확인 Panel을 연다.

```text
Lead source
  Hospital name  → Account name
  Keyman name    → Contact name
  Interest       → Opportunity name seed

[Cancel] [Convert]
```

변환 후 Account 상세로 이동하고 Source Lead reference를 남긴다.

## 3. Account 화면

### 3.1 목록 + 상세

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Account [Search]                                        [+ Account] │
├─────────────────────────────────┬────────────────────────────────────┤
│ Code / Account                  │ Account Summary                    │
│ Status                          │ [Summary][Contacts][Management/ERP]│
│ ERP Integration                 │                                    │
│ Phone                           │ 선택 Tab 상세                      │
│ Owner                           │                                    │
└─────────────────────────────────┴────────────────────────────────────┘
```

### 3.2 Summary Tab

- Account code / name
- Country / Customer type
- Status / Grade
- ERP Integration Status
- Phone / Email / Address
- Owner
- Source Lead

### 3.3 Contacts Tab

거래처 내 연락처를 별도 메뉴 이동 없이 바로 관리한다.

조회컬럼:

- Name
- Customer type
- Phone
- Email

`+ New Contact`에서 연락처 기본/추가/개원 정보를 입력한다.

### 3.4 Management / ERP Tab

교육자료의 거래처 관리정보와 ERP 필수정보를 모은다.

- Business owner
- Business No.
- Legal representative
- Medical institution code
- Invoice email
- Postal code
- Open date
- ERP Customer code
- ERP approved

상단에 `ERP readiness 7 / 10` 형식으로 입력완성도를 표시한다. Prototype의 `Request registration`은 Mock 상태만 변경하고 외부 ERP를 호출하지 않는다.

## 4. 모바일 대응

920px 이하에서는 List와 Detail을 수직으로 배치한다.

- List 선택 → Detail이 아래에 이어짐
- 입력 Form은 1 column
- Button touch target 44px 이상
- Business key link는 동일 유지

실제 운영 Mobile UX는 별도 현장 검증 후 추가 조정한다.

## 5. 화면 간 이동

```text
Lead List
 → Lead Detail
 → Edit
 → Convert
 → Account Detail
    → Contacts
    → Source Lead
    → Opportunity / Contract / Order
```

Business key를 클릭해 Detail로 이동할 수 있으며, 기존 `UI Interaction Design Baseline`의 Entity Reference 원칙을 따른다.

## 6. UI 판단 기준

1. 사용자가 현재 단계와 다음 작업을 즉시 알 수 있는가
2. 최초 등록 시 입력부담이 과도하지 않은가
3. 목록에서 핵심상태를 비교할 수 있는가
4. 상세화면에서 관련 Record로 바로 이동할 수 있는가
5. PC와 Mobile에서 데이터 관계가 달라지지 않는가
6. ERP/국가별 미확정 규칙을 UI가 사실처럼 고정하지 않는가
