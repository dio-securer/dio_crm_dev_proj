import type {CompanyConfig,ConfigEntry,ConfigProperty,ConfigScalar} from '@dio-crm/contracts/crm-customization';
import {requireEditableEditorProperty} from '@dio-crm/contracts/crm-customization';
/** One override per property; reset restores inheritance by removing the override. */
export function editSetting(config:CompanyConfig,entry:ConfigEntry,property:ConfigProperty,value:ConfigScalar|undefined):CompanyConfig {
 requireEditableEditorProperty(entry,property);
 const patches=config.patches.filter(p=>!(p.targetId===entry.id&&p.property===property));
 if(value!==undefined)patches.push({targetId:entry.id,property,operation:'set',value});
 return {...config,patches};
}
export function editTranslation(config:CompanyConfig,locale:string,key:string,value:string):CompanyConfig {
 if(!config.activeLocales.includes(locale)||['__proto__','constructor','prototype'].includes(key))throw new Error('INVALID_TRANSLATION');
 const values={...config.translations[locale]};if(value==='')delete values[key];else values[key]=value;
 return {...config,translations:{...config.translations,[locale]:values}};
}
