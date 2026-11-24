import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {canonicalConfigJson} from '@dio-crm/contracts/crm-customization';
import {configAssert} from './config-store.js';
import {validDefinition} from './lead-extension-contract.js';
import type {ConfigSqlDatabase,ConfigSqlQuery} from './sql-config-store.js';
import {SqlHqExtensionDeploymentAuthority} from './sql-hq-extension-authority.js';

const uuid=z.string().uuid().transform(v=>v.toLowerCase());
export const hqDefineInput=z.object({key:z.string().regex(/^x_[a-z][a-z0-9_]{0,60}$/),type:z.enum(['text','number','boolean','date']),labels:z.record(z.string()),maxLength:z.number().int().optional(),min:z.number().finite().optional(),max:z.number().finite().optional(),reason:z.string().trim().min(1).max(2000)}).strict();
export const hqDistributeInput=z.object({companyId:uuid,expectedHqReleaseId:uuid.nullable(),fields:z.array(z.object({id:uuid,version:z.literal(1)}).strict()).min(1).max(100),reason:z.string().trim().min(1).max(2000)}).strict();
export interface HqFieldWriter {read(actorId:string,companyId?:string):Promise<unknown>;define(actorId:string,input:unknown,key:string):Promise<unknown>;distribute(actorId:string,input:unknown,key:string):Promise<unknown>}
const hash=(value:unknown)=>createHash('sha256').update(canonicalConfigJson(value)).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalConfigJson(a)===canonicalConfigJson(b);
async function write(q:ConfigSqlQuery,sql:string,params:Record<string,unknown>){const r=await q(sql,params);configAssert(r.rowsAffected?.[0]===1,409,'HQ_WRITE_FAILED');}

