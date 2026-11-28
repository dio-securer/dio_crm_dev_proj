import test from 'node:test';
import assert from 'node:assert/strict';
import '../hq-standard/register.mjs';
const {rebaseConfiguration}=await import('../../backend/src/customization/config-rebase.ts');
const {projectFields,validateFieldWrite,requireQueryFields}=await import('../../backend/src/customization/field-policy.ts');
const {MemoryAdminConfigRepository,emptyConfigState}=await import('../../backend/src/customization/config-store.ts');
const {CompanyConfigurationService,makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');
const companyId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='abcdefab-abcd-4abc-8abc-abcdefabcdef',actor={authenticated:true,companyId,allowed:[],denied:[]};
const entry=(id,settings={})=>({id,kind:'FIELD',labelKey:id,support:'supported',bindingKind:'DATA',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0,...settings},capabilities:['visible','required'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true,valueRule:{type:'string',maxLength:20}});
const fields=[entry('name',{required:true}),entry('secret',{visible:false}),entry('masked',{masking:'redact'}),entry('locked',{readOnly:true})];
const result={ok:true,entries:fields,issues:[],provenance:{}};
const bindings=fields.map(f=>({fieldId:f.id,input:f.id,column:'db_'+f.id,output:f.id}));
const cfg={companyId,baseStandardReleaseId:'v1',patches:[{targetId:'name',property:'required',operation:'set',value:false}],activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{}};
const c1={schemaVersion:1,standardReleaseId:'v1',entries:[entry('name')]};
test('read projection omits hidden/unregistered columns and masks redacted values',()=>assert.deepEqual(projectFields(result,companyId,actor,bindings,{db_name:'A',db_secret:'hidden',db_masked:'private',db_locked:'read',password:'never'}),{name:'A',masked:'***',locked:'read'}));
test('field protection is checked before persistence',()=>{for(const input of [{secret:'x'},{masked:'x'},{locked:'x'}])assert.throws(()=>validateFieldWrite(result,companyId,actor,bindings,input,{db_name:'A'}),e=>e.code==='FIELD_WRITE_DENIED');assert.throws(()=>validateFieldWrite(result,companyId,actor,bindings,{unknown:'x'}),e=>e.code==='UNREGISTERED_FIELD');});
test('required applies to merged stored state; unknown types and missing required rejected',()=>{assert.deepEqual(validateFieldWrite(result,companyId,actor,bindings,{name:'B'},{db_name:'A'}),{db_name:'B'});for(const input of [{name:''},{name:3}])assert.throws(()=>validateFieldWrite(result,companyId,actor,bindings,input));assert.throws(()=>validateFieldWrite(result,companyId,actor,bindings,{},{}),e=>e.code==='REQUIRED_FIELD');});
test('hidden and masked fields cannot be filter/sort/aggregate inputs',()=>{requireQueryFields(result,companyId,actor,['name']);for(const id of ['secret','masked','unknown'])assert.throws(()=>requireQueryFields(result,companyId,actor,[id]),e=>e.code==='QUERY_FIELD_DENIED');});
test('hidden screen and section cascade to field reads writes and dependent aggregates',()=>{
 for(const hidden of ['screen','section']){
  const screen={...entry('screen',{visible:hidden!=='screen'}),kind:'SCREEN'},section={...entry('section',{visible:hidden!=='section'}),kind:'SECTION',screenId:'screen'},source={...entry('source'),screenId:'screen',parentId:'section'},derived={...entry('total'),bindingKind:'DERIVED',dependencies:['source']};
  const r={...result,entries:[screen,section,source,derived]},b=[{fieldId:'source',input:'source',column:'source',output:'source'},{fieldId:'total',input:'total',column:'total',output:'total'}];
  assert.deepEqual(projectFields(r,companyId,actor,b,{source:'secret',total:'secret'}),{});
  assert.throws(()=>requireQueryFields(r,companyId,actor,['source']),e=>e.code==='QUERY_FIELD_DENIED');
  assert.throws(()=>validateFieldWrite(r,companyId,actor,b,{source:'change'}),e=>e.code==='FIELD_WRITE_DENIED');
 }
});
test('nested data fails closed until endpoint supplies a reviewed adapter',()=>assert.throws(()=>projectFields(result,companyId,actor,bindings,{db_name:{nested:'private'}}),e=>e.code==='NESTED_ADAPTER_REQUIRED'));
test('missing conditional policy context fails closed rather than treating unknown as absent',()=>{const e={...entry('name'),requiredWhen:{kind:'equals',fieldKey:'unloaded',value:'X'}};assert.throws(()=>validateFieldWrite({...result,entries:[e]},companyId,actor,[bindings[0]],{name:'value'}),error=>error.code==='POLICY_CONTEXT_UNAVAILABLE');});
test('trusted hidden default participates in conditional required before insert',()=>{const a=entry('kind',{visible:false,readOnly:true,default:'X'}),b={...entry('detail'),requiredWhen:{kind:'equals',fieldKey:'kind',value:'X'}};const r={...result,entries:[a,b]},bs=[a,b].map(e=>({fieldId:e.id,input:e.id,column:e.id,output:e.id}));assert.throws(()=>validateFieldWrite(r,companyId,actor,bs,{}, {},'create'),e=>e.code==='REQUIRED_FIELD');assert.deepEqual(validateFieldWrite(r,companyId,actor,bs,{detail:'complete'}, {},'create'),{kind:'X',detail:'complete'});});
test('QUERY and DEVICE fields cannot be persisted through generic DATA adapter',()=>{for(const bindingKind of ['QUERY','DEVICE']){const e={...entry('special'),bindingKind},r={...result,entries:[e]},bs=[{fieldId:e.id,input:'special',column:'special',output:'special'}];assert.throws(()=>validateFieldWrite(r,companyId,actor,bs,{special:'value'}),e=>e.code==='DEDICATED_FIELD_ADAPTER_REQUIRED');}});
test('company mismatch yields no readable fields and no write permission',()=>{assert.deepEqual(projectFields(result,'other',actor,bindings,{db_name:'A'}),{});assert.throws(()=>validateFieldWrite(result,'other',actor,bindings,{name:'B'}),e=>e.code==='FIELD_WRITE_DENIED');});
test('changed standard + company override produces explicit conflict; drop adopts standard',()=>{const c2={...c1,standardReleaseId:'v2',entries:[entry('name',{required:true})]};const pending=rebaseConfiguration(cfg,c1,c2);assert.equal(pending.conflicts[0].code,'STANDARD_ENTRY_CHANGED');const resolved=rebaseConfiguration(cfg,c1,c2,{'patch:name:required':'drop'});assert.equal(resolved.conflicts.length,0);assert.deepEqual(resolved.config.patches,[]);assert.equal(cfg.baseStandardReleaseId,'v1');});
test('removed field cannot be kept and unknown resolution is rejected',()=>{const c2={...c1,standardReleaseId:'v2',entries:[]};assert.equal(rebaseConfiguration(cfg,c1,c2).conflicts[0].code,'TARGET_REMOVED');assert.throws(()=>rebaseConfiguration(cfg,c1,c1,{invented:'drop'}),e=>e.code==='INVALID_REBASE_RESOLUTION');});
test('standard translation change conflicts with company text until explicit keep/drop',()=>{const config={...cfg,patches:[],translations:{'ko-KR':{name:'법인 이름'}}},old={'ko-KR':{name:'이름'}},next={'ko-KR':{name:'고객명'}};const rebased=rebaseConfiguration(config,c1,c1,{},old,next);assert.equal(rebased.conflicts[0].code,'STANDARD_TRANSLATION_CHANGED');assert.deepEqual(rebaseConfiguration(config,c1,c1,{'translation:ko-KR:name':'keep'},old,next).conflicts,[]);assert.deepEqual(rebaseConfiguration(config,c1,c1,{'translation:ko-KR:name':'drop'},old,next).config.translations['ko-KR'],{});});
test('unresolved rebase cannot publish; explicit resolution must be revalidated',async()=>{
 const permissions=['config.edit','config.publish'];const repository=new MemoryAdminConfigRepository([emptyConfigState(companyId,{[id]:{active:true,permissions,denied:[]}})]);
 const c2={...c1,standardReleaseId:'v2',entries:[entry('name',{required:true})]};
 const artifacts=[c1,c2].map(c=>makeStandardArtifact(c.standardReleaseId,c,{'ko-KR':{name:'이름'},'en-US':{name:'Name'}},true));const service=new CompanyConfigurationService(repository,artifacts),a={id,companyId};
 const d=await service.createDraft(a,'v1',null,'create');const s=await service.saveDraft(a,d.id,1,{patches:cfg.patches,activeLocales:['ko-KR'],defaultLocale:'ko-KR',translations:{}},'save');
 const r=await service.rebase(a,d.id,s.revision,'v2',{},'rebase');const v=await service.validate(a,d.id,r.revision);assert.ok(v.errors.some(e=>e.code==='REBASE_UNRESOLVED'));
 await assert.rejects(service.publish(a,v.id,null,'blocked','publish'),e=>e.code==='VALIDATION_FAILED');
 const resolved=await service.rebase(a,d.id,r.revision,'v2',{'patch:name:required':'drop'},'resolve');const valid=await service.validate(a,d.id,resolved.revision);assert.deepEqual(valid.errors,[]);assert.equal((await service.publish(a,valid.id,null,'resolved','publish2')).standardReleaseId,'v2');
});
test('awaited async domain failure leaves no data/receipt/audit changes',async()=>{
 const c={...c1,entries:[{...entry('action'),kind:'ACTION'}]},a={id,companyId};const repo=new MemoryAdminConfigRepository([emptyConfigState(companyId,{[id]:{active:true,permissions:['config.edit','config.publish','runtime.write'],denied:[]}})]);
 const service=new CompanyConfigurationService(repo,[makeStandardArtifact('artifact',c,{'ko-KR':{action:'처리'},'en-US':{action:'Action'}},true)]);
 const d=await service.createDraft(a,'v1',null,'create'),v=await service.validate(a,d.id,1),r=await service.publish(a,v.id,null,'publish','publish'),before=repo.snapshot(companyId);
 await assert.rejects(service.executeBusiness(a,{releaseId:r.id,permissionVersion:1},'action','work',{},async state=>{state.pendingActions.action=1;await Promise.resolve();throw Error('injected');}));assert.deepEqual(repo.snapshot(companyId),before);
});
