import { evaluateHqCondition, type HqCondition } from './hq-standard.js';
import { leadGridCandidates, validLeadColumnOrder,resolvedLeadColumnOrder } from './lead-grid-columns.js';
import { placementErrors, placementRegions, type PlacementOrders } from './screen-placements.js';
import { screenActions } from './screen-actions.js';
import { placementPresentationErrors, type PlacementPresentationEnvelope } from './placement-presentation.js';
import {validLeadGridSettings,type LeadGridSettings} from './lead-grid-settings.js';
import {validLeadColumnWidths,type LeadColumnWidths} from './lead-column-widths.js';
import {validLeadColumnAlignments,type LeadColumnAlignments} from './lead-column-alignments.js';
import {validPopupPresentation,type PopupPresentation} from './popup-presentation.js';
import {validButtonPresentation,type ButtonPresentation} from './button-presentation.js';
import {validLeadExtensionLayout,type LeadExtensionLayout} from './lead-extension-layout.js';
export {validLeadExtensionLayout,type LeadExtensionLayout,type LeadExtensionPlacement,type LeadExtensionRegion} from './lead-extension-layout.js';
export {validButtonPresentation,mergeButtonPresentation,effectiveButtonPresentation,buttonPresentationPlacements,type ButtonEmphasis,type ButtonPresentation,type ButtonPresentationUpdate} from './button-presentation.js';
export {validPopupPresentation,mergePopupPresentation,effectivePopupPresentation,type PopupPresentation,type PopupPresentationUpdate,type PopupAppearance,type PopupSize,type EffectivePopupPresentation} from './popup-presentation.js';
export {validLeadColumnAlignment,validLeadColumnAlignments,mergeLeadColumnAlignments,effectiveLeadColumnAlignments,type LeadColumnAlignment,type LeadColumnAlignments,type LeadColumnAlignmentsUpdate} from './lead-column-alignments.js';
export {validLeadColumnWidth,validLeadColumnWidths,mergeLeadColumnWidths,effectiveLeadColumnWidths,type LeadColumnWidth,type LeadColumnWidths,type LeadColumnWidthsUpdate} from './lead-column-widths.js';
export {validLeadGridSettings,validLeadGridSort,mergeLeadGridUpdate,effectiveLeadGrid,type LeadGridSort,type LeadGridSettings,type LeadGridUpdate} from './lead-grid-settings.js';
export { placementPresentationErrors, effectivePlacementPresentation, presentationPlacements, type PlacementPresentationEnvelope, type PlacementPresentationText, type EffectivePlacementPresentation } from './placement-presentation.js';
export { screenActions } from './screen-actions.js';
export { describeEditorProperty, listEditorProperties, requireEditableEditorProperty, type EditorPropertyKey, type EditorPropertyDescriptor } from './editor-property-registry.js';
export { placementRegions, placementErrors, type PlacementOrders, type PlacementRegion } from './screen-placements.js';
/** Pure C01 customization contracts. No persistence, authentication or browser state.
 * Callers must authenticate, scope rows and recheck policy in the commit fence.
 */
