SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('OPPORTUNITY.READ',N'Opportunity 조회'),
 ('OPPORTUNITY.WRITE',N'Opportunity 생성/수정/보관'),
 ('OPPORTUNITY.STAGE',N'Opportunity 단계변경'),
 ('OPPORTUNITY.STAGE.REOPEN',N'Closed Opportunity 재오픈'),
 ('OPPORTUNITY.PRODUCT.WRITE',N'Opportunity 패키지/제품 편집'),
 ('PRODUCT_PACKAGE.READ',N'패키지/제품 조회'),
 ('PRODUCT_PACKAGE.MANAGE',N'패키지/제품 Master 관리'),
 ('PIPELINE.READ',N'Pipeline/Funnel 조회')
) AS s(permission_code,permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

MERGE dbo.crm_common_code AS t
USING (VALUES
 ('OPPORTUNITY_STAGE','NEEDS_ANALYSIS',N'니즈파악',10),
 ('OPPORTUNITY_STAGE','PROPOSAL',N'제안',20),
 ('OPPORTUNITY_STAGE','NEGOTIATION',N'협상',30),
 ('OPPORTUNITY_STAGE','CLOSED_WON',N'수주성공',90),
 ('OPPORTUNITY_STAGE','CLOSED_LOST',N'수주실패',99),
 ('OPPORTUNITY_TYPE','NEW',N'신규',10),
 ('OPPORTUNITY_TYPE','EXISTING',N'기존',20),
 ('OPPORTUNITY_TYPE','RECONTRACT',N'재계약',30),
 ('FORECAST_CATEGORY','PIPELINE',N'Pipeline',10),
 ('FORECAST_CATEGORY','BEST_CASE',N'Best Case',20),
 ('FORECAST_CATEGORY','COMMIT',N'Commit',30),
 ('FORECAST_CATEGORY','OMITTED',N'Omitted',99),
 ('PRODUCT_ITEM_TYPE','PACKAGE',N'패키지',10),
 ('PRODUCT_ITEM_TYPE','PRODUCT',N'제품',20)
) AS s(group_code,code,code_name,sort_order)
ON t.company_id IS NULL AND t.group_code=s.group_code AND t.code=s.code
WHEN NOT MATCHED THEN INSERT(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
VALUES(NULL,s.group_code,s.code,s.code_name,s.sort_order,1,0);

COMMIT;
