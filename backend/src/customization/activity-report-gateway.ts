import {Injectable} from '@nestjs/common';import {z} from 'zod';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {projectFields,requireQueryFields,validateFieldWrite,type FieldBinding} from './field-policy';import {validateCreation} from './creation-policy';
import {nextReportStatus,type ReportStatus} from '../modules/activity/activity.rules';
import {approvalRoute,notifyApproval} from './domain-approvals';
import {assertDomainMarketFeature} from './domain-market';
import type {AuthenticatedRequest} from '../security/security';
const bind=(id:string,input:string,column:string):FieldBinding=>({fieldId:'report.'+id,input,column,output:column});
export const reportBindings=[bind('date','reportDate','report_date'),bind('status','status','status'),...['reporterUserId','branchApproverUserId','divisionApproverUserId','requestedAt','finalApprovedAt'].map((id,i)=>bind(id,id,['reporter_user_id','branch_approver_user_id','division_approver_user_id','requested_at','final_approved_at'][i]))];
export const reportItemBindings=[bind('itemId','itemId','report_item_id'),bind('itemType','itemType','item_type'),bind('plannedAt','plannedAt','planned_at_snapshot'),bind('relatedName','relatedName','related_name_snapshot'),bind('visitPurpose','visitPurpose','visit_purpose_snapshot'),bind('consultationSnapshot','consultationContent','consultation_snapshot')];
reportBindings.push(bind('version','version','version'),bind('branchComment','branchComment','branch_comment'),bind('divisionComment','divisionComment','division_comment'));
const header="report_id,company_id,CONVERT(varchar(18),row_version,1) version,approval_round,branch_comment,division_comment,CONVERT(varchar(36),public_id) public_id,CONVERT(varchar(10),report_date,23) report_date,status,reporter_user_id,branch_approver_user_id,division_approver_user_id,CONVERT(varchar(19),requested_at,126)+'Z' requested_at,CONVERT(varchar(19),final_approved_at,126)+'Z' final_approved_at";
const version=z.string().regex(/^0x[0-9a-f]{16}$/i);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
type Domain=NonNullable<ConfigTransaction['domain']>;
const policyFor=(s:ConfigState,a:ConfigActor)=>({authenticated:true,companyId:a.companyId,allowed:s.members[a.id].permissions,denied:s.members[a.id].denied});
@Injectable()
export class ConfiguredActivityReportGateway{
 constructor(private readonly service:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const route=req.path.replace(/\/$/,''),base='/api/activity-reports';configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const load=async(domain:Domain,publicId:string,own=false)=>{
   await assertDomainMarketFeature(domain,'ACTIVITY_APPROVAL');
   const r=await domain.query<Record<string,any>>('SELECT '+header+' FROM crm_activity_report WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND '+(own?'reporter_user_id=@userKey':'(reporter_user_id=@userKey OR branch_approver_user_id=@userKey OR division_approver_user_id=@userKey)'),{companyKey:domain.companyKey,publicId,userKey});configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];
  };
  if(req.method==='GET'&&route===base)return this.service.readSqlList(actor,'HQ_ACTIVITY_REPORT',{bindings:reportBindings,load:async domain=>{
   await assertDomainMarketFeature(domain,'ACTIVITY_APPROVAL');const r=await domain.query<Record<string,any>>('SELECT TOP 200 '+header+' FROM crm_activity_report WITH(HOLDLOCK) WHERE company_id=@companyKey AND (reporter_user_id=@userKey OR branch_approver_user_id=@userKey OR division_approver_user_id=@userKey) ORDER BY report_id DESC',{companyKey:domain.companyKey,userKey});
   return r.recordset.map(row=>({companyKey:Number(row.company_id),publicId:row.public_id,row}));
  }});
  const detail=/^\/api\/activity-reports\/([a-f0-9-]{36})$/i.exec(route);
  if(req.method==='GET'&&detail){const publicId=z.string().uuid().parse(detail[1]);return this.service.readSqlReport(actor,'HQ_ACTIVITY_REPORT',{
   header:{visibilityId:'HQ_ACTIVITY_REPORT',sourceFields:[],bindings:reportBindings,load:async domain=>[await load(domain,publicId)]},
   items:{visibilityId:'section:report.write',sourceFields:[],bindings:reportItemBindings,load:async domain=>{const row=await load(domain,publicId);return (await domain.query<Record<string,unknown>>('SELECT report_item_id,item_type,CONVERT(varchar(19),planned_at_snapshot,126) planned_at_snapshot,related_name_snapshot,visit_purpose_snapshot,consultation_snapshot FROM crm_activity_report_item WITH(HOLDLOCK) WHERE report_id=@reportId ORDER BY sort_order,report_item_id',{reportId:row.report_id})).recordset;}}
  });}
  const key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])};
  if(req.method==='POST'&&route===base+'/prepare'){
   const input=z.object({reportDate:date}).strict().parse(req.body);
   return this.service.executeBusiness(actor,context,'REP.prepare',key,input,async(state,tx)=>{
    configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,policy=policyFor(state,actor),effective=state.releases[state.activeReleaseId!].effective;
    const columns=validateCreation(effective,actor.companyId,policy,[reportBindings[0]],input,{'report.status':'DRAFT','report.reporterUserId':userKey},['report.date','report.status','report.reporterUserId']);
    const params={companyKey:domain.companyKey,userKey,reportDate:columns.report_date};
    const found=await domain.query<Record<string,any>>('SELECT '+header+' FROM crm_activity_report WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND reporter_user_id=@userKey AND report_date=@reportDate',params);
    let report=found.recordset[0];configAssert(!report||report.status==='DRAFT',409,'REPORT_EDIT_LOCKED');
    // Preparing an existing draft must not destroy edits or invalidate unseen snapshots.
    if(report)return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:report.public_id}};
    requireQueryFields(effective,actor.companyId,policy,['activity.status','activity.plannedAt','activity.relatedName','activity.visitPurpose','activity.consultation']);
    const sources=await domain.query<Record<string,any>>("SELECT activity_id,CASE WHEN planned_date=@reportDate THEN 'RESULT' ELSE 'PLAN' END item_type,CONVERT(varchar(19),planned_at,126) planned_at_snapshot,related_name_snapshot,visit_purpose visit_purpose_snapshot,consultation_content consultation_snapshot FROM crm_activity WITH(HOLDLOCK) WHERE company_id=@companyKey AND owner_user_id=@userKey AND ((planned_date=@reportDate AND status='COMPLETED') OR (planned_date>@reportDate AND planned_date<=DATEADD(day,5,CAST(@reportDate AS date)))) ORDER BY planned_at,activity_id",params);
    // Historical copies are server-owned, but still honor target defaults/required policies.
    for(const row of sources.recordset){validateCreation(effective,actor.companyId,policy,[],{},Object.fromEntries(reportItemBindings.filter(b=>b.fieldId!=='report.itemId').map(b=>[b.fieldId,row[b.column]])),reportItemBindings.filter(b=>b.fieldId!=='report.itemId').map(b=>b.fieldId));}
    if(!report){const r=await domain.query<Record<string,any>>("INSERT INTO crm_activity_report(company_id,reporter_user_id,report_date,status) OUTPUT inserted.report_id,CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@userKey,@reportDate,'DRAFT')",params);configAssert(r.recordset.length===1,500,'DOMAIN_WRITE_FAILED');report=r.recordset[0];}
    await domain.query('DELETE FROM crm_activity_report_item WHERE report_id=@reportId',{reportId:report.report_id});
    for(const [index,row] of sources.recordset.entries())await domain.query('INSERT INTO crm_activity_report_item(report_id,item_type,activity_id,planned_at_snapshot,related_name_snapshot,visit_purpose_snapshot,consultation_snapshot,sort_order) VALUES(@reportId,@type,@activityId,@planned,@name,@purpose,@consultation,@sort)',{reportId:report.report_id,type:row.item_type,activityId:row.activity_id,planned:row.planned_at_snapshot,name:row.related_name_snapshot,purpose:row.visit_purpose_snapshot,consultation:row.consultation_snapshot,sort:index});
    return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:report.public_id}};
   },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await assertDomainMarketFeature(tx.domain,'ACTIVITY_APPROVAL');});
  }
  const approval=/^\/api\/activity-reports\/([a-f0-9-]{36})\/(request-approval|(approve|reject|comment)\/(branch|division))$/i.exec(route);
  if(req.method==='POST'&&approval){
   const publicId=z.string().uuid().parse(approval[1]),request=approval[2]==='request-approval',decision=approval[3],step=approval[4]==='branch'?'BRANCH':'DIVISION',input=(request?z.object({expectedVersion:version}):z.object({expectedVersion:version,comment:decision==='comment'?z.string().trim().min(1).max(1000):z.string().max(1000).optional()})).strict().parse(req.body??{}),action=request?'REP.request':'REP.'+decision+(step==='BRANCH'?'Branch':'Division');
   const authorize=async(domain:Domain)=>{const row=await load(domain,publicId,request);if(!request)configAssert(row[step==='BRANCH'?'branch_approver_user_id':'division_approver_user_id']===userKey,403,'APPROVAL_ASSIGNEE_REQUIRED');return row;};
   return this.service.executeBusiness(actor,context,action,key,{publicId,input},async(state,tx)=>{
    configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await authorize(domain);configAssert(row.version===input.expectedVersion,409,'REPORT_EDIT_LOCKED');const effective=state.releases[state.activeReleaseId!].effective,policy=policyFor(state,actor),params={companyKey:domain.companyKey,reportId:row.report_id,userKey};let next:string;
    if(request){
     configAssert(['DRAFT','BRANCH_REJECTED','DIVISION_REJECTED'].includes(row.status),409,'REPORT_EDIT_LOCKED');const open=await domain.query("SELECT activity_id FROM crm_activity WITH(HOLDLOCK) WHERE company_id=@companyKey AND owner_user_id=@userKey AND planned_date=@date AND status='IN_PROGRESS'",{...params,date:row.report_date});configAssert(open.recordset.length===0,409,'REPORT_OPEN_ACTIVITY');
     const route=await approvalRoute(domain,userKey,'ACTIVITY_REPORT');next='REQUESTED';
     const changed=await domain.query("UPDATE crm_activity_report SET status='REQUESTED',approval_round=approval_round+1,branch_comment=NULL,division_comment=NULL,branch_approved_at=NULL,division_approved_at=NULL,final_approved_at=NULL,branch_approver_user_id=@branch,division_approver_user_id=@division,requested_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND report_id=@reportId AND status=@expected",{...params,expected:row.status,branch:route.branch_approver_user_id,division:route.division_approver_user_id});configAssert(changed.rowsAffected?.[0]===1,409,'REPORT_EDIT_LOCKED');await notifyApproval(domain,route.branch_approver_user_id,'REPORT_REQUEST');
    }else{
     const commentBinding=bind(step==='BRANCH'?'branchComment':'divisionComment','comment','comment'),values=Object.fromEntries(reportBindings.map(b=>[b.fieldId,row[b.column]]));const comment=validateFieldWrite(effective,actor.companyId,policy,[commentBinding],Object.fromEntries(Object.entries(input).filter(([key])=>key!=='expectedVersion')),{},'create',values).comment??null;
     configAssert(row.status===(step==='BRANCH'?'REQUESTED':'BRANCH_APPROVED'),409,'REPORT_EDIT_LOCKED');
     const commentColumn=step==='BRANCH'?'branch_comment':'division_comment',savedComment=comment??row[commentColumn]??null;
     if(!Object.hasOwn(input,'comment')&&savedComment!==null)requireQueryFields(effective,actor.companyId,policy,[commentBinding.fieldId]);
     if(decision==='comment'||decision==='reject')configAssert(typeof savedComment==='string'&&savedComment.trim().length>0,422,'REJECTION_REASON_REQUIRED');
     next=decision==='comment'?row.status:decision==='reject'?(step==='BRANCH'?'BRANCH_REJECTED':'DIVISION_REJECTED'):nextReportStatus(row.status as ReportStatus,step)!;
     const round=Number(row.approval_round);configAssert(Number.isSafeInteger(round)&&round>0,409,'REPORT_EDIT_LOCKED');
     await domain.query("INSERT INTO crm_approval_action(company_id,target_type,target_id,approval_round,step_code,approver_user_id,action,comment) VALUES(@companyKey,'ACTIVITY_REPORT',@reportId,@round,@step,@userKey,@action,@comment)",{...params,round,step,action:decision==='comment'?'COMMENTED':decision==='reject'?'REJECTED':'APPROVED',comment:savedComment});
     const timestamps=decision==='approve'?(step==='BRANCH'?',branch_approved_at=SYSUTCDATETIME()':',division_approved_at=SYSUTCDATETIME(),final_approved_at=SYSUTCDATETIME()'):'';
     const changed=await domain.query('UPDATE crm_activity_report SET status=@status,'+commentColumn+'=@comment'+timestamps+',updated_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND report_id=@reportId AND status=@expected AND approval_round=@round',{...params,status:next,comment:savedComment,round,expected:row.status});configAssert(changed.rowsAffected?.[0]===1,409,'REPORT_EDIT_LOCKED');
     if(decision!=='comment')await notifyApproval(domain,decision==='reject'?row.reporter_user_id:step==='BRANCH'?row.division_approver_user_id:row.reporter_user_id,decision==='reject'?'REPORT_REJECTED':step==='BRANCH'?'REPORT_REQUEST':'REPORT_APPROVED');
    }
    return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...projectFields(effective,actor.companyId,policy,[reportBindings[1]],{status:next})}};
   },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await authorize(tx.domain);});
  }
  const item=/^\/api\/activity-reports\/([a-f0-9-]{36})\/items\/(\d+)$/i.exec(route);configAssert(req.method==='PATCH'&&item,404,'NOT_FOUND');const publicId=z.string().uuid().parse(item[1]),itemId=z.coerce.number().int().positive().safe().parse(item[2]),input=z.object({expectedVersion:version,visitPurpose:z.string().max(500).optional(),consultationContent:z.string().max(10000).optional()}).strict().parse(req.body);
  return this.service.executeBusiness(actor,context,'REP.edit',key,{publicId,itemId,input},async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(domain,publicId,true);configAssert(row.version===input.expectedVersion,409,'REPORT_EDIT_LOCKED');configAssert(['DRAFT','REQUESTED','BRANCH_REJECTED','DIVISION_REJECTED'].includes(row.status),409,'REPORT_EDIT_LOCKED');
   const r=await domain.query<Record<string,any>>('SELECT report_item_id,item_type,CONVERT(varchar(19),planned_at_snapshot,126) planned_at_snapshot,related_name_snapshot,visit_purpose_snapshot,consultation_snapshot FROM crm_activity_report_item WITH(UPDLOCK,HOLDLOCK) WHERE report_id=@reportId AND report_item_id=@itemId',{reportId:row.report_id,itemId});configAssert(r.recordset.length===1,404,'NOT_FOUND');
   const effective=state.releases[state.activeReleaseId!].effective,policy=policyFor(state,actor),stored=r.recordset[0],contextValues=Object.fromEntries([...reportBindings.map(b=>[b.fieldId,row[b.column]]),...reportItemBindings.map(b=>[b.fieldId,stored[b.column]])]);
   const columns=validateFieldWrite(effective,actor.companyId,policy,reportItemBindings.slice(-2),Object.fromEntries(Object.entries(input).filter(([key])=>key!=='expectedVersion')),stored,'update',contextValues),pairs=Object.entries(columns),params:Record<string,unknown>={reportId:row.report_id,itemId};pairs.forEach(([,v],i)=>params['v'+i]=v);
   if(pairs.length){await domain.query('UPDATE crm_activity_report SET updated_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND report_id=@reportId',{companyKey:domain.companyKey,reportId:row.report_id});const saved=await domain.query('UPDATE crm_activity_report_item SET '+pairs.map(([c],i)=>c+'=@v'+i).join(',')+' WHERE report_id=@reportId AND report_item_id=@itemId',params);configAssert(saved.rowsAffected?.[0]===1,409,'REPORT_EDIT_LOCKED');}
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:projectFields(effective,actor.companyId,policy,reportItemBindings,{...stored,...columns})};
  },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain,publicId,true);});
 }
}
