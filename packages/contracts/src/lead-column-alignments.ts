import type {ConfigEntry} from './crm-customization.js';
import {resolvedLeadColumnOrder} from './lead-grid-columns.js';
export type LeadColumnAlignment='start'|'center'|'end';
export type LeadColumnAlignments={schemaVersion:1;values:Record<string,LeadColumnAlignment>};
export type LeadColumnAlignmentsUpdate={schemaVersion:1;values:Record<string,LeadColumnAlignment|null>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const validLeadColumnAlignment=(value:unknown):value is LeadColumnAlignment=>value==='start'||value==='center'||value==='end';
export function validLeadColumnAlignments(value:unknown,entries:ConfigEntry[],config:{leadListOrder?:string[];leadGridColumns?:string[]}):value is LeadColumnAlignments{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>19)return false;
 const columns=resolvedLeadColumnOrder(config);return Object.entries(value.values).every(([id,alignment])=>columns.includes(id)&&validLeadColumnAlignment(alignment)&&entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.screenId==='HQ_LEAD'&&e.support==='supported'));
}
export function mergeLeadColumnAlignments(current:LeadColumnAlignments|undefined,value:unknown):{ok:boolean;value?:LeadColumnAlignments}{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>19)return {ok:false};const values={...current?.values};
 for(const [id,alignment]of Object.entries(value.values)){if(!/^lead\.[a-zA-Z][a-zA-Z0-9]*$/.test(id))return {ok:false};if(alignment===null)delete values[id];else if(validLeadColumnAlignment(alignment))values[id]=alignment;else return {ok:false};}
 return Object.keys(values).length?{ok:true,value:{schemaVersion:1,values}}:{ok:true};
}
/** Visual alignment applies also to redacted placeholders; it never grants field access. */
export function effectiveLeadColumnAlignments(value:LeadColumnAlignments|undefined,columns:string[],readable:Set<string>):LeadColumnAlignments|undefined{if(!value)return undefined;const values=Object.fromEntries(Object.entries(value.values).filter(([id])=>columns.includes(id)&&readable.has(id)));return Object.keys(values).length?{schemaVersion:1,values}:undefined;}
