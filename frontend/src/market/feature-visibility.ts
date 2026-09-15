import type { GlobalizationContext, MarketFeatureKey } from '@dio-crm/contracts';

export function isFeatureVisible(context: GlobalizationContext, key: MarketFeatureKey) {
  return context.features[key] === true;
}
