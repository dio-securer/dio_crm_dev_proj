# DIO CRM Visual QA 개선 작업지시서

- 문서명: `Visual_QA_개선_작업지시서.md`
- 상태: **VISUAL EXECUTION BASELINE**
- 기준일: 2026-09-16
- 대상 브랜치: `ai/m1-m2-lead-mock`
- 기준 커밋: `d1adf2b7` 이후
- 적용 범위: **Lead / Account / Contact / Opportunity / Activity**
- 적용 시장: **HQ / GLOBAL 공통**
- 상위 UI 원칙: **DIO CRM 운영 UI = A + B**
- 데이터 전략: 기존 Mock / Sandbox / API fallback 유지

---

# 1. 작업 목적

현재 CRM은 A+B 기준의 업무 구조와 Mock 업무 Flow는 구현되어 있으나, 실제 PC/모바일 화면 확인 결과 다음 문제가 확인되었다.

```text
기능은 존재하지만 글자가 작아 한눈에 읽기 어렵다.
정보 계층이 약해 화면이 평면적이고 비어 보인다.
Quick Action이 텍스트 위주라 시각적 구분이 약하다.
Tab / Step / Label / Meta 정보가 너무 작다.
빈 값이 '-'로 반복되어 화면이 미완성처럼 보인다.
모바일에서 Action과 Tab이 지나치게 조밀하다.
조회 화면에 입력 Form이 항상 노출되어 정보 조회를 방해한다.
```

이번 작업의 목적은 **A+B 구조를 변경하지 않고 Visual Design Layer만 한 단계 끌어올리는 것**이다.

최종 목표는 다음과 같다.

> 기능이 들어간 Wireframe 수준의 화면을 실제 영업/운영 사용자가 장시간 사용해도 읽기 쉽고, 중요 정보와 다음 행동을 즉시 파악할 수 있는 CRM 운영 UI로 개선한다.

---

# 2. 변경 금지 원칙

Visual QA 작업에서 아래 구조는 변경하지 않는다.

## 2.1 Concept A 유지

### PC

```text
List / Search / Filter
        +
Split Workspace
        +
Detail / Tabs / Sections
```

### Mobile

```text
Search / Filter
   ↓
List
   ↓
Detail Page
```

## 2.2 Concept B 유지

### PC

```text
Quick Create Drawer
   ↓
Save
   ↓
Detail Auto Select
```

### Mobile

```text
Fullscreen Quick Create
   ↓
Save
   ↓
Detail Page
```

## 2.3 이번 작업에서 하지 않을 것

- 화면 전체 구조를 C안 또는 D안으로 변경
- Dashboard형 Card Layout으로 운영 화면을 재설계
- DB Schema 변경
- Backend API 신규 개발
- ERP Interface 신규 개발
- 기존 Mock 관계 Flow 제거
- HQ / GLOBAL 화면을 서로 다른 Visual Pattern으로 분기

---

# 3. 실제 화면 기준 핵심 문제점

## 3.1 PC Lead 화면

현재 화면에서 확인된 문제:

1. Table Header / Row / Meta / Tab / Accordion Label이 지나치게 작음
2. Detail Header의 Entity 이름 외에는 시각적 중심이 없음
3. UUID가 업무정보보다 앞에 노출됨
4. Step Progress가 얇고 글자가 작아 상태 흐름이 눈에 띄지 않음
5. Quick Action이 작은 텍스트 Button 위주라 구분이 약함
6. `최근 활동 -`, `다음 액션 -`, `유입경로 -` 같은 빈 값 표현이 많음
7. 데이터가 적을 때 List 하단이 지나치게 비어 보임
8. Overview의 Card가 정보량 대비 커서 화면이 휑하게 느껴짐

## 3.2 Mobile Account 화면

현재 화면에서 확인된 문제:

1. Detail 정보는 많지만 전체적인 Font Size가 작음
2. 상단 Quick Action 5개가 한 줄에 배치되어 Touch Target과 Label이 작아짐
3. Tab 수가 많아 현재 위치 파악이 어려움
4. 연락처 Tab 진입 시 등록 Form이 바로 길게 노출됨
5. 조회 Detail과 입력 Form이 동시에 노출되어 정보 조회 집중도가 떨어짐
6. Bottom Navigation은 방향이 좋으나 전체 Font / Icon 규격 통일이 필요함

---

# 4. Visual Design 목표

전체 화면은 다음 네 가지를 만족해야 한다.

