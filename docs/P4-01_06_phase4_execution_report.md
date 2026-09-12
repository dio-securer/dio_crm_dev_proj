# Phase 4 Opportunity / Sales Pipeline 실행 보고서

## Status

`IMPLEMENTED / CI_PASS / HUMAN_REVIEW_PENDING / DB_MIGRATION_DEFERRED`

Phase 4 P4-01~P4-06 Source Baseline 구현과 GitHub Actions Build/Test 검증을 완료했다. 운영/DEV DB에는 Migration을 아직 적용하지 않는다.

## P4-01 Opportunity CRUD
- Lead Convert 생성 Opportunity와 기존 Account 신규 Opportunity를 동일 Domain에서 관리
- 목록/상세/생성/수정
- Delete는 물리삭제가 아닌 Logical Archive로 처리하고 History를 유지
- Contract 생성 이후 Opportunity 수정/Archive 잠금

## P4-02 Stage Management
- `NEEDS_ANALYSIS → PROPOSAL → NEGOTIATION → CLOSED_WON / CLOSED_LOST`
- Open 단계는 앞/뒤 이동 가능
- 역전이 시 사유 필수
- CLOSED_LOST 재오픈은 `OPPORTUNITY.STAGE.REOPEN` 권한 필요
- CLOSED_WON 재오픈은 동일 권한 + Contract 미생성 조건
- 모든 단계변경은 `crm_opportunity_stage_history` 저장

## P4-03 Product / Package
- Product/Package Catalog Foundation
- ERP 품목코드 연결 필드 보유
- Opportunity Product 추가/수정/삭제
- 수량 × 제안단가 합계로 Opportunity Amount 자동계산
- 실제 ERP Product/Package Sync 방식은 GAP-015 확정 후 Adapter 연결

## P4-04 Negotiation Information
- 예상마감일
- 성공확률
- Forecast Category
- 관심품목
- 특약조건
- 결제방법/결제일/할부개월
- 경쟁사 사용현황
- 보유장비
- 진료비 관련정보

## P4-05 Closed Won Validation
- Closed Won 변경 시 Account의 `erp_approved_yn=1` 필수
- ERP 미승인 Account는 Closed Won 차단
- Opportunity Approval 프로세스는 GAP-009가 아직 미확정이므로 임의 구현하지 않음
- Contract 생성/수금계획은 Phase 5 범위

## P4-06 Pipeline / Funnel
- Stage별 Opportunity Count
- Stage별 Amount
- 성공확률 기반 Weighted Amount
- Forecast Category별 Count/Amount
- 담당자/예상마감일 기간 필터 API 기반

## Database Baseline
- `database/migrations/004_phase4_opportunity.sql`
- `database/seeds/004_phase4_seed.sql`

신규/확장:
- crm_opportunity 확장
- crm_opportunity_stage_history
- crm_product_package
- crm_opportunity_product

## Backend
- `backend/src/modules/opportunity/opportunity.controller.ts`
- `backend/src/modules/opportunity/opportunity.service.ts`
- `backend/src/modules/opportunity/opportunity.rules.ts`
- `backend/src/modules/opportunity/opportunity.rules.spec.ts`

## Frontend
- Opportunity Workspace
- 단계변경
- 제안 패키지/제품
- Pipeline/Funnel

## CI Result
GitHub Actions Run `34674235441` PASS.
- pnpm install: PASS
- shared contracts build: PASS
- NestJS backend build: PASS
- React/Vite frontend build: PASS
- Jest tests: PASS
- Opportunity Domain Rule tests: PASS

초기 CI에서 Phase 3 `ActivityCalendarItem` 공유타입이 누락된 회귀를 검출했고, 기존 Phase 3 contract를 보존하도록 수정한 뒤 최종 PASS했다.

## Deferred / Open
- Phase 1~4 SQL Migration 실제 DB 적용
- GAP-009 Opportunity 관리자 승인 조건/프로세스
- GAP-015 ERP Product/Package Master Sync
- Phase 5 Contract 생성 후 `contract_created_yn` 연결

## Phase 4 Gate
- [x] P4-01 Opportunity CRUD Source Baseline
- [x] P4-02 Stage Management
- [x] P4-03 Product / Package
- [x] P4-04 Negotiation Information
- [x] P4-05 Closed Won Validation
- [x] P4-06 Pipeline / Funnel
- [x] Domain Rule Unit Test
- [x] GitHub Actions Build/Test PASS
- [ ] Human Domain Review

## Next after approval
`Phase 5 — ERP Account / Contract / Collection`
