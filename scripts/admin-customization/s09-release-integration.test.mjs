import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import '../hq-standard/register.mjs';
const {canonicalConfigJson}=await import('../../packages/contracts/src/crm-customization.ts');const {MemoryAdminConfigRepository,emptyConfigState}=await import('../../backend/src/customization/config-store.ts');const {CompanyConfigurationService,makeStandardArtifact}=await import('../../backend/src/customization/config-service.ts');const {configReleaseHash}=await import('../../backend/src/customization/release-integrity.ts');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id='11111111-1111-4111-8111-111111111111',actor={companyId:A,id},keys=['placementPresentation','leadGrid','leadColumnWidths','leadColumnAlignments','popupPresentation','buttonPresentation'];
const overrides={placementPresentation:{schemaVersion:1,values:{'lead.detail.basic.phone':{'ko-KR':{label:'Local phone',helpText:'Call clinic'}}}},leadGrid:{schemaVersion:1,pageSize:25,density:'compact',defaultSort:{fieldId:'lead.updatedAt',direction:'desc'}},leadColumnWidths:{schemaVersion:1,values:{'lead.phone':{mode:'min',widthPx:180}}},leadColumnAlignments:{schemaVersion:1,values:{'lead.phone':'end'}},popupPresentation:{schemaVersion:1,values:{'POP.LEAD.CREATE':{titles:{'ko-KR':'Create clinic'},size:'large'}}},buttonPresentation:{schemaVersion:1,values:{'lead.detail.save':'secondary'}}};
function fixture(){const base=(id,kind,extra={})=>({id,kind,labelKey:id,support:'supported',settings:{enabled:true,visible:true,readOnly:false,required:false,order:0},capabilities:['enabled','visible'],locks:[],dependencies:[],permissions:[],readPermissions:[],writePermissions:[],requiredTranslation:true,...extra});const catalog={schemaVersion:1,standardReleaseId:'integrated.1',entries:[base('HQ_LEAD','SCREEN'),base('POP.LEAD.CREATE','POPUP',{screenId:'HQ_LEAD'}),base('LEAD.create','ACTION'),base('LEAD.save','ACTION'),...['hospitalName','status','ownerName','phone','businessNo','updatedAt','keymanMobile','keymanEmail'].map(key=>base('lead.'+key,'FIELD',{screenId:'HQ_LEAD',bindingKind:'DATA',apiField:key}))]},translations=Object.fromEntries(['ko-KR','en-US'].map(l=>[l,Object.fromEntries(catalog.entries.map(e=>[e.id,'Title '+e.id]))]));const members={[id]:{active:true,permissions:['config.read','config.edit','config.preview','config.publish','config.restore','runtime.read'],denied:[]}},states=[A,B].map(c=>{const s=emptyConfigState(c,members);s.dataVersion=17;s.pendingActions={existing:{status:'unchanged'}};return s;}),repo=new MemoryAdminConfigRepository(states),target={...catalog,standardReleaseId:'integrated.2',entries:catalog.entries.filter(e=>!['lead.phone','POP.LEAD.CREATE','LEAD.save'].includes(e.id))};const service=new CompanyConfigurationService(repo,[makeStandardArtifact('integrated',catalog,translations,true),makeStandardArtifact('next',target,translations,true)]);return {repo,s:service,catalog};}
const input=(extra={})=>({patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{},...extra});
const selected=config=>Object.fromEntries(keys.filter(k=>Object.hasOwn(config,k)).map(k=>[k,config[k]]));
async function publish(s,d,who=actor,key='pub'){const v=await s.validate(who,d.id,d.revision);assert.deepEqual(v.errors,[]);await s.preview(who,v.id);return s.publish(who,v.id,d.baseActiveReleaseId??null,'integration',key);}
test('six envelopes share one draft and immutable release; rollback prepares then republishes all properties',async()=>{
 const {s,repo}=fixture();let d=await s.createDraft(actor,'integrated.1',null,'create');d=await s.saveDraft(actor,d.id,1,input(overrides),'save');d=await s.saveDraft(actor,d.id,d.revision,input(),'old-client');assert.deepEqual(selected(d.config),overrides);assert.deepEqual(selected((await s.read(actor)).drafts[0].config),overrides);
 const first=await publish(s,d),frozen=canonicalConfigJson(await s.release(actor,first.id));assert.equal(first.contentHash,configReleaseHash(await s.release(actor,first.id)));const effective=await s.effective(actor);for(const key of keys)assert.ok(effective[key],key);
 d=await s.createDraft(actor,'integrated.1',first.id,'second');d=await s.saveDraft(actor,d.id,d.revision,input({leadGrid:{schemaVersion:1,pageSize:50},buttonPresentation:{schemaVersion:1,values:{'lead.detail.save':'primary'}}}),'change');const second=await publish(s,d,actor,'pub2');const restored=await s.restoreDraft(actor,first.id,second.id,'restore','revert');assert.equal(repo.snapshot(A).activeReleaseId,second.id);assert.deepEqual(selected(restored.config),overrides);const third=await publish(s,restored,actor,'pub3');assert.equal(repo.snapshot(A).activeReleaseId,third.id);assert.deepEqual((await s.effective(actor)).leadGrid,overrides.leadGrid);assert.equal(canonicalConfigJson(await s.release(actor,first.id)),frozen);assert.equal(repo.snapshot(A).dataVersion,17);assert.deepEqual(repo.snapshot(A).pendingActions,{existing:{status:'unchanged'}});
 const b={...actor,companyId:B},bd=await s.createDraft(b,'integrated.1',null,'b');await publish(s,bd,b,'pb');for(const key of keys)assert.equal(Object.hasOwn(await s.effective(b),key),false,key);
});
test('all reset commands restore absent envelopes and preserve legacy canonical release hash',async()=>{
 const {s}=fixture();let d=await s.createDraft(actor,'integrated.1',null,'create');d=await s.saveDraft(actor,d.id,1,input(),'baseline');const canonical=canonicalConfigJson(d.config);d=await s.saveDraft(actor,d.id,d.revision,input(overrides),'all');d=await s.saveDraft(actor,d.id,d.revision,input({placementPresentation:{schemaVersion:1,values:{}},leadGrid:null,leadColumnWidths:null,leadColumnAlignments:null,popupPresentation:null,buttonPresentation:null}),'reset');assert.deepEqual(selected(d.config),{placementPresentation:{schemaVersion:1,values:{}}});
 // S04 uses an explicit empty envelope for reset, unlike later nullable commands.
 const withoutEmpty=structuredClone(d.config);delete withoutEmpty.placementPresentation;assert.equal(canonicalConfigJson(withoutEmpty),canonical);
 const r=await publish(s,d),full=await s.release(actor,r.id);assert.equal(full.contentHash,createHash('sha256').update(canonicalConfigJson({config:full.config,effective:full.effective})).digest('hex'));
});
test('stale edit and validation, revoked grants and foreign restore are rejected atomically',async()=>{
 const {s,repo}=fixture();let d=await s.createDraft(actor,'integrated.1',null,'create');d=await s.saveDraft(actor,d.id,1,input(overrides),'save');const validation=await s.validate(actor,d.id,d.revision);const prior=d.revision;d=await s.saveDraft(actor,d.id,prior,input(),'next');await assert.rejects(s.saveDraft(actor,d.id,prior,input(overrides),'stale'));await assert.rejects(s.publish(actor,validation.id,null,'stale','pub-stale'));await repo.transact(A,id,tx=>{tx.state.members[id].denied.push('config.edit');});const snapshot=canonicalConfigJson(repo.snapshot(A));await assert.rejects(s.saveDraft(actor,d.id,d.revision,input(overrides),'denied'),e=>e.code==='PERMISSION_DENIED');assert.equal(canonicalConfigJson(repo.snapshot(A)),snapshot);
 await repo.transact(A,id,tx=>{tx.state.members[id].denied=[];});const r=await publish(s,d);await assert.rejects(s.restoreDraft({...actor,companyId:B},r.id,r.id,'foreign'),e=>e.code==='RELEASE_CONFLICT');
});
test('standard rebase accumulates presentation conflicts and explicit drop resolves them together',async()=>{
 const {s}=fixture();let d=await s.createDraft(actor,'integrated.1',null,'create');d=await s.saveDraft(actor,d.id,1,input(overrides),'save');d=await s.rebase(actor,d.id,d.revision,'integrated.2',{},'rebase');const conflicts=d.rebase.conflicts.map(c=>c.id);for(const id of ['presentation:lead.detail.basic.phone','columnWidths:HQ_LEAD','columnAlignments:HQ_LEAD','popupPresentation:POP.LEAD.CREATE','buttonPresentation:lead.detail.save'])assert.ok(conflicts.includes(id),id);d=await s.rebase(actor,d.id,d.revision,'integrated.2',Object.fromEntries(conflicts.map(id=>[id,'drop'])),'resolve');assert.deepEqual(d.rebase.conflicts,[]);assert.equal(d.config.leadGrid.pageSize,25);
});
test('legacy-only release keeps original digest formula and denied runtime cannot obtain any new envelope',async()=>{
 const {s,repo}=fixture();let d=await s.createDraft(actor,'integrated.1',null,'legacy');d=await s.saveDraft(actor,d.id,1,input(),'save');const r=await publish(s,d);const legacy=await s.release(actor,r.id);assert.deepEqual(selected(legacy.config),{});assert.equal(legacy.contentHash,createHash('sha256').update(canonicalConfigJson({config:legacy.config,effective:legacy.effective})).digest('hex'));
 d=await s.createDraft(actor,'integrated.1',r.id,'new');d=await s.saveDraft(actor,d.id,1,input(overrides),'all');await publish(s,d,actor,'newpub');await repo.transact(A,id,tx=>{tx.state.members[id].denied.push('runtime.read');});await assert.rejects(s.effective(actor),e=>e.code==='PERMISSION_DENIED');
});

