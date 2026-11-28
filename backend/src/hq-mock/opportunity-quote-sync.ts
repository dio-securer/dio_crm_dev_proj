import {hqFind,hqRequire,type HqRouteContext} from './app.js';
import {auditHq,cloneHq,hqAssert,type HqDataset,type HqRow} from './model.js';
import {opportunityCurrency} from './opportunity-contract.js';
export type SyncQuote=HqRow&{deleted:boolean;status:string;syncing:boolean;lines:Record<string,unknown>[]};
export const syncQuotes=(parent:HqRow):SyncQuote[]=>Array.isArray(parent.mock_quotes)?parent.mock_quotes as SyncQuote[]:[];
export function quotePricesReadable(c:HqRouteContext,parent:HqRow){
 for(const field of c.app.standardFor(c.actor).fields.filter(f=>f.entity==='opportunity'&&(f.current.dbField==='amount'||f.sectionKey==='opportunity.products')&&Boolean(f.current.dbField))){const db=field.current.dbField!;const sources=db==='amount'?[parent]:[...(Array.isArray(parent.products)?parent.products as Record<string,unknown>[]:[]),...syncQuotes(parent).flatMap(q=>Array.isArray(q.lines)?q.lines:[])];for(const source of sources){const value=c.app.policyFor(c.actor).readField(field.fieldKey,c.app.context(c.actor,{...c.app.values(parent),[field.fieldKey]:source[db]}));hqAssert(value===source[db],403,'QUOTE_AMOUNT_ACCESS_DENIED');}}
}
export function mutableOpportunityProducts(parent:HqRow){hqAssert(!['CLOSED_WON','CLOSED_LOST'].includes(String(parent.stage))&&parent.contract_created_yn!==true,409,'OPPORTUNITY_CLOSED','마감되었거나 계약이 생성된 기회 제품은 변경할 수 없습니다.');}
export function validateQuoteLines(c:HqRouteContext,d:HqDataset,parent:HqRow,lines:Record<string,unknown>[]){
 hqAssert(lines.length<=1000&&new Set(lines.map(x=>x.public_id)).size===lines.length,422,'QUOTE_LINES_INVALID');
 for(const line of lines){const product=hqFind(d,c.actor,'products',String(line.product_public_id));hqAssert(opportunityCurrency(product)===opportunityCurrency(parent)&&(line.currency??opportunityCurrency(parent))===opportunityCurrency(parent),422,'QUOTE_CURRENCY_MISMATCH');hqAssert(Number.isInteger(line.quantity)&&Number(line.quantity)>0&&Number(line.quantity)<=9999&&typeof line.proposed_unit_price==='number'&&Number.isFinite(line.proposed_unit_price)&&line.proposed_unit_price>=0,400,'QUOTE_LINE_INVALID');line.amount=Number(line.quantity)*Number(line.proposed_unit_price);hqAssert(Number.isFinite(line.amount)&&Number(line.amount)<=Number.MAX_SAFE_INTEGER,400,'QUOTE_AMOUNT_INVALID');}
}
export function recalcQuote(quote:SyncQuote){quote.subtotal=quote.lines.reduce((sum,line)=>sum+Number(line.amount??0),0);quote.total=Number(quote.subtotal)+Number(quote.tax??0)+Number(quote.shipping??0);hqAssert(Number.isFinite(quote.total)&&Number(quote.total)<=Number.MAX_SAFE_INTEGER,400,'QUOTE_AMOUNT_INVALID');}
/** Called inside the opportunity mutation transaction: failures roll back both sides. */
export function syncOpportunityProductsToQuote(c:HqRouteContext,d:HqDataset,parent:HqRow){
 const active=syncQuotes(parent).filter(q=>!q.deleted&&q.syncing);hqAssert(active.length<=1,409,'QUOTE_SYNC_AMBIGUOUS');if(!active.length)return;
 mutableOpportunityProducts(parent);hqRequire(c.actor,'OPPORTUNITY.WRITE');c.app.requireAction(c.actor,'OPP.saveNegotiation',parent,{});quotePricesReadable(c,parent);
 const quote=active[0];quote.lines=cloneHq(parent.products as Record<string,unknown>[]);validateQuoteLines(c,d,parent,quote.lines);recalcQuote(quote);quote.version++;quote.updated_at=d.clock;
 auditHq(d,c.actor,'OPP.quote.syncFromOpportunity',parent.public_id,{quoteId:quote.public_id,quoteVersion:quote.version,opportunityVersion:parent.version});
}
export function syncQuoteProductsToOpportunity(c:HqRouteContext,d:HqDataset,parent:HqRow,quote:SyncQuote){
 mutableOpportunityProducts(parent);validateQuoteLines(c,d,parent,quote.lines);parent.products=cloneHq(quote.lines);parent.amount=Number(quote.subtotal);parent.version++;
 auditHq(d,c.actor,'OPP.quote.syncToOpportunity',parent.public_id,{quoteId:quote.public_id,opportunityVersion:parent.version});
}
