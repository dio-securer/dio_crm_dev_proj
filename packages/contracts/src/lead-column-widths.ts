import type {ConfigEntry} from './crm-customization.js';
import {resolvedLeadColumnOrder} from './lead-grid-columns.js';
export type LeadColumnWidth={mode:'auto'}|{mode:'min';widthPx:number};
export type LeadColumnWidths={schemaVersion:1;values:Record<string,LeadColumnWidth>};
export type LeadColumnWidthsUpdate={schemaVersion:1;values:Record<string,LeadColumnWidth|null>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validLeadColumnWidth(v:unknown):v is LeadColumnWidth{return object(v)&&(v.mode==='auto'?Object.keys(v).length===1:v.mode==='min'&&Object.keys(v).length===2&&Number.isInteger(v.widthPx)&&Number(v.widthPx)>=80&&Number(v.widthPx)<=600);}
export function validLeadColumnWidths(value:unknown,entries:ConfigEntry[],config:{leadListOrder?:string[];leadGridColumns?:string[]}):value is LeadColumnWidths{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>19)return false;
 const columns=resolvedLeadColumnOrder(config);
 return Object.entries(value.values).every(([id,width])=>columns.includes(id)&&validLeadColumnWidth(width)&&entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.screenId==='HQ_LEAD'&&e.support==='supported'));
}
export function mergeLeadColumnWidths(current:LeadColumnWidths|undefined,value:unknown):{ok:boolean;value?:LeadColumnWidths}{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>19)return {ok:false};
 const values:Record<string,LeadColumnWidth>=structuredClone(current?.values??{});
 for(const [id,width]of Object.entries(value.values)){if(!/^lead\.[a-zA-Z][a-zA-Z0-9]*$/.test(id))return {ok:false};if(width===null)delete values[id];else if(validLeadColumnWidth(width))values[id]=structuredClone(width);else return {ok:false};}
 return Object.keys(values).length?{ok:true,value:{schemaVersion:1,values}}:{ok:true};
}
export function effectiveLeadColumnWidths(widths:LeadColumnWidths|undefined,columns:string[],readable:Set<string>):LeadColumnWidths|undefined{if(!widths)return undefined;const values=Object.fromEntries(Object.entries(widths.values).filter(([id])=>columns.includes(id)&&readable.has(id)));return Object.keys(values).length?{schemaVersion:1,values}:undefined;}
