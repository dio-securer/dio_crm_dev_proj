import {opportunityProductInfo,opportunityProductInfoKeys} from './opportunity-product-info.js';
import {syncQuotes,quotePricesReadable,mutableOpportunityProducts,validateQuoteLines,recalcQuote,syncQuoteProductsToOpportunity,type SyncQuote} from './opportunity-quote-sync.js';
import {hqFind,hqOnlyKeys,hqRequire,hqText,type HqApplication,type HqRouteContext} from './app.js';
import {auditHq,canonicalHq,cloneHq,hqAssert,newHqId,type HqDataset,type HqRow} from './model.js';
import {opportunityCurrency} from './opportunity-contract.js';

type Quote=SyncQuote;
const quoteRows=(parent:HqRow):Quote[]=>Array.isArray(parent.mock_quotes)?parent.mock_quotes as Quote[]:[];
const textFields={name:200,description:4000,validity:500,promotion:2000,deliveryTerms:1000,paymentTerms:1000,notes:4000};
const inputs=[...Object.keys(textFields),'issueDate','expiryDate','tax','shipping','productAmount','goodsAmount'];
function date(value:unknown){hqAssert(typeof value==='string'&&(!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value)),400,'QUOTE_DATE_INVALID');return value;}
function values(body:Record<string,unknown>,existing?:Quote){
 const out:Record<string,unknown>={};
 for(const [key,max] of Object.entries(textFields)){if(body[key]===undefined)continue;hqAssert(typeof body[key]==='string'&&String(body[key]).length<=max,400,'QUOTE_TEXT_INVALID',key);out[key]=String(body[key]).trim();}
 if(!existing||body.name!==undefined)out.name=hqText(body.name,'name',200);
 for(const key of ['issueDate','expiryDate'])if(body[key]!==undefined)out[key]=date(body[key]);
 const issue=out.issueDate??existing?.issueDate,expiry=out.expiryDate??existing?.expiryDate;
 hqAssert(!issue||!expiry||String(expiry)>=String(issue),400,'QUOTE_DATE_ORDER');
 for(const key of ['tax','shipping','productAmount','goodsAmount'])if(body[key]!==undefined){hqAssert(typeof body[key]==='number'&&Number.isFinite(body[key])&&Number(body[key])>=0&&Number(body[key])<=1e12,400,'QUOTE_AMOUNT_INVALID');out[key]=body[key];}
 return out;
}
function parentFor(c:HqRouteContext,d:HqDataset,write=false){
 hqRequire(c.actor,'OPPORTUNITY.READ');hqRequire(c.actor,'ACCOUNT.READ');c.app.requireScreen(c.actor,'HQ_OPPORTUNITY');c.app.requireScreen(c.actor,'HQ_ACCOUNT');
 const parent=hqFind(d,c.actor,'opportunities',c.params.publicId);const account=hqFind(d,c.actor,'accounts',String(parent.account_public_id));hqAssert(parent.deleted_yn!==true&&parent.deleted!==true&&account.deleted_yn!==true&&account.deleted!==true,404,'NOT_FOUND');
 if(write){hqRequire(c.actor,'OPPORTUNITY.WRITE');c.app.requireAction(c.actor,'OPP.saveNegotiation',parent,{});hqAssert(parent.owner_user_id===c.actor.userId||['SYSTEM','ALL'].includes(c.actor.scope),403,'OWNER_WRITE_DENIED');}
 // A quote must not expose a price snapshot to a caller whose opportunity total is redacted.
 quotePricesReadable(c,parent);
 return parent;
}
const publicQuote=(quote:Quote)=>({...quote,mode:'MOCK'});
export function installOpportunityQuoteRoutes(app:HqApplication){
 const path='/api/opportunities/:publicId/quotes';
 app.route('GET',path,c=>{const parent=parentFor(c,c.repository.read());return {items:quoteRows(parent).filter(q=>!q.deleted).map(publicQuote),mode:'MOCK'};});
 const mutation=(c:HqRouteContext,action:string,work:(d:HqDataset,parent:HqRow,quote:Quote)=>void)=>{
  const key=hqText(c.body.idempotencyKey,'idempotencyKey',200),fingerprint=canonicalHq({action,params:c.params,body:c.body});
  return c.repository.transact(d=>{
   const parent=parentFor(c,d,true);hqRequire(c.actor,'OPPORTUNITY.PRODUCT.WRITE');
   const actionKey=action==='PRODUCT_ADD'?'OPP.product.add':action==='PRODUCT_DELETE'?'OPP.product.remove':'OPP.product.edit';
   c.app.requireActionAccess(c.actor,actionKey);
   if(action!=='SYNC_STOP')c.app.requireAction(c.actor,actionKey,parent,{...c.body,...(c.body.packagePublicId?{productPublicId:c.body.packagePublicId}:{})});
   const receipt=d.collections.auditLogs.find(x=>x.action==='OPPORTUNITY_QUOTE_SYNC_RECEIPT'&&x.company_id===c.actor.companyId&&x.owner_user_id===c.actor.userId&&(x.detail as Record<string,unknown>)?.key===key);
   if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response);}
   const quote=quoteRows(parent).find(q=>q.public_id===c.params.quoteId&&!q.deleted);hqAssert(quote,404,'QUOTE_NOT_FOUND');hqAssert(quote.status==='DRAFT',409,'QUOTE_NOT_EDITABLE');
   hqAssert(Number.isSafeInteger(c.body.expectedVersion)&&Number(c.body.expectedVersion)>0,400,'QUOTE_VERSION_REQUIRED');hqAssert(quote.version===c.body.expectedVersion,409,'VERSION_CONFLICT','견적이 변경되었습니다. 입력을 유지하고 최신 견적을 확인하세요.');
   if(quote.syncing||action==='SYNC_START'||action==='SYNC_STOP'){hqAssert(Number.isSafeInteger(c.body.expectedOpportunityVersion)&&Number(c.body.expectedOpportunityVersion)>0,400,'QUOTE_PARENT_VERSION_REQUIRED');hqAssert(parent.version===c.body.expectedOpportunityVersion,409,'VERSION_CONFLICT','기회 제품이 변경되었습니다. 최신 기회를 확인하세요.');}
   work(d,parent,quote);quote.version++;quote.updated_at=d.clock;
   auditHq(d,c.actor,`OPP.quote.${action}`,parent.public_id,{quoteId:quote.public_id,quoteVersion:quote.version});const response={...publicQuote(quote),opportunityVersion:parent.version};
   auditHq(d,c.actor,'OPPORTUNITY_QUOTE_SYNC_RECEIPT',parent.public_id,{key,fingerprint,response:cloneHq(response)});return response;
  },true);
 };
 for(const operation of ['start','stop'])app.route('POST',`${path}/:quoteId/sync/${operation}`,c=>{
  hqOnlyKeys(c.body,['expectedVersion','expectedOpportunityVersion','idempotencyKey']);
  return mutation(c,operation==='start'?'SYNC_START':'SYNC_STOP',(d,parent,quote)=>{
   if(operation==='start'){
    mutableOpportunityProducts(parent);hqAssert(!quote.syncing,409,'QUOTE_ALREADY_SYNCING');hqAssert(!syncQuotes(parent).some(q=>!q.deleted&&q.syncing&&q.public_id!==quote.public_id),409,'QUOTE_SYNC_EXISTS','다른 견적이 동기화 중입니다. 먼저 해당 견적의 동기화를 중지하세요.');
    c.app.requireAction(c.actor,'OPP.product.edit',parent,{});validateQuoteLines(c,d,parent,quote.lines);recalcQuote(quote);quote.syncing=true;syncQuoteProductsToOpportunity(c,d,parent,quote);parent.synced_quote_public_id=quote.public_id;
   }else{hqAssert(quote.syncing,409,'QUOTE_NOT_SYNCING');quote.syncing=false;parent.synced_quote_public_id=null;parent.version++;}
  });
 });
 const lineKeys=['expectedVersion','expectedOpportunityVersion','idempotencyKey'];
 app.route('POST',`${path}/:quoteId/products/reorder`,c=>{hqOnlyKeys(c.body,[...lineKeys,'productPublicIds']);return mutation(c,'PRODUCT_REORDER',(d,parent,quote)=>{
  const ids=c.body.productPublicIds;hqAssert(Array.isArray(ids)&&ids.length===quote.lines.length&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&quote.lines.some(line=>line.public_id===id)),400,'PRODUCT_ORDER_INVALID');quote.lines=ids.map(id=>quote.lines.find(line=>line.public_id===id)!);c.app.requireAction(c.actor,'OPP.product.edit',parent,{});if(quote.syncing)syncQuoteProductsToOpportunity(c,d,parent,quote);
 });});
 for(const method of ['POST','PATCH','DELETE'])app.route(method,method==='POST'?`${path}/:quoteId/products`:`${path}/:quoteId/products/:lineId`,c=>{
  hqOnlyKeys(c.body,method==='POST'?[...lineKeys,'packagePublicId','quantity','proposedUnitPrice','note',...opportunityProductInfoKeys]:method==='PATCH'?[...lineKeys,'quantity','proposedUnitPrice','note',...opportunityProductInfoKeys]:lineKeys);
  return mutation(c,method==='POST'?'PRODUCT_ADD':method==='PATCH'?'PRODUCT_UPDATE':'PRODUCT_DELETE',(d,parent,quote)=>{
   if(quote.syncing)mutableOpportunityProducts(parent);
   const actionKey=method==='POST'?'OPP.product.add':method==='DELETE'?'OPP.product.remove':'OPP.product.edit';
   if(method==='POST'){
    const product=hqFind(d,c.actor,'products',hqText(c.body.packagePublicId,'packagePublicId'));
    const line={public_id:newHqId(d),product_public_id:product.public_id,package_public_id:product.public_id,item_name:product.item_name,quantity:c.body.quantity??1,unit_price:product.unit_price,proposed_unit_price:c.body.proposedUnitPrice,currency:opportunityCurrency(parent),amount:0,note:c.body.note??'',...opportunityProductInfo(c.body)};
    c.app.requireAction(c.actor,actionKey,parent,{...c.body,productPublicId:product.public_id,quantity:line.quantity,proposedUnitPrice:line.proposed_unit_price});quote.lines=[...quote.lines,line];
   }else{
    const index=quote.lines.findIndex(line=>line.public_id===c.params.lineId);hqAssert(index>=0,404,'QUOTE_LINE_NOT_FOUND');
    c.app.requireAction(c.actor,actionKey,parent,c.body);
    if(method==='DELETE')quote.lines.splice(index,1);
    else{const line=quote.lines[index];Object.assign(line,opportunityProductInfo(c.body));if(c.body.quantity!==undefined)line.quantity=c.body.quantity;if(c.body.proposedUnitPrice!==undefined)line.proposed_unit_price=c.body.proposedUnitPrice;if(c.body.note!==undefined)line.note=c.body.note;}
   }
   for(const line of quote.lines)hqAssert(typeof line.note==='string'&&line.note.length<=1000,400,'QUOTE_LINE_NOTE_INVALID');validateQuoteLines(c,d,parent,quote.lines);recalcQuote(quote);if(quote.syncing)syncQuoteProductsToOpportunity(c,d,parent,quote);
  });
 });
 for(const method of ['POST','PATCH','DELETE'])app.route(method,method==='POST'?path:`${path}/:quoteId`,c=>{
  hqOnlyKeys(c.body,method==='DELETE'?['expectedVersion','idempotencyKey']:[...inputs,'expectedVersion','expectedOpportunityVersion','idempotencyKey']);
  const key=hqText(c.body.idempotencyKey,'idempotencyKey',200);const fingerprint=canonicalHq({method,params:c.params,body:c.body});
  return c.repository.transact(d=>{
   const parent=parentFor(c,d,true);
   const receipt=d.collections.auditLogs.find(log=>log.action==='OPPORTUNITY_QUOTE_RECEIPT'&&log.company_id===c.actor.companyId&&log.owner_user_id===c.actor.userId&&(log.detail as Record<string,unknown>)?.key===key);
   if(receipt){const detail=receipt.detail as Record<string,unknown>;hqAssert(detail.fingerprint===fingerprint,409,'IDEMPOTENCY_CONFLICT');return cloneHq(detail.response);}
   let quote:Quote;
   if(method==='POST'){
    hqAssert(Number.isSafeInteger(c.body.expectedOpportunityVersion)&&Number(c.body.expectedOpportunityVersion)>0,400,'QUOTE_PARENT_VERSION_REQUIRED');hqAssert(parent.version===c.body.expectedOpportunityVersion,409,'VERSION_CONFLICT','기회 제품이 변경되었습니다. 최신 기회를 조회한 뒤 견적을 다시 생성하세요.');
    const fields=values(c.body);const lines=cloneHq(Array.isArray(parent.products)?parent.products as Record<string,unknown>[]:[]);
    hqAssert(lines.every(line=>(line.currency??opportunityCurrency(parent))===opportunityCurrency(parent)),422,'QUOTE_CURRENCY_MISMATCH');
    const subtotal=lines.reduce((sum,line)=>sum+Number(line.amount??0),0);hqAssert(Number.isFinite(subtotal)&&subtotal>=0,422,'QUOTE_AMOUNT_INVALID');
    quote={public_id:newHqId(d),company_id:parent.company_id,owner_user_id:parent.owner_user_id,version:1,opportunity_public_id:parent.public_id,account_public_id:parent.account_public_id,status:'DRAFT',syncing:false,deleted:false,currency:opportunityCurrency(parent),issueDate:'',expiryDate:'',validity:'발행일로 부터 14일',promotion:'',deliveryTerms:'디오 직송',paymentTerms:'현금 및 신용카드 및 역구매',notes:'',description:'',tax:0,shipping:0,productAmount:0,goodsAmount:0,...fields,lines,subtotal,total:subtotal+Number(fields.tax??0)+Number(fields.shipping??0),created_at:d.clock,updated_at:d.clock};
    parent.mock_quotes=[...quoteRows(parent),quote];
   }else{
    const found=quoteRows(parent).find(q=>q.public_id===c.params.quoteId&&!q.deleted);hqAssert(found,404,'QUOTE_NOT_FOUND');quote=found;
    hqAssert(quote.status==='DRAFT'&&(method!=='DELETE'||quote.syncing===false),409,'QUOTE_NOT_EDITABLE','동기화 중인 견적은 동기화를 중지한 후 삭제하세요.');
    hqAssert(Number.isSafeInteger(c.body.expectedVersion)&&Number(c.body.expectedVersion)>0,400,'QUOTE_VERSION_REQUIRED');hqAssert(c.body.expectedVersion===quote.version,409,'VERSION_CONFLICT','견적이 변경되었습니다. 입력을 보존한 채 최신 견적을 확인하세요.');
    if(method==='DELETE')quote.deleted=true;
    else{Object.assign(quote,values(c.body,quote));quote.total=Number(quote.subtotal)+Number(quote.tax)+Number(quote.shipping);}
    quote.version++;quote.updated_at=d.clock;
   }
   auditHq(d,c.actor,`OPP.quote.${method}`,parent.public_id,{quoteId:quote.public_id,version:quote.version});
   const response=publicQuote(quote);auditHq(d,c.actor,'OPPORTUNITY_QUOTE_RECEIPT',parent.public_id,{key,fingerprint,response:cloneHq(response)});return response;
  },true);
 });
}
