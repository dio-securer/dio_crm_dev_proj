# CRM-DEMO-001 — Lead / Account PC·Mobile A+B 복합형 화면설계 v2

## 0. 결정사항

### 운영형 화면

`Concept A — Split Workspace`와 `Concept B — Step Form + Detail Sections`를 결합한다.

```text
조회 / 탐색 / 상세확인 = A. Split Workspace
신규 / 편집 / 단계별 입력 = B. Step Form + Progressive Detail
```

### 향후 Dashboard

`Concept C — Dashboard Summary + Deep Detail`은 본 문서의 운영형 화면과 분리하고 향후 Dashboard / Account 360 / 경영진 요약 화면에 사용한다.

## 1. 공통 Information Architecture

정보량이 20개 이상인 Entity를 기본 가정으로 한다.

### 1.1 4-Level 정보계층

```text
Level 1 — List Essentials
  다건 비교와 선택에 필요한 핵심 5~8개 속성

Level 2 — Header Summary
  선택 Record의 상태와 업무판단에 필요한 핵심정보

Level 3 — Detail Sections
  Basic / Keyman / Management / ERP / Address / Activity 등 전체 관리속성

Level 4 — Related Records
  Contact / Opportunity / Contract / Order / Source Lead 등 관계정보
```

모든 속성을 List나 첫 화면에 노출하지 않는다.

### 1.2 Action 계층

Primary Action은 화면당 1개를 원칙으로 한다.

예:

- List: `+ New Lead`, `+ New Account`
- Lead Detail: `Convert`
- Edit Mode: `Save`
- ERP Section: `Request Registration` — Prototype에서는 Mock only

Edit / Cancel / More 등은 Secondary Action으로 둔다.

---

# 2. PC — Lead Workspace

## 2.1 기본 Layout

권장 Desktop 1440px 기준:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ App Header / Global Search / Locale / User                                  │
├──────────┬────────────────────────────────────────────────────────────────────┤
│ Sidebar  │ Lead Header [Search] [Stage] [Owner] [More Filters] [+ New Lead] │
│          ├───────────────────────────────┬─────────────────────────────────────┤
│          │ A. Lead List 38~42%          │ A. Lead Detail 58~62%              │
│          │                               │                                     │
│          │ Lead/Hospital                 │ Record Header                       │
│          │ Stage                         │ Stage Flow                          │
│          │ Keyman                        │ Summary                             │
│          │ Phone                         │ [Basic][Keyman][Hospital/System]    │
│          │ Owner                         │ [Activity][Other/Exclusion]         │
│          │                               │                                     │
│          │                               │ [Edit] [Convert]                    │
│          └───────────────────────────────┴─────────────────────────────────────┤
└──────────┴─────────────────────────────────────────────────────────────────────┘
```

List pane은 사용자가 여러 Lead를 연속 처리하기 위한 Workspace다. Detail을 열어도 List context를 유지한다.

## 2.2 Lead List

### 기본 컬럼

1. 병원명 / Lead Code
2. 단계
3. Keyman
4. 전화번호
5. 영업담당자

### Optional Column / 사용자 설정 후보

- 국가
- 관심품목
- 최근 활동
- 개원일자

Optional은 Prototype 시 필수 구현 대상이 아니며 향후 Grid Column Preference에 대비한다.

### Filter

- Text Search: Lead Code / 병원명 / Keyman / Phone
- Stage
- Country/Company context
- Owner
- More Filters 확장점

## 2.3 Lead Detail Header

항상 보여야 하는 정보:

- 병원명
- Lead Code
- Stage Badge
- Owner
- 전화번호
- 주요 관심품목
- Source/Status warning

Action:

```text
[Edit] [Convert] [...]
```

`Contact Excluded` 또는 `Converted` 상태에서는 허용 Action이 달라진다.

## 2.4 Stage Flow

```text
1 신규등록 ── 2 초도방문 ── 3 키맨미팅 ── 4 변환
                         └── 컨택제외
