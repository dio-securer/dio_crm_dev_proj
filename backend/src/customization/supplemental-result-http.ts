import {validateCreation} from './creation-policy';
import {Controller,Post,Req,Res,UseGuards,UseFilters} from '@nestjs/common';import {z} from 'zod';import type {Response} from 'express';
import {AuthGuard,type AuthenticatedRequest} from '../security/security';import {ConfigurationErrors,ConfigurationIdentity} from './config-http';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert,type ConfigTransaction} from './config-store';
import {validateFieldWrite,type FieldBinding} from './field-policy';import {completeDomainDelivery} from './domain-outbox';import {finishChangedPlan} from './domain-delivery-adapters';
const bindings:FieldBinding[]=['requestId','entityId','success','message'].map(id=>({fieldId:'integrationResult.'+id,input:id,column:id,output:id}));
export async function applySupplementalResult(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor){
 const plan=req.path.replace(/\/$/,'')==='/api/erp-results/collection-plan';configAssert(req.method==='POST'&&(plan||req.path.replace(/\/$/,'')==='/api/erp-results/direct-work'),404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const uuid=z.string().uuid().transform(s=>s.toLowerCase()),input=z.object({requestId:uuid,entityId:uuid,success:z.boolean(),message:z.string().max(2000).optional()}).strict().parse(req.body),key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');const context={releaseId:uuid.parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])};
 const load=async(domain:NonNullable<ConfigTransaction['domain']>)=>{
  const sql=plan?'SELECT c.contract_id id FROM crm_contract c WITH(UPDLOCK,HOLDLOCK) WHERE c.company_id=@companyKey AND c.public_id=@entityId AND c.deleted_yn=0 AND EXISTS(SELECT 1 FROM crm_collection_plan p WITH(HOLDLOCK) WHERE p.contract_id=c.contract_id AND p.last_erp_request_id=@requestId)':'SELECT direct_work_id id FROM crm_direct_work WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@entityId AND erp_request_id=@requestId';
  const r=await domain.query<{id:number}>(sql,{companyKey:domain.companyKey,entityId:input.entityId,requestId:input.requestId});configAssert(r.recordset.length===1,409,'DELIVERY_ENTITY_CHANGED');return r.recordset[0];
 };
 return service.executeBusiness(actor,context,plan?'ERP.receivePlan':'ERP.receiveDirectWork',key,input,async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(domain),member=state.members[actor.id],policy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied};validateFieldWrite(state.releases[state.activeReleaseId!].effective,actor.companyId,policy,bindings,input,{},'create');
  const result=await completeDomainDelivery(tx,actor,{...input,interfaceCode:plan?'IF-ERP-011':'IF-ERP-012',result:input},async job=>{
   if(plan)await finishChangedPlan(tx,input.entityId,input.requestId,job.payload,input.success);
   else {validateCreation(state.releases[state.activeReleaseId!].effective,actor.companyId,policy,[],{},{'directWork.erpStatus':input.success?'SUCCESS':'FAILED'},['directWork.erpStatus']);const r=await domain.query("UPDATE crm_direct_work SET erp_sync_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,updated_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND direct_work_id=@id AND erp_request_id=@requestId AND erp_sync_status='REQUESTING'",{companyKey:domain.companyKey,id:row.id,requestId:input.requestId,success:input.success});configAssert(r.rowsAffected?.[0]===1,409,'DELIVERY_ENTITY_CHANGED');}
  });return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:result};
 },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain);});
}
@Controller('api/erp-results')
@UseGuards(AuthGuard)
@UseFilters(ConfigurationErrors)
export class ConfigurationSupplementalResultController{
 constructor(private readonly service:CompanyConfigurationService,private readonly identity:ConfigurationIdentity){}
 @Post('collection-plan')plan(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.apply(req,res);}
 @Post('direct-work')direct(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return this.apply(req,res);}
 private async apply(req:AuthenticatedRequest,res:Response){const result=await applySupplementalResult(this.service,req,await this.identity.actor(req));res.setHeader('X-Config-Release-Id',result.releaseId);res.setHeader('X-Config-Permission-Version',String(result.permissionVersion));return result.data;}
}
