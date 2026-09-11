# Phase 1 DEV DB Migration 적용 Runbook

## 목적

Phase 1 Foundation Schema를 실제 DEV SQL Server에 적용하고 검증하여 마지막 Gate를 통과한다.

## 적용 대상

- Migration: `database/migrations/001_phase1_foundation.sql`
- Seed: `database/seeds/001_phase1_seed.sql`

## 사전 조건

1. DEV SQL Server 인스턴스/DB가 준비되어 있어야 한다.
2. 적용 계정은 대상 DB에 DDL 권한이 있어야 한다.
3. 운영 DB에는 적용하지 않는다.
4. 적용 전 대상 DB 백업 또는 Snapshot을 확보한다.
5. DEV DB 이름, 서버주소, 포트, 인증방식은 별도 환경정보로 관리한다.

## 권장 적용 순서

### 1. Migration 적용

SSMS 또는 sqlcmd에서 대상 DEV DB를 선택한 뒤 다음 파일을 실행한다.

```text
database/migrations/001_phase1_foundation.sql
```

### 2. Seed 적용

Migration 성공 후 다음 파일을 실행한다.

```text
database/seeds/001_phase1_seed.sql
```

### 3. 생성 Object 확인

다음 Foundation Table 존재를 확인한다.

```sql
SELECT name
FROM sys.tables
WHERE name IN (
  'crm_company',
  'crm_organization',
  'crm_user',
  'crm_role',
  'crm_permission',
  'crm_user_role',
  'crm_role_permission',
  'crm_common_code',
  'crm_refresh_token',
  'crm_audit_log',
  'crm_interface_log',
  'crm_file_metadata',
  'crm_notification'
)
ORDER BY name;
```

기대 결과: 13개 Table.

### 4. PK/Public ID/Company 구조 검증

```sql
SELECT
    t.name AS table_name,
    c.name AS column_name,
    ty.name AS data_type,
    c.is_identity
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name LIKE 'crm_%'
  AND c.name IN ('company_id','public_id')
ORDER BY t.name, c.column_id;
```

Phase 0 결정사항인 `bigint IDENTITY + public_id(UUID) + company_id` 구조가 필요한 Master Entity에 반영되었는지 확인한다.

### 5. Seed 검증

```sql
SELECT * FROM crm_company;
SELECT * FROM crm_role ORDER BY role_code;
SELECT * FROM crm_permission ORDER BY permission_code;
SELECT * FROM crm_common_code ORDER BY group_code, sort_order;
```

### 6. API 연결 검증

Backend `.env`에 DEV DB 접속정보를 설정한 뒤 API를 기동한다.

```text
GET /api/health
```

기본 Health 응답을 확인한 후 인증/사용자/조직/Common Code endpoint를 순차 검증한다.

## 합격 기준

- [ ] Migration 전체 성공
- [ ] Foundation Table 13개 생성 확인
- [ ] Seed 적용 성공
- [ ] FK/Unique/Index 생성 오류 없음
- [ ] Backend가 DEV DB에 연결됨
- [ ] Health API 성공
- [ ] Login/Refresh/Logout 기본 흐름 검증
- [ ] User/Organization/Common Code 조회 성공
- [ ] Interface/Audit Log Table 접근 확인

## 실패 시 처리

1. 실패 SQL과 SQL Server Error Number/Message 기록
2. Migration 중간 재실행 전에 생성 Object 상태 확인
3. 임의로 운영 DB를 수정하지 않는다.
4. Schema 수정이 필요한 경우 Migration 파일을 Git에서 수정하고 CI/Review 후 다시 적용한다.

## 완료 처리

검증 완료 후:

- `docs/P1-01_08_phase1_execution_report.md`의 DEV SQL migration 항목을 `[x]` 처리
- `docs/03_CRM_Project_Progress.html`의 Phase 1을 `APPROVED`로 변경
- PR #1 최종 Review 후 `main` Merge
- NEXT를 `Phase 2 — Customer / Lead / Account`로 변경
