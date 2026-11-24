import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
test('foreign-currency mock contracts preserve currency and cannot silently use the legacy KRW ERP interface',async t=>{
 const {call,create,server}=await setup(t);
 server.app.repository('HQ_DEMO').transact(d=>{d.collections.products.find(p=>p.public_id===seedIDs.product).currency='USD'});
 const opp=await create({currency:'USD'}),url='/api/opportunities/'+opp.public_id;
 assert.equal((await call('POST',url+'/products',{packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:100})).status,200);
 assert.equal((await call('POST',url+'/stage',{toStage:'CLOSED_WON'})).status,200);
 const contract=await call('POST','/api/contracts',{opportunityPublicId:opp.public_id,productAmount:100,contractDate:'2026-12-20'});
 assert.equal(contract.status,200);assert.equal(contract.body.currency,'USD');
 const result=await call('POST','/api/contracts/'+contract.body.public_id+'/erp-request',{});
 assert.equal(result.status,422);assert.match(JSON.stringify(result.body),/ERP_CONTRACT_CURRENCY_UNSUPPORTED/);
});
async function setup(t){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>{server.server.closeAllConnections();return server.close()});
 const auth=await (await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId:'hq-sales',password:'HQ-DEMO'})})).json();
 const call=async(method,path,body)=>{const r=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()}};
 const create=async(extra={})=>{const r=await call('POST','/api/opportunities',{accountPublicId:seedIDs.approvedAccount,opportunityName:'ZIP contract',expectedCloseDate:'2026-12-20',...extra});assert.equal(r.status,200,JSON.stringify(r.body));return r.body};
 return {server,call,create};
}
test('ZIP opportunity create and update replay once; stale edits do not change the record',async t=>{
 const {call,create}=await setup(t);const first=await create({idempotencyKey:'zip-create'});const replay=await create({idempotencyKey:'zip-create'});assert.equal(first.public_id,replay.public_id);
 const url='/api/opportunities/'+first.public_id;
 const patch={opportunityName:'saved once',expectedVersion:first.version,idempotencyKey:'zip-edit'};
 const saved=await call('PATCH',url,patch);assert.equal(saved.status,200);assert.equal(saved.body.version,first.version+1);
 assert.deepEqual(await call('PATCH',url,patch),saved);
 assert.equal((await call('PATCH',url,{...patch,opportunityName:'different'})).status,409);
 assert.equal((await call('PATCH',url,{opportunityName:'stale',expectedVersion:first.version,idempotencyKey:'zip-stale'})).status,409);
 assert.equal((await call('GET',url)).body.opportunity_name,'saved once');
});
test('ZIP product writes and stage changes support versioned retries and currency',async t=>{
 const {call,create}=await setup(t);let opp=await create();const url='/api/opportunities/'+opp.public_id;
 const item={packagePublicId:seedIDs.product,quantity:2,proposedUnitPrice:100000};
 const body={items:[item],expectedVersion:opp.version,idempotencyKey:'zip-products'};
 const add=await call('POST',url+'/products/batch',body);assert.equal(add.status,200);assert.deepEqual(await call('POST',url+'/products/batch',body),add);
 opp=(await call('GET',url)).body;assert.equal(opp.products.length,1);assert.equal(opp.currency,'KRW');assert.equal(opp.products[0].currency,'KRW');
 const transition={toStage:'PROPOSAL',expectedVersion:opp.version,idempotencyKey:'zip-stage'};
 const moved=await call('POST',url+'/stage',transition);assert.equal(moved.status,200);assert.deepEqual(await call('POST',url+'/stage',transition),moved);
 assert.equal((await call('PATCH',url+'/products/'+opp.products[0].public_id,{quantity:5,expectedVersion:opp.version})).status,409);
 const usd=await create({currency:'USD'});
 assert.equal((await call('POST','/api/opportunities/'+usd.public_id+'/products',item)).status,422);
});
test('ZIP opportunity related activities preserve original linkage',async t=>{
 const {call,create}=await setup(t);const opp=await create();
 const plan=await call('POST','/api/activities/plans',{relatedType:'OPPORTUNITY',relatedPublicId:opp.public_id,plannedAt:'2026-12-22T09:00:00+09:00',visitPurpose:'기회 상담'});assert.equal(plan.status,200);
 const result=await call('GET','/api/opportunities/'+opp.public_id+'/related');assert.equal(result.status,200);assert.equal(result.body.activities.length,1);assert.equal(result.body.activities[0].related_public_id,opp.public_id);assert.deepEqual(result.body.contracts,[]);
});
test('ZIP pipeline separates currencies instead of adding unlike amounts',async t=>{
 const {call,create,server}=await setup(t);const won=await create();const usd=await create({currency:'USD'});
 server.app.repository('HQ_DEMO').transact(d=>{d.collections.opportunities.find(x=>x.public_id===won.public_id).amount=100;d.collections.opportunities.find(x=>x.public_id===usd.public_id).amount=200;});
 const result=await call('GET','/api/opportunities/pipeline/funnel');assert.equal(result.status,200);assert.ok(result.body.byStage.every(x=>x.currency));assert.equal(result.body.byStage.find(x=>x.currency==='USD'&&x.stage==='NEEDS_ANALYSIS').amount,200);
});
