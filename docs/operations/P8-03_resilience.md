# P8-03 Resilience

## Source Baseline
- ERP/HIRA 공통 InterfaceLog 유지
- Request ID 기반 추적
- Timeout / Retry
- Interface Code 단위 Circuit Breaker
- 실패 후 `FAILED`, 미연결 Adapter는 `REQUESTING` 상태를 유지하여 성공 위장 금지
- `/api/health/live`, `/api/health/ready` 분리
- Graceful shutdown hook 활성화

## Circuit Breaker 기본값
- Failure threshold: `INTERFACE_CIRCUIT_FAILURES=5`
- Reset window: `INTERFACE_CIRCUIT_RESET_MS=60000`

## 장애시 동작 원칙
1. CRM 업무 Transaction과 외부 ERP 실행을 분리한다.
2. 동일 업무 요청의 중복 외부처리는 Request/Business Key로 차단한다.
3. Timeout은 성공으로 간주하지 않는다.
4. Circuit OPEN 상태에서는 외부 시스템에 추가 부하를 주지 않는다.
5. 장애 해소 후 운영자가 InterfaceLog를 기준으로 재처리한다.
6. 실제 재처리 Queue/Dead-letter 운영정책은 ERP Adapter 확정 시 GAP-014와 함께 최종 확정한다.

## 환경 Gate
- ERP 장애 모의
- Network Timeout 모의
- Duplicate callback 모의
- Partial response / invalid payload 모의
- DB 재시작 중 API readiness 동작 확인
- App 재시작 후 미완료 Interface 처리정책 확인
