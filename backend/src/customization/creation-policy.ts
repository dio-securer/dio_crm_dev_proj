import {resolveActorPolicy,type ActorPolicy,type ConfigResult} from '@dio-crm/contracts/crm-customization';
import {configAssert} from './config-store';
import {validateFieldWrite,type FieldBinding} from './field-policy';
/** Explicit creation scope prevents required/defaulted fields being silently dropped.
 * Server values are fixed workflow invariants, never client-selected identifiers.
 */
export function validateCreation(result:ConfigResult,companyId:string,actor:ActorPolicy,bindings:FieldBinding[],input:Record<string,unknown>,server:Record<string,unknown>,scopeIds:string[],context:Record<string,unknown>={}){
 const columns=validateFieldWrite(result,companyId,actor,bindings,input,{},'create',{...context,...server});
 const values={...context,...server,...Object.fromEntries(bindings.map(b=>[b.fieldId,columns[b.column]]))};
 const availability=new Map(resolveActorPolicy(result,companyId,actor,values).map(p=>[p.id,p]));
 for(const id of scopeIds){const e=result.entries.find(e=>e.id===id);configAssert(e,500,'INVALID_FIELD_BINDING');configAssert(bindings.some(b=>b.fieldId===id)||Object.hasOwn(server,id)||(!availability.get(id)?.required&&!Object.hasOwn(e.settings,'default')),422,'CREATION_FIELD_UNMAPPED');}
 // Reuse scalar validators for fixed server values without granting client writes.
 for(const [id,value] of Object.entries(server)){
  const e=result.entries.find(e=>e.id===id);configAssert(e&&availability.get(id)?.enabled,403,'CREATION_FIELD_DENIED');
  configAssert(!Object.hasOwn(e.settings,'default')||e.settings.default===value,422,'CREATION_DEFAULT_CONFLICT');
  const trusted={...result,entries:result.entries.map(entry=>entry.id===id?{...entry,bindingKind:'DATA' as const,settings:{...entry.settings,default:value as string|number|boolean|null}}:entry)};
  validateFieldWrite(trusted,companyId,actor,[{fieldId:id,input:'value',column:'value',output:'value'}],{},{},'create',values);
 }
 return columns;
}
