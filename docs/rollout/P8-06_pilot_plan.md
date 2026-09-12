# P8-06 Pilot Plan

## 목적
전사 Cutover 전에 제한된 사용자/조직에서 실제 업무 흐름과 ERP 연동을 검증한다.

## Pilot 범위 제안
- 1개 지점 또는 소수 영업담당자
- 지점장/본부장 승인자 포함
- 영업관리/CRM 관리자 포함
- 실제 ERP Test/UAT 환경 사용

## 선행조건
- Phase 1~8 Migration을 DEV/UAT DB에 실제 적용 및 검증
- ERP API/SP/Auth/Payload 확정 및 Adapter 연결
- Product/가격/재고 Sync 확정
- File Storage/PDF Font 설정
- Production 수준 Secret/CORS/TLS 설정
- Backup + Restore Drill 성공
- 사용자/조직 ERP Sync 검증

## Pilot 핵심 시나리오
1. 심평원 병원 수신 → Lead 자동할당
2. Lead 상태진행 → Convert → Account/Contact/Opportunity
3. 활동계획 → GPS IN → 상담 → OUT
4. 활동보고 → 지점장 → 본부장 승인
5. 직출/직퇴 승인 → ERP 전송
6. Opportunity → Closed Won → Contract
7. 수금계획 → ERP 계약승인 → 실제수금 반영
8. 주문 → ERP 주문/출고 → 매출
9. 원장/거래명세서/Account 360/Dashboard 확인
10. 실패 Interface 재처리 및 운영상태 확인

## Smoke Script
```bash
CRM_BASE_URL=https://uat-crm.example.com \
CRM_ACCESS_TOKEN=<pilot-admin-token> \
node scripts/smoke/pilot-smoke.mjs
```

## Acceptance Criteria
- Critical/High 업무결함 0건
- 데이터 중복/유실 0건
- ERP 중복전송 0건
- 승인경로 오류 0건
- GPS/활동 주요 Negative Case 정상 차단
- Backup/Restore 검증 완료
- 합의된 API p95 / DB 자원 기준 충족
- 사용자 교육 및 운영담당자 Runbook 확인 완료

## 종료판정
- `GO`: Cutover 준비 가능
- `CONDITIONAL GO`: 경미한 개선사항만 존재하고 Cutover 위험 없음
- `NO-GO`: 데이터 정합성, ERP, 승인, 보안, 복구 중 하나라도 중대한 미해결 이슈 존재

현재 저장소 단계에서는 Pilot 계획/Smoke Source까지만 완료하며 실제 Pilot 실행은 환경 Gate로 남긴다.
