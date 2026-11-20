import test from 'node:test';
import assert from 'node:assert/strict';
import { startHqServer } from './server.mjs';
const {seedIDs}=await import('../../backend/src/hq-mock/seed.ts');
const {createHqSeed}=await import('../../backend/src/hq-mock/seed.ts');
const {HqRepository}=await import('../../backend/src/hq-mock/repository.ts');
test('existing persisted mock datasets upgrade without losing data',()=>{const legacy=createHqSeed('HQ_DEMO');delete legacy.collections.followUps;const repo=new HqRepository({datasetId:'HQ_DEMO',load:()=>legacy});const read=repo.read();assert.deepEqual(read.collections.followUps,[]);assert.deepEqual(read.collections.opportunities,legacy.collections.opportunities);assert.equal(read.revision,legacy.revision)});
async function setup(t){
 const server=await startHqServer({port:0,storageDir:false,autoAdvance:false});t.after(()=>{server.server.closeAllConnections();return server.close()});
 async function client(loginId){const auth=await(await fetch(server.url+'/api/hq/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({loginId,password:'HQ-DEMO'})})).json();return async(method,path,body)=>{const response=await fetch(server.url+path,{method,headers:{authorization:`Bearer ${auth.accessToken}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()}}}
 return {server,sales:await client('hq-sales'),viewer:await client('hq-viewer'),branch:await client('hq-branch'),admin:await client('hq-admin')};
}
test('follow-up creation, linked original, update, completion and stale version are safe',async t=>{
 const {sales}=await setup(t),opp=seedIDs.pendingOpportunity,path=`/api/opportunities/${opp}/follow-ups`;
 const created=await sales('POST',path,{title:'제품 제안서 전달',dueDate:'2026-12-20',idempotencyKey:'follow-create'});assert.equal(created.status,200,JSON.stringify(created.body));
 assert.deepEqual(await sales('POST',path,{title:'제품 제안서 전달',dueDate:'2026-12-20',idempotencyKey:'follow-create'}),created);
 const id=created.body.public_id;assert.equal(created.body.opportunity_public_id,opp);assert.equal(created.body.status,'OPEN');
 const detail=await sales('GET',`/api/follow-ups/${id}`);assert.equal(detail.status,200);assert.equal(detail.body.opportunity_public_id,opp);
 const related=await sales('GET',`/api/opportunities/${opp}/related`);assert.equal(related.body.followUps[0].public_id,id);
 const updated=await sales('PATCH',`/api/follow-ups/${id}`,{title:'수정 제안서 전달',dueDate:'2026-12-21',status:'COMPLETED',expectedVersion:created.body.version,idempotencyKey:'follow-update'});assert.equal(updated.status,200,JSON.stringify(updated.body));
 assert.equal(updated.body.status,'COMPLETED');assert.deepEqual(await sales('PATCH',`/api/follow-ups/${id}`,{title:'수정 제안서 전달',dueDate:'2026-12-21',status:'COMPLETED',expectedVersion:created.body.version,idempotencyKey:'follow-update'}),updated);
 assert.equal((await sales('PATCH',`/api/follow-ups/${id}`,{title:'stale',expectedVersion:created.body.version})).status,409);
 assert.equal((await sales('GET',`/api/follow-ups/${id}`)).body.title,'수정 제안서 전달');
 assert.equal((await sales('GET',`/api/opportunities/${opp}`)).body.stage,'NEGOTIATION');
});
test('account merge preserves follow-up and parent account identity',async t=>{
 const {sales,admin}=await setup(t);const created=await sales('POST',`/api/opportunities/${seedIDs.approvedOpportunity}/follow-ups`,{title:'merge reference',dueDate:'2026-12-20'});assert.equal(created.status,200);
 const merged=await admin('POST','/api/accounts/merge',{primaryPublicId:seedIDs.pendingAccount,duplicatePublicIds:[seedIDs.approvedAccount],fieldSources:{accountName:seedIDs.approvedAccount},expectedVersions:{[seedIDs.pendingAccount]:1,[seedIDs.approvedAccount]:1},idempotencyKey:'merge-followup'});assert.equal(merged.status,200,JSON.stringify(merged.body));
 const item=await admin('GET',`/api/follow-ups/${created.body.public_id}`);assert.equal(item.body.account_public_id,seedIDs.pendingAccount);assert.equal(item.body.opportunity_public_id,seedIDs.approvedOpportunity);
});
test('open follow-ups supply the next action and mock overdue count without affecting stage',async t=>{
 const {sales}=await setup(t),opp=seedIDs.pendingOpportunity,path=`/api/opportunities/${opp}/follow-ups`;
 const older=await sales('POST',path,{title:'기한이 지난 조치',dueDate:'2020-01-01'});assert.equal(older.status,200);
 const later=await sales('POST',path,{title:'나중 조치',dueDate:'2099-01-01'});assert.equal(later.status,200);
 const list=await sales('GET','/api/opportunities');assert.equal(list.body.find(row=>row.public_id===opp).next_follow_up.public_id,older.body.public_id);
 const pipeline=await sales('GET','/api/opportunities/pipeline/funnel');assert.equal(pipeline.body.overdueFollowUpCount,1);
 assert.equal((await sales('PATCH',`/api/follow-ups/${older.body.public_id}`,{status:'COMPLETED',expectedVersion:older.body.version})).status,200);
 assert.equal((await sales('GET','/api/opportunities')).body.find(row=>row.public_id===opp).next_follow_up.public_id,later.body.public_id);
 assert.equal((await sales('GET','/api/opportunities/pipeline/funnel')).body.overdueFollowUpCount,0);
});
test('follow-up validation, ownership, account scope and company isolation',async t=>{
 const {sales,viewer,branch,server}=await setup(t),opp=seedIDs.pendingOpportunity,path=`/api/opportunities/${opp}/follow-ups`;
 assert.equal((await sales('POST',path,{title:'',dueDate:'2026-12-20'})).status,400);
 assert.equal((await sales('POST',path,{title:'invalid',dueDate:'2026-02-30'})).status,400);
 assert.equal((await viewer('POST',path,{title:'denied',dueDate:'2026-12-20'})).status,403);
 assert.equal((await branch('POST',path,{title:'not owner',dueDate:'2026-12-20'})).status,403);
 const made=await sales('POST',path,{title:'scope',dueDate:'2026-12-20'});assert.equal(made.status,200);const id=made.body.public_id;
 assert.equal((await branch('PATCH',`/api/follow-ups/${id}`,{status:'COMPLETED',expectedVersion:1})).status,403);
 const before=server.app.repository('HQ_DEMO').read();assert.equal((await sales('GET',`/api/follow-ups/${seedIDs.otherCompanyAccount}`)).status,404);assert.deepEqual(server.app.repository('HQ_DEMO').read(),before);
});
