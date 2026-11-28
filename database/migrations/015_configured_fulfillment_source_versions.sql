-- Source-only migration. Apply exclusively during the separately authorized database rollout.
SET XACT_ABORT ON;
BEGIN TRAN;
IF COL_LENGTH('dbo.crm_delivery','source_version') IS NULL
 ALTER TABLE dbo.crm_delivery ADD source_version bigint NOT NULL CONSTRAINT DF_delivery_source_version DEFAULT 0, source_hash char(64) NULL;
IF COL_LENGTH('dbo.crm_sales','source_version') IS NULL
 ALTER TABLE dbo.crm_sales ADD source_version bigint NOT NULL CONSTRAINT DF_sales_source_version DEFAULT 0, source_hash char(64) NULL;
IF COL_LENGTH('dbo.crm_return_exchange','source_version') IS NULL
 ALTER TABLE dbo.crm_return_exchange ADD source_version bigint NOT NULL CONSTRAINT DF_return_source_version DEFAULT 0, source_hash char(64) NULL;
COMMIT;
