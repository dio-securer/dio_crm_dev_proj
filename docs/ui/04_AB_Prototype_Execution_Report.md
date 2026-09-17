# Lead / Account A+B Prototype — Execution Report (Step 4)

- 문서유형: UI Prototype Execution Report
- 상태: **COMPLETE**
- 작성일: 2026-09-16
- Baseline: [`00_UI_Design_Confirmed_Baseline.md`](./00_UI_Design_Confirmed_Baseline.md)
- i18n Catalog: [`03_i18n_Label_Catalog.md`](./03_i18n_Label_Catalog.md)

---

## 1. 적용 범위

| 화면 | 파일 | A+B 적용 |
|------|------|----------|
| **HQ Lead** | `frontend/src/LeadsPage.tsx` | Split Workspace + Quick Create Drawer + Step Bar + Tabs |
| **GLOBAL Lead** | `frontend/src/market/templates/global/GlobalLeadPage.tsx` | Split Workspace + API Status + Section Tabs |
| **HQ Account** | `frontend/src/AccountsPage.tsx` | Desktop Split Workspace + Quick Create Drawer + Tabs |
| **GLOBAL Account** | `frontend/src/market/templates/global/GlobalAccountPage.tsx` | Split Workspace + Profile Sections + Tabs |
| **Contact** | Account `contacts` Tab | Quick Add Contact (local prototype) |

---

## 2. A+B 패턴 구현 요약

### A — Split Workspace

```text
PC: 좌 List/Filter + 우 Detail/Tabs
Mobile: List → Detail (LeadsPage, AccountsPage mobile 유지)
```

공통 CSS: `frontend/src/styles/lead-workspace.css`

### B — Quick Create + Section 보강

| Entity | Quick Create | Section 보강 |
|--------|--------------|--------------|
| Lead | Drawer (병원명, 국가, 전화, 담당자, 주소) | Tabs: keyman, system, conversion |
| Account | Drawer (거래처명, 유형, 전화, 주소) | Tabs: summary, contacts, trade, manage, address, erp, related |

---

## 3. i18n 적용

- `lead.*` canonical keys → LeadsPage, GlobalLeadPage
- `account.*` + `account-ext.json` → AccountsPage, GlobalAccountPage
- `contact.*` → Account Contacts Tab
- Legacy `leadV2.*` → Mock stage 라벨만 잔존 (API Status 통합은 후속)

---

## 4. Lead 프로세스 UI

**GLOBAL (API Contract)**

```text
NEW → FIRST_VISIT → KEYMAN_MEETING → CONVERTED | CONTACT_EXCLUDED
```

Step Progress Bar + Status Action Buttons

**HQ Mock**

Mock `LeadStage` 유지, Step Bar는 API 4단계 Visual Mapping

---

## 5. 테스트

```text
pnpm --filter @dio-crm/web test   → 59 passed
```

---

## 6. 잔여 Gap (5단계 / 후속)

```text
[ ] leadV2.stage.* → API LeadStatus 완전 통합 (HQ Mock)
[ ] Lead POST API → GLOBAL Quick Create
[ ] Contact 별도 Route / API 연동
[ ] Related Entity Drill-down Link 활성화
[ ] es-MX / pt-PT / tr-TR / hi-IN 번역
[ ] 경영진 시연 PPT
```

---

## 7. 다음 단계

**4.5단계:** 시안 Visual Design Implementation → [`05_Visual_Design_Execution_Report.md`](./05_Visual_Design_Execution_Report.md) **COMPLETE**

**5단계:** 시연용 Prototype 확정 → 경영진 보고 PPT
