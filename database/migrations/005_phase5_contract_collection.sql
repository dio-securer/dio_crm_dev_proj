SET XACT_ABORT ON;
BEGIN TRAN;

IF COL_LENGTH('dbo.crm_account','last_erp_request_id') IS NULL ALTER TABLE dbo.crm_account ADD last_erp_request_id uniqueidentifier NULL;
IF COL_LENGTH('dbo.crm_account','erp_requested_at') IS NULL ALTER TABLE dbo.crm_account ADD erp_requested_at datetime2(0) NULL;

IF OBJECT_ID('dbo.crm_contract') IS NULL
CREATE TABLE dbo.crm_contract(
  contract_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  account_id bigint NOT NULL,
  opportunity_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  contract_name nvarchar(200) NOT NULL,
  contract_date date NULL,
  contract_amount decimal(18,2) NOT NULL,
  product_amount decimal(18,2) NOT NULL DEFAULT 0,
  goods_amount decimal(18,2) NOT NULL DEFAULT 0,
  package_classification nvarchar(100) NULL,
  special_terms nvarchar(4000) NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  erp_contract_no varchar(80) NULL,
  erp_approval_status varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED',
  integration_status varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED',
  last_erp_request_id uniqueidentifier NULL,
  erp_requested_at datetime2(0) NULL,
  erp_approved_at datetime2(0) NULL,
  close_yn bit NOT NULL DEFAULT 0,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT UQ_contract_opportunity UNIQUE(opportunity_id),
  CONSTRAINT FK_contract_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_contract_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_contract_opportunity FOREIGN KEY(opportunity_id) REFERENCES dbo.crm_opportunity(opportunity_id),
  CONSTRAINT FK_contract_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id)
);
CREATE UNIQUE INDEX UX_contract_public ON dbo.crm_contract(company_id,public_id);
CREATE INDEX IX_contract_account_status ON dbo.crm_contract(company_id,account_id,status,deleted_yn);

IF OBJECT_ID('dbo.crm_contract_product') IS NULL
CREATE TABLE dbo.crm_contract_product(
  contract_product_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  contract_id bigint NOT NULL,
  item_type varchar(30) NOT NULL,
  item_name nvarchar(200) NOT NULL,
  erp_item_code varchar(80) NULL,
  quantity int NOT NULL,
  unit_price decimal(18,2) NOT NULL,
  line_amount decimal(18,2) NOT NULL,
  source_opportunity_product_id bigint NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_contract_product_contract FOREIGN KEY(contract_id) REFERENCES dbo.crm_contract(contract_id),
  CONSTRAINT FK_contract_product_oppproduct FOREIGN KEY(source_opportunity_product_id) REFERENCES dbo.crm_opportunity_product(opportunity_product_id)
);

IF OBJECT_ID('dbo.crm_collection_plan') IS NULL
CREATE TABLE dbo.crm_collection_plan(
  collection_plan_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  contract_id bigint NOT NULL,
  plan_version int NOT NULL DEFAULT 1,
  installment_no int NOT NULL,
  collection_method nvarchar(100) NOT NULL,
  amount decimal(18,2) NOT NULL,
  planned_date date NOT NULL,
  adjustment_type varchar(30) NOT NULL DEFAULT 'ORIGINAL',
  is_current bit NOT NULL DEFAULT 1,
  locked_yn bit NOT NULL DEFAULT 0,
  correction_required_yn bit NOT NULL DEFAULT 0,
  erp_sync_status varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED',
  last_erp_request_id uniqueidentifier NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  CONSTRAINT FK_collection_plan_contract FOREIGN KEY(contract_id) REFERENCES dbo.crm_contract(contract_id),
  CONSTRAINT UQ_collection_plan_version UNIQUE(contract_id,plan_version,installment_no)
);
CREATE INDEX IX_collection_plan_current ON dbo.crm_collection_plan(contract_id,is_current,planned_date);

IF OBJECT_ID('dbo.crm_collection_actual') IS NULL
CREATE TABLE dbo.crm_collection_actual(
  collection_actual_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  contract_id bigint NOT NULL,
  erp_collection_no varchar(100) NOT NULL,
  amount decimal(18,2) NOT NULL,
  collected_at datetime2(0) NOT NULL,
  source_system varchar(30) NOT NULL DEFAULT 'ERP',
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_collection_actual_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_collection_actual_contract FOREIGN KEY(contract_id) REFERENCES dbo.crm_contract(contract_id),
  CONSTRAINT UQ_collection_actual_erp UNIQUE(contract_id,erp_collection_no)
);
CREATE INDEX IX_collection_actual_contract ON dbo.crm_collection_actual(company_id,contract_id,collected_at);

COMMIT;
