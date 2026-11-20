import type {ConfigEntry} from './crm-customization.js';
export type LeadGridSort={fieldId:'lead.updatedAt';direction:'asc'|'desc'};
export type LeadGridSettings={schemaVersion:1;pageSize?:25|50|100;density?:'compact'|'default'|'comfortable';defaultSort?:LeadGridSort};
export type LeadGridUpdate={schemaVersion:1;pageSize?:25|50|100|null;density?:'compact'|'default'|'comfortable'|null;defaultSort?:LeadGridSort|null};
export function validLeadGridSort(value:unknown):value is LeadGridSort{if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;return Object.keys(v).length===2&&v.fieldId==='lead.updatedAt'&&(v.direction==='asc'||v.direction==='desc');}
export function validLeadGridSettings(value:unknown,entries:ConfigEntry[]):value is LeadGridSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>['schemaVersion','pageSize','density','defaultSort'].includes(k))&&Object.keys(v).length>=2&&v.schemaVersion===1&&(!Object.hasOwn(v,'pageSize')||typeof v.pageSize==='number'&&[25,50,100].includes(v.pageSize))&&(!Object.hasOwn(v,'density')||typeof v.density==='string'&&['compact','default','comfortable'].includes(v.density))&&(!Object.hasOwn(v,'defaultSort')||validLeadGridSort(v.defaultSort)&&entries.some(e=>e.id==='lead.updatedAt'&&e.kind==='FIELD'&&e.screenId==='HQ_LEAD'&&e.support==='supported'))&&entries.some(e=>e.id==='HQ_LEAD'&&e.kind==='SCREEN'&&e.support==='supported');
}
/** Command omission preserves; explicit null removes just that override. No default injection. */
export function mergeLeadGridUpdate(current:LeadGridSettings|undefined,value:unknown,entries:ConfigEntry[]):{ok:boolean;value?:LeadGridSettings}{
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false};const v=value as Record<string,unknown>;
 if(v.schemaVersion!==1||Object.keys(v).length<2||Object.keys(v).some(k=>!['schemaVersion','pageSize','density','defaultSort'].includes(k)))return {ok:false};
 const next:Record<string,unknown>={...current,schemaVersion:1};for(const key of ['pageSize','density','defaultSort'])if(Object.hasOwn(v,key)){if(v[key]===null)delete next[key];else next[key]=v[key];}
 if(Object.keys(next).length===1)return {ok:true};return validLeadGridSettings(next,entries)?{ok:true,value:next}:{ok:false};
}
export function effectiveLeadGrid(grid:LeadGridSettings|undefined,policy:Array<{id:string;readable:boolean;visible:boolean;masking:string}>):LeadGridSettings|undefined{
 if(!grid||!policy.some(p=>p.id==='HQ_LEAD'&&p.readable))return undefined;const next=structuredClone(grid);
 if(next.defaultSort&&(!validLeadGridSort(next.defaultSort)||!policy.some(p=>p.id===next.defaultSort!.fieldId&&p.readable&&p.visible&&p.masking==='none')))delete next.defaultSort;
 return Object.keys(next).length>1?next:undefined;
}
