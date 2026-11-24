import {listPaging,pageParameters,businessQueryKeys} from './list-pagination';
import {Injectable} from '@nestjs/common';
import {z} from 'zod';
import type {ActorPolicy} from '@dio-crm/contracts/crm-customization';
import {CompanyConfigurationService,type ConfigActor,type SqlFieldAdapter} from './config-service';
import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {projectFields,validateFieldWrite,type FieldBinding} from './field-policy';
import {canTransitionOpportunity,type OpportunityStage} from '../modules/opportunity/opportunity.rules';
import type {AuthenticatedRequest} from '../security/security';
import {validateCreation} from './creation-policy';
import {executeOpportunityProduct,opportunityProducts} from './opportunity-products';
const bind=(id:string,input:string,column:string):FieldBinding=>({fieldId:'opportunity.'+id,input,column,output:column});
export const opportunityBindings:FieldBinding[]=[
 ['name','opportunityName','opportunity_name'],['expectedCloseDate','expectedCloseDate','expected_close_date'],['successProbability','successProbability','success_probability'],['forecastCategory','forecastCategory','forecast_category'],['interestProduct','interestProduct','interest_product'],['specialTerms','specialTerms','special_terms'],['paymentMethod','paymentMethod','payment_method'],['paymentDate','paymentDate','payment_date'],['installmentMonths','installmentMonths','installment_months'],['competitorUsage','competitorUsage','competitor_usage'],['ownedEquipment','ownedEquipment','owned_equipment'],['treatmentFeeInfo','treatmentFeeInfo','treatment_fee_info'],
 ['accountPublicId','accountPublicId','account_public_id'],['stage','stage','stage'],['recordType','recordType','record_type'],['ownerUserId','ownerUserId','owner_user_id'],['ownerName','ownerName','owner_name'],['amount','amount','amount'],['updatedAt','updatedAt','updated_at'],['contractCreatedYn','contractCreatedYn','contract_created_yn']
].map(([id,input,column])=>bind(id,input,column));
const editKeys=opportunityBindings.slice(0,12).map(b=>b.input);
const select=opportunityBindings.map(b=>b.column==='account_public_id'?'CONVERT(varchar(36),a.public_id) account_public_id':b.column==='owner_name'?'u.user_name owner_name':b.column==='updated_at'?"CONVERT(varchar(27),o.updated_at,126)+'Z' updated_at":['expected_close_date','payment_date'].includes(b.column)?'CONVERT(varchar(10),o.'+b.column+',23) '+b.column:'o.'+b.column).join(',');
const from=' FROM crm_opportunity o WITH(UPDLOCK,HOLDLOCK) JOIN crm_account a WITH(HOLDLOCK) ON a.account_id=o.account_id AND a.company_id=o.company_id AND a.deleted_yn=0 LEFT JOIN crm_user u WITH(HOLDLOCK) ON u.user_id=o.owner_user_id AND u.company_id=o.company_id AND u.deleted_yn=0 ';
const stages=['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST'] as const;
type Domain=NonNullable<ConfigTransaction['domain']>;
const policyFor=(s:ConfigState,a:ConfigActor):ActorPolicy=>({authenticated:true,companyId:a.companyId,allowed:s.members[a.id].permissions,denied:s.members[a.id].denied});
@Injectable()
export class ConfiguredOpportunityGateway {
 constructor(private readonly service:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const route=req.path.replace(/\/$/,'');
  if(route.includes('/products'))return executeOpportunityProduct(this.service,req,actor,userKey);
  if(route==='/api/opportunities'&&req.method==='POST')return this.create(req,actor,userKey);
  if(route==='/api/opportunities'&&req.method==='GET'){
   const q=z.object({...listPaging,stage:z.enum(stages).optional(),accountPublicId:z.string().uuid().optional(),search:z.string().trim().max(200).optional()}).strict().parse(req.query??{});
   return this.service.readSqlList(actor,'HQ_OPPORTUNITY',{bindings:opportunityBindings,load:async domain=>{
    const rows=await domain.query<Record<string,unknown>>('SELECT o.company_id,CONVERT(varchar(36),o.public_id) public_id,'+select+from+"WHERE o.company_id=@companyKey AND o.deleted_yn=0 AND o.owner_user_id=@userKey AND (@stage IS NULL OR o.stage=@stage) AND (@accountId IS NULL OR a.public_id=@accountId) AND (@search IS NULL OR o.opportunity_name LIKE '%'+@search+'%' ESCAPE '~') ORDER BY o.opportunity_id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY",{...pageParameters(q),companyKey:domain.companyKey,userKey,stage:q.stage??null,accountId:q.accountPublicId??null,search:q.search?.replace(/[~%_\[]/g,c=>'~'+c)??null});
    return rows.recordset.map(row=>({companyKey:Number(row.company_id),publicId:String(row.public_id),row}));
   }},[...(q.stage?['opportunity.stage']:[]),...(q.accountPublicId?['opportunity.accountPublicId']:[]),...(q.search?['opportunity.name']:[])],businessQueryKeys(q).map(k=>k==='stage'?'opportunity.stageFilter':k==='accountPublicId'?'opportunity.accountFilter':'opportunity.search'));
  }
  const match=/^\/api\/opportunities\/([a-f0-9-]{36})(\/stage)?$/i.exec(route);configAssert(match,404,'NOT_FOUND');const publicId=z.string().uuid().parse(match[1]).toLowerCase();configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const load=async(domain:Domain,includeDeleted=false)=>{
   const rows=await domain.query<Record<string,any>>('SELECT o.company_id,o.opportunity_id,o.account_id,a.erp_approved_yn,'+select+from+'WHERE o.company_id=@companyKey AND o.public_id=@publicId'+(includeDeleted?'':' AND o.deleted_yn=0')+' AND o.owner_user_id=@userKey',{companyKey:domain.companyKey,publicId,userKey});
   configAssert(rows.recordset.length===1,404,'NOT_FOUND');return {companyKey:Number(rows.recordset[0].company_id),row:rows.recordset[0]};
  };
  const adapter:SqlFieldAdapter={bindings:opportunityBindings,load:domain=>load(domain)};
  if(req.method==='GET'&&!match[2]){adapter.children={products:opportunityProducts(publicId,userKey)};const result=await this.service.readSqlFields(actor,'HQ_OPPORTUNITY',adapter);return {...result,data:{public_id:publicId,...result.data}};}
  const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().safe().int().positive().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
  if(req.method==='PATCH'&&!match[2]){
   const input=z.record(z.union([z.string().max(4000),z.number().finite(),z.null()])).parse(req.body);configAssert(Object.keys(input).every(k=>editKeys.includes(k)),422,'UNREGISTERED_FIELD');
   adapter.load=async domain=>{const loaded=await load(domain);configAssert(!loaded.row.contract_created_yn,409,'OPPORTUNITY_LOCKED');return loaded;};
   adapter.save=async(domain,columns)=>{const pairs=Object.entries(columns);if(!pairs.length)return;const params:Record<string,unknown>={companyKey:domain.companyKey,publicId,userKey};pairs.forEach(([,v],i)=>params['v'+i]=v);const r=await domain.query('UPDATE crm_opportunity SET '+pairs.map(([c],i)=>c+'=@v'+i).join(',')+',updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@publicId AND owner_user_id=@userKey AND deleted_yn=0 AND contract_created_yn=0',params);configAssert(r.rowsAffected?.[0]===1,409,'OPPORTUNITY_CHANGED');};
   const result=await this.service.writeSqlFields(actor,context,'OPP.saveNegotiation',publicId,key,input,adapter);return {...result,data:{public_id:publicId,...result.data}};
  }
  const isStage=req.method==='POST'&&!!match[2];configAssert(isStage||req.method==='DELETE'&&!match[2],404,'NOT_FOUND');
  const input=isStage?z.object({toStage:z.enum(stages),reason:z.string().trim().max(1000).optional()}).strict().parse(req.body):z.object({}).strict().parse(req.body??{});
  return this.service.executeBusiness(actor,context,isStage?'OPP.stage':'OPP.archive',key,{publicId,input},async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,{row}=await load(domain),policy=policyFor(state,actor),effective=state.releases[state.activeReleaseId!].effective;configAssert(!row.contract_created_yn,409,'OPPORTUNITY_LOCKED');
   let next=row.stage,reason:string|null=null,transitionType='ARCHIVE';
   if(isStage){const command=input as {toStage:OpportunityStage;reason?:string};validateFieldWrite(effective,actor.companyId,policy,[bind('targetStage','toStage','stage'),bind('reason','reason','closed_reason')],command,{},'update',Object.fromEntries(opportunityBindings.map(b=>[b.fieldId,row[b.column]])));const decision=canTransitionOpportunity(row.stage,command.toStage,{canReopen:policy.allowed.includes('OPPORTUNITY.STAGE.REOPEN')&&!policy.denied.includes('OPPORTUNITY.STAGE.REOPEN'),contractCreated:!!row.contract_created_yn,reason:command.reason});configAssert(decision.allowed,422,'OPPORTUNITY_TRANSITION_DENIED');if(command.toStage==='CLOSED_WON')configAssert(row.erp_approved_yn,422,'ERP_APPROVAL_REQUIRED');next=command.toStage;reason=command.reason??null;transitionType=decision.reverse?'REVERSE':'NORMAL';}
   const params={companyKey:domain.companyKey,publicId,userKey,next,reason,id:row.opportunity_id,fromStage:row.stage,transitionType};
   const r=await domain.query(isStage?"UPDATE crm_opportunity SET stage=@next,closed_reason=CASE WHEN @next='CLOSED_LOST' THEN @reason ELSE NULL END,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@publicId AND owner_user_id=@userKey AND deleted_yn=0 AND contract_created_yn=0":'UPDATE crm_opportunity SET deleted_yn=1,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE company_id=@companyKey AND public_id=@publicId AND owner_user_id=@userKey AND deleted_yn=0 AND contract_created_yn=0',params);configAssert(r.rowsAffected?.[0]===1,409,'OPPORTUNITY_CHANGED');
   await domain.query('INSERT INTO crm_opportunity_stage_history(opportunity_id,from_stage,to_stage,reason,transition_type,changed_by) VALUES(@id,@fromStage,@next,@reason,@transitionType,@userKey)',params);
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...(isStage?projectFields(effective,actor.companyId,policy,[bind('stage','stage','stage')],{stage:next}):{archived:true})}};
  },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain,!isStage);});
 }
 private async create(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const input=z.object({accountPublicId:z.string().uuid().transform(s=>s.toLowerCase()),opportunityName:z.string().trim().min(1).max(200),recordType:z.enum(['NEW','EXISTING','RECONTRACT']).optional(),expectedCloseDate:z.string().optional(),interestProduct:z.string().max(500).optional()}).strict().parse(req.body);
  const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().safe().int().positive().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
  const parent=async(domain:Domain,policy:ActorPolicy)=>{configAssert(policy.allowed.includes('ACCOUNT.READ')&&!policy.denied.includes('ACCOUNT.READ'),403,'PERMISSION_DENIED');const rows=await domain.query<{account_id:number}>("SELECT account_id FROM crm_account WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@parentId AND owner_user_id=@userKey AND deleted_yn=0 AND account_status<>'MERGED'",{companyKey:domain.companyKey,parentId:input.accountPublicId,userKey});configAssert(rows.recordset.length===1,404,'NOT_FOUND');return rows.recordset[0].account_id;};
  return this.service.executeBusiness(actor,context,'OPP.create',key,input,async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,policy=policyFor(state,actor),accountId=await parent(domain,policy),effective=state.releases[state.activeReleaseId!].effective;
   const bindings=opportunityBindings.filter(b=>!['stage','ownerUserId','ownerName','amount','updatedAt','contractCreatedYn'].includes(b.input));
   const creation={...effective,entries:effective.entries.map(e=>e.id==='opportunity.recordType'&&!Object.hasOwn(e.settings,'default')?{...e,settings:{...e.settings,default:'EXISTING'}}:e)};
   const scope=effective.entries.filter(e=>e.kind==='FIELD'&&e.bindingKind==='DATA'&&e.id.startsWith('opportunity.')&&e.parentId!=='section:opportunity.products'&&!['opportunity.targetStage','opportunity.reason','opportunity.updatedAt'].includes(e.id)).map(e=>e.id);
   const columns=validateCreation(creation,actor.companyId,policy,bindings,input,{'opportunity.ownerUserId':userKey,'opportunity.stage':'NEEDS_ANALYSIS','opportunity.contractCreatedYn':false,'opportunity.amount':0},scope);delete columns.account_public_id;
   configAssert(columns.record_type,422,'REQUIRED_FIELD');
   const pairs=Object.entries(columns),params:Record<string,unknown>={companyKey:domain.companyKey,userKey,accountId};pairs.forEach(([,v],i)=>params['v'+i]=v);
   const saved=await domain.query<{public_id:string}>("INSERT INTO crm_opportunity(company_id,account_id,owner_user_id,stage,amount,contract_created_yn,created_by,updated_by,"+pairs.map(([c])=>c).join(',')+") OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,@accountId,@userKey,'NEEDS_ANALYSIS',0,0,@userKey,@userKey,"+pairs.map((_,i)=>'@v'+i).join(',')+')',params);
   configAssert(saved.recordset.length===1,500,'DOMAIN_WRITE_FAILED');const publicId=saved.recordset[0].public_id;
   const loaded=await domain.query<Record<string,unknown>>('SELECT '+select+from+'WHERE o.company_id=@companyKey AND o.public_id=@publicId AND o.owner_user_id=@userKey AND o.deleted_yn=0',{companyKey:domain.companyKey,publicId,userKey});configAssert(loaded.recordset.length===1,500,'DOMAIN_WRITE_FAILED');
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,...projectFields(effective,actor.companyId,policy,opportunityBindings,loaded.recordset[0])}};
  },async(state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await parent(tx.domain,policyFor(state,actor));});
 }
}
