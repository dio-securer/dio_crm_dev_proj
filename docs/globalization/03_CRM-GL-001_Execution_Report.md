# CRM-GL-001 — DIO CRM Globalization Foundation 실행보고서

- Work ID: `CRM-GL-001`
- Branch: `globalization/foundation`
- PR: `#9`
- 작성일: 2026-09-13
- 상태: `SOURCE_COMPLETE / CI_PASS / HUMAN_REVIEW_APPROVED / MAIN_MERGED / DB_NOT_APPLIED / PRODUCTION_NOT_TOUCHED`
- Merge Commit: `a609b26cbc70c64cecdf9a8bc8e593aa764a7462`

---

## 1. 목표

Phase 0~8 한국형 CRM Source Baseline을 유지하면서 하나의 CRM Core로 다국어와 국가별 Market 차이를 수용할 수 있는 Globalization Foundation을 추가한다.

핵심 원칙:

```text
Locale != Market
Language != Country
Frontend Hide != Business Rule Enforcement
One Core + Locale + Market Profile + Workflow Profile
```

---

## 2. 실행 결과

| 구분 | 결과 | 비고 |
|---|---|---|
| G0 Locale/Market Gap 정리 | 완료 | 해외 업무규칙 미확정 사항은 SPEC GAP 유지 |
| G1 i18n Foundation | 완료 | `ko-KR`, `en-US` Reference Locale |
| G2 Formatting | 완료 | Intl 기반 Number/Currency/Date/Timezone |
| G3 Company/Market Context | 완료 | `GET /api/me/context` 및 서버 Context Resolver |
| G4 DB Migration Draft | 완료 | `009_globalization_foundation.sql`, seed 작성 / 미적용 |
| G5 Market/Feature Profile | 완료 | `KR_SALES` + Backend Feature Enforcement |
| G6 Workflow Profile | 완료 | `KR_SALES_APPROVAL` 기존 한국 승인 Baseline 보존 |
| G7 Address/Map Boundary | 완료 | Provider-independent boundary, 실제 지도 Provider 미연결 |
| G8 Existing UI Migration | 완료 | 주요 전체 React 화면 Translation Key 전환 |
| G9 Export Localization | 완료 | Ledger XLSX / Statement PDF Locale Baseline |
| CI | PASS | 최종 current-head run `34732083668` |
| Human Review | APPROVED | 2026-09-13 KST 명시 승인 |
| PR #9 Merge | 완료 | Merge Commit `a609b26cbc70c64cecdf9a8bc8e593aa764a7462` |

---

## 3. 구현 Baseline

### 3.1 Active Market

현재 활성 Source Baseline은 한국 Market만 정의한다.

```text
Market Profile   KR_SALES
Country          KR
Default Locale   ko-KR
Currency         KRW
Timezone         Asia/Seoul
Workflow         KR_SALES_APPROVAL
```

`en-US`는 i18n/Formatting 기술 검증을 위한 Reference Locale이며, 미국 Market 업무규칙 또는 미국 법인 Production 활성화를 의미하지 않는다.

### 3.2 Feature Enforcement

대표 Market Feature:

```text
HIRA_IMPORT
DIRECT_WORK
GPS_CHECKIN
ACTIVITY_APPROVAL
ERP_ACCOUNT_APPROVAL
MONTHLY_STATEMENT
```

Frontend 메뉴/버튼 노출만 제어하지 않고 Backend에서도 Market Feature를 검증한다.

### 3.3 Workflow

현재 한국 승인 Baseline은 보존한다.

```text
영업담당자 → 지점장 → 본부장
```

해외 국가의 승인단계는 Requirement 승인 전 임의 구현하지 않는다.

---

## 4. Database

Source에 다음 Migration Draft가 추가되었다.

```text
database/migrations/009_globalization_foundation.sql
database/seeds/009_globalization_seed.sql
```

본 작업에서는 실제 DEV/UAT/Production DB에 Migration을 적용하지 않았다.

