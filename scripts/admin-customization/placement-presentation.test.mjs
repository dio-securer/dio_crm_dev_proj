import test from 'node:test';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {placementPresentationErrors,effectivePlacementPresentation,resolveCompanyConfig,canonicalConfigJson}=await import('../../packages/contracts/src/crm-customization.ts');
const {MemoryAdminConfigRepository,emptyConfigState}=await import('../../backend/src/customization/config-store.ts');
const {CompanyConfigurationService,makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const {rebaseConfiguration}=await import('../../backend/src/customization/config-rebase.ts');
const {configurationDiff}=await import('../../frontend/src/customization/configuration-diff.ts');
const companyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222',actor={companyId:companyA,id};
const target='lead.detail.basic.phone',createTarget='lead.create.basic.phone';
const accountTarget='account.create.basic.crmName';
const envelope=()=>({schemaVersion:1,values:{[target]:{'ko-KR':{label:'상세 전화',helpText:'상세에서만 보입니다'},'en-US':{label:'Detail phone'}},[createTarget]:{'ko-KR':{label:'등록 전화'}}}});
function fixture(){
 const base=(id,kind,extras={})=>({id,kind,labelKey:id,support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:['enabled','visible'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true,...extras});
 const entries=[base('HQ_LEAD','SCREEN'),...['hospitalName','phone','address','businessNo'].map(f=>base('lead.'+f,'FIELD',{screenId:'HQ_LEAD',bindingKind:'DATA',apiField:f,readPermissions:f==='phone'?['PHONE.READ']:[]}))];
 entries.push(base('HQ_ACCOUNT','SCREEN'),base('account.crmName','FIELD',{screenId:'HQ_ACCOUNT',bindingKind:'DATA',apiField:'accountName',readPermissions:['PHONE.READ']}));
 const catalog={schemaVersion:1,standardReleaseId:'presentation.standard.1',entries},translations=Object.fromEntries(['ko-KR','en-US'].map(locale=>[locale,Object.fromEntries(entries.map(e=>[e.labelKey,`${locale} ${e.id}`]))]));
 const permissions=['config.read','config.edit','config.preview','config.publish','config.restore','runtime.read','PHONE.READ'];
 const members={[id]:{active:true,permissions,denied:[]},[viewer]:{active:true,permissions:['runtime.read'],denied:[]}};
 const artifact=makeStandardArtifact('presentation-artifact',catalog,translations,true),repo=new MemoryAdminConfigRepository([emptyConfigState(companyA,members),emptyConfigState(companyB,members)]);
 return {catalog,translations,repo,service:new CompanyConfigurationService(repo,[artifact])};
}
const save=(service,draft,extra={},who=actor,key='save')=>service.saveDraft(who,draft.id,draft.revision,{patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{},...extra},key);
async function publish(service,draft,who=actor,key='publish'){const checked=await service.validate(who,draft.id,draft.revision);assert.deepEqual(checked.errors,[]);return service.publish(who,checked.id,draft.baseActiveReleaseId??null,'presentation test',key);}

test('v1 saved/reloaded/published labels stay independent between detail and create and company A/B',async()=>{
 const {service}=fixture();assert.equal((await service.read(actor)).capabilities.placementPresentation,true);let draft=await service.createDraft(actor,'presentation.standard.1',null,'create');draft=await save(service,draft,{placementPresentation:envelope()});
 assert.deepEqual((await service.read(actor)).drafts.find(d=>d.id===draft.id).config.placementPresentation,envelope());
 await assert.rejects(service.effective(actor),e=>e.code==='NO_ACTIVE_RELEASE');await publish(service,draft);
 const effective=await service.effective(actor,'ko-KR');assert.equal(effective.placementPresentation[target].label,'상세 전화');assert.equal(effective.placementPresentation[createTarget].label,'등록 전화');assert.equal(effective.labels['lead.phone'],'ko-KR lead.phone');
 const b={...actor,companyId:companyB};const bd=await service.createDraft(b,'presentation.standard.1',null,'create-b');await publish(service,bd,b,'publish-b');assert.equal(Object.hasOwn(await service.effective(b),'placementPresentation'),false);
});

test('legacy omission does not erase saved overrides and explicit empty envelope restores inheritance',async()=>{
 const {service}=fixture();let d=await service.createDraft(actor,'presentation.standard.1',null,'create');d=await save(service,d,{placementPresentation:envelope()});d=await save(service,d,{},actor,'legacy-save');assert.deepEqual(d.config.placementPresentation,envelope());
 d=await save(service,d,{placementPresentation:{schemaVersion:1,values:{}}},actor,'clear');await publish(service,d);assert.deepEqual((await service.effective(actor)).placementPresentation,{});
});

test('legacy configs remain envelope-free and descriptor validation does not rewrite serialized config',async()=>{
 const {service,catalog}=fixture();let d=await service.createDraft(actor,'presentation.standard.1',null,'create');d=await save(service,d);assert.equal(Object.hasOwn(d.config,'placementPresentation'),false);const before=canonicalConfigJson(d.config);assert.equal(resolveCompanyConfig(catalog,d.config).ok,true);assert.equal(canonicalConfigJson(d.config),before);const release=await publish(service,d);assert.equal(Object.hasOwn((await service.release(actor,release.id)).config,'placementPresentation'),false);
});

test('invalid version, ID, foreign property, null, type, blank, markup and length reject atomically',async()=>{
 const bad=[{...envelope(),schemaVersion:2},{schemaVersion:1,values:{wrong:{'ko-KR':{label:'x'}}}},{schemaVersion:1,values:{[target]:{'ko-KR':{width:100}}}},null,{schemaVersion:1,values:{[target]:{'ko-KR':{label:42}}}},{schemaVersion:1,values:{[target]:{'ko-KR':{label:' '}}}},{schemaVersion:1,values:{[target]:{'ko-KR':{helpText:'<b>bad</b>'}}}},{schemaVersion:1,values:{[target]:{'ko-KR':{label:'a'.repeat(201)}}}}];
 const {service}=fixture();const d=await service.createDraft(actor,'presentation.standard.1',null,'create');for(const [i,value]of bad.entries())await assert.rejects(save(service,d,{placementPresentation:value},actor,'bad'+i),e=>e.code==='INVALID_PLACEMENT_PRESENTATION');const stored=(await service.read(actor)).drafts[0];assert.equal(stored.revision,d.revision);assert.equal(Object.hasOwn(stored.config,'placementPresentation'),false);
});

test('edit permission, company boundary, stale revision and stale validation are enforced',async()=>{
 const {service}=fixture();let d=await service.createDraft(actor,'presentation.standard.1',null,'create');await assert.rejects(save(service,d,{placementPresentation:envelope()},{id:viewer,companyId:companyA}),e=>e.code==='PERMISSION_DENIED');await assert.rejects(save(service,d,{placementPresentation:envelope()},{id,companyId:companyB}),e=>e.code==='NOT_FOUND');
 const original=d;d=await save(service,d,{placementPresentation:envelope()});await assert.rejects(save(service,original,{placementPresentation:envelope()},actor,'stale'),e=>e.code==='DRAFT_CONFLICT');const v=await service.validate(actor,d.id,d.revision);d=await save(service,d,{placementPresentation:{schemaVersion:1,values:{}}},actor,'changed');await assert.rejects(service.publish(actor,v.id,null,'stale','stale-publish'));
});

test('effective projection hides denied fields and resolves selected/default locale per property',async()=>{
 const {service}=fixture();let d=await service.createDraft(actor,'presentation.standard.1',null,'create');d=await save(service,d,{placementPresentation:envelope()});await publish(service,d);const en=await service.effective(actor,'en-US');assert.equal(en.placementPresentation[target].label,'Detail phone');assert.equal(en.placementPresentation[target].helpText,'상세에서만 보입니다');assert.deepEqual((await service.effective({id:viewer,companyId:companyA})).placementPresentation,{});
});

test('standard rebase preserves unchanged values and requires choices for changed field or base label',()=>{
 const {catalog,translations}=fixture();const config={companyId:companyA,baseStandardReleaseId:catalog.standardReleaseId,patches:[],activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{},placementPresentation:envelope()};const targetCatalog={...structuredClone(catalog),standardReleaseId:'presentation.standard.2'};
 assert.deepEqual(rebaseConfiguration(config,catalog,targetCatalog,{},translations,translations).config.placementPresentation,envelope());
 targetCatalog.entries.find(e=>e.id==='lead.phone').settings.readOnly=true;const conflicted=rebaseConfiguration(config,catalog,targetCatalog,{},translations,translations);assert.equal(conflicted.conflicts.length,2);const drop=Object.fromEntries(conflicted.conflicts.map(c=>[c.id,'drop']));assert.deepEqual(rebaseConfiguration(config,catalog,targetCatalog,drop,translations,translations).config.placementPresentation.values,{});
 assert.equal(configurationDiff({...config,placementPresentation:undefined},config).filter(x=>x.path.startsWith('presentation/')).length,4);
});

test('unsupported field or screen blocks placement metadata and no unknown runtime IDs are projected',()=>{
 const {catalog}=fixture();catalog.entries.find(e=>e.id==='lead.phone').support='unsupported';assert.ok(placementPresentationErrors(envelope(),catalog.entries).length);assert.deepEqual(effectivePlacementPresentation({schemaVersion:1,values:{unknown:{'ko-KR':{label:'secret'}}}},'ko-KR','ko-KR',new Set(['HQ_LEAD','lead.phone'])),{});
});

test('account create presentation publishes without changing lead data; legacy replacement preserves account and explicit empty resets',async()=>{
 const {service}=fixture();assert.equal((await service.read(actor)).capabilities.accountPlacementPresentation,true);
 let d=await service.createDraft(actor,'presentation.standard.1',null,'account-create');
 const value=envelope();value.values[accountTarget]={'ko-KR':{label:'Account title',helpText:'Account help'},'en-US':{label:'English account'}};
 d=await save(service,d,{placementPresentation:value});
 d=await save(service,d,{placementPresentation:envelope()},actor,'old-client');assert.deepEqual(d.config.placementPresentation,value);
 await publish(service,d);const effective=await service.effective(actor,'en-US');assert.equal(effective.placementPresentation[accountTarget].label,'English account');assert.equal(effective.placementPresentation[accountTarget].helpText,'Account help');assert.equal(effective.labels['account.crmName'],'en-US account.crmName');
 assert.equal((await service.effective({id:viewer,companyId:companyA})).placementPresentation[accountTarget],undefined);
 const active=(await service.read(actor)).activeReleaseId;d=await service.createDraft(actor,'presentation.standard.1',active,'reset-draft');
 const reset=envelope();reset.values[accountTarget]={};d=await save(service,d,{placementPresentation:reset},actor,'account-reset');await publish(service,d,actor,'reset-publish');assert.equal((await service.effective(actor)).placementPresentation[accountTarget],undefined);assert.ok((await service.effective(actor)).placementPresentation[target]);
});

test('account placement rejects mismatched screen, disabled standard and unsupported definition; rebase and diff track account independently',()=>{
 const {catalog,translations}=fixture();const value={schemaVersion:1,values:{[accountTarget]:{'ko-KR':{label:'Account'}}}};
 for(const mutate of [c=>c.entries.find(e=>e.id==='account.crmName').screenId='HQ_LEAD',c=>c.entries.find(e=>e.id==='HQ_ACCOUNT').settings.enabled=false,c=>c.entries.find(e=>e.id==='account.crmName').support='unsupported']){const c=structuredClone(catalog);mutate(c);assert.ok(placementPresentationErrors(value,c.entries).length);}
 const config={companyId:companyA,baseStandardReleaseId:catalog.standardReleaseId,patches:[],activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{},placementPresentation:value};const next=structuredClone(catalog);next.standardReleaseId='next';next.entries.find(e=>e.id==='account.crmName').settings.readOnly=true;
 const result=rebaseConfiguration(config,catalog,next,{},translations,translations);assert.equal(result.conflicts.length,1);assert.equal(configurationDiff({...config,placementPresentation:undefined},config).filter(x=>x.path.startsWith('presentation/')).length,1);
});
