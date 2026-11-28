import {z} from 'zod';
import {resolveActorPolicy} from '@dio-crm/contracts/crm-customization';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert,type ConfigTransaction} from './config-store';
import {validateFieldWrite,type FieldBinding} from './field-policy';
import {assertDomainMarketFeature} from './domain-market';
import {enqueueDomainDelivery} from './domain-outbox';
import {notifyApproval} from './domain-approvals';
import type {AuthenticatedRequest} from '../security/security';

type Domain=NonNullable<ConfigTransaction['domain']>;
const uuid=z.string().uuid().transform(value=>value.toLowerCase());
const context=(req:AuthenticatedRequest)=>({releaseId:uuid.parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])});
const key=(req:AuthenticatedRequest)=>{const value=req.headers['idempotency-key'];configAssert(typeof value==='string'&&value.length>0,428,'IDEMPOTENCY_REQUIRED');return value;};
const reassignFields:FieldBinding[]=[['reassignStep','step','step'],['approverUserId','approverUserId','approver_user_id'],['reassignReason','reason','reason']].map(([id,input,column])=>({fieldId:'directWork.'+id,input,column,output:column}));
const reassignInput=z.object({step:z.enum(['BRANCH','DIVISION']),approverUserId:z.coerce.number().int().positive(),reason:z.string().trim().min(1).max(500)}).strict();

async function load(domain:Domain,publicId:string){
 await assertDomainMarketFeature(domain,'DIRECT_WORK');
 const result=await domain.query<Record<string,any>>("SELECT d.direct_work_id,d.activity_id,d.owner_user_id,d.status,d.approval_round,d.branch_approver_user_id,d.division_approver_user_id,d.erp_sync_status,CONVERT(varchar(36),d.erp_request_id) erp_request_id,d.work_type,d.reason,a.status activity_status FROM crm_direct_work d WITH(UPDLOCK,HOLDLOCK) JOIN crm_activity a WITH(HOLDLOCK) ON a.activity_id=d.activity_id AND a.company_id=d.company_id WHERE d.company_id=@companyKey AND d.public_id=@publicId",{companyKey:domain.companyKey,publicId});
 configAssert(result.recordset.length===1,404,'NOT_FOUND');return result.recordset[0];
}
async function candidates(domain:Domain,row:Record<string,any>,step:'BRANCH'|'DIVISION',candidateId?:number){
 const permission='DIRECT_WORK.APPROVE.'+step;
 return domain.query<{user_id:number;user_name:string}>("SELECT DISTINCT TOP 100 u.user_id,u.user_name FROM crm_direct_work d WITH(HOLDLOCK) JOIN crm_user owner WITH(HOLDLOCK) ON owner.user_id=d.owner_user_id AND owner.company_id=d.company_id JOIN crm_user u WITH(HOLDLOCK) ON u.company_id=d.company_id AND u.is_active=1 AND u.deleted_yn=0 AND (@step='DIVISION' OR u.organization_id=owner.organization_id) AND (@candidateId IS NULL OR u.user_id=@candidateId) WHERE d.company_id=@companyKey AND d.direct_work_id=@id AND EXISTS(SELECT 1 FROM crm_user_role ur WITH(HOLDLOCK) JOIN crm_role r WITH(HOLDLOCK) ON r.role_id=ur.role_id AND r.is_active=1 JOIN crm_role_permission rp WITH(HOLDLOCK) ON rp.role_id=r.role_id JOIN crm_permission p WITH(HOLDLOCK) ON p.permission_id=rp.permission_id AND p.is_active=1 WHERE ur.user_id=u.user_id AND p.permission_code=@permission) ORDER BY u.user_name,u.user_id",{companyKey:domain.companyKey,id:row.direct_work_id,step,candidateId:candidateId??null,permission});
}

