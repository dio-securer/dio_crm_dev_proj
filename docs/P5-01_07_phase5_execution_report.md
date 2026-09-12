# Phase 5 ERP Account / Contract / Collection 실행 보고서

## Status

`IMPLEMENTED / CI_PENDING / HUMAN_REVIEW_PENDING / DB_MIGRATION_DEFERRED`

Phase 5 P5-01~P5-07 Source Baseline 구현을 완료한다. 실제 ERP Transport/API/SP 상세와 DEV DB Migration은 별도 환경 Gate로 유지한다.

## P5-01 ERP Account Request
- Account 필수정보 검증 후 IF-ERP-002 Queue 생성
- 중복 REQUESTING 방지
- ERP 성공결과에서 `erp_customer_code`, `erp_approved_yn`, `integration_status` 반영
- 실제 ERP 성공을 가정하지 않고 InterfaceLog `REQUESTING`까지만 생성

## P5-02 Contract
- `CLOSED_WON` Opportunity만 Contract 생성 가능
- ERP 승인 Account 필수
- Opportunity Product 최소 1건 필수
- Opportunity당 Contract 1회
- Contract 생성 시 Opportunity Product를 Contract Product Snapshot으로 복사
- Contract 생성 후 `contract_created_yn=1`로 Opportunity 잠금
- 제품금액 + 상품금액 = Opportunity 금액 검증

## P5-03 Initial Collection Plan
- 최초 수금계획 1..N 작성
- 계획합계 = 계약금액 검증
- ERP 계약 요청 후 최초계획 수정 차단
- ERP 승인 성공 시 최초계획 `locked_yn=1`

## P5-04 ERP Contract Registration
- Account ERP 승인여부 재검증
- Current Collection Plan 합계 재검증
- 계약/상품 Snapshot/수금계획을 IF-ERP-004 payload로 Queue
- Contract 상태 `ERP_REQUESTED`, Integration `REQUESTING`

## P5-05 ERP Contract Result
- ERP 승인 성공: `ERP_APPROVED`, ERP 계약번호, 승인일시 반영
- ERP 실패: `ERP_FAILED`, Integration `FAILED`
- requestId가 제공되면 InterfaceLog 응답상태 동기화

## P5-06 Actual Collection
- ERP 수금내역을 `erp_collection_no` 기준 Upsert
- Contract별 실제수금 합계 / 현재계획 / 연체계획 / 미수금 계산
- 현재일까지의 계획금액보다 실수금이 적으면 `correctionRequired` 표시
- 동일 ERP 수금번호 재수신 시 중복 Insert 방지

## P5-07 Arrears / Collection Plan Change
- ERP 승인 Contract에서만 변경계획 작성
- 변경계획 총액 = 남은 미수금 전액 검증
- 기존 Current Plan을 보존하고 `plan_version` 증가
- 변경계획은 `ARREARS_REALLOCATION`으로 이력 보존
- IF-ERP-011 Queue 생성 후 `erp_sync_status=REQUESTING`

## Database Baseline
- `database/migrations/005_phase5_contract_collection.sql`
- `database/seeds/005_phase5_seed.sql`

신규/확장:
- crm_account ERP 요청 추적 컬럼
- crm_contract
- crm_contract_product
- crm_collection_plan (Versioned)
- crm_collection_actual

## Backend
- `backend/src/modules/contract/contract.controller.ts`
- `backend/src/modules/contract/contract.service.ts`
- `backend/src/modules/contract/contract.rules.ts`
- `backend/src/modules/contract/contract.rules.spec.ts`
- `backend/src/integration/interface.service.ts` — 실제 Adapter 미연결 상태를 위한 `enqueuePending`

## Frontend
- Account ERP 등록요청 Action
- Contract / Collection Workspace
- Closed Won Opportunity → Contract 생성
- 최초 수금계획
- ERP 계약 등록요청
- 수금대사 조회

## Deferred / Open
- Phase 1~5 SQL Migration 실제 DEV DB 적용
- GAP-012/013 실제 ERP API/SP/DB 방식, 인증, Payload, 오류코드
- GAP-014 Retry/Dead-letter/운영자 재처리 상세
- GAP-015 Product/Package ERP Master Sync
- 실제 IF-ERP-002/003/004/005/009/011 Transport Adapter
- 수금계획 세부 ERP 식별키/회차 Mapping

## Phase 5 Gate
- [x] P5-01 ERP Account Request
- [x] P5-02 Contract
- [x] P5-03 Initial Collection Plan
- [x] P5-04 ERP Contract Registration Queue
- [x] P5-05 ERP Contract Result Handler
- [x] P5-06 Actual Collection
- [x] P5-07 Arrears / Plan Change
- [x] Domain Rule Unit Test 작성
- [ ] GitHub Actions Build/Test PASS
- [ ] Human Domain Review

## Next after approval
`Phase 6 — Order / Delivery / Sales / Return`
