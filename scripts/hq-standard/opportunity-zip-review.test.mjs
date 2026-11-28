import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const { seedIDs } = await import('../../backend/src/hq-mock/seed.ts');

async function setup(t) {
  const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});
  t.after(()=>{server.server.closeAllConnections();return server.close()});
  async function auth(loginId) {
    const r=await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})});
    assert.equal(r.status,200);const {accessToken}=await r.json();
    return async(method,path,body)=>{const res=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,body:await res.json()}};
  }
  const sales=await auth('hq-sales'),viewer=await auth('hq-viewer'),branch=await auth('hq-branch');
  async function create(extra={}) {const r=await sales('POST','/api/opportunities',{accountPublicId:seedIDs.approvedAccount,opportunityName:'Independent review',expectedCloseDate:'2026-12-20',...extra});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
  return {server,sales,viewer,branch,create};
}

test('cross-company account and non-owner write fail without changing dataset',async t=>{
  const {server,sales,viewer,branch,create}=await setup(t);const opp=await create();const before=server.app.repository('HQ_DEMO').read();
  assert.equal((await sales('POST','/api/opportunities',{accountPublicId:seedIDs.otherCompanyAccount,opportunityName:'foreign',expectedCloseDate:'2026-12-20'})).status,404);
  assert.equal((await viewer('PATCH',`/api/opportunities/${opp.public_id}`,{opportunityName:'denied'})).status,403);
  assert.equal((await branch('PATCH',`/api/opportunities/${opp.public_id}`,{opportunityName:'not owner'})).status,403);
  assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);
});

test('create and basic edit replay exactly once; key conflict and stale edit do not change business state',async t=>{
  const {server,sales}=await setup(t), body={accountPublicId:seedIDs.approvedAccount,opportunityName:'create review',expectedCloseDate:'2026-12-20',idempotencyKey:'independent-create'};
  const created=await sales('POST','/api/opportunities',body);assert.equal(created.status,200);const afterCreate=server.app.repository('HQ_DEMO').read();
  assert.deepEqual(await sales('POST','/api/opportunities',body),created);assert.deepEqual(server.app.repository('HQ_DEMO').read().collections,afterCreate.collections);
  assert.equal((await sales('POST','/api/opportunities',{...body,opportunityName:'changed'})).status,409);
  const url=`/api/opportunities/${created.body.public_id}`,edit={opportunityName:'edited',expectedVersion:created.body.version,idempotencyKey:'independent-update'};
  const saved=await sales('PATCH',url,edit);assert.equal(saved.status,200);const afterEdit=server.app.repository('HQ_DEMO').read();
  assert.deepEqual(await sales('PATCH',url,edit),saved);assert.deepEqual(server.app.repository('HQ_DEMO').read().collections,afterEdit.collections);
  assert.equal((await sales('PATCH',url,{...edit,opportunityName:'different'})).status,409);
  assert.equal((await sales('PATCH',url,{opportunityName:'stale',expectedVersion:created.body.version,idempotencyKey:'independent-update-stale'})).status,409);
  assert.deepEqual(server.app.repository('HQ_DEMO').read().collections,afterEdit.collections);
});

test('pipeline segregates mock amounts by currency without an assumed exchange rate',async t=>{
  const {server,sales,create}=await setup(t);const a=await create({currency:'KRW'}),b=await create({currency:'USD'});
  server.app.repository('HQ_DEMO').transact(d=>{d.collections.opportunities.find(x=>x.public_id===a.public_id).amount=111;d.collections.opportunities.find(x=>x.public_id===b.public_id).amount=222;});
  const r=await sales('GET','/api/opportunities/pipeline/funnel');assert.equal(r.status,200);
  assert.equal(r.body.byStage.find(x=>x.currency==='USD'&&x.stage==='NEEDS_ANALYSIS').amount,222);
  assert.ok(r.body.byStage.every(x=>typeof x.currency==='string'));
  assert.ok(r.body.byStage.every(x=>!('weighted_amount' in x)));
});