```text
1. 3초 안에 Entity / Status / Owner / Next Action을 파악한다.
2. 10px 이하 텍스트 사용을 원칙적으로 제거한다.
3. 중요 Action은 Icon + Label로 구분한다.
4. 빈 값은 '-'가 아니라 의미 있는 Empty State로 표현한다.
```

화면 톤은 화려한 Dashboard가 아니라 다음 방향으로 간다.

```text
DIO Navy
+ DIO Blue
+ Neutral Gray
+ 최소한의 Status Color
```

---

# 5. VQ-01 Typography Scale 전면 상향

## 5.1 PC Typography

| 구분 | 목표 Size | Weight | 비고 |
|---|---:|---:|---|
| Page Title | 24~26px | 700 | 화면 제목 |
| Entity Title | 22~24px | 700 | 병원/거래처/기회명 |
| Section Title | 15~16px | 700 | Accordion/Card Header |
| Tab Label | 14~15px | 600 | 선택 Tab 강조 |
| Table Header | 12~13px | 600 | 최소 12px |
| Table Body | 13~14px | 400~600 | Primary 600 허용 |
| Form Label | 12~13px | 600 | 필수 별표 포함 |
| Detail Meta Label | 11~12px | 500~600 | 보조정보 |
| Detail Meta Value | 13~14px | 600 | 중요 값 |
| Button Label | 13~14px | 600 | Action |
| Badge | 11~12px | 600~700 | Status |
| Supporting Text | 11~12px | 400 | Hint / Caption |

## 5.2 Mobile Typography

| 구분 | 목표 Size |
|---|---:|
| Mobile Page Title | 20~22px |
| Entity Title | 22~24px |
| Section Title | 15~16px |
| Body | 14~15px |
| Label | 12~13px |
| Button | 14px |
| Tab | 14px |
| Bottom Nav Label | 12px 이상 |

## 5.3 금지 기준

다음 사용을 원칙적으로 금지한다.

```text
font-size: 8px
font-size: 8.5px
font-size: 9px
font-size: 9.5px
```

예외:

- 극히 작은 Status Dot 내부 숫자
- 개발/시스템용 비업무 정보

예외 사용 시 10px 미만 사용 이유를 코드 주석으로 남긴다.

## 완료조건

- PC 100% Zoom에서 Header / List / Detail 정보가 확대 없이 식별 가능
- Mobile 실기기에서 Tab / Button / Label을 눈을 가까이 대지 않고 식별 가능
- 10px 미만 일반 업무 Label 제거

---

# 6. VQ-02 공통 Icon System 도입

## 6.1 원칙

Unicode Emoji를 업무 UI Icon으로 사용하지 않는다.

```text
❌ 📞 📧 🏥 📅 등을 OS Emoji로 직접 사용
✅ 동일 Stroke 기반 SVG Icon 사용
```

권장:

```text
lucide-react
```

또는 동일 스타일의 SVG Icon Set을 사용한다.

## 6.2 기본 Icon Mapping

| 기능 | Icon |
|---|---|
| 전화 | Phone |
| 이메일 | Mail |
| 미팅 | Calendar / CalendarDays |
| 활동등록 | Plus / CirclePlus |
| 더보기 | MoreHorizontal |
| 거래처/병원 | Building2 |
| 담당자 | User / UserRound |
| 위치 | MapPin |
| 최근 활동 | Clock3 |
| 다음 액션 | Target |
| Opportunity | BriefcaseBusiness |
| 금액 | CircleDollarSign |
| Activity | Activity |
| 검색 | Search |
| Filter | SlidersHorizontal / Filter |
| 펼치기 | ChevronDown |
| 편집 | Pencil |
| ERP | RefreshCw / Link2 |
| 완료 | CheckCircle2 |
| 경고 | CircleAlert |

## 6.3 Icon Size

```text
일반 Icon       16px
Quick Action    18px
Section Header  18px
주요 Action     18~20px
Bottom Nav      20~22px
```

Stroke:

```text
1.7 ~ 2.0
```

## 완료조건

- Lead / Account / Contact / Opportunity / Activity에서 동일 기능은 동일 Icon 사용
- Emoji와 SVG Icon 혼용 금지
- Icon만 보고도 전화/메일/활동/편집/더보기 기능 구분 가능

---

# 7. VQ-03 Detail Header 재디자인

현재 Header의 정보 나열형 구조를 Identity / Status / Meta / Action으로 명확히 분리한다.

