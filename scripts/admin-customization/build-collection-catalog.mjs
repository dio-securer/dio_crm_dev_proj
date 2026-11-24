import fs from 'node:fs';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-approval-route-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.COLLECTION.1';
// Preserve the actual collection timestamp rather than silently truncating its time.
catalog.entries.find(e=>e.id==='actual.collectedAt').valueRule={type:'string'};
for(const [id,ko,en,rule,deps] of [
 ['sourceSystem','원천 시스템','Source system',{type:'string'},[]],['contractAmount','계약 금액','Contract amount',{type:'number'},['contract.contractAmount']],
 ['currentPlanTotal','현 수금계획 합계','Current plan total',{type:'number'},['plan.amount']],['actualTotal','수금 실적 합계','Actual collections',{type:'number'},['actual.amount']],
 ['overduePlanTotal','기한 경과 계획 합계','Overdue planned total',{type:'number'},['plan.amount','plan.plannedDate']],['outstandingAmount','미수 금액','Outstanding amount',{type:'number'},['contract.contractAmount','actual.amount']],
 ['correctionRequired','수금계획 조정 필요','Collection plan adjustment required',{type:'boolean'},['contract.contractAmount','actual.amount','plan.amount','plan.plannedDate']]
]){
 const fieldId=(id==='sourceSystem'?'actual.':'reconciliation.')+id,labelKey='customization.fields.'+fieldId;catalog.entries.push({id:fieldId,kind:'FIELD',screenId:'HQ_CONTRACT',parentId:'section:collection.actual',apiField:id,bindingKind:'DERIVED',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],dependencies:deps,permissions:[],readPermissions:['COLLECTION.READ'],writePermissions:[],requiredTranslation:true,valueRule:rule});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-collection-review.json',JSON.stringify(makeStandardArtifact('hq.i02.collection.1',catalog,translations,false),null,2)+'\n');
