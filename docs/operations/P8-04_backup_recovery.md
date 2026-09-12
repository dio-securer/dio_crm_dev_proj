# P8-04 Backup / Recovery Runbook

## 목표
CRM DB 장애/오삭제/배포실패 시 복구 가능한 백업과 복원검증 절차를 표준화한다.

## 기본 원칙
- SQL Server Full Backup은 `CHECKSUM`, `COMPRESSION` 사용
- 백업 직후 `RESTORE VERIFYONLY ... WITH CHECKSUM`
- 백업 성공만으로 복구 가능성을 판단하지 않고 정기 Restore Drill 수행
- 운영 Cutover 전 즉시 복구 가능한 Pre-Cutover Backup 확보
- CRM Application Source는 Git Tag/Commit으로 별도 복구 가능해야 함

## 제공 Script
- `scripts/backup/backup-crm.ps1`: Full Backup + VERIFYONLY
- `scripts/backup/post-restore-verify.ps1`: 복원된 Drill DB에 DBCC CHECKDB + 핵심 Table sanity check

## 권장 주기 Baseline
- Full: Daily
- Log Backup: 운영 Recovery Model이 FULL일 경우 별도 주기 결정
- 보존: 회사 백업/감사정책에 따라 확정 (현재 Spec Gap)
- Restore Drill: 최소 분기 1회 권장, Production 도입 전 1회 필수

## Restore Drill 절차
1. 최근 정상 Full Backup 선택
2. Production과 분리된 SQL Server/DB 이름으로 Restore
3. `DBCC CHECKDB` 수행
4. `post-restore-verify.ps1` 수행
5. 핵심 Table Count와 참조 무결성 확인
6. Application을 Drill DB에 연결하여 Read-only Smoke Test
7. RTO/RPO 실제값 기록
8. 결과를 변경/운영기록에 보존

## Cutover 직전
- 배포변경 Freeze
- Full Backup + VERIFYONLY 성공
- 현재 Application Commit/Tag 기록
- 현재 DB Migration Version 기록
- Rollback 담당자/의사결정자 확인

실제 백업 및 Restore Drill은 SQL Server 환경정보가 없는 현재 단계에서는 실행하지 않는다.
