import {randomUUID,createHash} from 'node:crypto';
import {canonicalConfigJson,resolveActorPolicy,type ActorPolicy} from '@dio-crm/contracts/crm-customization';
import {configAssert,ConfigError,type AdminConfigRepository,type ConfigTransaction,type ConfigOutboxRecord} from './config-store';
import type {ConfigActor} from './config-service';
import {requireQueryFields} from './field-policy';
export type DomainEnvelope=NonNullable<ConfigOutboxRecord['delivery']>;
/** Called only within an authorized business transaction; no network operation here. */
export async function enqueueDomainDelivery(tx:ConfigTransaction,actor:ConfigActor,input:Pick<DomainEnvelope,'actionId'|'interfaceCode'|'entityId'|'sourceFieldIds'|'payload'>){
 configAssert(tx.domain&&tx.state.activeReleaseId,503,'SQL_DOMAIN_REQUIRED');const state=tx.state,member=state.members[actor.id];
 configAssert(tx.identityActive&&member?.active&&member.permissions.includes('runtime.write')&&!member.denied.includes('runtime.write'),403,'PERMISSION_DENIED');
 const policy:ActorPolicy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},effective=state.releases[state.activeReleaseId!].effective;
 configAssert(resolveActorPolicy(effective,actor.companyId,policy).some(p=>p.id===input.actionId&&p.enabled),403,'ACTION_DENIED');requireQueryFields(effective,actor.companyId,policy,input.sourceFieldIds);
 canonicalConfigJson(input.payload);const id=randomUUID();
 const item:ConfigOutboxRecord={id,type:'DOMAIN_DELIVERY',releaseId:state.activeReleaseId!,status:'PENDING',delivery:{...structuredClone(input),actorId:actor.id,permissionVersion:state.permissionVersion,attempts:0,unknownOutcome:false,lastError:null}};
 await tx.domain.query("INSERT INTO crm_interface_log(company_id,request_id,interface_code,direction,entity_type,entity_id,request_json,status,retry_count,requested_at) VALUES(@companyKey,@id,@code,'OUT','CONFIGURED_DOMAIN',@entityId,@payload,'REQUESTING',0,SYSUTCDATETIME())",{companyKey:tx.domain.companyKey,id,code:input.interfaceCode,entityId:input.entityId,payload:canonicalConfigJson(input.payload)});
 state.outbox.push(item);state.pendingActions[input.actionId]=(state.pendingActions[input.actionId]??0)+1;return id;
}
/** A transport must guarantee durable deduplication by requestId. Never bind a transport
 * which merely accepts a header but cannot guarantee idempotent acceptance.
 * authorize checks current domain ownership, pending request identity and payload validity.
 * The identity/company fence remains held during the bounded send, so permission changes
 * cannot pass authorization while a send is in flight. Commit failures retry the same ID.
 */
export interface DomainDeliveryAdapter{
 interfaceCode:string;supportsIdempotency:true;
 authorize:(tx:ConfigTransaction,envelope:DomainEnvelope,requestId:string)=>Promise<void>;
 send:(requestId:string,payload:unknown)=>Promise<unknown>;
 accepted?:(tx:ConfigTransaction,envelope:DomainEnvelope,requestId:string)=>Promise<void>;
 cancelled:(tx:ConfigTransaction,envelope:DomainEnvelope,requestId:string)=>Promise<void>;
}
export interface DeliveryRepository extends AdminConfigRepository {assertDeliveryBoundary():void}
/** Correlated authoritative ERP result, in the same transaction as its domain update.
 * A current integration principal may reconcile a past sender's revoked/unknown attempt.
 * Result IDs cannot be used to manufacture a response before any transport attempt.
 */