```

- 현재 Stage 명확히 강조
- 완료 Stage 체크 표시
- Stage 클릭 자체가 즉시 상태변경을 의미하지 않도록 한다.
- 변경은 Edit / Stage Action을 통해 명시적으로 처리한다.

## 2.5 Detail Section

### Summary

- 병원주소
- 병원명
- 전화번호
- 이메일
- 관심품목
- 영업담당자

### Keyman

- 고객유형
- 고객이름
- 휴대폰
- 이메일
- 출신학교
- 전공
- 기수
- 특이사항

### Hospital / System

- 총 의사 수
- 치과 전문의 수
- 메인 시스템
- 서브 시스템
- 특이사항

### Activity

- 방문이력
- 통화이력

Activity의 실제 데이터모델은 별도 Activity Domain을 참조하며 Lead의 단순 Column으로 중복 저장하지 않는다.

### Other / Exclusion

- 사업자정보
- 컨택제외 사유
- 컨택제외 상세사유

## 2.6 Lead New / Edit — B Pattern

조회 Workspace 위에 Drawer를 좁게 띄우는 방식이 아니라, 많은 필드를 다뤄야 하므로 `Wide Editor` 또는 `Dedicated Editor Surface`를 사용한다.

### Quick Registration — 기본 펼침

```text
병원명 *        Country/Company Context
전화번호        이메일
주소            영업담당자
관심품목        개원일자 / 웹사이트
```

실제 Required 표시는 Source/검증된 Rule에만 적용한다.

### Progressive Sections

```text
▼ Keyman
▶ Hospital / System
▶ Business / Exclusion
```

현재 Stage와 관련된 Section을 우선 펼친다.

### Bottom Action

```text
[Cancel]                         [Save]
```

긴 Form에서도 Action을 찾기 쉽도록 Sticky Action Bar 후보로 설계한다.

## 2.7 Lead Convert

Convert는 Modal보다 정보량이 많으면 `Conversion Review Panel`로 제공한다.

```text
Lead LD-...

Account
  병원명 / 전화 / 주소 / 기본정보

Contact
  Keyman / Phone / Email / 출신정보

Opportunity Seed
  관심품목 / 제안명

[Cancel] [Convert & Open Account]
```

변환 완료 후 Account Detail로 이동한다.

---

# 3. Mobile — Lead

## 3.1 Navigation

PC Split Workspace를 그대로 세로 적층하지 않는다.

```text
Lead List
  ↓ tap
Lead Full Detail
  ↓ Edit / Stage Action
Lead Editor
  ↓ Save
Same Lead Detail
```

## 3.2 Lead List

Card 또는 Compact Row:

```text
병원명                       [Stage]
Lead Code
Keyman · Phone
Owner
```

- Search 상단 고정
- Filter Bottom Sheet
- `+` 또는 `신규등록` Floating/Sticky Action

## 3.3 Lead Detail

Top Summary:

- 병원명 / Code
- Stage
- Owner
- 전화 / 이메일 Quick Action

Stage Flow는 4단계 Compact Stepper로 표시한다.

Detail은 Accordion:

```text
▼ 기본정보
▶ Keyman
▶ 병원규모·시스템
▶ 활동이력
▶ 기타 / 컨택제외
▶ 변환정보
```

## 3.4 Mobile Edit

- 1 column
- Label은 input 위에 배치
- Touch target 최소 44px
- Section Accordion
- Sticky Bottom Action: `Cancel / Save`
- Keyboard가 Save Action을 완전히 가리지 않도록 safe-area 처리

---

# 4. PC — Account Workspace

## 4.1 기본 Layout

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Account [Search] [Status] [Grade] [ERP Status] [Owner]      [+ New Account] │
├──────────────────────────────────┬────────────────────────────────────────────┤
│ Account List 38~42%              │ Account Detail 58~62%                     │
│                                  │                                            │
│ Code / Name                      │ Header Summary                             │
│ Status / Grade                   │ [Summary][Contacts][Trade][Management]     │
│ ERP Status                       │ [Address][ERP][Activity][Related]          │
│ Owner / Phone                    │                                            │
│                                  │ Section Content                            │
└──────────────────────────────────┴────────────────────────────────────────────┘
```

