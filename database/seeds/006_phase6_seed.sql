SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('ORDER.READ',N'주문 조회'),
 ('ORDER.WRITE',N'주문 작성'),
 ('ORDER.SUBMIT',N'ERP 주문 요청'),
 ('DELIVERY.READ',N'납품/출고 조회'),
 ('SALES.READ',N'매출 조회'),
 ('RETURN_EXCHANGE.READ',N'반품/교환 조회'),
 ('PRODUCT_ORDER.READ',N'주문가능 품목 조회')
) AS s(permission_code,permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

MERGE dbo.crm_common_code AS t
USING (VALUES
 ('ORDER_STATUS','DRAFT',N'주문작성',10),
 ('ORDER_STATUS','REQUESTING',N'ERP 요청중',20),
 ('ORDER_STATUS','ACCEPTED',N'ERP 접수',30),
 ('ORDER_STATUS','PROCESSING',N'처리중',40),
 ('ORDER_STATUS','COMPLETED',N'완료',50),
 ('ORDER_STATUS','FAILED',N'실패',90),
 ('DELIVERY_ADDRESS_TYPE','ACCOUNT',N'거래처주소',10),
 ('DELIVERY_ADDRESS_TYPE','DIRECT',N'직접입력',20),
 ('RETURN_EXCHANGE_TYPE','RETURN',N'반품',10),
 ('RETURN_EXCHANGE_TYPE','EXCHANGE',N'교환',20)
) AS s(group_code,code,code_name,sort_order)
ON t.company_id IS NULL AND t.group_code=s.group_code AND t.code=s.code
WHEN NOT MATCHED THEN INSERT(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
VALUES(NULL,s.group_code,s.code,s.code_name,s.sort_order,1,0);

COMMIT;
