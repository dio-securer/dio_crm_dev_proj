SET XACT_ABORT ON;
BEGIN TRAN;

IF NOT EXISTS (SELECT 1 FROM dbo.crm_company WHERE company_code='DIO')
  INSERT dbo.crm_company(company_code, company_name) VALUES('DIO', N'DIO');

MERGE dbo.crm_role AS T
USING (VALUES
 ('SALES_REP',N'영업담당자','SELF'),
 ('BRANCH_MANAGER',N'지점장','BRANCH'),
 ('HQ_MANAGER',N'본부장','DIVISION'),
 ('SALES_ADMIN',N'영업관리','ALL'),
 ('CRM_ADMIN',N'CRM 관리자','ALL'),
 ('INTEGRATION_ADMIN',N'Integration 관리자','SYSTEM')
) AS S(role_code,role_name,data_scope)
ON T.role_code=S.role_code
WHEN NOT MATCHED THEN INSERT(role_code,role_name,data_scope) VALUES(S.role_code,S.role_name,S.data_scope);

MERGE dbo.crm_permission AS T
USING (VALUES
 ('USER.READ',N'사용자 조회'),
 ('ORG.READ',N'조직 조회'),
 ('AUDIT.READ',N'감사로그 조회'),
 ('INTERFACE.READ',N'인터페이스로그 조회'),
 ('INTERFACE.RETRY',N'인터페이스 재처리'),
 ('COMMON_CODE.MANAGE',N'공통코드 관리'),
 ('ROLE.MANAGE',N'권한 관리')
) AS S(permission_code,permission_name)
ON T.permission_code=S.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name) VALUES(S.permission_code,S.permission_name);

COMMIT;
