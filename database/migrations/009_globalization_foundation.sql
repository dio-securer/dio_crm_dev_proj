-- CRM-GL-001 Globalization Foundation
-- SOURCE BASELINE ONLY. Review company values before DEV/UAT apply.
SET XACT_ABORT ON;
BEGIN TRAN;

IF COL_LENGTH('dbo.crm_company','country_code') IS NULL
  ALTER TABLE dbo.crm_company ADD country_code char(2) NULL;
IF COL_LENGTH('dbo.crm_company','default_locale') IS NULL
  ALTER TABLE dbo.crm_company ADD default_locale varchar(20) NULL;
IF COL_LENGTH('dbo.crm_company','default_currency') IS NULL
  ALTER TABLE dbo.crm_company ADD default_currency char(3) NULL;
IF COL_LENGTH('dbo.crm_company','default_timezone') IS NULL
  ALTER TABLE dbo.crm_company ADD default_timezone varchar(80) NULL;
IF COL_LENGTH('dbo.crm_company','market_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD market_profile_code varchar(50) NULL;
IF COL_LENGTH('dbo.crm_company','workflow_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD workflow_profile_code varchar(50) NULL;
IF COL_LENGTH('dbo.crm_company','map_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD map_profile_code varchar(50) NULL;

IF COL_LENGTH('dbo.crm_user','preferred_locale') IS NULL
  ALTER TABLE dbo.crm_user ADD preferred_locale varchar(20) NULL;
IF COL_LENGTH('dbo.crm_user','timezone_override') IS NULL
  ALTER TABLE dbo.crm_user ADD timezone_override varchar(80) NULL;

-- Existing source baseline is KR. Confirm company-by-company before environment apply.
UPDATE dbo.crm_company SET
  country_code = COALESCE(country_code, 'KR'),
  default_locale = COALESCE(default_locale, 'ko-KR'),
  default_currency = COALESCE(default_currency, 'KRW'),
  default_timezone = COALESCE(default_timezone, 'Asia/Seoul'),
  market_profile_code = COALESCE(market_profile_code, 'KR_SALES'),
  workflow_profile_code = COALESCE(workflow_profile_code, 'KR_SALES_APPROVAL'),
  map_profile_code = COALESCE(map_profile_code, 'KR_DEFAULT');

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_crm_company_country_code')
  ALTER TABLE dbo.crm_company ADD CONSTRAINT CK_crm_company_country_code CHECK (country_code IS NULL OR country_code LIKE '[A-Z][A-Z]');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_crm_company_market_profile' AND object_id=OBJECT_ID('dbo.crm_company'))
  CREATE INDEX IX_crm_company_market_profile ON dbo.crm_company(market_profile_code, country_code);

COMMIT;
