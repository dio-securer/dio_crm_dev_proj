SET XACT_ABORT ON;
BEGIN TRAN;

-- P8-02 Performance indexes: create only when the logical index does not already exist.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_p8_lead_owner_status' AND object_id=OBJECT_ID('dbo.crm_lead'))
  CREATE INDEX IX_p8_lead_owner_status ON dbo.crm_lead(company_id,owner_user_id,status,deleted_yn) INCLUDE(hospital_name,updated_at);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_p8_account_owner' AND object_id=OBJECT_ID('dbo.crm_account'))
  CREATE INDEX IX_p8_account_owner ON dbo.crm_account(company_id,owner_user_id,deleted_yn) INCLUDE(account_name,erp_approved_yn,account_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_p8_opportunity_stage_owner' AND object_id=OBJECT_ID('dbo.crm_opportunity'))
  CREATE INDEX IX_p8_opportunity_stage_owner ON dbo.crm_opportunity(company_id,stage,owner_user_id,deleted_yn) INCLUDE(amount,expected_close_date,success_probability);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_p8_interface_status_time' AND object_id=OBJECT_ID('dbo.crm_interface_log'))
  CREATE INDEX IX_p8_interface_status_time ON dbo.crm_interface_log(company_id,status,requested_at) INCLUDE(interface_code,retry_count,responded_at);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_p8_audit_company_time' AND object_id=OBJECT_ID('dbo.crm_audit_log'))
  CREATE INDEX IX_p8_audit_company_time ON dbo.crm_audit_log(company_id,created_at) INCLUDE(entity_type,action,actor_user_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_p8_notification_user_read' AND object_id=OBJECT_ID('dbo.crm_notification'))
  CREATE INDEX IX_p8_notification_user_read ON dbo.crm_notification(user_id,read_at,created_at);

-- P8-06/P8-07: actual Pilot/Cutover execution is an environment gate. This table stores the audit trail when executed.
IF OBJECT_ID('dbo.crm_release_event') IS NULL
BEGIN
  CREATE TABLE dbo.crm_release_event(
    release_event_id bigint IDENTITY(1,1) PRIMARY KEY,
    public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
    release_version varchar(80) NOT NULL,
    environment varchar(30) NOT NULL,
    event_type varchar(30) NOT NULL,
    status varchar(30) NOT NULL,
    details_json nvarchar(max) NULL,
    actor_user_id bigint NULL,
    created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_release_event_type CHECK(event_type IN('PRECHECK','PILOT_START','PILOT_RESULT','CUTOVER_START','CUTOVER_RESULT','ROLLBACK')),
    CONSTRAINT FK_release_event_actor FOREIGN KEY(actor_user_id) REFERENCES dbo.crm_user(user_id)
  );
  CREATE UNIQUE INDEX UX_release_event_public ON dbo.crm_release_event(public_id);
  CREATE INDEX IX_release_event_version ON dbo.crm_release_event(release_version,environment,event_type,created_at);
END;

COMMIT;
