# CRM-ENV-001 — Mobile/PWA Pilot → DEV/UAT → Map/ERP Integration Runbook

## 1. 목적

CRM-UI-001 이후 실제 환경 Gate를 안전하게 진행하기 위한 실행 절차다.

범위:

1. Mobile/PWA Pilot readiness 및 실제 단말 검증
2. DEV/UAT DB Migration 001~009 적용
3. DEV/UAT Web/API 배포 후 Health/Smoke 검증
4. Map Provider 연결 검증
5. ERP Test Endpoint 연결 검증

Production은 본 작업 범위가 아니다.

## 2. 중요한 실행 원칙

- 실제 단말 Pilot은 배포된 HTTPS URL이 필요하다.
- DEV/UAT DB 변경 전 Backup/Snapshot을 확보한다.
- Migration은 `001 → 009` 순서로 실행한다.
- `scripts/deploy/devuat-migration-plan.mjs`는 기본이 PLAN ONLY다.
- SQL 실행은 `--execute` + `CRM_ALLOW_DB_MUTATION=YES`가 모두 있어야 하며 DEV/UAT만 허용한다.
- Production 대상은 Script 자체에서 거부한다.
- Service Worker는 `/api/*` 업무 데이터를 Cache하지 않는다.
- Map/ERP Connectivity PASS는 업무 Transaction 검증 완료를 의미하지 않는다.

## 3. Gate A — Mobile/PWA Pilot

### A-1. Runtime 자동검증

배포 후:

```bash
CRM_WEB_BASE_URL=https://<dev-or-uat-web> \
CRM_API_BASE_URL=https://<dev-or-uat-api> \
node scripts/pilot/mobile-pwa-readiness.mjs --strict
```

검증 항목:

- HTTPS
- App Shell 응답
- Manifest
- Service Worker
- API Cache bypass marker
- `/api/health/live`
- `/api/health/ready`

### A-2. 실제 단말 검증

최소 권장 Matrix:

| 구분 | 단말 | Browser/PWA | 필수 확인 |
|---|---|---|---|
| Android | 회사 표준 Galaxy | Chrome 설치형 PWA | 설치, 실행, 로그인, GPS 권한, IN/OUT, 카메라/파일, 화면 회전 |
| iOS | 회사 지원 iPhone | Safari 홈 화면 | 설치, 실행, 로그인, GPS 권한, IN/OUT, Safe Area |
| PC | Windows 11 | Edge/Chrome | Desktop Layout, 다국어, 업무 Flow |

현장 핵심 Scenario:

1. 로그인
2. 오늘 활동 조회
3. GPS 권한 허용
4. 병원 선택
5. GPS IN
6. 상담정보 입력
7. OUT
8. 활동보고 확인
9. Offline 전환 시 App Shell 표시 확인
10. Network 복구 후 최신 데이터 재조회

합격기준:

- PWA 설치 및 재실행 성공
- GPS 권한/좌표 수신 성공
- 업무 API가 Service Worker Cache에 의해 오래된 값으로 대체되지 않음
- 모바일 UI에서 주요 업무 버튼이 44px touch target을 만족
- 치명적 Layout 깨짐 없음

## 4. Gate B — DEV/UAT Migration

### B-1. 계획 확인

```bash
node scripts/deploy/devuat-migration-plan.mjs --target DEV
node scripts/deploy/devuat-migration-plan.mjs --target UAT
```

Migration:

```text
001_phase1_foundation.sql
002_phase2_customer.sql
003_phase3_activity.sql
004_phase4_opportunity.sql
005_phase5_contract_collection.sql
006_phase6_order_delivery_sales.sql
007_phase7_analytics.sql
008_phase8_hardening.sql
009_globalization_foundation.sql
```

### B-2. 실제 적용

실제 DB 접속정보와 Backup/Snapshot 확보 후에만 수행한다.

```bash
CRM_DB_SERVER=...
CRM_DB_PORT=1433
CRM_DB_DATABASE=...
CRM_DB_USER=...
CRM_DB_PASSWORD=...
CRM_ALLOW_DB_MUTATION=YES
node scripts/deploy/devuat-migration-plan.mjs --target DEV --execute
```

UAT도 동일하며 `--target UAT`로 구분한다.

### B-3. 적용 후 검증

- DB Object/Index/Seed 확인
- Backend DB 연결
- `/api/health/live`
- `/api/health/ready`
- Login/Auth
- Lead/Account
- Activity/GPS
- Opportunity
- Contract/Collection
- Order/Fulfillment
- Ledger/Statement
- Account360/Dashboard/Ops

## 5. Gate C — Map Provider

현재 Source는 Provider-independent `MapAdapter` Boundary까지 구현되어 있고 실제 Provider는 미지정 상태다.

환경값 예:

```text
CRM_MAP_PROVIDER=<provider code>
CRM_MAP_PROBE_URL=<non-secret provider probe URL>
```

자동 Connectivity 검증:

```bash
node scripts/integration/external-readiness.mjs --strict
```

실제 업무 검증은 별도다.

- 좌표→지도 중심 이동
- 현재 위치 Marker
- 병원 Marker
- 200m GPS Rule과 지도표시 일치
- 주소/좌표 오차 검증
- Provider Domain/Key 제한 검증

Provider가 확정되지 않은 상태에서는 특정 Kakao/Google/Naver 구현을 임의로 넣지 않는다.

## 6. Gate D — ERP Test Integration

필요 환경값:

```text
CRM_ERP_BASE_URL=https://<erp-test>
CRM_ERP_HEALTH_PATH=/...
CRM_ERP_VALIDATION_TOKEN=<GitHub Environment Secret 또는 로컬 Secret>
```

Connectivity:

```bash
node scripts/integration/external-readiness.mjs --strict
```

업무 Transaction 검증은 UAT Test Data로 수행한다.

- ERP Account Request/Result
- Contract Request/Result
- Order Request/Result
- Delivery/Sales Result
- Collection Actual/Reconciliation
- 실패/Timeout/Retry/Circuit Breaker
- Interface Log/Audit 확인

운영 ERP 데이터나 Production Endpoint에는 본 Gate에서 연결하지 않는다.

## 7. GitHub Manual Environment Validation

`.github/workflows/environment-validation.yml`을 `workflow_dispatch`로 실행할 수 있다.

입력:

- target_environment: DEV/UAT
- web_base_url
- api_base_url
- map_provider / map_probe_url
- erp_base_url / erp_health_path
- strict_external

Workflow는 DB Migration을 실행하지 않는다. Migration 순서 검증과 Runtime/Connectivity Smoke만 수행한다.

## 8. 완료 기준

```text
Mobile/PWA Runtime Smoke       PASS
Physical Device Pilot         PASS
DEV Migration 001~009         PASS
DEV API/Web Smoke             PASS
UAT Migration 001~009         PASS
UAT API/Web Smoke             PASS
Map Provider Connectivity     PASS
Map Business Scenario         PASS
ERP Test Connectivity         PASS
ERP UAT Transaction           PASS
```

위 항목이 모두 충족되기 전에는 Production Cutover Gate로 이동하지 않는다.
