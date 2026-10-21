# CRM-UI-001 — DIO UI Completion / Responsive Mobile / PWA 설계

> **확정 Design Model:** [`00_UI_Design_Confirmed_Baseline.md`](./00_UI_Design_Confirmed_Baseline.md) — 운영 화면 A+B, 대시보드 C, i18n 전제

## 1. 목표

Globalization Foundation이 적용된 단일 React Frontend를 기준으로 다음 3개 작업을 하나의 연속 단계로 수행한다.

```text
DIO UI Completion
 → Responsive Mobile UI
 → PWA Foundation
```

핵심 원칙은 PC/모바일/PWA를 별도 소스로 분리하지 않고 **하나의 React Source + 하나의 Design System + 하나의 Market/Locale Context**로 유지하는 것이다.

## 2. UI Completion

### App Shell

- DIO Navy 기반 Sidebar / Topbar
- Market / Locale / Timezone Context 표시
- Feature Profile 기반 메뉴 노출 유지
- 전체 Phase 2~8 업무화면을 동일 App Shell 안에서 실행
- Lead / Account는 KPI + Search + Data Card 패턴의 기준 화면으로 고도화
- 기존 나머지 화면은 공통 Typography / Form / Button / Table / Card 스타일을 적용해 화면별 inline style 차이를 흡수

### Design Tokens

`frontend/src/styles/tokens.css`

- Corporate navy / blue palette
- surface / border / text
- success / warning / danger / info
- radius / shadow
- sidebar/topbar/mobile navigation size

### Existing UI Compatibility

현재 Phase 0~8에서 구현된 기능 UI와 API 호출을 다시 작성하지 않는다. UI Completion Layer가 기존 DOM을 감싸고 공통 스타일을 적용한다.

업무규칙, API Endpoint, Feature Guard, Globalization Context는 변경하지 않는다.

## 3. Responsive Mobile UI

Breakpoint baseline:

```text
Desktop        > 1100
Tablet         821 ~ 1100
Mobile         <= 820
Small Mobile   <= 430
```

Mobile UX:

- Desktop Sidebar 숨김
- 하단 Primary Navigation 제공
- Lead / Activity / Opportunity / Order / Dashboard를 빠른 진입 메뉴로 제공
- 나머지 메뉴는 Bottom Drawer의 `더보기`로 제공
- 44px 이상 Touch Target
- Table은 가로 Scroll 허용
- Grid는 모바일에서 1~2 column으로 자동 전환
- Safe Area (`env(safe-area-inset-*)`) 고려
- Locale text expansion을 고려해 wrap/overflow 처리

영업사원 현장 사용 흐름은 다음을 우선한다.

```text
오늘 업무 확인
 → Activity / GPS
 → 상담
 → OUT
 → Opportunity / Order
 → Activity Report
```

## 4. PWA Foundation

### Installability

- `manifest.webmanifest`
- DIO CRM standard / maskable icon
- `display: standalone`
- theme/background color
- App shortcuts: Activity / Opportunity / Order
- `beforeinstallprompt` 기반 설치 버튼

### Service Worker

`frontend/public/sw.js`

정책:

```text
Navigation       Network First + cached App Shell fallback
Static Assets    Cache First / background refresh
/api/*           Cache 금지 / Network only
Non-GET          Cache 금지
```

CRM 고객/영업 데이터가 Service Worker Cache에 저장되지 않도록 `/api/` 요청을 명시적으로 제외한다.

### Offline 범위

이번 Foundation은 **App Shell Offline**까지만 포함한다.

포함:
- 설치
- standalone 실행
- 정적 UI Asset cache
- Network 상태 표시
- offline App Shell fallback

미포함:
- Lead/Account/Opportunity 업무 데이터 Offline 저장
- Offline Mutation Queue
- Background Sync
- Push Notification
- Background GPS
- Geofencing

위 기능은 보안/업무규칙 검토 후 별도 Work Package로 진행한다.

## 5. Mobile App 확장

PWA Pilot 후 네이티브 기능 요구가 확인되면 동일 React Source를 Capacitor로 감싼다.

```text
React Core
 ├─ Browser Desktop
 ├─ Mobile PWA
 └─ Capacitor
      ├─ Android
      └─ iOS
```

Capacitor 도입 판단 기준:
- Background GPS
- 강한 Mock GPS 대응
- Native Push
- Camera/Barcode 고급 제어
- MDM/App Store 배포
- 단말 보안정책

## 6. QA Gate

필수:

```text
pnpm build
pnpm test
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
pnpm audit:critical
```

수동 Pilot 항목:
- Desktop 1440+
- Tablet
- Android Chrome PWA 설치
- iOS Safari 홈 화면 추가
- 360~430px 주요 화면
- ko-KR / en-US
- Online / Offline App Shell
- GPS Permission flow

## 7. Environment Gate

본 작업은 Source/UI/PWA Foundation 범위이다.

실행하지 않는 항목:
- Migration 009 DEV/UAT 적용
- Production Deploy
- 실제 Map Provider 연결
- ERP/HIRA 실제 Transport
- Push Provider
- Native App Store 배포