## 7.1 표준 구조

```text
┌────────────────────────────────────────────────────────┐
│ [Entity Icon] Account / Lead Name       [Status Badge] │
│ Business No / Lead No · Country / Region               │
│                                                        │
│ Owner          Last Activity        Next Action        │
│ Source/Grade   Phone                ERP Status         │
│                                                        │
│ [전화] [메일] [미팅/활동] [편집] [더보기]             │
└────────────────────────────────────────────────────────┘
```

## 7.2 UUID 노출 정책

아래 GUID 형식 ID를 Detail Header Primary 영역에서 제거한다.

```text
aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1
4a8fb531-adaf-4191-ae32-...
```

대신 아래 업무번호를 우선 표시한다.

```text
Lead No
Account Code
Opportunity No
Contact Name
```

UUID는 다음 위치 중 하나로 이동한다.

```text
System / Manage Tab
More → Copy ID
Developer Information
```

## 7.3 Header Empty Value

```text
❌ 최근 활동 -
❌ 다음 액션 -
❌ 유입경로 -

✅ 최근 활동 없음
✅ 다음 일정 미등록
✅ 유입경로 미등록
```

## 완료조건

Detail 진입 즉시 다음 질문에 답할 수 있어야 한다.

```text
누구/어떤 거래처인가?
현재 상태는 무엇인가?
담당자는 누구인가?
최근 접촉은 언제였는가?
다음에 무엇을 해야 하는가?
```

---

# 8. VQ-04 Quick Action Visual 표준화

## 8.1 PC

기본 예:

```text
[Phone 전화]
[Mail 메일]
[Calendar 미팅]
[Plus 활동등록]
[MoreHorizontal 더보기]
```

규격:

```text
높이 38~42px
Icon 18px
Label 13~14px
Border Radius 8~10px
Primary Action 1개만 Blue Fill 허용
나머지는 Outline / Ghost
```

## 8.2 Mobile

한 줄에 5개 Action을 강제로 넣지 않는다.

기본 노출:

```text
[전화] [활동등록] [더보기]
```

또는 폭이 충분한 경우:

```text
[전화] [메일]
[활동등록] [편집]
[ERP 등록요청]
```

기본 정책:

```text
Primary 2~3개만 즉시 노출
Secondary Action은 More Menu / Bottom Sheet
```

Touch Target:

```text
최소 44 x 44px
```

## 완료조건

- Galaxy / iPhone 폭에서 Button Label이 잘리지 않음
- 44px 미만 Touch Target 없음
- Main Action과 Secondary Action이 시각적으로 구분됨

---

# 9. VQ-05 Step Progress 가독성 강화

대상:

```text
Lead
Opportunity
ERP Workflow
기타 Stage Process
```

## 9.1 규격

```text
Circle        28~32px
Label         13~14px
Connector     2px 이상
Active        DIO Blue
Completed     Blue/Navy + Check
Future        Neutral Gray
```

## 9.2 Lead 예

```text
● 신규등록 ━━━━━ ○ 초도방문 ━━━━━ ○ 키맨미팅 ━━━━━ ○ 변환
```

현재 Step은 색상과 크기 대비를 강화한다.

## 완료조건

- 현재 단계가 1초 내 식별됨
- Active / Completed / Future 구분이 색상 없이도 형태로 구분됨

---

# 10. VQ-06 Tab Visual 개선

## 10.1 PC

Tab Height:

```text
44~48px
```

Tab Label:

```text
14~15px / 600
```

예:

```text
[Overview]
[Activity  3]
[Keyman  2]
[System]
[Conversion]
```

Count는 작은 Badge로 표시한다.

## 10.2 Icon 사용

모든 Tab에 Icon을 강제하지 않는다.

다만 주요 Entity에서 구분이 도움이 되는 경우 다음을 허용한다.

```text
Overview  LayoutDashboard / FileText
Activity  Clock3
Contact   Users
ERP       Link2
Related   Network
```

## 완료조건

- 현재 Tab이 Underline + Background 또는 Font Weight로 명확히 구분됨
- Count가 Label을 방해하지 않음
- PC Tab Label이 14px 미만으로 내려가지 않음

---

# 11. VQ-07 Mobile Account Tab 재그룹

현재 Account Mobile Tab:

```text
요약 / 연락처 / 기회 / 활동 / 거래상태 / 관리정보 / 주소 / ERP / 관련데이터
```

은 한 화면에 너무 많은 업무영역을 노출한다.

