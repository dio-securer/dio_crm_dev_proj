# Phase 6 Order / Delivery / Sales / Return 실행 보고서

## Status

`IMPLEMENTED / CI_PENDING / HUMAN_REVIEW_PENDING / DB_MIGRATION_DEFERRED`

Phase 6 P6-01~P6-07 Source Baseline을 구현한다. 실제 ERP 주문/출고/매출/반품 Transport 및 DEV DB Migration은 환경 Gate로 유지한다.

## P6-01 Product Search
- `crm_product_package`를 주문용 Catalog로 재사용
- 품목명/ERP 품목코드/유형 검색
- 단가, 재고수량, 주문가능 여부 표시 필드 추가
- 실제 ERP 실시간 가격/재고 조회 방식은 GAP-015 및 ERP Interface 상세 확정 후 Adapter 연결

## P6-02 Cart / Quantity
- ERP 승인 Contract 기준 Order Draft 생성
- Order Item 추가/수정
- 수량은 양의 정수 검증
- 주문불가 품목은 ERP 제출 차단
- 품목 Snapshot(ERP code/name/type/category/unit price)을 Order Item에 보존

## P6-03 Delivery / Express
- 배송지 유형 `ACCOUNT` / `DIRECT`
- 거래처 주소 사용 또는 직접 배송지 입력
- 특송 여부
- 비고
- ERP 요청 전 배송지 필수 검증

## P6-04 ERP Order Request
- `ERP_APPROVED` + `close_yn=0` Contract만 주문 가능
- ERP 승인 Account 재검증
- 주문 품목 최소 1건
- IF-ERP-007 요청 payload Queue 생성
- 실제 ERP 성공을 가정하지 않고 Order/InterfaceLog를 `REQUESTING` 상태로 유지

## P6-05 Order / Delivery Status
- ERP 주문 결과에서 ERP 주문번호/상태 반영
- ERP Delivery 결과를 `erp_delivery_no` 기준 Idempotent Upsert
- 출고/납품 상태 및 일시 조회
- 배송 완료 결과 수신 시 Order 완료상태 반영 가능

## P6-06 Sales
- ERP 매출결과를 `erp_sales_no` 기준 Idempotent Upsert
- Account/Contract/Order 연결
- 매출일자, 금액, 품목, 수량 조회
- Account 360 및 Phase 7 Ledger/Analytics가 재사용할 수 있는 기준 데이터 제공

## P6-07 Return / Exchange
- ERP 반품/교환 결과를 `erp_reference_no` 기준 Upsert
- 유형 `RETURN` / `EXCHANGE`
- 상태/품목/수량/처리일 조회
- 교육자료에 정확한 반품/교환 요청·승인·취소 절차가 정의되지 않아 CRM 발신 Workflow는 임의 구현하지 않음
- Phase 6에서는 ERP 실행결과 수신/조회 Baseline만 구현

## Database Baseline
- `database/migrations/006_phase6_order_delivery_sales.sql`
- `database/seeds/006_phase6_seed.sql`

신규/확장:
- crm_product_package: 주문 단가/재고/주문가능/ERP Sync 시각
- crm_order
- crm_order_item
- crm_delivery
- crm_sales
- crm_return_exchange

## Backend
- `backend/src/modules/order/order.controller.ts`
- `backend/src/modules/order/order.service.ts`
- `backend/src/modules/order/order.rules.ts`
- `backend/src/modules/order/order.rules.spec.ts`

주요 API:
- `GET /api/order-products`
- `GET /api/orders/eligible-contracts`
- `POST /api/orders`
- `POST /api/orders/:id/items`
- `PATCH /api/orders/:id/delivery`
- `POST /api/orders/:id/submit`
- `GET /api/orders/:id/fulfillment`
- `GET /api/sales`
- `POST /api/erp-fulfillment/order-result`
- `POST /api/erp-fulfillment/deliveries`
- `POST /api/erp-fulfillment/sales`
- `POST /api/erp-fulfillment/return-exchanges`

## Frontend
- 주문 Workspace
- 주문가능 Contract 선택
- 품목/재고/단가 확인
- 수량/배송지/특송 설정
- ERP 주문 Queue 생성
- 납품/매출/반품·교환 통합현황

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
- [x] Domain Rule Unit Test 작성
- [ ] GitHub Actions Build/Test PASS
- [ ] Human Domain Review

## Next after approval
`Phase 7 — Ledger / Statement / Analytics`
