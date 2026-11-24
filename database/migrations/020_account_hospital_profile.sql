-- Source only; no automatic connection or execution.
SET XACT_ABORT ON;
BEGIN TRAN;
IF COL_LENGTH('dbo.crm_account','hospital_size') IS NULL
 ALTER TABLE dbo.crm_account ADD hospital_size int NULL;
IF COL_LENGTH('dbo.crm_account','main_system') IS NULL
 ALTER TABLE dbo.crm_account ADD main_system nvarchar(4000) NULL;
IF COL_LENGTH('dbo.crm_account','sub_system') IS NULL
 ALTER TABLE dbo.crm_account ADD sub_system nvarchar(4000) NULL;
IF COL_LENGTH('dbo.crm_account','dio_product_usage') IS NULL
 ALTER TABLE dbo.crm_account ADD dio_product_usage nvarchar(4000) NULL;
COMMIT;
