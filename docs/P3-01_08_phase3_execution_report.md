# Phase 3 Sales Activity 실행 보고서

## Status

`IMPLEMENTED / CI_PENDING / ENVIRONMENT_INTEGRATION_DEFERRED`

Phase 3 Work Package P3-01~P3-08의 Source Baseline을 구현했다. 실제 DEV DB Migration, 지도 Provider, ERP 직출/직퇴 Adapter는 환경 준비 후 연결한다.

## P3-01 Activity Plan
- 단건 활동계획 API
- 다건 활동계획 API (최대 100건)
- 동일 사용자 + 동일 대상 + 동일일자 중복계획 차단
- 방문일정 입력 시 Event 종료시간 = +1시간
- Event + Activity Master 동시 생성
- 직출/직퇴 선택 시 사유 필수

## P3-02 Calendar / Event
- 날짜 범위별 Calendar API
- Event와 Activity 상태를 함께 반환
- 권한 보유 관리자만 타 사용자 일정 조회 가능

## P3-03 Activity Map
- 오늘 활동계획 조회
- 현재 GPS 기준 주변 Lead/Account 병원 거리순 조회
- 반경 기본 10km, 최대 50km
- 현재 Baseline은 지도 Provider 독립적인 Map Data API이며 실제 지도 SDK는 추후 선택

## P3-04 GPS IN
- Phase 0 승인값 200m를 `crm_system_setting`으로 관리
- 병원 좌표와 현재 위치의 Haversine 거리 계산
- 설정 거리 초과 시 IN 차단
- 기존 IN_PROGRESS 활동이 있으면 신규 IN 차단
- 위치 정확도(`accuracyM`)와 Mock 여부(`isMocked`) 저장
- Mock/정확도 차단 정책은 GAP-002 확정 전까지 관찰 데이터로만 저장

## P3-05 상담정보 / OUT
- 상담내용/방문목적은 IN 이후 OUT 전까지만 수정
- OUT 완료 시 Activity=`COMPLETED`
- 완료 활동은 수정 차단
- 최종 승인된 활동보고에 포함된 활동은 수정 차단
- OUT 좌표/정확도/Mock 여부 기록

## P3-06 Activity Report
- 선택일 완료 활동을 RESULT로 구성
- 선택일 이후 5일 계획을 PLAN으로 구성
- Report Item Snapshot 저장
- DRAFT/REQUESTED 동안 보고용 방문목적/상담내용 편집 지원
- 승인요청 시 OUT 미완료(IN_PROGRESS) 활동 존재 여부 검증
- 승인요청 이후 생성된 활동은 기존 보고에 자동 추가되지 않음

## P3-07 지점장 / 본부장 승인
- 승인경로: 영업담당자 → 지점장 → 본부장
- 승인요청 시점의 지점장/본부장 사용자 ID를 Report에 Snapshot
- 지점장 승인 후 본부장 알림
- 본부장 승인 시 `FINAL_APPROVED`
- 승인 Action History 저장
- Approval Route 관리 API 추가

## P3-08 Direct Work / Direct Leave
- 활동계획에서 직출/직퇴 선택 시 `crm_direct_work` 생성
- 직출/직퇴 사유 필수
- 영업담당자 → 지점장 → 본부장 승인
- 지점장/본부장 반려 지원
- 반려 후 재요청 지원
- 동일 DirectWork Master를 유지하며 `approval_round`를 증가시켜 승인 이력 보존
- Activity OUT + 본부장 승인 모두 만족하면 ERP Interface Request(`IF-ERP-012`)를 `REQUESTING` 상태로 생성
- 실제 ERP Adapter가 연결되기 전까지 성공 처리하지 않음

## Phase 2 연계
Lead Convert 시 기존 Lead Activity 이관 요구를 Phase 3에서 연결했다.

`crm_lead_conversion_history` Insert 후 Trigger가 기존 Activity/Event의 연결 대상을 Lead → Account로 재연결한다.

## Database Baseline
- `database/migrations/003_phase3_activity.sql`
- `database/seeds/003_phase3_seed.sql`

신규/확장 주요 Table:
- crm_system_setting
- crm_approval_route
- crm_activity_event
- crm_activity
- crm_activity_report
- crm_activity_report_item
- crm_direct_work
- crm_approval_action

## Permissions
- ACTIVITY.READ
- ACTIVITY.WRITE
- ACTIVITY.MANAGE
- ACTIVITY.CHECKIN
- ACTIVITY.CHECKOUT
- ACTIVITY.REPORT
- ACTIVITY.REPORT.APPROVE.BRANCH
- ACTIVITY.REPORT.APPROVE.DIVISION
- DIRECT_WORK.READ
- DIRECT_WORK.REQUEST
- DIRECT_WORK.APPROVE.BRANCH
- DIRECT_WORK.APPROVE.DIVISION
- APPROVAL.ROUTE.MANAGE

## Frontend
- 활동계획
- 오늘 활동 / GPS IN / 상담정보 / OUT
- 주변 병원 거리조회
- 활동보고 준비 / 승인요청 / 지점장·본부장 승인
- 직출/직퇴 요청 / 승인 / 반려 / 재요청

## Deferred / External Dependencies
- Phase 1~3 SQL Migration 실제 DEV DB 적용
- 지도 Provider/지도 SDK 선택 및 지도 UI 고도화
- GAP-002 GPS Mock/정확도 차단 기준
- 실제 ERP IF-ERP-012 Transport/Response Adapter
- 승인경로 최초 Master 입력/ERP·인사조직 동기화
- 활동보고 반려 프로세스는 원 교육자료에서 명확히 정의되지 않아 Baseline에서 제외

## Phase 3 Gate
- [x] P3-01 Activity Plan Source Baseline
- [x] P3-02 Calendar/Event Source Baseline
- [x] P3-03 Map Data Source Baseline
- [x] P3-04 GPS IN Validation
- [x] P3-05 Consultation / OUT
- [x] P3-06 Activity Report
- [x] P3-07 Branch / Division Approval
- [x] P3-08 Direct Work / Direct Leave
- [x] Domain Rule Unit Test 추가
- [ ] GitHub Actions Build/Test PASS
- [ ] Human Domain Review

## Next after approval
`Phase 4 — Opportunity / Sales Pipeline`
