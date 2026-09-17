# DIO CRM — Design System v2

- 문서유형: Product Design System / UI Implementation Baseline
- 버전: **v2.0**
- 상태: **WORKING BASELINE — 구현 기준**
- 작성일: 2026-09-17
- 적용범위: HQ / GLOBAL / 향후 Country Profile 공통
- 대상 화면: Lead, Account, Contact, Opportunity, Activity 및 이후 CRM Entity
- 목적: **사용 편의성 + DIO 브랜드 인지 + 빠른 영업 업무처리**를 동시에 만족하는 CRM 제품 디자인 기준을 정의한다.

> 이 문서는 기존 `00_UI_Design_Confirmed_Baseline.md`의 **A+B 업무구조를 유지한 상태에서 Visual / Interaction Quality를 v2 수준으로 강화**하는 문서다.  
> 즉, 조회는 A(Split Workspace), 등록/편집은 B(Quick Create → Detail Enrichment)를 유지하고, 화면의 시각적 위계·브랜드·업무 집중도를 개선한다.

---

## 1. v2 Design Goal

DIO CRM v2는 단순히 깔끔한 화면이 아니라 사용자가 화면을 본 뒤 **3초 안에 다음 3가지를 알 수 있어야 한다.**

1. **누구 / 어떤 거래처인가?**
2. **현재 상태가 무엇인가?**
3. **지금 다음으로 무엇을 해야 하는가?**

핵심 방향은 다음과 같다.

| 목표 | 정의 |
|---|---|
| **Customer First** | Entity명, 상태, 담당자, 최근활동, Next Action을 최우선 노출 |
| **Task First** | 데이터 조회보다 “다음 업무”가 빠르게 보이도록 설계 |
| **DIO Identity** | Navy + DIO Blue를 구조적으로 사용하여 브랜드 인지 강화 |
| **Scanability** | 리스트·상세 모두 한눈에 훑을 수 있도록 정보 위계 강화 |
| **Progressive Disclosure** | 처음부터 모든 필드와 필터를 노출하지 않음 |
| **Responsive Parity** | PC와 Mobile이 같은 업무개념을 유지하되 화면 구조는 각각 최적화 |
| **Operational Consistency** | Lead / Account / Contact / Opportunity / Activity가 같은 제품처럼 보이게 함 |

---

## 2. Product Personality

DIO CRM의 시각적 성격은 아래 4개 키워드로 정의한다.

```text
Professional
Clear
Active
Trustworthy
```

### 피해야 할 인상

```text
일반 관리자 페이지
ERP 입력 화면
모든 요소가 같은 흰색 카드
Border가 과도한 화면
작은 글씨와 작은 아이콘
모든 버튼의 중요도가 동일한 화면
```

### 지향하는 인상

```text
DIO 브랜드가 느껴지는 전문 CRM
영업 담당자가 빠르게 판단하는 업무 도구
중요 정보와 다음 행동이 눈에 들어오는 화면
Desktop과 Mobile 모두 실제 현장에서 쓰기 쉬운 제품
```

---

## 3. Core UX Principles

### 3.1 3-Second Rule

상세 진입 직후 다음 정보가 첫 화면에 보여야 한다.

```text
Entity Name
Business / Reference Code
Current Status
Owner
Last Activity
Next Action
Primary Action
```

### 3.2 One Primary Action

한 화면에서 가장 중요한 Action은 **1개만 Solid Blue**로 강조한다.

예:

- Lead: `활동등록` 또는 현재 단계의 `다음 단계 진행`
- Account: `활동등록`
- Opportunity: `Stage 진행` 또는 `활동등록`

전화, 메일, 편집 등은 Secondary / Tertiary Action으로 둔다.

### 3.3 Read First, Edit Second

상세 기본 화면은 **조회 화면**이다.

```text
조회 상태
  ↓ 사용자가 요청
편집 / 추가
  ↓
Drawer / Modal / Mobile Full Page Form
```

입력 Form을 상세 화면에 항상 노출하지 않는다.

### 3.4 Mobile Detail = Dedicated Page

Mobile에서 Entity 상세를 연 경우:

```text
Search / Filter / List 영역 숨김
→ Detail 전용 화면 표시
→ [← 목록]으로 복귀
```

상세를 보면서 목록 필터가 상단에 남아 있으면 안 된다.

---

# 4. Brand Color System

## 4.1 Primary Brand Colors

기존 DIO 계열 Navy / Blue를 기반으로 제품 UI에서 역할을 명확히 구분한다.