## 4.2 Account List — 핵심 조회속성

권장 기본 컬럼:

1. 거래처코드 / 거래처명
2. 거래처 상태
3. 거래처 등급
4. ERP 연동상태
5. 영업담당자
6. 대표 전화

화면폭에 따라 Phone 또는 Grade는 responsive priority로 숨길 수 있다.

검색:

- Code
- Name
- Phone
- Owner

Filter:

- Status
- Grade
- ERP Integration Status
- Country / Company context
- Owner

## 4.3 Account Header Summary

Detail 진입 시 가장 먼저 보여준다.

```text
Account Name                             [Edit] [...]
Account Code  [Status] [Grade] [ERP Status]
Country / Customer Type / Owner
Phone / Email
Source Lead
```

`Account Code`, `Source Lead` 등 Business Key는 Drill-down 가능하도록 설계한다.

## 4.4 Account Detail Tabs

속성이 많으므로 Tab + 내부 Section을 조합한다.

### Tab 1 — Summary

목적: 거래처를 5초 안에 이해

- 거래처명 / Code
- 상태
- 등급
- ERP 상태
- Owner
- Phone / Email
- Customer Type
- Address summary
- Source Lead
- 최근 Activity 요약
- Related Record count

### Tab 2 — Contacts

- Contact List
- `+ New Contact`
- Contact Name
- Customer Type
- Phone
- Email
- Source Lead

Contact row click → Contact Detail / Edit

### Tab 3 — Trade Status

교육자료의 거래상태:

- 거래처 상태
- 거래처 등급
- 거래여부
- 거래처 현황

### Tab 4 — Management

- 사업자명
- 사업자등록번호
- 대표자명
- 개원일자
- 향후 국가별 관리속성 추가 위치

### Tab 5 — Address

- 우편번호
- 병원주소
- 향후 국가별 Address Component 확장점

### Tab 6 — ERP

Top:

```text
ERP Readiness    7 / 10
Integration      BEFORE_REQUEST
[Request Registration]
```

Detail:

- 사업주 이름
- 사업자번호
- 법정대리인 성명
- 의료기관 코드
- 송장 발행 이메일
- 고객 유형
- 전화번호
- 우편번호
- 병원주소
- 개원일자
- ERP 거래처 코드
- 승인 여부
- 연동 상태

`Request Registration`은 Prototype에서 실제 외부 호출 금지.

### Tab 7 — Activity

- 방문 이력
- 통화 이력

### Tab 8 — Related

- Opportunity
- Contract
- Order

각 Business Key는 Reference Link로 Detail Drill-down.

## 4.5 Account New / Edit — B Pattern

Account는 많은 관리속성을 가진다는 전제로 다음 방식 사용.

### Quick Registration

```text
거래처명 *
Country / Company Context
Customer Type
Phone
Email
Address
Owner
```

### Detail Sections

```text
▼ 기본정보
▶ 거래상태
▶ 관리정보
▶ 주소
▶ ERP 준비정보
```

Contact는 Account 저장 후 별도 Related Entity로 추가한다.

ERP 10개 Required는 일반 Account 첫 저장 Required와 동일하게 취급하지 않는다. `ERP Registration Request 시점`의 readiness로 구분한다.

---

# 5. Mobile — Account

## 5.1 Account List

```text
[Search Account] [Filter]

Account Name                  [Status]
Account Code · Grade
Owner · ERP Status
```

- Mobile Table 사용 지양
- Card/Compact List 기본
- 신규등록 Action은 Floating 또는 상단 Button

## 5.2 Account Detail

Top Summary Card:

- 거래처명
- Code
- Status / Grade / ERP Status
- Owner
- Call / Email Quick Action

Tab이 너무 많아지므로 Mobile에서는 1차 Navigation을 최대 4~5개로 줄이고 나머지는 More/Accordion으로 묶는다.

권장:

```text
[Summary] [Contacts] [ERP] [Related] [More]
```

