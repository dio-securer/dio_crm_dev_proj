import fs from 'node:fs';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-activity-map-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.ACTIVITY.REPORT.1';
for(const [id,ko,en,rule,editable] of [
 ['reporterUserId','보고자','Reporter',{type:'number',integer:true,min:1},false],['branchApproverUserId','지점 승인자','Branch approver',{type:'number',integer:true,min:1,nullable:true},false],['divisionApproverUserId','본부 승인자','Division approver',{type:'number',integer:true,min:1,nullable:true},false],
 ['requestedAt','요청일시','Requested at',{type:'string',nullable:true},false],['finalApprovedAt','최종 승인일시','Final approval time',{type:'string',nullable:true},false],
 ['itemId','보고 항목 번호','Report item ID',{type:'number',integer:true,min:1},false],['itemType','항목 유형','Item type',{type:'string',options:['RESULT','PLAN']},false],
 ['plannedAt','활동 예정일시','Planned time',{type:'string'},false],['relatedName','대상 이름','Related name',{type:'string',maxLength:200},false],
 ['visitPurpose','방문 목적','Visit purpose',{type:'string',maxLength:500,nullable:true},true]
]){
 const labelKey='customization.fields.report.'+id;catalog.entries.push({id:'report.'+id,kind:'FIELD',screenId:'HQ_ACTIVITY_REPORT',parentId:'section:report.write',apiField:id,bindingKind:'DATA',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:!editable,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order',...(editable?['readOnly','required']:[])],locks:editable?[]:['readOnly'],dependencies:[],permissions:[],readPermissions:['ACTIVITY.REPORT'],writePermissions:editable?['ACTIVITY.REPORT']:[],requiredTranslation:true,valueRule:rule});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
catalog.entries.find(e=>e.id==='report.date').valueRule={type:'date'};
catalog.entries.find(e=>e.id==='report.consultationSnapshot').valueRule={type:'string',maxLength:10000,nullable:true};
for(const [id,ko,en] of [['REPORT_EDIT_LOCKED','현재 보고 상태에서는 변경할 수 없습니다.','The report cannot be changed in its current state.'],['REPORT_OPEN_ACTIVITY','퇴근 처리되지 않은 활동이 있습니다.','An activity is still in progress.'],['APPROVAL_ROUTE_REQUIRED','유효한 승인 경로가 필요합니다.','A valid approval route is required.'],['APPROVAL_ASSIGNEE_REQUIRED','현재 지정된 승인자만 처리할 수 있습니다.','Only the currently assigned approver can act.']]){
 translations['ko-KR']['customization.errors.'+id]=ko;translations['en-US']['customization.errors.'+id]=en;
}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-activity-report-review.json',JSON.stringify(makeStandardArtifact('hq.i02.activity.report.1',catalog,translations,false),null,2)+'\n');
