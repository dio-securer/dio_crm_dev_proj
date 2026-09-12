SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('OPS.READ',N'운영상태/모니터링 조회'),
 ('RELEASE.READ',N'배포/파일럿 이력 조회'),
 ('RELEASE.MANAGE',N'배포/파일럿 이력 관리')
) AS s(permission_code,permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

-- CRM_ADMIN에 Phase 8 운영권한을 부여한다. 실제 운영 조직 역할구성은 배포 전 점검한다.
INSERT INTO dbo.crm_role_permission(role_id,permission_id)
SELECT r.role_id,p.permission_id
FROM dbo.crm_role r CROSS JOIN dbo.crm_permission p
WHERE r.role_code='CRM_ADMIN'
  AND p.permission_code IN('OPS.READ','RELEASE.READ','RELEASE.MANAGE')
  AND NOT EXISTS(SELECT 1 FROM dbo.crm_role_permission rp WHERE rp.role_id=r.role_id AND rp.permission_id=p.permission_id);

COMMIT;
