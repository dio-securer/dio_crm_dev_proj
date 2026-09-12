SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dbo.crm_permission AS t
USING (VALUES
 ('LEDGER.READ',N'패키지원장 조회'),
 ('LEDGER.EXPORT',N'패키지원장 엑셀 다운로드'),
 ('STATEMENT.READ',N'월합 거래명세서 조회'),
 ('STATEMENT.EXPORT',N'월합 거래명세서 PDF 생성'),
 ('ACCOUNT360.READ',N'거래처 360 조회'),
 ('ANALYTICS.READ',N'영업 분석 대시보드 조회')
) AS s(permission_code,permission_name)
ON t.permission_code=s.permission_code
WHEN NOT MATCHED THEN INSERT(permission_code,permission_name,is_active) VALUES(s.permission_code,s.permission_name,1);

COMMIT;
