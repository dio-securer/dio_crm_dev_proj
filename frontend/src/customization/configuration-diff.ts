import type {CompanyConfig} from '@dio-crm/contracts/crm-customization';
export function configurationDiff(before:CompanyConfig,after:CompanyConfig):Array<{path:string;before:unknown;after:unknown}>{
 const flatten=(c:CompanyConfig)=>{
  const values:Record<string,unknown>={'standard':c.baseStandardReleaseId,'locales':c.activeLocales,'defaultLocale':c.defaultLocale,'leadGridColumns':c.leadGridColumns??[],'leadListOrder':c.leadListOrder??null};
  if(c.leadGrid?.pageSize!==undefined)values['grid/lead.list/pageSize']=c.leadGrid.pageSize;
  if(c.leadGrid?.density!==undefined)values['grid/lead.list/density']=c.leadGrid.density;
  if(c.leadGrid?.defaultSort!==undefined)values['grid/lead.list/defaultSort']=c.leadGrid.defaultSort;
  for(const [id,width] of Object.entries(c.leadColumnWidths?.values??{}))values[`grid/lead.list/column/${id}/width`]=width;
  for(const [id,alignment] of Object.entries(c.leadColumnAlignments?.values??{}))values[`grid/lead.list/column/${id}/textAlign`]=alignment;
  for(const [id,emphasis] of Object.entries(c.buttonPresentation?.values??{}))values[`button/${id}/emphasis`]=emphasis;
  for(const [id,popup] of Object.entries(c.popupPresentation?.values??{})){if(popup.size!==undefined)values[`popup/${id}/size`]=popup.size;for(const [locale,title] of Object.entries(popup.titles??{}))values[`popup/${id}/title/${locale}`]=title;}
  for(const p of c.patches)values[`setting/${p.targetId}/${p.property}`]=p.operation==='reset'?null:p.value;
  for(const [locale,items] of Object.entries(c.translations))for(const [key,value]of Object.entries(items))values[`translation/${locale}/${key}`]=value;
  for(const [region,ids]of Object.entries(c.placementOrders??{}))values[`placement/${region}`]=ids;
  for(const [placement,locales] of Object.entries(c.placementPresentation?.values??{}))for(const [locale,text] of Object.entries(locales))for(const [key,value] of Object.entries(text)) values[`presentation/${placement}/${locale}/${key}`]=value;
  return values;
 };
 const left=flatten(before),right=flatten(after);
 return [...new Set([...Object.keys(left),...Object.keys(right)])].sort().filter(path=>JSON.stringify(left[path]??null)!==JSON.stringify(right[path]??null)).map(path=>({path,before:left[path]??null,after:right[path]??null}));
}
