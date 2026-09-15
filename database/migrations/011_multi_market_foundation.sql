-- RM-MKT-001 M9 Multi-Market DB Foundation
-- SOURCE ONLY. Do not execute against DEV/UAT without the separate environment gate,
-- backup/snapshot verification, and CRM_ALLOW_DB_MUTATION=YES. Production is out of scope.
SET XACT_ABORT ON;
BEGIN TRAN;

-- Existing globalization columns from 009 are preserved. M9 only appends the
-- profile codes required by the approved Multi-Market architecture.
IF COL_LENGTH('dbo.crm_company','market_template_code') IS NULL
  ALTER TABLE dbo.crm_company ADD market_template_code varchar(50) NULL;
IF COL_LENGTH('dbo.crm_company','screen_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD screen_profile_code varchar(50) NULL;
IF COL_LENGTH('dbo.crm_company','field_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD field_profile_code varchar(50) NULL;
IF COL_LENGTH('dbo.crm_company','feature_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD feature_profile_code varchar(50) NULL;
IF COL_LENGTH('dbo.crm_company','integration_profile_code') IS NULL
  ALTER TABLE dbo.crm_company ADD integration_profile_code varchar(50) NULL;

-- Backfill only architecture values already approved by RM-MKT-001.
-- Existing non-NULL values are never overwritten.
-- Locale/currency/timezone/map/workflow/provider values are intentionally NOT inferred here.
UPDATE dbo.crm_company
SET
  market_template_code = CASE
    WHEN market_template_code IS NOT NULL THEN market_template_code
    WHEN country_code = 'KR' THEN 'HQ_TEMPLATE'
    WHEN country_code IN ('US','MX') THEN 'GLOBAL_TEMPLATE'
    ELSE NULL
  END,
  screen_profile_code = CASE
    WHEN screen_profile_code IS NOT NULL THEN screen_profile_code
    WHEN country_code = 'KR' THEN 'HQ_SCREEN_PROFILE'
    WHEN country_code IN ('US','MX') THEN 'GLOBAL_SCREEN_PROFILE'
    ELSE NULL
  END,
  field_profile_code = CASE
    WHEN field_profile_code IS NOT NULL THEN field_profile_code
    WHEN country_code = 'KR' THEN 'HQ_FIELD_PROFILE'
    WHEN country_code IN ('US','MX') THEN 'GLOBAL_FIELD_PROFILE'
    ELSE NULL
  END,
  feature_profile_code = CASE
    WHEN feature_profile_code IS NOT NULL THEN feature_profile_code
    WHEN country_code = 'KR' THEN 'HQ_FEATURE_PROFILE'
    WHEN country_code IN ('US','MX') THEN 'GLOBAL_FEATURE_PROFILE'
    ELSE NULL
  END,
  integration_profile_code = CASE
    WHEN integration_profile_code IS NOT NULL THEN integration_profile_code
    WHEN country_code = 'KR' THEN 'HQ_INTEGRATION_PROFILE'
    WHEN country_code IN ('US','MX') THEN 'GLOBAL_INTEGRATION_PROFILE'
    ELSE NULL
  END
WHERE country_code IN ('KR','US','MX');

-- Keep the schema open for future approved countries; do not constrain profile values
-- to today's KR/US/MX registry. The index supports company/profile diagnostics and rollout checks.
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name='IX_crm_company_multi_market_profile'
    AND object_id=OBJECT_ID('dbo.crm_company')
)
  CREATE INDEX IX_crm_company_multi_market_profile
    ON dbo.crm_company(country_code, market_template_code)
    INCLUDE (market_profile_code, screen_profile_code, field_profile_code, feature_profile_code, integration_profile_code);

-- No crm_account_market_attribute/EAV table is created in M9 because no approved
-- country-specific attribute requirement exists yet. That decision is deferred to Fit/Gap.

COMMIT;
