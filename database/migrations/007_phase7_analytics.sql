SET XACT_ABORT ON;
BEGIN TRAN;

IF OBJECT_ID('dbo.crm_statement_generation') IS NULL
CREATE TABLE dbo.crm_statement_generation(
  statement_generation_id bigint IDENTITY(1,1) PRIMARY KEY,
  public_id uniqueidentifier NOT NULL DEFAULT NEWID(),
  company_id bigint NOT NULL,
  account_id bigint NOT NULL,
  contract_id bigint NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  general_trade_yn bit NOT NULL DEFAULT 0,
  selected_sales_ids_json nvarchar(max) NULL,
  file_name nvarchar(255) NOT NULL,
  line_count int NOT NULL DEFAULT 0,
  total_amount decimal(18,2) NOT NULL DEFAULT 0,
  storage_status varchar(30) NOT NULL DEFAULT 'NOT_STORED',
  generated_by bigint NOT NULL,
  generated_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_statement_company FOREIGN KEY(company_id) REFERENCES dbo.crm_company(company_id),
  CONSTRAINT FK_statement_account FOREIGN KEY(account_id) REFERENCES dbo.crm_account(account_id),
  CONSTRAINT FK_statement_contract FOREIGN KEY(contract_id) REFERENCES dbo.crm_contract(contract_id),
  CONSTRAINT FK_statement_user FOREIGN KEY(generated_by) REFERENCES dbo.crm_user(user_id)
);
CREATE INDEX IX_statement_account_period ON dbo.crm_statement_generation(company_id,account_id,period_from,period_to,generated_at DESC);

COMMIT;
