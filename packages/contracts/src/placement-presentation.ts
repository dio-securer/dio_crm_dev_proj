import type {ConfigEntry,ConfigIssue} from './crm-customization.js';

export type PlacementPresentationText={label?:string;helpText?:string};
export type PlacementPresentationEnvelope={schemaVersion:1;values:Record<string,Record<string,PlacementPresentationText>>};
export type EffectivePlacementPresentation=Record<string,PlacementPresentationText>;
export const presentationPlacements=[...(['create','detail'] as const).flatMap(variant=>['hospitalName','phone','address','businessNo'].map(field=>({id:`lead.${variant}.basic.${field}`,fieldId:`lead.${field}`,screenId:'HQ_LEAD',variant}))),{id:'account.create.basic.crmName',fieldId:'account.crmName',screenId:'HQ_ACCOUNT',variant:'create' as const}];
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const own=(v:object,key:string)=>Object.prototype.hasOwnProperty.call(v,key);
const localeOk=(s:string)=>/^[a-z]{2}-[A-Z]{2}$/.test(s);
const issue=(id:string,property?:string):ConfigIssue=>({code:'INVALID_PLACEMENT_PRESENTATION',targetId:id,property,messageKey:'customization.errors.INVALID_PLACEMENT_PRESENTATION'});

/** v1 is restricted to reviewed lead placements and account create name. No arbitrary DOM IDs. */
export function placementPresentationErrors(value:unknown,entries:ConfigEntry[]):ConfigIssue[]{
 if(value===undefined)return [];
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).some(k=>!['schemaVersion','values'].includes(k))||!object(value.values))return [issue('placementPresentation')];
 const errors:ConfigIssue[]=[];
 if(Object.keys(value.values).length>presentationPlacements.length)return [issue('placementPresentation')];
 for(const [id,locales]of Object.entries(value.values)){
  const placement=presentationPlacements.find(p=>p.id===id),field=placement&&entries.find(e=>e.id===placement.fieldId),screen=placement&&entries.find(e=>e.id===placement.screenId);
  if(!placement||!field||field.kind!=='FIELD'||field.support!=='supported'||field.screenId!==placement.screenId||screen?.kind!=='SCREEN'||screen.support!=='supported'||(placement.screenId==='HQ_ACCOUNT'&&(!field.settings.enabled||!screen.settings.enabled))||!object(locales)||Object.keys(locales).length>20){errors.push(issue(id));continue;}
  for(const [locale,raw]of Object.entries(locales)){
   if(!localeOk(locale)||!object(raw)||Object.keys(raw).some(k=>!['label','helpText'].includes(k))){errors.push(issue(id,locale));continue;}
   for(const [key,text]of Object.entries(raw))if(typeof text!=='string'||!text.trim()||text.length>(key==='label'?200:1000)||/[<>]/.test(text)||/\{\{.*?\}\}/.test(text))errors.push(issue(id,`${locale}.${key}`));
  }
 }
 return errors;
}

/** No eager defaults: absence preserves legacy renderer and release serialization. */
export function effectivePlacementPresentation(value:PlacementPresentationEnvelope|undefined,locale:string,defaultLocale:string,readableIds:ReadonlySet<string>):EffectivePlacementPresentation|undefined{
 if(value===undefined)return undefined;
 const out:EffectivePlacementPresentation={};
 for(const placement of presentationPlacements){
  if(!readableIds.has(placement.fieldId)||!readableIds.has(placement.screenId))continue;
  const locales=value.values[placement.id];if(!locales)continue;
  const text:PlacementPresentationText={};
  for(const key of ['label','helpText'] as const)for(const language of [...new Set([locale,defaultLocale])]){
   if(own(locales,language)&&own(locales[language],key)){text[key]=locales[language][key];break;}
  }
  if(Object.keys(text).length)out[placement.id]=text;
 }
 return out;
}
