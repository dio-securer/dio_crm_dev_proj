import ko from '../../i18n/locales/ko-KR/designer.json';
import en from '../../i18n/locales/en-US/designer.json';
import {i18n} from '../../i18n';
import {translateTerm} from '@dio-crm/contracts/admin';
export type Lang='ko-KR'|'en-US';
export const text=(lang:Lang)=>(key:string)=>(lang==='ko-KR'?ko:en)[key as keyof typeof ko]||key;
export function fieldLabel(c:any,key:string,lang:Lang){const semantic=({name:'account.name',phone:'account.phone'} as any)[key]||key;const r=translateTerm(c['TERM:terms']||{terms:[],translations:[]},semantic,lang,lang,lang,(l,k)=>i18n.getResource(l,'translation',k));if(!r.text.endsWith(' [missing]'))return r.text;const known=({taxId:text(lang)('taxId')} as any)[key];return known||key;}
export function missingLabel(c:any,key:string,lang:Lang){return fieldLabel(c,key,lang)===key&&!c['TERM:terms']?.translations?.some((t:any)=>t.termKey===key)&&!i18n.exists(key,{lng:lang});}