| Token | Value | Usage |
|---|---:|---|
| `--dio-navy-950` | `#0B1D33` | Sidebar, 최고 강조 텍스트 |
| `--dio-navy-900` | `#102844` | Title, Heading, Active text |
| `--dio-navy-800` | `#14365D` | Navigation / Secondary strong |
| `--dio-blue-600` | `#2769A7` | DIO Brand action / active |
| `--crm-action-blue` | `#0B6FD3` | Primary CTA / selected state |
| `--dio-blue-100` | `#EAF2FB` | Active background / tint |
| `--crm-blue-050` | `#F4F9FF` | Hero / selected surface |
| `--dio-cyan-500` | `#1D94A8` | GPS / activity support accent |

> `--crm-action-blue`는 UI의 Primary Action을 더 명확하게 보이게 하기 위한 **제품용 Accent Token**이다. 브랜드 원색을 대체하는 용도가 아니라 DIO Blue 계열 안에서 업무 행동을 강조하는 용도다.

## 4.2 Semantic Colors

| 상태 | Foreground | Background | 예 |
|---|---|---|---|
| Success | `#147A55` | `#E9F7F1` | ERP 연동성공, WON, Active |
| Warning | `#A65A08` | `#FFF5E7` | ERP 대기, HOLD |
| Danger | `#B42318` | `#FEF0EF` | 실패, 이탈위험, 오류 |
| Info | `#175CD3` | `#EEF4FF` | 신규, 안내, 진행상태 |
| Neutral | `#667085` | `#EEF2F6` | 일반, 미설정 |

### Color 사용 원칙

- 색은 **의미**가 있을 때만 사용한다.
- 한 Card 안에서 Accent Color는 최대 2개.
- Primary CTA 외에는 Solid Blue Button 남발 금지.
- 긴 본문이나 일반 값에 Blue 사용 금지.

---

# 5. Surface / Elevation System

v1의 문제였던 “모든 화면이 흰 카드 + Border” 형태를 줄인다.

| Layer | Background | Border | Shadow |
|---|---|---|---|
| App Background | `#F5F8FC` | 없음 | 없음 |
| Workspace | `#FFFFFF` | 선택적 | `shadow-sm` |
| Hero Surface | `#F4F9FF → #FFFFFF` | Blue tint | `shadow-sm` |
| Card | `#FFFFFF` | 필요한 경우만 | `shadow-sm` |
| Selected Row | `#EEF6FF` | Left accent 3~4px | 없음 |
| Raised Drawer | `#FFFFFF` | 없음 | `shadow-lg` |

### Border Rule

- Card 전체를 Border로 둘러싸는 방식보다 **Surface 대비 / 여백 / Grouping**을 우선한다.
- 동일 그룹 내부의 Row는 Divider 1px 사용.
- Border 강도는 `#DDE4EC` 이하로 유지.

---

# 6. Typography System

Font Family는 현재 시스템 안정성을 위해 아래를 유지한다.

```css
"Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", system-ui, sans-serif
```

## 6.1 Desktop

| Role | Size | Weight | Line Height |
|---|---:|---:|---:|
| Page Title | 26px | 700 | 1.25 |
| Entity Hero Title | 26~28px | 700 | 1.20 |
| Section Title | 16px | 700 | 1.35 |
| Tab | 14px | 700 | 1.3 |
| Body | 14px | 400~600 | 1.5 |
| Table Body | 13~14px | 400~600 | 1.4 |
| Label | 12px | 600 | 1.35 |
| Caption | 11px | 500 | 1.35 |
| Button | 13~14px | 700 | 1.2 |

## 6.2 Mobile

| Role | Size | Weight |
|---|---:|---:|
| Screen Title | 22px | 700 |
| Entity Title | 22~24px | 700 |
| Section Title | 16px | 700 |
| Tab | 13~14px | 700 |
| Body | 14~15px | 400~600 |
| Label | 12px | 600 |
| Bottom Nav Label | **13px** | **700** |

### Text Rule

- Entity명은 2줄까지 허용.
- UUID 전체 노출 금지.
- 긴 영문 Entity명은 2줄 + ellipsis 허용.
- 일반 정보에서 11px 미만 금지.

---

# 7. Spacing / Radius / Touch

## 7.1 Spacing Scale

```text
4 / 8 / 12 / 16 / 20 / 24 / 32
```

## 7.2 Radius

```text
Control      8~10px
Card         12px
Hero Card    14~16px
Drawer       18~22px
Pill         999px
```

## 7.3 Touch Target

