import {resolveActorPolicy,type ConfigResult,type ActorPolicy,type ConfigEntry} from '@dio-crm/contracts/crm-customization';
import {configAssert} from './config-store.js';
/** Endpoint-owned scalar bindings. No client-selected DTO paths or automatic key inference.
 * Nested rows/aggregates must use their own reviewed adapter and cannot pass this scalar adapter.
 */
export interface FieldBinding {fieldId:string;input:string;column:string;output:string}
const scalar=(v:unknown)=>v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v);
function bindingsFor(result:ConfigResult,bindings:FieldBinding[]){
 const entries=new Map(result.entries.map(e=>[e.id,e]));
 for(const key of ['input','column','output'] as const)configAssert(new Set(bindings.map(b=>b[key])).size===bindings.length,500,'DUPLICATE_FIELD_BINDING');
 for(const b of bindings){configAssert(entries.get(b.fieldId)?.kind==='FIELD',409,'STANDARD_ADAPTER_MISMATCH');configAssert([b.input,b.column,b.output].every(s=>s&&!['__proto__','prototype','constructor'].includes(s)),500,'INVALID_FIELD_BINDING');}
 return entries;
}
function valid(entry:ConfigEntry,value:unknown){
 if(value===null)return !!entry.valueRule?.nullable;
 const r=entry.valueRule;if(!r)return scalar(value);
 if(r.type==='number')return typeof value==='number'&&Number.isFinite(value)&&(!r.integer||Number.isInteger(value))&&(r.min===undefined||value>=r.min)&&(r.max===undefined||value<=r.max)&&(!r.options||r.options.includes(value));
 if(r.type==='boolean')return typeof value==='boolean'&&(!r.options||r.options.includes(value));
 if(r.type==='rows')return false;
 if(typeof value!=='string'||r.minLength!==undefined&&value.length<r.minLength||r.maxLength!==undefined&&value.length>r.maxLength)return false;
 if(r.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))return false;
 return !r.options||r.options.includes(value);
}
export function projectFields(result:ConfigResult,companyId:string,actor:ActorPolicy,bindings:FieldBinding[],row:Record<string,unknown>){
 const entries=bindingsFor(result,bindings);const policy=new Map(resolveActorPolicy(result,companyId,actor).map(p=>[p.id,p]));const output:Record<string,unknown>={};
 for(const b of bindings){const p=policy.get(b.fieldId);if(!p?.readable||!Object.hasOwn(row,b.column))continue;const entry=entries.get(b.fieldId)!;if(entry.bindingKind==='DERIVED'&&entry.dependencies.some(id=>entries.get(id)?.kind==='FIELD'&&(!policy.get(id)?.readable||policy.get(id)?.masking!=='none')))continue;configAssert(scalar(row[b.column]),500,'NESTED_ADAPTER_REQUIRED');output[b.output]=p.masking==='redact'?'***':row[b.column];}
 return output;
}
export function validateFieldWrite(result:ConfigResult,companyId:string,actor:ActorPolicy,bindings:FieldBinding[],input:Record<string,unknown>,stored:Record<string,unknown>={},mode:'create'|'update'='update',contextValues:Record<string,unknown>={}){
 const entries=bindingsFor(result,bindings),byInput=new Map(bindings.map(b=>[b.input,b]));
 const values:Record<string,unknown>={...contextValues};for(const b of bindings)values[b.fieldId]=Object.hasOwn(input,b.input)?input[b.input]:stored[b.column];
 const refs=(c:NonNullable<ConfigEntry['requiredWhen']>):string[]=>'fieldKey' in c?[c.fieldKey]:c.kind==='not'?refs(c.condition):c.kind==='all'||c.kind==='any'?c.conditions.flatMap(refs):[];
 for(const b of bindings){const condition=entries.get(b.fieldId)?.requiredWhen;if(condition)configAssert(refs(condition).every(id=>Object.hasOwn(values,id)),409,'POLICY_CONTEXT_UNAVAILABLE');}
 const columns:Record<string,unknown>={},availability=new Map(resolveActorPolicy(result,companyId,actor,values).map(p=>[p.id,p]));
 // Apply trusted defaults before evaluating any conditional requirement. A server default
 // may fill an intentionally hidden/read-only DATA field without granting client writes.
 for(const b of bindings){const entry=entries.get(b.fieldId)!;if(mode==='create'&&values[b.fieldId]===undefined&&entry.bindingKind==='DATA'&&availability.get(b.fieldId)?.enabled&&Object.hasOwn(entry.settings,'default')){const value=entry.settings.default;configAssert(valid(entry,value),422,'INVALID_FIELD_VALUE');values[b.fieldId]=value;columns[b.column]=value;}}
 const policy=new Map(resolveActorPolicy(result,companyId,actor,values).map(p=>[p.id,p]));
 for(const [key,value] of Object.entries(input)){const b=byInput.get(key);configAssert(b,422,'UNREGISTERED_FIELD');const p=policy.get(b.fieldId),entry=entries.get(b.fieldId)!;configAssert(entry.bindingKind==='DATA',422,'DEDICATED_FIELD_ADAPTER_REQUIRED');configAssert(p?.writable,403,'FIELD_WRITE_DENIED');configAssert(valid(entry,value),422,'INVALID_FIELD_VALUE');columns[b.column]=value;}
 for(const b of bindings){const entry=entries.get(b.fieldId)!,p=policy.get(b.fieldId),value=values[b.fieldId];
  if(p?.required&&!entry.serverProvidesRequired)configAssert(value!==undefined&&value!==null&&value!=='',422,'REQUIRED_FIELD');
 }
 return columns;
}
export function requireQueryFields(result:ConfigResult,companyId:string,actor:ActorPolicy,ids:string[]){
 const policy=new Map(resolveActorPolicy(result,companyId,actor).map(p=>[p.id,p])),entries=new Map(result.entries.map(e=>[e.id,e])),seen=new Set<string>();
 const check=(id:string)=>{if(seen.has(id))return;seen.add(id);const entry=entries.get(id);configAssert(entry?.kind==='FIELD'&&policy.get(id)?.readable&&policy.get(id)?.masking==='none',403,'QUERY_FIELD_DENIED');if(entry.bindingKind==='DERIVED')entry.dependencies.filter(key=>entries.get(key)?.kind==='FIELD').forEach(check);};
 ids.forEach(check);
}
export function requireQueryControls(result:ConfigResult,companyId:string,actor:ActorPolicy,ids:string[]){const policy=new Map(resolveActorPolicy(result,companyId,actor).map(p=>[p.id,p]));for(const id of ids)configAssert(result.entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.bindingKind==='QUERY')&&policy.get(id)?.writable,403,'QUERY_CONTROL_DENIED');}
/** DEVICE readOnly forbids manual editing, not a capture authorized by its command.
 * Only endpoint-owned DEVICE bindings may use this path; DATA cannot bypass readOnly.
 */
export function validateDeviceCapture(result:ConfigResult,companyId:string,actor:ActorPolicy,bindings:FieldBinding[],input:Record<string,unknown>,context:Record<string,unknown>={}){
 const ids=new Set(bindings.map(b=>b.fieldId)),policy=new Map(resolveActorPolicy(result,companyId,actor).map(p=>[p.id,p]));
 for(const b of bindings){const e=result.entries.find(e=>e.id===b.fieldId),p=policy.get(b.fieldId);configAssert(e?.bindingKind==='DEVICE',500,'INVALID_DEVICE_BINDING');if(Object.hasOwn(input,b.input))configAssert(p?.enabled&&p.readable&&p.masking==='none',403,'DEVICE_CAPTURE_DENIED');}
 const capture={...result,entries:result.entries.map(e=>ids.has(e.id)?{...e,bindingKind:'DATA' as const,settings:{...e.settings,readOnly:false}}:e)};
 return validateFieldWrite(capture,companyId,actor,bindings,input,{},'update',context);
}
