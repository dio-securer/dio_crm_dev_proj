import type { MarketProfile } from '../types';

export const KR_MARKET_PROFILE: MarketProfile = {
  code: 'KR_SALES',
  countryCode: 'KR',
  defaultLocale: 'ko-KR',
  currencyCode: 'KRW',
  timezone: 'Asia/Seoul',
  workflowProfileCode: 'KR_SALES_APPROVAL',
  mapProfileCode: 'KR_DEFAULT',
  features: {
    HIRA_IMPORT: true,
    DIRECT_WORK: true,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: true
  }
};