export type ConfigKind = 'MENU'|'SCREEN'|'TAB'|'POPUP'|'SECTION'|'FIELD'|'ACTION'|'CODE'|'OUTPUT';
export type BindingKind = 'DATA'|'QUERY'|'DERIVED'|'DEVICE';
export type ConfigScalar = string|number|boolean|null;
export type ConfigProperty = 'enabled'|'visible'|'readOnly'|'required'|'order'|'default'|'masking';
export type ConfigSettings = {enabled:boolean;visible:boolean;readOnly:boolean;required:boolean;order:number;default?:ConfigScalar;masking?:'none'|'redact'};
export interface ConfigValueRule {type:'string'|'number'|'boolean'|'date'|'reference'|'rows';nullable?:boolean;min?:number;max?:number;minLength?:number;maxLength?:number;integer?:boolean;options?:ConfigScalar[]}
export interface ConfigEntry {
  id:string; kind:ConfigKind; parentId?:string; screenId?:string; labelKey:string;
  support:'supported'|'unsupported'|'decision_pending'; bindingKind?:BindingKind;
  settings:ConfigSettings; capabilities:ConfigProperty[]; locks:ConfigProperty[];
  dependencies:string[]; permissions:string[]; readPermissions:string[]; writePermissions:string[];
  /** Invariants and providers are authored in the trusted standard, not company patches. */
  invariantRequired?:boolean; serverProvidesRequired?:boolean;
  apiField?:string; requiredTranslation:boolean;
  valueRule?:ConfigValueRule;
  requiredWhen?:HqCondition;
}
export interface ConfigCatalog {schemaVersion:1;standardReleaseId:string;entries:ConfigEntry[]}
export interface ConfigPatch {targetId:string;property:ConfigProperty;operation:'set'|'reset';value?:ConfigScalar}
export interface ConfigIssue {code:string;targetId:string;property?:string;messageKey:string}
export interface CompanyConfig {
  companyId:string;baseStandardReleaseId:string;patches:ConfigPatch[];
  activeLocales:string[];defaultLocale:string;translations:Translations;
  /** Ordered extra columns after the five fixed lead-list columns. */
  leadGridColumns?:string[];
  placementOrders?:PlacementOrders;
  /** All lead-list placements, including the standard five; omission reads legacy order. */
  leadListOrder?:string[];
  /** Optional v1 presentation overrides; absence retains legacy serialized shape. */
  placementPresentation?:PlacementPresentationEnvelope;
  leadGrid?:LeadGridSettings;
  leadColumnWidths?:LeadColumnWidths;
  leadColumnAlignments?:LeadColumnAlignments;
  popupPresentation?:PopupPresentation;
  buttonPresentation?:ButtonPresentation;
  leadExtensionLayout?:LeadExtensionLayout;
}
const listBoundFieldIds=new Set([
  'lead.hospitalName','lead.status','lead.ownerName','lead.phone','lead.businessNo',
  'account.crmName','account.crmAddress','account.accountStatus','account.accountGrade',
  'account.erpCustomerCode','account.integrationStatus','account.ownerName'
]);
/** A global field order cannot represent the separate layout of list table columns. */
export function fieldOrderNeedsPlacement(id:string,company:CompanyConfig):boolean{
  return listBoundFieldIds.has(id)||placementRegions.some(region=>region.fieldIds.includes(id))||Array.isArray(company.leadGridColumns)&&company.leadGridColumns.includes(id);
}
export type Translations=Record<string,Record<string,string>>;
export interface ConfigResult {ok:boolean;entries:ConfigEntry[];issues:ConfigIssue[];provenance:Record<string,string>}
const properties:ConfigProperty[]=['enabled','visible','readOnly','required','order','default','masking'];
const kinds:ConfigKind[]=['MENU','SCREEN','TAB','POPUP','SECTION','FIELD','ACTION','CODE','OUTPUT'];
const reserved=new Set(['__proto__','constructor','prototype']);
const idOk=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=240&&!reserved.has(value)&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const own=(value:object,key:string)=>Object.prototype.hasOwnProperty.call(value,key);
const issue=(code:string,targetId:string,property?:string):ConfigIssue=>({code,targetId,property,messageKey:`customization.errors.${code}`});
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(idOk)&&new Set(value).size===value.length;
const settingOk=(key:ConfigProperty,value:unknown)=>key==='order'?typeof value==='number'&&Number.isSafeInteger(value)&&value>=0:key==='masking'?value==='none'||value==='redact':key==='default'?value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value):typeof value==='boolean';
const defaultOk=(value:unknown,rule:ConfigValueRule|undefined):boolean=>{
  if(!rule)return false;if(value===null)return rule.nullable===true;
  if(rule.options&&!rule.options.includes(value as ConfigScalar))return false;
  if(rule.type==='number')return typeof value==='number'&&Number.isFinite(value)&&(!rule.integer||Number.isInteger(value))&&(rule.min===undefined||value>=rule.min)&&(rule.max===undefined||value<=rule.max);
  if(rule.type==='boolean')return typeof value==='boolean';
  if(rule.type==='rows')return false;
  if(typeof value!=='string'||rule.maxLength!==undefined&&value.length>rule.maxLength||rule.minLength!==undefined&&value.length<rule.minLength)return false;
  if(rule.type==='reference')return idOk(value);
  if(rule.type==='date')return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  return true;
};
const cloneEntry=(entry:ConfigEntry):ConfigEntry=>({...entry,settings:{...entry.settings},capabilities:[...entry.capabilities],locks:[...entry.locks],dependencies:[...entry.dependencies],permissions:[...entry.permissions],readPermissions:[...entry.readPermissions],writePermissions:[...entry.writePermissions]});
const conditionRefs=(condition:unknown,depth=0):string[]|null=>{
  if(depth>16||!object(condition))return null;
  if(condition.kind==='constant')return typeof condition.value==='boolean'?[]:null;
  if(condition.kind==='present')return idOk(condition.fieldKey)?[condition.fieldKey]:null;
  if(condition.kind==='equals')return idOk(condition.fieldKey)&&settingOk('default',condition.value)?[condition.fieldKey]:null;
  if(condition.kind==='oneOf')return idOk(condition.fieldKey)&&Array.isArray(condition.values)&&condition.values.length>0&&condition.values.every(v=>settingOk('default',v))?[condition.fieldKey]:null;
  if(condition.kind==='not')return conditionRefs(condition.condition,depth+1);
  if((condition.kind==='all'||condition.kind==='any')&&Array.isArray(condition.conditions)&&condition.conditions.length>0){const refs=condition.conditions.map(c=>conditionRefs(c,depth+1));return refs.some(r=>r===null)?null:refs.flat() as string[];}
  return null;
};

