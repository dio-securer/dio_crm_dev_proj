SET XACT_ABORT ON;
BEGIN TRAN;

IF COL_LENGTH('dbo.crm_opportunity','amount') IS NULL ALTER TABLE dbo.crm_opportunity ADD amount decimal(18,2) NOT NULL CONSTRAINT DF_opp_amount DEFAULT 0;
IF COL_LENGTH('dbo.crm_opportunity','expected_close_date') IS NULL ALTER TABLE dbo.crm_opportunity ADD expected_close_date date NULL;
IF COL_LENGTH('dbo.crm_opportunity','success_probability') IS NULL ALTER TABLE dbo.crm_opportunity ADD success_probability decimal(5,2) NULL;
IF COL_LENGTH('dbo.crm_opportunity','forecast_category') IS NULL ALTER TABLE dbo.crm_opportunity ADD forecast_category varchar(30) NULL;
IF COL_LENGTH('dbo.crm_opportunity','interest_product') IS NULL ALTER TABLE dbo.crm_opportunity ADD interest_product nvarchar(500) NULL;
IF COL_LENGTH('dbo.crm_opportunity','special_terms') IS NULL ALTER TABLE dbo.crm_opportunity ADD special_terms nvarchar(4000) NULL;
IF COL_LENGTH('dbo.crm_opportunity','payment_method') IS NULL ALTER TABLE dbo.crm_opportunity ADD payment_method nvarchar(100) NULL;
IF COL_LENGTH('dbo.crm_opportunity','payment_date') IS NULL ALTER TABLE dbo.crm_opportunity ADD payment_date date NULL;
IF COL_LENGTH('dbo.crm_opportunity','installment_months') IS NULL ALTER TABLE dbo.crm_opportunity ADD installment_months int NULL;
IF COL_LENGTH('dbo.crm_opportunity','competitor_usage') IS NULL ALTER TABLE dbo.crm_opportunity ADD competitor_usage nvarchar(2000) NULL;
IF COL_LENGTH('dbo.crm_opportunity','owned_equipment') IS NULL ALTER TABLE dbo.crm_opportunity ADD owned_equipment nvarchar(2000) NULL;
IF COL_LENGTH('dbo.crm_opportunity','treatment_fee_info') IS NULL ALTER TABLE dbo.crm_opportunity ADD treatment_fee_info nvarchar(2000) NULL;
IF COL_LENGTH('dbo.crm_opportunity','contract_created_yn') IS NULL ALTER TABLE dbo.crm_opportunity ADD contract_created_yn bit NOT NULL CONSTRAINT DF_opp_contract_created DEFAULT 0;
IF COL_LENGTH('dbo.crm_opportunity','closed_reason') IS NULL ALTER TABLE dbo.crm_opportunity ADD closed_reason nvarchar(1000) NULL;
IF COL_LENGTH('dbo.crm_opportunity','deleted_yn') IS NULL ALTER TABLE dbo.crm_opportunity ADD deleted_yn bit NOT NULL CONSTRAINT DF_opp_deleted DEFAULT 0;

IF OBJECT_ID('dbo.crm_opportunity_stage_history') IS NULL
CREATE TABLE dbo.crm_opportunity_stage_history(
  opportunity_stage_history_id bigint IDENTITY(1,1) PRIMARY KEY,
  opportunity_id bigint NOT NULL,
  from_stage varchar(30) NOT NULL,
  to_stage varchar(30) NOT NULL,
  reason nvarchar(1000) NULL,
  transition_type varchar(30) NOT NULL DEFAULT 'NORMAL',
  changed_by bigint NOT NULL,
  changed_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_opp_stage_history_opp FOREIGN KEY(opportunity_id) REFERENCES dbo.crm_opportunity(opportunity_id)
);

IF OBJECT_ID('dbo.crm_product_package') IS NULL
CREATE TABLE dbo.crm_product_package(
  product_package_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  item_type varchar(30) NOT NULL,
  item_name nvarchar(200) NOT NULL,
  erp_item_code varchar(80) NULL,
  category nvarchar(100) NULL,
  base_price decimal(18,2) NOT NULL DEFAULT 0,
  source_system varchar(30) NOT NULL DEFAULT 'ERP',
  is_active bit NOT NULL DEFAULT 1,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_product_package_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id)
);
CREATE UNIQUE INDEX UX_product_package_public ON dbo.crm_product_package(company_id,public_id);
CREATE INDEX IX_product_package_search ON dbo.crm_product_package(company_id,item_type,is_active,deleted_yn,item_name);

IF OBJECT_ID('dbo.crm_opportunity_product') IS NULL
CREATE TABLE dbo.crm_opportunity_product(
  opportunity_product_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  opportunity_id bigint NOT NULL,
  product_package_id bigint NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  proposed_unit_price decimal(18,2) NOT NULL DEFAULT 0,
  note nvarchar(1000) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_opp_product_opp FOREIGN KEY(opportunity_id) REFERENCES dbo.crm_opportunity(opportunity_id),
  CONSTRAINT FK_opp_product_package FOREIGN KEY(product_package_id) REFERENCES dbo.crm_product_package(product_package_id),
  CONSTRAINT UQ_opp_product UNIQUE(opportunity_id,product_package_id)
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_opportunity_pipeline' AND object_id=OBJECT_ID('dbo.crm_opportunity'))
CREATE INDEX IX_opportunity_pipeline ON dbo.crm_opportunity(company_id,stage,owner_user_id,expected_close_date,deleted_yn) INCLUDE(amount,success_probability,forecast_category);

COMMIT;
