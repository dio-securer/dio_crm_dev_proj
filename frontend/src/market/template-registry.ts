import type { MarketTemplateCode } from '@dio-crm/contracts';
import { GLOBAL_TEMPLATE } from './templates/GLOBAL';
import { HQ_TEMPLATE } from './templates/HQ';
import type { MarketTemplateDefinition } from './types';

const registry = new Map<MarketTemplateCode, MarketTemplateDefinition>([
  [HQ_TEMPLATE.code, HQ_TEMPLATE],
  [GLOBAL_TEMPLATE.code, GLOBAL_TEMPLATE]
]);

export function getMarketTemplate(code: MarketTemplateCode): MarketTemplateDefinition | undefined {
  return registry.get(code);
}
