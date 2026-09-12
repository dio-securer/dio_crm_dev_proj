SET XACT_ABORT ON;
BEGIN TRAN;

IF OBJECT_ID('dbo.crm_system_setting') IS NULL
CREATE TABLE dbo.crm_system_setting(
  system_setting_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NULL,
  setting_key varchar(100) NOT NULL,
  setting_value nvarchar(1000) NOT NULL,
  description nvarchar(500) NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_system_setting' AND object_id=OBJECT_ID('dbo.crm_system_setting'))
  CREATE UNIQUE INDEX UX_system_setting ON dbo.crm_system_setting(company_id, setting_key) WHERE company_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_system_setting_global' AND object_id=OBJECT_ID('dbo.crm_system_setting'))
  CREATE UNIQUE INDEX UX_system_setting_global ON dbo.crm_system_setting(setting_key) WHERE company_id IS NULL;

IF OBJECT_ID('dbo.crm_approval_route') IS NULL
CREATE TABLE dbo.crm_approval_route(
  approval_route_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NOT NULL,
  organization_id bigint NOT NULL,
  approval_type varchar(50) NOT NULL,
  branch_approver_user_id bigint NOT NULL,
  division_approver_user_id bigint NOT NULL,
  is_active bit NOT NULL DEFAULT 1,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_approval_route_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_approval_route_org FOREIGN KEY(organization_id) REFERENCES dbo.crm_organization(organization_id),
  CONSTRAINT FK_approval_route_branch FOREIGN KEY(branch_approver_user_id) REFERENCES dbo.crm_user(user_id),
  CONSTRAINT FK_approval_route_div FOREIGN KEY(division_approver_user_id) REFERENCES dbo.crm_user(user_id),
  CONSTRAINT UQ_approval_route UNIQUE(company_id, organization_id, approval_type)
);

IF OBJECT_ID('dbo.crm_activity_event') IS NULL
CREATE TABLE dbo.crm_activity_event(
  event_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  subject nvarchar(200) NOT NULL,
  start_at datetime2(0) NOT NULL,
  end_at datetime2(0) NOT NULL,
  related_type varchar(30) NOT NULL,
  related_id bigint NOT NULL,
  is_activity_plan bit NOT NULL DEFAULT 1,
  visit_purpose nvarchar(500) NULL,
  direct_work_type varchar(30) NULL,
  direct_work_reason nvarchar(500) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NOT NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  CONSTRAINT FK_activity_event_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_activity_event_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id)
);

