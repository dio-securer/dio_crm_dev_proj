import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from './server.mjs';
import {createHqApplication,HqRepository} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
async function client(server) { const login=await fetch(`${server.url}/api/hq/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})}); const {accessToken}=await login.json();return async path=>{const r=await fetch(server.url+path,{headers:{authorization:`Bearer ${accessToken}`}});return {status:r.status,body:await r.json()};}; }
test('AC01 masked phone and business ID cannot be used as hidden search predicates',async t=>{
 const standard=structuredClone(createHqApplication().standard);for(const key of ['account.erp.tel','account.erp.biz_no']) {const field=standard.fields.find(x=>x.fieldKey===key);field.masking='redact';delete field.unmaskPermission;}
 const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')r.transact(d=>{const a=d.collections.accounts.find(x=>x.public_id===seedIDs.approvedAccount);a.phone='010-9876-4321';a.business_no='9876543210';});return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard,repositoryFactory:factory}});t.after(()=>server.close());const call=await client(server);
 for(const secret of ['010-9876-4321','9876543210']) {const res=await call(`/api/accounts?search=${encodeURIComponent(secret)}`);assert.equal(res.status,200);assert.equal(res.body.some(x=>x.public_id===seedIDs.approvedAccount),false);}
 const duplicates=await call('/api/accounts/duplicates/9876543210');assert.equal(duplicates.status,200);assert.equal(duplicates.body.some(x=>x.public_id===seedIDs.approvedAccount),false);
 const normal=await call('/api/accounts?search=승인');assert.equal(normal.status,200);assert.equal(normal.body.some(x=>x.public_id===seedIDs.approvedAccount),true);
});
test('AC01 masked lead fields cannot be used as hidden search predicates',async t=>{
 const standard=structuredClone(createHqApplication().standard);const field=standard.fields.find(x=>x.fieldKey==='lead.phone');field.masking='redact';delete field.unmaskPermission;
 const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')r.transact(d=>{d.collections.leads.find(x=>x.public_id===seedIDs.lead).phone='010-8765-4321';});return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard,repositoryFactory:factory}});t.after(()=>server.close());const call=await client(server);
 const res=await call('/api/leads?search=010-8765-4321');assert.equal(res.status,200);assert.equal(res.body.some(x=>x.public_id===seedIDs.lead),false);
});
test('AC01 masked lead business ID cannot reveal matching conversion candidates',async t=>{
 const standard=structuredClone(createHqApplication().standard);const field=standard.fields.find(x=>x.fieldKey==='lead.businessNo');field.masking='redact';delete field.unmaskPermission;
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard}});t.after(()=>server.close());const call=await client(server);
 const res=await call(`/api/leads/${seedIDs.duplicateLead}/conversion-options`);assert.equal(res.status,200);assert.equal(res.body.duplicates.length,0);
});
test('AC01 allowed and last4 search respect visible values and candidate scope',async t=>{
 const standard=structuredClone(createHqApplication().standard);const field=standard.fields.find(x=>x.fieldKey==='account.erp.tel');field.masking='last4';delete field.unmaskPermission;
 const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')r.transact(d=>{d.collections.accounts.find(x=>x.public_id===seedIDs.approvedAccount).phone='010-9876-4321';});return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard,repositoryFactory:factory}});t.after(()=>server.close());const call=await client(server);
 const raw=await call('/api/accounts?search=010-9876-4321');assert.equal(raw.body.some(x=>x.public_id===seedIDs.approvedAccount),false);
 const suffix=await call('/api/accounts?search=4321');assert.equal(suffix.body.some(x=>x.public_id===seedIDs.approvedAccount),true);
 const business=await call('/api/accounts/duplicates/617-81-10001');assert.equal(business.body.some(x=>x.public_id===seedIDs.approvedAccount),true);
});
async function postClient(server,loginId='hq-sales') {const login=await fetch(`${server.url}/api/hq/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})});const {accessToken}=await login.json();return async(method,path,body)=>{const r=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};}
test('AC05 retrying an ERP MOCK request replays once without changing repository',async t=>{
 let repo;const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')repo=r;return r;};const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await postClient(server);const path=`/api/erp-accounts/${seedIDs.pendingAccount}/request`,body={expectedVersion:1,idempotencyKey:'ac05-request'};
 const first=await sales('POST',path,body);assert.equal(first.status,200);const before=repo.read();const retry=await sales('POST',path,body);assert.equal(retry.status,200);assert.equal(retry.body.requestId,first.body.requestId);assert.deepEqual(repo.read(),before);
 const altered=await sales('POST',path,{...body,expectedVersion:2});assert.equal(altered.status,409);assert.deepEqual(repo.read(),before);
});
test('AC04 stale hospital edits and ERP-source changes are rejected without mutation',async t=>{
 let repo;const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')repo=r;return r;};const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await postClient(server),path=`/api/accounts/${seedIDs.approvedAccount}`;
 const first=await sales('PATCH',`${path}/hospital`,{hospitalSize:123,expectedVersion:1,idempotencyKey:'hospital-first'});assert.equal(first.status,200);const before=repo.read();
 const stale=await sales('PATCH',`${path}/hospital`,{hospitalSize:456,expectedVersion:1,idempotencyKey:'hospital-stale'});assert.equal(stale.status,409);assert.equal(stale.body.error,'VERSION_CONFLICT');assert.deepEqual(repo.read(),before);
 const bypass=await sales('PATCH',path,{erpCustomerCode:'FORGED',expectedVersion:2,idempotencyKey:'erp-bypass'});assert.equal(bypass.status,403);assert.equal(bypass.body.error,'SOURCE_FIELD_READ_ONLY');assert.deepEqual(repo.read(),before);
});
test('AC05 foreign-company ERP request and replay are denied without mutation',async t=>{
 let repo;const foreign='00000000-0000-4000-8000-000000009980';const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO'){repo=r;r.transact(d=>{const source=d.collections.accounts.find(x=>x.public_id===seedIDs.pendingAccount);d.collections.accounts.push({...structuredClone(source),public_id:foreign,company_id:2});});}return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await postClient(server),before=repo.read();
 for(let i=0;i<2;i++){const response=await sales('POST',`/api/erp-accounts/${foreign}/request`,{expectedVersion:1,idempotencyKey:'foreign-retry'});assert.equal(response.status,404);assert.deepEqual(repo.read(),before);}
});
test('AC05 ERP approval does not overwrite CRM account status edited after request',async t=>{
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>server.close());const sales=await postClient(server),admin=await postClient(server,'hq-admin');const path=`/api/accounts/${seedIDs.pendingAccount}`;
 const request=await sales('POST',`/api/erp-accounts/${seedIDs.pendingAccount}/request`,{expectedVersion:1,idempotencyKey:'ac05-conflict'});assert.equal(request.status,200);
 const edit=await sales('PATCH',path,{accountStatus:'CHURN_RISK',expectedVersion:2,idempotencyKey:'ac05-edit'});assert.equal(edit.status,200);
 assert.equal((await admin('POST','/api/hq/interfaces/advance',{requestId:request.body.requestId})).status,200);
 const read=await (await client(server)) (path);assert.equal(read.body.account_status,'CHURN_RISK');assert.equal(read.body.erp_approved_yn,true);assert.equal(read.body.erp_status_conflict,true);
 const resolved=await sales('PATCH',path,{accountStatus:'ACTIVE',expectedVersion:read.body.version,idempotencyKey:'ac05-resolve'});assert.equal(resolved.status,200);assert.equal(resolved.body.erp_status_conflict,false);
});
test('AC05 conflict alert is not disclosed if account status is masked',async t=>{
 const standard=structuredClone(createHqApplication().standard);const field=standard.fields.find(x=>x.fieldKey==='account.accountStatus');field.masking='redact';delete field.unmaskPermission;
 const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')r.transact(d=>{const row=d.collections.accounts.find(x=>x.public_id===seedIDs.approvedAccount);row.account_status='CHURN_RISK';row.erp_status_conflict=true;});return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard,repositoryFactory:factory}});t.after(()=>server.close());const call=await client(server);const result=await call(`/api/accounts/${seedIDs.approvedAccount}`);assert.equal(result.status,200);assert.equal(result.body.erp_status_conflict,undefined);
});
