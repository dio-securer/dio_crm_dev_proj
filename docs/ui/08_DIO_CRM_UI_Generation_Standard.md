# DIO CRM — UI Generation Standard

- 문서유형: Mandatory UI Generation / Implementation Standard
- 버전: **v1.0**
- 상태: **CONFIRMED BASELINE — 신규 UI 생성 필수 기준**
- 확정일: 2026-09-17
- 적용범위: HQ / GLOBAL / Country Profile 공통
- 대상: Lead, Account, Contact, Opportunity, Activity 및 이후 생성되는 모든 CRM 업무 화면
- 상위 기준: `00_UI_Design_Confirmed_Baseline.md`, `07_DIO_CRM_Design_System_v2.md`

> 이 문서는 DIO CRM에서 **새 UI를 생성하거나 기존 UI를 재구성할 때 반드시 적용해야 하는 실행 기준**이다.
> 디자인 시안, React 구현, CSS 수정, 모바일 대응을 시작하기 전에 본 문서를 먼저 확인한다.

---

# 1. 적용 우선순위

UI 생성 시 아래 순서를 기준으로 판단한다.

1. **업무 흐름**: A+B Baseline 유지
2. **사용성**: 한 화면에서 빠르게 식별/행동 가능해야 함
3. **DIO Brand**: Navy / Blue Signal Hierarchy 유지
4. **정보 밀도**: 모바일 화면에서 불필요한 세로 공간 최소화
5. **Responsive**: PC와 Mobile은 같은 업무개념을 유지하되 레이아웃은 각각 최적화
6. **일관성**: 화면별로 별도의 디자인 언어를 만들지 않음

새로운 화면을 만들 때 기존 DIO CRM 공통 Component와 본 문서의 패턴을 우선 사용한다.

---

# 2. 핵심 UX 원칙

## 2.1 3-Second Rule

상세 진입 후 3초 안에 아래를 식별할 수 있어야 한다.

```text
누구 / 어떤 Entity인가
현재 상태는 무엇인가
담당자는 누구인가
최근 활동은 언제인가
다음 행동은 무엇인가
```

## 2.2 Read First, Edit Second

상세 기본 화면은 조회 중심이다.

```text
조회 → 사용자가 편집 요청 → Drawer / Modal / Mobile Full Page Form
```

조회 화면에 대형 입력 Form을 항상 노출하지 않는다.

## 2.3 One Primary Action

한 화면의 Solid Blue Primary Action은 원칙적으로 1개만 둔다.

예:

```text
Lead         활동등록 / 단계진행
Account      활동등록
Contact      활동등록
Opportunity  Stage 진행 / 활동등록
Activity     편집 / 후속활동
```

그 외 전화, 메일, 편집, 더보기는 Secondary / Tertiary로 처리한다.

---

# 3. Responsive 기준

```text
Desktop : > 1100px
Tablet  : 821 ~ 1100px
Mobile  : <= 820px
```

현재 프로젝트의 Transitional Mobile 조건도 호환한다.

```css
(max-width:820px),
((hover:none) and (pointer:coarse) and (max-width:1400px))
```

모바일 판정 로직을 화면별로 제각각 만들지 않는다.

---

# 4. Desktop 기본 구조

PC는 기존 A+B Split Workspace를 유지한다.

```text
┌────────────────────────────────────────────────────────────┐
│ Page Header + Search / Filter / New                        │
├───────────────────────┬────────────────────────────────────┤
│ List 38~42%           │ Detail 58~62%                      │
│                       │                                    │
│ Business List         │ Entity Hero                        │
│                       │ Tabs                               │
│                       │ Summary / Next Action / Timeline    │
└───────────────────────┴────────────────────────────────────┘
```

Desktop List는 단순 DB Table이 아니라 업무형 List로 구성한다.

우선순위:

```text
Entity Name
Status
Owner
Last Activity
Next Action
Business-specific key value
```

---

# 5. Mobile Detail 원칙

Mobile에서 목록의 Entity를 선택하면 **Detail Dedicated Page**로 전환한다.

```text
Search / Filter / List 숨김
↓
Detail 전용 화면
↓
[← 목록]으로 복귀
```

상세 화면 위에 검색/필터/목록이 계속 남아 있으면 안 된다.

---

# 6. Mobile Business List — 기본 3단 Compact Card

새 CRM 목록의 모바일 기본 패턴은 **3단 Compact Card**다.

