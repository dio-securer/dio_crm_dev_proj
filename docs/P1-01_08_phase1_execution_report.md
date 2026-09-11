# Phase 1 Platform Foundation 실행 보고서

## Status

`IMPLEMENTED / CI_AND_HUMAN_REVIEW_PENDING`

Phase 1 Work Package의 소스 Baseline은 구현했으며, PR의 CI 결과와 Human Architecture Review 통과 후 `APPROVED`로 변경한다.

## P1-00 Technology Stack Decision
- React + TypeScript + Vite
- NestJS + TypeScript
- SQL Server
- explicit Repository + `mssql`
- REST + Zod
- JWT Access/Refresh
- pnpm monorepo
- GitHub Actions CI

## P1-01 Repository/Application Skeleton
- pnpm monorepo
- backend / frontend / packages/contracts / database / integration / tests
- GitHub Actions CI
- Health endpoint

## P1-02 Authentication
- login
- JWT Access Token
- Refresh Token DB 저장
- Refresh Token rotation
- logout/revoke
- password hash 비교
- API Auth Guard

## P1-03 User / Organization
- ERP Master 동기화 전제의 CRM mirror schema
- User/Organization 조회 endpoint
- `company_id` / `organization_id` 구조
- ERP User/Organization 실동기화 Adapter는 ERP Interface 상세 확정 후 연결

## P1-04 Role / Permission
- Role / Permission / UserRole / RolePermission schema
- JWT permissions
- Backend PermissionGuard
- Data Scope: SELF / BRANCH / DIVISION / ALL / SYSTEM

## P1-05 Common Code
- `crm_common_code`
- group 기반 조회 API
- 전사 공통/법인별 코드 확장 가능

## P1-06 Audit Log
- actor/entity/action/before/after/request_id schema
- 운영 조회 endpoint
- 실제 업무 Domain 자동 Audit 적용은 Phase 2 도메인 구현 시 연결

## P1-07 Interface Framework
- request_id
- InterfaceLog
- SUCCESS/FAILED 상태
- configurable timeout
- retry / retry_count
- Adapter execute wrapper
- ERP/HIRA 실제 Adapter는 해당 업무 Phase에서 구현

## P1-08 File / Notification Foundation
- File Metadata schema/등록 API
- Notification schema/사용자 알림 조회
- 실제 binary storage provider 및 email/push/sms Adapter는 요구사항/인프라 확정 후 추가

## Database Baseline

Phase 1 migration에서 다음 Foundation table을 정의한다.

- crm_company
- crm_organization
- crm_user
- crm_role
- crm_permission
- crm_user_role
- crm_role_permission
- crm_common_code
- crm_refresh_token
- crm_audit_log
- crm_interface_log
- crm_file_metadata
- crm_notification

식별정책은 Phase 0 결정대로 `bigint IDENTITY + public_id(UUID) + company_id` 기준을 반영했다.

## Known Follow-ups

다음 항목은 Phase 1 Foundation 외부 의존성이 있어 이후 연결한다.

- bootstrap 최초 CRM_ADMIN 사용자 발급 절차
- ERP User/Organization 실제 sync Adapter
- Domain 변경 시 Audit 자동 기록
- file binary storage provider
- Notification sender adapters
- 운영환경 Secret/Key 관리
- SQL migration 실제 DEV DB 적용/검증

## Phase 1 Gate

- [x] 기술스택 결정
- [x] Application skeleton
- [x] Authentication foundation
- [x] Refresh rotation
- [x] User/Organization foundation
- [x] Role/Permission foundation
- [x] Common Code foundation
- [x] Audit schema/query foundation
- [x] Interface framework + retry/timeout
- [x] File/Notification foundation
- [x] CI workflow 정의
- [ ] CI build/test 결과 확인
- [ ] DEV SQL migration 적용 검증
- [ ] Human Architecture Review
