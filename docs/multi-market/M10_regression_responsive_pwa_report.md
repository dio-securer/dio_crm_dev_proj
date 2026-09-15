# RM-MKT-001 M10 — Regression / Responsive / PWA Validation Report

- Work ID: `RM-MKT-001-M10`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m10-regression`
- Baseline main: M9 merged main (`8ab471dcc75b69bd5dd77dc5533acc087ce79be0`)
- Status: `SOURCE_READY / CI_PENDING / HUMAN_REVIEW_PENDING`

## 1. Objective

M0~M9 Multi-Market Architecture Refactoring으로 기존 HQ UI/PWA와 신규 GLOBAL Template 경계가 깨지지 않았는지 Source/CI 수준에서 검증한다.

M10은 실제 DEV/UAT 배포, 실제 휴대폰 설치, GPS 현장 테스트를 수행하는 Environment/Pilot 단계가 아니다.

## 2. Regression Coverage

기존 자동 테스트와 M10 신규 Gate를 합쳐 아래 영역을 검증한다.

```text
Market Template Resolver   COVERED
Country Profile Resolver   COVERED
Screen Resolver            COVERED
Field Profile Resolver     COVERED
Feature Guard              COVERED
Workflow Profile           COVERED
HQ Regression              COVERED
GLOBAL Screen Boundary     COVERED
```

M10 신규 `frontend/src/app/multi-market-regression.spec.ts`는 다음을 고정한다.

```text
HQ 14개 Route Slot → HQ Screen 유지
GLOBAL 승인 7개 Route만 노출
Route Path 중복 없음
Screen Slot 중복 없음
GLOBAL Mobile Primary 5개 이하
GLOBAL Direct Work / 미확정 Screen 미노출
```

## 3. Source-level Regression Gate

신규 Script:

```text
scripts/regression/multi-market-ui-check.mjs
```

Root Script:

```text
pnpm regression:multi-market
```

CI에 위 명령을 필수 Gate로 추가한다.

검증 대상:

```text
HQ 14 Screen Profile / Registry / Manifest 정합성
GLOBAL 7 Screen Profile / Registry / Manifest 정합성
핵심 URL Contract 유지
GLOBAL 미승인 Screen 미노출
Responsive breakpoint 존재
44px Mobile Touch Target baseline
Safe Area CSS 존재
Mobile Bottom Navigation / More Drawer 구조 존재
```

## 4. Responsive Matrix

Source 기준 Responsive Matrix:

| Matrix | Source Rule | M10 판정 범위 |
| --- | --- | --- |
| Desktop 1440+ | 기본 Desktop Sidebar / Topbar Layout | Source Gate |
| Laptop | `max-width:1100px` | Source Gate |
| Tablet | `max-width:920px` 및 coarse pointer | Source Gate |
| Android Mobile | `max-width:430px`, 44px control baseline | Source Gate |
| iOS Mobile | `max-width:430px`, Safe Area Insets | Source Gate |

`global.css`의 Mobile layout은 Sidebar를 숨기고 Bottom Navigation과 More Drawer를 활성화하며, `env(safe-area-inset-*)`를 사용한다.

주의: 위 판정은 CSS/Component Source 구조 검증이다. 실제 Galaxy/iPhone Viewport Rendering 결과를 검증했다고 주장하지 않는다.

## 5. PWA Validation

기존 `pnpm pwa:check`가 다음 Static Baseline을 검증한다.

```text
Manifest 필수 Key
standalone display
standard + maskable icon
Service Worker
/api/ Cache Exclusion
Non-GET Cache Exclusion
Navigation / Offline Shell Strategy
```

기존 Mobile/PWA Pilot Script는 실제 HTTPS DEV/UAT URL이 제공될 때 다음 Runtime 확인을 수행할 수 있다.

```text
App Shell
Manifest HTTP
Service Worker HTTP
API Cache Bypass Marker
API Liveness
API Readiness
```

하지만 M10에서는 배포된 DEV/UAT URL과 실제 Physical Device가 제공되지 않았으므로 Runtime Pilot Gate를 완료 처리하지 않는다.

## 6. CI Gate

M10 PR CI 필수 명령:

```text
pnpm build
pnpm test
pnpm regression:multi-market
pnpm i18n:check
pnpm i18n:hardcode
pnpm pwa:check
pnpm env:check
pnpm audit:critical
```

최종 Run/Job/Result는 PR CI 완료 후 기록한다.

## 7. Environment / Device Status

```text
DEV DB Migration 001~011 Apply       NOT EXECUTED
UAT DB Migration 001~011 Apply       NOT EXECUTED
DEV/UAT Web Runtime Validation        NOT EXECUTED
Physical Android Device Test          NOT EXECUTED
Physical iOS Device Test              NOT EXECUTED
Live GPS / Map Provider Test          NOT EXECUTED
ERP Test Transaction                  NOT EXECUTED
Production                            NOT TOUCHED
```

이 항목은 Source CI PASS와 구분하여 후속 Environment/Pilot Gate에서 수행한다.

## 8. Safety

M10에서는 다음을 수행하지 않는다.

```text
DB Schema 실제 적용
ERP 운영 연결
Map Provider 운영 연결
Production 배포
국가별 미확정 Rule 추가
IN/PT/TR 업무 구현
```

## 9. Acceptance

M10 Source Acceptance:

```text
[ ] Build PASS
[ ] Test PASS
[ ] Multi-Market Regression Gate PASS
[ ] i18n Check PASS
[ ] i18n Hardcode Check PASS
[ ] PWA Static Check PASS
[ ] Environment Plan Check PASS
[ ] Critical Audit PASS
[ ] HQ 14 Screen Regression PASS
[ ] GLOBAL 7 Screen Boundary PASS
[ ] Responsive Source Matrix PASS
[ ] Safe Area / Mobile Navigation PASS
[ ] Physical Device status explicitly NOT EXECUTED
[ ] Production NOT TOUCHED
```

## 10. Next

M10 Human Review / Merge 후 다음 단계는:

```text
M11 — India Fit/Gap 준비
```

M11에서는 인도 외부 CRM의 실제 화면/Field/Status/Approval/Integration 자료를 확보한 후 `HQ_TEMPLATE / GLOBAL_TEMPLATE / INDIA CURRENT`를 비교한다. 자료 없이 INDIA 전용 업무규칙을 추정 구현하지 않는다.
