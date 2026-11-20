import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');
const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-lead-list-review.json','utf8'));
const catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.LEAD_COMMANDS.1';
for(const [id,apiField,ko,en,rule,readOnly] of [
 ['lead.convertAccountMode','accountMode','전환 거래처 방식','Conversion account mode',{type:'string',options:['NEW','EXISTING']},false],
 ['lead.convertAccountPublicId','existingAccountPublicId','기존 거래처','Existing account',{type:'string'},false],
 ['lead.providerNo','providerNo','요양기관 번호','Provider number',{type:'string'},true],
 ['lead.latitude','latitude','리드 위도','Lead latitude',{type:'number',min:-90,max:90},true],
 ['lead.longitude','longitude','리드 경도','Lead longitude',{type:'number',min:-180,max:180},true],
 ['account.latitude','latitude','거래처 위도','Account latitude',{type:'number',min:-90,max:90},false],
 ['account.longitude','longitude','거래처 경도','Account longitude',{type:'number',min:-180,max:180},false],
 ['account.ownerUserId','ownerUserId','거래처 담당자','Account owner',{type:'number',integer:true,min:1},true],
 ['opportunity.ownerUserId','ownerUserId','영업기회 담당자','Opportunity owner',{type:'number',integer:true,min:1},true]
]){const labelKey='customization.fields.'+id;catalog.entries.push({id,kind:'FIELD',screenId:id.startsWith('lead.')?'HQ_LEAD':'HQ_ACCOUNT',apiField,bindingKind:'DATA',labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order',...(!readOnly?['readOnly']:[])],locks:readOnly?['readOnly']:[],dependencies:[],permissions:[],readPermissions:[id.startsWith('lead.')?'LEAD.READ':'ACCOUNT.READ'],writePermissions:[id.startsWith('lead.')?'LEAD.CONVERT':'ACCOUNT.WRITE'],requiredTranslation:true,valueRule:rule});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;}
const errors={LEAD_CONVERTED:['이미 전환된 리드입니다.','Lead has already been converted.'],LEAD_TRANSITION_DENIED:['허용되지 않는 상태 변경입니다.','Status transition is not allowed.'],LEAD_NOT_CONVERTIBLE:['전환 가능한 상태와 담당자가 필요합니다.','Conversion requires an eligible status and owner.'],OWNER_UNAVAILABLE:['활성 상태의 동일 법인 담당자가 필요합니다.','An active owner in the same company is required.'],CONVERSION_SOURCE_DENIED:['전환 원본 필드에 접근할 수 없습니다.','Conversion source fields are not accessible.'],DUPLICATE_ACCOUNT:['동일 사업자번호의 거래처가 있습니다.','An account with this business number exists.'],DOMAIN_WRITE_FAILED:['업무 데이터 저장에 실패했습니다.','Business data could not be saved.'],REASON_REQUIRED:['사유를 입력하세요.','A reason is required.']};
for(const [code,[ko,en]] of Object.entries(errors)){translations['ko-KR']['customization.errors.'+code]=ko;translations['en-US']['customization.errors.'+code]=en;}
const opportunityOwner=catalog.entries.find(e=>e.id==='opportunity.ownerUserId');opportunityOwner.screenId='HQ_OPPORTUNITY';opportunityOwner.readPermissions=['OPPORTUNITY.READ'];opportunityOwner.writePermissions=['OPPORTUNITY.WRITE'];
const recordType=catalog.entries.find(e=>e.id==='opportunity.recordType');recordType.support='supported';recordType.settings.enabled=true;recordType.settings.readOnly=true;recordType.locks=['readOnly'];recordType.capabilities=['enabled','visible'];recordType.valueRule={type:'string',options:['NEW']};
for(const [code,ko,en] of [['CREATION_FIELD_UNMAPPED','생성 필드의 연결이 필요합니다.','A creation field requires a mapping.'],['CREATION_FIELD_DENIED','생성 필드가 허용되지 않습니다.','A creation field is not allowed.'],['CREATION_DEFAULT_CONFLICT','생성 기본값이 업무 규칙과 충돌합니다.','A creation default conflicts with the workflow.']]){translations['ko-KR']['customization.errors.'+code]=ko;translations['en-US']['customization.errors.'+code]=en;}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-lead-commands-review.json',JSON.stringify(makeStandardArtifact('hq.i02.lead-commands.1',catalog,translations,false),null,2)+'\n');
