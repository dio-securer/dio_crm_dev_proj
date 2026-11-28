import test from 'node:test';
import assert from 'node:assert/strict';
import {createHqApplication} from './runtime.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
test('product contracts are created atomically and duplicate requests do not create extra contracts',async()=>{
 const app=createHqApplication();const auth=await app.handle({method:'POST',path:'/api/hq/session',body:{loginId:'hq-sales',password:'HQ-DEMO'}});const call=(method,path,body)=>app.handle({method,path,body,token:auth.body.accessToken});
 const opp=await call('POST','/api/opportunities',{accountPublicId:seedIDs.approvedAccount,opportunityName:'CODEX MULTI',expectedCloseDate:'2026-12-01'});assert.equal(opp.status,200);
 const path=`/api/opportunities/${opp.body.public_id}`;
 assert.equal((await call('POST',path+'/products',{packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:150000})).status,200);
 assert.equal((await call('POST',path+'/products',{packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:250000})).status,200);
 assert.equal((await call('POST',path+'/stage',{toStage:'CLOSED_WON'})).status,200);
 const current=(await call('GET',path)).body;const products=current.products;
 const input={expectedVersion:current.version,rows:products.map((p,i)=>({productLineId:p.public_id,contractName:`CODEX ${i}`,productAmount:i?220000:140000,goodsAmount:i?30000:10000,packageClassification:'일반',specialTerms:`TEST ${i}`}))};
 const invalid=structuredClone(input);invalid.rows[1].goodsAmount=1;assert.equal((await call('POST',path+'/contracts',invalid)).status,422);assert.equal((await call('GET',path+'/related')).body.contracts.length,0);
 const created=await call('POST',path+'/contracts',input);assert.equal(created.status,200,JSON.stringify(created.body));assert.equal(created.body.length,2);assert.deepEqual(created.body.map(r=>r.contract_amount),[150000,250000]);assert.equal(created.body[1].special_terms,'TEST 1');
 const repeated=await call('POST',path+'/contracts',input);assert.equal(repeated.status,409);const related=await call('GET',path+'/related');assert.equal(related.body.contracts.length,2);
});
