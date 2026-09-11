SET XACT_ABORT ON;
BEGIN TRAN;

IF OBJECT_ID('dbo.crm_company') IS NULL
CREATE TABLE dbo.crm_company(
  company_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL CONSTRAINT DF_crm_company_public DEFAULT NEWID(),
  company_code varchar(30) NOT NULL UNIQUE,
  company_name nvarchar(100) NOT NULL,
  is_active bit NOT NULL DEFAULT 1,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  row_version rowversion
);

IF OBJECT_ID('dbo.crm_organization') IS NULL
CREATE TABLE dbo.crm_organization(
  organization_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  parent_organization_id bigint NULL,
  organization_code varchar(50) NOT NULL,
  organization_name nvarchar(100) NOT NULL,
  organization_type varchar(30) NOT NULL,
  erp_org_code varchar(50) NULL,
  is_active bit NOT NULL DEFAULT 1,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_org_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_org_parent FOREIGN KEY(parent_organization_id) REFERENCES dbo.crm_organization(organization_id),
  CONSTRAINT UQ_org_company_code UNIQUE(company_id, organization_code)
);

IF OBJECT_ID('dbo.crm_user') IS NULL
CREATE TABLE dbo.crm_user(
  user_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  organization_id bigint NULL,
  login_id varchar(100) NOT NULL,
  user_name nvarchar(100) NOT NULL,
  email varchar(200) NULL,
  password_hash varchar(255) NOT NULL,
  erp_user_code varchar(50) NULL,
  is_active bit NOT NULL DEFAULT 1,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  row_version rowversion,
  CONSTRAINT FK_user_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_user_org FOREIGN KEY(organization_id) REFERENCES dbo.crm_organization(organization_id),
  CONSTRAINT UQ_user_login UNIQUE(company_id, login_id)
);

IF OBJECT_ID('dbo.crm_role') IS NULL
CREATE TABLE dbo.crm_role(
  role_id bigint IDENTITY(1,1) PRIMARY KEY,
  role_code varchar(50) NOT NULL UNIQUE,
  role_name nvarchar(100) NOT NULL,
  data_scope varchar(20) NOT NULL DEFAULT 'SELF',
  is_active bit NOT NULL DEFAULT 1
);

IF OBJECT_ID('dbo.crm_permission') IS NULL
CREATE TABLE dbo.crm_permission(
  permission_id bigint IDENTITY(1,1) PRIMARY KEY,
  permission_code varchar(100) NOT NULL UNIQUE,
  permission_name nvarchar(150) NOT NULL,
  is_active bit NOT NULL DEFAULT 1
);

IF OBJECT_ID('dbo.crm_user_role') IS NULL
CREATE TABLE dbo.crm_user_role(
  user_id bigint NOT NULL,
  role_id bigint NOT NULL,
  assigned_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY(user_id, role_id),
  FOREIGN KEY(user_id) REFERENCES dbo.crm_user(user_id),
  FOREIGN KEY(role_id) REFERENCES dbo.crm_role(role_id)
);

IF OBJECT_ID('dbo.crm_role_permission') IS NULL
CREATE TABLE dbo.crm_role_permission(
  role_id bigint NOT NULL,
  permission_id bigint NOT NULL,
  PRIMARY KEY(role_id, permission_id),
  FOREIGN KEY(role_id) REFERENCES dbo.crm_role(role_id),
  FOREIGN KEY(permission_id) REFERENCES dbo.crm_permission(permission_id)
);

IF OBJECT_ID('dbo.crm_common_code') IS NULL
CREATE TABLE dbo.crm_common_code(
  common_code_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NULL,
  group_code varchar(50) NOT NULL,
  code varchar(50) NOT NULL,
  code_name nvarchar(100) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active bit NOT NULL DEFAULT 1,
  deleted_yn bit NOT NULL DEFAULT 0,
  metadata_json nvarchar(max) NULL,
  CONSTRAINT UQ_common_code UNIQUE(company_id, group_code, code)
);

IF OBJECT_ID('dbo.crm_refresh_token') IS NULL
CREATE TABLE dbo.crm_refresh_token(
  refresh_token_id bigint IDENTITY(1,1) PRIMARY KEY,
  user_id bigint NOT NULL,
  token_hash char(64) NOT NULL,
  expires_at datetime2(0) NOT NULL,
  revoked_at datetime2(0) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  FOREIGN KEY(user_id) REFERENCES dbo.crm_user(user_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_refresh_token_hash' AND object_id=OBJECT_ID('dbo.crm_refresh_token'))
  CREATE INDEX IX_refresh_token_hash ON dbo.crm_refresh_token(token_hash);

IF OBJECT_ID('dbo.crm_audit_log') IS NULL
CREATE TABLE dbo.crm_audit_log(
  audit_log_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NOT NULL,
  actor_user_id bigint NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(100) NOT NULL,
  action varchar(80) NOT NULL,
  before_json nvarchar(max) NULL,
  after_json nvarchar(max) NULL,
  request_id uniqueidentifier NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_audit_entity' AND object_id=OBJECT_ID('dbo.crm_audit_log'))
  CREATE INDEX IX_audit_entity ON dbo.crm_audit_log(company_id, entity_type, entity_id, audit_log_id DESC);

IF OBJECT_ID('dbo.crm_interface_log') IS NULL
CREATE TABLE dbo.crm_interface_log(
  interface_log_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NOT NULL,
  request_id uniqueidentifier NOT NULL,
  interface_code varchar(50) NOT NULL,
  direction varchar(10) NOT NULL,
  entity_type varchar(80) NULL,
  entity_id varchar(100) NULL,
  request_json nvarchar(max) NULL,
  response_json nvarchar(max) NULL,
  status varchar(30) NOT NULL,
  retry_count int NOT NULL DEFAULT 0,
  requested_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  responded_at datetime2(0) NULL,
  error_message nvarchar(2000) NULL,
  CONSTRAINT UQ_interface_request UNIQUE(request_id)
);

IF OBJECT_ID('dbo.crm_file_metadata') IS NULL
CREATE TABLE dbo.crm_file_metadata(
  file_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  entity_type varchar(80) NOT NULL,
  entity_public_id varchar(100) NOT NULL,
  original_name nvarchar(255) NOT NULL,
  content_type varchar(150) NULL,
  size_bytes bigint NOT NULL,
  storage_key nvarchar(500) NOT NULL,
  created_by bigint NOT NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.crm_notification') IS NULL
CREATE TABLE dbo.crm_notification(
  notification_id bigint IDENTITY(1,1) PRIMARY KEY,
  user_id bigint NOT NULL,
  notification_type varchar(50) NOT NULL,
  title nvarchar(200) NOT NULL,
  body nvarchar(2000) NULL,
  data_json nvarchar(max) NULL,
  read_at datetime2(0) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  FOREIGN KEY(user_id) REFERENCES dbo.crm_user(user_id)
);

COMMIT;
