IF COL_LENGTH('dbo.crm_account','encrypted_provider_no') IS NULL ALTER TABLE dbo.crm_account ADD encrypted_provider_no nvarchar(100) NULL;
IF COL_LENGTH('dbo.crm_account','zip_code') IS NULL ALTER TABLE dbo.crm_account ADD zip_code varchar(20) NULL;
IF COL_LENGTH('dbo.crm_account','address_line1') IS NULL ALTER TABLE dbo.crm_account ADD address_line1 nvarchar(400) NULL;
IF COL_LENGTH('dbo.crm_account','address_line2') IS NULL ALTER TABLE dbo.crm_account ADD address_line2 nvarchar(400) NULL;
IF COL_LENGTH('dbo.crm_account','hospital_address') IS NULL ALTER TABLE dbo.crm_account ADD hospital_address nvarchar(400) NULL;
IF COL_LENGTH('dbo.crm_account','open_date') IS NULL ALTER TABLE dbo.crm_account ADD open_date date NULL;
IF COL_LENGTH('dbo.crm_account','doctor_license_no') IS NULL ALTER TABLE dbo.crm_account ADD doctor_license_no nvarchar(500) NULL;
IF COL_LENGTH('dbo.crm_account','account_type') IS NULL ALTER TABLE dbo.crm_account ADD account_type varchar(20) NULL;
IF COL_LENGTH('dbo.crm_account','fax') IS NULL ALTER TABLE dbo.crm_account ADD fax nvarchar(50) NULL;
IF COL_LENGTH('dbo.crm_account','homepage') IS NULL ALTER TABLE dbo.crm_account ADD homepage varchar(100) NULL;
IF COL_LENGTH('dbo.crm_account','erp_trade_code') IS NULL ALTER TABLE dbo.crm_account ADD erp_trade_code varchar(10) NULL;
IF COL_LENGTH('dbo.crm_account','erp_approval_code') IS NULL ALTER TABLE dbo.crm_account ADD erp_approval_code varchar(10) NULL;
IF COL_LENGTH('dbo.crm_account','use_yn') IS NULL ALTER TABLE dbo.crm_account ADD use_yn char(1) NOT NULL CONSTRAINT DF_account_use_yn DEFAULT('1');
IF COL_LENGTH('dbo.crm_account','churn_risk_yn') IS NULL ALTER TABLE dbo.crm_account ADD churn_risk_yn bit NOT NULL CONSTRAINT DF_account_churn_risk DEFAULT(0);
IF COL_LENGTH('dbo.crm_account','account_stat_code') IS NULL ALTER TABLE dbo.crm_account ADD account_stat_code char(1) NULL;

IF NOT EXISTS (SELECT 1 FROM dbo.crm_common_code WHERE group_code='ACCOUNT_STATUS' AND code='NEW' AND company_id IS NULL)
  INSERT INTO dbo.crm_common_code(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
  VALUES(NULL,'ACCOUNT_STATUS','NEW',N'신규',5,1,0);
IF NOT EXISTS (SELECT 1 FROM dbo.crm_common_code WHERE group_code='ACCOUNT_STATUS' AND code='NON_TRADING_OPP' AND company_id IS NULL)
  INSERT INTO dbo.crm_common_code(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
  VALUES(NULL,'ACCOUNT_STATUS','NON_TRADING_OPP',N'비거래처_기회',25,1,0);
IF NOT EXISTS (SELECT 1 FROM dbo.crm_common_code WHERE group_code='ACCOUNT_STATUS' AND code='CLOSED' AND company_id IS NULL)
  INSERT INTO dbo.crm_common_code(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
  VALUES(NULL,'ACCOUNT_STATUS','CLOSED',N'폐업',45,1,0);
IF NOT EXISTS (SELECT 1 FROM dbo.crm_common_code WHERE group_code='ACCOUNT_TYPE' AND code='BC505600' AND company_id IS NULL)
  INSERT INTO dbo.crm_common_code(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
  VALUES(NULL,'ACCOUNT_TYPE','BC505600',N'의원',10,1,0);
IF NOT EXISTS (SELECT 1 FROM dbo.crm_common_code WHERE group_code='ACCOUNT_TYPE' AND code='BC505800' AND company_id IS NULL)
  INSERT INTO dbo.crm_common_code(company_id,group_code,code,code_name,sort_order,is_active,deleted_yn)
  VALUES(NULL,'ACCOUNT_TYPE','BC505800',N'병원',20,1,0);
