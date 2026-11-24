-- Source only: apply to an isolated database before accepting configured collection ingestion.
SET XACT_ABORT ON;
BEGIN TRAN;
IF COL_LENGTH('dbo.crm_collection_actual','source_version') IS NULL
  ALTER TABLE dbo.crm_collection_actual ADD source_version bigint NOT NULL
    CONSTRAINT DF_collection_actual_source_version DEFAULT 0;
COMMIT;
