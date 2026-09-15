import { describe, expect, it } from 'vitest';
import type { GlobalizationContext } from '@dio-crm/contracts';
import { isFeatureVisible } from './feature-visibility';

const context: GlobalizationContext = {
  locale: 'en-US',
  countryCode: 'US',
  currencyCode: 'USD',
  timezone: 'America/New_York',
  marketProfileCode: 'US_TEST_ONLY',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  screenProfileCode: 'GLOBAL_SCREEN_PROFILE',
  fieldProfileCode: 'GLOBAL_FIELD_PROFILE',
  featureProfileCode: 'GLOBAL_FEATURE_PROFILE',
  workflowProfileCode: 'GLOBAL_SALES_APPROVAL_BASELINE',
  integrationProfileCode: 'GLOBAL_INTEGRATION_PROFILE',
  mapProfileCode: 'GLOBAL_TEST_ONLY',
  features: {
    HIRA_IMPORT: false,
    DIRECT_WORK: false,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: false
  }
};

describe('M5 frontend feature visibility', () => {
  it('shows only server-resolved enabled features', () => {
    expect(isFeatureVisible(context, 'GPS_CHECKIN')).toBe(true);
    expect(isFeatureVisible(context, 'ACTIVITY_APPROVAL')).toBe(true);
    expect(isFeatureVisible(context, 'DIRECT_WORK')).toBe(false);
  });
});