DB 적용은 별도 Environment Gate와 사용자 승인 후 수행한다.

---

## 5. UI / i18n

기존 주요 사용자 화면은 Translation Key 기반으로 전환되었다.

대상:

```text
App Shell / Navigation
Lead
Account
Activity / GPS
Activity Report / Approval
Direct Work
Opportunity
Pipeline
Contract / Collection
Order
Fulfillment
Ledger / Statement
Account 360
Analytics Dashboard
Ops Status
```

상태 Code는 DB/API에서 번역하지 않고 UI Layer에서만 표시명을 Localize한다.

---

## 6. Export

Package Ledger XLSX 및 Monthly Statement PDF에 다음 Localization Baseline을 적용했다.

- Locale별 Header
- Currency Formatting
- Date Formatting
- Company Timezone Context
- Locale-aware filename policy

CJK PDF Font 배포와 File Storage 영구저장은 기존 Environment Gate 상태를 유지한다.

---

## 7. CI 결과

초기 PR CI run `34731956073`은 `globalization.service.spec.ts`의 Test Helper 이름과 Local 변수 이름 충돌로 TypeScript Build가 실패했다.

수정:

```text
service(...) helper
→ createService(...)
```

수정 commit:

```text
566820ba04f33b7647239fe88ce5374aec37b645
```

최종 current-head CI run `34732083668`에서 다음 단계가 모두 성공했다.

```text
pnpm install --no-frozen-lockfile  PASS
pnpm build                         PASS
pnpm test                          PASS
pnpm i18n:check                    PASS
pnpm i18n:hardcode                 PASS
pnpm audit:critical                PASS
```

최종 PR Head:

```text
a7cbfa56b8a713fc527bc9a4ed6e85621a45bd4e
```

---

## 8. Human Review / Merge

2026-09-13 KST 기준 사용자의 명시적 Human Review 승인을 받아 PR #9의 `main` 병합을 진행했다.

GitHub 자체 self-review APPROVE는 PR 작성자 본인 승인 제한으로 사용하지 않았고, PR 본문과 `human-review-approved` 라벨에 승인 상태를 기록한 후 current-head SHA를 재확인하여 병합했다.

```text
PR #9
State        CLOSED
Merged       TRUE
Merged At    2026-09-13T02:16:11Z
Head         a7cbfa56b8a713fc527bc9a4ed6e85621a45bd4e
Merge Commit a609b26cbc70c64cecdf9a8bc8e593aa764a7462
```

---

## 9. 미실행 / Environment Gate

다음은 완료로 간주하지 않는다.

```text
DEV/UAT Migration 009 적용
기존 Company 실제 국가/통화/Timezone 데이터 확정
해외 국가별 Workflow 확정
해외 Customer Identifier 규칙
국가별 ERP / Local Integration
실제 Map Provider 연결
CJK PDF Font 배포
PDF/File Storage 영구저장
Responsive UI Completion
PWA / Capacitor App
Country UAT / Pilot
Production Rollout
```

Production DB와 ERP는 본 작업에서 변경하지 않았다.

---

## 10. SPEC GAP

해외 국가별 다음 요구는 확정 전까지 Gap으로 유지한다.

- 국가별 승인 Workflow
- 국가별 사업자/고객 Identifier
- 국가별 ERP 및 현지 시스템
- 국가별 Map Provider
- 개인정보/보존 정책
- 직출/직퇴 사용 여부
- GPS 정책
- 세금/통화 Reporting
- 주소/전화번호 Validation 규칙

---

## 11. 완료 상태 및 다음 단계

현재 상태:

```text
CRM-GL-001
SOURCE COMPLETE
CI PASS
HUMAN REVIEW APPROVED
PR #9 MAIN MERGED
DB NOT APPLIED
PRODUCTION NOT TOUCHED
```

다음 실행 순서:

```text
DIO UI Completion
 → Responsive Mobile UI
 → PWA Foundation
 → DEV/UAT Migration 009
 → 국가별 Integration/UAT/Pilot
 → Production Rollout
```
