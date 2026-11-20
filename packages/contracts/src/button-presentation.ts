import type {ConfigEntry} from './crm-customization.js';
export type ButtonEmphasis='primary'|'secondary';
export type ButtonPresentation={schemaVersion:1;values:Record<string,ButtonEmphasis>};
export type ButtonPresentationUpdate={schemaVersion:1;values:Record<string,ButtonEmphasis|null>};
export const buttonPresentationPlacements=[{id:'lead.detail.save',actionId:'LEAD.save',instance:'detail.form.save',screenId:'HQ_LEAD'}] as const;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const emphasis=(v:unknown):v is ButtonEmphasis=>v==='primary'||v==='secondary';
export function validButtonPresentation(value:unknown,entries:ConfigEntry[]):value is ButtonPresentation{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>1)return false;
 return Object.entries(value.values).every(([id,v])=>id==='lead.detail.save'&&emphasis(v)&&entries.some(e=>e.id==='HQ_LEAD'&&e.kind==='SCREEN'&&e.support==='supported')&&entries.some(e=>e.id==='LEAD.save'&&e.kind==='ACTION'&&e.support==='supported'));
}
export function mergeButtonPresentation(current:ButtonPresentation|undefined,value:unknown):{ok:boolean;value?:ButtonPresentation}{
 if(!object(value)||value.schemaVersion!==1||Object.keys(value).length!==2||!object(value.values)||Object.keys(value.values).length>1)return {ok:false};const values={...current?.values};
 for(const [id,v]of Object.entries(value.values)){if(id!=='lead.detail.save')return {ok:false};if(v===null)delete values[id];else if(emphasis(v))values[id]=v;else return {ok:false};}return Object.keys(values).length?{ok:true,value:{schemaVersion:1,values}}:{ok:true};
}
export function effectiveButtonPresentation(value:ButtonPresentation|undefined,policy:Array<{id:string;readable:boolean;enabled:boolean;visible:boolean}>):Record<string,ButtonEmphasis>|undefined{
 if(!value||!['HQ_LEAD','LEAD.save'].every(id=>policy.some(p=>p.id===id&&p.readable&&p.enabled&&p.visible)))return undefined;const v=value.values['lead.detail.save'];return emphasis(v)?{'lead.detail.save':v}:undefined;
}
