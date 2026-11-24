import {z} from 'zod';import {resolveActorPolicy,type ConfigEntry} from '@dio-crm/contracts/crm-customization';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {requireQueryFields,validateFieldWrite,type FieldBinding} from './field-policy';import type {AuthenticatedRequest} from '../security/security';
const bind=(fieldId:string,column:string,input=column):FieldBinding=>({fieldId,input,column,output:column});
const accountFields=[bind('account.crmName','account_name'),bind('account.erp.biz_no','business_no'),bind('account.accountStatus','account_status'),bind('account.erpCustomerCode','erp_customer_code')];
const policyFor=(s:ConfigState,a:ConfigActor)=>({authenticated:true,companyId:a.companyId,allowed:s.members[a.id].permissions,denied:s.members[a.id].denied});
type Domain=NonNullable<ConfigTransaction['domain']>;
export async function handleAccountMerge(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const path=req.path.replace(/\/$/,'');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 if(req.method==='GET'&&path.startsWith('/api/accounts/duplicates/')){
  const businessNo=z.string().trim().min(1).max(20).parse(decodeURIComponent(path.slice('/api/accounts/duplicates/'.length)));
  return service.readSqlList(actor,'HQ_ACCOUNT',{bindings:accountFields,load:async(domain,_actor,policy)=>{
   const manager=policy.allowed.includes('ACCOUNT.MERGE')&&!policy.denied.includes('ACCOUNT.MERGE');const r=await domain.query<Record<string,unknown>>("SELECT company_id,CONVERT(varchar(36),public_id) public_id,account_name,business_no,account_status,erp_customer_code FROM crm_account WITH(HOLDLOCK) WHERE company_id=@companyKey AND business_no=@businessNo AND deleted_yn=0 AND account_status<>'MERGED' AND (@manager=1 OR owner_user_id=@userKey) ORDER BY account_id",{companyKey:domain.companyKey,businessNo,userKey,manager:manager?1:0});return r.recordset.map(row=>({companyKey:Number(row.company_id),publicId:String(row.public_id),row}));
  }},['account.erp.biz_no'],['merge.businessNo']);
 }
 configAssert(req.method==='POST'&&path==='/api/accounts/merge',404,'NOT_FOUND');const uuid=z.string().uuid().transform(s=>s.toLowerCase()),input=z.object({primaryPublicId:uuid,duplicatePublicIds:z.array(uuid).min(1).max(2)}).strict().parse(req.body);configAssert(new Set([input.primaryPublicId,...input.duplicatePublicIds]).size===input.duplicatePublicIds.length+1,422,'INVALID_REQUEST');
 const key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');const context={releaseId:uuid.parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])};
 const load=async(domain:Domain,publicId:string,includeMerged=false)=>{const r=await domain.query<Record<string,any>>('SELECT account_id,CONVERT(varchar(36),public_id) public_id,account_name,business_no,erp_customer_code,integration_status,account_status,merged_into_account_id,deleted_yn FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId'+(includeMerged?'':' AND deleted_yn=0'),{companyKey:domain.companyKey,publicId});configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];};
 return service.executeBusiness(actor,context,'ACC.merge',key,input,async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,effective=state.releases[state.activeReleaseId!].effective,policy=policyFor(state,actor),values={'merge.primaryPublicId':input.primaryPublicId,'merge.duplicatePublicIds':input.duplicatePublicIds};
  validateFieldWrite(effective,actor.companyId,policy,[bind('merge.primaryPublicId','primaryPublicId')],{primaryPublicId:input.primaryPublicId},{},'update',values);
  // Dedicated array adapter: catalog row cardinality and conditional context remain enforced.
  const entry=effective.entries.find(e=>e.id==='merge.duplicatePublicIds'),availability=resolveActorPolicy(effective,actor.companyId,policy,values).find(p=>p.id==='merge.duplicatePublicIds');
  configAssert(entry?.bindingKind==='DATA'&&entry.valueRule?.type==='rows',409,'STANDARD_ADAPTER_MISMATCH');const refs=(c:NonNullable<ConfigEntry['requiredWhen']>):string[]=>'fieldKey'in c?[c.fieldKey]:c.kind==='not'?refs(c.condition):c.kind==='all'||c.kind==='any'?c.conditions.flatMap(refs):[];
  if(entry.requiredWhen)configAssert(refs(entry.requiredWhen).every(id=>Object.hasOwn(values,id)),409,'POLICY_CONTEXT_UNAVAILABLE');configAssert(availability?.writable,403,'FIELD_WRITE_DENIED');configAssert(input.duplicatePublicIds.length>=(entry.valueRule.minLength??1)&&input.duplicatePublicIds.length<=(entry.valueRule.maxLength??2),422,'INVALID_FIELD_VALUE');
  requireQueryFields(effective,actor.companyId,policy,['account.erp.biz_no','account.erpCustomerCode']);
  const primary=await load(domain,input.primaryPublicId);configAssert(primary.account_status!=='MERGED'&&primary.business_no,409,'ACCOUNT_MERGE_CONFLICT');const duplicates=[];for(const id of input.duplicatePublicIds)duplicates.push(await load(domain,id));
  for(const row of [primary,...duplicates])configAssert(row.business_no===primary.business_no&&row.account_status!=='MERGED'&&row.erp_customer_code===primary.erp_customer_code&&!['REQUESTING','PENDING'].includes(row.integration_status),409,'ACCOUNT_MERGE_CONFLICT');
  configAssert(!state.outbox.some(job=>['PENDING','REVIEW_REQUIRED'].includes(job.status)&&job.delivery&&[input.primaryPublicId,...input.duplicatePublicIds].includes(job.delivery.entityId)),409,'ACCOUNT_MERGE_CONFLICT');
  for(const duplicate of duplicates){
   const p={companyKey:domain.companyKey,primary:primary.account_id,duplicate:duplicate.account_id,userKey};
   // Financial history stays immutable. Such accounts require a reviewed ERP reconciliation.
   for(const table of ['crm_contract','crm_order','crm_sales','crm_statement_generation']){const used=await domain.query('SELECT TOP 1 account_id FROM '+table+' WITH(HOLDLOCK) WHERE company_id=@companyKey AND account_id=@duplicate',p);configAssert(used.recordset.length===0,409,'ACCOUNT_MERGE_FINANCIAL_HISTORY');}
   const activities=await domain.query("SELECT owner_user_id,planned_date FROM crm_activity WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND related_type='ACCOUNT' AND related_id IN (@primary,@duplicate) GROUP BY owner_user_id,planned_date HAVING COUNT(*)>1",p);configAssert(!activities.recordset.length,409,'ACTIVITY_DUPLICATE');
   // Reparenting is a selected field change, so the destination field policy is checked too.
   for(const [table,fieldId] of [['crm_contact','contact.accountPublicId'],['crm_opportunity','opportunity.accountPublicId']]){
    const children=await domain.query('SELECT TOP 1 account_id FROM '+table+' WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND account_id=@duplicate',p);
    if(children.recordset.length)validateFieldWrite(effective,actor.companyId,policy,[bind(fieldId,'accountPublicId')],{accountPublicId:input.primaryPublicId});
    await domain.query('UPDATE '+table+' SET account_id=@primary,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND account_id=@duplicate',p);
   }
   const linked=await domain.query("SELECT TOP 1 activity_id FROM crm_activity WITH(HOLDLOCK) WHERE company_id=@companyKey AND related_type='ACCOUNT' AND related_id=@duplicate",p);const linkedEvents=await domain.query("SELECT TOP 1 event_id FROM crm_activity_event WITH(HOLDLOCK) WHERE company_id=@companyKey AND related_type='ACCOUNT' AND related_id=@duplicate",p);if(linked.recordset.length||linkedEvents.recordset.length)validateFieldWrite(effective,actor.companyId,policy,[bind('activity.relatedPublicId','relatedPublicId')],{relatedPublicId:input.primaryPublicId},{},'update',{'activity.relatedType':'ACCOUNT'});
   for(const table of ['crm_activity','crm_activity_event'])await domain.query("UPDATE "+table+" SET related_id=@primary,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND related_type='ACCOUNT' AND related_id=@duplicate",p);
   await domain.query('INSERT INTO crm_account_merge_history(primary_account_id,merged_account_id,merge_snapshot_json,merged_by) VALUES(@primary,@duplicate,@snapshot,@userKey)',{...p,snapshot:JSON.stringify(duplicate)});
   const changed=await domain.query("UPDATE crm_account SET account_status='MERGED',merged_into_account_id=@primary,deleted_yn=1,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND account_id=@duplicate AND deleted_yn=0",p);configAssert(changed.rowsAffected?.[0]===1,409,'ACCOUNT_MERGE_CONFLICT');
  }
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{primaryPublicId:input.primaryPublicId,mergedPublicIds:input.duplicatePublicIds}};
 },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const primary=await load(tx.domain,input.primaryPublicId);for(const id of input.duplicatePublicIds){const row=await load(tx.domain,id,true);configAssert(!row.deleted_yn||row.account_status==='MERGED'&&row.merged_into_account_id===primary.account_id,404,'NOT_FOUND');}});
}
