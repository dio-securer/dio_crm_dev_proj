import { ACCOUNT_INTERFACE_FIELDS } from '@dio-crm/contracts';
import type { HqCapabilities } from '@dio-crm/contracts';
import { HQ_ACCOUNT_FIELD_PROFILE } from '../market/field-profiles/HQ_ACCOUNT';
import { KR_MARKET_PROFILE } from '../market/profiles/KR';
import { HQ_SCREEN_KEYS } from '../market/templates/hq/hq-screen-manifest';
import { APP_ROUTES } from './route-config';
import { HQ_SCREEN_PROFILE } from './screen-profile';
import { createHqStandardRegistry, HQ_CATALOG_IDS } from './hq-standard-registry';

/** H01 does not switch App's live routes or GLOBAL screen profile. */
export const HQ_CAPABILITIES: HqCapabilities = {
  screens: HQ_SCREEN_KEYS.map(screenKey => {
    const route=APP_ROUTES.find(item=>HQ_SCREEN_PROFILE.screens[item.slot] === screenKey);
    return {screenKey,routeKey:route?.slot ?? '',path:route?.path ?? ''};
  }),
  catalogIds: HQ_CATALOG_IDS,
  featureKeys: Object.keys(KR_MARKET_PROFILE.features)
};

export const HQ_STANDARD = createHqStandardRegistry({
  screenBindings:HQ_CAPABILITIES.screens,
  accountInterfaceFields:ACCOUNT_INTERFACE_FIELDS,
  accountFieldProfile:HQ_ACCOUNT_FIELD_PROFILE,
  featureKeys:HQ_CAPABILITIES.featureKeys
});
