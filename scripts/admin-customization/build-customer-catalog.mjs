import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {validateCatalog,validateTranslations}=await import('../../packages/contracts/src/crm-customization.ts');
const {makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const base=JSON.parse(fs.readFileSync('packages/contracts/catalogs/hq-lead-commands-review.json','utf8')),catalog=structuredClone(base.catalog),translations=structuredClone(base.translations);catalog.standardReleaseId='HQ.I02.CUSTOMER.1';
for(const id of ['account.search','account.scope']){const e=catalog.entries.find(e=>e.id===id);e.support='supported';e.settings.enabled=true;e.capabilities=['enabled','visible','readOnly'];if(id==='account.scope')e.valueRule={type:'string',options:['mine','managed','all']};}
for(const [id,apiField,kind,ko,en,dependencies] of [['account.ownerName','ownerName','DERIVED','담당자명','Owner name',['account.ownerUserId']],['account.updatedAt','updatedAt','DATA','수정일','Updated at',[]]]){
 const labelKey='customization.fields.'+id;catalog.entries.push({id,kind:'FIELD',screenId:'HQ_ACCOUNT',apiField,bindingKind:kind,labelKey,support:'supported',settings:{enabled:true,visible:true,readOnly:true,required:false,order:catalog.entries.length},capabilities:['enabled','visible','order'],locks:['readOnly'],dependencies,permissions:['ACCOUNT.READ'],readPermissions:[],writePermissions:[],requiredTranslation:true,valueRule:{type:'string',nullable:true}});translations['ko-KR'][labelKey]=ko;translations['en-US'][labelKey]=en;
}
// Reviewed SQL scalar limits. Identity and binding meaning stay stable.
const bounds={'account.crmName':200,'account.accountGrade':30,'account.erp.biz_no':20,'account.erp.hosp_nm':200,'account.erp.ceo_nm':100,'account.erp.tel':50,'account.erp.fax':50,'account.erp.homepage':100,'account.crmAddress':500,'account.erp.addr1':400,'account.erp.addr2':100,'account.erp.addr_prt':400,'account.erp.zip_cd':20,'account.erp.email':200,'account.erp.medical_care_no':50,'account.erp.U_Key':100,'account.erp.doctor_no':500,'account.erp.sal_kd':20,'account.erp.use_yn':1,'account.erp.stat_bc':1,'contact.contactName':100,'contact.contactType':30,'contact.mobile':50,'contact.email':200,'contact.school':100,'contact.cohort':50,'contact.major':100,'contact.note':1000};
for(const [id,maxLength] of Object.entries(bounds)){const e=catalog.entries.find(e=>e.id===id);e.valueRule={...e.valueRule,maxLength,nullable:!['account.crmName','contact.contactName'].includes(id)};}
for(const [code,ko,en] of [['ACCOUNT_MERGED','병합된 거래처는 수정할 수 없습니다.','A merged account cannot be edited.'],['ACCOUNT_CHANGED','거래처가 변경되었습니다.','The account changed.'],['CONTACT_CHANGED','연락처가 변경되었습니다.','The contact changed.']]){translations['ko-KR']['customization.errors.'+code]=ko;translations['en-US']['customization.errors.'+code]=en;}
assert.deepEqual(validateCatalog(catalog),[]);assert.deepEqual(validateTranslations(catalog.entries,['ko-KR','en-US'],'ko-KR',translations,{}),[]);
fs.writeFileSync('packages/contracts/catalogs/hq-customer-review.json',JSON.stringify(makeStandardArtifact('hq.i02.customer.1',catalog,translations,false),null,2)+'\n');
