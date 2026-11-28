-- Separate lead timeline records from visit plans and their report/approval references.
-- This migration is not applied automatically by the implementation tests.
IF OBJECT_ID('dbo.crm_lead_timeline', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.crm_lead_timeline (
    timeline_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
    company_id bigint NOT NULL,
    lead_id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    kind varchar(10) NOT NULL,
    subject nvarchar(200) NOT NULL,
    note nvarchar(4000) NOT NULL DEFAULT '',
    due_date date NULL,
    task_status varchar(12) NULL,
    priority varchar(10) NULL,
    called_at datetime2(0) NULL,
    start_at datetime2(0) NULL,
    end_at datetime2(0) NULL,
    deleted_yn bit NOT NULL DEFAULT 0,
    deleted_at datetime2(0) NULL,
    deleted_by bigint NULL,
    created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    created_by bigint NOT NULL,
    updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by bigint NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT UQ_lead_timeline_public_id UNIQUE(public_id),
    CONSTRAINT FK_lead_timeline_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
    CONSTRAINT FK_lead_timeline_lead FOREIGN KEY(lead_id) REFERENCES dbo.crm_lead(lead_id),
    CONSTRAINT FK_lead_timeline_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id),
    CONSTRAINT CK_lead_timeline_kind CHECK(kind IN ('TASK','CALL','EVENT')),
    CONSTRAINT CK_lead_timeline_payload CHECK(
      (kind='TASK' AND due_date IS NOT NULL AND task_status IS NOT NULL AND task_status IN ('OPEN','COMPLETED') AND priority IS NOT NULL AND priority IN ('NORMAL','HIGH') AND called_at IS NULL AND start_at IS NULL AND end_at IS NULL)
      OR (kind='CALL' AND called_at IS NOT NULL AND due_date IS NULL AND task_status IS NULL AND priority IS NULL AND start_at IS NULL AND end_at IS NULL)
      OR (kind='EVENT' AND start_at IS NOT NULL AND end_at IS NOT NULL AND end_at>=start_at AND due_date IS NULL AND task_status IS NULL AND priority IS NULL AND called_at IS NULL)
    )
  );
  CREATE INDEX IX_lead_timeline_lead ON dbo.crm_lead_timeline(company_id,lead_id,deleted_yn,created_at);
END;
