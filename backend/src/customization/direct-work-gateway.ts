import {Injectable} from '@nestjs/common';import {z} from 'zod';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert,type ConfigTransaction} from './config-store';
import {projectFields,validateFieldWrite,type FieldBinding} from './field-policy';import {assertDomainMarketFeature} from './domain-market';
import {approvalRoute,notifyApproval} from './domain-approvals';import {queueDirectWorkIfReady} from './activity-gps';
import {canResubmitDirectWork,nextDirectWorkStatus,type DirectWorkStatus} from '../modules/activity/activity.rules';import type {AuthenticatedRequest} from '../security/security';
import {executeDirectWorkExtension} from './direct-work-extension';
const bind=(id:string,column:string,input=id):FieldBinding=>({fieldId:'directWork.'+id,input,column,output:column});
export const directWorkBindings=[bind('type','work_type'),bind('reason','reason'),bind('status','status'),bind('erpStatus','erp_sync_status'),...['ownerUserId','branchApproverUserId','divisionApproverUserId','approvalRound','activityPublicId','relatedName','plannedAt','activityStatus'].map((id,i)=>bind(id,['owner_user_id','branch_approver_user_id','division_approver_user_id','approval_round','activity_public_id','related_name_snapshot','planned_at','activity_status'][i]))];
const select="d.direct_work_id,d.activity_id,d.company_id,CONVERT(varchar(36),d.public_id) public_id,d.work_type,d.reason,d.status,d.erp_sync_status,d.owner_user_id,d.branch_approver_user_id,d.division_approver_user_id,d.approval_round,CONVERT(varchar(36),a.public_id) activity_public_id,a.related_name_snapshot,CONVERT(varchar(19),a.planned_at,126) planned_at,a.status activity_status FROM crm_direct_work d WITH(UPDLOCK,HOLDLOCK) JOIN crm_activity a WITH(HOLDLOCK) ON a.activity_id=d.activity_id AND a.company_id=d.company_id ";
type Domain=NonNullable<ConfigTransaction['domain']>;
@Injectable()
export class ConfiguredDirectWorkGateway{
 constructor(private readonly service:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const route=req.path.replace(/\/$/,'');if(/^\/api\/direct-works\/[a-f0-9-]{36}\/(approvers|reassign|erp\/retry)$/i.test(route))return executeDirectWorkExtension(this.service,req,actor,userKey);configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  if(req.method==='GET'&&route==='/api/direct-works')return this.service.readSqlList(actor,'HQ_DIRECT_WORK',{bindings:directWorkBindings,load:async domain=>{
   await assertDomainMarketFeature(domain,'DIRECT_WORK');const r=await domain.query<Record<string,any>>('SELECT TOP 200 '+select+'WHERE d.company_id=@companyKey AND (d.owner_user_id=@userKey OR d.branch_approver_user_id=@userKey OR d.division_approver_user_id=@userKey) ORDER BY d.direct_work_id DESC',{companyKey:domain.companyKey,userKey});
   return r.recordset.map(row=>({companyKey:Number(row.company_id),publicId:row.public_id,row}));
  }},['activity.relatedName','activity.plannedAt','activity.status']);
  const match=/^\/api\/direct-works\/([a-f0-9-]{36})\/(request-approval|decision\/(branch|division))$/i.exec(route);configAssert(req.method==='POST'&&match,404,'NOT_FOUND');
  const publicId=z.string().uuid().parse(match[1]),request=match[2]==='request-approval',step=match[3]==='branch'?'BRANCH':'DIVISION',input=request?z.object({}).strict().parse(req.body??{}):z.object({action:z.enum(['APPROVE','REJECT']),comment:z.string().max(1000).optional()}).strict().parse(req.body);
  const key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])},action=request?'DW.request':step==='BRANCH'?'DW.decision.branch':'DW.decision.division';
  const load=async(domain:Domain)=>{await assertDomainMarketFeature(domain,'DIRECT_WORK');const r=await domain.query<Record<string,any>>('SELECT '+select+'WHERE d.company_id=@companyKey AND d.public_id=@publicId',{companyKey:domain.companyKey,publicId});configAssert(r.recordset.length===1,404,'NOT_FOUND');const row=r.recordset[0];configAssert(row[request?'owner_user_id':step==='BRANCH'?'branch_approver_user_id':'division_approver_user_id']===userKey,403,'APPROVAL_ASSIGNEE_REQUIRED');return row;};
  return this.service.executeBusiness(actor,context,action,key,{publicId,input},async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(domain),effective=state.releases[state.activeReleaseId!].effective,member=state.members[actor.id],policy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},params={companyKey:domain.companyKey,id:row.direct_work_id,userKey,expected:row.status};let next:string,round=Number(row.approval_round);
   configAssert(Number.isSafeInteger(round)&&round>0,409,'DIRECT_WORK_STATE_CONFLICT');
   if(request){
    const resubmit=canResubmitDirectWork(row.status);configAssert(row.status==='DRAFT'||resubmit,409,'DIRECT_WORK_STATE_CONFLICT');configAssert(row.erp_sync_status==='NOT_REQUESTED',409,'DIRECT_WORK_STATE_CONFLICT');if(resubmit)round++;
    const route=await approvalRoute(domain,userKey,'DIRECT_WORK');next='REQUESTED';const changed=await domain.query("UPDATE crm_direct_work SET status='REQUESTED',approval_round=@round,branch_approver_user_id=@branch,division_approver_user_id=@division,requested_at=SYSUTCDATETIME(),branch_approved_at=NULL,division_approved_at=NULL,rejected_at=NULL,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND direct_work_id=@id AND status=@expected",{...params,round,branch:route.branch_approver_user_id,division:route.division_approver_user_id});configAssert(changed.rowsAffected?.[0]===1,409,'DIRECT_WORK_STATE_CONFLICT');await notifyApproval(domain,route.branch_approver_user_id,'DIRECT_REQUEST');
   }else{
    const columns=validateFieldWrite(effective,actor.companyId,policy,[bind('decision','action','action'),bind('comment','comment')],input,{},'create',Object.fromEntries(directWorkBindings.map(b=>[b.fieldId,row[b.column]]))),decision=z.enum(['APPROVE','REJECT']).parse(columns.action);
    const status=nextDirectWorkStatus(row.status as DirectWorkStatus,step,decision);configAssert(status,409,'DIRECT_WORK_STATE_CONFLICT');next=status;
    await domain.query("INSERT INTO crm_approval_action(company_id,target_type,target_id,approval_round,step_code,approver_user_id,action,comment) VALUES(@companyKey,'DIRECT_WORK',@id,@round,@step,@userKey,@action,@comment)",{...params,round,step,action:decision==='APPROVE'?'APPROVED':'REJECTED',comment:columns.comment??null});
    const timestamp=next==='BRANCH_APPROVED'?'branch_approved_at':next==='DIVISION_APPROVED'?'division_approved_at':'rejected_at';
    const changed=await domain.query('UPDATE crm_direct_work SET status=@status,'+timestamp+'=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND direct_work_id=@id AND status=@expected',{...params,status:next});configAssert(changed.rowsAffected?.[0]===1,409,'DIRECT_WORK_STATE_CONFLICT');
    if(next==='DIVISION_APPROVED')await queueDirectWorkIfReady(tx,actor,row.activity_id,action);
    await notifyApproval(domain,next==='BRANCH_APPROVED'?row.division_approver_user_id:row.owner_user_id,next==='BRANCH_APPROVED'?'DIRECT_REQUEST':next==='DIVISION_APPROVED'?'DIRECT_APPROVED':'DIRECT_REJECTED');
   }
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...projectFields(effective,actor.companyId,policy,[bind('status','status'),bind('approvalRound','approval_round')],{status:next,approval_round:round})}};
  },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain);});
 }
}