/** Validate untrusted JSON before it is used as a typed catalog. */
export function validateCatalog(value:unknown):ConfigIssue[]{
  if(!object(value)||value.schemaVersion!==1||!idOk(value.standardReleaseId)||!Array.isArray(value.entries))return [issue('INVALID_CATALOG','catalog')];
  const issues:ConfigIssue[]=[],ids=new Set<string>();
  for(const raw of value.entries){
    if(!object(raw)||!idOk(raw.id)){issues.push(issue('INVALID_ENTRY','catalog'));continue;}
    const id=raw.id;if(ids.has(id))issues.push(issue('DUPLICATE_ID',id));ids.add(id);
    if(typeof raw.kind!=='string'||!kinds.includes(raw.kind as ConfigKind)||!idOk(raw.labelKey)||typeof raw.support!=='string'||!['supported','unsupported','decision_pending'].includes(raw.support))issues.push(issue('INVALID_ENTRY',id));
    if(!object(raw.settings)||properties.filter(p=>p!=='default'&&p!=='masking').some(p=>!settingOk(p,(raw.settings as Record<string,unknown>)?.[p]))||Object.keys(raw.settings).some(p=>!properties.includes(p as ConfigProperty)||!settingOk(p as ConfigProperty,(raw.settings as Record<string,unknown>)[p])))issues.push(issue('INVALID_SETTINGS',id));
    if(raw.valueRule!==undefined){const r=raw.valueRule;if(!object(r)||typeof r.type!=='string'||!['string','number','boolean','date','reference','rows'].includes(r.type)||['nullable','integer'].some(p=>r[p]!==undefined&&typeof r[p]!=='boolean')||['min','max','minLength','maxLength'].some(p=>r[p]!==undefined&&(typeof r[p]!=='number'||!Number.isFinite(r[p])))||['minLength','maxLength'].some(p=>typeof r[p]==='number'&&(!Number.isSafeInteger(r[p])||r[p]<0))||typeof r.min==='number'&&typeof r.max==='number'&&r.min>r.max||typeof r.minLength==='number'&&typeof r.maxLength==='number'&&r.minLength>r.maxLength||r.options!==undefined&&(!Array.isArray(r.options)||r.options.some(v=>!settingOk('default',v))))issues.push(issue('INVALID_VALUE_RULE',id));}
    for(const key of ['capabilities','locks'])if(!strings(raw[key])||(raw[key] as string[]).some(p=>!properties.includes(p as ConfigProperty)))issues.push(issue('INVALID_PROPERTY',id,key));
    for(const key of ['dependencies','permissions','readPermissions','writePermissions'])if(!strings(raw[key]))issues.push(issue('INVALID_LIST',id,key));
    if(typeof raw.requiredTranslation!=='boolean')issues.push(issue('INVALID_ENTRY',id,'requiredTranslation'));
    for(const key of ['invariantRequired','serverProvidesRequired'])if(raw[key]!==undefined&&typeof raw[key]!=='boolean')issues.push(issue('INVALID_ENTRY',id,key));
    for(const key of ['parentId','screenId'])if(raw[key]!==undefined&&!idOk(raw[key]))issues.push(issue('INVALID_REFERENCE',id,key));
    if(raw.kind==='FIELD'&&(typeof raw.bindingKind!=='string'||!['DATA','QUERY','DERIVED','DEVICE'].includes(raw.bindingKind)))issues.push(issue('INVALID_BINDING',id));
    if(raw.apiField!==undefined&&!idOk(raw.apiField))issues.push(issue('INVALID_BINDING',id,'apiField'));
  }
  if(issues.length)return issues;
  const entries=value.entries as ConfigEntry[],map=new Map(entries.map(x=>[x.id,x]));
  for(const entry of entries){
    if(entry.requiredWhen!==undefined){const refs=conditionRefs(entry.requiredWhen);if(refs===null)issues.push(issue('INVALID_REQUIRED_CONDITION',entry.id));else for(const ref of refs)if(map.get(ref)?.kind!=='FIELD')issues.push(issue('UNKNOWN_REFERENCE',entry.id,ref));}
    if(own(entry.settings,'default')&&!defaultOk(entry.settings.default,entry.valueRule))issues.push(issue('INVALID_DEFAULT',entry.id));
    for(const ref of [...entry.dependencies,...(entry.parentId?[entry.parentId]:[]),...(entry.screenId?[entry.screenId]:[])])if(!map.has(ref))issues.push(issue('UNKNOWN_REFERENCE',entry.id,ref));
    if(entry.screenId&&map.get(entry.screenId)?.kind!=='SCREEN')issues.push(issue('INVALID_SCREEN',entry.id));
    if(entry.kind==='MENU'&&!entry.screenId&&!entries.some(x=>x.parentId===entry.id))issues.push(issue('MENU_TARGET_REQUIRED',entry.id));
    if(entry.kind==='FIELD'&&entry.bindingKind==='DERIVED'&&!entry.settings.readOnly)issues.push(issue('DERIVED_READ_ONLY',entry.id));
  }
  const visited=new Set<string>(),active=new Set<string>();
  const visit=(id:string)=>{if(active.has(id)){issues.push(issue('DEPENDENCY_CYCLE',id));return;}if(visited.has(id))return;active.add(id);
    const entry=map.get(id);if(entry)for(const ref of [...entry.dependencies,...(entry.parentId?[entry.parentId]:[]),...(entry.screenId&&entry.screenId!==entry.id?[entry.screenId]:[])])visit(ref);
    active.delete(id);visited.add(id);
  };
  for(const entry of entries)visit(entry.id);
  return issues;
}

