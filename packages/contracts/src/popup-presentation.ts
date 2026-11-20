import type {ConfigEntry} from './crm-customization.js';
export type PopupSize='small'|'medium'|'large'|'full';
export type PopupAppearance={titles?:Record<string,string>;size?:PopupSize};
export type PopupPresentation={schemaVersion:1;values:Record<string,PopupAppearance>};
export type PopupPresentationUpdate={schemaVersion:1;values:Record<string,{titles?:Record<string,string|null>;size?:PopupSize|null}|null>};
export type EffectivePopupPresentation=Record<string,{title?:string;size?:PopupSize}>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const size=(v:unknown):v is PopupSize=>['small','medium','large','full'].includes(v as string);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=200&&!/[<>]|\{\{/.test(v);
const locale=(v:string)=>/^[a-z]{2}-[A-Z]{2}$/.test(v);
export function validPopupPresentation(value:unknown,entries:ConfigEntry[]):value is PopupPresentation{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>1)return false;
 return Object.entries(value.values).every(([id,v])=>id==='POP.LEAD.CREATE'&&entries.some(e=>e.id===id&&e.kind==='POPUP'&&e.screenId==='HQ_LEAD'&&e.support==='supported')&&entries.some(e=>e.id==='LEAD.create'&&e.kind==='ACTION'&&e.support==='supported')&&entries.some(e=>e.id==='HQ_LEAD'&&e.kind==='SCREEN'&&e.support==='supported')&&object(v)&&Object.keys(v).length>0&&Object.keys(v).every(k=>k==='titles'||k==='size')&&(!Object.hasOwn(v,'size')||size(v.size))&&(!Object.hasOwn(v,'titles')||object(v.titles)&&Object.keys(v.titles).length>0&&Object.keys(v.titles).length<=20&&Object.entries(v.titles).every(([l,t])=>locale(l)&&text(t))));
}
export function mergePopupPresentation(current:PopupPresentation|undefined,value:unknown):{ok:boolean;value?:PopupPresentation}{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>1)return {ok:false};const values:Record<string,PopupAppearance>=structuredClone(current?.values??{});
 for(const [id,v]of Object.entries(value.values)){if(id!=='POP.LEAD.CREATE')return {ok:false};if(v===null){delete values[id];continue;}if(!object(v)||Object.keys(v).length===0||Object.keys(v).some(k=>k!=='titles'&&k!=='size'))return {ok:false};const next:PopupAppearance=values[id]??{};
  if(Object.hasOwn(v,'size')){if(v.size===null)delete next.size;else if(size(v.size))next.size=v.size;else return {ok:false};}
  if(Object.hasOwn(v,'titles')){if(!object(v.titles)||Object.keys(v.titles).length>20)return {ok:false};const titles={...next.titles};for(const [l,t]of Object.entries(v.titles)){if(!locale(l))return {ok:false};if(t===null)delete titles[l];else if(text(t))titles[l]=t;else return {ok:false};}if(Object.keys(titles).length)next.titles=titles;else delete next.titles;}
  if(Object.keys(next).length)values[id]=next;else delete values[id];
 }
 return Object.keys(values).length?{ok:true,value:{schemaVersion:1,values}}:{ok:true};
}
export function effectivePopupPresentation(value:PopupPresentation|undefined,locale:string,defaultLocale:string|undefined,policy:Array<{id:string;readable:boolean;enabled:boolean}>):EffectivePopupPresentation|undefined{
 if(!value||!['HQ_LEAD','POP.LEAD.CREATE','LEAD.create'].every(id=>policy.some(p=>p.id===id&&p.readable&&p.enabled)))return undefined;
 const v=value.values['POP.LEAD.CREATE'];if(!v)return undefined;const title=v.titles?.[locale]??(defaultLocale?v.titles?.[defaultLocale]:undefined);const result={...(title!==undefined?{title}:{}),...(v.size?{size:v.size}:{})};return Object.keys(result).length?{'POP.LEAD.CREATE':result}:undefined;
}