More:

```text
Trade Status
Management
Address
Activity
```

또는 실제 이미지 검토에서 Horizontal Tab Scroll 방식과 비교한다.

## 5.3 Account Edit

1-column Progressive Form:

```text
▼ 기본정보
▶ 거래상태
▶ 관리정보
▶ 주소
▶ ERP 준비정보
```

- Sticky Save
- Section별 완료표시 가능
- Required Error는 상단 Summary + 해당 Section 두 곳에 표시

---

# 6. 다국어 / 다국가 UI 설계

## 6.1 i18n 필수

한국어도 예외 없이 Resource 파일을 사용한다.

```text
ko-KR
  crm.account.title = 거래처
  crm.account.action.create = 신규등록

en-US
  crm.account.title = Account
  crm.account.action.create = New Account
```

실제 지원언어 목록은 법인 요구 확인 후 확정한다.

## 6.2 Label Length

- 한글 기준 폭에 맞춘 Fixed Label Width 금지
- Grid Column은 Header 번역 길이에 따라 Resize 가능
- Tab은 내용에 맞는 padding 사용
- 긴 번역은 wrapping보다 Tab scroll / More 우선
- Button은 text growth를 허용

## 6.3 Locale Formatting

- Date: `Intl.DateTimeFormat`
- Number: `Intl.NumberFormat`
- Currency: Context의 currency 사용
- Timezone: Company/User Context 사용
- Address: 국가별 Component 확장 가능

## 6.4 Context 분리

```text
Country Profile    ≠ Locale
Locale             ≠ Currency
Currency           ≠ Timezone
UI Template        ≠ Workflow Profile
```

국가코드로 직접 UI 문구나 날짜형식을 if/else 처리하지 않는다.

---

# 7. Responsive 규칙

### Desktop ≥ 1101

- Sidebar + Split Workspace
- List 38~42%, Detail 58~62%
- Editor는 Detail pane보다 넓은 dedicated surface 허용

### Tablet 921~1100

- Sidebar 축소/숨김 가능
- Split ratio 40/60 또는 List compact
- Detail Tab horizontal scroll 허용

### Mobile ≤ 920 / coarse pointer

- List와 Detail route/view 분리
- Table → Card/Compact List
- 1-column Form
- 44px minimum touch target
- bottom safe area

### Narrow Mobile ≤ 430

- Header action 1개만 Primary 노출
- Secondary는 More
- Summary card는 1~2 column metric

---

# 8. 화면상태 보존

PC:

- List Search
- Filter
- Sort
- Selected Record
- Scroll position

Mobile:

- Detail → Back 시 List Filter / Scroll 복원
- Edit Cancel / Save 후 동일 Record Detail 복귀

Create 중 Navigation 이탈 시 dirty state warning은 향후 실제 운영폼에서 적용할 수 있도록 구조 확보.

---

# 9. 접근성 / 사용성

- Keyboard focus 표시
- Tab/Accordion button semantics
- Status는 색상만으로 구분하지 않고 text 병행
- Required는 `*` + validation message
- Error 발생 시 첫 오류로 focus 이동
- Disabled Action에는 이유를 보조문구로 제공
- Link와 일반 text를 시각적으로 구분

---

# 10. 이미지 시안에서 검증할 항목 — 다음 작업

이 문서 승인 후 다음 작업에서 실제 이미지 시안을 만든다.

이미지 시안은 최소 다음 4장을 비교한다.

1. PC Lead — Split List/Detail + Stage / Section
2. Mobile Lead — List / Detail / Step Editor
3. PC Account — Split List/Detail + Multi Tab + ERP
4. Mobile Account — Summary + Contacts/ERP/More + Progressive Edit

이미지 검토에서 확정할 항목:

- List : Detail 비율
- Tab vs Accordion 비중
- 신규/편집 Editor 크기
- Mobile Tab 구조
- Status / Badge density
- Action 위치
- 정보밀도
- i18n label 확장성

이미지 승인 전 실제 Prototype UI를 이 최종안으로 재구현하지 않는다.
