import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import '../hq-standard/register.mjs';

const {resolveCompanyConfig} = await import('../../packages/contracts/src/crm-customization.ts');
const {MemoryAdminConfigRepository,emptyConfigState} = await import('../../backend/src/customization/config-store.ts');
const {CompanyConfigurationService,makeStandardArtifact} = await import('../../backend/src/customization/config-service.ts');
const {catalog,translations} = JSON.parse(await fs.readFile(new URL('../../packages/contracts/catalogs/hq-customization-baseline.json', import.meta.url), 'utf8'));
const base = {companyId:'company-A',baseStandardReleaseId:catalog.standardReleaseId,patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
const run = (targetId,operation,leadGridColumns=[]) => resolveCompanyConfig(catalog,{...base,leadGridColumns,patches:[{targetId,property:'order',operation,...(operation==='set'?{value:0}:{})}]});

test('list-bound global order cannot be published as a fictitious table placement',()=>{
  for (const id of ['lead.phone','account.crmName']) {
    const result=run(id,'set');
    assert.equal(result.ok,false);
    assert.ok(result.issues.some(issue=>issue.code==='COLUMN_ORDER_PLACEMENT_REQUIRED'&&issue.targetId===id));
  }
  const added=run('lead.address','set',['lead.address']);
  assert.equal(added.ok,false);
  assert.ok(added.issues.some(issue=>issue.code==='COLUMN_ORDER_PLACEMENT_REQUIRED'));
});

test('legacy order override can be removed; registered region fields require placement too',()=>{
  assert.equal(run('lead.phone','reset').ok,true);
  assert.ok(run('lead.address','set').issues.some(issue=>issue.code==='COLUMN_ORDER_PLACEMENT_REQUIRED'));
  assert.equal(run('lead.address','reset').ok,true);
});

test('saved legacy column order blocks publish until reset and revalidated',async()=>{
  const companyId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userId='11111111-1111-4111-8111-111111111111';
  const actor={companyId,id:userId},permissions=['config.read','config.edit','config.preview','config.publish'];
  const repository=new MemoryAdminConfigRepository([emptyConfigState(companyId,{[userId]:{active:true,permissions,denied:[]}})]);
  const service=new CompanyConfigurationService(repository,[makeStandardArtifact('order-fixture',catalog,translations,true)]);
  const draft=await service.createDraft(actor,catalog.standardReleaseId,null,'create');
  const input={patches:[{targetId:'lead.phone',property:'order',operation:'set',value:0}],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  await service.saveDraft(actor,draft.id,draft.revision,input,'save-legacy');
  const invalid=await service.validate(actor,draft.id,draft.revision+1);
  assert.ok(invalid.errors.some(issue=>issue.code==='COLUMN_ORDER_PLACEMENT_REQUIRED'));
  await assert.rejects(service.publish(actor,invalid.id,null,'review','bad-publish'));
  await service.saveDraft(actor,draft.id,draft.revision+1,{...input,patches:[]},'remove-override');
  const valid=await service.validate(actor,draft.id,draft.revision+2);
  assert.deepEqual(valid.errors,[]);
});

test('older draft clients preserve added columns when they omit the optional field',async()=>{
  const companyId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userId='11111111-1111-4111-8111-111111111111';
  const actor={companyId,id:userId},permissions=['config.read','config.edit'];
  const repository=new MemoryAdminConfigRepository([emptyConfigState(companyId,{[userId]:{active:true,permissions,denied:[]}})]);
  const service=new CompanyConfigurationService(repository,[makeStandardArtifact('order-fixture',catalog,translations,true)]);
  const draft=await service.createDraft(actor,catalog.standardReleaseId,null,'create');
  const input={patches:[],activeLocales:['ko-KR','en-US'],defaultLocale:'ko-KR',translations:{}};
  await service.saveDraft(actor,draft.id,1,{...input,leadGridColumns:['lead.address']},'add-column');
  const oldClientSave=await service.saveDraft(actor,draft.id,2,input,'old-client-save');
  assert.deepEqual(oldClientSave.config.leadGridColumns,['lead.address']);
  const remove=await service.saveDraft(actor,draft.id,3,{...input,leadGridColumns:[]},'remove-column');
  assert.deepEqual(remove.config.leadGridColumns,[]);
});
