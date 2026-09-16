# Lead / Account A+B Visual Design — Execution Report (Step 4.5)

- 문서유형: UI Visual Design Execution Report
- 상태: **COMPLETE**
- 작성일: 2026-09-16
- Baseline: [`00_UI_Design_Confirmed_Baseline.md`](./00_UI_Design_Confirmed_Baseline.md)
- 구조 프로토타입: [`04_AB_Prototype_Execution_Report.md`](./04_AB_Prototype_Execution_Report.md)

---

## 1. 목적

Step 4에서 구현한 **A+B 구조 프로토타입**에 Concept A/B 시안 Visual 요소를 매칭한다.

| Step | 범위 |
|------|------|
| **4** | Split Workspace, Quick Create, Tabs/Sections, i18n (기능 골격) |
| **4.5** | 시안 Visual Match — Step Progress, Accordion, KPI, Badge, Footer, FAB |

---

## 2. 공통 Visual 컴포넌트

경로: `frontend/src/ui/ab-workspace/`

| 컴ponent | Concept | 역할 |
|----------|---------|------|
| `AbStepProgress` | B | Lead 4단계 진행 표시 |
| `AbSectionAccordion` | B | 상세 Section 접이식 패널 |
| `AbKpiRow` | A | Account Summary KPI 카드 행 |
| `AbInfoGrid` | A | Account 요약 정보 그리드 |
| `AbEntityBadges` | A | 상태·등급·ERP Badge |
| `AbDetailFooter` | B | 임시저장 / 저장 Sticky Footer |
| `AbMobileFab` | B | Mobile Quick Create FAB |
| `countryFlag` | A | 국가 플래그 emoji |

공통 CSS: `frontend/src/styles/ab-workspace.css` (`main.tsx` import)

---

## 3. 화면별 적용

| 화면 | 파일 | Visual 적용 |
|------|------|-------------|
| **HQ Lead** | `frontend/src/LeadsPage.tsx` | `ab-workspace`, Step Progress, Accordion Sections, Badges, Footer, FAB, 국가 플래그 |
| **GLOBAL Lead** | `frontend/src/market/templates/global/GlobalLeadPage.tsx` | 동일 패턴 (API Status + Accordion) |
| **HQ Account** | `frontend/src/AccountsPage.tsx` | `ab-workspace`, InfoGrid, KPI Row, Badges, Accordion Tab, Footer, FAB |
| **GLOBAL Account** | `frontend/src/market/templates/global/GlobalAccountPage.tsx` | 동일 패턴 (Profile Sections + Visual) |

---

## 4. Concept 매칭 체크리스트

### Concept A — Split Workspace

- [x] 좌 List / 우 Detail Split 레이아웃 유지
- [x] List 선택 Row Highlight (blue gradient + inset bar)
- [x] Detail Header — Entity Name + Badge Row
- [x] Account Summary — Info Grid + KPI Cards
- [x] List Row — 국가 플래그 보조 표시

### Concept B — Step Form + Detail Sections

- [x] Lead Step Progress (4단계, Mobile 축약 라벨)
- [x] Detail Sections → Accordion (incomplete hint)
- [x] Quick Create Drawer (Step 4 유지)
- [x] Detail Footer — 임시저장 / 저장
- [x] Mobile FAB — 신규 등록 진입

---

## 5. PC / Mobile

| Device | Visual 패턴 |
|--------|-------------|
| **PC** | Split + Step Bar + Tab/Accordion + Sticky Footer |
| **Mobile** | List → Detail + FAB + Footer (CSS `@media` in `ab-workspace.css`) |

AccountsPage Mobile은 기존 `mob-*` 레이아웃 유지 (Desktop Visual 우선 적용).

---

## 6. i18n

Step 3 Catalog 키 재사용:

- `lead.actions.saveDraft`, `lead.toast.draftSaved`
- `account.actions.saveDraft`, `account.toast.draftSaved`
- `account.badges.*`, `account.related.*`, `account.actions.viewRelated`

---

## 7. 테스트

```text
pnpm --filter @dio-crm/web test   → 59 passed
```

---

## 8. 잔여 Gap (5단계 / 후속)

```text
[ ] Concept 시안 PNG → docs/ui/assets/ 등록 (copy blocked, 수동 추가)
[ ] AccountsPage Mobile Visual — ab-workspace 클래스 전면 적용
[ ] Design Token — ab-workspace.css → 01_DIO_UI Responsive PWA Design Token 통합
[ ] KPI / Related Count — API 연동 (현재 placeholder)
[ ] es-MX / pt-PT / tr-TR / hi-IN 번역
[ ] 경영진 시연 PPT
```

---

## 9. 다음 단계

**5단계:** 시연용 Prototype 확정 → 경영진 보고 PPT
