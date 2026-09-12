# P8-02 Performance Hardening

## Source Baseline
- SQL Server Connection Pool 최대값 환경설정화
- DB Connect/Request Timeout 환경설정화
- Slow Query Threshold (`CRM_DB_SLOW_QUERY_MS`) 이상 요청 로그
- Slow HTTP Threshold (`SLOW_REQUEST_MS`) 이상 요청 로그
- Lead/Account/Opportunity/Interface/Audit/Notification 주요 조회 인덱스 Migration 추가
- 부하 Smoke Script `scripts/perf/perf-smoke.mjs`

## 권장 초기 운영값
- `CRM_DB_POOL_MAX=20`
- `CRM_DB_CONNECT_TIMEOUT_MS=10000`
- `CRM_DB_REQUEST_TIMEOUT_MS=30000`
- `CRM_DB_SLOW_QUERY_MS=1500`
- `SLOW_REQUEST_MS=2000`

이 값들은 운영 확정치가 아니라 초기 Baseline이다. 실제 동시사용자, DB CPU/IO, Query Store 결과를 기준으로 재조정한다.

## 검증 명령 예시
```bash
CRM_BASE_URL=https://crm.example.com \
CRM_PERF_PATH=/api/health/live \
CRM_PERF_REQUESTS=500 \
CRM_PERF_CONCURRENCY=25 \
CRM_PERF_MAX_P95_MS=500 \
node scripts/perf/perf-smoke.mjs
```

## 운영 성능 Gate
- 주요 사용자 API p95 목표값 합의
- DB CPU / Memory / IO Baseline 확보
- SQL Server Query Store / Actual Plan로 Top Query 점검
- Deadlock/Blocking 현황 점검
- 대량 데이터 기준 Paging / Export 검증
- ERP 연동 Timeout/동시성 테스트

실제 성능수치는 DEV/UAT 환경 실행 전에는 PASS로 간주하지 않는다.
