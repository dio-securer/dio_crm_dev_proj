SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('ERP_ACCOUNT.REQUEST',N'ERP 거래처 등록 요청'),
 ('CONTRACT.READ',N'계약 조회'),
 ('CONTRACT.WRITE',N'계약 생성/수정'),
 ('CONTRACT.ERP_REQUEST',N'ERP 계약 등록 요청'),
 ('COLLECTION.READ',N'실수금/수금계획 조회'),
 ('COLLECTION.PLAN.WRITE',N'수금계획 작성/변경'),
 ('INTEGRATION.RESULT.WRITE',N'ERP 연동 결과 반영')
) AS s(permission_code,permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

MERGE dbo.crm_common_code AS t
USING (VALUES
 ('CONTRACT_STATUS','DRAFT',N'계약작성',10),
 ('CONTRACT_STATUS','ERP_REQUESTED',N'ERP 등록요청',20),
 ('CONTRACT_STATUS','ERP_APPROVED',N'ERP 승인완료',30),
 ('CONTRACT_STATUS','ERP_FAILED',N'ERP 연동실패',40),
 ('CONTRACT_STATUS','CLOSED',N'마감',90),
 ('COLLECTION_ADJUSTMENT','ORIGINAL',N'최초계획',10),
 ('COLLECTION_ADJUSTMENT','SPLIT',N'분할',20),
 ('COLLECTION_ADJUSTMENT','ARREARS_REALLOCATION',N'미수재할당',30)
) AS s(group_code,code,code_name,sort_order)
ON t.company_id IS NULL AND t.group_code=s.group_code AND t.code=s.code
WHEN NOT MATCHED THEN INSERT(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
VALUES(NULL,s.group_code,s.code,s.code_name,s.sort_order,1,0);

COMMIT;
