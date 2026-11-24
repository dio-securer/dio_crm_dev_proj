-- Source only. No automatic migration or connection.
SET XACT_ABORT ON;
BEGIN TRAN;
IF COL_LENGTH('dbo.crm_lead','hira_source_version') IS NULL
 ALTER TABLE dbo.crm_lead ADD hira_source_version bigint NOT NULL CONSTRAINT DF_lead_hira_source_version DEFAULT 0, hira_source_hash char(64) NULL;
COMMIT;