```text
Entity Name                               [Status Badge]
핵심정보 A                         핵심정보 B
보조/최근/예정 정보
```

예:

```text
에스치과의원                             [ERP 대기]
☎ 054-743-7582                       👤 박동원
◷ 최근활동 09.16
```

### 필수 원칙

- 한 카드가 화면 높이를 과도하게 차지하지 않는다.
- Entity Name은 17~18px Bold, 최대 2줄.
- 2행은 업무 핵심정보 2개를 우선 배치.
- 3행은 최근활동 / 예정일 / 보조업무 정보 1줄.
- 목록에서 저우선순위 데이터를 전부 보여주지 않는다.
- 상세에서 확인 가능한 값은 모바일 목록에서 과감히 생략한다.
- Label을 세로 Form처럼 나열하지 않는다.

### 금지 패턴

```text
국가:
KR

유형:
의원

담당자:
박동원
```

위와 같은 Form 형태의 목록 카드는 사용하지 않는다.

---

# 7. Mobile Card Width Rule — 본문 폭 최대 활용

Status Badge 때문에 카드 본문 전체에 큰 `padding-right`를 주지 않는다.

## 올바른 방식

```text
1행 Entity Name만 Badge 영역을 피함
2행/3행은 카드 오른쪽 끝까지 전체 폭 사용
```

예:

```text
거래처명                       [ERP 상태]
☎ 054-743-7582          👤 박동원       ← 전체 폭 사용
◷ 최근활동 09.16                         ← 전체 폭 사용
```

### 구현 원칙

- `Primary Cell` 전체에 90~110px의 우측 Padding을 예약하지 않는다.
- 이름/타이틀에만 Badge와 겹치지 않을 최소 여백을 준다.
- 2·3행 `width:100%` 사용.
- 전화번호처럼 긴 값이 있는 Column에 더 큰 비율을 준다.

권장 2열 비율:

```css
grid-template-columns:minmax(0,1.6fr) minmax(0,.9fr);
```

콘텐츠 성격에 따라 `1.35fr / .9fr` 범위에서 조정 가능하다.

---

# 8. Entity별 Mobile List 정보 기준

## 8.1 Account

```text
거래처명                                 [ERP 상태]
연락처                             담당자
최근활동
```

목록에서 기본적으로 제외:

```text
거래처 코드
사업자번호
국가
유형
등급
세부 CRM 상태
```

필요 시 상세에서 확인한다.

## 8.2 Lead

```text
Lead / 병원명                            [Stage]
연락처                             담당자
최근활동
```

## 8.3 Contact

```text
Contact Name                           [등록경로]
Account                             직함/역할
연락처
```

## 8.4 Opportunity

```text
Opportunity Name                        [Stage]
Account                              예상금액
담당자                              예상마감
```

## 8.5 Activity

```text
Activity Subject                        [대상구분]
대상                                활동유형
담당자                              활동일시
```

Entity별 핵심 정보는 다르지만 **Card Visual Grammar는 동일하게 유지**한다.

---

# 9. Typography — 최종 공통 기준

## 9.1 Mobile

| Role | Size | Weight / Rule |
|---|---:|---|
| Screen Title | **28px** | 900 |
| Entity Hero Title | **24~25px** | 850~900, 최대 2줄 |
| List Entity Name | **17~18px** | 850~900 |
| Section Title | **18px** | 900 |
| Field Title | **14~14.5px** | 800~850, Blue-Navy |
| Field Value | **17px** | 850~900, Deep Navy |
| Tab | **15px** | 800 |
| Mobile List Meta Value | **13~13.5px** | 800~850 |
| Mobile List Meta Label | **10.5~12px** | 700~750 |
| Bottom Nav Label | **13px** | 700~800 |

### 색상 위계

```text
Screen / Entity / Value : Deep Navy
Field Title             : Blue-Navy
Secondary Text          : Medium Gray-Blue
Primary Action          : DIO Action Blue
Semantic Status         : Success / Warning / Danger / Info
```

Field Title을 지나치게 연한 Gray로 만들지 않는다.

---

# 10. Hero — DIO Signal Hierarchy

Hero는 DIO CRM의 핵심 식별 영역이다.

### 기본 원칙

- Background는 Soft Blue Tint → White.
- Entity Icon은 Navy / Blue 계열로 명확하게 식별.
- Entity Title은 Deep Navy.
- 상태 Badge는 Title 가까이 배치.
- Field/Meta Label은 Gray가 아니라 Blue-Navy 계열.
- Primary Action 1개만 Solid Blue.
- Hero가 Entity Name 하나 때문에 지나치게 커지지 않게 한다.

