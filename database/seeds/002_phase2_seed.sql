SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('LEAD.READ',N'Lead 조회'),
 ('LEAD.WRITE',N'Lead 생성/수정'),
 ('LEAD.MANAGE',N'Lead 재할당/관리'),
 ('LEAD.CONVERT',N'Lead Convert'),
 ('LEAD.STATUS.REVERSE',N'Lead 상태 역전이'),
 ('ACCOUNT.READ',N'Account 조회'),
 ('ACCOUNT.WRITE',N'Account 수정'),
 ('ACCOUNT.MERGE',N'Account 병합'),
 ('HIRA.IMPORT',N'심평원 병원 수신')
) AS s(permission_code, permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

MERGE dbo.crm_common_code AS t
USING (VALUES
 ('LEAD_STATUS','NEW',N'신규등록',10),
 ('LEAD_STATUS','FIRST_VISIT',N'초도방문',20),
 ('LEAD_STATUS','KEYMAN_MEETING',N'키맨미팅',30),
 ('LEAD_STATUS','CONTACT_EXCLUDED',N'컨택제외',90),
 ('LEAD_STATUS','CONVERTED',N'변환',100),
 ('CONTACT_TYPE','DENTIST',N'치과의사',10),
 ('CONTACT_TYPE','MANAGER',N'실장',20),
 ('CONTACT_TYPE','STAFF',N'스텝',30),
 ('ACCOUNT_STATUS','ACTIVE',N'정상',10),
 ('ACCOUNT_STATUS','NON_TRADING',N'비거래처',20),
 ('ACCOUNT_STATUS','CHURN_RISK',N'이탈가능',30),
 ('ACCOUNT_STATUS','CHURNED',N'이탈',40),
 ('ACCOUNT_STATUS','MERGED',N'병합완료',99)
) AS s(group_code,code,code_name,sort_order)
ON t.company_id IS NULL AND t.group_code=s.group_code AND t.code=s.code
WHEN NOT MATCHED THEN INSERT(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
VALUES(NULL,s.group_code,s.code,s.code_name,s.sort_order,1,0);

COMMIT;
