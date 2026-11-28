import {listPaging,pageParameters,businessQueryKeys} from './list-pagination';
import {Injectable} from '@nestjs/common';import {z} from 'zod';
import {CompanyConfigurationService,type ConfigActor} from './config-service';
import {configAssert} from './config-store';import {validateCreation} from './creation-policy';
import {projectFields,type FieldBinding} from './field-policy';import type {AuthenticatedRequest} from '../security/security';
const catalogBindings:FieldBinding[]=[['itemType','item_type'],['itemName','item_name'],['erpItemCode','erp_item_code'],['category','category'],['basePrice','base_price'],['sourceSystem','source_system']].map(([input,column])=>({fieldId:'productCatalog.'+input,input,column,output:column}));
const bind=(id:string,column:string):FieldBinding=>({fieldId:'pipeline.'+id,input:id,column,output:column});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
@Injectable()
export class ConfiguredSalesReportGateway{
 constructor(private readonly service:CompanyConfigurationService){}
 async handle(req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
  const route=req.path.replace(/\/$/,'');
  if(route==='/api/opportunities/pipeline/funnel'&&req.method==='GET'){
   const q=z.object({ownerUserId:z.coerce.number().int().positive().optional(),from:date.optional(),to:date.optional()}).strict().parse(req.query??{});configAssert(!q.ownerUserId||q.ownerUserId===userKey,404,'NOT_FOUND');configAssert(!q.from||!q.to||q.from<=q.to,422,'INVALID_REQUEST');
   const where=' FROM crm_opportunity WITH(HOLDLOCK) WHERE company_id=@companyKey AND owner_user_id=@userKey AND deleted_yn=0 AND (@from IS NULL OR expected_close_date>=@from) AND (@to IS NULL OR expected_close_date<=@to) ';
   const params={userKey,from:q.from??null,to:q.to??null};
   return this.service.readSqlReport(actor,'HQ_PIPELINE',{
    byStage:{visibilityId:'section:pipeline.summary',bindings:[bind('stage','stage'),bind('count','opportunity_count'),bind('amount','amount'),bind('weightedAmount','weighted_amount')],sourceFields:['opportunity.stage','opportunity.amount','opportunity.successProbability'],load:async domain=>(await domain.query<Record<string,unknown>>('SELECT stage,COUNT_BIG(*) opportunity_count,SUM(ISNULL(amount,0)) amount,SUM(ISNULL(amount,0)*ISNULL(success_probability,0)/100.0) weighted_amount'+where+' GROUP BY stage',{companyKey:domain.companyKey,...params})).recordset},
    forecast:{visibilityId:'section:pipeline.summary',bindings:[bind('forecastCategory','forecast_category'),bind('count','opportunity_count'),bind('amount','amount')],sourceFields:['opportunity.stage','opportunity.forecastCategory','opportunity.amount'],load:async domain=>(await domain.query<Record<string,unknown>>("SELECT ISNULL(forecast_category,'PIPELINE') forecast_category,COUNT_BIG(*) opportunity_count,SUM(ISNULL(amount,0)) amount"+where+" AND stage<>'CLOSED_LOST' GROUP BY ISNULL(forecast_category,'PIPELINE')",{companyKey:domain.companyKey,...params})).recordset}
   },[...(q.ownerUserId?['opportunity.ownerUserId']:[]),...(q.from||q.to?['opportunity.expectedCloseDate']:[])],businessQueryKeys(q).map(k=>'pipeline.'+(k==='ownerUserId'?'ownerFilter':k)),['PIPELINE.refresh']);
  }
  configAssert(route==='/api/product-packages',404,'NOT_FOUND');
  if(req.method==='GET'){
   const q=z.object({...listPaging,search:z.string().trim().max(200).optional(),itemType:z.enum(['PACKAGE','PRODUCT']).optional()}).strict().parse(req.query??{});
   return this.service.readSqlList(actor,'HQ_PRODUCT_PACKAGE',{bindings:catalogBindings,load:async domain=>{
    const r=await domain.query<Record<string,unknown>>("SELECT company_id,CONVERT(varchar(36),public_id) public_id,item_type,item_name,erp_item_code,category,base_price,source_system FROM crm_product_package WITH(HOLDLOCK) WHERE company_id=@companyKey AND is_active=1 AND deleted_yn=0 AND (@type IS NULL OR item_type=@type) AND (@search IS NULL OR item_name LIKE '%'+@search+'%' ESCAPE '~' OR erp_item_code LIKE '%'+@search+'%' ESCAPE '~') ORDER BY product_package_id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY",{...pageParameters(q),companyKey:domain.companyKey,type:q.itemType??null,search:q.search?.replace(/[~%_\[]/g,c=>'~'+c)??null});
    return r.recordset.map(row=>({companyKey:Number(row.company_id),publicId:String(row.public_id),row}));
   }},[...(q.search?['productCatalog.itemName','productCatalog.erpItemCode']:[]),...(q.itemType?['productCatalog.itemType']:[])],businessQueryKeys(q).map(k=>'productCatalog.'+(k==='itemType'?'typeFilter':k)));
  }
  configAssert(req.method==='POST',404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
  const input=z.object({itemType:z.enum(['PACKAGE','PRODUCT']),itemName:z.string().trim().min(1).max(200),erpItemCode:z.string().max(80).optional(),category:z.string().max(100).optional(),basePrice:z.number().finite().nonnegative().max(999999999999.99).optional()}).strict().parse(req.body),key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
  const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().int().positive().safe().parse(req.headers['x-config-permission-version'])};
  return this.service.executeBusiness(actor,context,'PRODUCT_CATALOG.create',key,input,async(state,tx)=>{
   configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const member=state.members[actor.id],policy={authenticated:true,companyId:actor.companyId,allowed:member.permissions,denied:member.denied},effective=state.releases[state.activeReleaseId!].effective;
   const creation={...effective,entries:effective.entries.map(e=>e.id==='productCatalog.basePrice'&&!Object.hasOwn(e.settings,'default')?{...e,settings:{...e.settings,default:0}}:e)};
   const columns=validateCreation(creation,actor.companyId,policy,catalogBindings.slice(0,5),input,{'productCatalog.sourceSystem':'CRM'},effective.entries.filter(e=>e.bindingKind==='DATA'&&e.id.startsWith('productCatalog.')).map(e=>e.id));
   configAssert(typeof columns.base_price==='number'&&Math.abs(columns.base_price*100-Math.round(columns.base_price*100))<0.001,422,'INVALID_FIELD_VALUE');
   const pairs=Object.entries(columns),params:Record<string,unknown>={companyKey:tx.domain.companyKey,userKey};pairs.forEach(([,v],i)=>params['v'+i]=v);
   const saved=await tx.domain.query<{public_id:string}>("INSERT INTO crm_product_package(company_id,source_system,created_by,updated_by,"+pairs.map(([c])=>c).join(',')+") OUTPUT CONVERT(varchar(36),inserted.public_id) public_id VALUES(@companyKey,'CRM',@userKey,@userKey,"+pairs.map((_,i)=>'@v'+i).join(',')+')',params);configAssert(saved.recordset.length===1,500,'DOMAIN_WRITE_FAILED');
   return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:saved.recordset[0].public_id,...projectFields(effective,actor.companyId,policy,catalogBindings,{...columns,source_system:'CRM'})}};
  });
 }
}
