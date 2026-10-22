import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication,HqRepository} from './runtime.mjs';
const {seedIDs:ids}=await import('../../backend/src/hq-mock/seed.ts');
const {newHqId}=await import('../../backend/src/hq-mock/model.ts');
const {enqueueInterface,advanceInterface}=await import('../../backend/src/hq-mock/interfaces.ts');

async function client(app,loginId='hq-admin',datasetId='HQ_DEMO') {
  const response=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId,password:'HQ-DEMO',datasetId}});assert.equal(response.status,200);
  const token=response.body.accessToken;
  const request=(method,path,body,headers)=>app.handle({method,path,body,headers,token});
  const ok=async(method,path,body,headers)=>{const result=await request(method,path,body,headers);assert.equal(result.status,200,`${method} ${path}: ${JSON.stringify(result.body)}`);return result.body;};
  const fails=async(method,path,body,status,code,headers)=>{const result=await request(method,path,body,headers);assert.equal(result.status,status,JSON.stringify(result.body));if(code)assert.equal(result.body.error,code);return result.body;};
  return {ok,request,fails,token};
}
const conversion=(version,extra={})=>({accountMode:'NEW',contactMode:'NEW',opportunityMode:'NEW',contactName:'H03 연락처',opportunityName:'H03 영업기회',expectedVersion:version,idempotencyKey:'conversion',...extra});