/** Fail atomically. Reset restores the standard value, including false and zero. */
export function resolveCompanyConfig(catalog:ConfigCatalog,company:CompanyConfig):ConfigResult{
  const issues=validateCatalog(catalog),provenance:Record<string,string>=Object.create(null);
  if(issues.length)return {ok:false,entries:[],issues,provenance};
  if(!object(company)||!idOk(company.companyId)||!Array.isArray(company.patches))return {ok:false,entries:[],issues:[issue('INVALID_COMPANY','company')],provenance};
  if(company.baseStandardReleaseId!==catalog.standardReleaseId)issues.push(issue('STANDARD_CONFLICT',company.companyId));
  const entries=catalog.entries.map(cloneEntry),map=new Map(entries.map(x=>[x.id,x])),seen=new Set<string>();
  issues.push(...placementErrors(company.placementOrders,catalog.entries));
  issues.push(...placementPresentationErrors(company.placementPresentation,catalog.entries));
  if(company.leadGrid!==undefined&&!validLeadGridSettings(company.leadGrid,catalog.entries))issues.push(issue('INVALID_LEAD_GRID','HQ_LEAD'));
  if(company.leadColumnWidths!==undefined&&!validLeadColumnWidths(company.leadColumnWidths,catalog.entries,company))issues.push(issue('INVALID_COLUMN_WIDTH','HQ_LEAD'));
  if(company.leadColumnAlignments!==undefined&&!validLeadColumnAlignments(company.leadColumnAlignments,catalog.entries,company))issues.push(issue('INVALID_COLUMN_ALIGNMENT','HQ_LEAD'));
  if(company.popupPresentation!==undefined&&!validPopupPresentation(company.popupPresentation,catalog.entries))issues.push(issue('INVALID_POPUP_PRESENTATION','POP.LEAD.CREATE'));
  if(company.buttonPresentation!==undefined&&!validButtonPresentation(company.buttonPresentation,catalog.entries))issues.push(issue('INVALID_BUTTON_PRESENTATION','LEAD.save'));
  if(company.leadExtensionLayout!==undefined&&!validLeadExtensionLayout(company.leadExtensionLayout))issues.push(issue('INVALID_EXTENSION_LAYOUT','HQ_LEAD'));
  for(const entry of entries)for(const p of properties)provenance[`${entry.id}/${p}`]='STANDARD';
  for(const patch of company.patches){
    if(!object(patch)||!idOk(patch.targetId)||!properties.includes(patch.property)||!['set','reset'].includes(patch.operation)||Object.keys(patch).some(k=>!['targetId','property','operation','value'].includes(k))){issues.push(issue('INVALID_PATCH','patch'));continue;}
    const entry=map.get(patch.targetId),key=`${patch.targetId}/${patch.property}`;
    if(seen.has(key)){issues.push(issue('DUPLICATE_PATCH',patch.targetId,patch.property));continue;}seen.add(key);
    if(!entry){issues.push(issue('UNKNOWN_TARGET',patch.targetId));continue;}
    // A disabled unsupported entry is still not an editable target. Availability
    // checks below alone cannot authorize changes to hidden/disabled metadata.
    // Preserve the legacy safety-only shutdown patch. This cannot activate a
    // feature or change its other metadata; capability/lock checks still apply.
    const safetyDisable=patch.property==='enabled'&&patch.operation==='set'&&patch.value===false;
    if(entry.support!=='supported'&&!safetyDisable){issues.push(issue('UNSUPPORTED_FEATURE',entry.id,patch.property));continue;}
    if(!entry.capabilities.includes(patch.property)||entry.locks.includes(patch.property)){issues.push(issue('LOCKED_PROPERTY',entry.id,patch.property));continue;}
    if(patch.property==='order'&&patch.operation==='set'&&fieldOrderNeedsPlacement(entry.id,company)){issues.push(issue('COLUMN_ORDER_PLACEMENT_REQUIRED',entry.id,'order'));continue;}
    if(patch.operation==='reset'){if(own(patch,'value'))issues.push(issue('INVALID_PATCH',entry.id,patch.property));continue;}
    if(!settingOk(patch.property,patch.value)){issues.push(issue('INVALID_VALUE',entry.id,patch.property));continue;}
    if(patch.property==='default'){if(!defaultOk(patch.value,entry.valueRule)){issues.push(issue('INVALID_DEFAULT',entry.id));continue;}entry.settings.default=patch.value;}
    else if(patch.property==='masking')entry.settings.masking=patch.value as 'none'|'redact';
    else if(patch.property==='order')entry.settings.order=patch.value as number;else entry.settings[patch.property]=patch.value as boolean;
    provenance[key]='COMPANY';
  }
  if(issues.length)return {ok:false,entries:[],issues,provenance};
  const available=(entry:ConfigEntry):boolean=>entry.settings.enabled&&(!entry.parentId||available(map.get(entry.parentId)!))&&(!entry.screenId||entry.screenId===entry.id||available(map.get(entry.screenId)!));
  const columns=company.leadGridColumns??[];
  if(company.leadGrid?.defaultSort){const field=map.get(company.leadGrid.defaultSort.fieldId);if(!field||!available(field)||!field.settings.visible||field.settings.masking==='redact'||!resolvedLeadColumnOrder(company).includes(field.id))issues.push(issue('INVALID_LEAD_GRID','HQ_LEAD'));}
  if(company.leadListOrder!==undefined&&(!Array.isArray(columns)||!validLeadColumnOrder(company.leadListOrder,columns)))issues.push(issue('INVALID_COLUMN_PLACEMENT','HQ_LEAD'));
  if(!Array.isArray(columns)||columns.length>leadGridCandidates.length)issues.push(issue('INVALID_GRID_COLUMNS','HQ_LEAD'));
  else {
    const candidates=new Set<string>(leadGridCandidates.map(x=>x.fieldId)),used=new Set<string>();
    for(const id of columns){
      if(typeof id!=='string'||!candidates.has(id)){issues.push(issue('GRID_COLUMN_UNAVAILABLE',String(id)));continue;}
      if(used.has(id)){issues.push(issue('DUPLICATE_GRID_COLUMN',id));continue;}used.add(id);
      const field=map.get(id);
      if(!field||field.kind!=='FIELD'||field.screenId!=='HQ_LEAD'||field.support!=='supported'||!field.settings.enabled||!field.settings.visible||field.settings.masking==='redact')issues.push(issue('GRID_COLUMN_UNAVAILABLE',id));
    }
  }
  for(const entry of entries){
    if(entry.support!=='supported'&&available(entry))issues.push(issue('UNSUPPORTED_FEATURE',entry.id));
    if(entry.kind==='MENU'&&entry.settings.visible&&entry.settings.enabled&&entry.screenId&&!available(map.get(entry.screenId)!))issues.push(issue('MENU_TARGET_DISABLED',entry.id));
    if(available(entry))for(const ref of entry.dependencies){const dependency=map.get(ref)!;if(!available(dependency)||(dependency.kind==='FIELD'&&!dependency.settings.visible))issues.push(issue('DEPENDENCY_MISSING',entry.id,ref));}
    if(entry.kind==='FIELD'){
      if(entry.invariantRequired&&!entry.settings.required)issues.push(issue('REQUIRED_INVARIANT',entry.id));
      if(entry.bindingKind==='DERIVED'&&!entry.settings.readOnly)issues.push(issue('DERIVED_READ_ONLY',entry.id));
      const providedDefault=own(entry.settings,'default')&&entry.settings.default!==null&&entry.settings.default!==''&&defaultOk(entry.settings.default,entry.valueRule);
      const mayRequire=entry.settings.required||entry.requiredWhen!==undefined&&!(entry.requiredWhen.kind==='constant'&&!entry.requiredWhen.value);
      if(mayRequire&&available(entry)&&(!entry.settings.visible||entry.settings.readOnly)&&!entry.serverProvidesRequired&&!providedDefault)issues.push(issue('REQUIRED_UNREACHABLE',entry.id));
      if(mayRequire&&available(entry)&&entry.settings.visible&&!entry.settings.readOnly&&!entry.serverProvidesRequired&&!providedDefault){
        const detailRegion=placementRegions.find(region=>region.variant==='detail'&&region.screenId===entry.screenId&&region.fieldIds.includes(entry.id));
        const tab=detailRegion&&map.get(`tab:${entry.screenId}.${detailRegion.tab}`);
        if(tab&&(!available(tab)||!tab.settings.visible))issues.push(issue('REQUIRED_UNREACHABLE',entry.id));
      }
    }
  }
  for(const action of screenActions){const button=map.get(action.actionId),popup=map.get(action.popupId);if(button&&available(button)&&(!popup||!available(popup)||!popup.settings.visible))issues.push(issue('ACTION_TARGET_UNAVAILABLE',action.actionId));}
  return {ok:issues.length===0,entries:issues.length?[]:entries.sort((a,b)=>a.settings.order-b.settings.order||(a.id<b.id?-1:a.id>b.id?1:0)),issues,provenance};
}

