import {z} from 'zod';import {ACCOUNT_INTERFACE_FIELDS,missingErpAccountFields} from '@dio-crm/contracts';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert,type ConfigTransaction} from './config-store';import {requireQueryFields} from './field-policy';
import {assertDomainMarketFeature} from './domain-market';import {enqueueDomainDelivery} from './domain-outbox';import type {AuthenticatedRequest} from '../security/security';
const outgoing=ACCOUNT_INTERFACE_FIELDS.filter(f=>f.direction==='OUT'||f.code==='co_cd');
export async function requestConfiguredErpAccount(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const match=/^\/api\/erp-accounts\/([a-f0-9-]{36})\/request\/?$/i.exec(req.path);configAssert(req.method==='POST'&&match,404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');z.object({}).strict().parse(req.body??{});const publicId=z.string().uuid().parse(match[1]).toLowerCase(),key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])};
 const load=async(domain:NonNullable<ConfigTransaction['domain']>)=>{
  await assertDomainMarketFeature(domain,'ERP_ACCOUNT_APPROVAL');
  const cols=[...new Set(outgoing.filter(f=>f.crmField&&f.crmField!=='company_code').map(f=>f.crmField!))],r=await domain.query<Record<string,any>>('SELECT a.account_id,a.erp_approved_yn,a.integration_status,c.company_code,'+cols.map(c=>c==='open_date'?'CONVERT(varchar(10),a.open_date,23) open_date':'a.'+c).join(',')+' FROM crm_account a WITH(UPDLOCK,HOLDLOCK) JOIN crm_company c WITH(HOLDLOCK) ON c.company_id=a.company_id WHERE a.company_id=@companyKey AND a.public_id=@publicId AND a.owner_user_id=@userKey AND a.deleted_yn=0',{companyKey:domain.companyKey,publicId,userKey});configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];
 };
 return service.executeBusiness(actor,context,'ACC.erpRequest',key,{publicId},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const row=await load(tx.domain),member=state.members[actor.id],policy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},sourceFieldIds=outgoing.map(f=>'account.erp.'+f.code);
  requireQueryFields(state.releases[state.activeReleaseId!].effective,actor.companyId,policy,sourceFieldIds);configAssert(!['REQUESTING','PENDING'].includes(row.integration_status)&&!row.erp_approved_yn,409,'ERP_REQUEST_CONFLICT');configAssert(missingErpAccountFields(row,'').length===0,422,'ERP_REQUIRED_FIELDS');
  const payload={schemaVersion:1,accountPublicId:publicId,fields:Object.fromEntries(outgoing.map(f=>[f.code,f.crmField?row[f.crmField]??null:null]))},requestId=await enqueueDomainDelivery(tx,actor,{actionId:'ACC.erpRequest',interfaceCode:'IF-ERP-002',entityId:publicId,sourceFieldIds,payload});
  const changed=await tx.domain.query("UPDATE crm_account SET integration_status='REQUESTING',last_erp_request_id=@requestId,erp_requested_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND account_id=@id AND owner_user_id=@userKey AND deleted_yn=0",{companyKey:tx.domain.companyKey,id:row.account_id,userKey,requestId});configAssert(changed.rowsAffected?.[0]===1,409,'ERP_REQUEST_CONFLICT');
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{requestId,status:'QUEUED'}};
 },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain);});
}
