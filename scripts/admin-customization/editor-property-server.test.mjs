import test from 'node:test';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {MemoryAdminConfigRepository,emptyConfigState}=await import('../../backend/src/customization/config-store.ts');
const {CompanyConfigurationService,makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const {validateTranslations,resolveCompanyConfig}=await import('../../packages/contracts/src/crm-customization.ts');
const companyId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='11111111-1111-4111-8111-111111111111',actor={id,companyId};
function fixture(){
 const make=(id,support='supported')=>({id,kind:'SCREEN',labelKey:id,support,settings:{enabled:support==='supported',visible:support==='supported',readOnly:false,required:false,order:0},capabilities:['enabled','visible'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true});
 const entries=[make('screen'),make('pending','unsupported')],translations={'ko-KR':{screen:'화면',pending:'대기'},'en-US':{screen:'Screen',pending:'Pending'}};
 const catalog={schemaVersion:1,standardReleaseId:'s04.standard',entries},artifact=makeStandardArtifact('s04-artifact',catalog,translations,true);
 const repo=new MemoryAdminConfigRepository([emptyConfigState(companyId,{[id]:{active:true,permissions:['config.read','config.edit','config.preview','config.publish'],denied:[]}})]);
 return {entries,translations,service:new CompanyConfigurationService(repo,[artifact])};
}
for(const [name,patches,translations,code] of [
 ['disabled unsupported patch',[{targetId:'pending',property:'visible',operation:'set',value:true}],{},'UNSUPPORTED_FEATURE'],
 ['unknown translation',[],{'ko-KR':{unknown:'변경'}},'UNKNOWN_TARGET'],
 ['unsupported translation',[],{'ko-KR':{pending:'변경'}},'UNSUPPORTED_FEATURE'],
])test(name+' is rejected by actual service validation and publication',async()=>{
 const {service}=fixture();let draft=await service.createDraft(actor,'s04.standard',null,'create');draft=await service.saveDraft(actor,draft.id,draft.revision,{patches,translations,activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR'},'save');
 const checked=await service.validate(actor,draft.id,draft.revision);assert.ok(checked.errors.some(e=>e.code===code));await assert.rejects(service.publish(actor,checked.id,null,'test','publish'));
});
test('supported shared keys and retained inactive-locale overrides remain valid',()=>{
 const {entries,translations}=fixture();const owners=[entries[0],{...entries[0],id:'second'}];assert.deepEqual(validateTranslations(owners,['ko-KR'],'ko-KR',translations,{'ko-KR':{screen:'공통'},'en-US':{screen:'Shared'}}),[]);
});
test('shared label cannot bypass an unsupported owner and input is not rewritten',()=>{
 const {entries,translations}=fixture();entries[1].labelKey='screen';const overrides={'ko-KR':{screen:'공통'}},before=JSON.stringify(overrides);assert.ok(validateTranslations(entries,['ko-KR'],'ko-KR',translations,overrides).some(e=>e.code==='UNSUPPORTED_FEATURE'&&e.targetId==='pending'));assert.equal(JSON.stringify(overrides),before);
});
test('legacy safety disable remains valid but cannot mutate other unsupported metadata',()=>{
 const {entries}=fixture();entries[1].settings.enabled=true;const catalog={schemaVersion:1,standardReleaseId:'s04.standard',entries};const config={companyId,baseStandardReleaseId:'s04.standard',activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{},patches:[{targetId:'pending',property:'enabled',operation:'set',value:false}]};assert.equal(resolveCompanyConfig(catalog,config).ok,true);config.patches.push({targetId:'pending',property:'visible',operation:'set',value:false});assert.equal(resolveCompanyConfig(catalog,config).ok,false);
});