Mobile에서 클릭 가능한 요소는 최소:

```text
44px × 44px
```

Primary Action은 48px 이상 권장.

---

# 8. Icon System

기본 스타일은 **Outline / Rounded / 1.8~2.0 stroke**로 통일한다.

## Desktop

```text
Inline icon      16~18px
Action icon      18~20px
Entity icon      24px
```

## Mobile

```text
Inline icon      18px
Action icon      20~22px
Hero icon        24~26px
Bottom Nav       27~28px
```

### Entity Icon Mapping

| Entity | Icon |
|---|---|
| Lead | Target |
| Account | Building |
| Contact | User |
| Opportunity | Briefcase |
| Activity | Activity / Pulse |
| GPS | Map Pin |

Emoji를 UI 아이콘으로 사용하지 않는다.

---

# 9. Desktop Layout System

## 9.1 Desktop Breakpoint

```text
Desktop  : > 1100px
Tablet   : 821~1100px
Mobile   : <= 820px
```

> 기존 CSS의 920px transitional breakpoint는 단계적으로 위 기준으로 정규화한다.

## 9.2 App Shell

```text
┌────────────┬──────────────────────────────────────────────┐
│ DIO CRM    │ Topbar                                       │
│ Sidebar    ├──────────────────────────────────────────────┤
│            │ Route / Workspace                            │
│            │                                              │
└────────────┴──────────────────────────────────────────────┘
```

Sidebar 권장 폭: `224~240px`

### Sidebar

- Navy Background
- Active 메뉴는 DIO Blue Tint + 좌측 Accent
- 아이콘 20px
- 메뉴 글자 14px
- Entity Group과 Report/Setting Group 구분

---

# 10. Desktop Split Workspace

A+B Baseline을 유지한다.

```text
┌────────────────────────────────────────────────────────────┐
│ Page Header + Search / Filter / New                        │
├───────────────────────┬────────────────────────────────────┤
│ List 38~42%           │ Detail 58~62%                      │
│                       │                                    │
│ business rows         │ Entity Hero                        │
│                       │ Tabs                               │
│                       │ Summary / Next Action / Timeline    │
└───────────────────────┴────────────────────────────────────┘
```

### Desktop List 영역

단순 DB Table가 아니라 **업무형 리스트**로 만든다.

Primary 정보 순서:

```text
Entity Name
Status
Country / Type
Owner
Last Activity
Next Action
```

선택 Row:

```text
Soft Blue Background
+ Left 4px DIO Blue Accent
```

---

# 11. Search / Filter v2

## 11.1 Desktop

Desktop에서는 Search와 주요 Filter를 한 줄 또는 최대 2줄로 유지한다.

```text
[ 🔍 통합검색________________ ] [단계] [국가] [담당자] [필터 ⚙]

활성 조건: [MX ×] [신규등록 ×] [박동원 ×]
```

- 자주 쓰는 3~4개 Filter만 바로 노출.
- 나머지는 `필터` Drawer / Popover.
- Active Filter는 Chip으로 표시.
- Reset은 조건이 있을 때만 강조.

## 11.2 Mobile

6개의 Select를 항상 노출하지 않는다.

```text
[ 🔍 검색______________________ ]
[ 필터 3 ] [MX ×] [신규등록 ×] [박동원 ×]
```

`필터` 선택 시 Bottom Sheet:

```text
단계
국가
지역
담당자
유입경로
최근활동

[초기화] [적용]
```

### Mobile Detail 진입 시

Search / Filter / List 영역은 **완전히 숨김**.

---

# 12. Entity Hero Header v2

v2 디자인의 핵심 Component다.

## 12.1 Desktop

```text
┌─────────────────────────────────────────────────────────┐
│ [ICON]  E10021                                          │
│         MARCO ANTONIO OLVERA ESPINOSA                   │
│         [ACTIVE] [GENERAL] [ERP 연동]   MX              │
│                                                         │
│ 담당자 박동원   최근활동 09.13   다음업무 09.18 방문    │
│                                                         │
│                         [활동등록] [전화] [메일] [···]  │
└─────────────────────────────────────────────────────────┘
```

### Rule

- Hero는 옅은 Blue Tint 사용 가능.
- Entity Icon은 48~56px visual container.
- Entity명 가장 강하게.
- 상태 Badge는 이름 가까이 배치.
- Owner / Last Activity / Next Action은 Secondary KPI.

## 12.2 Mobile

