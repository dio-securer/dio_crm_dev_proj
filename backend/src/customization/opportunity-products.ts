import {z} from 'zod';
import {resolveActorPolicy,type ActorPolicy} from '@dio-crm/contracts/crm-customization';
import {CompanyConfigurationService,type ConfigActor,type SqlListAdapter} from './config-service';
import {configAssert,type ConfigState,type ConfigTransaction} from './config-store';
import {validateFieldWrite,type FieldBinding} from './field-policy';
import type {AuthenticatedRequest} from '../security/security';
const bind=(id:string,input:string,column:string):FieldBinding=>({fieldId:'opportunity.'+id,input,column,output:column});
export const productBindings=[bind('productPublicId','packagePublicId','package_public_id'),bind('quantity','quantity','quantity'),bind('price','proposedUnitPrice','proposed_unit_price'),bind('productNote','note','note'),bind('productName','itemName','item_name'),bind('lineAmount','lineAmount','line_amount'),bind('productType','itemType','item_type'),bind('erpItemCode','erpItemCode','erp_item_code')];
type Domain=NonNullable<ConfigTransaction['domain']>;
const current=(s:ConfigState,a:ConfigActor):ActorPolicy=>({authenticated:true,companyId:a.companyId,allowed:s.members[a.id].permissions,denied:s.members[a.id].denied});
export function opportunityProducts(publicId:string,userKey:number):SqlListAdapter{return {bindings:productBindings,visibilityId:'section:opportunity.products',load:async domain=>{
 const r=await domain.query<Record<string,unknown>>('SELECT o.company_id,CONVERT(varchar(36),p.public_id) public_id,CONVERT(varchar(36),pp.public_id) package_public_id,pp.item_name,pp.item_type,pp.erp_item_code,p.quantity,p.proposed_unit_price,p.note,p.quantity*p.proposed_unit_price line_amount FROM crm_opportunity_product p WITH(HOLDLOCK) JOIN crm_opportunity o WITH(HOLDLOCK) ON o.opportunity_id=p.opportunity_id JOIN crm_product_package pp WITH(HOLDLOCK) ON pp.product_package_id=p.product_package_id AND pp.company_id=o.company_id WHERE o.company_id=@companyKey AND o.public_id=@publicId AND o.owner_user_id=@userKey AND o.deleted_yn=0 ORDER BY p.opportunity_product_id',{companyKey:domain.companyKey,publicId,userKey});
 return r.recordset.map(row=>({companyKey:Number(row.company_id),publicId:String(row.public_id),row}));
}};}
export async function executeOpportunityProduct(service:CompanyConfigurationService,req:AuthenticatedRequest,actor:ConfigActor,userKey:number){
 const match=/^\/api\/opportunities\/([a-f0-9-]{36})\/products(?:\/([a-f0-9-]{36}))?\/?$/i.exec(req.path);configAssert(match,404,'NOT_FOUND');const publicId=z.string().uuid().parse(match[1]).toLowerCase(),productId=match[2]?z.string().uuid().parse(match[2]).toLowerCase():undefined;
 configAssert(req.method==='POST'&&!productId||['PATCH','DELETE'].includes(req.method)&&productId,404,'NOT_FOUND');configAssert(Object.keys(req.query??{}).length===0,422,'UNSUPPORTED_QUERY');
 const common={quantity:z.number().int().min(1).max(9999).optional(),proposedUnitPrice:z.number().finite().min(0).max(999999999999.99).optional(),note:z.string().max(1000).nullable().optional()};
 const input=req.method==='POST'?z.object({...common,packagePublicId:z.string().uuid().transform(s=>s.toLowerCase()),proposedUnitPrice:common.proposedUnitPrice.unwrap()}).strict().parse(req.body):req.method==='PATCH'?z.object(common).strict().parse(req.body):z.object({}).strict().parse(req.body??{});
 const context={releaseId:z.string().uuid().parse(req.headers['x-config-release-id']),permissionVersion:z.coerce.number().safe().int().positive().parse(req.headers['x-config-permission-version'])},key=req.headers['idempotency-key'];configAssert(typeof key==='string',428,'IDEMPOTENCY_REQUIRED');
 const load=async(domain:Domain)=>{const r=await domain.query<{opportunity_id:number;contract_created_yn:boolean;stage:string;amount:number}>('SELECT opportunity_id,contract_created_yn,stage,amount FROM crm_opportunity WITH(UPDLOCK,HOLDLOCK) WHERE company_id=@companyKey AND public_id=@publicId AND owner_user_id=@userKey AND deleted_yn=0',{companyKey:domain.companyKey,publicId,userKey});configAssert(r.recordset.length===1,404,'NOT_FOUND');return r.recordset[0];};
 return service.executeBusiness(actor,context,req.method==='POST'?'OPP.product.add':req.method==='PATCH'?'OPP.product.edit':'OPP.product.remove',key,{publicId,productId:productId??null,input},async(state,tx)=>{
  configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');const domain=tx.domain,parent=await load(domain),policy=current(state,actor),effective=state.releases[state.activeReleaseId!].effective;configAssert(!parent.contract_created_yn,409,'OPPORTUNITY_LOCKED');
  const params:Record<string,unknown>={companyKey:domain.companyKey,id:parent.opportunity_id,productId,userKey};
  if(req.method==='DELETE'){const r=await domain.query('DELETE FROM crm_opportunity_product WHERE opportunity_id=@id AND public_id=@productId',params);configAssert(r.rowsAffected?.[0]===1,404,'NOT_FOUND');}
  else{
   let stored:Record<string,unknown>={},existing=false;
   if(req.method==='POST'){const packageId=(input as {packagePublicId:string}).packagePublicId;const pp=await domain.query<{product_package_id:number}>('SELECT product_package_id FROM crm_product_package WITH(HOLDLOCK) WHERE company_id=@companyKey AND public_id=@packageId AND is_active=1 AND deleted_yn=0',{companyKey:domain.companyKey,packageId});configAssert(pp.recordset.length===1,404,'NOT_FOUND');params.packageId=pp.recordset[0].product_package_id;
    const r=await domain.query<Record<string,unknown>>('SELECT quantity,proposed_unit_price,note FROM crm_opportunity_product WITH(UPDLOCK,HOLDLOCK) WHERE opportunity_id=@id AND product_package_id=@packageId',params);existing=r.recordset.length>0;stored=r.recordset[0]??{};
   }else{const r=await domain.query<Record<string,unknown>>('SELECT p.quantity,p.proposed_unit_price,p.note,CONVERT(varchar(36),pp.public_id) package_public_id FROM crm_opportunity_product p WITH(UPDLOCK,HOLDLOCK) JOIN crm_product_package pp WITH(HOLDLOCK) ON pp.product_package_id=p.product_package_id AND pp.company_id=@companyKey WHERE p.opportunity_id=@id AND p.public_id=@productId',params);configAssert(r.recordset.length===1,404,'NOT_FOUND');stored=r.recordset[0];existing=true;}
   const bindings=productBindings.slice(req.method==='POST'?0:1,4);
   if(req.method==='POST'){configAssert(policy.allowed.includes('PRODUCT_PACKAGE.READ')&&!policy.denied.includes('PRODUCT_PACKAGE.READ'),403,'PERMISSION_DENIED');if(existing)configAssert(resolveActorPolicy(effective,actor.companyId,policy).some(p=>p.id==='OPP.product.edit'&&p.enabled),403,'ACTION_DENIED');}
   const creation={...effective,entries:effective.entries.map(e=>e.id==='opportunity.quantity'&&!Object.hasOwn(e.settings,'default')?{...e,settings:{...e.settings,default:1}}:e)};
   const columns=validateFieldWrite(creation,actor.companyId,policy,bindings,input,stored,existing?'update':'create',{'opportunity.stage':parent.stage,'opportunity.amount':parent.amount,'opportunity.productPublicId':stored.package_public_id});
   delete columns.package_public_id;const values={...stored,...columns};configAssert(typeof values.quantity==='number'&&values.quantity>=1&&typeof values.proposed_unit_price==='number'&&values.proposed_unit_price>=0,422,'REQUIRED_FIELD');
   configAssert(Number.isSafeInteger(Math.round(values.proposed_unit_price*100))&&Math.abs(values.proposed_unit_price*100-Math.round(values.proposed_unit_price*100))<0.001&&values.quantity*values.proposed_unit_price<=999999999999.99,422,'INVALID_FIELD_VALUE');
   Object.assign(params,{quantity:values.quantity,price:values.proposed_unit_price,note:values.note??null});
   const sql=existing?'UPDATE crm_opportunity_product SET quantity=@quantity,proposed_unit_price=@price,note=@note,updated_at=SYSUTCDATETIME(),updated_by=@userKey WHERE opportunity_id=@id AND '+(req.method==='POST'?'product_package_id=@packageId':'public_id=@productId'):'INSERT INTO crm_opportunity_product(opportunity_id,product_package_id,quantity,proposed_unit_price,note,created_by,updated_by) VALUES(@id,@packageId,@quantity,@price,@note,@userKey,@userKey)';
   const changed=await domain.query(sql,params);configAssert(changed.rowsAffected?.[0]===1,409,'OPPORTUNITY_CHANGED');
  }
  await domain.query('UPDATE o SET amount=ISNULL(x.amount,0),updated_at=SYSUTCDATETIME(),updated_by=@userKey FROM crm_opportunity o OUTER APPLY(SELECT SUM(quantity*proposed_unit_price) amount FROM crm_opportunity_product WHERE opportunity_id=o.opportunity_id) x WHERE o.company_id=@companyKey AND o.opportunity_id=@id',params);
  return {releaseId:state.activeReleaseId!,permissionVersion:state.permissionVersion,data:{public_id:publicId,updated:true}};
 },async(_state,tx)=>{configAssert(tx.domain,503,'SQL_DOMAIN_REQUIRED');await load(tx.domain);});
}
