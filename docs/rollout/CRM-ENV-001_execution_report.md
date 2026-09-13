# CRM-ENV-001 — Environment Rollout 실행보고서

- Work ID: `CRM-ENV-001`
- Branch: `rollout/mobile-pwa-devuat-integration`
- 작성일: 2026-09-13
- 상태: `SOURCE_PREPARED / CI_PENDING / ENVIRONMENT_INPUTS_REQUIRED / PRODUCTION_NOT_TOUCHED`

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

- `pnpm env:check` 추가
- 기본 CI에서 environment tooling의 syntax/guard 동작을 검증

## 3. 실제 환경에서 아직 실행하지 않은 항목

아래 항목은 GitHub Source만으로 실제 실행할 수 없다.

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

## 4. 필요한 환경 입력

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

## 5. 안전 상태

- Production DB 변경 없음
- Production ERP 연결 없음
- 실제 DEV/UAT DB 변경 없음
- 실제 외부 Provider 호출 없음
- GitHub Secret 값 저장 없음

## 6. 다음 Gate

Source/CI가 PASS한 뒤 실제 Environment Execution은 다음 순서로 기록한다.

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
