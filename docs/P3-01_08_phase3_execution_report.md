# Phase 3 Sales Activity 실행 보고서

## Status

`IMPLEMENTED / CI_PASS / HUMAN_REVIEW_PENDING / ENVIRONMENT_INTEGRATION_DEFERRED`

Phase 3 Work Package P3-01~P3-08의 Source Baseline 구현과 GitHub Actions Build/Test 검증을 완료했다. 실제 DEV DB Migration, 지도 Provider, ERP 직출/직퇴 Adapter는 환경 준비 후 연결한다.

## P3-01 Activity Plan
- 단건/다건 활동계획 API
- 동일 사용자 + 동일 대상 + 동일일자 중복계획 차단
- Event 종료시간 = 방문일정 + 1시간
- Event + Activity Master 동시 생성
- 직출/직퇴 선택 시 사유 필수

## P3-02 Calendar / Event
- 날짜 범위 Calendar API
- Event + Activity 상태/직출직퇴 상태 반환
- 권한 보유 관리자만 타 사용자 조회

## P3-03 Activity Map
- 오늘 활동계획
- GPS 기준 주변 Lead/Account 거리순 조회
- Provider 독립 Map Data API
- 실제 지도 SDK는 환경결정 후 연결

## P3-04 GPS IN
- `ACTIVITY_GPS_IN_DISTANCE_M=200` 설정값 적용
- Haversine 거리검증
- 200m 초과 IN 차단
- 기존 IN_PROGRESS 활동 존재 시 신규 IN 차단
- GPS accuracy / Mock 여부 저장
- GAP-002 확정 전 Mock/accuracy 자체로 차단하지 않음

## P3-05 Consultation / OUT
- IN 이후 OUT 전 상담내용/방문목적 수정
- OUT → `COMPLETED`
- 완료 활동 수정 차단
- 최종 승인 보고 포함 활동 수정 차단
- OUT GPS 기록

## P3-06 Activity Report
- 선택일 완료 활동 = RESULT
- 이후 5일 활동계획 = PLAN
- Report Item Snapshot
- DRAFT/REQUESTED 단계 보고내용 편집
- IN_PROGRESS 활동이 있으면 승인요청 차단
- 승인요청 이후 생성 활동은 해당 보고에 자동 추가하지 않음

## P3-07 Branch / Division Approval
- 영업담당자 → 지점장 → 본부장
- 승인요청 시 approver Snapshot
- 지점장 승인 → 본부장 Notification
- 본부장 승인 → `FINAL_APPROVED`
- 승인 Action History
- Approval Route 관리 API

## P3-08 Direct Work / Direct Leave
- 활동계획과 함께 DirectWork Master 생성
- 사유 필수
- 지점장/본부장 승인 및 반려
- 반려 후 재요청
- 동일 Master + `approval_round` 증가로 이력 보존
- Activity OUT + 본부장 승인 조건 충족 시 `IF-ERP-012` 요청을 `REQUESTING`으로 Queue
- 실제 ERP Adapter 연결 전 성공 처리하지 않음

## Phase 2 연계
Lead Convert 이후 기존 Lead Activity/Event를 Account로 재연결하도록 `crm_lead_conversion_history` Trigger를 추가했다.

## Database Baseline
- `database/migrations/003_phase3_activity.sql`
- `database/seeds/003_phase3_seed.sql`

주요 Table:
- crm_system_setting
- crm_approval_route
- crm_activity_event
- crm_activity
- crm_activity_report
- crm_activity_report_item
- crm_direct_work
- crm_approval_action

## Frontend
- 활동계획
- GPS IN / 상담정보 / OUT
- 주변 병원 거리조회
- 활동보고 / 승인
- 직출/직퇴 요청 / 승인 / 반려 / 재요청

## CI Result
GitHub Actions Run `34670057378` PASS.
- pnpm install: PASS
- shared contracts / backend / frontend build: PASS
- Jest tests: PASS
- Activity Domain Rule tests: PASS

## Deferred / Open
- Phase 1~3 SQL Migration 실제 DEV DB 적용
- 지도 Provider/SDK 선택
- GAP-002 GPS Mock/정확도 차단 기준
- GAP-005 활동보고 반려/재요청 프로세스
- 실제 ERP IF-ERP-012 Adapter
- 승인경로 최초 Master 입력/조직 Sync

## Phase 3 Gate
- [x] P3-01~P3-08 Source Baseline
- [x] Domain Rule Unit Test
- [x] GitHub Actions Build/Test PASS
- [ ] Human Domain Review

## Next after approval
`Phase 4 — Opportunity / Sales Pipeline`
