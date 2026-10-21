# 시연용 Prototype 확정 — Verification Report (Step 5)

- 문서유형: Demo Prototype Verification Report
- 상태: **CONFIRMED FOR DEMO**
- 검증일: 2026-09-16
- Baseline: [`00_UI_Design_Confirmed_Baseline.md`](./00_UI_Design_Confirmed_Baseline.md)
- Visual: [`05_Visual_Design_Execution_Report.md`](./05_Visual_Design_Execution_Report.md)

---

## 1. 시연 환경

```text
pnpm --filter @dio-crm/web dev
→ http://localhost:5173
```

| 항목 | 값 |
|------|-----|
| Market Profile | KR / HQ (기본 fallback) |
| Locale | ko-KR (en-US 전환 가능) |
| Lead 데이터 | Mock (localStorage) |
| Account 데이터 | API 미연결 시 Sandbox (localStorage) |

**권장 뷰포트:** PC 1440×900 이상 (Split Workspace)

---

## 2. 시연 시나리오 (경영진 Demo Flow)

### A. Lead — HQ Mock

```text
1. /  Lead 목록 → 항목 선택
2. Step Progress (4단계) + Badge + Summary Strip 확인
3. Accordion Section (Keyman / 활동 / 변환) 펼치기
4. + 신규 등록 → Quick Create Drawer
5. 임시 저장 / 저장 Footer 동작
6. (옵션) 언어 → English 전환
```

### B. Account — HQ Sandbox

```text
1. /accounts  목록 → 거래처 선택
2. Summary Tab — Info Grid + KPI Cards
3. Tabs (연락처 / ERP / 관련) 전환
4. + 신규 등록 → Quick Create Drawer → 빠른 등록
5. ERP 등록요청 / 편집 / Footer 저장
```

---

## 3. 화면 검증 결과

| # | 화면 | URL | 결과 | 비고 |
|---|------|-----|------|------|
| 1 | HQ Lead Split | `/` | **PASS** | List + Detail, Step Bar, Accordion, Footer |
| 2 | HQ Lead Quick Create | `/` | **PASS** | Drawer 필수 필드 + i18n |
| 3 | HQ Account Split | `/accounts` | **PASS** | List + Detail, Tabs, KPI, Badges |
| 4 | HQ Account Quick Create | `/accounts` | **PASS** | Drawer (거래처명/유형/전화/주소) |
| 5 | Account Sandbox Fallback | `/accounts` | **PASS** | API 미연결 시 local 테스트 데이터 |
| 6 | i18n ko-KR | 전체 | **PASS** | lead.* / account.* / contact.* |
| 7 | i18n en-US | 전체 | **PASS** | Locale 셀렉터 전환 |

---

## 4. 검증 중 수정 사항

| 이슈 | 조치 | 파일 |
|------|------|------|
| Lead 상세 JSX 태그 불일치 (`</a>`) → 빌드/HMR 오류 | `</button>` 수정 | `LeadsPage.tsx` |
| 한국 지역명에 🌐 표시 (ISO 코드 아님) | 한글 지역 → 🇰🇷 매핑 | `country-flag.ts` |

---

## 5. 시연 확정 범위

**포함 (Demo Ready)**

- Concept A+B Split Workspace (Lead / Account)
- Concept B Quick Create Drawer
- Step Progress + Accordion Sections (Lead)
- Info Grid + KPI Row (Account Summary)
- Entity Badges + Detail Footer
- i18n ko-KR / en-US
- Mock / Sandbox 오프라인 시연

**제외 (후속 Phase)**

- Dashboard Concept C
- GLOBAL Market Template 별도 시연 (Profile 전환 필요)
- Contact 독립 Route
- Related Entity Drill-down Link
- es-MX / pt-PT / tr-TR / hi-IN 번역
- KPI 실데이터 API 연동

---

## 6. 테스트

```text
pnpm --filter @dio-crm/web test   → 59 passed
```

---

## 7. 다음 단계

**경영진 보고 PPT** — 본 문서 시나리오 + 스크린샷 기반 슬라이드 작성
