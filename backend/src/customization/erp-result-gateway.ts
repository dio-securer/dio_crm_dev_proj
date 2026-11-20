import {ingestConfiguredCollections} from './collection-ingest';
import {Injectable} from '@nestjs/common';import {z} from 'zod';
import {CompanyConfigurationService,type ConfigActor} from './config-service';import {configAssert,type ConfigTransaction} from './config-store';
import {validateFieldWrite,type FieldBinding} from './field-policy';import {validateCreation} from './creation-policy';import {completeDomainDelivery} from './domain-outbox';import type {AuthenticatedRequest} from '../security/security';
const bindings:FieldBinding[]=['requestId','entityId','success','erpCode','message'].map(id=>({fieldId:'integrationResult.'+id,input:id,column:id,output:id}));
@Injectable()
export class ConfiguredErpResultGateway{
 constructor(private readonly service:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  if(req.path.replace(/\/$/,'')==='/api/erp-results/collections')return ingestConfiguredCollections(this.service,req,actor);
  const order=req.path.replace(/\/$/,'')==='/api/erp-fulfillment/order-result';
  const match=order?['','order']:/^\/api\/erp-results\/(account|contract)\/?$/i.exec(req.path);configAssert(req.method==='POST'&&match,404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const account=match[1]==='account',uuid=z.string().uuid().transform(s=>s.toLowerCase()),schema=z.object({requestId:uuid,success:z.boolean(),message:z.string().max(2000).optional(),...(order?{orderPublicId:uuid,erpOrderNo:z.string().trim().min(1).max(80).optional()}:account?{accountPublicId:uuid,erpCustomerCode:z.string().trim().min(1).max(80).optional()}:{contractPublicId:uuid,erpContractNo:z.string().trim().min(1).max(80).optional()})}).strict(),raw=schema.parse(req.body) as Record<string,any>;
  configAssert(!raw.success||raw[order?'erpOrderNo':account?'erpCustomerCode':'erpContractNo'],422,'ERP_REQUIRED_FIELDS');
  const input={requestId:raw.requestId,entityId:raw[order?'orderPublicId':account?'accountPublicId':'contractPublicId'],success:raw.success,...(raw[order?'erpOrderNo':account?'erpCustomerCode':'erpContractNo']?{erpCode:raw[order?'erpOrderNo':account?'erpCustomerCode':'erpContractNo']}:{}),...(raw.message!==undefined?{message:raw.message}:{})},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
  const context={releaseId:uuid.parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])},table=order?'crm_order':account?'crm_account':'crm_contract',idColumn=order?'order_id':account?'account_id':'contract_id';
  const load=async(domain:NonNullable<ConfigTransaction['domain']>)=>{
   const r=await domain.query<Record<string,any>>('SELECT '+idColumn+' id,integration_status,CONVERT(varchar(36),last_erp_request_id) last_request FROM '+table+' WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND deleted_yn=0',{companyKey:domain.companyKey,publicId:input.entityId});configAssert(r.recordset.length===1,404,'NOT_FOUND');configAssert(r.recordset[0].last_request?.toLowerCase()===input.requestId,409,'DELIVERY_ENTITY_CHANGED');return r.recordset[0];
  };
  return this.service.executeBusiness(actor,context,order?'ERP.receiveOrder':account?'ERP.receiveAccount':'ERP.receiveContract',key,input,async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,row=await load(domain),member=state.members[actor.id],policy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},effective=state.releases[state.activeReleaseId!].effective;
   validateFieldWrite(effective,actor.companyId,policy,bindings,input,{},'create');
   const status=input.success?'SUCCESS':'FAILED';
   const result=await completeDomainDelivery(tx,actor,{requestId:input.requestId,interfaceCode:order?'IF-ERP-007':account?'IF-ERP-002':'IF-ERP-004',entityId:input.entityId,success:input.success,result:input},async()=>{
    configAssert(row.integration_status==='REQUESTING',409,'DELIVERY_ENTITY_CHANGED');
    // Immutable sync outputs are controlled by the dedicated incoming fields/action above.
    // The destination still enforces enabled/default/type requirements.
    const values:Record<string,unknown>=order?{'order.status':input.success?'ACCEPTED':'FAILED','order.integrationStatus':status,...(input.success?{'order.erpOrderNo':input.erpCode}:{})}:account?{'account.erpApprovedYn':input.success,'account.integrationStatus':status,...(input.success?{'account.erpCustomerCode':input.erpCode}:{})}:{'contract.status':input.success?'ERP_APPROVED':'ERP_FAILED','contract.integrationStatus':status,...(input.success?{'contract.erpContractNo':input.erpCode}:{})};
    validateCreation(effective,actor.companyId,policy,[],{},values,Object.keys(values));
    const params={companyKey:domain.companyKey,id:row.id,requestId:input.requestId,success:input.success,erpCode:input.erpCode??null,userKey};
    const sql=order?"UPDATE crm_order SET status=CASE WHEN @success=1 THEN 'ACCEPTED' ELSE 'FAILED' END,integration_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,erp_order_no=CASE WHEN @success=1 THEN @erpCode ELSE erp_order_no END,erp_updated_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND order_id=@id AND last_erp_request_id=@requestId AND integration_status='REQUESTING'":account?"UPDATE crm_account SET erp_customer_code=CASE WHEN @success=1 THEN @erpCode ELSE erp_customer_code END,erp_approved_yn=@success,integration_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND account_id=@id AND last_erp_request_id=@requestId AND integration_status='REQUESTING'":"UPDATE crm_contract SET status=CASE WHEN @success=1 THEN 'ERP_APPROVED' ELSE 'ERP_FAILED' END,integration_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,erp_approval_status=CASE WHEN @success=1 THEN 'APPROVED' ELSE 'FAILED' END,erp_contract_no=CASE WHEN @success=1 THEN @erpCode ELSE erp_contract_no END,erp_approved_at=CASE WHEN @success=1 THEN SYSUTCDATETIME() ELSE erp_approved_at END,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND contract_id=@id AND last_erp_request_id=@requestId AND integration_status='REQUESTING'";
    const changed=await domain.query(sql,params);configAssert(changed.rowsAffected?.[0]===1,409,'DELIVERY_ENTITY_CHANGED');
    if(!account&&!order&&input.success)await domain.query('UPDATE crm_collection_plan SET locked_yn=1 WHERE contract_id=@id AND plan_version=1',{id:row.id});
   });
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:result};
  },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain);});
 }
}