IF OBJECT_ID('dbo.crm_activity') IS NULL
CREATE TABLE dbo.crm_activity(
  activity_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  event_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  related_type varchar(30) NOT NULL,
  related_id bigint NOT NULL,
  related_name_snapshot nvarchar(200) NOT NULL,
  target_latitude decimal(10,7) NULL,
  target_longitude decimal(10,7) NULL,
  planned_date date NOT NULL,
  planned_at datetime2(0) NOT NULL,
  visit_purpose nvarchar(500) NULL,
  consultation_content nvarchar(max) NULL,
  status varchar(30) NOT NULL DEFAULT 'PLANNED',
  in_at datetime2(0) NULL,
  in_latitude decimal(10,7) NULL,
  in_longitude decimal(10,7) NULL,
  in_accuracy_m decimal(10,2) NULL,
  in_is_mocked bit NULL,
  in_distance_m decimal(12,2) NULL,
  out_at datetime2(0) NULL,
  out_latitude decimal(10,7) NULL,
  out_longitude decimal(10,7) NULL,
  out_accuracy_m decimal(10,2) NULL,
  out_is_mocked bit NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NOT NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_activity_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_activity_event FOREIGN KEY(event_id) REFERENCES dbo.crm_activity_event(event_id),
  CONSTRAINT FK_activity_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_activity_daily_target' AND object_id=OBJECT_ID('dbo.crm_activity'))
  CREATE UNIQUE INDEX UX_activity_daily_target ON dbo.crm_activity(company_id, owner_user_id, related_type, related_id, planned_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_activity_owner_date' AND object_id=OBJECT_ID('dbo.crm_activity'))
  CREATE INDEX IX_activity_owner_date ON dbo.crm_activity(company_id, owner_user_id, planned_date, status);

IF OBJECT_ID('dbo.crm_activity_report') IS NULL
CREATE TABLE dbo.crm_activity_report(
  report_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  reporter_user_id bigint NOT NULL,
  report_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  branch_approver_user_id bigint NULL,
  division_approver_user_id bigint NULL,
  requested_at datetime2(0) NULL,
  branch_approved_at datetime2(0) NULL,
  division_approved_at datetime2(0) NULL,
  final_approved_at datetime2(0) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_activity_report_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_activity_report_user FOREIGN KEY(reporter_user_id) REFERENCES dbo.crm_user(user_id),
  CONSTRAINT UQ_activity_report UNIQUE(company_id, reporter_user_id, report_date)
);

IF OBJECT_ID('dbo.crm_activity_report_item') IS NULL
CREATE TABLE dbo.crm_activity_report_item(
  report_item_id bigint IDENTITY(1,1) PRIMARY KEY,
  report_id bigint NOT NULL,
  item_type varchar(20) NOT NULL,
  activity_id bigint NOT NULL,
  planned_at_snapshot datetime2(0) NOT NULL,
  related_name_snapshot nvarchar(200) NOT NULL,
  visit_purpose_snapshot nvarchar(500) NULL,
  consultation_snapshot nvarchar(max) NULL,
  sort_order int NOT NULL DEFAULT 0,
  CONSTRAINT FK_report_item_report FOREIGN KEY(report_id) REFERENCES dbo.crm_activity_report(report_id),
  CONSTRAINT FK_report_item_activity FOREIGN KEY(activity_id) REFERENCES dbo.crm_activity(activity_id),
  CONSTRAINT UQ_report_activity UNIQUE(report_id, activity_id)
);

IF OBJECT_ID('dbo.crm_direct_work') IS NULL
CREATE TABLE dbo.crm_direct_work(
  direct_work_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  activity_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  work_type varchar(30) NOT NULL,
  reason nvarchar(500) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  approval_round int NOT NULL DEFAULT 1,
  branch_approver_user_id bigint NULL,
  division_approver_user_id bigint NULL,
  requested_at datetime2(0) NULL,
  branch_approved_at datetime2(0) NULL,
  division_approved_at datetime2(0) NULL,
  rejected_at datetime2(0) NULL,
  erp_sync_status varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED',
  erp_request_id uniqueidentifier NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NOT NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  CONSTRAINT FK_direct_work_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_direct_work_activity FOREIGN KEY(activity_id) REFERENCES dbo.crm_activity(activity_id),
  CONSTRAINT FK_direct_work_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id),
  CONSTRAINT UQ_direct_work_activity UNIQUE(activity_id)
);

IF OBJECT_ID('dbo.crm_approval_action') IS NULL
CREATE TABLE dbo.crm_approval_action(
  approval_action_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NOT NULL,
  target_type varchar(40) NOT NULL,
  target_id bigint NOT NULL,
  approval_round int NOT NULL DEFAULT 1,
  step_code varchar(30) NOT NULL,
  approver_user_id bigint NOT NULL,
  action varchar(30) NOT NULL,
  comment nvarchar(1000) NULL,
  acted_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_approval_action_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_approval_action_user FOREIGN KEY(approver_user_id) REFERENCES dbo.crm_user(user_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_approval_action_target' AND object_id=OBJECT_ID('dbo.crm_approval_action'))
  CREATE INDEX IX_approval_action_target ON dbo.crm_approval_action(company_id,target_type,target_id,approval_round,approval_action_id);

-- Phase 2 Lead Convert 이후에도 기존 Lead Activity를 Account로 이관한다.
EXEC('CREATE OR ALTER TRIGGER dbo.trg_lead_conversion_activity ON dbo.crm_lead_conversion_history AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  UPDATE a
     SET a.related_type = ''ACCOUNT'', a.related_id = i.account_id, a.updated_at = SYSUTCDATETIME()
    FROM dbo.crm_activity a
    JOIN inserted i ON a.related_type = ''LEAD'' AND a.related_id = i.lead_id;
  UPDATE e
     SET e.related_type = ''ACCOUNT'', e.related_id = i.account_id, e.updated_at = SYSUTCDATETIME()
    FROM dbo.crm_activity_event e
    JOIN inserted i ON e.related_type = ''LEAD'' AND e.related_id = i.lead_id;
END');

COMMIT;
