# Phase 2 Customer / Lead / Account 실행 보고서

## Status

`IMPLEMENTED / CI_PASS / HUMAN_DOMAIN_REVIEW_PENDING / ENVIRONMENT_INTEGRATION_DEFERRED`

Phase 2 Work Package P2-01~P2-07의 소스 Baseline 구현과 GitHub Actions Build/Test를 완료했다. 실제 DEV DB Migration 및 심평원/ERP 실연동은 환경 준비 후 연결한다.

## P2-01 심평원 신규병원 수신
- `/api/integrations/hira/hospitals/import`
- 최대 500건 Batch 입력
- `crm_hira_hospital_inbox` 원문 Payload 보관
- 암호화요양기호 기준 Lead 신규/갱신
- 심평원 갱신 제외 플래그 지원
- 실제 심평원 Transport/API/Batch 방식은 GAP-016 확정 후 Adapter 연결

## P2-02 Lead 관리
- Lead 목록/상세/수정 API
- 병원명/사업자번호 검색
- Owner/Status 필터
- 본인 소유 또는 LEAD.MANAGE 권한 기준 수정
- CONVERTED Lead 수정 차단
- Frontend Lead Workspace 추가

## P2-03 담당자 자동할당
- `crm_sales_area_owner`
- 회사 + 시도 + 시군구 기준 담당자 매칭
- ERP 동기화 Master를 전제로 CRM Mirror Table 제공
- 매칭 실패 시 미할당 상태 유지 후 관리자 수동 재할당

## P2-04 Lead 상태전이
- NEW → FIRST_VISIT → KEYMAN_MEETING → CONVERTED
- Open 상태에서 CONTACT_EXCLUDED 허용
- CONVERTED Terminal
- 역전이는 `LEAD.STATUS.REVERSE` + 사유 필수
- 상태이력 `crm_lead_status_history`
- Unit Test 추가

## P2-05 Account / Contact
- Account / Contact Schema
- Account 목록/검색 API
- Lead Convert 시 Account/Contact 생성
- ERP 거래처코드/승인상태/연동상태 필드 포함
- Frontend Account Workspace 추가

## P2-06 중복 거래처 검사/병합
- 사업자번호 중복조회 API
- 1개 Primary + 최대 2개 Duplicate 병합
- Contact / Opportunity Primary Account로 재연결
- 병합 Account는 `MERGED`, `deleted_yn=1`
- 병합이력 `crm_account_merge_history`
- 서로 다른 ERP 거래처코드가 존재하면 자동 병합 차단
- 병합은 Phase 0/PDF 기준 비가역 처리

## P2-07 Lead Convert
- KEYMAN_MEETING 상태에서만 Convert
- Owner 필수
- NEW Account 생성 또는 기존 Account 선택
- 사업자번호 중복 존재 시 신규 Account 자동생성 차단
- Contact 생성
- Opportunity 최소 Foundation 생성(Stage=`NEEDS_ANALYSIS`)
- Conversion History 저장
- Lead → CONVERTED 원자적 Transaction 처리

### Activity 이관 Dependency
원 교육자료는 Lead Convert 시 기존 Activity 이관을 요구한다. 현재 Activity Entity 자체가 Phase 3 대상이므로 실제 Activity Link 이관은 Phase 3에서 `crm_lead_conversion_history`를 기준으로 연결한다. AI가 임의 Activity Schema를 Phase 2에 선행 생성하지 않았다.

## Database Baseline
- `database/migrations/002_phase2_customer.sql`
- `database/seeds/002_phase2_seed.sql`

신규 주요 Table:
- crm_sales_area_owner
- crm_lead
- crm_lead_status_history
- crm_account
- crm_contact
- crm_opportunity (Phase 4 확장 전 최소 Shell)
- crm_lead_conversion_history
- crm_account_merge_history
- crm_hira_hospital_inbox

## CI Result
GitHub Actions `ci` PASS.
- pnpm install: PASS
- shared contracts build: PASS
- NestJS backend build: PASS
- React/Vite frontend build: PASS
- Jest tests: PASS

## Permissions
- LEAD.READ
- LEAD.WRITE
- LEAD.MANAGE
- LEAD.CONVERT
- LEAD.STATUS.REVERSE
- ACCOUNT.READ
- ACCOUNT.WRITE
- ACCOUNT.MERGE
- HIRA.IMPORT

## Deferred / External Dependencies
- Phase 1/2 SQL Migration 실제 DEV DB 적용
- ERP 사용자/조직/지역담당자 Sync Adapter
- 실제 심평원 수신 Transport/API/Batch
- Lead Convert 시 기존 Activity 관계 이관(Phase 3)
- ERP 거래처 등록요청 자체는 Phase 5에서 구현

## Phase 2 Gate
- [x] P2-01 Source Baseline
- [x] P2-02 Source Baseline
- [x] P2-03 Source Baseline
- [x] P2-04 Source Baseline + Unit Test
- [x] P2-05 Source Baseline
- [x] P2-06 Source Baseline
- [x] P2-07 Source Baseline
- [x] GitHub Actions Build/Test PASS
- [ ] Human Domain Review

## Next after approval
`Phase 3 — Sales Activity`
