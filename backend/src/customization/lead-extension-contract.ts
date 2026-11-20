import {createHash} from 'node:crypto';
import {resolveActorPolicy} from '@dio-crm/contracts/crm-customization';
import {validLeadExtensionLayout} from '@dio-crm/contracts/crm-customization';
import {configAssert,type ConfigState} from './config-store.js';

/** E06 integration contract only. A SQL adapter must put config, lead and extension operations
 * in one database transaction. This module is not an HTTP endpoint or SQL implementation. */
export type PublishedLeadField={id:string;version:number;type:'text'|'number'|'boolean'|'date';required:false;labels:Record<string,string>;maxLength?:number;min?:number;max?:number};
export type LeadExtensionPublication={companyId:string;configReleaseId:string;hqReleaseId:string;fields:PublishedLeadField[]};
export type LeadExtensionRow={companyId:string;id:string;ownerId:string;version:string;deleted:boolean};
export type LeadExtensionValues={revision:number;values:Record<string,{definitionVersion:number;value:string|number|boolean|null}>};
export type LeadExtensionActor={id:string;companyId:string};
export type LeadExtensionContext={releaseId:string;permissionVersion:number};
export type LeadExtensionWrite={
 mode:'create'|'detail';recordId?:string;expectedBaseVersion?:string;expectedExtensionRevision?:number;
 /** Base DTO is validated by the trusted adapter's assertBaseWrite, never by client claims. */
 base:Record<string,unknown>;
 extensions:Record<string,{definitionVersion:number;value:unknown}>;
};
export interface LeadExtensionAtomicTransaction {
 state:ConfigState;identityActive:boolean;publication:LeadExtensionPublication|null;
 assertBaseWrite:(mode:'create'|'detail',base:Record<string,unknown>,row:LeadExtensionRow|null)=>Promise<void>;
 loadLead:(recordId:string)=>Promise<LeadExtensionRow|null>;
 readBase?:(row:LeadExtensionRow)=>Promise<Record<string,unknown>>;
 canWriteRow?:(row:LeadExtensionRow)=>Promise<boolean>;
 writeBase:(mode:'create'|'detail',base:Record<string,unknown>,row:LeadExtensionRow|null)=>Promise<LeadExtensionRow>;
 readExtensions:(recordId:string)=>Promise<LeadExtensionValues>;
 writeExtensions:(recordId:string,expectedRevision:number,next:LeadExtensionValues)=>Promise<void>;
 fieldAccess:(actorId:string,fieldId:string,operation:'read'|'write')=>Promise<boolean>;
 audit:(operation:'lead.create.extension'|'lead.detail.extension',recordId:string,actorId:string)=>Promise<void>;
}
export interface LeadExtensionAtomicPort {
 transact<T>(companyId:string,actorId:string,work:(tx:LeadExtensionAtomicTransaction)=>Promise<T>):Promise<T>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rowVersion=/^0x[0-9a-f]{16}$/i;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const grant=(permissions:string[],denied:string[],name:string)=>permissions.includes(name)&&!denied.includes(name);
function current(tx:LeadExtensionAtomicTransaction,actor:LeadExtensionActor,context:LeadExtensionContext,permission:'read'|'write',mode?:'create'|'detail'){
 configAssert(tx.identityActive,401,'IDENTITY_DISABLED');
 configAssert(tx.state.companyId===actor.companyId,404,'NOT_FOUND');
 const member=tx.state.members[actor.id];configAssert(member?.active,404,'NOT_FOUND');
 configAssert(grant(member.permissions,member.denied,'runtime.'+permission)&&grant(member.permissions,member.denied,permission==='read'?'LEAD.READ':'LEAD.WRITE'),403,'PERMISSION_DENIED');
 const release=tx.state.activeReleaseId&&tx.state.releases[tx.state.activeReleaseId];configAssert(release,409,'NO_ACTIVE_RELEASE');
 const policy=resolveActorPolicy(release.effective,actor.companyId,{authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied});
 const screen=policy.find(p=>p.id==='HQ_LEAD');configAssert(screen?.readable,403,'SCREEN_DENIED');
 if(permission==='write'){
  const action=policy.find(p=>p.id===(mode==='create'?'LEAD.create':'LEAD.save'));
  configAssert(action?.enabled&&action.visible&&action.readable,403,'ACTION_DENIED');
  if(mode==='create'){const popup=policy.find(p=>p.id==='POP.LEAD.CREATE');configAssert(popup?.enabled&&popup.visible&&popup.readable,403,'ACTION_TARGET_UNAVAILABLE');}
 }
 configAssert(release.companyId===actor.companyId&&tx.publication?.companyId===actor.companyId&&tx.publication.configReleaseId===release.id&&typeof tx.publication.hqReleaseId==='string'&&uuid.test(tx.publication.hqReleaseId),409,'EXTENSION_RELEASE_UNAVAILABLE');
 configAssert(context.releaseId===release.id&&context.permissionVersion===tx.state.permissionVersion,409,'CONFIG_CHANGED');
 configAssert(Array.isArray(tx.publication.fields)&&tx.publication.fields.length<=100,500,'INVALID_EXTENSION_PUBLICATION');
 const ids=tx.publication.fields.map(f=>f.id);configAssert(new Set(ids).size===ids.length&&tx.publication.fields.every(validDefinition),500,'INVALID_EXTENSION_PUBLICATION');
 const layout=release.config?.leadExtensionLayout;
 configAssert(layout===undefined||validLeadExtensionLayout(layout,tx.publication.fields),500,'INVALID_EXTENSION_LAYOUT');
 return {member,publication:tx.publication,release,layout,policy};
}
function accessible(row:LeadExtensionRow|null,actor:LeadExtensionActor,member:ConfigState['members'][string]){
 configAssert(row&&row.companyId===actor.companyId&&!row.deleted,404,'NOT_FOUND');
 configAssert(row.ownerId===actor.id||grant(member.permissions,member.denied,'LEAD.MANAGE'),404,'NOT_FOUND');
 return row;
}
export function validDefinition(f:PublishedLeadField){
 if(!f||typeof f.id!=='string'||!uuid.test(f.id)||f.id!==f.id.toLowerCase()||!Number.isSafeInteger(f.version)||f.version<=0||f.version>2147483647||!['text','number','boolean','date'].includes(f.type)||f.required!==false)return false;
 const labels=f.labels;if(!labels||typeof labels!=='object'||Array.isArray(labels)||Object.keys(labels).length>20||!['ko-KR','en-US'].every(locale=>typeof labels[locale]==='string'&&!!labels[locale].trim())||!Object.entries(labels).every(([locale,value])=>/^[a-z]{2}-[A-Z]{2}$/.test(locale)&&typeof value==='string'&&value.length<=200&&!!value.trim()&&!/[<>]/.test(value)))return false;
 if(f.type==='text')return f.min===undefined&&f.max===undefined&&(f.maxLength===undefined||Number.isSafeInteger(f.maxLength)&&f.maxLength>0&&f.maxLength<=4000);
 if(f.type==='number')return f.maxLength===undefined&&[f.min,f.max].every(value=>value===undefined||typeof value==='number'&&Number.isFinite(value))&&(f.min===undefined||f.max===undefined||f.min<=f.max);
 return f.maxLength===undefined&&f.min===undefined&&f.max===undefined;
}
function valid(field:PublishedLeadField,value:unknown){
 if(value===null)return !field.required;
 if(field.type==='text')return typeof value==='string'&&value.length<=(field.maxLength??500);
 if(field.type==='number')return typeof value==='number'&&Number.isFinite(value)&&(field.min===undefined||value>=field.min)&&(field.max===undefined||value<=field.max);
 if(field.type==='boolean')return typeof value==='boolean';
 if(field.type!=='date'||typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function checkedState(value:LeadExtensionValues,forWrite:boolean){
 configAssert(value&&Number.isSafeInteger(value.revision)&&value.revision>=0&&value.revision<=(forWrite?2147483646:2147483647)&&value.values&&typeof value.values==='object'&&!Array.isArray(value.values),500,'INVALID_EXTENSION_STATE');
 for(const [id,entry] of Object.entries(value.values))configAssert(uuid.test(id)&&id===id.toLowerCase()&&entry&&typeof entry==='object'&&Number.isSafeInteger(entry.definitionVersion)&&entry.definitionVersion>0&&entry.definitionVersion<=2147483647&&(entry.value===null||typeof entry.value==='string'||typeof entry.value==='boolean'||typeof entry.value==='number'&&Number.isFinite(entry.value)),500,'INVALID_EXTENSION_STATE');
 return value;
}
/** The adapter owns the atomic scope. Throwing at any point must roll back base, extensions,
 * receipt, audit and config dataVersion together. */
export async function writeLeadWithExtensions(port:LeadExtensionAtomicPort,actorInput:LeadExtensionActor,context:LeadExtensionContext,key:string,input:LeadExtensionWrite){
 configAssert(actorInput&&uuid.test(actorInput.id)&&uuid.test(actorInput.companyId),400,'INVALID_CONTEXT');
 const actor={id:actorInput.id.toLowerCase(),companyId:actorInput.companyId.toLowerCase()};
 configAssert(typeof key==='string'&&key.length>0&&key.length<=160,428,'IDEMPOTENCY_REQUIRED');
 configAssert(input&&['create','detail'].includes(input.mode)&&input.base&&typeof input.base==='object'&&!Array.isArray(input.base)&&input.extensions&&typeof input.extensions==='object'&&!Array.isArray(input.extensions)&&Object.keys(input.extensions).length<=100,422,'INVALID_INPUT');
 configAssert(input.mode==='create'&&!input.recordId&&input.expectedBaseVersion===undefined&&input.expectedExtensionRevision===undefined||input.mode==='detail'&&typeof input.recordId==='string'&&uuid.test(input.recordId)&&typeof input.expectedBaseVersion==='string'&&rowVersion.test(input.expectedBaseVersion)&&Number.isSafeInteger(input.expectedExtensionRevision)&&Number(input.expectedExtensionRevision)>=0&&Number(input.expectedExtensionRevision)<2147483647,422,'INVALID_INPUT');
 const payloadHash=hash({context,input}),receiptKey=hash([actor.companyId,actor.id,'lead.extension.'+input.mode,key]);
 return port.transact(actor.companyId,actor.id,async tx=>{
  const {member,publication,layout,policy}=current(tx,actor,context,'write',input.mode);
  const row=input.mode==='detail'?accessible(await tx.loadLead(input.recordId!.toLowerCase()),actor,member):null;
  const definitions=new Map(publication.fields.map(field=>[field.id,field]));
  const seen=new Set<string>();
  for(const [rawId,entry] of Object.entries(input.extensions)){
   const id=rawId.toLowerCase();configAssert(uuid.test(id)&&!seen.has(id)&&entry&&typeof entry==='object'&&!Array.isArray(entry)&&Object.keys(entry).length===2&&Object.hasOwn(entry,'definitionVersion')&&Object.hasOwn(entry,'value'),422,'INVALID_EXTENSION_INPUT');seen.add(id);
   const field=definitions.get(id);configAssert(field,422,'FIELD_NOT_PUBLISHED');
   const placement=layout?.placements.find(item=>item.fieldId===id);
   configAssert(!layout||placement?.visible&&!placement.readOnly&&!!(input.mode==='create'?placement.createRegion:placement.detailRegion),403,'FIELD_WRITE_DENIED');
   if(layout&&input.mode==='detail'){
    const tab=policy.find(p=>p.id==='tab:HQ_LEAD.'+placement!.detailRegion);
    configAssert(tab?.enabled&&tab.visible&&tab.readable,403,'FIELD_WRITE_DENIED');
   }
   configAssert(await tx.fieldAccess(actor.id,id,'write'),403,'FIELD_WRITE_DENIED');
   configAssert(entry.definitionVersion===field.version,409,'FIELD_VERSION_CHANGED');
   configAssert(valid(field,entry.value),422,'INVALID_FIELD_VALUE');
  }
  const prior=tx.state.receipts[receiptKey];
  if(prior){
   configAssert(prior.payloadHash===payloadHash,409,'IDEMPOTENCY_CONFLICT');
   const receiptRow=input.mode==='create'?accessible(await tx.loadLead((prior.result as {recordId:string}).recordId),actor,member):row;
   await tx.assertBaseWrite(input.mode,input.base,receiptRow);
   return structuredClone(prior.result) as {recordId:string;baseVersion:string;extensionRevision:number;releaseId:string;permissionVersion:number};
  }
  const existing=checkedState(input.mode==='detail'?await tx.readExtensions(row!.id):{revision:0,values:{}},true);
  if(input.mode==='detail')configAssert(row!.version===input.expectedBaseVersion&&existing.revision===input.expectedExtensionRevision,409,'RECORD_CONFLICT');
  const next:LeadExtensionValues={revision:existing.revision+1,values:structuredClone(existing.values)};
  for(const [rawId,entry] of Object.entries(input.extensions)){
   const id=rawId.toLowerCase(),field=definitions.get(id)!;
   next.values[id]={definitionVersion:field.version,value:entry.value as string|number|boolean|null};
  }
  if(layout)for(const placement of layout.placements.filter(item=>item.required)){
   if(input.mode==='detail'&&!policy.some(tab=>tab.id==='tab:HQ_LEAD.'+placement.detailRegion&&tab.enabled&&tab.visible&&tab.readable))continue;
   if(!await tx.fieldAccess(actor.id,placement.fieldId,'read')||!await tx.fieldAccess(actor.id,placement.fieldId,'write'))continue;
   const value=next.values[placement.fieldId]?.value;
   configAssert(value!==undefined&&value!==null&&value!=='' ,422,'REQUIRED_EXTENSION_FIELD');
  }
  await tx.assertBaseWrite(input.mode,input.base,row);
  const saved=await tx.writeBase(input.mode,input.base,row);
  configAssert(saved.companyId===actor.companyId&&!saved.deleted&&uuid.test(saved.id)&&saved.id===saved.id.toLowerCase()&&typeof saved.version==='string'&&rowVersion.test(saved.version),500,'BASE_WRITE_INVALID');
  accessible(saved,actor,member);
  await tx.writeExtensions(saved.id,existing.revision,next);
  await tx.audit(input.mode==='create'?'lead.create.extension':'lead.detail.extension',saved.id,actor.id);
  tx.state.dataVersion++;
  const result={recordId:saved.id,baseVersion:saved.version,extensionRevision:next.revision,releaseId:context.releaseId,permissionVersion:context.permissionVersion};
  tx.state.receipts[receiptKey]={payloadHash,result:structuredClone(result)};
  return result;
 });
}
/** Detail projection uses the same published definitions and current row/field access. */
export async function readLeadWithExtensions(port:LeadExtensionAtomicPort,actorInput:LeadExtensionActor,context:LeadExtensionContext,recordId:string){
 configAssert(actorInput&&uuid.test(actorInput.id)&&uuid.test(actorInput.companyId)&&uuid.test(recordId),400,'INVALID_CONTEXT');
 const actor={id:actorInput.id.toLowerCase(),companyId:actorInput.companyId.toLowerCase()};
 return port.transact(actor.companyId,actor.id,async tx=>{
  const {member,publication,layout,policy}=current(tx,actor,context,'read');const row=accessible(await tx.loadLead(recordId.toLowerCase()),actor,member),stored=checkedState(await tx.readExtensions(row.id),false);const fields=new Map(publication.fields.map(f=>[f.id,f]));const values:LeadExtensionValues['values']={};
  const shown=(id:string)=>!layout||layout.placements.some(p=>p.fieldId===id&&p.visible&&p.detailRegion&&policy.some(tab=>tab.id==='tab:HQ_LEAD.'+p.detailRegion&&tab.enabled&&tab.visible&&tab.readable));
  for(const [id,entry] of Object.entries(stored.values)){const field=fields.get(id);if(field&&entry.definitionVersion===field.version&&shown(id)&&await tx.fieldAccess(actor.id,id,'read'))values[id]=structuredClone(entry);}
  const memberMayWrite=grant(member.permissions,member.denied,'runtime.write')&&grant(member.permissions,member.denied,'LEAD.WRITE');
  const release=tx.state.releases[context.releaseId];const p=resolveActorPolicy(release.effective,actor.companyId,{authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied}).find(x=>x.id==='LEAD.save');
  const canWrite=!!(memberMayWrite&&p?.enabled&&p.visible&&p.readable&&tx.canWriteRow&&await tx.canWriteRow(row));
  const definitions=[];for(const field of publication.fields){const placement=layout?.placements.find(p=>p.fieldId===field.id);if(shown(field.id)&&await tx.fieldAccess(actor.id,field.id,'read'))definitions.push({...field,readable:true,writable:canWrite&&!placement?.readOnly&&await tx.fieldAccess(actor.id,field.id,'write')});}
  return {recordId:row.id,baseVersion:row.version,extensionRevision:stored.revision,values,definitions,...(tx.readBase?{base:await tx.readBase(row)}:{}),releaseId:context.releaseId,permissionVersion:context.permissionVersion};
 });
}

/** Read-only create metadata, under the same active-release and create-action fence. */
export async function listLeadExtensionCreateFields(port:LeadExtensionAtomicPort,actorInput:LeadExtensionActor,context:LeadExtensionContext){
 configAssert(actorInput&&uuid.test(actorInput.id)&&uuid.test(actorInput.companyId),400,'INVALID_CONTEXT');
 const actor={id:actorInput.id.toLowerCase(),companyId:actorInput.companyId.toLowerCase()};
 return port.transact(actor.companyId,actor.id,async tx=>{
  const {publication,layout}=current(tx,actor,context,'write','create');
  const definitions=[];for(const field of publication.fields){const placement=layout?.placements.find(p=>p.fieldId===field.id);if((!layout||placement?.visible&&placement.createRegion&&!placement.readOnly)&&await tx.fieldAccess(actor.id,field.id,'read')&&await tx.fieldAccess(actor.id,field.id,'write'))definitions.push({...field,readable:true,writable:true});}
  return {definitions,releaseId:context.releaseId,permissionVersion:context.permissionVersion};
 });
}

