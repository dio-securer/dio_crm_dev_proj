SET XACT_ABORT ON;
BEGIN TRAN;

IF OBJECT_ID('dbo.crm_sales_area_owner') IS NULL
CREATE TABLE dbo.crm_sales_area_owner(
  sales_area_owner_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NOT NULL,
  sido nvarchar(50) NOT NULL,
  sigungu nvarchar(80) NOT NULL,
  owner_user_id bigint NOT NULL,
  priority int NOT NULL DEFAULT 100,
  source_system varchar(30) NOT NULL DEFAULT 'ERP',
  is_active bit NOT NULL DEFAULT 1,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_sales_area_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_sales_area_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sales_area_match' AND object_id=OBJECT_ID('dbo.crm_sales_area_owner'))
  CREATE INDEX IX_sales_area_match ON dbo.crm_sales_area_owner(company_id, sido, sigungu, is_active, priority);

IF OBJECT_ID('dbo.crm_lead') IS NULL
CREATE TABLE dbo.crm_lead(
  lead_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  owner_user_id bigint NULL,
  status varchar(30) NOT NULL DEFAULT 'NEW',
  lead_source varchar(30) NOT NULL DEFAULT 'HIRA',
  hospital_name nvarchar(200) NOT NULL,
  phone varchar(50) NULL,
  address nvarchar(500) NULL,
  sido nvarchar(50) NULL,
  sigungu nvarchar(80) NULL,
  eupmyeondong nvarchar(80) NULL,
  latitude decimal(10,7) NULL,
  longitude decimal(10,7) NULL,
  encrypted_provider_no varchar(200) NULL,
  provider_no varchar(50) NULL,
  open_date date NULL,
  business_no varchar(20) NULL,
  keyman_name nvarchar(100) NULL,
  keyman_type varchar(30) NULL,
  keyman_mobile varchar(50) NULL,
  keyman_email varchar(200) NULL,
  school nvarchar(100) NULL,
  cohort nvarchar(50) NULL,
  major nvarchar(100) NULL,
  main_system nvarchar(100) NULL,
  sub_system nvarchar(100) NULL,
  contact_exclude_reason nvarchar(500) NULL,
  hira_sync_exclude_yn bit NOT NULL DEFAULT 0,
  converted_at datetime2(0) NULL,
  converted_by bigint NULL,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_lead_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_lead_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_lead_hira_provider' AND object_id=OBJECT_ID('dbo.crm_lead'))
  CREATE UNIQUE INDEX UX_lead_hira_provider ON dbo.crm_lead(company_id, encrypted_provider_no) WHERE encrypted_provider_no IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_lead_owner_status' AND object_id=OBJECT_ID('dbo.crm_lead'))
  CREATE INDEX IX_lead_owner_status ON dbo.crm_lead(company_id, owner_user_id, status, deleted_yn);

IF OBJECT_ID('dbo.crm_lead_status_history') IS NULL
CREATE TABLE dbo.crm_lead_status_history(
  lead_status_history_id bigint IDENTITY(1,1) PRIMARY KEY,
  lead_id bigint NOT NULL,
  from_status varchar(30) NULL,
  to_status varchar(30) NOT NULL,
  reason nvarchar(500) NULL,
  changed_by bigint NOT NULL,
  changed_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_lead_status_lead FOREIGN KEY(lead_id) REFERENCES dbo.crm_lead(lead_id)
);

IF OBJECT_ID('dbo.crm_account') IS NULL
CREATE TABLE dbo.crm_account(
  account_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  account_name nvarchar(200) NOT NULL,
  account_status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  account_grade varchar(30) NULL,
  business_name nvarchar(200) NULL,
  business_no varchar(20) NULL,
  ceo_name nvarchar(100) NULL,
  provider_no varchar(50) NULL,
  tax_email varchar(200) NULL,
  phone varchar(50) NULL,
  address nvarchar(500) NULL,
  latitude decimal(10,7) NULL,
  longitude decimal(10,7) NULL,
  erp_customer_code varchar(50) NULL,
  erp_approved_yn bit NOT NULL DEFAULT 0,
  integration_status varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED',
  merged_into_account_id bigint NULL,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_account_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_account_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id),
  CONSTRAINT FK_account_merged FOREIGN KEY(merged_into_account_id) REFERENCES dbo.crm_account(account_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_account_business_no' AND object_id=OBJECT_ID('dbo.crm_account'))
  CREATE INDEX IX_account_business_no ON dbo.crm_account(company_id, business_no, deleted_yn);

IF OBJECT_ID('dbo.crm_contact') IS NULL
CREATE TABLE dbo.crm_contact(
  contact_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  account_id bigint NOT NULL,
  contact_type varchar(30) NULL,
  contact_name nvarchar(100) NOT NULL,
  mobile varchar(50) NULL,
  email varchar(200) NULL,
  school nvarchar(100) NULL,
  cohort nvarchar(50) NULL,
  major nvarchar(100) NULL,
  note nvarchar(1000) NULL,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_contact_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_contact_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id)
);

IF OBJECT_ID('dbo.crm_opportunity') IS NULL
CREATE TABLE dbo.crm_opportunity(
  opportunity_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  account_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  opportunity_name nvarchar(200) NOT NULL,
  stage varchar(30) NOT NULL DEFAULT 'NEEDS_ANALYSIS',
  record_type varchar(30) NOT NULL DEFAULT 'NEW',
  converted_from_lead_id bigint NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_opp_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_opp_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_opp_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id),
  CONSTRAINT FK_opp_lead FOREIGN KEY(converted_from_lead_id) REFERENCES dbo.crm_lead(lead_id)
);

IF OBJECT_ID('dbo.crm_lead_conversion_history') IS NULL
CREATE TABLE dbo.crm_lead_conversion_history(
  conversion_id bigint IDENTITY(1,1) PRIMARY KEY,
  lead_id bigint NOT NULL,
  account_id bigint NOT NULL,
  contact_id bigint NULL,
  opportunity_id bigint NOT NULL,
  converted_by bigint NOT NULL,
  converted_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_lead_conversion UNIQUE(lead_id),
  CONSTRAINT FK_conversion_lead FOREIGN KEY(lead_id) REFERENCES dbo.crm_lead(lead_id),
  CONSTRAINT FK_conversion_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_conversion_contact FOREIGN KEY(contact_id) REFERENCES dbo.crm_contact(contact_id),
  CONSTRAINT FK_conversion_opp FOREIGN KEY(opportunity_id) REFERENCES dbo.crm_opportunity(opportunity_id)
);

IF OBJECT_ID('dbo.crm_account_merge_history') IS NULL
CREATE TABLE dbo.crm_account_merge_history(
  account_merge_history_id bigint IDENTITY(1,1) PRIMARY KEY,
  primary_account_id bigint NOT NULL,
  merged_account_id bigint NOT NULL,
  merge_snapshot_json nvarchar(max) NULL,
  merged_by bigint NOT NULL,
  merged_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_merge_primary FOREIGN KEY(primary_account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_merge_merged FOREIGN KEY(merged_account_id) REFERENCES dbo.crm_account(account_id)
);

IF OBJECT_ID('dbo.crm_hira_hospital_inbox') IS NULL
CREATE TABLE dbo.crm_hira_hospital_inbox(
  hira_inbox_id bigint IDENTITY(1,1) PRIMARY KEY,
  company_id bigint NOT NULL,
  batch_id uniqueidentifier NOT NULL,
  encrypted_provider_no varchar(200) NOT NULL,
  hospital_name nvarchar(200) NOT NULL,
  payload_json nvarchar(max) NOT NULL,
  received_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  processed_at datetime2(0) NULL,
  process_status varchar(30) NOT NULL DEFAULT 'RECEIVED',
  error_message nvarchar(2000) NULL,
  CONSTRAINT FK_hira_inbox_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_hira_inbox_batch' AND object_id=OBJECT_ID('dbo.crm_hira_hospital_inbox'))
  CREATE INDEX IX_hira_inbox_batch ON dbo.crm_hira_hospital_inbox(company_id, batch_id, process_status);

COMMIT;