export async function completeDomainDelivery(tx:ConfigTransaction,actor:ConfigActor,input:{requestId:string;interfaceCode:string;entityId:string;success:boolean;result:unknown},apply:(job:DomainEnvelope)=>Promise<void>){
 configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const member=tx.state.members[actor.id];
 configAssert(tx.identityActive&&member?.active&&['runtime.write','INTEGRATION.RESULT.WRITE'].every(p=>member.permissions.includes(p)&&!member.denied.includes(p)),403,'PERMISSION_DENIED');
 const item=tx.state.outbox.find(j=>j.id===input.requestId),job=item?.delivery;
 configAssert(item?.type==='DOMAIN_DELIVERY'&&job&&job.interfaceCode===input.interfaceCode&&job.entityId===input.entityId,404,'NOT_FOUND');
 const resultHash=createHash('sha256').update(canonicalConfigJson(input.result)).digest('hex');
 if(job.completion){configAssert(job.completion.resultHash===resultHash&&job.completion.success===input.success,409,'DELIVERY_RESULT_CONFLICT');return {requestId:item.id,completed:true};}
 configAssert(item.status==='SENT'||(['PENDING','REVIEW_REQUIRED'].includes(item.status)&&job.unknownOutcome&&job.attempts>0),409,'DELIVERY_RESULT_NOT_EXPECTED');
 await apply(job);
 const changed=await tx.domain.query("UPDATE crm_interface_log SET status=@status,response_json=@response,responded_at=SYSUTCDATETIME(),error_message=@error WHERE company_id=@companyKey AND request_id=@id AND interface_code=@code AND entity_id=@entityId",{companyKey:tx.domain.companyKey,id:item.id,code:input.interfaceCode,entityId:input.entityId,status:input.success?'SUCCESS':'FAILED',response:canonicalConfigJson(input.result),error:input.success?null:'ERP_BUSINESS_REJECTED'});configAssert(changed.rowsAffected?.[0]===1,409,'DELIVERY_ENTITY_CHANGED');
 item.status='SENT';job.unknownOutcome=false;job.lastError=null;job.completion={resultHash,success:input.success,at:new Date().toISOString()};
 configAssert((tx.state.pendingActions[job.actionId]??0)>0,409,'DELIVERY_PENDING_COUNT_CONFLICT');tx.state.pendingActions[job.actionId]--;
 return {requestId:item.id,completed:true};
}
export async function deliverDomainOutbox(repository:DeliveryRepository,actor:ConfigActor,id:string,adapter:DomainDeliveryAdapter){
 repository.assertDeliveryBoundary();
 configAssert(adapter.supportsIdempotency===true,503,'IDEMPOTENT_TRANSPORT_REQUIRED');
 const phase=(reserve:boolean)=>{repository.assertDeliveryBoundary();return repository.transact(actor.companyId,actor.id,async tx=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');
  const state=tx.state,item=state.outbox.find(j=>j.id===id);configAssert(item?.delivery&&item.type==='DOMAIN_DELIVERY'&&item.delivery.actorId===actor.id,404,'NOT_FOUND');const job=item.delivery;
  configAssert(job.interfaceCode===adapter.interfaceCode,422,'INVALID_DELIVERY_ADAPTER');if(item.status!=='PENDING')return {id,status:item.status,attempts:job.attempts};
  const hash=()=>createHash('sha256').update(canonicalConfigJson(item)).digest('hex'),beforeHash=hash();
  const audit=(operation:string,reason:string)=>state.events.push({id:randomUUID(),actorId:actor.id,operation:'delivery.'+operation,at:new Date().toISOString(),beforeHash,afterHash:hash(),reason});
  const close=async(status:'CANCELLED'|'REVIEW_REQUIRED',code:string)=>{
   if(status==='CANCELLED'){await adapter.cancelled(tx,job,id);state.pendingActions[job.actionId]=Math.max(0,(state.pendingActions[job.actionId]??1)-1);await tx.domain!.query("UPDATE crm_interface_log SET status='FAILED',error_message=@code,responded_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND request_id=@id",{companyKey:tx.domain!.companyKey,id,code});}
   item.status=status;job.lastError=code;audit(status,code);return {id,status,attempts:job.attempts};
  };
  const member=state.members[actor.id],policy:ActorPolicy={authenticated:tx.identityActive,companyId:actor.companyId,allowed:member?.permissions??[],denied:member?.denied??[]};
  if(!tx.identityActive||!member?.active||!policy.allowed.includes('runtime.write')||policy.denied.includes('runtime.write')||item.releaseId!==state.activeReleaseId||job.permissionVersion!==state.permissionVersion)return close(job.unknownOutcome?'REVIEW_REQUIRED':'CANCELLED','DELIVERY_CONTEXT_CHANGED');
  const effective=state.releases[item.releaseId].effective;
  if(!resolveActorPolicy(effective,actor.companyId,policy).some(p=>p.id===job.actionId&&p.enabled))return close(job.unknownOutcome?'REVIEW_REQUIRED':'CANCELLED','ACTION_DENIED');
  try{requireQueryFields(effective,actor.companyId,policy,job.sourceFieldIds);await adapter.authorize(tx,job,id);}
  catch(error){if(!(error instanceof ConfigError)||!['NOT_FOUND','QUERY_FIELD_DENIED','PERMISSION_DENIED','ACTION_DENIED','DELIVERY_ENTITY_CHANGED','FEATURE_NOT_AVAILABLE_FOR_MARKET'].includes(error.code))throw error;return close(job.unknownOutcome?'REVIEW_REQUIRED':'CANCELLED','DELIVERY_AUTHORIZATION_CHANGED');}
  if(reserve){
   if(job.attempts>=5)return close('REVIEW_REQUIRED','DELIVERY_RETRY_EXHAUSTED');
   job.attempts++;job.unknownOutcome=true;audit('reserved','Durable attempt marker before transport');
   return {id,status:'PENDING' as const,attempts:job.attempts};
  }
  configAssert(job.unknownOutcome&&job.attempts>0,409,'DELIVERY_NOT_RESERVED');
  try{await adapter.send(id,structuredClone(job.payload));}catch{job.lastError='DELIVERY_OUTCOME_UNKNOWN';audit('unknown',job.lastError);return {id,status:'PENDING' as const,attempts:job.attempts};}
  // Failure after acceptance rolls back local state; durable receiver deduplication
  // makes retry of this same request ID safe.
  await adapter.accepted?.(tx,job,id);configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');
  await tx.domain.query("UPDATE crm_interface_log SET retry_count=@attempts WHERE company_id=@companyKey AND request_id=@id",{companyKey:tx.domain.companyKey,id,attempts:job.attempts});
  item.status='SENT';job.unknownOutcome=false;job.lastError=null;
  audit('sent','Transport accepted; business result pending');
  // ERP result ingestion, not transport acceptance, closes the business pending count.
  return {id,status:'SENT' as const,attempts:job.attempts};
 });};
 // Reservation commits independently, so a later local rollback cannot erase the
 // possibility that the external recipient accepted a request.
 const reserved=await phase(true);if(reserved.status!=='PENDING')return reserved;
 return phase(false);
}
