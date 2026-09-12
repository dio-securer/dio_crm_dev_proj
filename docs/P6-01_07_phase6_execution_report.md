# Phase 6 Order / Delivery / Sales / Return 실행 보고서

## Status

`APPROVED / CI_PASS / HUMAN_REVIEW_APPROVED / DB_MIGRATION_DEFERRED`

Phase 6 P6-01~P6-07 Source Baseline 구현과 GitHub Actions Build/Test 검증을 완료했고, 2026-09-12 사용자 Human Domain Review 승인을 받았다. 실제 ERP 주문/출고/매출/반품 Transport 및 DEV DB Migration은 환경 Gate로 유지한다.

## 승인 범위
- P6-01 Product Search / 가격·재고 Read Model
- P6-02 Cart / Quantity / Order Item
- P6-03 Delivery Address / Express
- P6-04 ERP Order Request Queue
- P6-05 Order / Delivery Status
- P6-06 Sales
- P6-07 Return / Exchange ERP Result Read Model

## 핵심 업무규칙
- `ERP_APPROVED` + `close_yn=0` Contract만 Order Draft/ERP 주문요청 가능
- ERP 승인 Account 재검증
- 주문 품목 최소 1건 필요
- 주문불가 품목은 ERP 제출 차단
- 실제 ERP Transport 미연결 상태에서는 외부 성공을 가정하지 않고 `REQUESTING` 유지
- Delivery/Sales/ReturnExchange 수신은 ERP 고유번호 기준 Idempotent Upsert
- 반품/교환의 CRM 발신 요청·승인·취소 Workflow는 원본 교육자료에 확정되지 않아 임의 구현하지 않음

## Database Baseline
- `database/migrations/006_phase6_order_delivery_sales.sql`
- `database/seeds/006_phase6_seed.sql`
- `crm_product_package` 주문단가/재고/주문가능 필드 확장
- `crm_order`, `crm_order_item`, `crm_delivery`, `crm_sales`, `crm_return_exchange`

## Backend / Frontend
- `backend/src/modules/order/*`
- 주문 Workspace
- 납품/매출/반품·교환 통합현황

## CI Result
GitHub Actions Build/Test PASS.
- pnpm install: PASS
- shared contracts build: PASS
- NestJS backend build: PASS
- React/Vite frontend build: PASS
- Jest / Phase 6 Domain Rule tests: PASS

## Deferred / Open
- Phase 1~6 SQL Migration 실제 DEV DB 적용
- GAP-012/013 실제 ERP API/SP/DB 방식, 인증, Payload, 오류코드
- GAP-014 Retry/Dead-letter/운영자 재처리 상세
- GAP-015 ERP Product/Package/가격/재고 Sync 방식
- 주문취소/정정 업무규칙
- 반품/교환 CRM 요청/승인/취소 역할분담
- 실제 IF-ERP-006/007/008/010/014 Transport Adapter

## Phase 6 Gate
- [x] P6-01 Product Search Source Baseline
- [x] P6-02 Cart / Quantity
- [x] P6-03 Delivery / Express
- [x] P6-04 ERP Order Request Queue
- [x] P6-05 Order / Delivery Status
- [x] P6-06 Sales
- [x] P6-07 Return / Exchange inbound/read model
- [x] Domain Rule Unit Test
- [x] GitHub Actions Build/Test PASS
- [x] Human Domain Review — 사용자 승인 2026-09-12

## Next
`Phase 7 — Ledger / Statement / Account 360 / Analytics`