Mobile 1차 Tab을 다음 수준으로 축약한다.

```text
요약
영업
활동
ERP
더보기
```

## 11.1 영업 Tab 하위

```text
연락처
Opportunity
거래상태
```

## 11.2 더보기

```text
관리정보
주소
관련데이터
System 정보
```

## 11.3 PC

PC에서는 기존 Detail Tab 구성을 유지할 수 있다.

즉 Desktop / Mobile Information Architecture는 같은 업무 데이터를 사용하되, Mobile에서 1차 Navigation만 그룹화한다.

## 완료조건

- Mobile 1차 Tab은 최대 5개
- Horizontal Scroll 의존도 최소화
- 기존 데이터/기능 접근 경로는 유지

---

# 12. VQ-08 List 가독성 / 정보 밀도 개선

PC Table이 지나치게 작은 ERP Grid처럼 보이지 않도록 Primary / Secondary 정보 계층을 강화한다.

## 12.1 Row 규격

```text
최소 높이 48~56px
Primary text 13~14px / 600
Secondary text 11~12px
Badge 11~12px
```

## 12.2 Lead 예

```text
Building2  에스치과의원
           Lead L-2026-00124

KR / Busan     신규등록
Owner 박동원   최근활동 09/14
```

## 12.3 Account 예

```text
Building2  에스치과의원
           A-000123

KR     일반     ERP 대기
Owner 박동원
```

## 12.4 빈 List 공간

데이터가 1~2건이라도 Pane 전체를 억지로 Card로 채우지 않는다.

아래 요소를 활용한다.

```text
검색/Filter 영역
Count
List Row
Pagination
Help / Empty Guide
```

필요 시 빈 하단은 Neutral Background로 처리한다.

## 완료조건

- 목록만 보고 Entity / 상태 / 담당자를 즉시 식별 가능
- 선택 Row Highlight가 확실함
- List Header / Body Font가 12px 미만이 아님

---

# 13. VQ-09 Empty State 개선

일반 업무화면에서 단순 `-` 반복 사용을 최소화한다.

## 13.1 예

### 최근 활동 없음

```text
Clock3
아직 등록된 활동이 없습니다.
[+ 활동 등록]
```

### Next Action 없음

```text
Target
다음 일정이 등록되지 않았습니다.
[+ 다음 액션 등록]
```

### Contact 없음

```text
Users
등록된 연락처가 없습니다.
[+ 연락처 추가]
```

### Opportunity 없음

```text
BriefcaseBusiness
진행 중인 영업기회가 없습니다.
[+ Opportunity 등록]
```

## 완료조건

- `-`만 표시되는 업무 Card 제거
- Empty State에는 가능하면 다음 행동 CTA 포함
- Icon / Title / Help / Action의 공통 Component화 가능

---

# 14. VQ-10 조회와 입력 Form 분리

현재 Mobile Account Contact Tab처럼 조회화면에 빈 등록 Form이 항상 노출되는 방식을 개선한다.

## 14.1 조회 기본 상태

```text
연락처                          + 추가
────────────────────────────────────
김OO / 원장
010-...

이OO / 실장
010-...
```

데이터 없음:

```text
등록된 연락처가 없습니다.
[+ 연락처 등록]
```

## 14.2 등록 동작

PC:

```text
Inline Expand 또는 Drawer
```

Mobile:

```text
Fullscreen Sheet 또는 Bottom Sheet
```

## 14.3 적용 대상

```text
Contact 추가
Activity 추가
Opportunity Quick Create
Related 추가
기타 Detail 내부 신규등록 Form
```

## 완료조건

- Detail 조회 시 빈 Form이 화면 대부분을 차지하지 않음
- 사용자가 `추가/편집` Action을 눌렀을 때만 Form 노출

---

# 15. VQ-11 Card / Border / Background Tone 통일

## 15.1 기본 Color Token 목표

```text
Page Background      #F5F7FA 계열
Card                 #FFFFFF
Border               #D8E0EA 계열
Primary Navy         #15345B 계열
DIO Blue             #2875C7 계열
Light Blue Surface   #EAF3FC 계열
Text Primary         #172B4D 계열
Text Secondary       #5C6B7A 계열
Success              Soft Green
Warning              Soft Amber
Danger               Soft Red
```

실제 값은 기존 DIO Token과 충돌하지 않도록 `tokens.css` 기준으로 통합한다.

## 15.2 Shadow