test('H03 Lead create, all major fields, save/reload/history, optimistic version and soft delete',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales');
  const input={hospitalName:'H03 신규 병원',businessNo:'612-34-56789',keymanName:'목업 키맨',phone:'051-111-2222',keymanMobile:'010-1111-2222',keymanEmail:'keyman@example.invalid',school:'목업대',cohort:'2001',major:'치의학',keymanNote:'첫 상담',hospitalSize:120,doctorCount:2,chairCount:4,mainSystem:'DIO',subSystem:'OTHER',contactExcludeReason:'',exclusionDetail:'추가 내용',mapExcluded:true,hiraExcluded:true,idempotencyKey:'lead-create'};
  const created=await sales.ok('POST','/api/leads',input);assert.equal(created.status,'NEW');assert.equal(created.hospital_size,120);assert.equal(created.hira_sync_exclude_yn,true);assert.equal(created.calculation_status,'UNCONFIRMED');
  assert.equal((await sales.ok('POST','/api/leads',input)).public_id,created.public_id);
  const edited=await sales.ok('PATCH',`/api/leads/${created.public_id}`,{phone:'051-999-8888',keymanNote:'수정 메모',expectedVersion:created.version,idempotencyKey:'lead-edit'});
  assert.equal(edited.version,2);assert.equal((await sales.ok('GET',`/api/leads/${created.public_id}`)).keyman_note,'수정 메모');
  const history=await sales.ok('GET',`/api/leads/${created.public_id}/history`);assert.ok(history.some(row=>row.changes?.phone?.after==='051-999-8888'));
  await sales.fails('PATCH',`/api/leads/${created.public_id}`,{phone:'stale',expectedVersion:1,idempotencyKey:'stale'},409,'VERSION_CONFLICT');
  await sales.fails('PATCH',`/api/leads/${created.public_id}`,{hospitalSize:-1,expectedVersion:2,idempotencyKey:'negative'},422,'ACTION_NOT_ALLOWED');
  await sales.ok('DELETE',`/api/leads/${created.public_id}`,{expectedVersion:2,idempotencyKey:'lead-delete'});
  assert.equal((await sales.ok('DELETE',`/api/leads/${created.public_id}`,{expectedVersion:2,idempotencyKey:'lead-delete'})).deleted,true);
  await sales.fails('GET',`/api/leads/${created.public_id}`,undefined,404);
});
test('H03 selected stages do not persist; forward/reverse transitions and conversion-only terminal state are enforced',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales'),admin=await client(app);
  const lead=await sales.ok('POST','/api/leads',{hospitalName:'단계검증',idempotencyKey:'stage-create'}),selected='FIRST_VISIT';
  assert.equal((await sales.ok('GET',`/api/leads/${lead.public_id}`)).status,'NEW');
  const first=await sales.ok('POST',`/api/leads/${lead.public_id}/status`,{toStatus:selected,reason:'',expectedVersion:1,idempotencyKey:'first'});
  assert.equal(first.status,'FIRST_VISIT');const second=await sales.ok('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'KEYMAN_MEETING',expectedVersion:2,idempotencyKey:'second'});
  await sales.fails('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'NEW',reason:'되돌림',expectedVersion:second.version,idempotencyKey:'reverse-sales'},409,'LEAD_TRANSITION_DENIED');
  await admin.fails('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'NEW',expectedVersion:second.version,idempotencyKey:'reverse-missing'},409,'LEAD_TRANSITION_DENIED');
  const back=await admin.ok('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'NEW',reason:'잘못 선택한 단계',expectedVersion:second.version,idempotencyKey:'reverse-admin'});assert.equal(back.status,'NEW');assert.ok(back.history.some(row=>row.reverse&&row.reason==='잘못 선택한 단계'));
  const before=app.repository('HQ_DEMO').read();await admin.fails('POST',`/api/leads/${lead.public_id}/status`,{toStatus:'CONVERTED',expectedVersion:back.version,idempotencyKey:'bypass'},400,'CONVERSION_ACTION_REQUIRED');assert.deepEqual(app.repository('HQ_DEMO').read(),before);
});
test('H03 owner, company, readonly actor and disabled H01 action boundaries',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales'),viewer=await client(app,'hq-viewer'),admin=await client(app);
  await sales.fails('PATCH',`/api/leads/${ids.otherOwnerLead}`,{hospitalName:'blocked',expectedVersion:1,idempotencyKey:'scope'},404);
  await admin.fails('GET',`/api/leads/${ids.otherCompanyLead}`,undefined,404);
  await viewer.fails('POST','/api/leads',{hospitalName:'blocked',idempotencyKey:'viewer'},403,'PERMISSION_DENIED');
  await sales.fails('POST',`/api/leads/${ids.lead}/assign-owner`,{ownerUserId:3,expectedVersion:1,idempotencyKey:'owner-sales'},403,'PERMISSION_DENIED');
  await admin.fails('POST',`/api/leads/${ids.lead}/assign-owner`,{ownerUserId:999,expectedVersion:1,idempotencyKey:'bad-owner'},400,'OWNER_NOT_REGISTERED');
  const assigned=await admin.ok('POST',`/api/leads/${ids.lead}/assign-owner`,{ownerUserId:3,expectedVersion:1,idempotencyKey:'owner-admin'});assert.equal(assigned.owner_user_id,3);
  await sales.fails('GET',`/api/leads/${ids.lead}`,undefined,404);
  const standard=structuredClone(app.standard);standard.actions.find(row=>row.actionKey==='LEAD.create').enabled=false;
  const blockedApp=createHqApplication({standard}),blocked=await client(blockedApp);
  await blocked.fails('POST','/api/leads',{hospitalName:'blocked policy',idempotencyKey:'blocked'},409,'ACTION_NOT_REGISTERED');
});
test('H03 atomic NEW conversion links all IDs, inherits activity and idempotently replays',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales');
  app.repository('HQ_DEMO').transact(d=>d.collections.activities.push({...d.collections.activities[0],public_id:newHqId(d),related_type:'LEAD',related_public_id:ids.lead,subject:'전환 이전 방문'}));
  const before=app.repository('HQ_DEMO').read(),result=await sales.ok('POST',`/api/leads/${ids.lead}/convert`,conversion(1));
  const d=app.repository('HQ_DEMO').read();assert.equal(d.collections.accounts.length,before.collections.accounts.length+1);assert.equal(d.collections.contacts.length,before.collections.contacts.length+1);assert.equal(d.collections.opportunities.length,before.collections.opportunities.length+1);
  const lead=await sales.ok('GET',`/api/leads/${ids.lead}`);assert.equal(lead.status,'CONVERTED');assert.equal(lead.conversion.accountPublicId,result.accountPublicId);
  assert.equal((await sales.ok('GET',`/api/contacts/${result.contactPublicId}`)).account_public_id,result.accountPublicId);
  assert.equal((await sales.ok('GET',`/api/opportunities/${result.opportunityPublicId}`)).account_public_id,result.accountPublicId);
  assert.equal(d.collections.activities.find(row=>row.subject==='전환 이전 방문').related_public_id,result.accountPublicId);
  assert.deepEqual(await sales.ok('POST',`/api/leads/${ids.lead}/convert`,conversion(1)),result);
  assert.equal(app.repository('HQ_DEMO').read().collections.accounts.length,d.collections.accounts.length);
  await sales.fails('POST',`/api/leads/${ids.lead}/convert`,conversion(1,{opportunityName:'changed'}),409,'IDEMPOTENCY_CONFLICT');
});
test('H03 existing account/contact/opportunity selection and skip branches preserve linked business objects',async()=>{
  const app=createHqApplication(),admin=await client(app);
  const result=await admin.ok('POST',`/api/leads/${ids.lead}/convert`,conversion(1,{accountMode:'EXISTING',existingAccountPublicId:ids.approvedAccount,contactMode:'EXISTING',existingContactPublicId:ids.contact,opportunityMode:'EXISTING',existingOpportunityPublicId:ids.approvedOpportunity}));
  assert.equal(result.accountPublicId,ids.approvedAccount);assert.equal(result.contactPublicId,ids.contact);assert.equal(result.opportunityPublicId,ids.approvedOpportunity);
  const before=app.repository('HQ_DEMO').read();const skipped=await admin.ok('POST',`/api/leads/${ids.duplicateLead}/convert`,conversion(1,{accountMode:'EXISTING',existingAccountPublicId:ids.approvedAccount,contactMode:'SKIP',opportunityMode:'SKIP',idempotencyKey:'skip'}));
  assert.equal(skipped.contactPublicId,null);assert.equal(skipped.opportunityPublicId,null);assert.equal(app.repository('HQ_DEMO').read().collections.contacts.length,before.collections.contacts.length);
});
test('H03 conversion rejects wrong account membership, hidden target, duplicate and arbitrary owner without partial data',async t=>{
  for(const [name,leadId,body,status,error] of [
    ['contact on another account',ids.lead,{accountMode:'EXISTING',existingAccountPublicId:ids.pendingAccount,contactMode:'EXISTING',existingContactPublicId:ids.contact},409,'CONTACT_ACCOUNT_MISMATCH'],
    ['opportunity on another account',ids.lead,{accountMode:'EXISTING',existingAccountPublicId:ids.pendingAccount,contactMode:'SKIP',opportunityMode:'EXISTING',existingOpportunityPublicId:ids.approvedOpportunity},409,'OPPORTUNITY_ACCOUNT_MISMATCH'],
    ['other company',ids.lead,{accountMode:'EXISTING',existingAccountPublicId:ids.otherCompanyAccount},404,'NOT_FOUND'],
    ['other owner',ids.lead,{accountMode:'EXISTING',existingAccountPublicId:ids.otherOwnerAccount},404,'NOT_FOUND'],
    ['business number duplicate',ids.duplicateLead,{},409,'DUPLICATE_ACCOUNT'],
    ['owner reassignment',ids.lead,{ownerUserId:3},403,'OWNER_ASSIGNMENT_DENIED']
  ])await t.test(name,async()=>{const app=createHqApplication(),sales=await client(app,'hq-sales'),before=app.repository('HQ_DEMO').read();await sales.fails('POST',`/api/leads/${leadId}/convert`,conversion(1,body),status,error);assert.deepEqual(app.repository('HQ_DEMO').read(),before);});
});
test('H03 conversion failure rolls back the entire dataset and a corrected retry creates exactly once',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales'),before=app.repository('HQ_DEMO').read();
  await sales.fails('POST',`/api/leads/${ids.lead}/convert`,conversion(1,{simulateFailure:true}),503,'CONVERSION_SIMULATED_FAILURE');assert.deepEqual(app.repository('HQ_DEMO').read(),before);
  const done=await sales.ok('POST',`/api/leads/${ids.lead}/convert`,conversion(1));assert.ok(done.accountPublicId);
  assert.equal(app.repository('HQ_DEMO').read().collections.accounts.length,before.collections.accounts.length+1);
});
test('H03 Contact CRUD updates account counts and preserves contact history',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales');const before=await sales.ok('GET',`/api/accounts/${ids.approvedAccount}`);
  const contact=await sales.ok('POST',`/api/accounts/${ids.approvedAccount}/contacts`,{contactName:'새 스태프',contactType:'STAFF',mobile:'010-0000-0042',email:'staff@example.invalid',isKeyman:false,idempotencyKey:'contact-create'});
  assert.equal((await sales.ok('GET',`/api/accounts/${ids.approvedAccount}`)).contact_count,before.contact_count+1);
  const changed=await sales.ok('PATCH',`/api/contacts/${contact.public_id}`,{contactName:'스태프 변경',note:'업무 연락처',expectedVersion:1,idempotencyKey:'contact-change'});assert.equal(changed.contact_name,'스태프 변경');
  await sales.ok('DELETE',`/api/contacts/${contact.public_id}`,{expectedVersion:2,idempotencyKey:'contact-delete'});
  assert.equal((await sales.ok('DELETE',`/api/contacts/${contact.public_id}`,{expectedVersion:2,idempotencyKey:'contact-delete'})).deleted,true);
  assert.equal((await sales.ok('GET',`/api/accounts/${ids.approvedAccount}`)).contact_count,before.contact_count);
  assert.equal((await sales.ok('GET','/api/contacts')).some(row=>row.public_id===contact.public_id),false);
});
test('H03 hospital fields and management-register partial failures retain row inputs and isolate invalid rows',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales');
  const hospital=await sales.ok('PATCH',`/api/accounts/${ids.approvedAccount}/hospital`,{hospitalSize:240,mainSystem:'DIO',subSystem:'OTHER',dioProductUsage:'임플란트 월10개',expectedVersion:1,idempotencyKey:'hospital'});assert.equal(hospital.hospital_size,240);
  const rows=[{rowKey:'one',publicId:ids.approvedAccount,expectedVersion:2,values:{phone:'051-000-9999'}},{rowKey:'two',publicId:ids.pendingAccount,expectedVersion:1,values:{accountName:''}}];
  const result=await sales.ok('POST','/api/accounts/bulk-update',{idempotencyKey:'bulk',rows});assert.equal(result.successCount,1);assert.equal(result.errorCount,1);assert.deepEqual(result.results[1].input,rows[1]);assert.ok(result.results[1].error.message);
  assert.equal((await sales.ok('GET',`/api/accounts/${ids.approvedAccount}`)).phone,'051-000-9999');assert.equal((await sales.ok('GET',`/api/accounts/${ids.pendingAccount}`)).account_name,'본사 신규 치과');
  const replay=await sales.ok('POST','/api/accounts/bulk-update',{idempotencyKey:'bulk',rows});assert.equal(replay.successCount,1);assert.equal((await sales.ok('GET',`/api/accounts/${ids.approvedAccount}`)).version,3);
  await sales.fails('POST','/api/accounts/bulk-update',{idempotencyKey:'bulk',rows:[...rows,{rowKey:'new',publicId:ids.pendingAccount,expectedVersion:1,values:{phone:'new'}}]},409,'IDEMPOTENCY_CONFLICT');
});
test('H03 ERP required fields align with request snapshot; code/status and ERP source name remain protected',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales'),admin=await client(app);
  const incomplete=await sales.ok('POST','/api/accounts',{accountName:'불완전',idempotencyKey:'incomplete'});await sales.fails('POST',`/api/erp-accounts/${incomplete.public_id}/request`,{expectedVersion:1,idempotencyKey:'bad-erp'},422,'ACTION_NOT_ALLOWED');
  const requested=await sales.ok('POST',`/api/erp-accounts/${ids.pendingAccount}/request`,{expectedVersion:1,idempotencyKey:'erp-request'},{'x-hq-scenario':'DELAYED'});
  const log=app.repository('HQ_DEMO').read().collections.interfaceLogs.find(row=>row.requestId===requested.requestId);
  for(const field of ['companyCode','encryptedProviderNo','businessName','businessNo','ceoName','zipCode','addressLine1','hospitalAddress','providerNo','openDate','taxEmail','accountType','phone'])assert.ok(log.payload[field],field);
  await sales.ok('PATCH',`/api/accounts/${ids.pendingAccount}`,{accountName:'요청 후 CRM 이름',expectedVersion:2,idempotencyKey:'crm-name'});
  await admin.ok('POST','/api/hq/interfaces/advance',{requestId:log.requestId,scenario:'SUCCESS'});
  const account=await sales.ok('GET',`/api/accounts/${ids.pendingAccount}`);assert.equal(account.account_name,'요청 후 CRM 이름');assert.equal(account.erp_account_name,'본사 신규 치과');assert.equal(account.order_allowed,true);
  assert.equal((await sales.ok('GET',`/api/opportunities/${ids.pendingOpportunity}`)).win_allowed,true);
  await sales.fails('PATCH',`/api/accounts/${ids.pendingAccount}`,{erpCustomerCode:'FORGED',expectedVersion:account.version,idempotencyKey:'forged'},403,'SOURCE_FIELD_READ_ONLY');
  await sales.fails('PATCH',`/api/accounts/${ids.pendingAccount}`,{accountStatCode:'3',expectedVersion:account.version,idempotencyKey:'forged-state'},403,'SOURCE_FIELD_READ_ONLY');
});
test('H03 HIRA exclude and manually edited fields preserve CRM values through inbound refresh',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales'),repo=app.repository('HQ_DEMO');
  const lead=await sales.ok('PATCH',`/api/leads/${ids.lead}`,{hospitalName:'수동 병원',hiraExcluded:true,expectedVersion:1,idempotencyKey:'hira-exclude'});
  const actor=app.personas[0];repo.transact(d=>{const log=enqueueInterface(d,actor,{interfaceCode:'IF-HIRA-001',entityType:'HIRA_BATCH',entityPublicId:ids.lead,idempotencyKey:'hira-refresh',payload:{hospitals:[{encryptedProviderNo:lead.encrypted_provider_no,hospitalName:'HIRA 덮어쓰기',phone:'051-NEW'}]}});advanceInterface(d,actor,log.requestId);});
  const after=await sales.ok('GET',`/api/leads/${ids.lead}`);assert.equal(after.hospital_name,'수동 병원');assert.notEqual(after.phone,'051-NEW');
});
test('H03 account 360 tabs share actual related data and scoped totals',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales');
  const detail=await sales.ok('GET',`/api/accounts/${ids.approvedAccount}/customer-detail`);assert.equal(detail.account.public_id,ids.approvedAccount);assert.equal(detail.contacts[0].public_id,ids.contact);assert.equal(detail.analytics.contractCount,1);assert.equal(detail.analytics.outstandingAmount,1000000);assert.ok(Array.isArray(detail.services));assert.ok(Array.isArray(detail.timeline));
  const analytics=await sales.ok('GET',`/api/analytics/accounts/${ids.approvedAccount}/360`);assert.deepEqual(analytics.analytics,detail.analytics);
  await sales.fails('GET',`/api/accounts/${ids.otherOwnerAccount}/customer-detail`,undefined,404);
});
test('H03 merge transfers all account references and rejects foreign ERP identities and source-field choices',async()=>{
  const app=createHqApplication(),admin=await client(app),repo=app.repository('HQ_DEMO');
  const body={primaryPublicId:ids.pendingAccount,duplicatePublicIds:[ids.approvedAccount],fieldSources:{accountName:ids.approvedAccount},expectedVersions:{[ids.pendingAccount]:1,[ids.approvedAccount]:1},idempotencyKey:'merge'};
  const result=await admin.ok('POST','/api/accounts/merge',body);assert.equal(result.primaryPublicId,ids.pendingAccount);
  assert.deepEqual(await admin.ok('POST','/api/accounts/merge',body),result);
  const d=repo.read();for(const collection of ['contacts','opportunities','contracts','orders'])assert.equal(d.collections[collection].some(row=>row.account_public_id===ids.approvedAccount),false);
  assert.equal(d.collections.activities[0].related_public_id,ids.pendingAccount);assert.equal(d.collections.accounts.find(row=>row.public_id===ids.approvedAccount).account_status,'MERGED');
  const app2=createHqApplication(),admin2=await client(app2);app2.repository('HQ_DEMO').transact(d=>{d.collections.accounts.find(row=>row.public_id===ids.pendingAccount).erp_customer_code='OTHER-ERP';});
  const before=app2.repository('HQ_DEMO').read();await admin2.fails('POST','/api/accounts/merge',body,409,'MERGE_DIFFERENT_ERP_CODES');assert.deepEqual(app2.repository('HQ_DEMO').read(),before);
  await admin2.fails('POST','/api/accounts/merge',{...body,fieldSources:{erpCustomerCode:ids.approvedAccount}},400,'ValidationError');
});
test('H03 persistence errors roll back conversion rows and the idempotency receipt together',async()=>{
  let fail=false;const app=createHqApplication({repositoryFactory:datasetId=>new HqRepository({datasetId,save:()=>{if(fail)throw new Error('storage failed');}})}),sales=await client(app,'hq-sales');
  const before=app.repository('HQ_DEMO').read();fail=true;await sales.fails('POST',`/api/leads/${ids.lead}/convert`,conversion(1),500,'HQ_INTERNAL_ERROR');assert.deepEqual(app.repository('HQ_DEMO').read(),before);
  fail=false;await sales.ok('POST',`/api/leads/${ids.lead}/convert`,conversion(1));assert.equal(app.repository('HQ_DEMO').read().collections.accounts.length,before.collections.accounts.length+1);
});

