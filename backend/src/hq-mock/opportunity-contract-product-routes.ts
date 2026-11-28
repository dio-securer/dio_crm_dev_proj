import {hqFind,hqOnlyKeys,hqRequire,hqText,type HqApplication,type HqRouteContext} from './app.js';
import {auditHq,canonicalHq,cloneHq,hqAssert,newHqId,type HqDataset,type HqRow} from './model.js';
import {opportunityCurrency} from './opportunity-contract.js';
type Item=Record<string,unknown>&{public_id:string;version:number;deleted:boolean};
const items=(parent:HqRow):Item[]=>Array.isArray(parent.mock_contract_products)?parent.mock_contract_products as Item[]:[];
function parentFor(c:HqRouteContext,d:HqDataset,write=false){
 hqRequire(c.actor,'OPPORTUNITY.READ');hqRequire(c.actor,'ACCOUNT.READ');c.app.requireScreen(c.actor,'HQ_OPPORTUNITY');c.app.requireScreen(c.actor,'HQ_ACCOUNT');
 const parent=hqFind(d,c.actor,'opportunities',c.params.publicId);const account=hqFind(d,c.actor,'accounts',String(parent.account_public_id));
 hqAssert(parent.deleted_yn!==true&&parent.deleted!==true&&account.deleted_yn!==true&&account.deleted!==true,404,'NOT_FOUND');
 if(write){hqRequire(c.actor,'OPPORTUNITY.WRITE');c.app.requireAction(c.actor,'OPP.saveNegotiation',parent,{});hqAssert(parent.owner_user_id===c.actor.userId||['SYSTEM','ALL'].includes(c.actor.scope),403,'OWNER_WRITE_DENIED');}
 // Do not expose child prices when the parent amount is restricted by field policy.
 for(const f of c.app.standardFor(c.actor).fields.filter(f=>f.entity==='opportunity'&&f.current.dbField==='amount')){const read=c.app.policyFor(c.actor).readField(f.fieldKey,c.app.context(c.actor,{...c.app.values(parent),[f.fieldKey]:parent.amount}));hqAssert(read===parent.amount,403,'CONTRACT_PRODUCT_AMOUNT_DENIED');}
 return parent;
}
function validate(c:HqRouteContext,d:HqDataset,body:Record<string,unknown>,previous?:Item){
 const row={productPublicId:'',description:'',quantity:1,unitPrice:0,...previous,...body};
 hqAssert(typeof row.productPublicId==='string',400,'PRODUCT_INVALID');hqAssert(typeof row.description==='string'&&row.description.length<=4000,400,'DESCRIPTION_INVALID');
 hqAssert(typeof row.quantity==='number'&&Number.isFinite(row.quantity)&&row.quantity>0&&row.quantity<=1e9,400,'QUANTITY_INVALID');
 hqAssert(typeof row.unitPrice==='number'&&Number.isFinite(row.unitPrice)&&row.unitPrice>=0&&row.unitPrice<=1e12,400,'UNIT_PRICE_INVALID');
 const totalAmount=Number(row.quantity)*Number(row.unitPrice);hqAssert(Number.isFinite(totalAmount)&&totalAmount<=Number.MAX_SAFE_INTEGER,400,'TOTAL_AMOUNT_INVALID');
 const product=row.productPublicId?hqFind(d,c.actor,'products',row.productPublicId):undefined;
 return {productPublicId:row.productPublicId,productName:product?.item_name??'',description:row.description,quantity:row.quantity,unitPrice:row.unitPrice,totalAmount,taxStatus:null};
}
export function installOpportunityContractProductRoutes(app:HqApplication){
 const path='/api/opportunities/:publicId/contract-products';
 app.route('GET',path,c=>{const parent=parentFor(c,c.repository.read());return{items:items(parent).filter(x=>!x.deleted).map(x=>({...x,mode:'MOCK'})),mode:'MOCK'};});
 for(const method of ['POST','PATCH','DELETE'])app.route(method,method==='POST'?path:`${path}/:itemId`,c=>{
  hqOnlyKeys(c.body,method==='DELETE'?['expectedVersion','idempotencyKey']:['productPublicId','description','quantity','unitPrice','expectedVersion','idempotencyKey']);
  const {expectedVersion,idempotencyKey,...body}=c.body;const key=hqText(idempotencyKey,'idempotencyKey',200),fingerprint=canonicalHq({method,params:c.params,body,expectedVersion:expectedVersion??null});
  return c.repository.transact(d=>{
   const parent=parentFor(c,d,true),receipt=d.collections.auditLogs.find(x=>x.action==='OPPORTUNITY_CONTRACT_PRODUCT_RECEIPT'&&x.company_id===c.actor.companyId&&x.owner_user_id===c.actor.userId&&(x.detail as Record<string,unknown>)?.key===key);
   if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response);}
   let item:Item;
   if(method==='POST'){hqAssert(body.quantity!==undefined&&body.unitPrice!==undefined,400,'REQUIRED_FIELDS');const value=validate(c,d,body),id=newHqId(d);item={...value,public_id:id,name:`MOCK-CP-${id.slice(-6)}`,version:1,deleted:false,opportunityPublicId:parent.public_id,currency:opportunityCurrency(parent),createdAt:d.clock,updatedAt:d.clock};parent.mock_contract_products=[...items(parent),item];}
   else{const existing=items(parent).find(x=>x.public_id===c.params.itemId&&!x.deleted);hqAssert(existing,404,'CONTRACT_PRODUCT_NOT_FOUND');item=existing;hqAssert(Number.isSafeInteger(expectedVersion)&&Number(expectedVersion)>0,400,'EXPECTED_VERSION_REQUIRED');hqAssert(expectedVersion===item.version,409,'VERSION_CONFLICT','Contract Product가 변경되었습니다. 입력을 보존하고 최신 내용을 확인하세요.');if(method==='DELETE')item.deleted=true;else Object.assign(item,validate(c,d,body,item));item.version++;item.updatedAt=d.clock;}
   // Contract Product is independent of opportunity product amount and parent version.
   auditHq(d,c.actor,`OPP.contractProduct.${method}`,parent.public_id,{itemId:item.public_id,version:item.version});const response={...item,mode:'MOCK'};auditHq(d,c.actor,'OPPORTUNITY_CONTRACT_PRODUCT_RECEIPT',parent.public_id,{key,fingerprint,response:cloneHq(response)});return response;
  },true);
 });
}
