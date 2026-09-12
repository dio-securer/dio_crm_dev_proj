SET XACT_ABORT ON;
BEGIN TRAN;

IF COL_LENGTH('dbo.crm_product_package','current_unit_price') IS NULL ALTER TABLE dbo.crm_product_package ADD current_unit_price decimal(18,2) NULL;
IF COL_LENGTH('dbo.crm_product_package','stock_qty') IS NULL ALTER TABLE dbo.crm_product_package ADD stock_qty decimal(18,3) NULL;
IF COL_LENGTH('dbo.crm_product_package','order_available_yn') IS NULL ALTER TABLE dbo.crm_product_package ADD order_available_yn bit NOT NULL CONSTRAINT DF_product_order_available DEFAULT 1;
IF COL_LENGTH('dbo.crm_product_package','erp_synced_at') IS NULL ALTER TABLE dbo.crm_product_package ADD erp_synced_at datetime2(0) NULL;

IF OBJECT_ID('dbo.crm_order') IS NULL
CREATE TABLE dbo.crm_order(
  order_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  contract_id bigint NOT NULL,
  account_id bigint NOT NULL,
  owner_user_id bigint NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  integration_status varchar(30) NOT NULL DEFAULT 'NOT_REQUESTED',
  delivery_address_type varchar(30) NULL,
  delivery_address nvarchar(500) NULL,
  express_yn bit NOT NULL DEFAULT 0,
  note nvarchar(2000) NULL,
  erp_order_no varchar(100) NULL,
  last_erp_request_id uniqueidentifier NULL,
  requested_at datetime2(0) NULL,
  erp_updated_at datetime2(0) NULL,
  deleted_yn bit NOT NULL DEFAULT 0,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_order_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_order_contract FOREIGN KEY(contract_id) REFERENCES dbo.crm_contract(contract_id),
  CONSTRAINT FK_order_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_order_owner FOREIGN KEY(owner_user_id) REFERENCES dbo.crm_user(user_id)
);
CREATE UNIQUE INDEX UX_order_public ON dbo.crm_order(company_id,public_id);
CREATE INDEX IX_order_contract_status ON dbo.crm_order(company_id,contract_id,status,deleted_yn);
CREATE UNIQUE INDEX UX_order_erp_no ON dbo.crm_order(company_id,erp_order_no) WHERE erp_order_no IS NOT NULL;

IF OBJECT_ID('dbo.crm_order_item') IS NULL
CREATE TABLE dbo.crm_order_item(
  order_item_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  order_id bigint NOT NULL,
  product_package_id bigint NULL,
  erp_item_code varchar(80) NULL,
  item_name nvarchar(200) NOT NULL,
  item_type varchar(30) NULL,
  category nvarchar(100) NULL,
  quantity int NOT NULL,
  unit_price decimal(18,2) NOT NULL,
  package_discount_price decimal(18,2) NULL,
  order_available_yn bit NOT NULL DEFAULT 1,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  created_by bigint NULL,
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_by bigint NULL,
  row_version rowversion,
  CONSTRAINT FK_order_item_order FOREIGN KEY(order_id) REFERENCES dbo.crm_order(order_id),
  CONSTRAINT FK_order_item_product FOREIGN KEY(product_package_id) REFERENCES dbo.crm_product_package(product_package_id)
);
CREATE UNIQUE INDEX UX_order_item_product ON dbo.crm_order_item(order_id,product_package_id) WHERE product_package_id IS NOT NULL;

IF OBJECT_ID('dbo.crm_delivery') IS NULL
CREATE TABLE dbo.crm_delivery(
  delivery_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  order_id bigint NOT NULL,
  erp_delivery_no varchar(100) NOT NULL,
  delivery_status varchar(50) NOT NULL,
  shipped_at datetime2(0) NULL,
  delivered_at datetime2(0) NULL,
  payload_json nvarchar(max) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_delivery_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_delivery_order FOREIGN KEY(order_id) REFERENCES dbo.crm_order(order_id),
  CONSTRAINT UQ_delivery_erp UNIQUE(company_id,erp_delivery_no)
);
CREATE INDEX IX_delivery_order ON dbo.crm_delivery(company_id,order_id,delivery_status);

IF OBJECT_ID('dbo.crm_sales') IS NULL
CREATE TABLE dbo.crm_sales(
  sales_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  account_id bigint NOT NULL,
  contract_id bigint NULL,
  order_id bigint NULL,
  erp_sales_no varchar(100) NOT NULL,
  sales_date date NOT NULL,
  amount decimal(18,2) NOT NULL,
  item_code varchar(80) NULL,
  item_name nvarchar(200) NULL,
  quantity decimal(18,3) NULL,
  payload_json nvarchar(max) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_sales_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_sales_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_sales_contract FOREIGN KEY(contract_id) REFERENCES dbo.crm_contract(contract_id),
  CONSTRAINT FK_sales_order FOREIGN KEY(order_id) REFERENCES dbo.crm_order(order_id),
  CONSTRAINT UQ_sales_erp UNIQUE(company_id,erp_sales_no)
);
CREATE INDEX IX_sales_account_date ON dbo.crm_sales(company_id,account_id,sales_date);

IF OBJECT_ID('dbo.crm_return_exchange') IS NULL
CREATE TABLE dbo.crm_return_exchange(
  return_exchange_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  order_id bigint NULL,
  sales_id bigint NULL,
  erp_reference_no varchar(100) NOT NULL,
  transaction_type varchar(20) NOT NULL,
  status varchar(50) NOT NULL,
  item_code varchar(80) NULL,
  quantity decimal(18,3) NULL,
  processed_at datetime2(0) NULL,
  payload_json nvarchar(max) NULL,
  created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_return_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_return_order FOREIGN KEY(order_id) REFERENCES dbo.crm_order(order_id),
  CONSTRAINT FK_return_sales FOREIGN KEY(sales_id) REFERENCES dbo.crm_sales(sales_id),
  CONSTRAINT CK_return_type CHECK(transaction_type IN('RETURN','EXCHANGE')),
  CONSTRAINT UQ_return_erp UNIQUE(company_id,erp_reference_no)
);
CREATE INDEX IX_return_order ON dbo.crm_return_exchange(company_id,order_id,status);

COMMIT;