export interface ActorPolicy {authenticated:boolean;companyId:string;allowed:string[];denied:string[]}
export interface ElementPolicy {id:string;enabled:boolean;visible:boolean;readable:boolean;writable:boolean;required:boolean;masking:'none'|'redact';reason:string|null}
/** Row ownership and workflow state remain server checks; this computes upper bounds only. */
export function resolveActorPolicy(result:ConfigResult,companyId:string,actor:ActorPolicy,values:Readonly<Record<string,unknown>>={}):ElementPolicy[]{
  if(!result.ok||!actor.authenticated||actor.companyId!==companyId)return [];
  const map=new Map(result.entries.map(x=>[x.id,x])),allowed=new Set(actor.allowed),denied=new Set(actor.denied);
  const grants=(ps:string[])=>ps.every(p=>allowed.has(p)&&!denied.has(p));
  const enabled=(entry:ConfigEntry):boolean=>entry.support==='supported'&&entry.settings.enabled&&grants(entry.permissions)&&(!entry.parentId||enabled(map.get(entry.parentId)!))&&(!entry.screenId||entry.screenId===entry.id||enabled(map.get(entry.screenId)!))&&entry.dependencies.every(id=>{const dependency=map.get(id)!;return dependency.kind==='FIELD'?readable(dependency):enabled(dependency);});
  const readable=(entry:ConfigEntry):boolean=>enabled(entry)&&entry.settings.visible&&grants(entry.readPermissions)&&(!entry.parentId||readable(map.get(entry.parentId)!))&&(!entry.screenId||entry.screenId===entry.id||readable(map.get(entry.screenId)!));
  return result.entries.map(entry=>{
    const on=enabled(entry),read=readable(entry);
    const write=read&&!entry.settings.readOnly&&entry.settings.masking!=='redact'&&entry.bindingKind!=='DERIVED'&&grants(entry.writePermissions);
    return {id:entry.id,enabled:on,visible:read,readable:read,writable:write,required:entry.settings.required||!!entry.requiredWhen&&evaluateHqCondition(entry.requiredWhen,values),masking:entry.settings.masking??'none',reason:!on?'FEATURE_OR_PERMISSION_DENIED':!read?'FIELD_READ_DENIED':!write?'FIELD_WRITE_DENIED':null};
  });
}