```text
[← 목록]

[ICON]  E10021
        MARCO ANTONIO
        OLVERA ESPINOSA
        [ACTIVE] [ERP 연동]

담당자       최근활동
박동원       09.13

[ 활동등록 ] [ 전화 ] [ 더보기 ]
```

### Mobile CTA

`활동등록` = Primary Solid Blue

`전화`, `더보기` = Secondary Soft / Outline

---

# 13. Quick Action System

## Priority

### Primary

```text
Solid DIO / Action Blue
Icon + Text
```

### Secondary

```text
Soft Blue Background 또는 White Outline
```

### Tertiary

```text
More Menu
```

### Mobile Rule

상단에는 최대 **3개 Action**.

예:

```text
활동등록 | 전화 | 더보기
```

메일, 편집, ERP 요청 등은 More Menu로 이동 가능.

---

# 14. Tab System

## Desktop

탭은 업무 그룹 기준으로 5~7개 이내.

Account 권장:

```text
요약 | 영업 | 활동 | ERP | 연락처 | 파일 | 더보기
```

## Mobile

최상위 5개 제한:

```text
요약 | 영업 | 활동 | ERP | 더보기
```

하위 내용은 Secondary Chip / Section에서 처리한다.

### Active State

```text
Icon + Blue Text + 3px Accent
```

배경 Pill은 Mobile에서 선택적으로 사용.

---

# 15. Summary Card System

상세의 첫 화면은 모든 필드를 나열하는 화면이 아니다.

PC Account 권장:

```text
┌───────────────┬───────────────┬─────────────────────┐
│ 기본 정보      │ 영업 현황      │ Next Action          │
│ 국가 / 유형    │ 기회 3건       │ 09.18 재방문         │
│ 거래처등급     │ 예상매출       │ 담당 박동원           │
│ 개설일         │ 최근 견적      │ 상태 예정             │
└───────────────┴───────────────┴─────────────────────┘
```

### Card 역할

- Basic Information
- Sales Status
- Next Action
- Relationship Summary
- Integration Summary

카드 개수보다 **업무 의미**를 우선한다.

---

# 16. Next Action Component

CRM의 핵심 v2 Component.

표시 필드:

```text
예정일
업무 유형
업무 내용
담당자
상태
```

Overdue는 Red / Warning으로 명확히 표시.

Next Action이 없을 때:

```text
다음 업무가 없습니다.
[다음 업무 등록]
```

단순 `-` 표시 금지.

---

# 17. Activity Timeline

Activity는 단순 표보다 Timeline을 우선한다.

```text
● 09.16  전화   견적 검토 요청          박동원
│
● 09.13  방문   Implant demo           이수진
│
● 09.09  메일   Proposal 발송          박동원
```

- Type별 Icon
- 날짜 / 유형 / 제목 / 담당자 우선
- Note는 Secondary
- 최신순

---

# 18. Status / Stage Visualization

Stage는 텍스트만 표시하지 않는다.

Lead:

```text
신규등록 → 초도방문 → Keyman 미팅 → 전환
```

Opportunity:

```text
Identified → Qualified → Analysis → Proposal → Review → Negotiation → Won
```

Current = Blue
Done = Green / Blue Tint
Future = Gray
Lost / Excluded = Neutral / Danger semantic

Mobile에서는 전체 Stage가 너무 길 경우 현재 ± 인접 단계 우선 또는 Horizontal Scroll 허용.

---

# 19. Mobile Bottom Navigation v2

Bottom Navigation은 보조 UI가 아니라 **주요 Navigation**이다.

```text
Lead | Account | 활동/GPS | 더보기
```

또는 Profile에 따라 최대 5개.

### Visual Rule

```text
Icon          27~28px
Label         13px / 700
Height        72~76px + safe area
Active Icon   Action Blue
Active Label  Navy / Action Blue
Active BG     Soft Blue Tint
Inactive      #667085 수준
```

`100dvh + env(safe-area-inset-bottom)`을 사용한다.

---

# 20. Form / Quick Create v2

Quick Create는 **최소 입력 → 저장 → 상세 보강** 원칙 유지.

## PC

```text
Right Drawer 480~560px
```

## Mobile

```text
Full Page / Full Height Sheet
```

### Form Rule

- Label은 Input 위.
- Required는 `*`.
- 한 화면에 너무 많은 Fieldset 금지.
- 주소 / ERP / 관리정보는 저장 후 상세에서 보강.
- Form Submit은 하단 Sticky CTA 가능.

---

# 21. Lead v2 Reference Layout

## PC Lead

