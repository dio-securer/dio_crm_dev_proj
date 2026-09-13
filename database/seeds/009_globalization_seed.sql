-- CRM-GL-001 Globalization seed baseline
-- Do not run in DEV/UAT/Production until company values are reviewed.
SET XACT_ABORT ON;
BEGIN TRAN;

UPDATE dbo.crm_company SET
  country_code = COALESCE(country_code, 'KR'),
  default_locale = COALESCE(default_locale, 'ko-KR'),
  default_currency = COALESCE(default_currency, 'KRW'),
  default_timezone = COALESCE(default_timezone, 'Asia/Seoul'),
  market_profile_code = COALESCE(market_profile_code, 'KR_SALES'),
  workflow_profile_code = COALESCE(workflow_profile_code, 'KR_SALES_APPROVAL'),
  map_profile_code = COALESCE(map_profile_code, 'KR_DEFAULT')
WHERE is_active=1;

COMMIT;
