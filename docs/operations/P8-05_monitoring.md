# P8-05 Monitoring

## 제공 Monitoring Endpoint
- `GET /api/health/live`: Process Liveness, DB 비의존
- `GET /api/health/ready`: DB 연결 포함 Readiness
- `GET /api/ops/status`: `OPS.READ` 권한 필요

## `/api/ops/status` 주요 지표
- Application Version / Uptime / NODE_ENV
- SQL Connection 상태 / Pool / Request Timeout
- ERP Interface SUCCESS / FAILED 24시간 건수
- 15분 이상 `REQUESTING` 상태인 Stuck Interface 건수
- ERP 주요 Circuit Breaker 상태
- 24시간 Audit 건수
- Node RSS / Heap 사용량

## Alert Baseline
실제 관제도구 연결 전 아래 기준을 후보로 사용하고 UAT에서 조정한다.
- Readiness 실패: 즉시 Critical
- Stuck REQUESTING > 0: Warning, 15분 이상 지속 시 Critical 검토
- ERP FAILED 급증: 최근 정상 Baseline 대비 임계값 설정
- API p95 증가: Performance Baseline 대비 경보
- SQL CPU/Memory/IO/Blocking: DB 관제와 연동
- Node RSS 지속 증가: Memory leak 점검

## Log 원칙
- Request ID로 API / Audit / Interface Log를 연계
- Password/JWT/Authorization Header/민감 Payload를 로그에 남기지 않음
- Slow Request/Slow Query는 시간과 경로/SQL 요약만 기록
- 운영 로그 보존기간은 보안/감사정책 확정 후 적용

## 미연결
Azure Monitor, CloudWatch, Prometheus/Grafana, 사내 관제 등 실제 외부 Monitoring Adapter는 배포환경 선택 후 연결한다.