```text
Sidebar
┌────────────────────────────────────────────────────────────┐
│ Lead   [Search________] [Filter]             [+ 신규등록] │
├──────────────────────┬─────────────────────────────────────┤
│ Lead List            │ Lead Hero                           │
│                      │ Current Stage                       │
│ Status / Owner       │ Next Action                         │
│ Last / Next          │                                     │
│                      │ Tabs                                │
│                      │ Overview / Activity / Keyman         │
└──────────────────────┴─────────────────────────────────────┘
```

## Mobile Lead

```text
Lead

Search
Filter Chips

Lead Card List

--- 상세 진입 ---

← 목록
Lead Hero
Primary Action
Stage
Tabs
Summary / Activity
Bottom Navigation
```

---

# 22. Account v2 Reference Layout

## PC Account

```text
Sidebar
┌────────────────────────────────────────────────────────────┐
│ Account [Search________] [Filter]            [+ 신규등록] │
├──────────────────────┬─────────────────────────────────────┤
│ Account List         │ Account Hero                        │
│ Status / Country     │ Owner / Last / Next                 │
│ Owner / Last         │ [활동등록] [전화] [메일] [...]      │
│                      │                                     │
│                      │ 요약 | 영업 | 활동 | ERP ...        │
│                      │ Basic / Sales / Next Action         │
│                      │ Timeline                            │
└──────────────────────┴─────────────────────────────────────┘
```

## Mobile Account

```text
Account

Search
Filter Chips

Account Card List

--- 상세 진입 ---

← 목록
Account Hero
활동등록 / 전화 / 더보기
Owner / Last Activity
요약 / 영업 / 활동 / ERP / 더보기
Compact Summary
Bottom Navigation
```

---

# 23. Entity Expansion Rules

Lead / Account에서 확정된 v2 Component를 그대로 확장한다.

| Entity | Hero | Primary Action | Main Tabs |
|---|---|---|---|
| Lead | Target | 활동등록 / 단계진행 | 개요 / 활동 / Keyman / 변환 |
| Account | Building | 활동등록 | 요약 / 영업 / 활동 / ERP / 더보기 |
| Contact | User | 활동등록 | 개요 / 활동 |
| Opportunity | Briefcase | Stage 진행 | 개요 / Stage / 활동 |
| Activity | Pulse | 편집 또는 후속활동 | 기본정보 / Timeline |

화면별로 새로운 디자인 언어를 만들지 않는다.

---

# 24. Empty / Loading / Error State

## Empty

```text
Icon
명확한 설명
필요 시 CTA
```

예:

```text
등록된 활동이 없습니다.
[활동 등록]
```

## Loading

Skeleton 우선.

## Error

```text
무슨 문제가 발생했는지
사용자가 무엇을 할 수 있는지
[다시 시도]
```

단순 Error Code만 표시하지 않는다.

---

# 25. Accessibility

필수 기준:

- 일반 텍스트 대비 최소 WCAG AA 수준 지향.
- 키보드 Focus Visible.
- Icon-only Button은 `aria-label` 필수.
- Touch target 최소 44px.
- 색만으로 상태를 구분하지 않음: Icon / Text / Badge 병행.
- Reduced Motion 대응.

---

# 26. Internationalization / Global UI

- UI 문자열 Hardcode 금지.
- `ko-KR`, `en-US` 동일 Layout을 기본으로 함.
- 긴 영문 Label을 고려해 Button / Tab 고정폭 남발 금지.
- 날짜 / 숫자 / 통화는 Locale Formatter 사용.
- 국가코드는 `KR`, `MX`, `US` 등 ISO Code 기준.
- Flag Emoji는 Android Font fallback 문제 때문에 핵심 정보로 사용하지 않는다.

---

# 27. Implementation Tokens v2

향후 `tokens.css`에 아래 Role Token을 추가한다.

```css
:root {
  --crm-action-blue:#0B6FD3;
  --crm-blue-050:#F4F9FF;

  --crm-page-bg:#F5F8FC;
  --crm-card-bg:#FFFFFF;
  --crm-selected-bg:#EEF6FF;

  --crm-text-strong:#102844;
  --crm-text:#172033;
  --crm-text-muted:#667085;

  --crm-space-1:4px;
  --crm-space-2:8px;
  --crm-space-3:12px;
  --crm-space-4:16px;
  --crm-space-5:20px;
  --crm-space-6:24px;
  --crm-space-8:32px;

  --crm-control-radius:9px;
  --crm-card-radius:12px;
  --crm-hero-radius:16px;

  --crm-mobile-nav-icon:28px;
  --crm-mobile-nav-label:13px;
}
```

