# P8-07 Cutover Runbook

## 목적
Pilot 승인 후 CRM 운영전환을 예측가능하고 Rollback 가능한 절차로 수행한다.

## Go / No-Go Gate
다음이 모두 `GO`여야 Production Cutover를 시작한다.
- Product Owner / IT / ERP 담당 승인
- Phase 8 Pilot 결과 GO
- Production Secret / TLS / CORS / Network 검증
- DB Full Backup + VERIFYONLY PASS
- Restore Drill PASS 및 RTO/RPO 기록
- ERP Interface Test PASS
- Migration Dry-run PASS
- Monitoring/Alert 수신 확인
- 운영담당자/Helpdesk 연락망 확정

## Cutover 순서
1. 변경 Freeze 공지
2. Source Release Tag/Commit 고정
3. Production DB Backup + VERIFYONLY
4. Application 유지보수모드 또는 사용자 접근통제
5. DB Migration `001` → `008` 순차 적용
6. Seed 적용 및 Role/Permission 확인
7. ERP User/Organization Master Sync
8. Product/가격/재고 초기 Sync
9. Backend 배포 + `/api/health/live`, `/ready` 확인
10. Frontend 배포
11. `pilot-smoke.mjs` Production Smoke
12. 핵심 업무 1건 E2E 검증
13. Monitoring / InterfaceLog / Audit 확인
14. 사용자 접근 오픈
15. Hyper-care 시작

## Rollback Trigger
- Migration 오류 또는 데이터 손상
- 인증/권한 장애
- ERP 중복전송/금액오류
- 주요 영업활동 저장 실패
- DB 성능이 합의 임계치를 지속 초과
- 복구 불가능한 Critical 오류

## Rollback 절차
1. 신규 사용자 접근 차단
2. ERP Outbound 중지
3. 장애시점/요청ID/영향범위 기록
4. Application 이전 Release로 복귀
5. DB 변경이 비호환이면 Pre-Cutover Backup으로 Restore 결정
6. ERP 측 중복/부분처리 Transaction 대사
7. Smoke/Readiness 확인
8. 사용자 및 경영진에 상태 공유

## Cutover 이후 24~72시간 Hyper-care
- Failed/Stuck Interface 집중 확인
- SQL CPU/IO/Blocking/Slow Query 확인
- API Error/Slow Request 확인
- Sales/Collection/Order 금액 대사
- Activity 승인/직출직퇴 누락 확인
- 사용자 이슈 Daily Triage

## 중요
이 Runbook은 실행 Source이다. 현재 대화에서는 Production 접속정보/DB/ERP가 없으므로 실제 Cutover를 실행하거나 완료로 표시하지 않는다. Production Cutover는 명시적인 Production Gate 승인 후 수행한다.
