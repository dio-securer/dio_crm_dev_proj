import type { CountryProfile } from '../types';

/**
 * M2 baseline only. MX operational locale/timezone/workflow/integration values are not
 * approved in this step and will be completed in M8 after country configuration review.
 */
export const MX_COUNTRY_PROFILE: CountryProfile = {
  countryCode: 'MX',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  status: 'BASELINE_ONLY'
};
