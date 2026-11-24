import {canonicalConfigJson,placementErrors,type ConfigCatalog,type CompanyConfig,type Translations} from '@dio-crm/contracts/crm-customization';
import {configAssert} from './config-store.js';
import {presentationPlacements,placementPresentationErrors,validLeadGridSettings,validLeadColumnWidths,validLeadColumnAlignments,validPopupPresentation,validButtonPresentation} from '@dio-crm/contracts/crm-customization';
/** Three-way comparison: previous standard, target standard, company overrides.
 * Every changed override needs an explicit keep/drop choice; choices never bypass validation.
 */
export function rebaseConfiguration(config:CompanyConfig,previous:ConfigCatalog,target:ConfigCatalog,choices:Record<string,'keep'|'drop'>={},oldTranslations:Translations={},newTranslations:Translations={}){
 const before=new Map(previous.entries.map(e=>[e.id,e])),after=new Map(target.entries.map(e=>[e.id,e]));
 const conflicts:Array<{id:string;code:string}>=[],used=new Set<string>();
 const patches=config.patches.filter(p=>{
  const old=before.get(p.targetId),next=after.get(p.targetId),id=`patch:${p.targetId}:${p.property}`;
  let code:string|undefined;
  if(!next)code='TARGET_REMOVED';
  else if(!old||canonicalConfigJson(old)!==canonicalConfigJson(next))code='STANDARD_ENTRY_CHANGED';
  if(!code)return true;
  if(Object.hasOwn(choices,id)){used.add(id);if(choices[id]==='drop')return false;if(next)return true;}
  conflicts.push({id,code});return true;
 });
 const translations=structuredClone(config.translations),keys=new Set(target.entries.map(e=>e.labelKey));
 const oldKeys=new Set(previous.entries.map(e=>e.labelKey));
 for(const [locale,labels] of Object.entries(translations))for(const key of Object.keys(labels)){
  const removed=oldKeys.has(key)&&!keys.has(key),changed=oldTranslations[locale]?.[key]!==newTranslations[locale]?.[key];
  if(!removed&&!changed)continue;
  const id=`translation:${locale}:${key}`;
  if(choices[id]==='drop'){used.add(id);delete labels[key];}else if(choices[id]==='keep'&&!removed){used.add(id);}else conflicts.push({id,code:removed?'TRANSLATION_TARGET_REMOVED':'STANDARD_TRANSLATION_CHANGED'});
 }
 const placementOrders=structuredClone(config.placementOrders??{});
 for(const [region,ids] of Object.entries(placementOrders)){
  const changed=ids.some(id=>!after.has(id)||canonicalConfigJson(before.get(id)??null)!==canonicalConfigJson(after.get(id)??null));
  if(!changed)continue;const id=`placement:${region}`;
  if(choices[id]==='drop'){used.add(id);delete placementOrders[region];}
  else if(choices[id]==='keep'&&!placementErrors({[region]:ids},target.entries).length)used.add(id);
  else conflicts.push({id,code:'PLACEMENT_STANDARD_CHANGED'});
 }
 const extraColumns=[...(config.leadGridColumns??[])];let leadListOrder=config.leadListOrder?[...config.leadListOrder]:undefined;
 const placementPresentation=config.placementPresentation?structuredClone(config.placementPresentation):undefined;
 if(placementPresentation)for(const [placementId,locales]of Object.entries(placementPresentation.values)){
  const fieldId=presentationPlacements.find(p=>p.id===placementId)?.fieldId;
  const old=fieldId?before.get(fieldId):undefined,nextEntry=fieldId?after.get(fieldId):undefined;
  const changed=!old||!nextEntry||canonicalConfigJson(old)!==canonicalConfigJson(nextEntry)||Object.keys(locales).some(locale=>oldTranslations[locale]?.[old.labelKey]!==newTranslations[locale]?.[nextEntry.labelKey]);
  if(!changed)continue;const id=`presentation:${placementId}`;
  if(choices[id]==='drop'){used.add(id);delete placementPresentation.values[placementId];}
  else if(choices[id]==='keep'&&!placementPresentationErrors({schemaVersion:1,values:{[placementId]:locales}},target.entries).length)used.add(id);
  else conflicts.push({id,code:'PLACEMENT_PRESENTATION_STANDARD_CHANGED'});
 }
 const columnChanged=[...extraColumns,...leadListOrder??[]].some(id=>before.has(id)&&(!after.has(id)||canonicalConfigJson(before.get(id))!==canonicalConfigJson(after.get(id))));
 if(columnChanged){const id='columns:HQ_LEAD';if(choices[id]==='drop'){used.add(id);extraColumns.splice(0,extraColumns.length);leadListOrder=undefined;}else if(choices[id]==='keep'&&[...extraColumns,...leadListOrder??[]].every(id=>(!before.has(id)&&!after.has(id))||after.get(id)?.support==='supported'))used.add(id);else conflicts.push({id,code:'COLUMN_STANDARD_CHANGED'});}
 let leadGrid=config.leadGrid;
 let leadColumnWidths=config.leadColumnWidths;
 let popupPresentation=config.popupPresentation;
 let buttonPresentation=config.buttonPresentation;
 if(buttonPresentation&&(!validButtonPresentation(buttonPresentation,target.entries)||['HQ_LEAD','LEAD.save'].some(id=>canonicalConfigJson(before.get(id)??null)!==canonicalConfigJson(after.get(id)??null)))){const id='buttonPresentation:lead.detail.save';if(choices[id]==='drop'){used.add(id);buttonPresentation=undefined;}else if(choices[id]==='keep'&&validButtonPresentation(buttonPresentation,target.entries))used.add(id);else conflicts.push({id,code:'BUTTON_PRESENTATION_STANDARD_CHANGED'});}
 if(popupPresentation&&(!validPopupPresentation(popupPresentation,target.entries)||['HQ_LEAD','POP.LEAD.CREATE','LEAD.create'].some(id=>canonicalConfigJson(before.get(id)??null)!==canonicalConfigJson(after.get(id)??null)))){const id='popupPresentation:POP.LEAD.CREATE';if(choices[id]==='drop'){used.add(id);popupPresentation=undefined;}else if(choices[id]==='keep'&&validPopupPresentation(popupPresentation,target.entries))used.add(id);else conflicts.push({id,code:'POPUP_PRESENTATION_STANDARD_CHANGED'});}
 let leadColumnAlignments=config.leadColumnAlignments;
 if(leadColumnAlignments&&!validLeadColumnAlignments(leadColumnAlignments,target.entries,{leadGridColumns:extraColumns,leadListOrder})){const id='columnAlignments:HQ_LEAD';if(choices[id]==='drop'){used.add(id);leadColumnAlignments=undefined;}else conflicts.push({id,code:'COLUMN_ALIGNMENT_STANDARD_CHANGED'});}
 if(leadColumnWidths&&!validLeadColumnWidths(leadColumnWidths,target.entries,{leadGridColumns:extraColumns,leadListOrder})){const id='columnWidths:HQ_LEAD';if(choices[id]==='drop'){used.add(id);leadColumnWidths=undefined;}else conflicts.push({id,code:'COLUMN_WIDTH_STANDARD_CHANGED'});}
 if(leadGrid&&!validLeadGridSettings(leadGrid,target.entries)){const id='grid:HQ_LEAD';if(choices[id]==='drop'){used.add(id);leadGrid=undefined;}else conflicts.push({id,code:'GRID_STANDARD_CHANGED'});}
 configAssert(Object.keys(choices).every(id=>used.has(id)),422,'INVALID_REBASE_RESOLUTION');
 const next={...structuredClone(config),baseStandardReleaseId:target.standardReleaseId,patches,translations,placementOrders,leadGridColumns:extraColumns};
 if(leadListOrder)next.leadListOrder=leadListOrder;else delete next.leadListOrder;
 if(placementPresentation)next.placementPresentation=placementPresentation;
 if(leadGrid)next.leadGrid=structuredClone(leadGrid);else delete next.leadGrid;
 if(leadColumnWidths)next.leadColumnWidths=structuredClone(leadColumnWidths);else delete next.leadColumnWidths;
 if(leadColumnAlignments)next.leadColumnAlignments=structuredClone(leadColumnAlignments);else delete next.leadColumnAlignments;
 if(popupPresentation)next.popupPresentation=structuredClone(popupPresentation);else delete next.popupPresentation;
 if(buttonPresentation)next.buttonPresentation=structuredClone(buttonPresentation);else delete next.buttonPresentation;
 return {config:next,conflicts};
}
