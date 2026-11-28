import {assertDomainMarketFeature} from './domain-market';
import type {DomainDeliveryAdapter,DomainEnvelope} from './domain-outbox';import {configAssert,type ConfigTransaction} from './config-store';
/** Deployment supplies an authenticated, bounded transport with durable receiver deduplication.
 * This module never creates a transport or dispatches automatically.
 */
export interface IdempotentDomainTransport {supportsIdempotency:true;send:(interfaceCode:string,requestId:string,payload:unknown)=>Promise<unknown>}
const kinds={
 'IF-ERP-007':{table:'crm_order',id:'order_id',owner:'owner_user_id',request:'last_erp_request_id'},
 'IF-ERP-002':{table:'crm_account',id:'account_id',owner:'owner_user_id',request:'last_erp_request_id'},
 'IF-ERP-004':{table:'crm_contract',id:'contract_id',owner:'owner_user_id',request:'last_erp_request_id'},
 'IF-ERP-012':{table:'crm_direct_work',id:'direct_work_id',owner:'owner_user_id',request:'erp_request_id'}
} as const;
type Code=keyof typeof kinds;
export function createDomainDeliveryAdapter(code:Code,transport:IdempotentDomainTransport):DomainDeliveryAdapter{
 configAssert(transport.supportsIdempotency===true,503,'IDEMPOTENT_TRANSPORT_REQUIRED');const spec=kinds[code];configAssert(spec,422,'INVALID_DELIVERY_ADAPTER');
 const pending=code==='IF-ERP-012'?'erp_sync_status':'integration_status';
 return {interfaceCode:code,supportsIdempotency:true,
  authorize:async(tx:ConfigTransaction,job:DomainEnvelope,requestId:string)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');
   if(code==='IF-ERP-002'||code==='IF-ERP-012')await assertDomainMarketFeature(tx.domain,code==='IF-ERP-002'?'ERP_ACCOUNT_APPROVAL':'DIRECT_WORK');
   // For direct work the original sender may be the assigned division approver or the checkout owner.
   const assignee=code==='IF-ERP-012'?"((@action='DW.decision.division' AND e.division_approver_user_id=u.user_id) OR (@action='ACT.checkOut' AND e.owner_user_id=u.user_id) OR @action='DW.erpRetry')":'e.'+spec.owner+'=u.user_id';
   const r=await tx.domain.query<Record<string,unknown>>('SELECT e.'+spec.id+' id FROM '+spec.table+' e WITH(UPDLOCK,HOLDLOCK) JOIN crm_user u WITH(HOLDLOCK) ON u.company_id=e.company_id AND u.public_id=@actorId AND u.is_active=1 AND u.deleted_yn=0 WHERE e.company_id=@companyKey AND e.public_id=@entityId AND e.'+spec.request+"=@requestId AND e."+pending+"='REQUESTING' AND "+assignee+(code==='IF-ERP-012'?" AND e.status='DIVISION_APPROVED' AND EXISTS(SELECT 1 FROM crm_activity a WITH(HOLDLOCK) WHERE a.activity_id=e.activity_id AND a.company_id=e.company_id AND a.status='COMPLETED')":' AND e.deleted_yn=0')+(code==='IF-ERP-004'?" AND e.status='ERP_REQUESTED'":code==='IF-ERP-007'?" AND e.status='REQUESTING'":''),{companyKey:tx.domain.companyKey,entityId:job.entityId,actorId:job.actorId,requestId,action:job.actionId});
   configAssert(r.recordset.length===1,409,'DELIVERY_ENTITY_CHANGED');
   if(code==='IF-ERP-007'){
    const eligible=await tx.domain.query("SELECT o.order_id FROM crm_order o WITH(HOLDLOCK) JOIN crm_contract c WITH(HOLDLOCK) ON c.contract_id=o.contract_id AND c.account_id=o.account_id AND c.company_id=o.company_id AND c.deleted_yn=0 JOIN crm_account a WITH(HOLDLOCK) ON a.account_id=o.account_id AND a.company_id=o.company_id AND a.deleted_yn=0 WHERE o.company_id=@companyKey AND o.public_id=@entityId AND c.status='ERP_APPROVED' AND c.close_yn=0 AND a.erp_approved_yn=1 AND EXISTS(SELECT 1 FROM crm_order_item i WITH(HOLDLOCK) WHERE i.order_id=o.order_id) AND NOT EXISTS(SELECT 1 FROM crm_order_item i WITH(HOLDLOCK) LEFT JOIN crm_product_package p WITH(HOLDLOCK) ON p.product_package_id=i.product_package_id AND p.company_id=o.company_id WHERE i.order_id=o.order_id AND (p.product_package_id IS NULL OR p.deleted_yn=1 OR p.is_active=0 OR p.order_available_yn=0))",{companyKey:tx.domain.companyKey,entityId:job.entityId});configAssert(eligible.recordset.length===1,409,'DELIVERY_ENTITY_CHANGED');
   }
  },
  send:(requestId,payload)=>transport.send(code,requestId,payload),
  cancelled:async(tx,job,requestId)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');
   await tx.domain.query('UPDATE '+spec.table+" SET "+pending+"='FAILED',"+(code==='IF-ERP-004'?"status='ERP_FAILED',":code==='IF-ERP-007'?"status='FAILED',":'')+'updated_at=SYSUTCDATETIME() WHERE company_id=@companyKey AND public_id=@entityId AND '+spec.request+'=@requestId AND '+pending+"='REQUESTING'",{companyKey:tx.domain.companyKey,entityId:job.entityId,requestId});
  }
 };
}
export async function finishChangedPlan(tx:ConfigTransaction,entityId:string,requestId:string,payload:unknown,success:boolean){
 configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const p=payload as {planVersion?:unknown;previousVersion?:unknown};configAssert(Number.isSafeInteger(p.planVersion)&&Number(p.planVersion)>1&&Number.isSafeInteger(p.previousVersion)&&Number(p.previousVersion)>=1&&Number(p.previousVersion)<Number(p.planVersion),409,'DELIVERY_ENTITY_CHANGED');
 const params={companyKey:tx.domain.companyKey,entityId,requestId,version:p.planVersion,previous:p.previousVersion,success};
 const contract=await tx.domain.query<{contract_id:number}>('SELECT contract_id FROM crm_contract WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@entityId AND deleted_yn=0',params);configAssert(contract.recordset.length===1,409,'DELIVERY_ENTITY_CHANGED');const id=contract.recordset[0].contract_id;
 const result=await tx.domain.query("UPDATE crm_collection_plan SET erp_sync_status=CASE WHEN @success=1 THEN 'SUCCESS' ELSE 'FAILED' END,locked_yn=@success,is_current=@success WHERE contract_id=@id AND plan_version=@version AND last_erp_request_id=@requestId AND erp_sync_status='REQUESTING'",{...params,id});configAssert((result.rowsAffected?.[0]??0)>0,409,'DELIVERY_ENTITY_CHANGED');
 if(!success){const restored=await tx.domain.query('UPDATE crm_collection_plan SET is_current=1 WHERE contract_id=@id AND plan_version=@previous',{...params,id});configAssert((restored.rowsAffected?.[0]??0)>0,409,'DELIVERY_ENTITY_CHANGED');}
}
export function createChangedPlanDeliveryAdapter(transport:IdempotentDomainTransport):DomainDeliveryAdapter{
 configAssert(transport.supportsIdempotency===true,503,'IDEMPOTENT_TRANSPORT_REQUIRED');
 return {interfaceCode:'IF-ERP-011',supportsIdempotency:true,send:(id,payload)=>transport.send('IF-ERP-011',id,payload),
  authorize:async(tx,job,requestId)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const p=job.payload as {planVersion?:unknown};configAssert(Number.isSafeInteger(p.planVersion)&&Number(p.planVersion)>1,409,'DELIVERY_ENTITY_CHANGED');
   const r=await tx.domain.query("SELECT c.contract_id FROM crm_contract c WITH(UPDLOCK,HOLDLOCK) JOIN crm_user u WITH(HOLDLOCK) ON u.user_id=c.owner_user_id AND u.company_id=c.company_id AND u.public_id=@actorId AND u.is_active=1 AND u.deleted_yn=0 WHERE c.company_id=@companyKey AND c.public_id=@entityId AND c.deleted_yn=0 AND c.status='ERP_APPROVED' AND EXISTS(SELECT 1 FROM crm_collection_plan p WITH(HOLDLOCK) WHERE p.contract_id=c.contract_id AND p.plan_version=@version AND p.is_current=1 AND p.last_erp_request_id=@requestId AND p.erp_sync_status='REQUESTING')",{companyKey:tx.domain.companyKey,actorId:job.actorId,entityId:job.entityId,requestId,version:p.planVersion});configAssert(r.recordset.length===1,409,'DELIVERY_ENTITY_CHANGED');
  },
  cancelled:(tx,job,id)=>finishChangedPlan(tx,job.entityId,id,job.payload,false)
 };
}
