-- Source migration only. Apply after isolated-DB review; not executed by local checks.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.crm_activity_report','approval_round') IS NULL
BEGIN
 ALTER TABLE dbo.crm_activity_report ADD approval_round int NOT NULL CONSTRAINT DF_report_approval_round DEFAULT 0;
 EXEC(N'UPDATE dbo.crm_activity_report SET approval_round=1 WHERE status<>''DRAFT'';');
END;
IF COL_LENGTH('dbo.crm_activity_report','branch_comment') IS NULL
 ALTER TABLE dbo.crm_activity_report ADD branch_comment nvarchar(1000) NULL;
IF COL_LENGTH('dbo.crm_activity_report','division_comment') IS NULL
 ALTER TABLE dbo.crm_activity_report ADD division_comment nvarchar(1000) NULL;
IF COL_LENGTH('dbo.crm_activity_report','row_version') IS NULL
 ALTER TABLE dbo.crm_activity_report ADD row_version rowversion;
COMMIT TRANSACTION;
