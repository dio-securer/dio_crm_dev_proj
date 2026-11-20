import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');
const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-customer-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.SALES.1';
function field(id,apiField,ko,en,rule,options={}){
 const labelKey='customization.fields.'+id;
 catalog.entries.push({id,kind:'FIELD',screenId:'HQ_OPPORTUNITY',parentId:'section:opportunity.basic',apiField,bindingKind:'DATA',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:catalog.entries.length},capabilities:['enabled','visible','readOnly','required','order'],locks:[],dependencies:[],permissions:[],readPermissions:['OPPORTUNITY.READ'],writePermissions:['OPPORTUNITY.WRITE'],requiredTranslation:true,valueRule:rule,...options});
 translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
field('opportunity.paymentDate','paymentDate','결제일','Payment date',{type:'date',nullable:true});
field('opportunity.productNote','note','상품 비고','Product note',{type:'string',maxLength:1000,nullable:true},{parentId:'section:opportunity.products',writePermissions:['OPPORTUNITY.PRODUCT.WRITE']});
for(const [id,apiField,ko,en] of [['productType','itemType','상품 유형','Product type'],['erpItemCode','erpItemCode','ERP 품목 코드','ERP item code']])field('opportunity.'+id,apiField,ko,en,{type:'string',nullable:id==='erpItemCode'},{parentId:'section:opportunity.products',bindingKind:'DERIVED',dependencies:['opportunity.productPublicId'],settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],writePermissions:[]});
field('opportunity.productName','itemName','상품명','Product name',{type:'string'},{parentId:'section:opportunity.products',bindingKind:'DERIVED',dependencies:['opportunity.productPublicId'],settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],writePermissions:[]});
field('opportunity.lineAmount','lineAmount','상품 금액','Line amount',{type:'number',min:0},{parentId:'section:opportunity.products',bindingKind:'DERIVED',dependencies:['opportunity.quantity','opportunity.price'],settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],writePermissions:[]});
translations['ko-KR']['customization.errors.STANDARD_ADAPTER_MISMATCH']='현재 표준 버전은 이 업무 연결을 지원하지 않습니다.';
translations['en-US']['customization.errors.STANDARD_ADAPTER_MISMATCH']='The current standard does not support this business adapter.';
for(const id of ['competitorUsage','ownedEquipment','treatmentFeeInfo','installmentMonths']){const e=catalog.entries.find(e=>e.id==='opportunity.'+id);e.support='supported';e.settings.enabled=true;}
for(const e of catalog.entries.filter(e=>e.id.startsWith('opportunity.')&&e.valueRule&&!e.invariantRequired))if(!['stage','recordType','ownerUserId','targetStage','productPublicId','quantity','price'].some(k=>e.id==='opportunity.'+k))e.valueRule.nullable=true;
catalog.entries.find(e=>e.id==='opportunity.expectedCloseDate').valueRule={type:'date',nullable:true};
const record=catalog.entries.find(e=>e.id==='opportunity.recordType');record.valueRule.options=['NEW','EXISTING','RECONTRACT'];record.settings.readOnly=false;record.locks=[];record.capabilities=['enabled','visible','readOnly'];record.writePermissions=['OPPORTUNITY.WRITE'];
for(const [id,ko,en,rule,deps] of [
 ['amount','금액','Amount',{type:'number',min:0},['opportunity.quantity','opportunity.price']],
 ['ownerName','담당자명','Owner name',{type:'string',nullable:true},['opportunity.ownerUserId']],
 ['updatedAt','수정일','Updated at',{type:'string'},[]],
 ['contractCreatedYn','계약 생성 여부','Contract created',{type:'boolean'},[]]
])field('opportunity.'+id,id,ko,en,rule,{bindingKind:deps.length?'DERIVED':'DATA',dependencies:deps,settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],writePermissions:[]});
for(const [id,api,ko,en,rule] of [['search','search','영업기회 검색','Opportunity search',{type:'string',maxLength:200}],['stageFilter','stage','단계 필터','Stage filter',{type:'string',options:['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION','CLOSED_WON','CLOSED_LOST']}],['accountFilter','accountPublicId','거래처 필터','Account filter',{type:'reference'}]])field('opportunity.'+id,api,ko,en,rule,{bindingKind:'QUERY',writePermissions:[],capabilities:['enabled','visible','readOnly']});
const archive=structuredClone(catalog.entries.find(e=>e.id==='OPP.saveNegotiation'));archive.id='OPP.archive';archive.labelKey='customization.actions.OPP.archive';catalog.entries.push(archive);translations['ko-KR'][archive.labelKey]='영업기회 보관';translations['en-US'][archive.labelKey]='Archive opportunity';
for(const [code,ko,en] of [['OPPORTUNITY_LOCKED','계약이 생성되어 영업기회를 변경할 수 없습니다.','The opportunity is locked by its contract.'],['OPPORTUNITY_CHANGED','영업기회가 변경되었습니다.','The opportunity changed.'],['OPPORTUNITY_TRANSITION_DENIED','허용되지 않은 단계 변경입니다.','This stage transition is not allowed.'],['ERP_APPROVAL_REQUIRED','ERP 승인 거래처가 필요합니다.','An ERP-approved account is required.']]){translations['ko-KR']['customization.errors.'+code]=ko;translations['en-US']['customization.errors.'+code]=en;}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-sales-review.json',JSON.stringify(makeStandardArtifact('hq.i02.sales.1',catalog,translations,false),null,2)+'\n');
