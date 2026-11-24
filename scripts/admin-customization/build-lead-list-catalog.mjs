import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');
const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const baseline=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-customization-baseline.json','utf8'));
const catalog=structuredClone(baseline.catalog),translations=structuredClone(baseline.translations);
catalog.standardReleaseId='HQ.I02.LEAD_LIST.1';
const add=(id,apiField,kind,ko,en,dependencies=[],valueRule={type:'string'})=>{
 const labelKey='customization.fields.'+id;
 catalog.entries.push({id,kind:'FIELD',screenId:'HQ_LEAD',apiField,bindingKind:kind,labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:kind!=='QUERY',required:false,order:catalog.entries.length},capabilities:['enabled','visible','order',...(kind==='QUERY'?['readOnly']:[])],locks:kind==='QUERY'?[]:['readOnly'],dependencies,permissions:['LEAD.READ'],readPermissions:[],writePermissions:[],requiredTranslation:true,valueRule});
 translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
};
add('lead.ownerName','ownerName','DERIVED','담당자명','Owner name',['lead.ownerUserId']);
add('lead.updatedAt','updatedAt','DATA','수정일','Updated at');
add('lead.ownerFilter','ownerUserId','QUERY','담당자 필터','Owner filter',['lead.ownerUserId'],{type:'number',integer:true,min:1});
add('lead.statusFilter','status','QUERY','상태 필터','Status filter',['lead.status'],{type:'string',options:['NEW','FIRST_VISIT','KEYMAN_MEETING','CONTACT_EXCLUDED','CONVERTED']});
for(const id of ['lead.sido','lead.sigungu']){const e=catalog.entries.find(e=>e.id===id);e.support='supported';e.settings.enabled=true;e.settings.readOnly=true;e.capabilities=e.capabilities.filter(x=>!['readOnly','required'].includes(x));e.locks=[...new Set([...e.locks,'readOnly'])];}
for(const [code,ko,en] of [['QUERY_CONTROL_DENIED','이 필터를 사용할 권한이 없습니다.','This filter is not available.'],['QUERY_FIELD_DENIED','검색 대상 필드에 접근할 수 없습니다.','A search field is not accessible.'],['INVALID_REQUEST','요청 값이 올바르지 않습니다.','Invalid request.']]){translations['ko-KR']['customization.errors.'+code]=ko;translations['en-US']['customization.errors.'+code]=en;}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
// This is a separately versioned review artifact, never a production bootstrap grant.
const artifact=makeStandardArtifact('hq.i02.lead-list.1',catalog,translations,false);
fs.writeFileSync('packages/contracts/catalogs/hq-lead-list-review.json',JSON.stringify(artifact,null,2)+'\n');
console.log('Lead list review artifact generated; publicationReady=false');
