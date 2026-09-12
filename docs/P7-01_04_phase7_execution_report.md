# Phase 7 Ledger / Statement / Account 360 / Analytics 실행 보고서

## Status

`APPROVED / CI_PASS / HUMAN_REVIEW_APPROVED / DB_MIGRATION_DEFERRED`

Phase 7 P7-01~P7-04 Source Baseline 구현, GitHub Actions Build/Test 검증, Human Domain Review를 완료했다. 영업 판매프로세스 교육자료의 패키지원장, 월합 거래명세서, 거래처 360, 현황분석 요구를 기준으로 한다.

## P7-01 Package Ledger
- 거래처 기준 패키지 계약 선택 또는 일반 거래내역 선택
- 매출 / 실수금 / 반품·교환 결과를 시간순 Ledger Row로 통합
- 기간 필터
- 패키지 계약 요약 / 매출합계 / 수금합계 / 반품·교환 건수
- PC용 XLSX 다운로드 구현 (`exceljs`)

교육자료 반영:
- 거래처 상세에서 패키지원장 조회
- 패키지 선택 조회
- 일반 거래내역 조회
- 상세 거래내역
- Excel 다운로드(PC)

## P7-02 Monthly Statement
- 기본 조회기간: 지난 달
- 조회 시작일: 2018-01-01 이후만 허용
- 패키지 계약 또는 일반 거래내역 선택
- 거래내역 미리보기
- PC: 선택 Sales 행만 PDF 생성 가능
- Mobile: 전체 내역 PDF만 생성
- PDF 파일명: `YYYY-MM_월합_거래명세서_계약번호.pdf` 형식
- `pdfkit` 기반 PDF 다운로드 구현
- `crm_statement_generation` 생성 이력 저장

현재 File Storage Adapter가 실제 저장소에 연결되지 않았으므로 PDF bytes 영구저장은 임의 성공처리하지 않는다. `storage_status=NOT_STORED`로 생성이력을 남기고 다운로드를 제공한다. 실제 모바일 파일섹션 저장은 Storage Adapter 연결 후 확장한다.

한글 PDF 폰트는 배포환경의 `DIO_CRM_PDF_FONT` 경로로 주입 가능하게 구현했다. Font가 없으면 안전한 ASCII fallback을 사용한다.

## P7-03 Account 360
거래처 한 화면에서 다음 Read Model을 통합한다.
- 기본 거래처/담당자/조직
- Contact
- Opportunity / Contract
- Sales / Collection
- Order / Delivery / ReturnExchange
- Activity
- 현황분석 요약

교육자료의 Service(고객센터 문의접수)는 현재 별도 Domain/Table이 없으므로 `available=false`로 명확히 표시하고 데이터를 임의 생성하지 않는다.

## P7-04 Dashboard
전사 관점 분석 API/UI:
- Lead 상태
- Activity 상태
- Opportunity Pipeline / Weighted Amount
- Contract 상태/금액
- Order 상태
- Sales 합계
- Collection 합계
- 매출 Top Account
- 선택 기간 필터

## Database Baseline
- `database/migrations/007_phase7_analytics.sql`
- `database/seeds/007_phase7_seed.sql`

신규:
- `crm_statement_generation`

권한:
- LEDGER.READ
- LEDGER.EXPORT
- STATEMENT.READ
- STATEMENT.EXPORT
- ACCOUNT360.READ
- ANALYTICS.READ

## Backend
- `backend/src/modules/analytics/analytics.controller.ts`
- `backend/src/modules/analytics/analytics.service.ts`
- `backend/src/modules/analytics/analytics.rules.ts`
- `backend/src/modules/analytics/analytics.rules.spec.ts`

주요 API:
- `GET /api/analytics/accounts/:accountId/contracts`
- `GET /api/analytics/accounts/:accountId/ledger`
- `GET /api/analytics/accounts/:accountId/ledger.xlsx`
- `GET /api/analytics/accounts/:accountId/statements`
- `POST /api/analytics/accounts/:accountId/statements/pdf`
- `GET /api/analytics/accounts/:accountId/360`
- `GET /api/analytics/dashboard`

## Frontend
- `LedgerStatementsPage` — 패키지원장 / 월합 거래명세서
- `Account360Page` — Account 360
- `AnalyticsDashboardPage` — 영업 분석 Dashboard

## CI Result
GitHub Actions Build/Test PASS.
- pnpm install: PASS
- shared contracts build: PASS
- NestJS backend build: PASS
- React/Vite frontend build: PASS
- Jest / Phase 7 Domain Rule tests: PASS

초기 CI에서 동적 SQL Read Model의 TypeScript row type이 `unknown`으로 추론되는 오류가 발견되어 `DatabaseService.query<T = any>` 기본 타입을 명시적으로 부여한 뒤 재검증했다.

## Human Domain Review
사용자 승인일: 2026-09-12

승인 범위:
- Package Ledger / XLSX
- Monthly Statement / PDF
- Account 360
- Analytics Dashboard

결정: Phase 7 업무 Source Baseline을 승인하고 `main` 병합 후 Phase 8 Hardening / Rollout으로 진행한다.

## Deferred / Open
- Phase 1~7 SQL Migration 실제 DEV DB 적용
- Statement PDF 실제 File Storage 영구저장 / Account File Section 연결
- 배포환경 한글 PDF Font 설정
- Customer Center / Service Domain
- 실제 ERP Transport / Product·가격·재고 Sync
- 주문취소/정정 및 반품/교환 발신 Workflow

## Phase 7 Gate
- [x] P7-01 Package Ledger Source Baseline
- [x] P7-02 Monthly Statement Source Baseline
- [x] P7-03 Account 360 Source Baseline
- [x] P7-04 Dashboard Source Baseline
- [x] XLSX / PDF Export Source 구현
- [x] Domain Rule Unit Test 작성
- [x] GitHub Actions Build/Test PASS
- [x] Human Domain Review

## Next
`Phase 8 — Hardening / Rollout`
