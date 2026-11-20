-- Source only. Legacy rows remain unassigned until a separately reviewed ownership migration.
SET XACT_ABORT ON;
BEGIN TRAN;
IF COL_LENGTH('dbo.crm_file_metadata','company_id') IS NULL
 ALTER TABLE dbo.crm_file_metadata ADD company_id bigint NULL REFERENCES dbo.crm_company(company_id), upload_receipt_id uniqueidentifier NULL, content_sha256 char(64) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_file_upload_receipt' AND object_id=OBJECT_ID('dbo.crm_file_metadata'))
 CREATE UNIQUE INDEX UX_file_upload_receipt ON dbo.crm_file_metadata(company_id,upload_receipt_id) WHERE company_id IS NOT NULL AND upload_receipt_id IS NOT NULL;
IF NOT EXISTS(SELECT 1 FROM crm_permission WHERE permission_code='FILE.WRITE')
 INSERT INTO crm_permission(permission_code,permission_name,is_active) VALUES('FILE.WRITE',N'첨부 파일 등록',1);
COMMIT;
