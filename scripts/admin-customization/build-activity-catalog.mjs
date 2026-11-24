import fs from 'node:fs';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-sales-report-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.ACTIVITY.1';
for(const id of ['directWork.type','directWork.reason']){const e=catalog.entries.find(e=>e.id===id);e.settings.readOnly=false;e.locks=e.locks.filter(p=>p!=='readOnly');e.capabilities=[...new Set([...e.capabilities,'readOnly'])];e.writePermissions=['DIRECT_WORK.REQUEST'];}
for(const [id,ko,en,rule] of [['accuracyM','GPS 정확도','GPS accuracy',{type:'number',min:0,max:99999999.99}],['isMocked','모의 위치 표시','Mock location flag',{type:'boolean'}]]){
 const e=structuredClone(catalog.entries.find(e=>e.id==='activity.latitude'));e.id='activity.'+id;e.apiField=id;e.labelKey='customization.fields.'+e.id;e.valueRule=rule;e.settings.order=catalog.entries.length;catalog.entries.push(e);translations['ko-KR'][e.labelKey]=ko;translations['en-US'][e.labelKey]=en;
}
for(const [id,apiField,ko,en,rule,readonly] of [
 ['subject','subject','활동 제목','Activity subject',{type:'string',minLength:1,maxLength:200},false],
 ['ownerUserId','ownerUserId','활동 담당자','Activity owner',{type:'number',integer:true,min:1},true],
 ['relatedName','relatedName','대상 이름','Related name',{type:'string',maxLength:200},true],
 ['targetLatitude','targetLatitude','대상 위도','Target latitude',{type:'number',min:-90,max:90,nullable:true},true],
 ['targetLongitude','targetLongitude','대상 경도','Target longitude',{type:'number',min:-180,max:180,nullable:true},true]
]){
 const labelKey='customization.fields.activity.'+id;catalog.entries.push({id:'activity.'+id,kind:'FIELD',screenId:'HQ_ACTIVITY',parentId:'section:activity.plan',apiField,bindingKind:'DATA',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:readonly,required:id==='subject',order:catalog.entries.length},capabilities:readonly?['enabled','visible','order']:['enabled','visible','readOnly','required','order'],locks:readonly?['readOnly']:[],dependencies:[],permissions:[],readPermissions:['ACTIVITY.READ'],writePermissions:['ACTIVITY.WRITE'],requiredTranslation:true,valueRule:rule});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
const owner=structuredClone(catalog.entries.find(e=>e.id==='activity.ownerUserId'));owner.id='activity.ownerFilter';owner.labelKey='customization.fields.activity.ownerFilter';owner.bindingKind='QUERY';owner.settings.readOnly=false;owner.locks=[];owner.capabilities=['enabled','visible','readOnly'];owner.writePermissions=['ACTIVITY.READ'];catalog.entries.push(owner);translations['ko-KR'][owner.labelKey]='담당자 필터';translations['en-US'][owner.labelKey]='Owner filter';
for(const id of ['calendarFrom','calendarTo','mapDate'])catalog.entries.find(e=>e.id==='activity.'+id).valueRule={type:'date'};
for(const id of ['ACTIVITY_DUPLICATE','ACTIVITY_EDIT_LOCKED','ACTIVITY_TARGET_DENIED']){translations['ko-KR']['customization.errors.'+id]=id==='ACTIVITY_DUPLICATE'?'같은 날짜의 동일 대상 활동이 이미 있습니다.':id==='ACTIVITY_EDIT_LOCKED'?'현재 활동은 수정할 수 없습니다.':'활동 대상을 사용할 수 없습니다.';translations['en-US']['customization.errors.'+id]=id==='ACTIVITY_DUPLICATE'?'An activity already exists for this target and date.':id==='ACTIVITY_EDIT_LOCKED'?'The activity cannot be edited in its current state.':'The activity target is not available.';}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-activity-review.json',JSON.stringify(makeStandardArtifact('hq.i02.activity.1',catalog,translations,false),null,2)+'\n');
