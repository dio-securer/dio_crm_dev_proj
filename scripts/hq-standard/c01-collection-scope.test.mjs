import test from 'node:test';
import assert from 'node:assert/strict';
import {startHqServer} from './server.mjs';
import {HqRepository} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
async function client(server,loginId) { const login=await fetch(`${server.url}/api/hq/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})}); const {accessToken}=await login.json(); return async (method,path,body)=>{const r=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}; }
test('C01 restricted plan and receipt rows are not disclosed by contract APIs or aggregate',async t=>{
 let repo; const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO'){repo=r;r.transact(d=>{
  d.collections.plans.push({public_id:'00000000-0000-4000-8000-000000009901',company_id:1,organization_id:10,owner_user_id:2,version:1,currency:'KRW',contract_public_id:seedIDs.approvedContract,plan_version:2,installment_no:2,amount:12345,planned_date:'2026-10-20',collection_method:'BANK',is_current:false,adjustment_type:'ARREARS_REALLOCATION'});
  d.collections.collections.push({public_id:'00000000-0000-4000-8000-000000009902',company_id:1,organization_id:10,owner_user_id:2,version:1,currency:'KRW',contract_public_id:seedIDs.approvedContract,erp_collection_no:'HIDDEN',amount:12345,collected_at:'2026-10-22'});
  d.collections.plans.push({public_id:'00000000-0000-4000-8000-000000009903',company_id:1,organization_id:10,owner_user_id:2,version:1,currency:'KRW',contract_public_id:seedIDs.pendingContract,plan_version:1,installment_no:1,amount:1000000,planned_date:'2026-11-20',collection_method:'BANK',is_current:true,adjustment_type:'ORIGINAL'});
 });}return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await client(server,'hq-sales'), admin=await client(server,'hq-admin'); const path=`/api/contracts/${seedIDs.approvedContract}`;
 const plans=await sales('GET',`${path}/collection-plans`);assert.equal(plans.status,200);assert.equal(plans.body.some(x=>x.public_id.endsWith('9901')),false);
 const receipts=await sales('GET',`${path}/collections`);assert.equal(receipts.body.length,0);
 const partial=await sales('GET',`${path}/reconciliation`);assert.equal(partial.status,200);assert.equal(partial.body.actualTotal,null);assert.equal(partial.body.outstandingAmount,null);assert.equal(partial.body.currentPlanTotal,null);assert.equal(partial.body.overduePlanTotal,null);
 const full=await admin('GET',`${path}/reconciliation`);assert.equal(full.body.actualTotal,12345);assert.equal(full.body.outstandingAmount,987655);
 const before=repo.read();const change=await sales('POST',`${path}/collection-plans/change`,{rows:[{installmentNo:1,collectionMethod:'BANK',amount:987655,plannedDate:'2026-11-20'}]});assert.equal(change.status,403);assert.deepEqual(repo.read(),before);
 const pending=`/api/contracts/${seedIDs.pendingContract}`;
 const original=await sales('POST',`${pending}/collection-plans`,{rows:[{installmentNo:1,collectionMethod:'BANK',amount:1000000,plannedDate:'2026-11-20'}]});assert.equal(original.status,403);assert.deepEqual(repo.read(),before);
 const request=await sales('POST',`${pending}/erp-request`,{});assert.equal(request.status,403);assert.deepEqual(repo.read(),before);
});
test('C01 field-level plan amount redaction also prevents inference from totals and writes',async t=>{
 const {createHqApplication}=await import('./runtime.mjs'); const standard=structuredClone(createHqApplication().standard); const field=standard.fields.find(x=>x.fieldKey==='plan.amount'); field.masking='redact'; delete field.unmaskPermission;
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard}});t.after(()=>server.close()); const sales=await client(server,'hq-sales'); const path=`/api/contracts/${seedIDs.approvedContract}`;
 const plans=await sales('GET',`${path}/collection-plans`); assert.equal(plans.status,200); assert.notEqual(plans.body[0].amount,1000000);
 const list=await sales('GET','/api/collection-plans'); assert.notEqual(list.body.find(x=>x.contract_public_id===seedIDs.approvedContract).amount,1000000);
 const rec=await sales('GET',`${path}/reconciliation`); assert.equal(rec.body.currentPlanTotal,null); assert.equal(rec.body.outstandingAmount,null); assert.equal(rec.body.complete,false);
 const change=await sales('POST',`${path}/collection-plans/change`,{rows:[{installmentNo:1,collectionMethod:'BANK',amount:1000000,plannedDate:'2026-11-20'}]}); assert.equal(change.status,403);
});
test('C03 stale initial plan version is rejected without replacing the newer plan',async t=>{
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>server.close());const sales=await client(server,'hq-sales'); const path=`/api/contracts/${seedIDs.pendingContract}`;
 const contract=await sales('GET',path); assert.equal(contract.status,200); const version=contract.body.version;
 const rows=[{installmentNo:1,collectionMethod:'BANK',amount:500000,plannedDate:'2026-11-20'},{installmentNo:2,collectionMethod:'BANK',amount:500000,plannedDate:'2026-12-20'}];
 const first=await sales('POST',`${path}/collection-plans`,{rows,expectedVersion:version});assert.equal(first.status,200);
 const before=await sales('GET',`${path}/collection-plans`);const stale=await sales('POST',`${path}/collection-plans`,{rows,expectedVersion:version});assert.equal(stale.status,409);assert.equal(stale.body.error,'VERSION_CONFLICT');assert.deepEqual((await sales('GET',`${path}/collection-plans`)).body,before.body);
});
test('C04 stale approved plan version is rejected before any change request',async t=>{
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>server.close());const sales=await client(server,'hq-sales'); const path=`/api/contracts/${seedIDs.approvedContract}`;
 const contract=await sales('GET',path); const before=await sales('GET',`${path}/collection-plans`); const rows=[{installmentNo:1,collectionMethod:'BANK',amount:1000000,plannedDate:'2026-11-20'}];
 const stale=await sales('POST',`${path}/collection-plans/change`,{rows,expectedVersion:contract.body.version+1});assert.equal(stale.status,409);assert.equal(stale.body.error,'VERSION_CONFLICT');assert.deepEqual((await sales('GET',`${path}/collection-plans`)).body,before.body);
 const first=await sales('POST',`${path}/collection-plans/change`,{rows,expectedVersion:contract.body.version}); assert.equal(first.status,200);
 const admin=await client(server,'hq-admin'); const advanced=await admin('POST','/api/hq/interfaces/advance',{requestId:first.body.requestId});assert.equal(advanced.status,200);
 const after=await sales('GET',path);assert.ok(after.body.version>contract.body.version);
 const latestPlans=await sales('GET',`${path}/collection-plans`);const retry=await sales('POST',`${path}/collection-plans/change`,{rows,expectedVersion:contract.body.version});assert.equal(retry.status,409);assert.equal(retry.body.error,'VERSION_CONFLICT');assert.deepEqual((await sales('GET',`${path}/collection-plans`)).body,latestPlans.body);
});
test('C01 restricted contract amount does not leak through related APIs or aggregate',async t=>{
 const {createHqApplication}=await import('./runtime.mjs'); const standard=structuredClone(createHqApplication().standard); const f=standard.fields.find(x=>x.fieldKey==='contract.contractAmount'); f.masking='redact'; delete f.unmaskPermission;
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{standard}}); t.after(()=>server.close()); const sales=await client(server,'hq-sales'); const base=`/api/contracts/${seedIDs.approvedContract}`;
 const contract=await sales('GET',base); assert.equal(contract.status,200); assert.notEqual(contract.body.contract_amount,1000000); assert.equal(contract.body.products,undefined);
 const plans=await sales('GET',`${base}/collection-plans`); assert.notEqual(plans.body[0].amount,1000000);
 const rec=await sales('GET',`${base}/reconciliation`); assert.equal(rec.body.contractAmount,null); assert.equal(rec.body.outstandingAmount,null); assert.equal(rec.body.currentPlanTotal,null);
 const order=await sales('GET',`/api/orders/${seedIDs.readyOrder}`); assert.notEqual(order.body.contract_amount,1000000);
 const account=await sales('GET',`/api/accounts/${seedIDs.approvedAccount}/customer-detail`); assert.equal(account.status,200); const related=account.body.contracts.find(x=>x.public_id===seedIDs.approvedContract); assert.equal(related.product_amount,undefined); assert.equal(related.goods_amount,undefined); assert.equal(related.products,undefined);
 const ledger=await sales('GET',`/api/analytics/accounts/${seedIDs.approvedAccount}/ledger?from=2026-10-01&to=2026-10-31&contractPublicId=${seedIDs.approvedContract}`);assert.equal(ledger.status,200);assert.notEqual(ledger.body.scope.contractAmount,1000000);
 const dashboard=await sales('GET','/api/analytics/dashboard?from=2026-10-01&to=2026-10-31');assert.equal(dashboard.status,200);assert.equal(dashboard.body.contracts.amount,null);
 const change=await sales('POST',`${base}/collection-plans/change`,{rows:[{installmentNo:1,collectionMethod:'BANK',amount:1000000,plannedDate:'2026-11-20'}]}); assert.equal(change.status,403);
});
test('C05 registration retries same key without duplicate request or revision change',async t=>{
 let repo; const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO'){repo=r;r.transact(d=>{d.collections.accounts.find(x=>x.public_id===seedIDs.pendingAccount).erp_approved_yn=true;});}return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await client(server,'hq-sales'),path=`/api/contracts/${seedIDs.pendingContract}/erp-request`;
 const version=(await sales('GET',`/api/contracts/${seedIDs.pendingContract}`)).body.version;
 const first=await sales('POST',path,{idempotencyKey:'c05-same',expectedVersion:version}); assert.equal(first.status,200);const before=repo.read();const second=await sales('POST',path,{idempotencyKey:'c05-same',expectedVersion:version}); assert.equal(second.status,200);assert.equal(second.body.requestId,first.body.requestId);assert.deepEqual(repo.read(),before);
 const mismatch=await sales('POST',path,{idempotencyKey:'c05-same',expectedVersion:version+1});assert.equal(mismatch.status,409);assert.equal(mismatch.body.error,'INTERFACE_IDEMPOTENCY_CONFLICT');assert.deepEqual(repo.read(),before);
 const viewer=await client(server,'hq-viewer');assert.equal((await viewer('POST',path,{idempotencyKey:'c05-same',expectedVersion:version})).status,403);assert.deepEqual(repo.read(),before);
 const wrong=await sales('POST',`/api/contracts/${seedIDs.approvedContract}/erp-request`,{idempotencyKey:'c05-same',expectedVersion:version});assert.equal(wrong.status,409);assert.deepEqual(repo.read(),before);
 server.app.standard.actions.find(action=>action.actionKey==='CON.erpRequest').enabled=false;
 const disabled=await sales('POST',path,{idempotencyKey:'c05-same',expectedVersion:version});assert.equal(disabled.status,409);assert.equal(disabled.body.error,'ACTION_NOT_REGISTERED');assert.deepEqual(repo.read(),before);
});
test('C03 mixed explicit currencies are never combined into a contract aggregate or plan request',async t=>{
 const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')r.transact(d=>{d.collections.collections.push({public_id:'00000000-0000-4000-8000-000000009904',company_id:1,organization_id:10,owner_user_id:1,version:1,contract_public_id:seedIDs.approvedContract,erp_collection_no:'USD-1',amount:10,currency:'USD',collected_at:'2026-10-22'});});return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await client(server,'hq-sales'),path=`/api/contracts/${seedIDs.approvedContract}`;
 const rec=await sales('GET',`${path}/reconciliation`);assert.equal(rec.body.actualTotal,null);assert.equal(rec.body.outstandingAmount,null);assert.equal(rec.body.complete,false);
 const ledger=await sales('GET',`/api/analytics/accounts/${seedIDs.approvedAccount}/ledger?from=2026-10-01&to=2026-10-31&contractPublicId=${seedIDs.approvedContract}`);assert.equal(ledger.body.summary.collectionAmount,null);
 const dashboard=await sales('GET','/api/analytics/dashboard?from=2026-10-01&to=2026-10-31');assert.equal(dashboard.body.collections.amount,null);
 const account=await sales('GET',`/api/accounts/${seedIDs.approvedAccount}/customer-detail`);assert.equal(account.body.analytics.collectionAmount,null);
 const change=await sales('POST',`${path}/collection-plans/change`,{rows:[{installmentNo:1,collectionMethod:'BANK',amount:999990,plannedDate:'2026-11-20'}]});assert.equal(change.status,403);
});
test('C03 unknown receipt currency keeps aggregate and changes on hold',async t=>{
 const factory=datasetId=>{const r=new HqRepository({datasetId});if(datasetId==='HQ_DEMO')r.transact(d=>{d.collections.contracts.find(x=>x.public_id===seedIDs.approvedContract).currency='KRW';d.collections.collections.push({public_id:'00000000-0000-4000-8000-000000009905',company_id:1,organization_id:10,owner_user_id:1,version:1,contract_public_id:seedIDs.approvedContract,erp_collection_no:'UNKNOWN-CURRENCY',amount:10,collected_at:'2026-10-22'});});return r;};
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false,application:{repositoryFactory:factory}});t.after(()=>server.close());const sales=await client(server,'hq-sales'),path=`/api/contracts/${seedIDs.approvedContract}`;
 const rec=await sales('GET',`${path}/reconciliation`);assert.equal(rec.body.actualTotal,null);assert.equal(rec.body.complete,false);
 const change=await sales('POST',`${path}/collection-plans/change`,{rows:[{installmentNo:1,collectionMethod:'BANK',amount:999990,plannedDate:'2026-11-20'}]});assert.equal(change.status,403);
});