export async function executeDirectWorkExtension(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const route=req.path.replace(/\/$/,''),approvers=/^\/api\/direct-works\/([a-f0-9-]{36})\/approvers$/i.exec(route),command=/^\/api\/direct-works\/([a-f0-9-]{36})\/(reassign|erp\/retry)$/i.exec(route);
 if(req.method==='GET'&&approvers){
  const publicId=uuid.parse(approvers[1]),query=z.object({step:z.enum(['BRANCH','DIVISION'])}).strict().parse(req.query);
  return service.readRuntimeContext(actor,async(domain,_config,policy)=>{
   configAssert(policy.some(item=>item.id==='HQ_DIRECT_WORK'&&item.readable)&&policy.some(item=>item.id==='DW.reassign'&&item.enabled&&item.readable),403,'ACTION_DENIED');
   const row=await load(domain,publicId);configAssert(row.status===(query.step==='BRANCH'?'REQUESTED':'BRANCH_APPROVED'),409,'DIRECT_WORK_STATE_CONFLICT');
   const result=await candidates(domain,row,query.step);return result.recordset.map(item=>({public_id:String(item.user_id),name:item.user_name}));
  });
 }
 configAssert(req.method==='POST'&&command,404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const publicId=uuid.parse(command[1]),reassign=command[2]==='reassign',input=reassign?reassignInput.parse(req.body):z.object({}).strict().parse(req.body??{}),action=reassign?'DW.reassign':'DW.erpRetry';
 return service.executeBusiness(actor,context(req),action,key(req),{publicId,input},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(domain,publicId),member=state.members[actor.id],policy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},effective=state.releases[state.activeReleaseId!].effective;
  if(reassign){
   const body=input as z.infer<typeof reassignInput>,columns=validateFieldWrite(effective,actor.companyId,policy,reassignFields,body,{},'update',{'directWork.status':row.status}),step=columns.step as 'BRANCH'|'DIVISION';
   configAssert(row.status===(step==='BRANCH'?'REQUESTED':'BRANCH_APPROVED'),409,'DIRECT_WORK_STATE_CONFLICT');
   const target=(await candidates(domain,row,step,columns.approver_user_id as number)).recordset;configAssert(target.length===1,422,'APPROVER_INVALID');
   const column=step==='BRANCH'?'branch_approver_user_id':'division_approver_user_id',before=row[column],after=target[0].user_id;configAssert(before!==after,409,'APPROVER_UNCHANGED');
   const params={companyKey:domain.companyKey,id:row.direct_work_id,expected:row.status,round:row.approval_round,before,after,userKey};
   const changed=await domain.query('UPDATE crm_direct_work SET '+column+'=@after,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND direct_work_id=@id AND status=@expected AND approval_round=@round AND ('+column+'=@before OR ('+column+' IS NULL AND @before IS NULL))',params);configAssert(changed.rowsAffected?.[0]===1,409,'DIRECT_WORK_STATE_CONFLICT');
   await domain.query("INSERT INTO crm_approval_action(company_id,target_type,target_id,approval_round,step_code,approver_user_id,action,comment) VALUES(@companyKey,'DIRECT_WORK',@id,@round,@step,@userKey,'REASSIGNED',@reason)",{...params,step,reason:columns.reason});
   await domain.query("INSERT INTO crm_audit_log(company_id,actor_user_id,entity_type,entity_id,action,before_json,after_json) VALUES(@companyKey,@userKey,'DIRECT_WORK',@publicId,'DW.reassign',@beforeJson,@afterJson)",{companyKey:domain.companyKey,userKey,publicId,beforeJson:JSON.stringify({step,approverUserId:before}),afterJson:JSON.stringify({step,approverUserId:after})});
   await notifyApproval(domain,after,'DIRECT_REQUEST');return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,step,approverUserId:after}};
  }
  configAssert(row.status==='DIVISION_APPROVED'&&row.activity_status==='COMPLETED'&&['FAILED','TIMED_OUT'].includes(row.erp_sync_status),409,'INTERFACE_NOT_RETRYABLE');
  configAssert(row.erp_request_id,409,'INTERFACE_NOT_RETRYABLE');const previous=await domain.query<{status:string}>("SELECT status FROM crm_interface_log WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND request_id=@requestId AND interface_code='IF-ERP-012' AND entity_id=@publicId",{companyKey:domain.companyKey,requestId:row.erp_request_id,publicId});
  configAssert(previous.recordset.length===1&&['FAILED','TIMED_OUT'].includes(previous.recordset[0].status),409,'INTERFACE_NOT_RETRYABLE');
  const prior=state.outbox.find(item=>item.id===row.erp_request_id);configAssert(!prior||prior.status!=='PENDING'&&prior.status!=='REVIEW_REQUIRED'&&!prior.delivery?.unknownOutcome,409,'DELIVERY_OUTCOME_UNKNOWN');
  const requestId=await enqueueDomainDelivery(tx,actor,{actionId:action,interfaceCode:'IF-ERP-012',entityId:publicId,sourceFieldIds:['directWork.type','directWork.reason'],payload:{directWorkPublicId:publicId,workType:row.work_type,reason:row.reason}});
  const changed=await domain.query("UPDATE crm_direct_work SET erp_sync_status='REQUESTING',erp_request_id=@requestId,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND direct_work_id=@id AND status='DIVISION_APPROVED' AND erp_sync_status=@expected AND erp_request_id=@previousId",{companyKey:domain.companyKey,id:row.direct_work_id,requestId,previousId:row.erp_request_id,expected:row.erp_sync_status,userKey});configAssert(changed.rowsAffected?.[0]===1,409,'DIRECT_WORK_STATE_CONFLICT');
  await domain.query("INSERT INTO crm_audit_log(company_id,actor_user_id,entity_type,entity_id,action,before_json,after_json,request_id) VALUES(@companyKey,@userKey,'DIRECT_WORK',@publicId,'DW.erpRetry',@beforeJson,@afterJson,@requestId)",{companyKey:domain.companyKey,userKey,publicId,beforeJson:JSON.stringify({requestId:row.erp_request_id,status:row.erp_sync_status}),afterJson:JSON.stringify({requestId,status:'REQUESTING'}),requestId});
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,requestId,status:'REQUESTING'}};
 },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain,publicId);});
}
