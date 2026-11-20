import fs from 'node:fs';import assert from 'node:assert/strict';import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-activity-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.ACTIVITY.MAP.1';
for(const [id,ko,en,rule,query] of [
 ['publicId','대상 식별자','Record identifier',{type:'string'},false],['radiusKm','조회 반경(km)','Search radius (km)',{type:'number',min:0.1,max:50},true],
 ['name','대상 이름','Name',{type:'string'},false],['latitude','위도','Latitude',{type:'number'},false],['longitude','경도','Longitude',{type:'number'},false],['address','주소','Address',{type:'string',nullable:true},false],['distanceM','거리(m)','Distance (m)',{type:'number'},false]
]){
 const labelKey='customization.fields.activityMap.'+id;catalog.entries.push({id:'activityMap.'+id,kind:'FIELD',screenId:'HQ_ACTIVITY',parentId:'section:activity.map',apiField:id,bindingKind:query?'QUERY':'DERIVED',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:!query,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order',...(query?['readOnly']:[])],locks:query?[]:['readOnly'],dependencies:[],permissions:[],readPermissions:['ACTIVITY.READ'],writePermissions:query?['ACTIVITY.READ']:[],requiredTranslation:true,valueRule:rule});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-activity-map-review.json',JSON.stringify(makeStandardArtifact('hq.i02.activity.map.1',catalog,translations,false),null,2)+'\n');
