# CRM-UI-001 — DIO UI Completion / Responsive Mobile / PWA 실행보고서

- Work ID: `CRM-UI-001`
- Branch: `ui-completion/responsive-pwa`
- 작성일: 2026-09-13
- 상태: `SOURCE_IMPLEMENTED / CI_PENDING / HUMAN_REVIEW_PENDING`

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

## 5. CI Gate

PR 생성 후 아래를 검증한다.

```text
pnpm build
pnpm test
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
pnpm audit:critical
```

현재 상태: `CI_PENDING`

## 6. Human Review 대상

- DIO Navy UI Tone
- Desktop Sidebar 정보구조
- Mobile Bottom Navigation 우선순위
- More Drawer 메뉴 구조
- Lead/Account 기준 화면 디자인
- PWA 설치 정책
- Offline App Shell 범위

## 7. 미실행

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

위 항목은 Source Review 승인 후 Environment/Pilot 단계에서 별도 실행한다.
