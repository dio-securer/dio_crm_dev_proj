-- Source only. Apply only in an explicitly approved database migration window.
SET XACT_ABORT ON;
BEGIN TRAN;
IF COL_LENGTH('dbo.crm_common_code','public_id') IS NULL
 ALTER TABLE dbo.crm_common_code ADD public_id uniqueidentifier NOT NULL CONSTRAINT DF_common_code_public DEFAULT NEWID() WITH VALUES;
IF COL_LENGTH('dbo.crm_common_code','row_version') IS NULL
 ALTER TABLE dbo.crm_common_code ADD row_version rowversion;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.crm_common_code') AND name='UX_common_code_public')
 EXEC('CREATE UNIQUE INDEX UX_common_code_public ON dbo.crm_common_code(public_id)');
COMMIT;