Mobile Entity Title은 기본적으로 24~25px를 사용한다.

---

# 11. Field Title / Value 기준

기본 정보 영역은 다음 위계를 사용한다.

```text
국가           ← 14~14.5px / Blue-Navy / Bold
KR             ← 17px / Deep Navy / Extra Bold
```

### 금지

- Label을 11~12px 연한 Gray로 만들어 식별이 어려운 형태.
- Label과 Value가 시각적으로 동일한 강도.
- 모든 값을 Blue로 표시.

---

# 12. Section Header Accent

Section 시작점은 명확해야 한다.

```text
▌기본 정보
▌영업 현황
▌최근 활동
▌ERP 연동
```

권장:

```text
Left Accent    3~4px DIO Blue
Title          18px Deep Navy / 900
Background     Soft Blue → White 선택적
```

Section마다 과도한 Card Border를 추가하지 않는다.

---

# 13. Bottom Navigation — 최종 기준

Mobile Bottom Navigation은 본문을 과도하게 점유하지 않는다.

```text
Height       72px + Safe Area
Icon         27px
Label        13px
Item Height  약 54px
Active BG    Compact Soft Blue Tint
```

### 필수

- `env(safe-area-inset-bottom)` 유지.
- 본문 `padding-bottom` / `scroll-padding-bottom`도 같은 높이 기준으로 적용.
- Active State는 Blue Icon + Label + Soft Tint.
- Active Background가 큰 카드처럼 보이지 않게 한다.

---

# 14. Search / Filter 기준

## Desktop

```text
[통합검색] [주요필터 3~4개] [필터 더보기]
```

## Mobile

상세 Select 여러 개를 화면에 항상 펼치지 않는다.

```text
[검색________________________]
[필터 3] [MX ×] [신규 ×]
```

상세 조건은 Bottom Sheet / Drawer에서 처리한다.

---

# 15. Summary / Detail 정보 밀도

- 업무상 가장 중요한 정보만 첫 화면에 노출.
- 한 필드가 한 행을 독점하는 Form 형태를 최소화.
- 서로 관련된 짧은 정보는 2열 사용.
- 긴 이름 / 주소 / Note 등은 Full Width 허용.
- 모바일에서 데이터가 잘리는 것보다 필요한 경우 높이를 소폭 늘리는 것을 우선한다.
- 단, 저우선순위 값을 모두 노출하여 카드/화면을 길게 만들지 않는다.

---

# 16. Common Component 우선 사용

신규 UI는 아래 공통 Component를 우선 사용한다.

| Component | 역할 |
|---|---|
| `AbWorkspace` | PC Split Workspace / Mobile Detail 전환 |
| `AbDataList` | Business List |
| `AbDetailHeader` | Entity Hero |
| `AbQuickActions` | Primary / Secondary Action |
| `AbDetailTabs` | Detail Tab Navigation |
| `AbInfoGrid` | Summary / Compact Info |
| `AbStepProgress` | Lead / Opportunity Stage |
| `AbActivityTimeline` | 활동 Timeline |
| `AbEmptyState` | Empty / Loading / Error |
| `AbQuickCreate` | Quick Create |
| `AppShell` | Sidebar / Bottom Navigation |

화면별로 동일 기능의 새로운 Component를 중복 생성하지 않는다.

`AbDataList`의 `data-column-key` / `mobileRole`을 활용하여 Entity별 Mobile 정보를 선택한다.

---

# 17. PC / Mobile 간 정보 우선순위

PC에서는 더 많은 정보를 한 번에 보여줄 수 있다.

Mobile에서는 같은 정보를 그대로 축소하지 않는다.

```text
PC      = 비교 / 탐색 / 다중정보
Mobile  = 식별 / 최근상태 / 즉시행동
```

따라서 Mobile에서는 상세에 있는 정보 일부를 목록에서 숨기는 것이 정상이다.

---

# 18. UI 생성 시 필수 체크리스트

새 화면 또는 신규 메뉴 생성 전에 아래를 확인한다.

## Structure

- [ ] A+B 구조를 유지했는가?
- [ ] PC에서 Split Workspace가 필요한 업무인가?
- [ ] Mobile Detail이 Dedicated Page로 동작하는가?

## Mobile List