---

# 28. Existing Component Mapping

현재 구현 Component를 최대한 재사용하고 v2 스타일을 적용한다.

| Current Component | v2 역할 |
|---|---|
| `AbWorkspace` | Split Workspace |
| `AbDataList` | Business List |
| `AbDetailHeader` | **Entity Hero v2** |
| `AbQuickActions` | Primary / Secondary Action Group |
| `AbDetailTabs` | Detail Navigation |
| `AbInfoGrid` | Compact Summary |
| `AbStepProgress` | Stage / Process |
| `AbActivityTimeline` | Activity Timeline |
| `AbEmptyState` | Empty / Error / Loading State |
| `AbQuickCreate` | Quick Create Drawer / Mobile Full Page |
| `AppShell` | DIO CRM Shell / Bottom Navigation |

> 신규 Component를 무분별하게 만들지 않고 기존 공통 Component를 v2로 강화한다.

---

# 29. CSS Architecture Rule

현재 Visual QA Layer가 다수 누적되어 있으므로 v2 적용 시 점진적으로 정리한다.

현재:

```text
visual-qa.css
visual-qa-step34.css
visual-qa-step56.css
visual-qa-microfix.css
visual-qa-step78.css
visual-qa-entity-final.css
visual-qa-mobile-final.css
```

v2 목표:

```text
tokens.css
crm-shell.css
crm-workspace.css
crm-components.css
crm-responsive.css
```

단, 한 번에 기존 CSS를 삭제하지 않는다.

1. v2 Layer 적용
2. 화면 회귀 QA
3. 동일 Rule 통합
4. 기존 Layer 제거

순서로 진행한다.

---

# 30. Rollout Plan

## V2-01 Foundation

- Role Token 추가
- Typography / Icon / Spacing 정리
- App Background / Surface 체계 적용

## V2-02 App Shell

- Desktop Sidebar 강화
- Mobile Bottom Navigation 강화
- Active State / Branding 통일

## V2-03 Search / Filter

- PC Search + Primary Filters + Filter More
- Mobile Search + Filter Button + Active Chips
- Mobile Filter Bottom Sheet

## V2-04 Entity Hero

- Lead Hero
- Account Hero
- Primary CTA 강조
- Next Action 우선 노출

## V2-05 Lead / Account Reference Completion

- PC / Tablet / Mobile 완성
- 실제 시나리오 QA

## V2-06 Entity Expansion

- Contact
- Opportunity
- Activity

## V2-07 CSS Consolidation

- Visual QA Layer 정리
- v2 공통 CSS 구조로 통합

---

# 31. Acceptance Criteria

v2 완료는 단순히 디자인이 변경된 것으로 판단하지 않는다.

### UX

- 상세 진입 후 3초 안에 Entity / Status / Next Action 인지 가능.
- Mobile 상세에서 목록 Search / Filter가 보이지 않음.
- Mobile 주요 Action은 최대 3개.
- 자주 쓰지 않는 Filter는 기본 화면을 점유하지 않음.
- 등록 / 편집 Form이 조회 화면을 침범하지 않음.

### Visual

- Lead / Account / Contact / Opportunity / Activity가 같은 제품처럼 보임.
- DIO Navy / Blue가 Navigation, Hero, Active, Primary Action에 일관되게 사용됨.
- 모든 Card가 Border로 둘러싸인 인상을 줄임.
- Primary Action이 한눈에 식별됨.
- Mobile Bottom Navigation Icon / Label이 실제 기기에서 즉시 식별됨.

### Technical

- i18n Hardcode Check 통과.
- Multi-market Regression 통과.
- Desktop / Tablet / Mobile Layout 회귀 없음.
- Android Chrome / Samsung Internet Safe Area 확인.
- 기존 A+B 업무 흐름 및 Mock-first 동작 유지.

---

# 32. Final Design Statement

DIO CRM v2의 최종 목표는 다음 한 문장으로 정의한다.

> **“고객과의 모든 순간을 빠르게 이해하고, 다음 영업 행동으로 자연스럽게 연결하는 DIO의 업무형 CRM.”**

디자인은 장식이 아니라 다음 3가지를 지원해야 한다.

```text
고객 중심
빠른 업무 처리
데이터 기반 영업
```

그리고 사용자가 화면을 보았을 때 **DIO의 제품이라는 인지, 신뢰감, 업무 집중성**을 동시에 느낄 수 있어야 한다.