export interface LocaleDecision {locale:string;reason:'USER'|'COMPANY'|'SYSTEM';unsupportedPreference:boolean}
export function resolveLocale(preference:string|undefined,activeLocales:string[],companyDefault:string,systemDefault='ko-KR'):LocaleDecision{
  if(!activeLocales.length||!activeLocales.includes(companyDefault))throw new Error('INVALID_LOCALE_CONFIGURATION');
  if(preference&&activeLocales.includes(preference))return {locale:preference,reason:'USER',unsupportedPreference:false};
  const locale=activeLocales.includes(companyDefault)?companyDefault:systemDefault;
  return {locale,reason:locale===companyDefault?'COMPANY':'SYSTEM',unsupportedPreference:!!preference};
}
const translation=(source:Translations,locale:string,key:string):string|undefined=>own(source,locale)&&object(source[locale])&&own(source[locale],key)?source[locale][key]:undefined;
export function resolveTranslation(key:string,locale:string,companyDefault:string,standard:Translations,overrides:Translations,systemDefault='ko-KR'):{text:string;source:string;fallback:boolean;missing:boolean}{
  const candidates:[string,Translations,string][]=[[locale,overrides,'COMPANY'],[locale,standard,'STANDARD']];
  if(companyDefault!==locale)candidates.push([companyDefault,overrides,'COMPANY'],[companyDefault,standard,'STANDARD']);
  if(systemDefault!==locale&&systemDefault!==companyDefault)candidates.push([systemDefault,standard,'STANDARD']);
  for(const [language,source,origin] of candidates){const text=translation(source,language,key);if(typeof text==='string'&&text.trim())return {text,source:`${origin}:${language}`,fallback:language!==locale,missing:false};}
  return {text:key,source:'MISSING',fallback:false,missing:true};
}
const tokens=(text:string)=>[...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g)].map(m=>m[1]).sort().join(',');
export function validateTranslations(entries:ConfigEntry[],activeLocales:string[],companyDefault:string,standard:Translations,overrides:Translations):ConfigIssue[]{
  const issues:ConfigIssue[]=[];
  if(!strings(activeLocales)||!activeLocales.length||!activeLocales.includes(companyDefault))return [issue('INVALID_LOCALE_CONFIGURATION','translations')];
  if(!object(overrides))return [issue('INVALID_TRANSLATION','translations')];
  // Company overrides may only address registered labels. A shared key changes
  // every owner, so all owners must be supported; do not use first-match policy.
  const owners=new Map<string,ConfigEntry[]>();
  for(const entry of entries)owners.set(entry.labelKey,[...(owners.get(entry.labelKey)??[]),entry]);
  for(const [locale,values] of Object.entries(overrides)){
    // Retained translations for an inactive locale are valid legacy data, but
    // their keys and owners must still be checked before later reactivation.
    if(!idOk(locale)||!object(values)){issues.push(issue('INVALID_TRANSLATION','translations',locale));continue;}
    for(const [key,value] of Object.entries(values)){
      const targets=owners.get(key);
      if(!targets){issues.push(issue('UNKNOWN_TARGET',key,locale));continue;}
      for(const target of targets)if(target.support!=='supported')issues.push(issue('UNSUPPORTED_FEATURE',target.id,locale));
      if(typeof value!=='string'||!value.trim())issues.push(issue('INVALID_TRANSLATION',targets[0].id,locale));
    }
  }
  for(const entry of entries){
    const reference=translation(standard,'ko-KR',entry.labelKey);
    for(const locale of activeLocales){
      const override=translation(overrides,locale,entry.labelKey),base=translation(standard,locale,entry.labelKey);
      if(override!==undefined&&(typeof override!=='string'||!override.trim()))issues.push(issue('INVALID_TRANSLATION',entry.id,locale));
      const text=override??base;
      if(entry.requiredTranslation&&(typeof text!=='string'||!text.trim()||text===entry.labelKey))issues.push(issue('TRANSLATION_REQUIRED',entry.id,locale));
      if(typeof text==='string'){
        if(/<\/?[a-z][^>]*>/i.test(text))issues.push(issue('TRANSLATION_MARKUP',entry.id,locale));
        if(typeof reference==='string'&&tokens(reference)!==tokens(text))issues.push(issue('TRANSLATION_TOKENS',entry.id,locale));
      }
    }
  }
  return issues;
}

/** Stable JSON for content hashes. Reject non-JSON values rather than silently dropping them. */
export function canonicalConfigJson(value:unknown):string{
  const active=new WeakSet<object>();
  const encode=(item:unknown):string=>{
    if(item===null||typeof item==='string'||typeof item==='boolean')return JSON.stringify(item);
    if(typeof item==='number'&&Number.isFinite(item))return JSON.stringify(item);
    if(typeof item!=='object'||!item)throw new Error('NON_JSON_CONFIG');
    if(active.has(item))throw new Error('CYCLIC_CONFIG');active.add(item);
    try{
      if(Array.isArray(item)){
        for(let i=0;i<item.length;i++)if(!own(item,String(i)))throw new Error('SPARSE_CONFIG_ARRAY');
        return '['+item.map(encode).join(',')+']';
      }
      if(Object.getPrototypeOf(item)===Object.prototype||Object.getPrototypeOf(item)===null)return '{'+Object.keys(item).sort().map(k=>JSON.stringify(k)+':'+encode((item as Record<string,unknown>)[k])).join(',')+'}';
      throw new Error('NON_JSON_CONFIG');
    }finally{active.delete(item);}
  };
  return encode(value);
}