운영화면에서 Shadow를 과도하게 쓰지 않는다.

```text
Level 0 : Border only
Level 1 : 매우 약한 shadow
Drawer  : 명확한 elevation
```

## 완료조건

- Card마다 임의의 색상/Shadow 사용 금지
- Border와 Background 대비가 충분함
- 화면이 회색 일색으로 흐려 보이지 않음

---

# 16. VQ-12 Spacing / Density 표준화

## PC

```text
Page Header Bottom     16~20px
Card Padding            16~20px
Section Gap             12~16px
Field Gap               10~12px
Button Gap               6~8px
```

## Mobile

```text
Page Side Padding       16px
Card Padding            14~16px
Section Gap             12px
Bottom Nav Safe Area    필수
Sticky Footer Gap       Bottom Nav와 겹치지 않음
```

## 완료조건

- 지나치게 큰 빈 공간과 지나치게 좁은 정보영역이 동시에 존재하지 않음
- Card 내부 정보량에 비해 Padding이 과도하지 않음

---

# 17. 공통 Component 개선 대상

다음 Component를 우선 개선한다.

```text
AbDetailHeader
AbQuickActions
AbStepProgress
AbDetailTabs
AbDataList
AbEmptyState
AbInfoGrid
AbSectionAccordion
AbQuickCreate
AbMobileFab
AbPagination
```

추가 권장 Component:

```text
AbIcon
AbEmptyActionState
AbMobileActionMenu
AbMobileGroupedTabs
AbEntityIdentity
```

공통 Component 변경으로 Lead / Account / Contact / Opportunity / Activity에 동일한 Visual Rule이 자동 적용되게 한다.

화면별 CSS에 같은 Font / Button 스타일을 중복 작성하지 않는다.

---

# 18. CSS / Token 작업 원칙

우선 적용 파일:

```text
frontend/src/styles/tokens.css
frontend/src/styles/ab-workspace.css
frontend/src/styles/lead-workspace.css
frontend/src/styles/entity-workspaces.css
frontend/src/styles/account-*.css
```

## 원칙

1. Typography Token 먼저 정의
2. Component CSS에서 Token 참조
3. 화면별 Override 최소화
4. `font-size: 9px` 형태의 Hard-coded small font 제거
5. Mobile breakpoint 중복 최소화
6. HQ / GLOBAL CSS 분기 금지

권장 Token 예:

```css
--font-page-title: 26px;
--font-entity-title: 23px;
--font-section-title: 16px;
--font-tab: 14px;
--font-body: 14px;
--font-label: 12px;
--font-caption: 11px;
--control-height: 40px;
--touch-target: 44px;
```

실제 Token 이름은 현재 Naming Convention에 맞춰 결정한다.

---

# 19. 실행 순서

Visual QA는 아래 순서를 반드시 지킨다.

## Phase VQ-1 — Foundation

```text
STEP 1. Typography Token 상향
STEP 2. Icon System 도입
STEP 3. Button / Badge / Control Height 표준화
```

## Phase VQ-2 — Header / Navigation

```text
STEP 4. Detail Header 재디자인
STEP 5. Quick Action Icon 적용
STEP 6. Step Progress 확대
STEP 7. PC Tab Visual 개선
```

## Phase VQ-3 — Content

```text
STEP 8. List Row 정보 위계 개선
STEP 9. Empty State + CTA 적용
STEP 10. Card / Section Title / InfoGrid 개선
```

## Phase VQ-4 — Mobile

```text
STEP 11. Mobile Quick Action 3개 중심으로 정리
STEP 12. Account Mobile Tab 5개 그룹화
STEP 13. Inline Form 기본 숨김 / Action 기반 Open
STEP 14. Bottom Nav / Sticky Footer / Safe Area QA
```

## Phase VQ-5 — Entity QA

```text
STEP 15. Lead QA
STEP 16. Account QA
STEP 17. Contact QA
STEP 18. Opportunity QA
STEP 19. Activity QA
STEP 20. HQ / GLOBAL / Locale / Responsive 회귀검사
```

---

# 20. Entity별 Visual Acceptance Criteria

## Lead

- Lead Name / 병원명 / Stage / Owner / Next Action이 첫 화면에서 식별됨
- GUID가 Primary Header에서 제거됨
- Step Progress가 눈에 띔
- Activity / Keyman Count 식별 가능
- Empty Next Action에 CTA가 존재함

## Account