/** Explicitly installed only after schema/policy review. No implicit DB, env or memory fallback. */
export class SqlHqFieldWriter implements HqFieldWriter {
 constructor(private readonly db:ConfigSqlDatabase){}
 async read(actorId:string,companyId?:string){
  actorId=uuid.parse(actorId);if(companyId!==undefined)companyId=uuid.parse(companyId);
  return this.db.transaction(async q=>{
   for(const resource of ['crm.config.identity:'+actorId,'crm.hq.fields']){const r=await q<{result:number}>('DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode=\'Exclusive\',@LockOwner=\'Transaction\',@LockTimeout=5000; SELECT @r AS result',{resource});configAssert(r.recordset[0]?.result>=0,409,'CONFIG_LOCK_TIMEOUT');}
   const people=await q<{user_id:number;can_define:boolean;can_distribute:boolean}>('SELECT u.user_id,h.can_define,h.can_distribute FROM dbo.crm_user u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_company c WITH(HOLDLOCK) ON c.company_id=u.company_id JOIN dbo.crm_hq_field_administrator h WITH(UPDLOCK,HOLDLOCK) ON h.user_id=u.user_id WHERE u.public_id=@actorId AND u.is_active=1 AND u.deleted_yn=0 AND c.is_active=1 AND h.is_active=1',{actorId});
   const person=people.recordset[0];configAssert(people.recordset.length===1&&(person.can_define===true||person.can_distribute===true),403,'HQ_PERMISSION_REQUIRED');
   let target:{companyId:string;hqReleaseId:string|null;fields:Array<{id:string;version:number}>}|null=null;
   if(companyId){configAssert(person.can_distribute===true,403,'HQ_PERMISSION_REQUIRED');const targets=await q<{company_id:number;payload_json:string}>('SELECT c.company_id,m.payload_json FROM dbo.crm_company c WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_config_membership m WITH(UPDLOCK,HOLDLOCK) ON m.company_id=c.company_id AND m.user_id=@userId WHERE c.public_id=@companyId AND c.is_active=1',{companyId,userId:person.user_id});configAssert(targets.recordset.length===1,403,'HQ_TARGET_DENIED');const member=z.object({active:z.boolean(),permissions:z.array(z.string()),denied:z.array(z.string())}).parse(JSON.parse(targets.recordset[0].payload_json));configAssert(member.active&&member.permissions.includes('config.publish')&&!member.denied.includes('config.publish'),403,'HQ_TARGET_DENIED');
    const companyKey=targets.recordset[0].company_id,heads=await q<{release_id:string}>('SELECT release_id FROM dbo.crm_hq_extension_target_head WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey',{companyKey});configAssert(heads.recordset.length<=1,503,'HQ_REGISTRY_INVALID');
    const id=heads.recordset[0]?.release_id.toLowerCase()??null,assigned=await q<{field_id:string;definition_version:number}>('SELECT field_id,definition_version FROM dbo.crm_standard_extension_assignment WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey ORDER BY field_id',{companyKey}),fields=assigned.recordset.map(r=>({id:r.field_id.toLowerCase(),version:r.definition_version}));
    if(id)configAssert(await new SqlHqExtensionDeploymentAuthority().verifyHqRelease({query:q,companyKey},id,fields),503,'HQ_REGISTRY_INVALID');else configAssert(fields.length===0,503,'HQ_REGISTRY_INVALID');target={companyId,hqReleaseId:id,fields};
   }
   const rows=await q<{field_id:string;field_key:string;definition_version:number;payload_json:string}>('SELECT TOP (101) f.public_id field_id,f.field_key,v.definition_version,v.payload_json FROM dbo.crm_standard_extension_field f WITH(HOLDLOCK) JOIN dbo.crm_standard_extension_field_version v WITH(HOLDLOCK) ON v.field_id=f.public_id WHERE f.entity_type=\'lead\' ORDER BY f.public_id,v.definition_version');configAssert(rows.recordset.length<=100,409,'HQ_FIELD_CATALOG_LIMIT');
   const definitions=rows.recordset.map(row=>{const field=JSON.parse(row.payload_json);configAssert(field.id===String(row.field_id).toLowerCase()&&field.version===row.definition_version&&field.version===1&&field.key===row.field_key&&/^x_[a-z][a-z0-9_]{0,60}$/.test(field.key)&&validDefinition(field),503,'HQ_DEFINITION_INVALID');return {id:field.id,version:field.version,key:field.key,type:field.type,required:false,labels:field.labels,...(field.maxLength!==undefined?{maxLength:field.maxLength}:{}),...(field.min!==undefined?{min:field.min}:{}),...(field.max!==undefined?{max:field.max}:{})};});
   configAssert(new Set(definitions.map(f=>f.id)).size===definitions.length,503,'HQ_DEFINITION_INVALID');configAssert(!target||target.fields.every(f=>definitions.some(d=>d.id===f.id&&d.version===f.version)),503,'HQ_DEFINITION_INVALID');
   return {capabilities:{define:person.can_define===true,distribute:person.can_distribute===true},definitions,target};
  });
 }
 private async command(actorId:string,operation:'define'|'distribute',input:unknown,key:string,companyId:string|undefined,work:(q:ConfigSqlQuery,userId:number,companyKey?:number)=>Promise<unknown>){
  actorId=uuid.parse(actorId);configAssert(typeof key==='string'&&key.length>0&&key.length<=160,428,'IDEMPOTENCY_REQUIRED');
  return this.db.transaction(async q=>{
   for(const resource of ['crm.config.identity:'+actorId,'crm.hq.fields']){const r=await q<{result:number}>('DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode=\'Exclusive\',@LockOwner=\'Transaction\',@LockTimeout=5000; SELECT @r AS result',{resource});configAssert(r.recordset[0]?.result>=0,409,'CONFIG_LOCK_TIMEOUT');}
   const people=await q<{user_id:number;can_define:boolean;can_distribute:boolean}>('SELECT u.user_id,h.can_define,h.can_distribute FROM dbo.crm_user u WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_company c WITH(HOLDLOCK) ON c.company_id=u.company_id JOIN dbo.crm_hq_field_administrator h WITH(UPDLOCK,HOLDLOCK) ON h.user_id=u.user_id WHERE u.public_id=@actorId AND u.is_active=1 AND u.deleted_yn=0 AND c.is_active=1 AND h.is_active=1',{actorId});
   const person=people.recordset[0];configAssert(people.recordset.length===1&&person[operation==='define'?'can_define':'can_distribute']===true,403,'HQ_PERMISSION_REQUIRED');
   let companyKey:number|undefined;
   if(companyId){const targets=await q<{company_id:number;payload_json:string}>('SELECT c.company_id,m.payload_json FROM dbo.crm_company c WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_config_membership m WITH(UPDLOCK,HOLDLOCK) ON m.company_id=c.company_id AND m.user_id=@userId WHERE c.public_id=@companyId AND c.is_active=1',{companyId,userId:person.user_id});configAssert(targets.recordset.length===1,403,'HQ_TARGET_DENIED');const member=z.object({active:z.boolean(),permissions:z.array(z.string()),denied:z.array(z.string())}).parse(JSON.parse(targets.recordset[0].payload_json));configAssert(member.active&&member.permissions.includes('config.publish')&&!member.denied.includes('config.publish'),403,'HQ_TARGET_DENIED');companyKey=targets.recordset[0].company_id;}
   const receiptId=hash([actorId,operation,key]),digest=hash(input),receipts=await q<{request_hash:string;payload_json:string;content_hash:string}>('SELECT request_hash,payload_json,content_hash FROM dbo.crm_hq_field_receipt WITH(UPDLOCK,HOLDLOCK) WHERE receipt_id=@receiptId',{receiptId});
   if(receipts.recordset.length){configAssert(receipts.recordset.length===1,503,'HQ_RECEIPT_INVALID');const row=receipts.recordset[0];configAssert(row.request_hash===digest,409,'IDEMPOTENCY_CONFLICT');const value=JSON.parse(row.payload_json);configAssert(row.content_hash===hash(value),503,'HQ_RECEIPT_INVALID');return value;}
   const result=await work(q,person.user_id,companyKey),payload=canonicalConfigJson(result);
   await write(q,'INSERT dbo.crm_hq_field_event(event_id,actor_id,operation,payload_json,created_at) VALUES(@eventId,@userId,@operation,@payload,SYSUTCDATETIME())',{eventId:randomUUID(),userId:person.user_id,operation,payload:canonicalConfigJson({input,result})});
   await write(q,'INSERT dbo.crm_hq_field_receipt(receipt_id,request_hash,payload_json,content_hash) VALUES(@receiptId,@digest,@payload,@contentHash)',{receiptId,digest,payload,contentHash:hash(result)});return result;
  });
 }
 define(actorId:string,value:unknown,key:string){const input=hqDefineInput.parse(value);return this.command(actorId,'define',input,key,undefined,async(q,userId)=>{
  const {reason,...definition}=input,field={id:randomUUID(),version:1,required:false as const,...definition};configAssert(validDefinition(field),422,'INVALID_FIELD_DEFINITION');
  const existing=await q('SELECT public_id FROM dbo.crm_standard_extension_field WITH(UPDLOCK,HOLDLOCK) WHERE entity_type=\'lead\' AND field_key=@key',{key:input.key});configAssert(existing.recordset.length===0,409,'FIELD_KEY_EXISTS');
  await write(q,'INSERT dbo.crm_standard_extension_field(public_id,field_key,entity_type,created_by,created_at) VALUES(@id,@key,\'lead\',@userId,SYSUTCDATETIME())',{id:field.id,key:input.key,userId});
  await write(q,'INSERT dbo.crm_standard_extension_field_version(field_id,definition_version,payload_json,created_at) VALUES(@id,1,@payload,SYSUTCDATETIME())',{id:field.id,payload:canonicalConfigJson(field)});return field;
 });}
 distribute(actorId:string,value:unknown,key:string){const input=hqDistributeInput.parse(value);input.fields.sort((a,b)=>a.id.localeCompare(b.id));configAssert(new Set(input.fields.map(f=>f.id)).size===input.fields.length,422,'INVALID_FIELDS');return this.command(actorId,'distribute',input,key,input.companyId,async(q,userId,companyKey)=>{
  const heads=await q<{release_id:string}>('SELECT release_id FROM dbo.crm_hq_extension_target_head WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey',{companyKey});configAssert(heads.recordset.length<=1,503,'HQ_REGISTRY_INVALID');const current=heads.recordset[0]?.release_id.toLowerCase()??null;configAssert(current===input.expectedHqReleaseId,409,'HQ_TARGET_CONFLICT');
  const assigned=await q<{field_id:string;definition_version:number}>('SELECT field_id,definition_version FROM dbo.crm_standard_extension_assignment WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey ORDER BY field_id',{companyKey}),prior=assigned.recordset.map(r=>({id:r.field_id.toLowerCase(),version:r.definition_version}));
  if(current){const authority=new SqlHqExtensionDeploymentAuthority();configAssert(await authority.verifyHqRelease({query:q,companyKey:companyKey!},current,prior),503,'HQ_REGISTRY_INVALID');}else configAssert(prior.length===0,503,'HQ_REGISTRY_INVALID');
  configAssert(prior.every(p=>input.fields.some(f=>same(p,f))),422,'FIELD_REMOVAL_UNSUPPORTED');
  for(const ref of input.fields){const rows=await q<{payload_json:string}>('SELECT v.payload_json FROM dbo.crm_standard_extension_field f WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_standard_extension_field_version v WITH(UPDLOCK,HOLDLOCK) ON v.field_id=f.public_id WHERE f.entity_type=\'lead\' AND f.public_id=@id AND v.definition_version=@version',{id:ref.id,version:ref.version});configAssert(rows.recordset.length===1,422,'HQ_DEFINITION_UNAVAILABLE');const f=JSON.parse(rows.recordset[0].payload_json);configAssert(f.id===ref.id&&f.version===ref.version&&validDefinition(f),503,'HQ_DEFINITION_INVALID');}
  const registry={id:randomUUID(),fields:input.fields};await write(q,'INSERT dbo.crm_hq_extension_release(release_id,payload_json,content_hash,created_by,created_at) VALUES(@id,@payload,@hash,@userId,SYSUTCDATETIME())',{id:registry.id,payload:canonicalConfigJson(registry),hash:hash(registry),userId});
  for(const f of input.fields){await write(q,'INSERT dbo.crm_hq_extension_release_field(release_id,field_id,definition_version) VALUES(@releaseId,@id,@version)',{releaseId:registry.id,...f});if(!prior.some(p=>same(p,f)))await write(q,'INSERT dbo.crm_standard_extension_assignment(company_id,field_id,definition_version,assigned_by,assigned_at) VALUES(@companyKey,@id,@version,@userId,SYSUTCDATETIME())',{companyKey,...f,userId});}
  await write(q,current?'UPDATE dbo.crm_hq_extension_target_head SET release_id=@id,assigned_by=@userId,assigned_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND release_id=@expected':'INSERT dbo.crm_hq_extension_target_head(company_id,release_id,assigned_by,assigned_at) VALUES(@companyKey,@id,@userId,SYSUTCDATETIME())',{companyKey,id:registry.id,userId,expected:current});
  return {companyId:input.companyId,hqReleaseId:registry.id,fields:registry.fields,requiresCompanyPublication:true};
 });}
}
