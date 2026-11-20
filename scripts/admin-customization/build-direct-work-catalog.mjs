import fs from 'node:fs';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-activity-report-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.DIRECT_WORK.1';
for(const [id,ko,en,rule] of [
 ['ownerUserId','요청자','Requester',{type:'number',integer:true,min:1}],['branchApproverUserId','지점 승인자','Branch approver',{type:'number',nullable:true}],['divisionApproverUserId','본부 승인자','Division approver',{type:'number',nullable:true}],['approvalRound','승인 회차','Approval round',{type:'number',integer:true,min:1}],
 ['activityPublicId','활동 식별자','Activity identifier',{type:'string'}],['relatedName','대상 이름','Related name',{type:'string'}],['plannedAt','활동 예정일시','Planned time',{type:'string'}],['activityStatus','활동 상태','Activity status',{type:'string'}]
]){
 const labelKey='customization.fields.directWork.'+id;catalog.entries.push({id:'directWork.'+id,kind:'FIELD',screenId:'HQ_DIRECT_WORK',parentId:'section:directWork.detail',apiField:id,bindingKind:'DERIVED',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],dependencies:[],permissions:[],readPermissions:['DIRECT_WORK.READ'],writePermissions:[],requiredTranslation:true,valueRule:rule});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
catalog.entries.find(e=>e.id==='directWork.decision').valueRule={type:'string',options:['APPROVE','REJECT']};
catalog.entries.find(e=>e.id==='directWork.comment').valueRule={type:'string',maxLength:1000};
translations['ko-KR']['customization.errors.DIRECT_WORK_STATE_CONFLICT']='현재 직출·직퇴 상태에서는 처리할 수 없습니다.';translations['en-US']['customization.errors.DIRECT_WORK_STATE_CONFLICT']='The direct work request cannot be changed in its current state.';
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-direct-work-review.json',JSON.stringify(makeStandardArtifact('hq.i02.direct_work.1',catalog,translations,false),null,2)+'\n');