- Account Name / Code / Grade / 거래상태 / ERP 상태가 즉시 식별됨
- 모바일 Quick Action이 지나치게 작지 않음
- Mobile 1차 Tab 최대 5개
- Contact가 없을 때 빈 Form이 자동 노출되지 않음
- ERP Action이 Main 업무와 구분됨

## Contact

- 이름 / Account / 직함 / 전화가 List에서 식별됨
- 전화 / 메일 Action에 Icon 적용
- Activity 연결이 명확함

## Opportunity

- Opportunity / Account / Stage / 금액 / Close Date가 List에서 식별됨
- Stage Progress 가독성 확보
- Won / Lost / Hold 상태 Badge 명확
- Activity 등록 Action 식별 가능

## Activity

- Lead / Account Source 구분이 Badge/Icon으로 명확함
- Activity Type 구분이 쉬움
- Target / Owner / 일시 / 제목이 한눈에 보임
- Mobile에서도 Timeline이 과도하게 압축되지 않음

---

# 21. Responsive QA 기준

최소 확인 Width:

```text
1920px Desktop
1440px Desktop
1280px Notebook
1024px Tablet Landscape
820px Tablet / Breakpoint
768px Tablet Portrait
430px Large Mobile
390px Mobile
360px Small Mobile
```

확인 Browser:

```text
Chrome Desktop
Chrome Android
Edge Desktop
```

Mobile 실기기 또는 Chrome Device Mode에서 다음을 반드시 확인한다.

```text
Action Button 겹침
Horizontal overflow
Tab 잘림
Bottom Nav 겹침
Keyboard Open 시 Save 접근성
Fullscreen Quick Create Safe Area
긴 한국어/영문 Label
```

---

# 22. i18n / 접근성 기준

- 신규 UI 문자열은 `ko-KR`, `en-US` 모두 등록
- Icon Button에는 `aria-label` 필수
- Icon만 표시하는 Action은 Tooltip 또는 Accessible Label 제공
- Status를 색상으로만 구분하지 않음
- Keyboard Focus 표시 제거 금지
- Contrast가 낮은 연회색 Text 남용 금지

---

# 23. 완료 판정 기준

다음 항목을 모두 만족해야 Visual QA 완료로 판단한다.

```text
[ ] 10px 미만 일반 업무 Text 제거
[ ] PC List Body 13px 이상
[ ] PC Tab 14px 이상
[ ] Mobile Body 14px 이상
[ ] 공통 SVG Icon System 적용
[ ] Detail Header Identity / Status / Meta / Action 분리
[ ] GUID Primary 노출 제거
[ ] Step Progress 확대
[ ] Empty '-' 표현 주요 화면 제거
[ ] Empty State CTA 적용
[ ] Mobile Quick Action 정리
[ ] Account Mobile 1차 Tab 5개 이하
[ ] Detail 내부 빈 Form 상시노출 제거
[ ] 44px Touch Target 준수
[ ] Lead / Account / Contact / Opportunity / Activity Visual Pattern 통일
[ ] HQ / GLOBAL 동일 Pattern 유지
[ ] ko-KR / en-US i18n 검사 통과
[ ] Build / Unit / Multi-market / Hardcode 검사 통과
```

---

# 24. 개발 완료 보고 형식

각 Visual QA STEP 완료 시 다음 형식으로 보고한다.

```text
STEP:

변경 화면:
- Lead
- Account
- ...

변경 Component:
- AbDetailHeader
- AbQuickActions
- ...

변경 내용:
1.
2.
3.

PC 확인:
- 1920
- 1440

Mobile 확인:
- 430
- 390
- 360

접근성/i18n:
- 결과

자동검증:
- build
- test
- multi-market
- i18n
- hardcode

미완료/추가 QA:
-

Commit SHA:
```

---

# 25. 첫 실행 작업

다음 작업부터 아래 순서로 시작한다.

```text
Visual QA STEP 1
Typography Token / 전체 Font Scale 상향

→ Visual QA STEP 2
Lucide 기반 Icon System + Quick Action Icon

→ Visual QA STEP 3
Lead / Account Detail Header 재디자인

→ Visual QA STEP 4
Tab / Step Progress / Empty State 개선
```

첫 4개 STEP을 적용한 뒤 PC Lead와 Mobile Account 화면을 다시 캡처하여 현재 화면과 비교한다.

**이 비교에서 가독성, 정보 위계, 화면 밀도 개선이 확인된 이후 나머지 Contact / Opportunity / Activity까지 확장한다.**
