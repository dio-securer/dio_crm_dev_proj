# RM-MKT-001 M10 — Regression / Responsive / PWA Validation Report

- Work ID: `RM-MKT-001-M10`
- Parent: `RM-MKT-001`
- Branch: `rm-mkt-001-m10-regression`
- Baseline main: M9 merged main (`8ab471dcc75b69bd5dd77dc5533acc087ce79be0`)
- Status: `SOURCE_READY / CI_PASS / HUMAN_REVIEW_PENDING`

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

신규 `frontend/src/app/multi-market-regression.spec.ts`는 HQ 14개 Route Slot 유지, GLOBAL 승인 7개 Route 범위, Route/Slot 중복 방지, GLOBAL Mobile Primary 5개 제한, Direct Work 및 미확정 GLOBAL Screen 미노출을 고정한다.

## 3. Source-level Regression Gate

신규 Script:

```text
scripts/regression/multi-market-ui-check.mjs
pnpm regression:multi-market
```

CI 필수 Gate로 등록했으며 다음을 검증한다.

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

| Matrix | Source Rule | M10 판정 범위 |
| --- | --- | --- |
| Desktop 1440+ | 기본 Desktop Sidebar / Topbar Layout | PASS — Source |
| Laptop | `max-width:1100px` | PASS — Source |
| Tablet | `max-width:920px` 및 coarse pointer | PASS — Source |
| Android Mobile | `max-width:430px`, 44px control baseline | PASS — Source |
| iOS Mobile | `max-width:430px`, Safe Area Insets | PASS — Source |

Mobile layout은 Sidebar를 숨기고 Bottom Navigation과 More Drawer를 활성화하며 `env(safe-area-inset-*)`를 사용한다.

위 판정은 CSS/Component Source 구조 검증이다. 실제 Galaxy/iPhone Viewport Rendering 결과를 검증했다고 주장하지 않는다.

## 5. PWA Validation

`pnpm pwa:check`가 아래 Static Baseline을 검증하며 CI에서 PASS했다.

```text
Manifest 필수 Key
standalone display
standard + maskable icon
Service Worker
/api/ Cache Exclusion
Non-GET Cache Exclusion
Navigation / Offline Shell Strategy
```

Mobile/PWA Pilot Script는 실제 HTTPS DEV/UAT URL이 제공될 때 App Shell, Manifest, Service Worker, API cache bypass, liveness/readiness를 Runtime 검증할 수 있다. M10에는 해당 배포 URL/Physical Device가 제공되지 않았으므로 Runtime Pilot Gate는 완료 처리하지 않는다.

## 6. CI Result

Functional validation run:

```text
Run : 34973417835
Job : 104395038295

pnpm build                    PASS
pnpm test                     PASS
pnpm regression:multi-market  PASS
pnpm i18n:check               PASS
pnpm i18n:hardcode            PASS
pnpm pwa:check                PASS
pnpm env:check                PASS
pnpm audit:critical           PASS
```

본 보고서 상태 갱신 Commit도 동일 CI 전체 Gate를 다시 통과해야 PR을 승인 대상으로 본다.

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

## 8. Safety

M10에서는 DB Schema 실제 적용, ERP/Map 운영 연결, Production 배포, 미확정 국가 Rule 추가, IN/PT/TR 업무 구현을 수행하지 않았다.

## 9. Acceptance

```text
[x] Build PASS
[x] Test PASS
[x] Multi-Market Regression Gate PASS
[x] i18n Check PASS
[x] i18n Hardcode Check PASS
[x] PWA Static Check PASS
[x] Environment Plan Check PASS
[x] Critical Audit PASS
[x] HQ 14 Screen Regression PASS
[x] GLOBAL 7 Screen Boundary PASS
[x] Responsive Source Matrix PASS
[x] Safe Area / Mobile Navigation PASS
[x] Physical Device status explicitly NOT EXECUTED
[x] Production NOT TOUCHED
```

## 10. Next

M10 Human Review / Merge 후 다음 단계는 `M11 — India Fit/Gap 준비`다. 인도 외부 CRM의 실제 화면/Field/Status/Approval/Integration 자료를 확보한 후 `HQ_TEMPLATE / GLOBAL_TEMPLATE / INDIA CURRENT`를 비교하며, 자료 없이 INDIA 전용 업무규칙을 추정 구현하지 않는다.
