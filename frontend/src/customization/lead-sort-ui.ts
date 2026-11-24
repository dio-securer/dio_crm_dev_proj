import {resolveCompanyConfig, type CompanyConfig, type ConfigCatalog} from '@dio-crm/contracts/crm-customization';
import {resolvedLeadColumnOrder} from '@dio-crm/contracts/lead-grid-columns';

/** Configuration-level eligibility; each user's read/masking permissions remain server enforced. */
export function canConfigureLeadSort(catalog:ConfigCatalog,config:CompanyConfig):boolean{
  const field=resolveCompanyConfig(catalog,config).entries.find(item=>item.id==='lead.updatedAt');
  return !!field && field.kind==='FIELD' && field.screenId==='HQ_LEAD' && field.support==='supported' && field.settings.enabled && field.settings.visible && field.settings.masking!=='redact' && resolvedLeadColumnOrder(config).includes('lead.updatedAt');
}
