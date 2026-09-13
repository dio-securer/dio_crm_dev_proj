# CRM-UI-001 — DIO UI Completion / Responsive Mobile / PWA 실행보고서

- Work ID: `CRM-UI-001`
- Branch: `ui-completion/responsive-pwa`
- PR: `#10`
- 작성일: 2026-09-13
- 상태: `SOURCE_COMPLETE / CI_PASS / HUMAN_REVIEW_APPROVED / MAIN_MERGED / PRODUCTION_NOT_TOUCHED`

## 1. 실행 범위

### UI Completion

- DIO Corporate App Shell
- Desktop Sidebar / Sticky Topbar
- 공통 Design Token
- Form / Button / Table / Card 공통 스타일
- Lead / Account KPI + Search + Data Card 기준화
- 기존 Phase 2~8 화면 공통 UI Normalization
- Globalization Locale/Market Context 유지

### Responsive Mobile

- Desktop Sidebar → Mobile Bottom Navigation 전환
- Primary quick navigation + More Drawer
- Mobile safe area
- 44px touch target
- Table horizontal scrolling
- grid collapse
- locale text overflow 대응

### PWA Foundation

- Web App Manifest
- Standard / Maskable SVG icon
- Service Worker
- Static app-shell cache
- `/api/*` cache exclusion
- install prompt
- online/offline state
- App shortcuts

## 2. Source 변경

주요 신규 파일:

```text
frontend/src/ui/AppShell.tsx
frontend/src/ui/InstallPrompt.tsx
frontend/src/styles/tokens.css
frontend/src/styles/global.css
frontend/src/styles/workspace.css
frontend/src/pwa/register.ts
frontend/public/manifest.webmanifest
frontend/public/sw.js
frontend/public/icons/dio-crm.svg
frontend/public/icons/dio-crm-maskable.svg
scripts/pwa/check.mjs
```

주요 변경:

```text
frontend/src/App.tsx
frontend/src/main.tsx
frontend/src/LeadsPage.tsx
frontend/src/AccountsPage.tsx
frontend/index.html
frontend/src/i18n/locales/ko-KR/common.json
frontend/src/i18n/locales/en-US/common.json
package.json
.github/workflows/ci.yml
```

## 3. PWA Security Baseline

Service Worker는 CRM 데이터 API를 Cache하지 않는다.

```text
/api/*   BYPASS
POST     BYPASS
PUT      BYPASS
PATCH    BYPASS
DELETE   BYPASS
```

Offline 상태에서 업무 데이터를 임의로 저장/재전송하지 않는다.

따라서 이번 단계에서 Offline은 UI Shell을 다시 열 수 있는 수준이며 실제 영업 데이터 Offline 기능을 의미하지 않는다.

## 4. 기능 영향

기존 API와 업무 규칙을 변경하지 않았다.

유지:

- Lead / Account
- Activity / GPS IN/OUT
- Activity Report / Approval
- Direct Work
- Opportunity / Pipeline
- Contract / Collection
- Order / Fulfillment
- Ledger / Statement
- Account 360 / Dashboard / Ops
- Market Feature Enforcement
- `ko-KR` / `en-US`

## 5. CI 결과

필수 Gate:

```text
pnpm build
pnpm test
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
pnpm audit:critical
```

초기 PR CI run `34733051526`은 `frontend/src/pwa/register.ts`에서 `import.meta.env.PROD` 타입 정의가 없는 문제로 TypeScript Build가 실패했다.

수정 commit:

```text
7d7544aef8233a3c38de35fcdac018d327c4ce0a
```

수정 후 localhost/127.0.0.1에서는 Service Worker 등록을 생략하고, 배포 환경에서는 표준 `navigator.serviceWorker.register()`를 사용하도록 변경했다.

최종 Current Head CI run `34733170050`에서 다음 단계가 모두 성공했다.

```text
pnpm install --no-frozen-lockfile  PASS
pnpm build                         PASS
pnpm test                          PASS
pnpm i18n:check                    PASS
pnpm i18n:hardcode                 PASS
pnpm pwa:check                     PASS
pnpm audit:critical                PASS
```

## 6. Human Review / Merge

Human Review는 2026-09-13(KST) 사용자 명시 승인으로 완료되었다.

```text
Final Head Before Merge
a6b1d1ef6f5457f9bc2f2dca973f2cffa227da03

PR #10 Merge Commit
60862e32408e77ca8690346151bcfe5f7e95016e
```

PR #10은 `main`에 병합되었다.

## 7. 미실행 / Environment Gate

```text
실제 단말 Pilot
Android/iOS Store Build
Capacitor
Push Notification
Background GPS
Offline 업무 데이터 저장
Map Provider
DEV/UAT DB Migration 009
Production Deploy
```

위 항목은 Environment/Pilot 단계에서 별도 실행한다.

## 8. 현재 상태

```text
CRM-UI-001
SOURCE COMPLETE
CI PASS
HUMAN REVIEW APPROVED
PR #10 MAIN MERGED
PRODUCTION NOT TOUCHED
```