test('product add, batch, edit, delete and stage reject stale versions and replay same keys',async t=>{
  const {server,sales,create}=await setup(t);const o=await create(),url=`/api/opportunities/${o.public_id}`;
  assert.equal((await sales('PATCH',url,{opportunityName:'Independent review v2'})).status,200);
  let current=(await sales('GET',url)).body;
  const ops=[
    {method:'POST',path:url+'/products',body:()=>({packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:100000}),key:'independent-add'},
    {method:'PATCH',path:()=>url+'/products/'+current.products[0].public_id,body:()=>({quantity:2}),key:'independent-edit'},
    {method:'DELETE',path:()=>url+'/products/'+current.products[0].public_id,body:()=>({}),key:'independent-delete'},
    {method:'POST',path:url+'/products/batch',body:()=>({items:[{packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:100000}]}),key:'independent-batch'},
    {method:'POST',path:url+'/stage',body:()=>({toStage:'PROPOSAL'}),key:'independent-stage'}
  ];
  for(const op of ops){const path=typeof op.path==='function'?op.path():op.path; const input={...op.body(),expectedVersion:current.version,idempotencyKey:op.key};
    const stale={...input,expectedVersion:current.version-1,idempotencyKey:op.key+'-stale'};const before=server.app.repository('HQ_DEMO').read();
    assert.equal((await sales(op.method,path,stale)).status,409,op.key+' stale');assert.deepEqual(server.app.repository('HQ_DEMO').read(),before,op.key+' stale unchanged');
    const first=await sales(op.method,path,input);assert.equal(first.status,200,`${op.key} ${JSON.stringify(first.body)}`);const saved=server.app.repository('HQ_DEMO').read();
    assert.deepEqual(await sales(op.method,path,input),first,op.key+' replay response');const replay=server.app.repository('HQ_DEMO').read();
    assert.deepEqual(replay,saved,op.key+' replay must not change business data, audit, sequence or dataset revision');
    current=(await sales('GET',url)).body;
  }
});

test('failed stage transition preserves state and history',async t=>{
  const {server,sales,create}=await setup(t);const o=await create(),url=`/api/opportunities/${o.public_id}`;const before=server.app.repository('HQ_DEMO').read();
  const r=await sales('POST',url+'/stage',{toStage:'CLOSED_WON',expectedVersion:o.version,idempotencyKey:'independent-failed-win'});
  assert.equal(r.status,422);assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);
});

test('product validation rejects negative price, fractional quantity and incompatible currency atomically',async t=>{
  const {server,sales,create}=await setup(t);const o=await create(),url=`/api/opportunities/${o.public_id}`;const item={packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:1000};
  for(const bad of [{...item,proposedUnitPrice:-1},{...item,quantity:1.5}]){const before=server.app.repository('HQ_DEMO').read();const r=await sales('POST',url+'/products',bad);assert.equal(r.status,400);assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);}
  const usd=await create({currency:'USD'}),before=server.app.repository('HQ_DEMO').read();assert.equal((await sales('POST',`/api/opportunities/${usd.public_id}/products`,item)).status,422);assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);
});

test('related objects require opportunity and target read access',async t=>{
  const {server,sales,create}=await setup(t);const o=await create(),url=`/api/opportunities/${o.public_id}`;
  const a=await sales('POST','/api/activities/plans',{relatedType:'OPPORTUNITY',relatedPublicId:o.public_id,plannedAt:'2026-12-21T09:00:00Z'});assert.equal(a.status,200);
  const related=await sales('GET',url+'/related');assert.equal(related.status,200);assert.ok(related.body.activities.some(row=>row.public_id===a.body.activityPublicId));
  server.app.standard.screens.find(s=>s.screenKey==='HQ_ACTIVITY').enabled=false;
  const activityHidden=await sales('GET',url+'/related');assert.equal(activityHidden.status,200);assert.deepEqual(activityHidden.body.activities,[]);
  server.app.standard.screens.find(s=>s.screenKey==='HQ_ACTIVITY').enabled=true;
  server.app.standard.screens.find(s=>s.screenKey==='HQ_ACCOUNT').enabled=false;
  const denied=await sales('GET',url+'/related');
  if(denied.status===200){assert.deepEqual(denied.body.activities,[]);assert.deepEqual(denied.body.reports,[]);assert.deepEqual(denied.body.contracts,[]);} else assert.ok([403,404].includes(denied.status),JSON.stringify(denied));
  server.app.standard.screens.find(s=>s.screenKey==='HQ_OPPORTUNITY').enabled=false;
  assert.equal((await sales('GET',url+'/related')).status,403);
});

test('replaying a receipt after its action is disabled does not disclose the prior response',async t=>{
  const {server,sales,create}=await setup(t);const o=await create(),url=`/api/opportunities/${o.public_id}/products`;
  const body={packagePublicId:seedIDs.product,quantity:1,proposedUnitPrice:1000,expectedVersion:o.version,idempotencyKey:'disabled-action-replay'};
  assert.equal((await sales('POST',url,body)).status,200);
  server.app.standard.actions.find(a=>a.actionKey==='OPP.product.add').enabled=false;
  const replay=await sales('POST',url,body);
  assert.notEqual(replay.status,200,`disabled action replay returned ${JSON.stringify(replay.body)}`);
});