test('lead list publishes and restores email order and mobile visibility for one company', async () => {
  const { s } = fixture();
  const base = ['lead.hospitalName', 'lead.status', 'lead.ownerName', 'lead.phone', 'lead.businessNo'];
  const email = 'lead.keymanEmail', mobile = 'lead.keymanMobile';
  const original = { leadGridColumns: [mobile, email], leadListOrder: [...base, mobile, email] };
  const edited = { leadGridColumns: [email], leadListOrder: [base[0], email, ...base.slice(1)] };
  const other = { ...actor, companyId: B };
  async function save(who, previous, layout, key) {
    const draft = await s.createDraft(who, 'integrated.1', previous, key);
    return s.saveDraft(who, draft.id, draft.revision, input(layout), key);
  }
  const first = await publish(s, await save(actor, null, original, 'initial'), actor, 'initial-pub');
  await publish(s, await save(other, null, original, 'other'), other, 'other-pub');
  const draft = await save(actor, first.id, edited, 'edit');
  assert.deepEqual((await s.read(actor)).drafts.find(row => row.id === draft.id).config.leadListOrder, edited.leadListOrder);
  assert.deepEqual((await s.effective(actor)).leadListOrder, original.leadListOrder);
  const second = await publish(s, draft, actor, 'edit-pub');
  assert.deepEqual((await s.effective(actor)).leadListOrder, edited.leadListOrder);
  assert.deepEqual((await s.effective(other)).leadListOrder, original.leadListOrder);
  const restore = await s.restoreDraft(actor, first.id, second.id, 'restore-layout', 'restore');
  await publish(s, restore, actor, 'restore-pub');
  for (const who of [actor, other]) {
    assert.deepEqual((await s.effective(who)).leadGridColumns, original.leadGridColumns);
    assert.deepEqual((await s.effective(who)).leadListOrder, original.leadListOrder);
  }
});