test('H03 B-P1-01 primary pending, failed and timed-out ERP requests block merging atomically',async t=>{
  for(const scenario of ['DELAYED','TRANSIENT_FAILURE','TIMEOUT'])await t.test(scenario,async()=>{
    const app=createHqApplication(),admin=await client(app),repo=app.repository('HQ_DEMO');
    const requested=await admin.ok('POST',`/api/erp-accounts/${ids.pendingAccount}/request`,{expectedVersion:1,idempotencyKey:`pending-${scenario}`},{'x-hq-scenario':scenario});
    if(scenario!=='DELAYED')await admin.ok('POST','/api/hq/interfaces/advance',{requestId:requested.requestId,scenario});
    const account=await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`),before=repo.read();
    await admin.fails('POST','/api/accounts/merge',{primaryPublicId:ids.pendingAccount,duplicatePublicIds:[ids.approvedAccount],expectedVersions:{[ids.pendingAccount]:account.version,[ids.approvedAccount]:1},idempotencyKey:`merge-${scenario}`},409,'MERGE_INTERFACE_PENDING');
    assert.deepEqual(repo.read(),before);
    const log=before.collections.interfaceLogs.find(row=>row.requestId===requested.requestId);
    await admin.ok('POST','/api/hq/interfaces/result',{requestId:log.requestId,resultId:`late-${scenario}`,interfaceCode:'IF-ERP-003',datasetId:log.datasetId,generation:log.generation,businessKey:log.businessKey,success:true,payload:{erpCustomerCode:'PENDING-OWN-IDENTITY',approved:true},version:log.resultVersion+1});
    assert.equal((await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`)).erp_customer_code,'PENDING-OWN-IDENTITY');
    assert.equal((await admin.ok('GET',`/api/accounts/${ids.approvedAccount}`)).erp_customer_code,'MOCK-CUST-0001');
  });
});
test('H03 B-P1-01 ERP customer identity is immutable even for a newer successful result',async()=>{
  const app=createHqApplication(),admin=await client(app),repo=app.repository('HQ_DEMO');
  const requested=await admin.ok('POST',`/api/erp-accounts/${ids.pendingAccount}/request`,{expectedVersion:1,idempotencyKey:'identity'},{'x-hq-scenario':'DELAYED'});
  await admin.ok('POST','/api/hq/interfaces/advance',{requestId:requested.requestId,scenario:'SUCCESS'});
  const before=repo.read(),log=before.collections.interfaceLogs.find(row=>row.requestId===requested.requestId),response={...log.result,resultId:'different-identity',version:log.resultVersion+1,payload:{...log.result.payload,erpCustomerCode:'MUST-NOT-REPLACE'}};
  await admin.fails('POST','/api/hq/interfaces/result',response,409,'ERP_ACCOUNT_IDENTITY_CONFLICT');assert.deepEqual(repo.read(),before);
  await admin.ok('POST','/api/hq/interfaces/result',{...response,resultId:'same-identity',payload:{...log.result.payload}});
  assert.equal((await admin.ok('GET',`/api/accounts/${ids.pendingAccount}`)).erp_customer_code,log.result.payload.erpCustomerCode);
});
test('H03 B-P1-02 field masking covers detail, history, timeline, mutation replay, bulk inputs and audit receipts',async()=>{
  const standard=structuredClone(createHqApplication().standard);
  for(const key of ['lead.phone','account.erp.tel','contact.mobile']){const field=standard.fields.find(row=>row.fieldKey===key);field.masking='last4';delete field.unmaskPermission;}
  const app=createHqApplication({standard}),admin=await client(app),leadPhone='010-1111-9999',accountPhone='010-2222-8888',contactPhone='010-3333-7777';
  const leadInput={phone:leadPhone,expectedVersion:1,idempotencyKey:'masked-lead'};
  for(const result of [await admin.ok('PATCH',`/api/leads/${ids.lead}`,leadInput),await admin.ok('PATCH',`/api/leads/${ids.lead}`,leadInput),await admin.ok('GET',`/api/leads/${ids.lead}`),await admin.ok('GET',`/api/leads/${ids.lead}/history`)]){
    assert.equal(JSON.stringify(result).includes(leadPhone),false);assert.ok(JSON.stringify(result).includes('9999'));
  }
  const accountInput={phone:accountPhone,expectedVersion:1,idempotencyKey:'masked-account'};
  await admin.ok('PATCH',`/api/accounts/${ids.approvedAccount}`,accountInput);
  for(const path of [`/api/accounts/${ids.approvedAccount}/customer-detail`,`/api/analytics/accounts/${ids.approvedAccount}/360`]){
    const result=await admin.ok('GET',path);assert.equal(JSON.stringify(result).includes(accountPhone),false);assert.ok(result.timeline.some(row=>row.changes?.phone?.after?.endsWith('8888')));
  }
  const contactInput={mobile:contactPhone,expectedVersion:1,idempotencyKey:'masked-contact'};
  for(const result of [await admin.ok('PATCH',`/api/contacts/${ids.contact}`,contactInput),await admin.ok('PATCH',`/api/contacts/${ids.contact}`,contactInput)])assert.equal(JSON.stringify(result).includes(contactPhone),false);
  const bulkPhone='010-4444-6666',bulk=await admin.ok('POST','/api/accounts/bulk-update',{idempotencyKey:'masked-bulk',rows:[{rowKey:'masked-row',publicId:ids.approvedAccount,expectedVersion:2,values:{phone:bulkPhone}}]});
  assert.equal(JSON.stringify(bulk).includes(bulkPhone),false);assert.ok(bulk.results[0].input.values.phone.endsWith('6666'));
  const mergeInput={primaryPublicId:ids.pendingAccount,duplicatePublicIds:[ids.approvedAccount],fieldSources:{phone:ids.approvedAccount},expectedVersions:{[ids.pendingAccount]:1,[ids.approvedAccount]:3},idempotencyKey:'masked-merge'};
  for(const result of [await admin.ok('POST','/api/accounts/merge',mergeInput),await admin.ok('POST','/api/accounts/merge',mergeInput)])assert.equal(JSON.stringify(result).includes(bulkPhone),false);
  const audit=await admin.ok('GET','/api/audit-logs'),raw=JSON.stringify(audit);
  for(const value of [leadPhone,accountPhone,contactPhone,bulkPhone])assert.equal(raw.includes(value),false,value);
  assert.equal(raw.includes('fingerprint'),false);assert.ok(audit.some(row=>row.action==='HQ_MUTATION_RECEIPT'&&row.detail.receiptRecorded));
});
test('H03 B-P1-02 field visibility is reapplied when replaying an old mutation receipt',async()=>{
  const original=createHqApplication(),writer=await client(original),input={phone:'010-5555-1234',expectedVersion:1,idempotencyKey:'hidden-replay'};
  await writer.ok('PATCH',`/api/leads/${ids.lead}`,input);const saved=original.repository('HQ_DEMO').read(),standard=structuredClone(original.standard);
  standard.fields.find(row=>row.fieldKey==='lead.phone').visible=false;
  const app=createHqApplication({standard,repositoryFactory:datasetId=>new HqRepository({datasetId,load:()=>structuredClone(saved)})}),reader=await client(app);
  for(const result of [await reader.ok('GET',`/api/leads/${ids.lead}`),await reader.ok('GET',`/api/leads/${ids.lead}/history`),await reader.ok('PATCH',`/api/leads/${ids.lead}`,input)]){
    assert.equal(JSON.stringify(result).includes(input.phone),false);assert.equal(result.phone,undefined);
  }
});
test('H03 B-P1-02 related options and account360 cannot bypass entity READ or screen policies',async()=>{
  const app=createHqApplication();const salesPersona=app.personas.find(row=>row.loginId==='hq-sales');
  salesPersona.permissions=salesPersona.permissions.filter(permission=>!['ACCOUNT.READ','CONTACT.READ','OPPORTUNITY.READ'].includes(permission));
  const sales=await client(app,'hq-sales'),options=await sales.ok('GET',`/api/leads/${ids.lead}/conversion-options`);
  for(const key of ['accounts','contacts','opportunities','duplicates'])assert.deepEqual(options[key],[]);
  for(const path of [`/api/accounts/${ids.approvedAccount}`,`/api/contacts/${ids.contact}`,`/api/opportunities/${ids.approvedOpportunity}`,`/api/analytics/accounts/${ids.approvedAccount}/360`])await sales.fails('GET',path,undefined,403);
  const app2=createHqApplication();app2.personas.find(row=>row.loginId==='hq-sales').permissions=app2.personas.find(row=>row.loginId==='hq-sales').permissions.filter(permission=>!['CONTACT.READ','OPPORTUNITY.READ','CONTRACT.READ','ORDER.READ','SALES.READ','ACTIVITY.READ'].includes(permission));
  const sales2=await client(app2,'hq-sales'),detail=await sales2.ok('GET',`/api/accounts/${ids.approvedAccount}/customer-detail`);
  for(const key of ['contacts','opportunities','contracts','orders','sales','collections','activities','services'])assert.deepEqual(detail[key],[]);
  assert.equal(detail.account.contact_count,0);
  const standard=structuredClone(createHqApplication().standard);standard.screens.find(row=>row.screenKey==='HQ_OPPORTUNITY').permissions.push('SCREEN.OPPORTUNITY.READ');
  const blocked=createHqApplication({standard});blocked.personas[0].permissions=blocked.personas[0].permissions.filter(permission=>permission!=='SCREEN.OPPORTUNITY.READ');const reader=await client(blocked);
  assert.deepEqual((await reader.ok('GET',`/api/leads/${ids.lead}/conversion-options`)).opportunities,[]);
  assert.deepEqual((await reader.ok('GET',`/api/accounts/${ids.approvedAccount}/customer-detail`)).opportunities,[]);
  await reader.fails('GET',`/api/opportunities/${ids.approvedOpportunity}`,undefined,403,'SCREEN_ACCESS_DENIED');
});
test('H03 B-P1-03 conversion preserves HIRA exclusion and mapped manual fields',async t=>{
  for(const excluded of [true,false])await t.test(`excluded=${excluded}`,async()=>{
    const app=createHqApplication(),sales=await client(app,'hq-sales'),repo=app.repository('HQ_DEMO');
    const lead=await sales.ok('PATCH',`/api/leads/${ids.lead}`,{hospitalName:'수동 병원 유지',phone:'051-MANUAL',hiraExcluded:excluded,expectedVersion:1,idempotencyKey:'manual-values'});
    const converted=await sales.ok('POST',`/api/leads/${ids.lead}/convert`,conversion(lead.version,{contactMode:'SKIP',opportunityMode:'SKIP'}));
    const accountBefore=repo.read().collections.accounts.find(row=>row.public_id===converted.accountPublicId);
    assert.equal(accountBefore.hira_sync_exclude_yn,excluded);assert.ok(accountBefore.manual_fields.includes('account_name'));assert.ok(accountBefore.manual_fields.includes('business_name'));assert.ok(accountBefore.manual_fields.includes('phone'));
    repo.transact(d=>{const actor=app.personas[0],log=enqueueInterface(d,actor,{interfaceCode:'IF-HIRA-001',entityType:'HIRA_BATCH',entityPublicId:ids.lead,idempotencyKey:'after-conversion-hira',payload:{hospitals:[{encryptedProviderNo:lead.encrypted_provider_no,hospitalName:'원천 변경 병원',phone:'051-SOURCE',address:'새 원천 주소'}]}});advanceInterface(d,actor,log.requestId);});
    const account=await sales.ok('GET',`/api/accounts/${converted.accountPublicId}`);assert.equal(account.account_name,'수동 병원 유지');assert.equal(account.phone,'051-MANUAL');assert.equal(account.address,excluded?accountBefore.address:'새 원천 주소');
  });
});
test('H03 B-P1-03 unchanged full-form source values do not become manual overrides',async()=>{
  const app=createHqApplication(),sales=await client(app,'hq-sales'),repo=app.repository('HQ_DEMO'),initial=await sales.ok('GET',`/api/leads/${ids.lead}`);
  const changed=await sales.ok('PATCH',`/api/leads/${ids.lead}`,{hospitalName:initial.hospital_name,phone:initial.phone,address:initial.address,keymanNote:'메모만 변경',expectedVersion:initial.version,idempotencyKey:'full-form'});
  assert.deepEqual(repo.read().collections.leads.find(row=>row.public_id===ids.lead).manual_fields,['keyman_note']);
  repo.transact(d=>{const actor=app.personas[0],log=enqueueInterface(d,actor,{interfaceCode:'IF-HIRA-001',entityType:'HIRA_BATCH',entityPublicId:ids.lead,idempotencyKey:'refresh-after-full-form',payload:{hospitals:[{encryptedProviderNo:changed.encrypted_provider_no,hospitalName:'최신 원천명',phone:'051-NEW-SOURCE',address:'최신 원천주소'}]}});advanceInterface(d,actor,log.requestId);});
  const after=await sales.ok('GET',`/api/leads/${ids.lead}`);assert.equal(after.hospital_name,'최신 원천명');assert.equal(after.phone,'051-NEW-SOURCE');assert.equal(after.address,'최신 원천주소');assert.equal(after.keyman_note,'메모만 변경');
});
