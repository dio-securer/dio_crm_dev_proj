# CRM-ENV-001 — Environment Rollout 실행보고서

- Work ID: `CRM-ENV-001`
- Branch: `rollout/mobile-pwa-devuat-integration`
- PR: `#11`
- 작성일: 2026-09-13
- 상태: `SOURCE_READY / CI_PASS / SOURCE_REVIEW_APPROVED / MAIN_MERGED / ENVIRONMENT_EXECUTION_PENDING / PRODUCTION_NOT_TOUCHED`

## 1. 사용자 요청 범위

`Mobile/PWA Pilot → DEV/UAT 적용 → 지도 Provider/ERP 연동 검증`

## 2. 이번 Source 실행에서 완료한 항목

### Mobile/PWA Pilot Tooling

- `scripts/pilot/mobile-pwa-readiness.mjs`
- HTTPS/App Shell/Manifest/Service Worker/API Cache Bypass 검증
- `/api/health/live`, `/api/health/ready` Runtime 검증
- 실제 단말 Pilot Matrix/Scenario/합격기준 문서화

### DEV/UAT Migration Guard

- `scripts/deploy/devuat-migration-plan.mjs`
- Migration 001~009 순서 자동 확인
- 기본 PLAN ONLY
- 실제 실행은 `--execute` + `CRM_ALLOW_DB_MUTATION=YES` 이중 Gate
- DEV/UAT 외 환경은 거부

### Map/ERP Readiness

- `scripts/integration/external-readiness.mjs`
- Map Provider 설정/Probe
- ERP Test Health Endpoint Connectivity Probe
- Secret Token은 환경변수로만 사용
- Connectivity와 Business Transaction 검증을 분리

### GitHub Manual Validation

- `.github/workflows/environment-validation.yml`
- DEV/UAT 선택형 Manual Workflow
- Source Build/Test/PWA Check
- Migration Plan 검증(실제 SQL 미실행)
- Runtime PWA Smoke
- Map/ERP Readiness

### CI

Source validation CI run `34734290400` PASS.
최종 current-head CI run `34734323621` PASS.

```text
pnpm install --no-frozen-lockfile  PASS
pnpm build                         PASS
pnpm test                          PASS
pnpm i18n:check                    PASS
pnpm i18n:hardcode                 PASS
pnpm pwa:check                     PASS
pnpm env:check                     PASS
pnpm audit:critical                PASS
```

`pnpm env:check`에서 Migration 001~009 순서, Mobile/PWA Readiness script의 non-runtime safe mode, Map/ERP Readiness script의 non-strict safe mode를 검증했다.

## 3. Source Review / Merge

사용자 Source Review 승인일: 2026-09-13

승인 범위:

- Mobile/PWA Pilot readiness tooling
- DEV/UAT Migration 001~009 guarded execution plan
- Map Provider / ERP Test connectivity validation tooling
- Manual environment validation workflow
- Rollout runbook / execution report

PR #11을 `main`에 병합했다.

```text
Final PR Head : 9c9a263682362b817e7a1aa463a66652fabdef4a
Merge Commit  : e0a57e661c63460ab373bbb842cb63182fc84de2
```

이 승인은 Source/Tooling Baseline 승인이다. 실제 DEV/UAT DB 적용, 실제 단말 Pilot, 지도 Provider 연결, ERP Test Transaction 완료를 의미하지 않는다.

## 4. 실제 환경에서 아직 실행하지 않은 항목

```text
Physical Android/iOS Pilot
DEV SQL Server Migration
UAT SQL Server Migration
DEV/UAT Web/API Deployment
Actual Map Provider API/SDK Connectivity
ERP Test Endpoint Connectivity
ERP UAT Business Transaction
```

실제 성공으로 기록하려면 환경 접속정보/배포 URL/단말/Provider/ERP Test 정보가 필요하다.

## 5. 필요한 환경 입력

### Mobile/PWA

```text
DEV 또는 UAT HTTPS Web URL
DEV 또는 UAT API URL
Android Pilot 단말
iOS Pilot 단말(지원 대상이면)
Pilot 사용자 계정
```

### DEV/UAT DB

```text
Server
Port
Database
User/Auth Method
Password/Secret
Backup/Snapshot 확보 여부
sqlcmd 실행 가능 Host
```

### Map

```text
Provider 확정값
Test API Key/Client ID
허용 Domain
Probe URL 또는 SDK Loading URL
```

### ERP Test

```text
ERP Test Base URL
Health/Connectivity Path
인증 방식
Test Credential/Token
Account/Contract/Order Test Data
```

## 6. 안전 상태

- Production DB 변경 없음
- Production ERP 연결 없음
- 실제 DEV/UAT DB 변경 없음
- 실제 외부 Provider 호출 없음
- GitHub Secret 값 저장 없음

## 7. 다음 Environment Gate

Source/CI는 승인 및 main 병합 완료됐다. 실제 Environment Execution은 다음 순서로 진행한다.

1. DEV/UAT HTTPS Endpoint 확보
2. Runtime Mobile/PWA Smoke
3. Physical-device Pilot
4. Backup/Snapshot 확인
5. DEV Migration 001~009 + Smoke
6. UAT Migration 001~009 + Smoke
7. Map Provider Connectivity + Business Scenario
8. ERP Test Connectivity + UAT Transaction
9. Environment Review

Production Cutover는 별도 승인 Gate다.