- [ ] 3단 Compact Card 원칙을 적용했는가?
- [ ] Entity Name + Status가 첫 줄에 있는가?
- [ ] 2행에 핵심정보 최대 2개만 배치했는가?
- [ ] 3행에 최근활동/예정/보조 정보가 있는가?
- [ ] Badge 때문에 2·3행 폭이 줄어들지 않는가?
- [ ] 긴 Entity Name은 최대 2줄인가?
- [ ] 한 화면에서 복수의 Entity를 빠르게 탐색할 수 있는가?

## Typography

- [ ] Field Title이 너무 작거나 연한 Gray가 아닌가?
- [ ] Entity Title이 다른 정보를 압도하지 않는가?
- [ ] Value가 업무 판단에 충분한 크기인가?
- [ ] 11px 미만 일반 텍스트를 사용하지 않았는가?

## Actions

- [ ] Primary Solid Blue Action이 1개인가?
- [ ] Mobile 상단 Action이 최대 3개인가?
- [ ] 저우선순위 Action은 More로 이동했는가?

## Navigation

- [ ] Bottom Nav 높이가 72px + Safe Area 기준인가?
- [ ] Icon 27px, Label 13px 기준인가?
- [ ] 본문이 Bottom Nav에 가려지지 않는가?

## Brand

- [ ] DIO Navy / Blue가 Hero, Active, Primary Action에 일관되게 사용되는가?
- [ ] Field Title은 Blue-Navy Signal Hierarchy를 따르는가?
- [ ] 화면이 일반 관리자 페이지처럼 보이지 않는가?

## Technical

- [ ] i18n Hardcode가 없는가?
- [ ] 긴 영문 / 다국가 Locale에서 깨지지 않는가?
- [ ] Touch Target 44px 이상인가?
- [ ] Android Chrome / Samsung Internet Safe Area가 정상인가?
- [ ] 기존 Multi-market Regression을 깨지 않는가?

---

# 19. 구현 후 QA 순서

신규 UI 구현 후 다음 순서로 확인한다.

```text
1. Desktop 1440px
2. Tablet 821~1100px
3. Mobile 390~430px
4. 좁은 Mobile 360px
5. 실제 Android Chrome / Samsung Internet
6. ko-KR / en-US
7. 긴 이름 / 긴 전화 / 긴 금액 / No Data
8. Selected / Empty / Loading / Error
```

CSS가 의도대로 보이지 않을 경우 단순히 새로운 `!important`를 계속 추가하기 전에:

```text
DOM 구조
CSS Load Order
Media Query 기준
고정 Height / Overflow
Service Worker / Cache
```

순서로 원인을 확인한다.

---

# 20. 신규 UI 생성 지시문 기본형

향후 신규 CRM 화면을 생성할 때 아래 기준을 기본 지시로 간주한다.

```text
DIO CRM Design System v2 및 08_DIO_CRM_UI_Generation_Standard.md를 준수한다.

- PC는 A+B Split Workspace를 기본으로 검토한다.
- Mobile Detail은 Dedicated Page로 구성한다.
- Mobile List는 3단 Compact Card를 기본으로 한다.
- Entity Name + Status / 핵심정보 2개 / 최근·예정정보 구조를 적용한다.
- Badge는 제목만 피하고 2·3행은 카드 전체 폭을 사용한다.
- DIO Navy Signal Hierarchy를 사용한다.
- Entity Hero Title은 Mobile 24~25px를 기본으로 한다.
- Field Title 14~14.5px Blue-Navy, Value 17px Deep Navy를 사용한다.
- Section Title은 18px + DIO Blue Accent를 사용한다.
- Bottom Nav는 72px + Safe Area, Icon 27px, Label 13px를 사용한다.
- Primary Solid Blue Action은 화면당 1개를 기본으로 한다.
- 기존 공통 Component를 우선 재사용한다.
- i18n / Multi-market / Safe Area 회귀를 반드시 확인한다.
```

---

# 21. 최종 원칙

DIO CRM의 UI는 단순히 많은 데이터를 보여주는 화면이 아니다.

```text
필요한 정보는 크게
덜 중요한 정보는 줄이고
본문 폭은 충분히 사용하며
다음 행동은 명확하게
```

새 화면을 추가할 때마다 새로운 디자인을 만드는 것이 아니라, **이 기준 안에서 업무 특성에 맞는 핵심 정보만 선택해 배치한다.**

> **본 문서는 이후 DIO CRM UI 생성 및 수정 작업의 기본 체크리스트이자 구현 기준으로 사용한다.**
